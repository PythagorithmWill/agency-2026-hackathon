-- Performance indexes for the Pythagorithm-owned Glassbox database (RDS).
-- Not present in the hackathon export. Expressions match the app's SQL
-- exactly (src/lib/evaluate/retrieval.ts, src/lib/analytics/queries.ts) so
-- the planner can use them. Run as glassbox_admin after a load:
--   psql "$ADMIN_URL" -f sql/perf-indexes.sql
-- CONCURRENTLY keeps the app readable while they build (minutes each).

-- Search: was a full scan computing to_tsvector over 1.27M descriptions per query.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fed_gc_description_fts
  ON fed.grants_contributions USING gin (to_tsvector('english', description_en));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ab_grants_search_fts
  ON ab.ab_grants USING gin (to_tsvector('english',
       coalesce(program, '') || ' ' || coalesce(recipient, '') || ' ' || coalesce(ministry, '')));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ab_contracts_search_fts
  ON ab.ab_contracts USING gin (to_tsvector('english',
       coalesce(recipient, '') || ' ' || coalesce(ministry, '')));

-- Recipient page by business number; record page + amendment chain by ref.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fed_gc_recipient_bn
  ON fed.grants_contributions (recipient_business_number);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fed_gc_ref_number
  ON fed.grants_contributions (ref_number);

-- Durable evaluation store lookups by proof id (also created lazily by the app).
CREATE INDEX CONCURRENTLY IF NOT EXISTS evaluations_proof_id_idx ON app.evaluations (proof_id);

ANALYZE fed.grants_contributions; ANALYZE ab.ab_grants; ANALYZE ab.ab_contracts;
