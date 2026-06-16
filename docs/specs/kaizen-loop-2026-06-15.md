# Kaizen Loop — Weekly Fleet Self-Improvement Retro

**Status:** shipped 2026-06-15 · **Tier:** 3 (weekly) · **Owner:** the fleet (this is dogfood — the fleet improves itself)

## What this is

Agents that build agentplain spend their days thinking about how to work better and make the product perform better. The kaizen loop is the mechanism that captures that thinking at the **organizational** level instead of letting it evaporate at the end of each session: a recurring weekly retrospective that reviews **how the agent fleet itself is working** and proposes concrete improvements to orchestrators, skills, model routing, and scheduled tasks.

It is one of three quality tiers:

| Tier | Reviews | Cadence | Where |
|---|---|---|---|
| 1 | Live customer surfaces | continuous | separate |
| 2 | E2E + audit-queue seeding | per-change | separate |
| **3 — kaizen (this)** | **the fleet's own way of working** | **weekly (Sun 9am ET)** | **here** |

Tier 1/2 ask "is the *product* good?" Kaizen asks "is the *fleet that builds the product* getting better at it?" — the self-improvement layer.

## Where it sits in the operating system

The OS spec (`docs/specs/AGENTPLAIN_OPERATING_SYSTEM_2026_06_15.md`) defines a weekly calibration roll-up (Section 7) and a Monday strategic review (Tier 3). Kaizen is the **Sunday-morning precursor** to Monday: it reads the week's accumulated data, finds the patterns, and hands Conner (and Monday's review) a structured read on what to tune. The Monday review then folds kaizen's findings into the week's wave plan.

