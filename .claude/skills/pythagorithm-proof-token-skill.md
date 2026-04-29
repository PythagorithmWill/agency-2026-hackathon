# pythagorithm-proof-token-skill

The canonical Pythagorithm Proof token schema, the gate sequence, the validator. Invoked by PYTH-SYN whenever generating an output, and by PYTH-GOV as the final completeness gate.

## Why this exists

The Pythagorithm Proof Methodology says: **every output of an accountability AI must itself be accountable.** The Proof token is how we make that real. Every score, recommendation, evaluation, or finding the system produces gets wrapped in a token that records:

1. What evaluated the input
2. What model produced the analysis
3. What output gates passed
4. What audit token was issued

The frontend renders this token in a strip on every Brief / evaluation surface. The reader can see exactly how the system reasoned, what evidence it used, and what governance it passed.

The methodology never gets named in the demo unless asked. We just show the badge. **Demand pull, not push.**

## Canonical schema

```json
{
  "proofId":   "ppm-2026-04-29T14:33:18.421Z-a7f9c2",
  "version":   "1.0",
  "issuedAt":  "2026-04-29T14:33:18.421Z",
  "issuedBy":  "PYTH-LEAD",

  "finding": {
    "type": "draft_evaluation | similarity_match | suitability_score | recommendation",
    "summary": "Single declarative calibrated sentence.",
    "subject": {
      "entityId": "general.entity_golden_records.id (or evaluationId)",
      "canonicalName": "...",
      "bnRoot": "...",
      "datasetCoverage": ["fed", "ab"]
    },
    "score": 18,
    "scoreScale": "0-30 | 0-10 | 0-1 | dollars",
    "scoreLabel": "PROCEED | CONSOLIDATE | DECLINE AS DUPLICATIVE | HIGH | MEDIUM | LOW"
  },

  "evidence": [
    { "source": "fed.grants_contributions", "rowId": "ref-2024-…", "field": "agreement_value", "value": 4200000, "asOf": "2026-04-22" }
  ],

  "tiers": {
    "input": {
      "passed": true,
      "tier": 1,
      "filtersApplied": ["F-3 max-amendment CTE", "A-13 dedupe", "A-10 exclude"],
      "knownDataIssuesRespected": ["F-3", "A-13", "A-10"],
      "rejected": []
    },
    "contextual": {
      "passed": true,
      "tier": 2,
      "model": "voyage-3-large + bedrock-claude-opus-4-6",
      "promptHash": "sha256:...",
      "promptVersion": "evaluate-v1.0",
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

  "rerunUrl": "/proof/rerun/{proofId}",
  "verifyUrl": "/verify/{proofId}",
  "downloadUrl": "/api/proof/{proofId}/download"
}
```

## Field rules

### `proofId`
Format `ppm-{ISO-8601}-{6-char-hash}`. Globally unique. Deterministic from inputs (same inputs → same ID).

### `finding.summary`
One sentence. Declarative. Calibrated. Subject + verb + object + numbers. **Validates against the calibrated-language regex set.**

### `finding.subject`
Anchored on `general.entity_golden_records.id` (or `evaluationId` for `/evaluate` outputs). Multi-entity findings list extras in `evidence`.

### `evidence`
Every claim in the summary traces to at least one evidence row. The `asOf` field on time-sensitive sources is **required**.

### `tiers.input` (Tier 1)
The input governance layer. **Must list `F-3` for any query against `fed.grants_contributions`.** Must list `A-13` and `A-10` for any AB-touching query. Empty list = automatic rejection by PYTH-GOV.

### `tiers.contextual` (Tier 2)
The model and prompt that produced the analysis. `promptHash` is for reproducibility — same inputs, same prompt hash, same output.

### `tiers.output` (Tier 3)
What PYTH-GOV's gate caught. `calibrationCheck` is binary. `citationCount` ≥1 for any prose section. `quoteWordCountMax` MUST be < 15 (≥15 = automatic rejection).

### `tiers.audit` (Tier 4)
The immutable record. `tokenHash` is sha256 of the entire token (computed last, then appended). `previousTokenHash` chains tokens for tamper-evidence.

### `disclaimers`
**Required line:** `"These are observations from public records. They are not findings of misconduct."` PYTH-GOV rejects any token without it.

## Validation rules (PYTH-GOV gates)

A Proof token is invalid if:

- `finding.summary` violates calibrated language
- Any prose claim has no entry in `evidence`
- `tiers.input.knownDataIssuesRespected` is empty for a finding touching `fed.grants_contributions` or `ab.ab_grants`
- `tiers.output.citationCount` < 1 for a finding with prose
- `tiers.output.quoteWordCountMax` ≥ 15
- `disclaimers` missing the "observations not findings" line

PYTH-GOV rejects invalid tokens. The renderer never displays a finding without a valid token.

## Re-run mechanics

`/proof/rerun/[proofId]` lets the user:
1. Load a finding's source query and weights
2. See sliders for the weight parameters
3. Re-execute the query with adjusted weights
4. Issue a NEW Proof token with `previousTokenHash` chained to the original
5. Render the new finding alongside the original, delta highlighted

This is the showcase moment. The audience sees that the system is queryable, sensitive to assumptions, and transparent about its reasoning.

## Verify endpoint

`/verify/[proofId]` runs `proofTokenCompleteness` independently against the named token and renders tier-by-tier verdicts plus a methodology version stamp. A downloaded token can be verified outside the original session.
