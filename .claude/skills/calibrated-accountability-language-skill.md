# calibrated-accountability-language-skill

A skill that enforces calibrated, defensible language for any output that makes claims about public-sector spending, organizations, or individuals. Every Pythagorithm Proof-tokenized output passes through this filter.

## When to invoke

Whenever any agent produces text that:
- Names an organization in connection with risk, scoring, or flagging
- Describes the use of public funds
- Implies, suggests, or allows the inference of misconduct
- Summarizes data findings into prose
- Quotes or paraphrases news/regulatory/audit material

In short: every analyst-facing or citizen-facing surface in the Agency 2026 build.

## The core principle

We show the math. We do not draw the conclusion. The reader is an adult — usually a Minister or DM — and they will make their own judgments. Our job is to provide structured, sourced, calibrated information without the editorial overlay.

## The lexicon — required substitutions

| Replace | With | Why |
|---|---|---|
| "The government failed to..." | "The dataset does not show..." | Causal claim → empirical observation |
| "Investigators found..." | "Documents indicate..." OR cite the specific report | Anonymous authority → cited source |
| "There is no evidence of..." | "Public records do not contain..." | Absence claim → scope-limited absence claim |
| "X was misused" | "X was reported as..." OR "X is described in [source] as..." | Judgment → description |
| "The minister approved..." | "Records show approval recorded by..." | Active accusation → record summary |
| "It was clearly a..." | "Available documents describe a..." | Editorial → reported |
| "...failed to deliver" | "...did not record deliverables in the public dataset" | Failure → data gap |
| "Wasted spending" | "Spending without a recorded outcome" | Loaded → factual |
| "This raises serious questions" | "These data raise questions" | Editorial framing → neutral framing |
| "Allegedly" | (drop and cite the specific allegation source) | Hedge → citation |
| "Sources say" | (drop and cite the specific source by name) | Anonymous → cited |
| "Many believe" | (drop entirely, or cite a poll) | Vague consensus → cited consensus |
| "It is widely known" | (drop entirely, or cite) | Same |
| "Connected to..." | "Shares a director with..." OR "Lists the same address as..." | Innuendo → specific link |

## The forbidden moves

These are never acceptable, regardless of accuracy:

1. **Innuendo by adjacency.** Putting two facts next to each other to imply a third. Example: "Director X sat on the board. Director X also donated to the campaign of Minister Y." The reader can connect these dots; we do not connect them for them.

2. **Hedged accusations.** "Possibly," "potentially," "may have been," — these are tells of an unsourced claim trying to sneak in. If you have a source, cite it. If you don't, drop it.

3. **Editorial superlatives.** "Stunning," "shocking," "egregious," "alarming." We don't have an editorial voice. We have a reporting voice.

4. **Reader-direction.** "This warrants further investigation." "The public deserves answers." "Officials should explain." That's the reader's call. We don't make it.

5. **Quote-stitching.** Combining short quotes from multiple sources to construct a sentence neither source said. Each quote belongs entirely to one source, attributed.

6. **Backfilled claims from the present.** WE Charity is a known scandal *now*; in 2019 it was a federal grant recipient. Don't write 2019 records as if they "showed warning signs" unless someone in 2019 actually said so and we cite them.

## The two checks any output must pass

### Check 1: The "stranger" test

Read the output as if you were a stranger reading it for the first time. Without any prior knowledge, would you walk away thinking:
- (a) I have facts I can verify, or
- (b) I have a verdict I'm being asked to share?

If (b), rewrite. We deliver (a).

### Check 2: The "lawyer" test

If a senior counsel reviewed this output, would they identify any sentence that:
- Imputes wrongdoing to a named individual or organization without citation?
- Could be read as an accusation rather than a record?
- Uses absolute terms ("never," "always," "all") that the data cannot support?

If yes to any, rewrite.

## The structural backbone

Outputs ideally follow this shape, especially for analyst-facing surfaces:

1. **Subject identification.** Who/what this is about, with canonical identifiers (BN, entity ID).
2. **What the data shows.** Numbers, dates, structured facts. No prose adjectives.
3. **What the cited sources say.** Each with explicit attribution.
4. **What is not in the public record.** Calibrated unknowns. The reader sees the *shape* of the gap.
5. **Disclaimer.** "These are temporal patterns / data observations. They are not findings of misconduct."

## Special-case rules

### Multi-dataset findings (cross-CRA-FED-AB)
The strongest move in this corpus is showing dollar flows across jurisdictions. *Be especially careful here* — readers will infer coordination from co-occurrence. Always disclose:
- That entity resolution is probabilistic (not certain) for entities matched by name only
- The dataset coverage caveat (e.g., AB sole-source covers Alberta provincial spend only)

### Director-network findings
- Director name collisions (multiple John Smiths) are real; surface this in the UI
- "Sits on N boards" is a fact. "Controls N organizations" is not — control requires evidence beyond board membership.

### Loop-detection findings
- Most loops are structurally normal (denominational hierarchies, federated charities, donation platforms). Say so explicitly.
- A loop is a *pattern* until paired with a *purpose*. We can show the pattern. We cannot assert the purpose.

### Adverse media findings (Challenge 10)
- Single-source unconfirmed allegations are explicitly tagged as such
- We are pointers to existing reporting. We do not republish allegations as facts.
- Withdrawn or retracted reports must be surfaced.

## Output validation prompt (for use by PYTH-GOV)

When PYTH-GOV reviews output, the validator runs this:

```
You are reviewing accountability analysis output for calibration violations.

INPUT:
{output_text}

CHECK FOR:
1. Causal language ("led to", "caused", "resulted in") without a citing source
2. Editorial superlatives (stunning, egregious, shocking, alarming)
3. Hedged accusations ("possibly," "potentially," "appears to have")
4. Reader-direction ("warrants investigation," "must explain," "should address")
5. Innuendo by adjacency (two facts juxtaposed to imply a third)
6. Quote-stitching across sources
7. Absent citations on factual claims

OUTPUT:
{ "passed": true | false, "violations": [{ "type": "...", "sentence": "...", "rewrite": "..." }] }

Be strict. We default to PASS only when truly clean.
```

## When you're stuck

If a finding is genuinely powerful but you can't find calibrated language for it, the answer is usually one of:
1. Cite more directly — point to the AG report, Hansard transcript, Departmental Results Report
2. Show more numbers and less prose — let the reader see the math
3. Drop the inference entirely and trust the structured data to do the work

The strongest accountability work is the most boring. The reader does the rest.
