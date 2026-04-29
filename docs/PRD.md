# Pythagorithm — PRD

**Version:** 1.0
**Date:** April 29, 2026
**Status:** Authoritative. Every agent, skill, and component must match this document. Deviation requires PYTH-LEAD approval and a `decisions.md` entry.

---

## Product name

**Pythagorithm — Prospective Accountability for Federal Spending**

The internal codename "Manifold" is decommissioned. The strata concept is preserved as **information architecture** (data structure), never as user-facing UI.

## The problem

Federal departments post billions of dollars in grants and contracts every year. **$71.5 billion of that has no public description.** Departments frequently fund work substantially similar to what is already funded — the public dataset already makes this visible to anyone who runs the right queries, but procurement officers writing the next draft cannot see it. Solicitations regularly use language the Auditor General would later flag in audit. The decisions are accountable retrospectively, after money has moved. There is no equivalent of the federal Algorithmic Impact Assessment for spending decisions — no prospective review at the moment of drafting.

## The solution

A web product where a federal procurement officer or grant program manager pastes or uploads a draft solicitation before posting it publicly. The system returns:

1. **Similarity matches** against the federal grants and contributions corpus and the Alberta provincial corpus, ranked by hybrid retrieval (BM25 + cosine)
2. **Awardee patterns** — historical concentration (HHI), geographic distribution, departmental capture
3. **Funding history** — initial commitment vs. current commitment per comparable record, with amendment chains rendered as inline data viz
4. **Calibrated language audit** — absolute and causal phrases the AG would reject, surfaced inline with calibrated rewrite suggestions
5. **A composite suitability score** (0–30) across four dimensions:
   - Uniqueness (0–10)
   - Duplication risk (0–10)
   - Recipient concentration (0–10)
   - Language calibration (0–10)
6. **A recommendation:** PROCEED, CONSOLIDATE, or DECLINE AS DUPLICATIVE

Every score, every match, every recommendation ships wrapped in a Pythagorithm Proof token with full citation provenance and a gate-by-gate audit trail. The Proof token is downloadable and independently verifiable at `/verify/[proofId]`.

A second surface — **search** — lets users NLP-query the corpus directly without uploading a draft. Same retrieval engine, different entry point.

## Information architecture — five strata as data structure

The Manifold's five strata are the **schema for how every record is composed in our system**. Users never see these labels in the UI. They organize the data underneath.

| Stratum | Layer | Role |
|---|---|---|
| S1 | Episodic | The user's session — what they searched, what they evaluated, history |
| S2 | Procedural | Workflow state — which agent did what, which gates passed, when each retrieval ran |
| S3 | Semantic | Synthesized layer — similarity scores, calibrated descriptions, awardee pattern observations |
| S4 | Source-linked | Raw federal/provincial dataset rows with full citation back to canonical source |
| S5 | Archival | Original AG reports, DRRs, Hansard, news articles cited in synthesis |

When a user clicks any data point in the UI, they descend visually from S3 (synthesized observation) → S4 (source row) → S5 (archival citation). The descent is the audit trail. The UI shows clean composed information; clicking expands it into its source-linked component layers.

The word "Manifold" never appears in the UI. The strata are not labeled in the UI. They are the architecture, not the surface.

## Primary user

Federal procurement officers and grant program managers drafting a new solicitation.

**Secondary:** Auditor General staff, Privy Council Office staff, departmental Chief Financial Officers.

**Adversarial reviewer:** Office of the Parliamentary Budget Officer.

## Success criterion for the demo

A 90-second walkthrough where a Minister or Deputy Minister sees:

1. Paste draft → wait ≤3 seconds → see suitability score, see ranked similar grants they didn't know existed, see calibrated rewrite suggestions, see recommendation.
2. They understand the value within 30 seconds of the result rendering.

## Surface inventory

| Route | Purpose |
|---|---|
| `/` | Hero + search/evaluate input. Apple-grade hero with animated SVG illustration. |
| `/evaluate` | Paste/upload a draft. Form with title, amount, department, fiscal year. |
| `/evaluate/[evaluationId]` | The result page. Six sections: suitability score, similar records, recipient concentration, language audit, proof token, methodology. |
| `/record/[recordId]` | Single-record detail with amendment chain timeline. |
| `/methodology` | The substance behind the surface: regex set, citation discipline, AIA correspondence, landmine guards, agents. |
| `/verify/[proofId]` | Independent gate-by-gate validation of any downloaded Proof token. |
| `/api/search` | Hybrid retrieval (BM25 + cosine) with calibrated response payload |
| `/api/draft/evaluate` | POST draft → returns evaluationId + result |
| `/api/proof/[proofId]/download` | JSON download of any Proof token |
| `/api/record/[recordId]` | Single-record JSON |

## Non-goals

- No multi-user, real-time, or VR/AR features.
- No tutorial overlays, sound, music, screen shakes, confetti.
- No user authentication.
- No social share buttons.
- No third-party analytics.
- No chatbot interface.
- No 3D scenes, WebGL, Three.js, or R3F.
- No Manifold visualizations in the UI. The concept lives in data structure only.
- No naming Janak Alford anywhere.
- No naming any LLM/model in the UI.

## Day-of timeline (April 29, 2026, Ottawa)

| Time | Block | Outcome |
|---|---|---|
| 08:00–09:00 | Setup, AWS account creds received, deploy first build, smoke test | Demo URL live |
| 09:00–10:00 | Embed corpus completion (started overnight); search verified hybrid | Hybrid retrieval live |
| 10:00–11:30 | `/evaluate` end-to-end — paste → score → comparables → recommendation | Headline demo working |
| 11:30 gate | Is the evaluate flow demo-able? | If no, cut Section 5 (Proof Token strip) and Section 6 (Methodology footer) |
| 11:30–13:00 | Polish — motion, type rhythm, recipient concentration viz | All M1–M8 motion moments shipped |
| 13:00–14:00 | Lunch + walk floor | |
| 14:00 gate | Calibrated-language audit visible inline? | If no, fall back to side panel listing flags |
| 14:00–15:30 | Hardening, failover rehearsal | DB + LLM failover both rehearsed end-to-end <30s |
| 15:30–16:30 | Three demo dress rehearsal passes | Will memorizes 90-second pitch |
| 16:30+ | Demo time | |

## Escalation gates

Cut order (last-cut first): record detail page → Playwright smoke → Section 5 Proof strip → recipient concentration viz → file upload (paste-only acceptable).

**Never cut:** the embedding job, the search surface, suitability engine, the calibrated-language audit on `/evaluate`, the Pythagorithm Proof token wrap on every output.
