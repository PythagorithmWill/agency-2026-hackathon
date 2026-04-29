# calibrated-accountability-language-skill

The calibrated-language discipline: a regex-driven validator and a calibrated-replacement lexicon. Invoked by PYTH-SYN whenever generating recommendation text or descriptive observations, and by PYTH-GOV as the final gate before output ships.

## When to invoke

Whenever any agent produces text that:

- Names an organization in connection with risk, scoring, or flagging
- Describes the use of public funds
- Implies, suggests, or allows the inference of misconduct
- Summarizes data findings into prose
- Quotes or paraphrases news/regulatory/audit material

In short: every analyst-facing or citizen-facing surface in the build.

## The core principle

**We show the math. We do not draw the conclusion.** The reader is an adult — usually a Minister or DM — and they make their own judgments. Our job is to provide structured, sourced, calibrated information without the editorial overlay.

## Lexicon — required substitutions

| Replace | With | Why |
|---|---|---|
| "The government failed to..." | "The dataset does not show..." | Causal claim → empirical observation |
| "Investigators found..." | "Documents indicate..." OR cite the specific report | Anonymous authority → cited source |
| "There is no evidence of..." | "Public records do not contain..." | Absence claim → scope-limited absence claim |
| "X was misused" | "X was reported as..." | Judgment → description |
| "The minister approved..." | "Records show approval recorded by..." | Active accusation → record summary |
| "It was clearly a..." | "Available documents describe a..." | Editorial → reported |
| "...failed to deliver" | "...did not record deliverables in the public dataset" | Failure → data gap |
| "Wasted spending" | "Spending without a recorded outcome" | Loaded → factual |
| "This raises serious questions" | "These data raise questions" | Editorial → neutral framing |
| "Allegedly" | (drop and cite the specific allegation source) | Hedge → citation |
| "Sources say" | (drop and cite the source by name) | Anonymous → cited |
| "Connected to..." | "Shares a director with..." OR "Lists the same address as..." | Innuendo → specific link |

## Forbidden moves (never acceptable)

1. **Innuendo by adjacency** — putting two facts next to each other to imply a third.
2. **Hedged accusations** — "possibly," "potentially," "may have been."
3. **Editorial superlatives** — "stunning," "shocking," "egregious," "alarming."
4. **Reader-direction** — "warrants further investigation," "the public deserves answers."
5. **Quote-stitching** across sources.
6. **Backfilled claims from the present** — describing 2019 records in light of present-day knowledge without an explicit 2019 source.

## The locked regex set (mirrored by `src/lib/gov/validators.ts`)

```
FORBIDDEN_ABSOLUTE = [
  /\b(fraud|fraudulent|corrupt(?:ion)?|crime|criminal|illegal(?:ly)?)\b/i,
  /\b(should have|ought to have|was supposed to)\b/i,
  /\b(proves?|proven|definitely|certainly|clearly shows?)\b/i,
  /\b(failed to|refused to|deliberately|intentionally|knowingly)\b/i,
  /\b(coverups?|cover[- ]ups?|schemes?|scams?)\b/i,
  /\b(stunning|shocking|egregious|alarming|massive amounts? of public money|astronomical)\b/i,
  /\b(allegedly|reportedly|sources say|many believe|it is widely known)\b/i,
]

FORBIDDEN_CAUSAL = [
  /\bbecause of\b[^.]{0,80}\b(grant|contract|funding|donation|lobbying)\b/i,
  /\b(caused|led to|resulted in)\b[^.]{0,80}\b(grant|contract|funding)\b/i,
  /\bin (?:exchange|return) for\b/i,
  /\b(this raises serious questions|warrants investigation|warrants further investigation|the public deserves answers|officials should explain)\b/i,
]
```

## The 18 anchor cases

10 must REJECT (calibration leaks) + 8 must ACCEPT (calibrated phrasings the validator must NOT false-positive on). These are locked in `src/lib/gov/__tests__/calibration.test.ts`. Any change to the regex set must keep all 18 green.

## The two checks any output must pass

### Check 1 — the "stranger" test

Read the output as if a stranger reading it for the first time. Without prior knowledge, would they walk away thinking:
- (a) I have facts I can verify, or
- (b) I have a verdict I'm being asked to share?

If (b), rewrite. We deliver (a).

### Check 2 — the "lawyer" test

If a senior counsel reviewed this output, would they identify any sentence that:
- Imputes wrongdoing to a named individual or organization without citation?
- Could be read as an accusation rather than a record?
- Uses absolute terms ("never," "always," "all") that the data cannot support?

If yes to any, rewrite.

## When stuck

The strongest accountability work is the most boring. The reader does the rest.
1. Cite more directly — point to AG, Hansard, DRR.
2. Show more numbers, less prose.
3. Drop the inference entirely. Trust the structured data.
