# Canonical SQL — `/sql/canonical/`

Reviewed, hand-audited SQL queries the application reads at runtime. Day-of,
no agent calls Kiro live — it reads from this directory.

Every file here applies the four standing landmine guards from
`KNOWN-DATA-ISSUES.md`:

- **F-1 / F-2** — `ref_number` collisions and duplicate `(ref_number,
  amendment_number)` rows. Partition by `(ref_number, COALESCE(bn,
  legal_name, _id))` so colliding agreements stay separated.
- **F-3** — `agreement_value` is cumulative, not delta. We pick the
  highest-numbered amendment per partition with a `WITH agreement_current
  AS (...)` CTE, since the `vw_agreement_current` view named in the data
  skill is not present in the deployed Render replica (decision logged in
  `decisions.md`).
- **A-13** — AB exact duplicates and reversal pairs. Dedupe on
  `(ministry, business_unit_name, recipient, program, amount,
  payment_date)`.
- **A-10** — AB roll-up rows. Filter `recipient IS NOT NULL` and disclose
  the omitted aggregate where total-spend questions are asked.
- **C-3 / C-7** — qualified-donee mismatches and missing CRA name history.
  Use `cra.donee_name_quality` to interpret ambiguities; treat
  `cra.cra_identification.legal_name` as current-state, not historical.

Year alignment everywhere: Apr 1 – Mar 31, labelled by end year.

Each query is parameterized — never string-interpolate user input.
