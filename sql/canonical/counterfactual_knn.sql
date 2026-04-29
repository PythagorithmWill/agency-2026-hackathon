-- Counterfactual k-nearest-neighbours retrieval — for any grant where
-- description_en is NULL / very short, return 8-15 similar grants that DO
-- carry descriptions, bucketed by similarity tier.
--
-- Tier 1: same program AND ±50% dollar bucket
-- Tier 2: same program OR same dollar bucket, ±5 fiscal years
-- Tier 3: parent department fallback
--
-- Guards applied: F-3 (current-commitment CTE).
--
-- Parameters:
--   $1 = ref_number of the source (description-null) grant
--   $2 = limit (recommended 12)

SET search_path TO fed, public;

WITH agreement_current AS (
  SELECT DISTINCT ON (
    ref_number,
    COALESCE(recipient_business_number, recipient_legal_name, _id::text)
  )
    _id,
    ref_number,
    recipient_business_number,
    recipient_legal_name,
    recipient_province,
    prog_name_en,
    owner_org_title,
    agreement_value,
    agreement_start_date,
    description_en
  FROM fed.grants_contributions
  ORDER BY
    ref_number,
    COALESCE(recipient_business_number, recipient_legal_name, _id::text),
    NULLIF(amendment_number, '')::int DESC NULLS LAST,
    _id DESC
),
src AS (
  SELECT * FROM agreement_current WHERE ref_number = $1 LIMIT 1
),
bucketed AS (
  SELECT
    a.*,
    CASE
      WHEN a.prog_name_en = (SELECT prog_name_en FROM src)
        AND a.agreement_value BETWEEN
              (SELECT agreement_value FROM src) * 0.5
          AND (SELECT agreement_value FROM src) * 1.5
        AND a.description_en IS NOT NULL
        AND length(a.description_en) > 80
      THEN 1
      WHEN a.prog_name_en = (SELECT prog_name_en FROM src)
        AND ABS(extract(year from a.agreement_start_date) -
                extract(year from (SELECT agreement_start_date FROM src))) <= 5
        AND a.description_en IS NOT NULL
        AND length(a.description_en) > 80
      THEN 2
      WHEN a.owner_org_title = (SELECT owner_org_title FROM src)
        AND a.description_en IS NOT NULL
        AND length(a.description_en) > 80
      THEN 3
      ELSE NULL
    END AS similarity_tier
  FROM agreement_current a
  WHERE a.ref_number <> $1
)
SELECT
  ref_number AS grant_id,
  description_en AS description,
  agreement_value AS amount,
  owner_org_title AS department_code,
  extract(year from agreement_start_date)::int + 1 AS fiscal_year,
  similarity_tier
FROM bucketed
WHERE similarity_tier IS NOT NULL
ORDER BY similarity_tier ASC, agreement_value DESC NULLS LAST
LIMIT COALESCE($2::int, 12);
