# Agency 2026 — Pythagorithm Build Package (FINAL — Overnight Build Edition)

**Event:** Agency 2026 Hackathon, Ottawa, April 29, 2026
**Operator:** Will Coffey, Pythagorithm AI Governance Solutions
**Repo:** github.com/PythagorithmWill/agency-2026-hackathon (created during kickoff)

---

## What's in this package

```
final-package/
├── README.md                              ← you are here
├── KICKOFF-PROMPT.md                      ← copy/paste into Claude Code to start
├── 00-Strategic-Briefing.docx             ← read first; the strategic spine
├── 01-PRD.docx                            ← Product Requirements Document
├── 02-Architecture-and-Build-Spec.docx    ← Technical architecture, schemas
├── 03-Engineering-Playbook.docx           ← Build sequence (overnight + day-of)
├── 04-Test-and-Validation-Plan.docx       ← Calibration tests, failover rehearsals
└── 05-Claude-Code-Project/                ← Drop into your working directory
    ├── CLAUDE.md                          ← root orchestrator
    ├── PROJECT-RULES.md                   ← R1-R10
    ├── AUTONOMOUS-EXECUTION.md            ← hands-off operation playbook
    ├── DESIGN-SYSTEM.md                   ← canonical UI/UX guide (NEW)
    └── .claude/
        ├── agents/                        ← 9 subagent definitions
        └── skills/                        ← 3 auto-loading skills
```

## What changed in this final-final version

- **`DESIGN-SYSTEM.md` added to the Claude Code project.** Single canonical source for all UI/UX decisions: the four signature design moves (Strand, Strata Panel, Brief, custom glyphs), color and typography systems, motion principles, layout rules, component-level specifications, accessibility requirements, and explicit lists of what looks generic-AI to avoid. PYTH-FE reads this before writing any component.
- **GitHub repo creation in the kickoff sequence.** First task on session start: create `github.com/PythagorithmWill/agency-2026-hackathon`, set up commit discipline, push at every progress checkpoint. Day-of deploy is `git push` → CI/CD → AWS.
- **PYTH-OPS expanded** with full GitHub workflow guidance (commit format, branch discipline, deploy flow).
- **Kickoff prompt expanded** with GitHub setup as steps 8-13 and design system in the reading list.

## Quickstart

1. Unzip this package
2. Drop `05-Claude-Code-Project/` contents into your working directory
3. Open Claude Code in that directory
4. Copy the prompt from `KICKOFF-PROMPT.md` (the block under "THE KICKOFF PROMPT")
5. Paste into Claude Code as your first message
6. Sleep
7. Wake at 7:00 AM, read `MORNING-BRIEFING.md`, head to venue

## The four signature design moves (memorize these)

The UI is what separates this build from every other AI dashboard at the hackathon. PYTH-FE prioritizes these above all else:

1. **The Strand** — animated SVG path drawing from a Proof badge to its source row. The signature visual moment.
2. **The Strata Panel** — concentric arcs showing which agent is currently working. Architecture made visible.
3. **The Brief** — Outcome and Counterfactual Briefs rendered as editorial-quality documents (Fraunces headline, marginal-note citations, Proof token strip). Print-preview-ready.
4. **Custom domain glyphs** — hand-drawn SVG icons for charity, federal grant, AB grant, lobbying, donation, contract, AIA-registered AI system. Recognizable when screenshotted.

Read `DESIGN-SYSTEM.md` for the full specification.

## Non-negotiables (memorize)

- Pythagorithm Proof Methodology never gets named in the demo unless someone asks. Demand pull, not push.
- Glass Box correctness and Proof tokens never get cut.
- Calibrated language: "dataset shows" not "government failed." PYTH-GOV runs the validator on every output.
- No mention of GovCore, AIOS internals, ServiceNow Build Partner status, SDVOSB, Carahsoft in the demo or UI.
- The 90-second pitch is the pitch. Stop talking after that.
- Janak Alford is treated as we would any keynote speaker. We do not name him.
- The UI follows DESIGN-SYSTEM.md, not generic-AI conventions. No purple gradients, no glassmorphism, no Sparkles icon.

## What "autonomous overnight operation" means

PYTH-LEAD reads AUTONOMOUS-EXECUTION.md on session start. It works through the priority-ordered task list (P0→P1→P2→P3→P4), runs quality gates after every change (build/lint/test, security scan, calibration check), commits and pushes to GitHub at every 30-minute checkpoint, logs decisions to `decisions.md`, and only stops to wake you for things in the hard-guardrail list.

GitHub serves as the audit trail. If you wake at 3 AM and want to check progress remotely, the latest commit on `github.com/PythagorithmWill/agency-2026-hackathon/main` tells you exactly where the build is.
