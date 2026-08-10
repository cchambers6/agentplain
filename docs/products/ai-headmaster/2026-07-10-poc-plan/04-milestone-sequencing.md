# AI Headmaster POC — Milestone Sequencing

M1–M6 from the brief, plus M0 (the de-risk gate that runs before any repo exists). Owner roles use the head-of-department pattern from `docs/skills-v2/cowork/orchestration/head-of-department/SKILL.md`. Fleet-day estimates are POC-grade (rough, not production commitments — `feedback_no_guesses_no_estimates` satisfied by labeling them estimates and citing the comparable agentplain builds they're calibrated on).

## M0 — Integrator bake-off (de-risks the biggest bet) — **1 fleet-day, ~$30 inference**

**Owner:** Head of Product. **Runs before repo spawn** as an ordinary fleet session — no code needed, just the v0 Integrator prompt (doc 03 §1), hand-assembled metadata for the candidate curricula, and the Charlotte Mason pack draft.

- Files: `docs/products/ai-headmaster/bake-off/` in agentplain (inputs, 3 outputs, judge scores) — docs-only, same repo as this plan.
- Method: 3 independent judge passes, blind to each other, scoring the 5-point stapling rubric (doc 07 §4).
- **Success looks like:** ≥2 of 3 judges score ≥4/5 on "one plan, not a staple", zero content reproduction. **This is the gate for everything below.**

## M1 — Memory + onboarding — **2 fleet-days**

**Owner:** Head of Engineering. **Files:** repo scaffold per doc 05; `prisma/schema.prisma` + migrations 0001/0002 (doc 02); `prisma/seed-demo.ts`; `app/(parent)/onboarding/` (family profile → children → curricula metadata entry → philosophy confirm); `lib/philosophy-packs/charlotte-mason.ts`; CI with RLS smoke test.

- Curricula entry is the ≤20-min-onboarding risk: parent types ToC metadata from books they own. v0 mitigation: unit-table quick entry with sensible defaults (lessonCount, minutes) — not per-lesson data entry. (Photo-import of ToCs is v1, doc 08.)
- **Success looks like:** a tester onboards the synthetic family from a stopwatch start in ≤20 min; seed + reset scripts produce the demo family idempotently; RLS smoke test green in CI.

## M2 — Integrator v0 wired — **3 fleet-days**

**Owner:** Head of Engineering (prompt iteration with Head of Product). **Files:** `lib/agents/integrator/` (context assembly, call, validation, persistence); `lib/llm/` (compose port: Logging/Budget/Sentinel/Caching/Anthropic); `app/api/agents/integrator/route.ts`; conflict-walkthrough UI in onboarding.

- Depends on M0's winning prompt; M2 is *wiring*, not prompt discovery.
- **Success looks like:** onboarding completion triggers an Integrator run that persists an IntegrationMap passing the M0 rubric on live inputs; open conflicts render as parent decisions and block WeeklyPlan until addressed; Sentinel + budget layers exercised by tests (a seeded content-leak fixture is blocked; an over-budget call is refused).

## M3 — Daily loop — **3 fleet-days**

**Owner:** Head of Engineering + Head of Design (parent surface enters here). **Files:** `app/(parent)/today/` (brief + debrief chat, SSE); `lib/agents/tutor/` (brief, debrief turns, triage, extraction); `DailyLog`/`ChildModelUpdate` write paths; transcript persistence.

- **Success looks like:** ten consecutive simulated school days run end-to-end; median parent time ≤5 min (measured: first-open → debrief-close); every closed debrief yields a triage verdict; rich days produce evidence-carrying ChildModelUpdates; Child.model visibly evolves in the DB across the ten days.

## M4 — Headmaster weekly cycle — **2 fleet-days**

**Owner:** Head of Engineering. **Files:** `app/api/cron/headmaster/route.ts` + `vercel.json` cron entries; `lib/agents/headmaster/` (Sunday plan, Friday report, disruption replan); rationale-citation schema enforcement; plan/report parent surfaces.

- **This milestone carries acceptance criterion 3.** The rationale rows must cite real ChildModelUpdate ids — the doc 02 SQL query returns them.
- **Success looks like:** two full simulated weeks: Sunday plans generated on cron, Friday reports read like a colleague (Design sign-off), a mid-week disruption replans remaining days only, and the traceability query returns ≥1 adjustment already.

## M5 — Registrar — **1 fleet-day**

**Owner:** Head of Engineering. **Files:** `lib/agents/registrar/rules.ts` + edge-case Haiku call; `app/api/registrar/export/route.ts` (CSV + PDF); ComplianceRecord write in the debrief-close transaction.

- **Success looks like:** the two M4 simulated weeks yield ComplianceRecords matching a hand-computed golden set exactly; export renders the Georgia format; an ambiguous fixture routes to Haiku and an undecidable one asks the parent instead of guessing.

## M6 — Two-week dry run — **~2 fleet-days attending, 14 calendar days**

**Owner:** Head of Product. **Format per the doc 07 recommendation (Conner decision #3):** week 1 simulated (scripted parent persona with injected disruptions + a "bare-minimum parent" day), week 2 live with the real family.

- Files: `docs/dry-run/` daily observations; cost meter snapshots; the acceptance scorecard.
- **Success looks like: the brief's acceptance criteria, measured, not asserted:**
  1. onboarding ≤20 min (stopwatch, week-2 family) ✓/✗
  2. 10 daily loops ≤5 min each (timestamps) ✓/✗
  3. ≥3 traceable adjustments (the doc 02 query) ✓/✗
  4. Georgia export accurate (golden-set + parent review) ✓/✗
  5. cost ≤~$10/family/mo (LlmCallLog actuals, extrapolated) ✓/✗
  6. zero curriculum content reproduced (Sentinel log = 0 unresolved hits + manual spot-audit of 20 random outputs) ✓/✗

## Sequencing notes

- M0 gates everything; M1 can start in parallel with M0 **only** if Conner accepts the risk of scaffold rework (recommend: don't — it's one day).
- M1→M2→M3→M4→M5 are sequential landings (each builds on the last's schema/PR; `feedback_sequential_not_parallel_for_overlapping_prs`). Within a milestone, parallel worktrees are fine.
- **Which milestone de-risks the biggest bet: M0/M2** (the brief guessed M2 — we agree, and pulled the risky half forward to M0 so the bet is settled for ~$30 before ~13 fleet-days are committed). The *second* biggest bet — the child model compounds — is carried by M3+M4 jointly and measured in M6.

**Total: ~13 fleet-days** (M0:1, M1:2, M2:3, M3:3, M4:2, M5:1, M6:~2 attending) + 14 calendar days of dry run. Calibration reference: agentplain's killer-workflow runtime + 5 demos (PR #303) and the week-1 pilot runbook builds ran at comparable scope-per-day.
