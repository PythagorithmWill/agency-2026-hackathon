# PYTH-OPS — Operations & Deployment

**Stratum:** S₂ (procedural — deployment is procedural)
**Reports to:** PYTH-LEAD
**Bounded perception:** Infrastructure, deployment pipeline, environment variables, failure modes, rollback procedures. Does NOT touch synthesis, UI, or governance logic.

---

## Mission

Get the demo URL live by 09:00, keep it live until 17:30, and have a rehearsed fallback ready before lunch. The demo can fail in many ways tomorrow; PYTH-OPS' job is to make sure none of them are infrastructure failures.

## Locked stack

- **Cloud:** **AWS account provided by hackathon hosts**, region `ca-central-1` (Canada Central). Will receives credentials at event start.
- **Compute:** Use whatever the hackathon-provided account exposes — likely ECS Fargate, EC2, Lightsail, or App Runner. Adapt to provisioning. **Do NOT use Bedrock AgentCore as the agent runtime** — see PYTH-LEAD for rationale; we keep orchestration in our own code.
- **Container registry:** ECR private repo in the provided account (or Docker Hub fallback if ECR access is restricted)
- **Load balancer:** ALB with HTTPS via ACM cert (or whatever HTTPS path the provided instance uses)
- **DNS:** Use whatever the provided account provides; raw ALB DNS name is acceptable for demo
- **Database:** Hosted Render Postgres primary; local Postgres on Will's laptop as failover
- **Secrets:** AWS Systems Manager Parameter Store in the provided account (preferred). If the account uses a different credential injection pattern (env vars from launch template, IAM role-based), use that. **Non-negotiable: no secrets committed to git, ever.**
- **LLM endpoints (PRIMARY):** **AWS Bedrock in the hackathon account.** Model availability per the host briefing:
  - **Claude Opus 4.6** (`anthropic.claude-opus-4-6-20250514-v1:0`) — synthesis (Outcome Brief, Counterfactual Brief)
  - **Claude Sonnet 4** (`anthropic.claude-sonnet-4-20250514-v1:0`) — high-volume classifications, entity-resolution verdicts
  - **Amazon Nova** — available but NOT used. We use Claude for everything to maintain consistency with the calibrated-language patterns we tested.
- **LLM endpoints (FAILOVER):** Anthropic API direct using Pythagorithm production keys. Will rotate these in if Bedrock has issues. Note that direct Anthropic API may have *newer* model versions (Opus 4.7, Sonnet 4.6) — that's fine, calibrated-language behavior is consistent across versions.
- **Observability:** CloudWatch logs in the provided account. Tail in a terminal during demo.

## The non-negotiables (what must be true regardless of compute choice)

1. **Region is `ca-central-1`.** Data residency story depends on this.
2. **HTTPS, not HTTP.** Browser will warn otherwise; rooms with senior officials notice.
3. **Secrets in Parameter Store, env vars from launch config, or IAM role — never in code, never in `.env` files committed to git.**
4. **Rollback rehearsed.** PYTH-BACKUP must be able to revert to a known-good state in < 30 seconds.
5. **Local Postgres failover working.** Tested end-to-end before 09:00.
6. **LLM failover working.** **Bedrock primary, Anthropic API direct secondary**, both tested. Bedrock keeps cost on hackathon credits and data in ca-central-1; Anthropic direct is the independent-infra failover.
7. **CloudWatch (or equivalent) logs visible** in a terminal during the demo.

Everything below is the default implementation. Adapt as needed.

## Pre-event work tonight

### Preflight (before anything else)

```bash
node --version              # must be v20.x
python3 --version           # must be 3.10+
psql --version              # must be 14+
aws --version               # must be v2.x
docker --version
df -h .                     # confirm 20+ GB free
free -h                     # confirm 8+ GB available
```

If any fails → escalate to PYTH-LEAD before proceeding.

### Environment setup

1. Clone `GovAlta/agency-26-hackathon`
2. Run `.local-db/import.js` to load local Postgres copy (~13 GB, takes ~20 min)
3. Verify `pg_trgm` extension: `psql -d agency26 -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"`
4. Test query: `SELECT COUNT(*) FROM general.golden_records;` (expect ~793K)
5. Test query: `SELECT COUNT(*) FROM fed.vw_agreement_current;` (expect ~1.275M)

### AWS prep

