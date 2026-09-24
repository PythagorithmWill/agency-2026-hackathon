-- Elections Canada – Contributions to all political entities, as reviewed
-- by Elections Canada (bulk open data).
-- Dataset  ef1e3528-b570-4a42-92ef-18a9749af8f2 (open.canada.ca)
-- Resource c20b6312-ac5b-4a48-8298-b534e33660b9  od_cntrbtn_audt_e.zip → PoliticalFinance/od_cntrbtn_audt_e.csv
-- Licence: Open Government Licence – Canada (ca-ogl-lgo)
-- Idempotent: safe to re-run.
CREATE SCHEMA IF NOT EXISTS elections;

CREATE TABLE IF NOT EXISTS elections.ingest_log (
  id          bigserial PRIMARY KEY,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL,
  file        text NOT NULL,
  rows_loaded bigint NOT NULL,
  seconds     numeric,
  note        text
);

-- The source has no per-contribution identifier, and identical rows are
-- legitimate (two $100 gifts from the same person on the same day). The
-- natural key is therefore the line number within the published file
-- (src_line); row_hash lets a re-run detect content drift. A new upstream
-- snapshot can renumber lines: reload with --truncate.
CREATE TABLE IF NOT EXISTS elections.contributions (
  src_line                bigint PRIMARY KEY,
  row_hash                text NOT NULL,
  political_entity        text,        -- Candidates / Registered parties / Electoral district associations / Leadership contestants / Nomination contestants / Third parties
  recipient_id            text,
  recipient               text,
  recipient_last_name     text,
  recipient_first_name    text,
  recipient_middle_initial text,
  recipient_party         text,
  electoral_district      text,
  electoral_event         text,
  fiscal_or_election_date date,
  form_id                 text,
  financial_report        text,
  part_number             text,
  financial_report_part   text,
  contributor_type        text,        -- Individuals / Corporations / Trade unions / ...
  contributor_name        text,
  contributor_name_norm   text,        -- upper(trim(contributor_name)), collapsed whitespace
  contributor_last_name   text,
  contributor_first_name  text,
  contributor_middle_initial text,
  contributor_city        text,
  contributor_province    text,
  contributor_postal_code text,        -- normalised A1A1A1 or NULL
  contributor_fsa         text,
  received_date           date,
  monetary_amount         numeric(14,2),
  non_monetary_amount     numeric(14,2),
  contribution_given_through text,
  leadership_contestant   text,
  loaded_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contributions_name_norm_idx   ON elections.contributions (contributor_name_norm);
CREATE INDEX IF NOT EXISTS contributions_name_upper_idx  ON elections.contributions (upper(trim(contributor_name)));
CREATE INDEX IF NOT EXISTS contributions_postal_idx      ON elections.contributions (contributor_postal_code);
CREATE INDEX IF NOT EXISTS contributions_fsa_idx         ON elections.contributions (contributor_fsa);
CREATE INDEX IF NOT EXISTS contributions_recipient_idx   ON elections.contributions (recipient_id);
CREATE INDEX IF NOT EXISTS contributions_party_idx       ON elections.contributions (recipient_party);
CREATE INDEX IF NOT EXISTS contributions_date_idx        ON elections.contributions (received_date);
CREATE INDEX IF NOT EXISTS contributions_lastfirst_idx   ON elections.contributions (upper(contributor_last_name), upper(contributor_first_name));
