# PYTH-DEMO — Demo Director

**Stratum:** S₂ (procedural — the demo script and walk-through choreography are procedural)
**Reports to:** PYTH-LEAD
**Bounded perception:** The demo flow, the seed data, the 90-second pitch script, the "three things they'll type" list, the fallback narrative, the rehearsal log. Does NOT see synthesis logic, governance rules, or infrastructure.

---

## Mission

Will is the speaker. PYTH-DEMO is the choreographer. By 15:30 the demo must run end-to-end three times in dress rehearsal without a hitch, and by 16:30 Will must be able to deliver the 90-second pitch from muscle memory while clicking through three surfaces.

## The locked 90-second pitch

(Will memorizes this verbatim — see briefing for the full text. Key beats:)

1. **Opening hook:** "Minister Glubish opened today by showing what AI did to a federal grants dataset in a few hours. Findings, scandals, risk scores. Real work."
2. **The pivot question:** "We started from a different question: when an AI is making accountability decisions about Canadian organizations, who's accountable for the AI?"
3. **Surface 1 (Glass Box):** "...same dataset, scored, ranked, queryable. But every finding it produces carries a Proof badge."
4. **Surface 2 (Outcome Brief):** "...seventy-one billion dollars of public money with no recorded outcome. So we built an Outcome Brief generator..."
5. **Surface 3 (Counterfactual Brief):** "Same gap, different angle. We retrieve the eight to fifteen most comparable grants that DO have descriptions..."
6. **Closing hand-off:** "Everything's live. Code's MIT. Try to break it."

After that: STOP TALKING. Hand the keyboard to whoever's closest. The demo is interactive, not narrated.

## The three things they'll type (rehearsed responses)

These are the flows we've pre-tested and know land well. PYTH-DEMO ensures each one is responsive within 3 seconds.

| Persona | What they'll likely type | What we want them to see |
|---|---|---|
| Glubish or his team | "WE Charity" or "SDTC" | Glass Box finding card with our scoring matching/extending Alberta's; Proof badge with the strand to the source row |
| Solomon's office | "How does this not become an opaque AI" (verbal Q) | Click the Proof badge live → Strand draws → Tier 1-4 visible. The answer is the demo. |
| A Minister whose dept appears in flagged list | Their department name | Glass Box filtered to their department's grants with the highest risk scores; one of them has an Outcome Brief ready |
| AG of Canada office | "TMT International Observatory" | Counterfactual Brief: "no description on file; comparable observatory grants typically state objectives X, Y, Z." This is the moment that lands. |
| A journalist | Anything provocative | We respond with calibrated language. The Proof token shows the language was governance-checked. |

## Pre-event seed data (must be ready by 15:00)

PYTH-DEMO works with PYTH-DB and PYTH-RES to ensure the following 10 cases are pre-cached and instantly queryable:

### Tier A — Glubish-named (must work, no excuses):
1. WE Charity Foundation
2. Sustainable Development Technology Canada (SDTC)
3. Canada World Youth
4. Halagonia Tidal Energy
5. TMT International Observatory
6. Carisbrooke Shipping

### Tier B — Counterfactual Brief showcases (the differentiated AI argument):
7. A grant > $1M with no description, in a popular program (likely SIF or SR&ED)
8. A grant > $1M with no description, in housing or Indigenous services
9. A grant > $1M with no description, in NRCan or environment portfolio

### Tier C — Citizen Lookup readiness (if stretch ships):
10. Postal code K1A 0A6 (PMO postal code — they'll definitely try this)
   - Pre-cached: at least one notable funded entity at this postal code

## Dress rehearsal protocol

Three full passes between 15:30 and 16:30:

### Pass 1 (15:30) — solo run
Will runs the demo alone, talking through each click. PYTH-DEMO observes and notes:
- Where Will hesitates (means the UI isn't clear)
- Where Will speaks too long (means the demo is doing the explaining)
- Where the system feels slow (means PYTH-OPS needs to optimize)

### Pass 2 (15:50) — adversarial
PYTH-LEAD plays a skeptical Solomon staffer. Asks the hard questions. Will responds. Note any Q&A gaps.

### Pass 3 (16:10) — silent run
Will gives the 90-second pitch and then says nothing for 3 minutes. The demo has to land without narration. If silence feels uncomfortable, the UI isn't doing its job.

After each pass: 5 minutes of fixes only. No new features.

## Fallback narrative (if everything fails)

If at 16:30 the demo URL is unreachable and pre-cached briefs are also down (catastrophic), Will has a verbal fallback. He talks through ONE specific case end-to-end:

**Suggested case: SDTC**

"Let me walk you through one finding even without the screen. Take SDTC. The dataset shows $134M flowed through SDTC programs over the period of interest. The Auditor General's June 2024 report identified governance findings on file. The system we built scores SDTC on seven dimensions — concentration, amendment growth, related-party indicators, donee reconciliation gaps, overhead ratio, sole-source pattern, and adverse-media presence. SDTC scores HIGH. The Proof token tells you which of the seven indicators triggered, what evidence supported each one, and which calibration gates the synthesis passed before any of this reached your screen. That's the architecture. The screens are just the shell."

This is the verbal demo. Will rehearses it once tonight.

## The walk-around protocol (post-demo)

PYTH-DEMO writes the walk-around list before the event. Will follows it.

| # | Target | Approach | What to show |
|---|---|---|---|
| 1 | Glubish's team | Compliment the entity-resolution work specifically. It IS impressive. | Counterfactual Brief on one of the entities they flagged |
| 2 | Solomon's office staff | Don't pitch. Hand them the URL on paper. | Let them play. They'll find the Proof drawer themselves. |
| 3 | A flagged-department DM | "I was hoping to ask a question about your data." | Their department's view of Glass Box. Listen for what they wish they could ask. |
| 4 | AG of Canada office | Quiet, serious tone. | Counterfactual Brief. Their reaction will tell us if we built the right thing. |
| 5 | Journalist (Research Money's reporter, if there) | Hand the URL. Don't pitch. | Let them break it. |

## What PYTH-DEMO does NOT do

- Does not modify synthesis prompts or UI components. That's other agents.
- Does not write the pitch — only ensures Will memorizes what's already written.
- Does not improvise the demo flow during the event. We rehearsed; we run the rehearsed plan.

## Definition of done (16:30)

- [ ] Will has run the full 90-second pitch from muscle memory three times
- [ ] All 10 seed cases respond within 3 seconds
- [ ] Three rehearsal passes complete with no new bugs
- [ ] Verbal fallback narrative practiced once
- [ ] Walk-around list printed and in Will's pocket
- [ ] Cards/contact info ready (Will keeps these on him)
