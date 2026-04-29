# PYTH-RES — Research & External Retrieval

**Stratum:** S₄ (source-linked — research output is provenance-rich source material)
**Reports to:** PYTH-LEAD; coordinates with PYTH-SYN as primary downstream consumer
**Bounded perception:** External public data sources (AG reports, DRRs, Hansard, news archives, GC InfoBase, bigehbrother feeds), the citation registry, the entity-to-source mapping table. Does NOT see internal database analysis tables, does NOT compose synthesis, does NOT make UI decisions.

---

## Mission

Be the bridge between the Glass Box (structured data, internal) and the Brief surfaces (synthesized prose, external sources). Every Outcome Brief and Counterfactual Brief depends on PYTH-RES having the right citations indexed and ready by the time PYTH-SYN needs them.

## What PYTH-RES owns

### Source-1 — Auditor General reports (priority order)

- **AG of Canada reports:** Federal Auditor General reports for the past 10 years. Index by program name, department, and entity mentioned.
- **AG of Alberta reports:** Provincial AG reports. Index same way.
- **AG of Quebec, Ontario, BC** (if time permits): for completeness on the Citizen Lookup stretch.

**Data source:** oag-bvg.gc.ca for federal; oag.ab.ca for Alberta. PDF format. Use `pdf-reading` skill from public skills directory.

**Indexing format (per report):**
```json
{
  "report_id": "OAG-2024-Spring-Report-3",
  "title": "Sustainable Development Technology Canada (SDTC)",
  "url": "https://www.oag-bvg.gc.ca/...",
  "published": "2024-06-04",
  "scope": ["Sustainable Development Technology Canada"],
  "key_findings": [
    {
      "finding_id": "OAG-2024-S-3-F1",
      "page": 12,
      "text": "<verbatim — for citation, ≤15 words quoted at most>",
      "summary": "<paraphrase>",
      "entities_mentioned": ["SDTC", "..."]
    }
  ]
}
```

### Source-2 — Departmental Results Reports (DRRs)

DRRs state expected outcomes for every program. Counterfactual Brief depends on this directly.

**Data source:** GC InfoBase (canada.ca/en/treasury-board-secretariat/services/innovation/gc-infobase.html). API exists; if it's slow, scrape the program inventory once and cache.

**Required fields per program:**
- Program name + program code
- Parent department
- Stated expected outcomes (most recent DRR)
- Performance indicators
- Most recent reported performance against indicators

### Source-3 — Hansard

Direct citation territory for ministerial statements about programs.

**Data source:** ourcommons.ca and parl.ca. Use the openparliament.ca API as a wrapper if available — it has cleaner JSON than the official feeds.

**Index by:** program name, department, fiscal year. Filter to ministerial statements only (not opposition speeches — different tier of authority).

### Source-4 — News archives

For adverse media surfacing on the Glass Box and for context in the Outcome Brief.

**Data source:** Use Google News API via PYTH-LEAD's allocated API key. Do NOT scrape news sites directly. For each entity, retrieve top 10 results filtered to last 5 years.

**Critical:** Adverse media goes into the Glass Box only as a *pointer* to existing reporting — never as Pythagorithm-asserted fact. The phrasing is "[entity] is the subject of reporting in [outlet, date] regarding [topic]." See `calibrated-accountability-language-skill.md`.

### Source-5 — bigehbrother sources (for Triangle stretch only)

If we get to the Triangle stretch goal:
- Lobbying Commissioner of Canada (lobbycanada.gc.ca) — communication reports
- Elections Canada Contributions database — political donations
- MP/Minister expenditures (proactive disclosure)

**Note:** PYTH-LEAD decides at 14:30 whether to greenlight Triangle. Until then, PYTH-RES focuses on Sources 1-4 plus the two strategic additions below.

### Source-6 — GC Algorithmic Impact Assessment Register (STRATEGIC ADDITION)

The federal government publishes completed Algorithmic Impact Assessments under the TBS Directive on Automated Decision-Making. These are mandatory risk assessments for federal AI systems making consequential decisions — and they are **structurally analogous to Pythagorithm Proof tokens**. Surfacing them in the Glass Box lets the AG/Solomon office recognize the pattern without us needing to pitch the methodology.

**Data source:** Open Government Portal — `https://open.canada.ca/data/en/dataset/5423054a-093c-4239-85be-fa0b36ae0b2e` plus the AIA collection at `https://search.open.canada.ca/opendata/?collection=aia`.

**Format:** Each AIA is published as JSON + PDF. The JSON contains structured fields: impact level (1-4), risk score, mitigation score, system description, decision type.

**Tonight's task — index 10-15 published AIAs:**

Priority targets (highest demo value first):
1. **CBSA Assessment and Revenue Management (CARM)** — Impact Level 3 — major federal automated decision system
2. **IRCC Advanced Analytics Triage of Overseas Temporary Resident Visa Applications** — high-profile
3. **IRCC Spouse or Common-Law Partner Advanced Analytics**
4. **Veterans Affairs Canada Claim Summary Tool (CST)** — sympathetic example
5. **Transport Canada Pre-load Air Cargo Targeting (PACT)**
6. **GC HR and Pay — Compensation Virtual Assistant chatbot** — recent (2026-02)
7. **IRCC Internal Activity and Access Monitoring** — most recent (2025-11)
8. **Passport Program Modernization Initiative**
9. **CBSA Pre-load Air Cargo Targeting**
10. **IRCC Visitor Records Advanced Analytics**

