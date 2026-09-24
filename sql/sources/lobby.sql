-- Office of the Commissioner of Lobbying – Registry of Lobbyists open data.
-- Datasets (open.canada.ca, organisation ocl-cal):
--   70ef2117-1095-4d77-80eb-b87f2bada2a4  Lobbying Registrations
--     resource ab35c449-ef35-40cf-bf96-0b0589c1eba5  registrations_enregistrements_ocl_cal.zip
--   a34eb330-7136-4f5e-9f5f-3ba41df58b06  Monthly Communication Reports
--     resource fb2843fb-f5a7-4e4c-92ea-004e65313fe9  communications_ocl_cal.zip
-- Licence: ca-odla-aldg (Open Data Licence Agreement – Office of the
--          Commissioner of Lobbying), NOT the Open Government Licence.
--
-- The zips are served from lobbycanada.gc.ca behind a Cloudflare browser
-- challenge (HTTP 403 to non-browser clients, verified 2026-09-24), so the
-- table layout could not be verified from the data dictionary. The loader
-- (scripts/ingest/lobby.ts) therefore creates one all-text table per CSV
-- inside the zips, named lobby.<file stem>, with the header row as column
-- names, plus src_line as the key. This file only creates the schema and
-- the provenance log. Idempotent.
CREATE SCHEMA IF NOT EXISTS lobby;

CREATE TABLE IF NOT EXISTS lobby.ingest_log (
  id          bigserial PRIMARY KEY,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL,
  file        text NOT NULL,
  rows_loaded bigint NOT NULL,
  seconds     numeric,
  note        text
);
