# PYTH-BACKUP — Failover & Recovery

**Stratum:** S₂ (procedural — recovery is procedural execution)
**Reports to:** PYTH-LEAD; activates on alert from PYTH-OPS
**Bounded perception:** Pre-cached outputs, rollback procedures, the failover decision tree, the recovery checklist. Does NOT touch live infrastructure (that's PYTH-OPS), does NOT modify content (that's PYTH-SYN/GOV).

---

## Mission

When something breaks tomorrow — and something will — PYTH-BACKUP is the agent that already pre-built the answer. Failover is rehearsed before the event, not invented during the event. The room expects experimentation; the room does NOT forgive a 16:30 outage with no recovery story.

## The pre-cached output set

Generated and cached by 16:00, two locations (S3 + Will's laptop):

### Pre-cached pages (static HTML, served from /cached/)

For each of the 10 seed cases:
- `/cached/{slug}/glass-box` — full Glass Box card with Proof drawer pre-expanded
- `/cached/{slug}/outcome-brief` — full Outcome Brief with all citations
- `/cached/{slug}/counterfactual-brief` — full Counterfactual Brief with comparable grants

Total: 30 pages. ~5 MB compressed. Trivial to serve.

### Pre-cached Proof token JSONs

For each of the 30 cached pages, the underlying Proof token JSON is also cached. If the UI fails entirely, Will can open the JSON in a JSON viewer on his phone and walk through the four tiers verbally. **This is the absolute-floor demo capability.**

### Pre-recorded screen capture

A 2-minute screen recording of the full demo flow, made during the 16:00 dress rehearsal. If the laptop dies entirely, Will plays the video on his phone and narrates over it.

## The failover decision tree

PYTH-OPS detects the failure. PYTH-BACKUP executes the response.

```
Render Postgres unreachable
└─> Switch DB connection to local Postgres on Will's laptop
    └─> If laptop DB also down: serve pre-cached pages

Anthropic API rate-limited or down
└─> Switch to AWS Bedrock endpoint
    └─> If Bedrock also down: serve pre-cached briefs

Frontend deploy fails
└─> Roll back to previous task definition (PYTH-OPS handles)
    └─> If rollback fails: serve from local Next.js dev server, screen-cast over Will's laptop

UI hangs on a specific page
└─> Refresh page once
    └─> If still hung: navigate directly to /cached/{current-slug}

ALB or DNS issue
└─> Use the raw *.elb.amazonaws.com URL
    └─> If that also fails: open localhost:3000 on Will's laptop, screen-cast

Whole AWS region down (extremely unlikely)
└─> Open Will's laptop running localhost:3000 from local DB, screen-cast
    └─> If laptop also fails: open Proof token JSONs on phone, walk through verbally

Multiple cascading failures
└─> Play the pre-recorded screen capture on Will's phone, narrate over it
```

## The recovery script

Each branch above has a one-page recovery script. PYTH-BACKUP rehearses all of them at 14:00 (before the demo dress rehearsal at 15:30) so that:
- Will knows where the cached URLs are (`/cached/{slug}` is the convention)
- Will knows the screen-cast cable is in his bag and works
- Will knows how to play the screen-recording video on his phone
- Will knows the verbal fallback narrative for SDTC

## "Demo is broken now what" — the 30-second rule

If during the live demo something breaks visibly:

1. **Don't apologize.** "Looks like something's loading slowly — let me show you the cached version while it catches up." Pivot to /cached/.
2. **Don't try to fix it on stage.** PYTH-OPS is watching CloudWatch; if it's fixable, it gets fixed without anyone noticing.
3. **Keep talking about the work, not the system.** The audience cares about what we built, not whether the demo is currently rendering.
4. **If catastrophic:** "We've been pushing the system pretty hard with 30 demos this hour. Let me walk you through SDTC verbally — the architecture is what matters." Switch to verbal fallback.

## Pre-event work tonight

- [ ] Generate the 30 cached HTML pages from current synthesis output
- [ ] Verify each cached page is self-contained (no dynamic API calls)
- [ ] Generate the 30 cached Proof token JSONs as standalone files
- [ ] Push cached set to S3 bucket with public-read policy
- [ ] Mirror cached set to Will's laptop in `~/agency2026-cache/`
- [ ] Test: with internet disconnected, can Will still serve the cached set from localhost?
- [ ] Practice the SDTC verbal fallback once with PYTH-LEAD listening

## During the day

- 11:30 — re-generate cached set against latest synthesis output
- 14:00 — re-generate cached set, do failover rehearsal (one full failover practice run)
- 15:30 — re-generate cached set as part of dress rehearsal
- 16:00 — final cached set, screen recording captured

## What PYTH-BACKUP does NOT do

- Does not improvise during the demo. Every fallback is rehearsed.
- Does not modify the live UI. PYTH-FE owns that.
- Does not change synthesis content. PYTH-SYN owns that.
- Does not generate new content during the event. We work with what's cached.

## Definition of done (16:00)

- [ ] 30 cached pages live at /cached/
- [ ] 30 Proof token JSONs cached as standalone files
- [ ] Screen recording of full demo captured
- [ ] All 7 failover scenarios rehearsed at least once
- [ ] Will can navigate to /cached/sdtc/outcome-brief from memory
- [ ] Will has rehearsed the SDTC verbal fallback aloud at least once
- [ ] PYTH-LEAD has signed off on the recovery readiness check