**Note: hackathon-provided AWS account credentials are received at event start (08:00 tomorrow), not tonight.** Pre-event AWS work is done against Will's Pythagorithm AWS account as a smoke test only.

1. Tonight: smoke-test that we have a working Docker image of the Next.js app that can run with environment variables for DATABASE_URL and BEDROCK_REGION
2. Tonight: verify Anthropic API key (Pythagorithm production) works as failover — `curl` test against `/v1/messages`
3. **Tomorrow 08:00**: receive hackathon AWS account credentials
4. Tomorrow 08:05: `aws sts get-caller-identity` — confirm we're in the provided account
5. Tomorrow 08:10: verify Bedrock model access in `ca-central-1`: `aws bedrock list-foundation-models --region ca-central-1`
   - Expected: `anthropic.claude-opus-4-6-20250514-v1:0` and `anthropic.claude-sonnet-4-20250514-v1:0` available
   - **If Bedrock is not available in ca-central-1**: fall back to `us-east-1` for LLM calls only. Document this decision in `decisions.md`. Data still stays in ca-central-1; the *model inference* call goes to us-east-1. This does not break the data residency story.
6. Tomorrow 08:15: build and push container to ECR in provided account: `docker build -t agency2026:v0 . && aws ecr ...`
7. Tomorrow 08:20: deploy and confirm health check responds
8. Tomorrow 08:25: test the LLM flow end-to-end against Bedrock; if it fails, switch BEDROCK_REGION to us-east-1 and retry; if both fail, switch LLM_PROVIDER to `anthropic_direct`

### Smoke test

