# AI Headmaster POC — Executive Plan

**Date:** 2026-07-10 · **Status:** proposed, awaiting Conner's build greenlight
**Source brief:** Conner's "AI HEADMASTER — POC Build Brief for Dispatch" (2026-07-10)
**Relationship to agentplain:** separate product, separate repo (`cchambers6/ai-headmaster` once spawned). This PR is docs-only planning inside agentplain because the fleet operates here. No agentplain runtime code changes.

## What we build

An orchestration layer for one homeschool family: four agents over one shared Postgres memory that plan *around* curricula the family already owns (never reproducing their content), run a ≤5-minute daily loop with the parent, compound a longitudinal model of the child, and emit Georgia compliance records as a byproduct.

| Agent | Model | Cadence | Job |
|---|---|---|---|
| Curriculum Integrator | Opus 4.8 | onboarding + on change | Curricula metadata + philosophy pack → one IntegrationMap |
| Headmaster | Opus 4.8 | weekly (Sun plan, Fri report) | WeeklyPlan + Friday report; replan on disruption |
| Tutor-Advisor | Sonnet 5 (debrief) / Haiku 4.5 (brief) | 2×/school day | Morning brief + dynamic debrief + Child.model updates |
| Registrar | rules code + Haiku edge cases | post-debrief | Georgia attendance/subject record + export |

Full architecture: [`01-architecture.md`](./01-architecture.md). Stack: Next.js + TypeScript + Prisma/Postgres (Neon) + Vercel — the exact stack the fleet is fluent in, so agentplain's LLM compose order, budget seam, RLS pattern, and data-reader discipline port directly (citations in doc 01).

## The single biggest bet to de-risk first

**"Does the Integrator actually integrate, or does it staple?"** Everything downstream — the daily loop, the child model, the compliance byproduct — is buildable with known patterns. The one thing nobody has proven is that an LLM given *metadata only* (scope-and-sequence, lesson titles, durations — never lesson content) from 2–3 curricula plus a Charlotte Mason pack produces **one coherent interleaved week** rather than three schedules pasted side by side.

**The de-risk test (runs before any app code, week 1, ~$30 of inference):** the Integrator bake-off. Feed the v0 Integrator prompt ([`03-agent-prompts.md`](./03-agent-prompts.md)) the real scope-and-sequence metadata of the chosen curricula. Three blind judge passes score the output on a 5-point rubric: cross-subject thematic links, honored prerequisite ordering, conflict surfacing, load balancing across the 4-day week, and zero curriculum content reproduction. **Pass bar: ≥2 of 3 judges score "one plan, not a staple" (≥4/5).** Fail → we iterate the prompt for one more week; fail twice → we report to Conner that the product's core premise needs rethinking *before* fleet-weeks are spent. Details: [`07-risks-and-decisions.md`](./07-risks-and-decisions.md) §4.

## The single acceptance test that proves the POC

Acceptance criteria (1)–(6) from the brief all matter, but the one that proves the *product* rather than the plumbing is **criterion 3: ≥3 plan adjustments traceable to specific debrief observations.** It exercises the whole loop — debrief captures an observation → extraction writes a Child.model update → the next Headmaster run reads it and visibly changes the plan → the trace is queryable end-to-end (`DailyLog.id → ChildModelUpdate.id → WeeklyPlan.rationale`). We make it non-cherry-pickable by designing the trace into the schema (append-only `ChildModelUpdate` rows carrying `source_daily_log_id`; WeeklyPlan rationale rows carrying `model_update_ids`) so the adjustments are enumerated by a SQL query, not by narrative. Details: doc 07 §5.

## Order of work (M1→M6, detail in doc 04)

1. **M0 (pre-milestone, week 1):** Integrator bake-off — the de-risk test above. No repo needed; runs as a fleet session.
2. **M1** Memory + onboarding (schema, seed, ≤20-min onboarding flow) — 2 fleet-days
3. **M2** Integrator v0 wired into the app — 3 fleet-days
4. **M3** Daily loop (morning brief + debrief + extraction) — 3 fleet-days
5. **M4** Headmaster weekly cycle + Friday report — 2 fleet-days
6. **M5** Registrar + Georgia export — 1 fleet-day
7. **M6** Two-week dry run (simulated week 1, live week 2 — Conner decision) — ~2 fleet-days of attending across 14 calendar days

**Total: ~13 fleet-days of build + a 14-calendar-day dry run.** Calendar estimate: greenlight → M6 acceptance in ~4.5 weeks.

## Team (fleet configuration)

Same head-of-department pattern the fleet ran for PRs #356–#365 (`docs/skills-v2/cowork/orchestration/head-of-department/SKILL.md`):

- **Head of Product (Headmaster):** owns milestone acceptance, the bake-off rubric, and the Conner decision queue. Owner of M0, M6.
- **Head of Engineering (Headmaster):** owns repo scaffold, schema, agent runtimes, cost instrumentation. Owner of M1–M5. Parallel work in worktrees per `feedback_parallel_waves_use_worktrees`; overlapping PRs land sequentially per `feedback_sequential_not_parallel_for_overlapping_prs`.
- **Head of Design (Headmaster):** owns the parent-facing chat surface and voice. Enters at M3. Constraint carried from agentplain: model/vendor invisible on all parent surfaces (`feedback_model_vendor_invisible_on_customer_surfaces`).
- No sales/marketing/legal heads for POC — out of scope per the brief.

## Cost

Point estimate **≈ $5.75/family/month** at the recommended architecture; 80% interval **$4.50–$9.00**, against the ≤$10 target. Weekly Opus (Integrator + Headmaster) ≈ $2.80/mo; daily Sonnet/Haiku loop ≈ $2.95/mo; Registrar ≈ $0.02/mo. Enforced by a per-family token budget gate ported from agentplain's budget seam (PR #146) and `canSpend()` discipline (PR #265). Full math: [`06-cost-architecture.md`](./06-cost-architecture.md).

## What Conner must decide before build starts

Three product decisions plus two logistics items — full list with recommendations in [`09-hand-off-package.md`](./09-hand-off-package.md):

1. **Chat-first vs lightweight app** → recommend lightweight web app with a chat-shaped daily thread (SSE).
2. **Which 2–3 curricula to onboard** → must be curricula the POC family actually owns; CM-compatible recommendations in doc 07.
3. **Simulated vs live M6 dry run** → recommend hybrid: simulated week 1, live week 2.
4. GitHub permission to spawn `cchambers6/ai-headmaster` (private).
5. Anthropic API workspace: new workspace under the existing org, separate key + budget cap.

## Kill criteria (so this doesn't zombie)

- Bake-off fails twice → stop, report, re-scope. (KILL-list discipline per `docs/skills-v2/cowork/governance/kill-list-discipline/SKILL.md` — every kill carries a restart trigger.)
- Dry-run parent time >5 min/day for 3 consecutive days after tuning → the daily loop premise fails; stop and redesign the debrief before continuing.
- Measured inference >$10/family/month equivalent during the dry run with caching on → cost architecture rework before any v1 talk.
