# Glassbox database (Pythagorithm-owned, AWS)

Provisioned 2026-09-24 after the hackathon organizers' Render read replica was
retired. Everything below lives in AWS account `630956766895`, region `us-east-1`,
next to the Amplify app (`d1a4u3audr30ap`, branch `rebuild-suitability`,
https://glassbox.pythagorithm.ai).

| Thing | Value |
|---|---|
| RDS instance | `glassbox-db` — PostgreSQL 17, `db.t4g.large`, 100 GB gp3 (autoscale to 250), encrypted, 7-day backups, deletion protection ON |
| Endpoint | `glassbox-db.cknqye6e23vr.us-east-1.rds.amazonaws.com:5432`, database `glassbox` |
| Parameter group | `glassbox-pg17` (`rds.force_ssl=1`) |
| Security group | `glassbox-rds-sg` — 5432 open to 0.0.0.0/0 because Amplify SSR compute has no VPC egress; TLS is mandatory and the app verifies the RDS CA (`src/lib/db/rds-ca.ts`) |
| Admin role | `glassbox_admin` — Secrets Manager `glassbox/database-admin-url` (base URL, no ssl params) |
| App role | `glassbox_app` — SELECT on `cra, fed, ab, general`; owns objects in `app`; password in `glassbox/database-app-password`; full URL in `glassbox/database-url` (what Amplify's `DATABASE_URL` is set to) |
| Source bundle | `s3://glassbox-data-630956766895/source-bundles/april-26-hackathon-dataset.zip` (organizers' 2026-04-21 export, 13.5 GB JSONL, 82 tables) |
| Loader assets | `s3://glassbox-data-630956766895/loader/` — `glassbox-loader.sh` (EC2 user-data), `local-db-kit.tgz` (upstream import kit), `fed-merge.js`, `app-role.sql`; logs under `loader/logs/` |
| Loader IAM | role + instance profile `glassbox-loader` (S3 bucket RW, `glassbox/*` secrets read, SSM) |

## Schemas

`cra`, `fed`, `ab`, `general` are the hackathon corpus exactly as exported
(see `govalta-upstream/.local-db/manifest.json` for row counts). `app` is ours:

- `app.evaluations` — durable evaluation results / proof tokens (created lazily by the app role; see `src/lib/evaluate/store.ts`).
- `app.data_refresh_log` — one row per corpus refresh (written by `fed-merge.js`).

## Refreshing the federal corpus

The federal Grants & Contributions dataset on open.canada.ca
(`432527ab-7aac-45b5-81d6-7597107a7013`, resource `1d15a62f-…`) is regenerated
by TBS as departments submit; content arrives in quarterly waves (within 30
days of quarter end). **The CKAN datastore `_id` is renumbered on every
re-upload**, and `general.entity_source_links.source_pk` references fed rows by
`_id`, so a full replace would orphan 1.27M entity links and the upstream
`ON CONFLICT (_id) DO NOTHING` import would duplicate the corpus.
`fed-merge.js` therefore stages the live feed and inserts only rows whose
natural key `(ref_number, amendment_number, owner_org, recipient_legal_name,
agreement_value)` is absent, then `npm run fix-quality` (upstream) normalises
the new rows and sets `is_amendment`.

To re-run a refresh: launch a fresh EC2 with `glassbox-loader.sh` as user-data
after removing the "bundle import" step (or run the `federal refresh` section
by hand from any host that can reach RDS with the admin URL), then rebuild the
analytics snapshot:

```bash
DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id glassbox/database-url --region us-east-1 --query SecretString --output text)" \
  npx tsx scripts/build-snapshot.ts && npx tsx scripts/augment-snapshot.ts
git add data/analytics-snapshot.json && git commit -m "[glassbox-data] snapshot YYYY-MM-DD" && git push origin HEAD:rebuild-suitability
```

Alberta (`ab`) and CRA (`cra`) refreshes are not automated: the upstream AB
module loads the 2024-25/2025-26 years from TBF disclosure CSVs kept locally,
and CRA T3010 is an annual release. Re-running the upstream `general`
entity-resolution pipeline (Splink) is required for new entities to get golden
records; new federal rows still resolve by BN/name on the recipient page.

## Cutting the app over to a new database

1. Put the app-role URL in `glassbox/database-url`.
2. `aws amplify update-app` **and** `update-branch` with `DATABASE_URL=<url>` (both levels exist).
3. `aws amplify start-job --job-type RELEASE` (env vars are baked at build time).
4. `curl https://glassbox.pythagorithm.ai/api/health` must return `overall: ok`.
