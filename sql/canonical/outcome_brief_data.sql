-- Outcome Brief data pull — single-entity context fetch.
-- Given an entity_id (or BN), return all federal grants (current commitments),
-- T3010 violations, loop participations, and aggregated dollar totals.
--
-- Guards applied: F-3 (CTE picks max amendment_number per partition).
--
-- Parameters:
--   $1 = entity_id (general.entity_golden_records.entity_id)

SET search_path TO general, cra, fed, public;

WITH e AS (
  SELECT *
  FROM general.entity_golden_records
  WHERE entity_id = $1
  LIMIT 1
),
agreement_current AS (
  SELECT DISTINCT ON (
    g.ref_number,
    COALESCE(g.recipient_business_number, g.recipient_legal_name, g._id::text)
  )
    g._id,
    g.ref_number,
    g.recipient_business_number,
    g.recipient_legal_name,
    g.recipient_country,
    g.recipient_province,
    g.agreement_value,
    g.agreement_start_date,
    g.agreement_end_date,
    g.description_en,
    g.prog_name_en,
    g.owner_org_title
  FROM fed.grants_contributions g, e
  WHERE
    (e.bn_root IS NOT NULL AND g.recipient_business_number = e.bn_root)
    OR (e.bn_root IS NULL AND g.recipient_legal_name ILIKE e.canonical_name)
  ORDER BY
    g.ref_number,
    COALESCE(g.recipient_business_number, g.recipient_legal_name, g._id::text),
    NULLIF(g.amendment_number, '')::int DESC NULLS LAST,
    g._id DESC
),
fed_summary AS (
  SELECT
    SUM(agreement_value)::numeric AS total_current_commitment,
    COUNT(*) AS agreement_count,
    MIN(agreement_start_date) AS earliest_start,
    MAX(agreement_end_date)   AS latest_end,
    array_agg(DISTINCT owner_org_title)        AS departments,
    array_agg(DISTINCT prog_name_en)            AS programs,
    array_agg(DISTINCT recipient_country)       AS countries,
    array_agg(DISTINCT recipient_province)      AS provinces
  FROM agreement_current
  WHERE agreement_value IS NOT NULL
),
violations AS (
  SELECT bn, COUNT(*) AS arithmetic_violations
  FROM cra.t3010_impossibilities, e
  WHERE bn = e.bn_root
  GROUP BY 1
),
loops AS (
  SELECT
    lu.loop_id,
    lu.score,
    lu.hops,
    lu.notes
  FROM cra.loop_universe lu
  JOIN cra.loop_participants lp USING (loop_id), e
  WHERE lp.bn = e.bn_root
  ORDER BY lu.score DESC, lu.hops ASC
  LIMIT 20
)
SELECT
  jsonb_build_object(
    'entity', to_jsonb((SELECT row_to_json(e.*) FROM e)),
    'fed_summary', to_jsonb(fs.*),
    'agreements', COALESCE(jsonb_agg(DISTINCT to_jsonb(ac.*)), '[]'::jsonb),
    'violations', (SELECT to_jsonb(v.*) FROM violations v),
    'loops', COALESCE((SELECT jsonb_agg(to_jsonb(l.*)) FROM loops l), '[]'::jsonb)
  ) AS dossier
FROM agreement_current ac
LEFT JOIN fed_summary fs ON true
GROUP BY fs.*;
