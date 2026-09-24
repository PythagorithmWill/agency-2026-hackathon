-- 001_canonical.sql — Glassbox derived layer (schema `app`).
--
-- Idempotent: every statement is CREATE ... IF NOT EXISTS. Safe to re-run
-- on every refresh. Applies to the LOCAL copy (postgresql://localhost/agency26)
-- and to the Pythagorithm-owned RDS, where the app role may create/replace
-- objects ONLY in schema `app`. Nothing here touches cra/fed/ab/general.
--
-- Tables are FILLED by scripts/refresh-derived.ts (agreement_current, the
-- three rollups, pattern_matches, pattern_runs, data_quality_scorecard) and
-- scripts/refresh-loops.ts (gift_hubs, gift_loops). Both scripts build a
-- `<table>__new` copy, fill it, then swap it in inside one short
-- transaction so readers never see an empty table (see swapTable()).
--
-- Every read path in src/lib feature-detects these tables via
-- to_regclass('app.<table>') (src/lib/db/features.ts) and falls back to the
-- F-3 CTE / analytics snapshot when a table is absent.

CREATE SCHEMA IF NOT EXISTS app;

-- Bookkeeping: one row per refresh step (row counts, durations, cap hits).
CREATE TABLE IF NOT EXISTS app.refresh_meta (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────────
-- 1. Canonical agreement layer — one row per F-1 key
--    (ref_number, COALESCE(recipient_business_number, recipient_legal_name, _id::text)).
--    Row = the CURRENT state of the agreement (highest amendment_number, F-3),
--    restricted to the same base filter the request-path CTE uses
--    (agreement_value > 0 AND recipient_legal_name IS NOT NULL) so every
--    total reconciles exactly with the CTE path.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.agreement_current (
  ref_number              text    NOT NULL,
  agreement_key           text    NOT NULL,   -- second half of the F-1 key
  row_id                  integer NOT NULL,   -- fed.grants_contributions._id of the current row
  recipient_key           text,               -- COALESCE(bn_raw, legal_name): the CTE's recipient identity
  recipient_bn            text,               -- normalised: placeholder tokens → NULL (identity.ts)
  recipient_bn_raw        text,               -- as published (F-6 polyglot)
  is_placeholder_bn       boolean NOT NULL DEFAULT false,
  recipient_legal_name    text,
  recipient_type          text,
  recipient_province      text,
  recipient_city          text,
  owner_org               text,
  department              text,               -- owner_org_title
  program                 text,               -- prog_name_en
  current_value           numeric NOT NULL,   -- agreement_value of the current row (cumulative, F-3)
  original_value          numeric,            -- agreement_value of the lowest-amendment row in the chain
  original_is_amendment   boolean,
  amendment_count         integer NOT NULL DEFAULT 0,  -- rows with is_amendment in the chain
  amendment_max_n         integer,
  first_amendment_date    date,
  last_amendment_date     date,
  agreement_start_date    date,
  agreement_end_date      date,
  fiscal_year             integer,            -- Apr–Mar, labelled by END year (data skill)
  description             text,
  has_negative_rows       boolean NOT NULL DEFAULT false,  -- F-4 in the chain
  has_duplicate_rows      boolean NOT NULL DEFAULT false,  -- F-2 in the chain
  PRIMARY KEY (ref_number, agreement_key)
);
CREATE INDEX IF NOT EXISTS idx_ac_recipient_bn      ON app.agreement_current (recipient_bn);
CREATE INDEX IF NOT EXISTS idx_ac_recipient_bn_raw  ON app.agreement_current (recipient_bn_raw);
CREATE INDEX IF NOT EXISTS idx_ac_recipient_key     ON app.agreement_current (recipient_key);
CREATE INDEX IF NOT EXISTS idx_ac_name_upper        ON app.agreement_current (upper(btrim(recipient_legal_name)));
CREATE INDEX IF NOT EXISTS idx_ac_name              ON app.agreement_current (recipient_legal_name);
CREATE INDEX IF NOT EXISTS idx_ac_ref_number        ON app.agreement_current (ref_number);
CREATE INDEX IF NOT EXISTS idx_ac_department        ON app.agreement_current (department);
CREATE INDEX IF NOT EXISTS idx_ac_program           ON app.agreement_current (program);
CREATE INDEX IF NOT EXISTS idx_ac_fiscal_year       ON app.agreement_current (fiscal_year);
CREATE INDEX IF NOT EXISTS idx_ac_start_date        ON app.agreement_current (agreement_start_date);
CREATE INDEX IF NOT EXISTS idx_ac_value             ON app.agreement_current (current_value DESC);

-- Rollups from agreement_current (current commitment, F-3 safe).
CREATE TABLE IF NOT EXISTS app.recipient_rollup (
  recipient_legal_name text NOT NULL,
  recipient_bn_raw     text,
  recipient_bn         text,
  is_placeholder_bn    boolean NOT NULL DEFAULT false,
  recipient_province   text,
  total                numeric NOT NULL,
  agreement_count      integer NOT NULL,
  department_count     integer NOT NULL,
  program_count        integer NOT NULL,
  fy_min               integer,
  fy_max               integer,
  first_start_date     date,
  last_start_date      date
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_name_bn ON app.recipient_rollup (recipient_legal_name, COALESCE(recipient_bn_raw, ''));
CREATE INDEX IF NOT EXISTS idx_rr_total      ON app.recipient_rollup (total DESC);
CREATE INDEX IF NOT EXISTS idx_rr_bn         ON app.recipient_rollup (recipient_bn);
CREATE INDEX IF NOT EXISTS idx_rr_name_upper ON app.recipient_rollup (upper(btrim(recipient_legal_name)));

CREATE TABLE IF NOT EXISTS app.department_rollup (
  department       text PRIMARY KEY,
  total            numeric NOT NULL,
  agreement_count  integer NOT NULL,
  recipient_count  integer NOT NULL,
  program_count    integer NOT NULL,
  fy_min           integer,
  fy_max           integer
);
CREATE INDEX IF NOT EXISTS idx_dr_total ON app.department_rollup (total DESC);

CREATE TABLE IF NOT EXISTS app.program_rollup (
  program          text NOT NULL,
  department       text NOT NULL,
  total            numeric NOT NULL,
  agreement_count  integer NOT NULL,
  recipient_count  integer NOT NULL,
  fy_min           integer,
  fy_max           integer,
  PRIMARY KEY (program, department)
);
CREATE INDEX IF NOT EXISTS idx_pr_total      ON app.program_rollup (total DESC);
CREATE INDEX IF NOT EXISTS idx_pr_department ON app.program_rollup (department, total DESC);

-- Whole-corpus, per-fiscal-year and per-province rollups (the request
-- path's overview / temporal / province queries become index lookups).
CREATE TABLE IF NOT EXISTS app.overview_rollup (
  id               integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total            numeric NOT NULL,
  agreement_count  integer NOT NULL,
  recipient_count  integer NOT NULL,
  department_count integer NOT NULL,
  program_count    integer NOT NULL,
  fy_min           integer,
  fy_max           integer,
  no_description_total numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app.fiscal_year_rollup (
  fiscal_year      integer PRIMARY KEY,
  total            numeric NOT NULL,
  agreement_count  integer NOT NULL,
  recipient_count  integer NOT NULL,
  program_count    integer NOT NULL
);

CREATE TABLE IF NOT EXISTS app.province_rollup (
  province         text PRIMARY KEY,
  total            numeric NOT NULL,
  agreement_count  integer NOT NULL,
  recipient_count  integer NOT NULL
);

-- ───────────────────────────────────────────────────────────────────────
-- 2. Detector output — every live detector, unbounded (safety cap 20,000
--    per pattern, recorded in pattern_runs.cap_hit).
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.pattern_matches (
  pattern_id          text NOT NULL,
  match_id            text PRIMARY KEY,
  subject_type        text NOT NULL CHECK (subject_type IN ('recipient','agreement','program','department')),
  subject_id          text NOT NULL,
  canonical_name      text NOT NULL,
  severity            text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  signal              numeric NOT NULL,
  evidence            jsonb NOT NULL DEFAULT '[]'::jsonb,
  calibrated_summary  text NOT NULL,
  evidence_strength   numeric(4,3) NOT NULL DEFAULT 0.500 CHECK (evidence_strength >= 0 AND evidence_strength <= 1),
  benign_note         text,
  department          text,
  province            text,
  fiscal_year         integer,
  computed_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pm_pattern_signal   ON app.pattern_matches (pattern_id, signal DESC);
CREATE INDEX IF NOT EXISTS idx_pm_pattern_strength ON app.pattern_matches (pattern_id, evidence_strength DESC);
CREATE INDEX IF NOT EXISTS idx_pm_pattern_dept     ON app.pattern_matches (pattern_id, department);
CREATE INDEX IF NOT EXISTS idx_pm_pattern_prov     ON app.pattern_matches (pattern_id, province);
CREATE INDEX IF NOT EXISTS idx_pm_pattern_fy       ON app.pattern_matches (pattern_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_pm_subject          ON app.pattern_matches (subject_type, subject_id);

CREATE TABLE IF NOT EXISTS app.pattern_runs (
  pattern_id   text PRIMARY KEY,
  match_count  integer NOT NULL,
  cap_hit      boolean NOT NULL DEFAULT false,
  duration_ms  integer NOT NULL,
  error        text,
  computed_at  timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────────
-- 3. Hub-aware CRA gift loops (scripts/refresh-loops.ts).
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.gift_hubs (
  bn           text PRIMARY KEY,
  legal_name   text,
  in_degree    integer NOT NULL,
  out_degree   integer NOT NULL,
  reason       text NOT NULL,   -- 'degree' | 'name' | 'degree+name'
  computed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.gift_loops (
  loop_id          bigint PRIMARY KEY,   -- assigned by refresh-loops.ts (no sequence: tables are swapped)
  hops             integer NOT NULL,
  path_bns         text[]    NOT NULL,   -- origin first; closes back to origin
  path_names       text[]    NOT NULL,
  path_fpes        date[]    NOT NULL,   -- donor fiscal-period-end of each hop
  path_amounts     numeric[] NOT NULL,
  edge_weights     numeric[] NOT NULL,   -- gift / donor's total gifts that fiscal year
  min_edge_weight  numeric   NOT NULL,
  score            numeric   NOT NULL,   -- min_edge_weight × hops penalty
  total_amount     numeric   NOT NULL,
  min_amount       numeric   NOT NULL,
  hub_touched      boolean   NOT NULL DEFAULT false,
  hub_bns          text[]    NOT NULL DEFAULT '{}',
  start_fpe        date      NOT NULL,
  end_fpe          date      NOT NULL,
  span_days        integer   NOT NULL,
  computed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gl_score ON app.gift_loops (score DESC);
CREATE INDEX IF NOT EXISTS idx_gl_bns   ON app.gift_loops USING gin (path_bns);

-- ───────────────────────────────────────────────────────────────────────
-- 4. Data-quality scorecard — one row per KNOWN-DATA-ISSUES id.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app.data_quality_scorecard (
  issue_id     text PRIMARY KEY,
  family       text NOT NULL CHECK (family IN ('F','C','A')),
  title        text NOT NULL,
  description  text NOT NULL,
  count        bigint,
  dollars      numeric,
  status       text NOT NULL CHECK (status IN ('active','mitigated','resolved')),
  guard        text NOT NULL,
  computable   boolean NOT NULL DEFAULT true,
  note         text,
  computed_at  timestamptz NOT NULL DEFAULT now()
);

-- Read access for the web app role (exists on RDS; ignored locally).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'glassbox_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA app TO glassbox_app';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA app TO glassbox_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO glassbox_app';
  END IF;
END $$;
