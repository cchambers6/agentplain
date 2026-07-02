# Kaizen retro 9/10 — Data / Analytics (2026-07-02)

Scope: the kaizen retro engine (PR #273), its pattern detectors, the Librarian-managed YAML data layer (`memory/data/`, PR #265), the session-cost-stamp mechanism, the weekly kaizen scheduled task, and the wider question of what data the fleet actually has about itself and about customers.

Everything below is grounded in artifacts read on 2026-07-02: `lib/kaizen/*` and `memory/data/*` at origin/main `f928400`, `memory/LIBRARIAN_CHARTER.md`, `memory/WORKING_STATE.md`, `docs/specs/kaizen-loop-2026-06-15.md`, the scheduled-task registry, and a live run of `scripts/run-kaizen-retro.ts`. Where the retro brief's framing conflicted with the artifacts, the artifacts win (see friction #9 and Corrections at the end).

---

## Headline

The data/analytics layer is a well-built engine with an empty fuel tank. Every component of the measurement loop shipped — detectors, typed readers, write contract, offline CLI, weekly scheduled task — and every component is starved because the two feeder mechanisms (the session-cost stamp and the Librarian roll-up) were designed, documented, and never wired to an executor. The system's one saving grace is that it was engineered to say "DATA MISSING" instead of inventing numbers, which is exactly what it has said every week since it shipped.

Live proof — `node --import tsx scripts/run-kaizen-retro.ts`, run 2026-07-02T20:58Z:

> **⚠️ Data gaps:** DATA MISSING: zero session-costs rows in the last 7d. Either no sessions ran, or the Librarian INBOX → session-costs.yaml pipe is not populating.
> **Sessions analyzed:** 0 · **Estimated spend:** $0 · **PRs scored:** 0 · **Budget:** $0/$8670 week-to-date (0%)

Sessions did run in that window (this one included). The $0 is a measurement failure, not a spend fact.

---

## 10 wins

1. **A deterministic, offline retro floor exists and actually runs.** `scripts/run-kaizen-retro.ts` executed successfully today with zero API spend — no key needed, recomputable any time, `--json` and markdown modes, `--as-of`/`--window-days` for reproducing past windows. The judgment/floor split (script = facts, scheduled Opus session = judgment) is the right architecture for a cost-sensitive fleet.
2. **Seven pattern-detector families, all pure functions** in `lib/kaizen/pattern-detectors.ts`: retry storms, expensive sessions, low CV-bar scores, failed orchestrators, model cost-vs-value (`analyzeModelEfficiency` with `cheaperAlternative` routing hints), cost-vs-budget discrepancies, and budget-cap analysis. Deterministic, unit-testable, evidence-citing.
3. **Anti-fabrication is engineered in, not just policy.** The generator emits `dataGaps` and the scheduled-task prompt says verbatim: "an empty week means 'wire the stamp', not 'nothing happened'. Do not invent findings to fill a thin week." The system has honored this every run.
4. **The YAML data layer scaffold is on main with a clear write contract.** Six files under `memory/data/` (session-costs, cv-bar-scores, calibration, budget-state, conner-queue, pending-fires), each with a header stating purpose, owner, and "DO NOT write directly — go through the Librarian's INBOX." A README documents the whole contract plus typed readers.
5. **Typed readers, no ad-hoc YAML parsing.** `lib/memory/data-readers.ts` (with its own test) is the single read path; `lib/kaizen/data-readers.ts` adds windowing on top. Consumers never hand-parse.
6. **The populate mechanism exists and is tested.** `lib/kaizen/session-stamp.ts` ships `buildSessionCostPayload`/`stampSessionCost` and `buildCvBarPayload`/`stampCvBarScore` with tests — the write side was built to the inbox contract, ready to be called.
7. **Pricing is centralized with estimates-only discipline.** `lib/kaizen/pricing.ts` holds the per-model token rates; every cost surface is labeled "ESTIMATES from token counts (I-11)" — no cost number can masquerade as a billing fact.
8. **The weekly kaizen scheduled task is registered, enabled, and well-constrained.** `agentplain-weekly-kaizen` (Sun 9am ET) is read-and-report only: no INBOX writes, no PRs, no touching Librarian/Watchdog tasks, no key restore. Blast radius of a bad run is one message.
9. **`pending-fires.yaml` shows the data layer can host a real operational queue.** It is the one file with a deliberately different contract (append-only, direct-write, four-state lifecycle), fully documented in its header — evidence the YAML layer design flexes beyond passive metrics.
10. **The kaizen layer is one of the better-tested corners of the repo** — three dedicated test suites (`pattern-detectors`, `proposal-generator`, `session-stamp`) plus the data-readers test, all runnable offline via node:test.

## 10 friction patterns

1. **The session-cost stamp has never been called — root cause of null week-to-date.** `git grep` on origin/main: zero callers of `stampSessionCost`/`stampCvBarScore` outside `lib/kaizen/` itself. The spec (`docs/specs/kaizen-loop-2026-06-15.md:101`) called the wiring "a one-line follow-up per call site" on 2026-06-15; 17 days later it is still unwired. Every downstream number is null because of this one gap.
2. **The YAML data layer is 100% empty.** All six files contain schema headers and commented examples only — zero real rows since PRs #265/#273 landed. The scaffold shipped; the data never arrived.
3. **`budget-state.yaml`'s week window is frozen at 2026-06-15 → 2026-06-22.** The header says "Updated by Librarian on every session completion"; it has never been updated. Budget caps ($8,670/wk across tiers) are enforceable in code (`analyzeBudget`, `canSpend()`) but track a fiction.
4. **The Librarian has a charter but no executor.** `LIBRARIAN_CHARTER.md` prescribes a 15-minute roll-up (`agentplain-librarian-rollup`) that drains INBOX, refreshes WORKING_STATE, and maintains the YAMLs. No such task exists in the scheduled-task registry (verified 2026-07-02). The entire write path dead-ends: even a wired stamp would drop payloads into an inbox nobody drains.
5. **`WORKING_STATE.md` on main is still the unfilled template** — "Last refreshed: _\<ISO-8601 UTC — Librarian stamps each pass\>_", every section a placeholder. Anything reading it for "what is live right now" (per its own header: Tier-2/3 sessions, the Dispatch parent) reads nothing. Staleness isn't drift here; the file never had a first real write.
6. **The weekly kaizen task skipped a run and nobody noticed.** Registry: `lastRunAt` 2026-06-23, `nextRunAt` 2026-07-05 — the 2026-06-28 Sunday slot never fired. There is no meta-monitor that alerts when a scheduled task misses its own schedule; the analytics loop can silently stop and the only detector of that fact is a human.
7. **The judgment layer burns an Opus session weekly to report "no data."** The scheduled task always runs the full gather-and-judge flow even when `dataGaps` says the inputs are empty. There is no input contract or short-circuit ("inputs empty → send one line, skip judgment"), so the most expensive component runs when it has the least to add.
8. **Zero analytics on the actual product.** All detectors point inward at fleet self-ops. There is no instrumentation of Plaino usage — no activation funnel, no approval-latency tracking, no connector-usage counts, no cohort tracking, no per-vertical KPI surface (checked: no PostHog/Segment/Mixpanel/Amplitude anywhere in `lib/`/`app/`; no `lib/analytics|telemetry|metrics`). The `insights-*` skill roles exist with no data surface behind them. BI has never fired on customer data because none is collected.
9. **No ETL from the data that already exists.** Git history, PR metadata, CI results, Vercel deploys, and scheduled-task `lastRunAt` are all real, queryable exhaust — none of it is transformed into `memory/data/`. The only ingest path ever built is voluntary self-stamping, the weakest possible collection mechanism (friction #1 shows exactly how it fails).
10. **Retro inputs themselves carry unverified claims — meta-friction.** This retro's own brief cited an "insight library (from #300 kaizen)" — PR #300 on main is the time-savings guarantee; no insight library exists anywhere in the tree — and "50+ pattern detectors" where there are 7 families. Kaizen briefs inheriting unverified claims is precisely the failure the "no guesses, cite the artifact" rule targets; a retro that trusted its brief would have laundered fiction into the record. (Also filed for the runbook: the bare `tsx` binary dies with `spawn UNKNOWN` on this machine — `node --import tsx` is the reliable invocation; the scheduled task's documented `npx tsx` may share the failure mode.)

## Top 5 process improvements

1. **Wire the stamp at every dispatch completion call site — this week, before anything else.** The documented one-liner: dispatch wrapper calls `stampSessionCost` on completion; PR-opening sessions with a self-score call `stampCvBarScore`. Acceptance: the 2026-07-05 kaizen run reports `sessions analyzed > 0`. Nothing else on this list matters until the fuel line is connected.
2. **Give the Librarian an executor.** Register `agentplain-librarian-rollup` (or fold a roll-up step into an existing cadence like the 30-min audit-queue seeder) so INBOX drains, the budget week rolls, and WORKING_STATE gets its first real write. Acceptance: `WORKING_STATE.md` "Last refreshed" is under 24h old and `budget-state.yaml` shows the current week. Improvements 1+2 together close the loop; either alone leaves it open.
3. **Define a strict kaizen input contract with a cheap short-circuit.** Validate the YAML files against a schema on load (fail loud on malformed rows — today a hand-edited bad row would poison detectors silently), and when `dataGaps` reports empty inputs, have the scheduled session send a one-line "inputs empty — stamp/roll-up broken, skipping judgment" instead of running the full Opus flow. Saves the weekly spend and turns the empty week into an actionable alert.
4. **Run the BI weekly against a synthetic customer until real data exists.** Seed `session-costs`/`cv-bar-scores` from the Tier-2 E2E synthetic-workspace output (the seeder already runs locally, per PRs #272/#274/#275) and assert detectors fire on known-planted patterns. This validates the pipeline end-to-end now, so day one of real data isn't also day one of debugging the detectors.
5. **Add per-orchestrator success/cost telemetry to the stamp payload, and report spend in every PR body.** `findFailedOrchestrators` and `analyzeModelEfficiency` already expect orchestrator/model dimensions the current payload only partially carries; extend the stamp with orchestrator id + outcome + tier at the call site. Cultural half: every wave PR states its estimated spend (this one does, below) so cost visibility doesn't wait on the automated pipe.

## Top 3 investments

1. **Schema + strict validator for `memory/data/`, CI-enforced.** Zod (or JSON Schema) definitions per file, a validation script in CI, and a lint/gate that fails any commit writing these files outside the Librarian/append-only contracts. Turns the write contract from README prose into something a concurrent fleet can't violate — prerequisite for trusting any number the BI ever reports.
2. **Product-analytics lite for Plaino usage.** A minimal event layer (PostHog self-hosted or an equivalent thin homegrown table — must respect the two-bucket data positioning and the model-vendor-invisible rule) capturing activation, approval latency, connector connect/disconnect, workflow runs per vertical. This is the entire missing "customer" half of data/analytics (friction #8): pricing, tier design, and the per-vertical KPI dashboard all currently run on zero measured usage.
3. **Kaizen loop V2: self-healing data gaps.** When `dataGaps` is non-empty, the retro's first output becomes an auto-generated repair item filed to the audit queue (e.g. "backfill session-costs from PR metadata + scheduled-task lastRunAt; verify stamp call sites"), not just a paragraph Conner reads. A measurement system that can only complain about missing data stays broken; one that files its own repair work converges. Pairs with a scheduled-task meta-monitor so a missed cron slot (friction #6) also becomes a filed item.

---

## Corrections to the brief (do-not-fabricate ledger)

- "Insight library (from #300 kaizen)": **does not exist.** PR #300 is `feat(guarantee): time-savings tracking + Day 7 walk-away offer + auto-refund`. No insight-library files anywhere on main. The kaizen work is PR #273.
- "50+ pattern detectors": **actual count is 7 detector families** (plus helpers) in `lib/kaizen/pattern-detectors.ts`.
- Memory files `project_agentplain_operating_system_greenlight_2026_06_15` and `feedback_ai_cost_architecture_rules` named in the brief **do not exist** in the memory index; the operating-system spec was read via `docs/specs/AGENTPLAIN_OPERATING_SYSTEM_2026_06_15.md` references in the charter instead.
- "Session-cost-stamp hook planned but never wired": **confirmed true** against origin/main (zero call sites) — this one survives verification and is friction #1.

## Spend (this session)

Per I-11 discipline: this session has **no authoritative token counter available from inside the harness** — the exact gap friction #1 describes, now experienced firsthand. Characterization, flagged as an estimate: a single Fable session, ~25 tool calls, dominated by file reads and greps plus one offline CLI run, no subagents, no API spend (retro script is offline). Estimated single-digit dollars; harness-side billing is the source of truth. This line exists so the next retro can compare an estimate to a measured number once improvement #1 lands.