Kaizen **surfaces directly to Conner** (via the scheduled task's message). It does **not** write into the Librarian INBOX — INBOX is for state that flows *inside* the fleet; kaizen is a report *out* to the operator. (The one exception is the session-stamp hook below, which is a different concern — it *feeds* the data layer the retro reads.)

## Architecture

```
                         memory/data/*.yaml  (Librarian-managed)
                         ├── session-costs.yaml      ← every session's cost+outcome
                         ├── cv-bar-scores.yaml       ← every scored PR's cv-bar
                         ├── calibration.yaml         ← accumulated learnings
                         └── budget-state.yaml        ← week-to-date burn
                                  │
            ┌─────────────────────┤ read-only
            │                     ▼
   lib/kaizen/data-readers.ts  loadKaizenInputs({windowDays, now})
            │                     │  (wraps lib/memory/data-readers.ts — one source of truth)
            ▼                     ▼
   lib/kaizen/pattern-detectors.ts   pure fns: findRetryStorms, findExpensiveSessions,
            │                        findLowCVBarScores, findFailedOrchestrators,
            │                        analyzeModelEfficiency, findCostDiscrepancies,
            ▼                        analyzeBudget, summarizeWindow
   lib/kaizen/proposal-generator.ts  generateRetro() → KaizenRetro {summary, patterns,
            │                        proposals, dataGaps}; renderRetroMarkdown()
            ▼
   scripts/run-kaizen-retro.ts       CLI — offline, deterministic, prints md or --json
            │
            ▼
   scheduled task: agentplain-weekly-kaizen   reads the script output, layers Opus
                                              judgment, posts to Conner via SendUserMessage
```

### Separation of concerns: deterministic floor vs. judgment

The code produces a **deterministic floor** — same YAML in, same patterns and proposals out. Every proposal cites its evidence (session ids, PR numbers, dollar figures) per OS invariant I-11 (no guesses, cite the artifact). The scheduled Opus session reads that floor and adds the **judgment layer**: which proposals actually matter this week, what the deeper cause is, and what (if anything) belongs on Conner's decision queue.

Why split it this way:
- **Reproducibility** — the evidence is recomputable; the retro can't hallucinate a pattern the data doesn't show, and can't silently omit one it does.
- **Cost** — the script is free to run any time (no API calls; the prod key is paused by policy anyway). Judgment runs once a week.
- **Testability** — the detectors are pure functions over arrays, unit-tested with mocked inputs (`lib/kaizen/__tests__/`).

## What the detectors find

| Detector | Signal | Maps to proposal |
|---|---|---|
| `findRetryStorms` | a unit of work (pr# or normalized title) attacked 3+ times | orchestrator-prompt fix (if it kept failing) or process capture (if it eventually landed) |
| `findFailedOrchestrators` | sessions that errored/killed | process — review failure mode, cold-start safety (I-1) |
| `findExpensiveSessions` | session cost over threshold | feeds budget/routing context |
| `findLowCVBarScores` | PRs self-scored <4 (the bar) | orchestrator-prompt — the prompt didn't land; was the gate held? |
| `analyzeModelEfficiency` | cost vs. cv-bar joined per model | model-routing — downgrade candidate when a model is expensive *and* sub-bar |
| `findCostDiscrepancies` | recorded cost vs. token-recompute drift; unpriced models | process — keep cost data trustworthy (it gates budget) |
| `analyzeBudget` | tier near/over cap, over-cap projection | budget — urgent if projection overruns the envelope |

Proposals carry a `category` (orchestrator-prompt · model-routing · skill-addition · skill-deprecation · scheduled-task · budget · process) and a `severity` (info · suggested · recommended · urgent). The mission's required outputs — orchestrator improvements, skill add/change/deprecate, model-routing recommendations, missing scheduled tasks, budget analysis — all land as proposal categories the judgment layer expands on.

## The data layer must be populated — `session-stamp.ts`

The retro is only as good as the data. Today the YAMLs are essentially empty (the Librarian's audit confirmed it): the schema exists, but nothing writes rows. `lib/kaizen/session-stamp.ts` is the hook that fixes that — a session calls it on completion to record its cost+outcome and (for a PR) its cv-bar self-score.

It respects the write contract (`memory/data/README.md`): it does **not** mutate the data files directly (concurrent sessions would clobber each other). It drops a timestamped payload into `memory/inbox/`, which the Librarian merges on its 15-minute cadence.

Payload contract (what the Librarian merges):

```yaml
# memory/inbox/20260615-093000-session-cost-abcd1234.yaml
type: session-cost
target: session-costs.yaml
session_cost: { session_id: ..., model: ..., estimated_cost_usd: ..., outcome: ..., ... }
cost_unpriced: true   # present only when the model wasn't in the price table

# memory/inbox/20260615-093000-cv-bar-score-271.yaml
type: cv-bar-score
target: cv-bar-scores.yaml
cv_bar_score: { pr_number: ..., self_score: ..., reasoning: ..., scored_at: ... }
```

`estimated_cost_usd` is recomputed from token counts via `lib/kaizen/pricing.ts` when the caller omits it. **Every cost is an estimate** (I-11) — the price table is list pricing, never an asserted billed actual.

### Wiring the stamp (follow-up)

The clean end state is for the session-dispatch wrapper (around `mcp__dispatch__start_code_task`) to call `stampSessionCost` on every session completion, and for any session that opens a PR with a self-score to call `stampCvBarScore`. This PR ships the **mechanism**; wiring it into the dispatch path is a one-line follow-up per call site (it needs the dispatch wrapper, which is a separate surface). Until then the retro honestly reports "DATA MISSING" rather than inventing numbers.

## The scheduled task

`agentplain-weekly-kaizen` — cron `0 9 * * 0` (Sundays 9am ET local), `notifyOnCompletion: true`, Opus 4.8. Self-contained prompt: rebase, run `tsx scripts/run-kaizen-retro.ts`, read the deterministic output, layer judgment, post to Conner via SendUserMessage. It does **not** restore the paused prod API key and does **not** write to INBOX.

## How to extend

1. **New pattern** → add a pure detector to `pattern-detectors.ts` + a test in `__tests__/`. Take arrays, return typed findings, no I/O.
2. **New proposal type** → add a `ProposalCategory`, emit it in `buildProposals`, render it.
3. **New data source** → add a reader to `lib/memory/data-readers.ts`, surface it through `loadKaizenInputs`.
4. **Tune thresholds** → `GenerateRetroOptions` (expensive-session $, expensive-model avg $) and per-detector opts. Defaults: expensive session $40, expensive model avg $50, budget warn 80%, cost-drift tolerance 15%.

## Tests

`lib/kaizen/__tests__/` — 38 cases over `node:test` (the repo's runner; picked up by `npm test`'s `lib/**/*.test.ts` glob). Detectors and the proposal generator are tested with mocked inputs; `session-stamp` writes to a throwaway temp inbox. Run: `node --import tsx --test "lib/kaizen/__tests__/*.test.ts"`.

## Files

- `lib/kaizen/data-readers.ts` — windowed loader over the three YAMLs (+ budget)
- `lib/kaizen/pattern-detectors.ts` — pure detectors
- `lib/kaizen/proposal-generator.ts` — proposals + `KaizenRetro` + markdown render
- `lib/kaizen/pricing.ts` — model price table + cost estimator
- `lib/kaizen/session-stamp.ts` — INBOX-writer hook (Deliverable C)
- `scripts/run-kaizen-retro.ts` — CLI entry point
- `lib/kaizen/__tests__/*` — unit tests
