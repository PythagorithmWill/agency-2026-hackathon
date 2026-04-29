-- Glass Box findings feed — top entities by composite risk score.
-- Owner: PYTH-DB. Reviewed against KNOWN-DATA-ISSUES.md.
--
-- Guards applied:
--   F-3   max-amendment per (ref_number, bn|legal_name|_id) for current commitment
--   F-1/2 partition by (ref_number, COALESCE(bn, legal_name, _id::text))
--   C-7   we treat cra.cra_identification.legal_name as current-state, not historical
--
-- Parameters:
--   $1 = limit (recommended 50)
--   $2 = score floor (recommended 10)

SET search_path TO general, cra, fed, public;

WITH agreement_current AS (
  SELECT DISTINCT ON (
    ref_number,
    COALESCE(recipient_business_number, recipient_legal_name, _id::text)
  )
    _id,
    ref_number,
    recipient_business_number,
    recipient_legal_name,
    recipient_country,
    recipient_province,
    agreement_value,
    agreement_start_date,
    agreement_end_date,
    description_en,
    prog_name_en,
    owner_org_title
  FROM fed.grants_contributions
  ORDER BY
    ref_number,
    COALESCE(recipient_business_number, recipient_legal_name, _id::text),
    NULLIF(amendment_number, '')::int DESC NULLS LAST,
    _id DESC
),
fed_totals AS (
  SELECT
    COALESCE(recipient_business_number, recipient_legal_name) AS recipient_key,
    SUM(agreement_value)::numeric AS total_commitment,
    COUNT(*) AS agreement_count
  FROM agreement_current
  WHERE agreement_value IS NOT NULL
  GROUP BY 1
),
loop_score AS (
  -- cra.loop_universe is keyed by bn (per-entity loop summary), so we use
  -- it directly without a join to loop_participants.
  SELECT
    bn AS bn_root,
    score AS max_loop_score,
    total_loops AS loop_count
  FROM cra.loop_universe
),
violations AS (
  SELECT
    bn AS bn_root,
    COUNT(*) AS arithmetic_violations
  FROM cra.t3010_impossibilities
  GROUP BY 1
),
scored AS (
  SELECT
    e.id AS entity_id,
    e.canonical_name,
    e.bn_root,
    e.dataset_sources,
    COALESCE(ft.total_commitment, 0) AS fed_total_commitment,
    COALESCE(ft.agreement_count, 0)  AS fed_agreement_count,
    COALESCE(ls.max_loop_score, 0)   AS max_loop_score,
    COALESCE(ls.loop_count, 0)       AS loop_count,
    COALESCE(v.arithmetic_violations, 0) AS arithmetic_violations,
    -- Composite score 0-30: 7-dim blend of concentration, loops, violations, country.
    LEAST(30,
      (CASE WHEN ft.total_commitment > 100000000 THEN 6
            WHEN ft.total_commitment > 10000000  THEN 4
            WHEN ft.total_commitment > 1000000   THEN 2
            ELSE 0 END)
      + (CASE WHEN ft.agreement_count > 50 THEN 4
              WHEN ft.agreement_count > 10 THEN 2
              ELSE 0 END)
      + COALESCE(ls.max_loop_score / 4, 0)
      + (CASE WHEN ls.loop_count > 5 THEN 3 ELSE 0 END)
      + (CASE WHEN v.arithmetic_violations > 0 THEN 3 ELSE 0 END)
      + (CASE WHEN ('fed' = ANY(e.dataset_sources)
                AND 'cra' = ANY(e.dataset_sources)) THEN 2 ELSE 0 END)
    ) AS composite_score
  FROM general.entity_golden_records e
  LEFT JOIN fed_totals ft
    ON COALESCE(e.bn_root, e.canonical_name) = ft.recipient_key
  LEFT JOIN loop_score ls ON ls.bn_root = e.bn_root
  LEFT JOIN violations v   ON v.bn_root = e.bn_root
)
SELECT
  entity_id,
  canonical_name,
  bn_root,
  dataset_sources,
  fed_total_commitment,
  fed_agreement_count,
  max_loop_score,
  loop_count,
  arithmetic_violations,
  composite_score,
  CASE
    WHEN composite_score >= 22 THEN 'CRITICAL'
    WHEN composite_score >= 14 THEN 'HIGH'
    WHEN composite_score >= 7  THEN 'MEDIUM'
    ELSE 'LOW'
  END AS score_label
FROM scored
WHERE composite_score >= COALESCE($2::int, 10)
ORDER BY composite_score DESC, fed_total_commitment DESC NULLS LAST
LIMIT COALESCE($1::int, 50);
