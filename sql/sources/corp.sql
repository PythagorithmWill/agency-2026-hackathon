-- Corporations Canada – Federal Corporations open dataset (ISED).
-- Dataset 0032ce54-c5dd-4b66-99a0-320a7b5e99f2 (open.canada.ca), four English CSVs:
--   7b6dd154-aa04-46ce-8880-ce4a5fa0a680 corporations-active-cbca-en.csv
--   eb1a8f01-b85b-4190-9aa7-65dde7c623b9 corporations-active-non-cbca-en.csv
--   95b36c01-e21b-4a8a-8bdf-0c128928dc27 corporations-inactive-or-dissolved-cbca-en.csv
--   e9f89fec-428d-4a30-a9e8-fc8e42d91bf6 corporations-inactive-or-dissolved-non-cbca-en.csv
-- Licence: Open Government Licence – Canada (ca-ogl-lgo)
-- Idempotent: safe to re-run.
CREATE SCHEMA IF NOT EXISTS corp;

CREATE TABLE IF NOT EXISTS corp.ingest_log (
  id          bigserial PRIMARY KEY,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL,
  file        text NOT NULL,
  rows_loaded bigint NOT NULL,
  seconds     numeric,
  note        text
);

CREATE TABLE IF NOT EXISTS corp.corporations (
  corporation_number      text PRIMARY KEY,
  business_number         text,        -- 9-digit BN or NULL
  name_form1              text,
  name_form2              text,        -- alternate (usually French/English) name
  name_norm               text,        -- upper(trim(name_form1)), collapsed whitespace
  governing_legislation   text,        -- CBCA / CNCA / Boards of Trade Act / ...
  status                  text,        -- Active / Inactive / Dissolved / ...
  status_detail           text,
  anniversary_date        date,
  year_of_last_annual_filing integer,
  date_of_last_annual_meeting date,
  street                  text,
  street2                 text,
  city                    text,
  province                text,
  country                 text,
  postal_code             text,        -- normalised A1A1A1 or NULL
  fsa                     text,
  min_directors           integer,
  max_directors           integer,
  source_file             text,
  loaded_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corporations_name_norm_idx   ON corp.corporations (name_norm);
CREATE INDEX IF NOT EXISTS corporations_name_upper_idx  ON corp.corporations (upper(trim(name_form1)));
CREATE INDEX IF NOT EXISTS corporations_name2_upper_idx ON corp.corporations (upper(trim(name_form2))) WHERE name_form2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS corporations_bn_idx          ON corp.corporations (business_number) WHERE business_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS corporations_postal_idx      ON corp.corporations (postal_code);
CREATE INDEX IF NOT EXISTS corporations_fsa_idx         ON corp.corporations (fsa);
CREATE INDEX IF NOT EXISTS corporations_status_idx      ON corp.corporations (status);

-- Directors are NOT in the bulk CSV (only min/max counts). This table is the
-- landing zone for the per-corporation Corporations Canada API
-- (https://ised-isde.canada.ca/cc/lgcy/fdrlCrpDtls.html?corpId=<number>, or the
-- open API at https://apis.ised-isde.canada.ca/...) which a later loader can
-- populate. Helpers feature-detect it and return available:false meanwhile.
CREATE TABLE IF NOT EXISTS corp.directors (
  corporation_number      text NOT NULL REFERENCES corp.corporations (corporation_number) ON DELETE CASCADE,
  director_name           text NOT NULL,
  director_name_norm      text NOT NULL,
  street                  text,
  city                    text,
  province                text,
  country                 text,
  postal_code             text,
  fsa                     text,
  resident_canadian       boolean,
  source                  text,
  fetched_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (corporation_number, director_name_norm)
);

CREATE INDEX IF NOT EXISTS directors_name_norm_idx ON corp.directors (director_name_norm);
CREATE INDEX IF NOT EXISTS directors_postal_idx    ON corp.directors (postal_code);
