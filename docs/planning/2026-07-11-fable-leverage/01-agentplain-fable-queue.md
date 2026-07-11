# agentplain — Fable Work Queue (2026-07-11)

**Frame:** the company's lever is unchanged — five design-partner sends, replies, one signed Georgia RE partner (CEO Pass 1, PR #348; unified 14-day plan, `docs/departments/2026-07-03/COORDINATION/00-UNIFIED-14D-PLAN.md`). Fable's job on agentplain is therefore narrow: the handful of artifacts where writing quality or cross-cutting judgment directly moves reply→signature→retention. Everything already Fabled and in flight is excluded below.

## Already done — do not refire

| Workstream | Where it landed |
|---|---|
| Monday send pack + waves 2+3 prospect research (25 GA RE prospects, ~6 weeks of Monday ammunition) | PR #373, PR #384 — memory rule: no new prospect research until worked |
| CPA vertical prep incl. the TaxDome/Karbon truth fix | PR #382; the truth fix is **already on main** — refiring it is the classic ghost-task trap |
| Pricing conversation scripts (7 docs) | PR #376 |
| Design run / CTA contrast / price-tier components | PR #379 |
| Chiron CM pack, M2, M1 | PRs #385, #383, #381 |
| Outreach kit, discovery field kit, case-study framework | PRs #353, #372, #374 |

## Ranked queue

### A1. Pilot-week live-run rehearsal (S/M effort, time-critical)

Simulate the first design partner's week 1 end-to-end against the seeded Peachtree Realty demo workspace (PR #377: `prisma/seed-demo.ts`, `scripts/reset-demo.mjs`): onboarding call per the CS runbook (PR #366), first approval, lead-triage workflow fire, saved-time row, Friday report. Output = a rehearsal transcript + ranked P0 breakage list handed to Product (this is unified-plan item 1.6's exit test, run at full fidelity rather than checkbox depth).

**Why Fable:** the breaks that kill an onboarding call are cross-cutting — a state that renders "Working" while the fire-gate blocks it, a saved-time writer missing on 4 of 7 actions (audit PR #328), a degraded banner colliding with demo mode. Finding them requires the runbook + seed + approval spine + guarantee-leak fixes in one context. Sonnet checks items; Fable finds the interaction bugs between items.

### A2. Weekly-report AI narrative writer (S effort, high retention leverage)

Production prompt + golden set for the Friday partner report (unified plan 2.7). Constraints that make it Fable-shaped: ledger-only numbers (case-study methodology, PR #374 — unwired writers get an asterisk, never a fabricated figure), customer vocabulary not engineer labels (PR #249 ruling), voice guidelines (PR #309), and it must read like a colleague, not a dashboard export. Deliverable: prompt with stable cache prefix, output schema, 3 golden examples spanning a good week / thin week / degraded week, and the honest-empty-state copy for a week with no data.

### A3. Pricing-negotiation live-response tree (S effort, gated on a reply)

PR #376 scripted the conversations; what's missing is the live-reply branch tree: prospect counters with "$199 is steep for a solo agent," "what happens after the promo," "FUB already does this." Each branch gets a response grounded in the ratified three-tier structure (Regular $199→$99, Partner $299→$199, Max sales-led) and the RE value math (~$5,160/mo, the audited replacement for the retired $2.9K–$10.6K anchor — pricing memory, PR #376/#379). Banned phrases (compete/replace/alternative-to Claude; "pilot pricing") enforced.

**Why Fable:** each reply must hold pricing rulings, SBM positioning constraints, and the specific prospect's stack (prospect-to-stack map, unified plan ★0.4) simultaneously and still sound like Conner. **Fire only when a real reply exists** — drafting against imagined objections is analysis-for-analysis.

### A4. Prospect-research pipeline design (S effort, design-only, gated)

Waves 2+3 hold ~6 weeks of ammunition and the memory rule bans new prospect research until it's worked. What Fable can legitimately do now is design the *pipeline* so that when the ban lifts, Haiku/Sonnet run it instead of Fable: source list per GA metro (GAAR-not-GAMLS for Augusta, per the wave 2-3 memory), extraction template, hook-quality rubric (the Killingsworth rule: niche, never founder), verification checklist, and a scoring prompt for cheap models. Deliverable = one pipeline spec doc + the Haiku/Sonnet prompts, not any actual prospects.

### A5. Killer-workflow #2 spec (M effort, gated on #1 proving out)

Lead-triage is LOCKED as workflow #1 (Product head plan PR #359, demo state PR #377). Once one partner runs it weekly with a real saved-time figure, Fable specs the second RE workflow (within the kill list — RE depth only, no new verticals). The spec is judgment work: pick from the RE connector surface what compounds with triage (e.g., listing-status watch → draft follow-ups fits the no-outbound architecture), define the saved-time measurement before the build, and write the demo-state extension. **Trigger:** first partner's second week of live triage fires. Not before.

### A6. Marketing-site full copy pass (M effort, HOLD)

Held deliberately. Truth Wave (PR #290), the de-AI sweep (PR #309/#310), send-path fixes (PR #355), and the design run (PR #379) have already worked this surface; the marginal Fable session spent polishing copy against zero prospect feedback is worth less than the same session on Chiron. Re-open after the first 5+ replies produce actual objection language to write against — then it's a targeted pass on the pages replies cite, not top-to-bottom.

## Sequencing note

A1 and A2 share the demo-workspace context — run them as one session-day (see `04-sequencing.md`). A3 is event-driven. A4 fits any slack day. A5 and A6 have explicit triggers and should not be scheduled.
