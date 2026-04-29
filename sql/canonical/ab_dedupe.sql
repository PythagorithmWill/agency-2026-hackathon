-- AB dedupe wrapper — encapsulates A-13 reversal-pair dedupe and
-- A-10 roll-up exclusion. Use this as a CTE in any AB-touching query.
--
-- A-13: 5,557 excess exact-duplicate rows in FY 2024-25 + 2025-26 alone.
--       951 reversal pairs net to $0 but inflate count by 2x.
--       Dedupe on (ministry, business_unit_name, recipient, program,
--       amount, payment_date) — and pair-collapse the negatives where
--       a positive twin exists.
--
-- A-10: recipient IS NULL rows are publisher-aggregated programs
--       (~$25B in FY2024-25 + 2025-26). Filtering recipient IS NOT NULL
--       drops the roll-up bucket; surface the omitted aggregate elsewhere.
--
-- Usage example:
--   WITH ab_clean AS ( ... this CTE ... )
--   SELECT * FROM ab_clean WHERE ministry = 'Health';

WITH base AS (
  SELECT *,
         row_number() OVER (
           PARTITION BY
             ministry,
             business_unit_name,
             recipient,
             program,
             amount,
             payment_date
           ORDER BY id
         ) AS dedupe_rank
  FROM ab.ab_grants
  WHERE recipient IS NOT NULL                       -- A-10
),
deduped AS (
  SELECT * FROM base WHERE dedupe_rank = 1          -- A-13 exact-duplicate guard
),
paired AS (
  -- Collapse perfect reversal pairs: identical key fields, opposite-sign amounts
  SELECT
    a.*,
    EXISTS (
      SELECT 1 FROM deduped b
      WHERE b.ministry = a.ministry
        AND b.business_unit_name = a.business_unit_name
        AND b.recipient = a.recipient
        AND b.program = a.program
        AND b.amount = -a.amount
        AND b.payment_date = a.payment_date
        AND b.id <> a.id
    ) AS has_reversal_pair
  FROM deduped a
)
SELECT *
FROM paired
WHERE has_reversal_pair = false                     -- drops both halves of the pair
   OR amount > 0;                                   -- ...unless the entry is the positive,
                                                    -- which we keep so totals reflect intent
