-- Federal Proactive Publication – Contracts over $10,000 (open.canada.ca)
-- Dataset  d8f85d91-7dec-4fd1-8055-483b77225d8b
-- Resource fac950c0-00d5-4ec1-a4d3-9cbebf98a305 (contracts.csv, consolidated)
-- Licence: Open Government Licence – Canada (ca-ogl-lgo)
-- Idempotent: safe to re-run.
CREATE SCHEMA IF NOT EXISTS fedc;

CREATE TABLE IF NOT EXISTS fedc.ingest_log (
  id          bigserial PRIMARY KEY,
  loaded_at   timestamptz NOT NULL DEFAULT now(),
  source      text NOT NULL,
  file        text NOT NULL,
  rows_loaded bigint NOT NULL,
  seconds     numeric,
  note        text
);

-- One row per published record. Amendments are separate rows sharing
-- procurement_id (see docs/DATA-SOURCES.md "Amendment semantics").
CREATE TABLE IF NOT EXISTS fedc.contracts (
  owner_org                 text NOT NULL,
  reference_number          text NOT NULL,
  owner_org_title           text,
  procurement_id            text,
  vendor_name               text,
  vendor_name_norm          text,        -- upper(trim(vendor_name)), collapsed whitespace
  vendor_postal_code        text,        -- normalised A1A1A1 or NULL
  vendor_fsa                text,
  buyer_name                text,
  contract_date             date,
  fiscal_year               text,        -- derived from contract_date (Apr–Mar)
  economic_object_code      text,
  description_en            text,
  description_fr            text,
  contract_period_start     date,
  delivery_date             date,
  contract_value            numeric(16,2),   -- total-to-date on amendment rows (cumulative)
  original_value            numeric(16,2),
  amendment_value           numeric(16,2),   -- this amendment's delta
  comments_en               text,
  comments_fr               text,
  additional_comments_en    text,
  additional_comments_fr    text,
  agreement_type_code       text,
  trade_agreement           text[],
  land_claims               text[],
  commodity_type            text,        -- C/G/S
  commodity_code            text,        -- GSIN / UNSPSC
  country_of_vendor         text,
  solicitation_procedure    text,        -- AC/OB/ST/TC/TN
  limited_tendering_reason  text[],
  trade_agreement_exceptions text[],
  indigenous_business       text,
  indigenous_business_excluding_psib text,
  intellectual_property     text,
  potential_commercial_exploitation text,
  former_public_servant     text,
  contracting_entity        text,
  standing_offer_number     text,
  instrument_type           text,        -- A (amendment) / C (contract) / SOSA / NULL (pre-2020 rows)
  ministers_office          text,
  number_of_bids            integer,
  article_6_exceptions      text,
  award_criteria            text,
  socioeconomic_indicator   text,
  reporting_period          text,
  is_amendment              boolean GENERATED ALWAYS AS (instrument_type = 'A' OR (instrument_type IS NULL AND amendment_value IS NOT NULL AND amendment_value <> 0)) STORED,
  is_sole_source            boolean GENERATED ALWAYS AS (solicitation_procedure = 'TN') STORED,
  src_line                  bigint,
  loaded_at                 timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_org, reference_number)
);

CREATE INDEX IF NOT EXISTS contracts_vendor_norm_idx   ON fedc.contracts (vendor_name_norm);
CREATE INDEX IF NOT EXISTS contracts_vendor_upper_idx  ON fedc.contracts (upper(trim(vendor_name)));
CREATE INDEX IF NOT EXISTS contracts_postal_idx        ON fedc.contracts (vendor_postal_code);
CREATE INDEX IF NOT EXISTS contracts_fsa_idx           ON fedc.contracts (vendor_fsa);
CREATE INDEX IF NOT EXISTS contracts_procurement_idx   ON fedc.contracts (owner_org, procurement_id);
CREATE INDEX IF NOT EXISTS contracts_date_idx          ON fedc.contracts (contract_date);
CREATE INDEX IF NOT EXISTS contracts_fy_org_idx        ON fedc.contracts (fiscal_year, owner_org);
CREATE INDEX IF NOT EXISTS contracts_solicit_idx       ON fedc.contracts (solicitation_procedure);
CREATE INDEX IF NOT EXISTS contracts_commodity_idx     ON fedc.contracts (commodity_code);

-- Latest-row-per-procurement view: the correct "current value" of a
-- contract is the contract_value of its most recent published row, NOT the
-- sum over rows (amendment rows restate the cumulative total).
CREATE OR REPLACE VIEW fedc.contracts_current AS
SELECT DISTINCT ON (owner_org, COALESCE(procurement_id, reference_number))
  owner_org, owner_org_title,
  COALESCE(procurement_id, reference_number) AS procurement_key,
  procurement_id, reference_number,
  vendor_name, vendor_name_norm, vendor_postal_code, vendor_fsa,
  contract_date, fiscal_year, delivery_date,
  contract_value AS current_value,
  original_value,
  commodity_type, commodity_code, description_en,
  solicitation_procedure, limited_tendering_reason, number_of_bids,
  instrument_type, reporting_period
FROM fedc.contracts
ORDER BY owner_org, COALESCE(procurement_id, reference_number),
         reporting_period DESC NULLS LAST, contract_date DESC NULLS LAST, reference_number DESC;