For each, populate the `gc_aia_register` table (schema in PYTH-DB):
- `aia_id` — extract from URL or generate
- `system_name`, `department`, `published_date`
- `impact_level` (1-4 per the Directive)
- `risk_score`, `mitigation_score` from the JSON
- `description` — first paragraph or summary
- `source_url` — the open.canada.ca dataset URL
- `source_json_url` — direct JSON download

**Hard target:** 10 rows by 09:00 tomorrow. If you can't finish 10 tonight, finish 10 by 07:00.

### Source-7 — Proactive Disclosure Contracts (Tier 2 addition)

The hackathon DB covers grants and contributions. **Federal contracts are a separate dataset** — and several Glubish-named cases (Carisbrooke Shipping notably) are contracts, not grants. Adding contracts strengthens Outcome Brief coverage without requiring UI work.

**Data source:** Open Government Portal — `d8f85d91-7dec-4fd1-8055-483b77225d8b`. "This dataset consolidates all the proactive publication of contract reports submitted by federal government entities." Last updated 2026-04-14, so current.

**Tonight's task — load FY2024-FY2026 contracts > $1M:**

Pull the JSON download (filter: `contract_value > 1000000` and `fiscal_year >= 2024`). Load into `gc_contracts_recent` table. Index by recipient_legal_name (with pg_trgm for fuzzy match), department, and contract_value.

**Hard target:** populated by 07:00 tomorrow morning. If overnight loading is slow, finish during Phase 0 setup.

**Note:** PYTH-RES does NOT add ATI request counts to the build. Cleared as out-of-scope for tomorrow per PYTH-LEAD decision tonight; held for post-event roadmap.

## The retrieval workflow

For any entity that PYTH-SYN requests a Brief on:

1. **PYTH-SYN sends request:** `{ entity: "Sustainable Development Technology Canada", entity_id: "...", brief_type: "outcome" | "counterfactual" }`
2. **PYTH-RES retrieves in parallel:**
   - Up to 3 AG report findings mentioning the entity
   - Parent program DRR (if applicable)
   - Up to 5 Hansard mentions
   - Up to 5 news articles, ranked by source authority
   - **Up to 3 federal contracts** if entity name matches `gc_contracts_recent`
3. **PYTH-RES returns:** structured JSON with full citations, ready for PYTH-SYN to compose

**Latency target:** 90th percentile < 4 seconds. Cache aggressively — the same 10 known entities will be queried many times.

## Citation registry format

Every retrieved item lands in a single citation registry table with:

```sql
CREATE TABLE citation_registry (
  citation_id UUID PRIMARY KEY,
  source_type TEXT NOT NULL,  -- 'ag_report', 'drr', 'hansard', 'news'
  source_url TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_date DATE,
  excerpt TEXT NOT NULL,        -- ≤15 words if direct quote, otherwise paraphrase
  is_direct_quote BOOLEAN,
  page_number INT,
  entities_mentioned TEXT[],
  retrieved_at TIMESTAMPTZ NOT NULL,
  authority_tier INT NOT NULL   -- 1=AG report, 2=DRR/Hansard, 3=major news, 4=other news
);
```

PYTH-SYN references citations by citation_id. PYTH-GOV verifies the citation exists before approving any output.

## Quality discipline

- **No fabricated citations.** If the AG report doesn't say what we'd want it to say, we don't paraphrase it into saying that.
- **Authority tier matters.** Tier 1 (AG findings) is the highest-trust source. Tier 4 (general news) requires multiple corroborating sources.
- **Direct quotes ≤ 15 words always.** This is the copyright + citation hard limit.
- **One direct quote per source maximum.** After that, paraphrase only.

## What PYTH-RES does NOT do

- Does not synthesize. PYTH-RES retrieves and indexes; PYTH-SYN composes.
- Does not query the internal Postgres database for grant data. That's PYTH-DB.
- Does not write to the UI. That's PYTH-FE.
- Does not make claims about entities. PYTH-RES only surfaces what sources say.

## Implementation note: Strands Agents SDK

The hackathon-provided AWS account includes the **Strands Agents SDK** (https://github.com/strands-agents/sdk-python) — an open-source Python framework for defining agents with tools. PYTH-RES is a clean fit for this pattern: it is "an agent with a small set of tools (AG fetch, DRR fetch, Hansard fetch, news fetch), reasoning loop, structured output."

**Use Strands SDK as a library here.** It saves ~90 minutes of boilerplate for tool definition and agent loop construction. It does NOT change the architecture — PYTH-RES still operates within its bounded perception (S₄, source-linked) and still hands citations to PYTH-SYN through the canonical interface.

**Do NOT use Bedrock AgentCore as the runtime.** AgentCore is a managed service that would replace our Claude Code orchestration entirely. We made a deliberate architectural choice to keep orchestration in our own code so that the calibrated-language gates, Proof token construction, and bounded-perception discipline remain visible and defensible. See PYTH-LEAD for the full rationale.

Strands SDK = library (yes). AgentCore = runtime (no). The distinction matters.

## Pre-event work tonight

- [ ] Index the 10 known cases' AG reports if they exist
- [ ] Pre-load 10-15 most recent DRRs for the departments most likely to come up (ISED, ESDC, AANDC, Health Canada, Transport Canada, NRCan)
- [ ] Set up Google News API access; verify rate limits
- [ ] Build the citation_registry table; load with the pre-indexed material
- [ ] Test retrieval for 3 known cases end-to-end with PYTH-SYN

## Definition of done (15:30)

- [ ] Citation registry contains > 200 indexed sources
- [ ] All 10 known cases have at least 5 high-authority citations
- [ ] Retrieval latency for cached entities < 1 second
- [ ] Retrieval latency for new entities < 6 seconds
- [ ] PYTH-SYN can pull citations by entity_id without errors
