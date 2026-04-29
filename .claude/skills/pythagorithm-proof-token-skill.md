# pythagorithm-proof-token-skill

The canonical JSON schema for a Pythagorithm Proof token, with examples, validation rules, and frontend rendering guidance. Used by every agent that produces a finding in the Agency 2026 build.

## Why this exists

The Pythagorithm Proof Methodology says: *every output of an accountability AI must itself be accountable*. The Proof token is how we make that real. Every score, brief, or finding the system produces gets wrapped in a Proof token that records:

1. What evaluated the input
2. What model produced the analysis
3. What output gates passed
4. What audit token was issued

The frontend renders this token in a slide-in drawer next to every finding. The reader can see exactly how the AI reasoned, what evidence it used, and what governance it passed. **This is the differentiator vs every other team's findings layer.**

Important: the methodology never gets named in the demo unless the audience asks. We just show the badge. Demand pull, not push.

## The canonical schema

```json
{
  "proofId": "ppm-2026-04-29T14:33:18.421Z-a7f9c2",
  "version": "1.0",
  "issuedAt": "2026-04-29T14:33:18.421Z",
  "issuedBy": "PYTH-LEAD",

  "finding": {
    "type": "loop_participation | amendment_creep | outcome_gap | concentration_risk | director_overlap | adverse_media_match | provincial_misalignment | postal_aggregate | custom",
    "summary": "Single declarative sentence describing the finding.",
    "subject": {
      "entityId": "general.entity_golden_records.entity_id",
      "canonicalName": "...",
      "bnRoot": "123456789",
      "datasetCoverage": ["cra", "fed", "ab"]
    },
    "score": 18,
    "scoreScale": "0-30 | 0-35 | category | percentile | dollars",
    "scoreLabel": "HIGH | CRITICAL | MEDIUM | LOW | $$$ amount | category"
  },

  "evidence": [
    {
      "source": "fed.vw_agreement_current",
      "rowId": "...",
      "field": "agreement_value",
      "value": 543000000,
      "asOf": "2026-04-22"
    },
    {
      "source": "cra.cra_qualified_donees",
      "rowId": "...",
      "field": "total_gifts",
      "value": 1200000
    }
  ],

  "tiers": {
    "input": {
      "passed": true,
      "tier": 1,
      "filtersApplied": [
        "BN normalization (general.extract_bn_root)",
        "Placeholder BN reject (general.is_valid_bn_root)",
        "Cumulative-sum guard (vw_agreement_current)"
      ],
      "knownDataIssuesRespected": ["F-3", "A-13"],
      "rejected": []
    },
    "contextual": {
      "passed": true,
      "tier": 2,
      "model": "claude-opus-4-7",
      "promptHash": "sha256:...",
      "promptVersion": "ob-section-v1.2",
      "temperature": 0.2,
      "tokensIn": 4827,
      "tokensOut": 1284
    },
    "output": {
      "passed": true,
      "tier": 3,
      "calibrationCheck": "passed",
      "citationCount": 7,
      "quoteWordCountMax": 12,
      "uniqueSourcesQuoted": 7,
      "languageViolations": []
    },
    "audit": {
      "passed": true,
      "tier": 4,
      "tokenHash": "sha256:...",
      "previousTokenHash": "sha256:...",
      "humanReviewed": false,
      "humanReviewer": null,
      "operatorAgent": "PYTH-LEAD",
      "logRef": "decisions.md#l127"
    }
  },

  "disclaimers": [
    "Data current as of 2026-04-22 (federal Open Data API snapshot)",
    "Entity resolution is probabilistic for cross-dataset matches without BN anchor",
    "These are observations from public records. They are not findings of misconduct."
  ],

  "rerunUrl": "/proof/rerun/{proofId}"
}
```

## Field-by-field rules

### `proofId`
Format: `ppm-{ISO-8601-timestamp}-{6-char-hash}`. Globally unique. Deterministic from inputs (so re-running with same inputs yields the same ID).

### `finding.type`
One of the canonical types listed. If you need a new type, add it to this skill — don't invent inline.

### `finding.summary`
One sentence. Declarative. Calibrated language (see `calibrated-accountability-language-skill`). Subject + verb + object + numbers.
- Good: "Federal grants totaling $543M flowed to WE Charity Foundation between 2017 and 2020."
- Bad: "WE Charity received massive amounts of public money it didn't deserve."

### `finding.subject`
Always anchored on a `general.entity_golden_records.entity_id`. If your finding is multi-entity (e.g., a loop), use the most central entity as primary and list others in `evidence`.

### `finding.score` and `finding.scoreScale`
Score is the raw number. Scale tells the renderer how to display it (a 0-30 score renders differently than a $-amount or a percentile).