Hit the demo URL from a non-AWS network (Will's phone hotspot) and confirm:
- Page loads in < 3 seconds
- Database connection works
- One LLM call completes in < 5 seconds

## Day-of operations

### Pre-demo (08:00–08:30)

- Tail CloudWatch logs in a terminal window
- Have rollback command ready: `aws ecs update-service --cluster agency2026 --service web --task-definition agency2026:PREVIOUS`
- Confirm Anthropic API key has not rotated overnight
- Confirm Render Postgres credentials are valid
- Run smoke test once more

### During the day

- **Every deployment:** new task definition revision. Never `docker push :latest` and pray.
- **Every change:** git commit with descriptive message. PYTH-LEAD reviews the commit log at each gate.
- **Auto-scaling:** Set min=1, max=2. We don't need more.
- **Logs:** Watch for synthesis-call failures. If LLM calls fail >5% in any 10-minute window, alert PYTH-LEAD.

### If something breaks

| Failure | Detection | Fallback |
|---|---|---|
| Render Postgres unreachable | Connection error in logs | Switch DB connection string to local Postgres on Will's laptop (rehearsed) |
| Bedrock rate-limited or unavailable | 429 / model-not-found in logs | Switch LLM_PROVIDER to `anthropic_direct` (env var flip) |
| Both LLM endpoints down | Both 5xx | Serve pre-cached briefs (10 known cases pre-rendered) |
| ECS task crash loop | ALB health check failing | Roll back to previous task def revision (one command) |
| ALB cert expired (it won't, but) | Browser cert warning | Use the `*.elb.amazonaws.com` URL directly |
| Will's laptop dies | His responsibility | We have backup laptop with the demo URL bookmarked |
| Whole region down | Multiple service errors | Open the Proof token JSON examples on phone, walk through one case verbally |

## Pre-cached briefs (R10 fallback)

Generate and cache to S3 (or local disk on Will's laptop) by 16:00:

1. WE Charity Foundation — Outcome Brief
2. SDTC — Outcome Brief
3. Canada World Youth — Outcome Brief
4. Halagonia Tidal Energy — Outcome Brief
5. TMT International Observatory — Outcome Brief
6. Carisbrooke Shipping — Outcome Brief
7. (Pick from PYTH-RES recommended) — Counterfactual Brief
8. (Pick from PYTH-RES recommended) — Counterfactual Brief
9. (Pick from PYTH-RES recommended) — Counterfactual Brief
10. (Pick from PYTH-RES recommended) — Counterfactual Brief

Format: full HTML pages, statically served. Reachable at `/cached/{slug}`. PYTH-DEMO knows the URLs.

## Cost guardrails

- ECS Fargate: ~$0.50/day at the size we need
- ALB: ~$0.50/day
- LLM calls: ~$2-5 for the day depending on demo volume
- Total expected: < $10. Budget alarm at $25 just in case.

## What PYTH-OPS does NOT do

- Does not write application code
- Does not modify synthesis prompts
- Does not make UI decisions
- Does not deploy to production after the event without explicit PYTH-LEAD sign-off

## The failover script (rehearse at 14:00)

The single most likely failure mode is conference WiFi degradation affecting the Render Postgres connection. Rehearse this twice tonight, once at 14:00 tomorrow, before the demo.

### Script: `scripts/failover-to-local.sh`

```bash
#!/usr/bin/env bash
# Switches DATABASE_URL from Render to local Postgres
# Run on the deployment host. Recovery target: < 30 seconds.

set -euo pipefail

NEW_URL="postgresql://localhost:5432/agency26"

# Update Parameter Store
aws ssm put-parameter \
  --name /agency2026/database-url \
  --value "$NEW_URL" \
  --type SecureString \
  --overwrite \
  --region ca-central-1

# Force ECS task restart to pick up new env
aws ecs update-service \
  --cluster agency2026 \
  --service web \
  --force-new-deployment \
  --region ca-central-1

echo "Failover initiated. ECS will pick up new DATABASE_URL on next task start."
echo "Verify at: https://<your-ALB-DNS>/api/health"
```

### Script: `scripts/failover-llm-from-bedrock.sh`

```bash
#!/usr/bin/env bash
# Switches LLM_PROVIDER from AWS Bedrock (primary) to Anthropic API direct (failover).
# Use when Bedrock is rate-limited, returning errors, or the model we need is unavailable.
set -euo pipefail

aws ssm put-parameter \
  --name /agency2026/llm-provider \
  --value "anthropic_direct" \
  --type String \
  --overwrite \
  --region ca-central-1

aws ecs update-service \
  --cluster agency2026 \
  --service web \
  --force-new-deployment \
  --region ca-central-1

echo "LLM failover from Bedrock to Anthropic API direct initiated."
echo "Note: this charges to Pythagorithm production billing, not hackathon credits."
```

If Bedrock recovers, run the inverse to flip back:

```bash
# scripts/restore-bedrock.sh
aws ssm put-parameter --name /agency2026/llm-provider --value "bedrock" \
  --type String --overwrite --region ca-central-1
aws ecs update-service --cluster agency2026 --service web \
  --force-new-deployment --region ca-central-1
```

Both scripts are idempotent — running them twice is safe.

### Recovery rehearsal protocol

At 14:00, deliberately break each connection:

1. Edit Parameter Store to point DATABASE_URL at a deliberately invalid host
2. Verify health check fails within 30 seconds
3. Run `failover-to-local.sh`
4. Verify health check passes within 30 seconds of script completion
5. Restore the correct Render URL via Parameter Store
6. Verify everything green

If any step takes > 30 seconds, debug and re-rehearse.

## Definition of done (08:30)

- [ ] Demo URL responds with a valid page
- [ ] Database connection working from production environment
- [ ] LLM call test passes (both Anthropic and Bedrock paths)
- [ ] CloudWatch logs visible
- [ ] Rollback rehearsed (one command, < 30 seconds)
- [ ] DB failover script rehearsed end-to-end (< 30 seconds)
- [ ] LLM failover script rehearsed end-to-end (< 30 seconds)
- [ ] Local DB fallback rehearsed (DATABASE_URL swap works)
- [ ] Pre-cached briefs prepared for end-of-day fallback
- [ ] All secrets in Parameter Store, none in env files committed to git
- [ ] Prewarm cache file `cache/seed-entities.json` exists and is non-empty

## Tooling decisions (locked, with rationale)

### Bedrock — yes, primary LLM endpoint

Bedrock is AWS's foundation-model serving layer. The hackathon AWS account provides Claude Opus 4.6 and Sonnet 4 (Bedrock's Anthropic availability lags the direct API, so Opus 4.7 isn't there yet). For one-day demo synthesis quality this is not material — calibrated-language synthesis with citation discipline is a well-bounded task that 4.6 handles cleanly.

**Why Bedrock:**
- Hackathon-provided account, no key provisioning needed
- ca-central-1 availability (with us-east-1 fallback if regional model availability gaps appear)
- Library-level dependency only — doesn't couple our architecture to AWS

**Configuration:**
- Primary: Bedrock Claude Opus 4.6 in ca-central-1 (or us-east-1 if 4.6 not available in ca-central-1; data residency story still holds for the *data*, only the model call leaves)
- Failover: Anthropic API direct using Pythagorithm production keys
- Switch via `LLM_PROVIDER` env var; failover script `scripts/failover-llm-to-bedrock.sh` flips it

### AgentCore — no, deliberately not used

Bedrock AgentCore is a managed agent runtime (memory, tool use, orchestration). Using it would replace our PYTH-LEAD orchestration entirely.

**Why we don't use it:**
- It would couple our architecture to a specific AWS product
- The Manifold framing (strata, strands, bounded perception) is OUR architectural choice — it lands harder when it's our code rendering the agents
- Half the room would hear "you used AgentCore" and discount the work as "configured AWS, didn't build"
- Day-of, calibrated-language gates and Proof token construction must stay visible and defensible — they have to be ours, not the runtime's

**If asked:** "Considered it. AgentCore is impressive — for a build that's about transparent governance, we wanted those gates to be ours, not the runtime's. We did use the Strands SDK as a library for retrieval where it's a clean fit."

### Strands Agents SDK — acceptable as a library

Strands SDK is open-source Python. Using it as a library to define tool schemas and reduce orchestration boilerplate is fine — it's not the same as adopting a managed runtime. PYTH-RES uses it for retrieval-agent tool definitions where it saves ~90 minutes of boilerplate. PYTH-LEAD orchestration stays in our own Claude Code subagent definitions.

### Kiro — tonight-only optimization, never in the day-of stack

Kiro (Microsoft, 1000 credits per team) is an AI-powered IDE/CLI. Mechanically: natural-language to code (SQL, Python, scaffolding).

**What Kiro does well tonight:**
- Canonical SQL generation against the hackathon schema (~12 query patterns)
- Boilerplate data loaders (Contracts JSON, AIA indexer)
- Test harness scaffolding

**What Kiro will silently get wrong without explicit prompting:**
- KNOWN-DATA-ISSUES landmines (F-3 cumulative `agreement_value`, A-13 reversal pairs, A-10 roll-up rows, C-7 missing CRA name history)
- Year-alignment convention (April 1 – March 31, end-year label)
- AB dedupe tuple
- Entity resolution thresholds

**Discipline (enforced by PYTH-DB):**
- Use Kiro tonight to generate `/sql/canonical/`. Day-of, all agents read from that committed directory rather than calling Kiro live.
- Every Kiro prompt includes the four landmine warnings (already documented in PYTH-DB §"Kiro prompting discipline").
- Save outputs, review line by line, commit. Day-of, Kiro is closed.

**Why we don't depend on it day-of:** If Microsoft's Kiro infrastructure has issues tomorrow morning, our build is not in their failure path.

## GitHub repository

The build lives at `github.com/PythagorithmWill/agency-2026-hackathon`. The repo is created as part of the kickoff sequence (KICKOFF-PROMPT.md §"REPOSITORY SETUP").

**Commit discipline:**
- Every meaningful unit of work is its own commit
- Commit message format: `[agent] short description` (e.g., `[pyth-fe] Add ProofBadge with sage/ember states`)
- Push to `main` at every quality-gate-pass and at every PROGRESS.md update (every 30 minutes)
- Never commit `.env` files, secrets, or `cache/seed-entities.json`
- The repo is public by default (matches our open-build posture; matches MIT licensing)

**Day-of deploy flow:**
- Tomorrow morning, the deploy is `git push origin main` → CI/CD picks it up → builds Docker image → pushes to AWS provided ECR (or whatever registry the hackathon AWS account exposes) → ECS task definition updated → ALB health check passes
- If CI/CD is not provisioned, fallback is: `docker build`, `docker tag`, `docker push`, `aws ecs update-service --force-new-deployment` (PYTH-OPS scripts these as `scripts/deploy.sh`)

**Branch discipline:**
- Tonight: all work on `main` (it's a 12-hour build, branching adds friction)
- Day-of: any experimental change goes on a `polish/<description>` branch and merges to main only after passing the four quality gates

**Repo hygiene tonight:**
- README.md at root explains the project, links to the live demo URL (once deployed), credits the hackathon
- LICENSE.md is MIT
- The full `final-package/` contents (briefing, PRD, etc.) live in a `/docs/` subdirectory of the repo so the work is reviewable from GitHub
