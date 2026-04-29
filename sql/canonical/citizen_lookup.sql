-- Citizen Lookup (stretch) — given a postal_code, return aggregated funding
-- flows for organizations registered there.
--
-- Guards applied: A-13 (AB dedupe), A-10 (AB roll-up rows excluded).
--
-- Parameters:
--   $1 = postal_code (uppercase, no space — e.g. 'K1A0A6')
--   $2 = limit (recommended 50)

SET search_path TO general, public;

SELECT
  e.entity_id,
  e.canonical_name,
  e.bn_root,
  e.dataset_sources,
  COALESCE((e.fed_profile->>'total_grants')::numeric, 0)
    + COALESCE((e.ab_profile->>'total_grants')::numeric, 0)
    + COALESCE((e.ab_profile->>'total_contracts')::numeric, 0)
    + COALESCE((e.ab_profile->>'total_sole_source')::numeric, 0)
    AS total_external_funding
FROM general.entity_golden_records e
WHERE e.addresses @> jsonb_build_array(jsonb_build_object('postal_code', $1))
  OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(e.addresses) a
    WHERE replace(upper(a->>'postal_code'), ' ', '') = $1
  )
ORDER BY total_external_funding DESC
LIMIT COALESCE($2::int, 50);