### `evidence`
Every claim in the summary must trace to at least one evidence row. If you can't point to source rows, you don't have a finding. The `asOf` field on time-sensitive sources is required.

### `tiers.input` (Tier 1)
What the input governance layer did. **The most common Tier 1 violations are F-3 (cumulative sum) and A-13 (duplicate counting).** If your query depended on these guards, list them.

### `tiers.contextual` (Tier 2)
What model produced the analysis, with what prompt, at what temperature. The `promptHash` is for reproducibility — same inputs, same prompt hash, same output.

### `tiers.output` (Tier 3)
What the output governance layer caught. Calibration check is binary (passed/failed). Citation count must be ≥1 for any prose section. Quote word count max enforces the 15-word ceiling. `languageViolations` is empty on pass; non-empty entries describe what was caught and rewritten.

### `tiers.audit` (Tier 4)
The immutable record. `tokenHash` is the cryptographic hash of the entire token (computed last, then appended). `previousTokenHash` chains tokens for tamper-evidence. `humanReviewed` is false unless a human (Will, in our case) explicitly signed off.

### `disclaimers`
Always include at least:
- Data freshness
- Entity resolution caveat (if cross-dataset)
- The "these are observations, not findings" line

## Frontend rendering

The Proof drawer is a slide-in panel anchored to each finding. Layout:

```
┌─────────────────────────────────────────────┐
│  Pythagorithm Proof  [proof-token-id]       │
│  Issued: 2026-04-29 14:33 ET                │
├─────────────────────────────────────────────┤
│  Finding                                    │
│  Federal grants totaling $543M flowed to    │
│  WE Charity Foundation between 2017–2020.   │
│  Score: 28/30 (CRITICAL)                    │
├─────────────────────────────────────────────┤
│  Evidence (4 records)                       │
│  • fed.vw_agreement_current  $542,816,439   │
│  • cra.cra_identification    BN registered  │
│  • cra.cra_financial_details 5 yr revenue   │
│  • general.entity_source_links 1,247 links  │
├─────────────────────────────────────────────┤
│  Governance trace                           │
│  ✓ Input    F-3 cumulative-sum guard        │
│             A-13 duplicate filter            │
│  ✓ Context  claude-opus-4-7  T=0.2           │
│             prompt: ob-section-v1.2          │
│  ✓ Output   citations=7  max-quote=12 words  │
│             calibration: passed              │
│  ✓ Audit    operator: PYTH-LEAD              │
│             chained from: ppm-...-c4a1       │
├─────────────────────────────────────────────┤
│  Disclaimers                                │
│  • Data current as of 2026-04-22            │
│  • These are observations from public       │
│    records. They are not findings of        │
│    misconduct.                              │
├─────────────────────────────────────────────┤
│  [ Re-run with adjusted weights ]           │
│  [ Download token (JSON) ]                  │
└─────────────────────────────────────────────┘
```

The drawer is dismissible. The Re-run button lets the user adjust scoring weights and see how the score changes — sensitivity testing made visible.

## Validation rules (PYTH-GOV gates these)

A Proof token is invalid if:

- `finding.summary` violates calibrated language (see lexicon)
- Any prose claim has no entry in `evidence` that supports it
- `tiers.input.knownDataIssuesRespected` is empty for a finding that touches `fed.grants_contributions` (F-3 must be respected) or `ab.ab_grants` (A-13 must be respected)
- `tiers.output.citationCount` < 1 for a finding with prose
- `tiers.output.quoteWordCountMax` ≥ 15
- `disclaimers` is empty or missing the "observations not findings" line

PYTH-GOV rejects invalid tokens. The renderer never displays a finding without a valid token.

## Re-run mechanics

When a user clicks "Re-run with adjusted weights," the system:

1. Loads the finding's source query and weights
2. Presents sliders for the weight parameters
3. Re-executes the query with adjusted weights
4. Issues a *new* Proof token (with `previousTokenHash` chained to the original)
5. Renders the new finding alongside the original, with the delta highlighted

This is the showcase moment. The audience sees that the system is queryable, sensitive to assumptions, and transparent about its reasoning.

## Demo strategy

For the dry-run, we pre-build Proof tokens for these 10 cases. The demo uses these as warm cache:

1. WE Charity Foundation ($543M, scandal)
2. SDTC ($134M, RCMP)
3. Canada World Youth ($37M, dissolved)
4. Halagonia Tidal Energy ($30M, abandoned)
5. TMT International Observatory ($214M, never built)
6. Carisbrooke Shipping ($13M, no Cdn ops)
7. A known-clean university (high score, false positive — important to show)
8. A loop participant (CRA loop_universe top-scored)
9. An amendment-creep case (>2x growth)
10. A "no description" >$1M grant (the Outcome Brief showcase)

If anything in the live system fails, PYTH-DEMO falls back to these pre-built cards.
