# Customer-journey loop — RUNBOOK

How to run, schedule, kill, and pay for the three-layer loop. Internal doc.

## The three layers at a glance

| Layer | Model | Cadence | Reads | Writes |
|---|---|---|---|---|
| L1 journey-mapper | claude-fable-5 | Sun, weekly | repo + memory + last week's maps | `docs/journeys/<date>/` |
| L2 profitability lens | claude-fable-5 | Sun, after L1 | L1 output + billing facts | `docs/profitability/<date>/` |
| L3 heartbeat | claude-haiku-4-5 | daily 02:00 ET | latest L1+L2 + state | backlog cards, `WORKING_STATE.md`, `state.yaml`, occasional docs-only PRs |

## Manual triggers

All layers are ordinary Claude Code sessions run against a worktree of main
(worktree + junction recipe: `feedback_parallel_waves_use_worktrees`).

- **L1:** open a session, paste `docs/loop/prompts/L1-journey-mapper.md` with
  `{VERTICAL}` and `{PERSONA_SLUG}` filled in, one session per persona. Sessions
  are independent — run in parallel worktrees if landing same-day.
- **L2:** after all L1 files for a vertical exist, paste
  `docs/loop/prompts/L2-profitability-lens.md` with `{VERTICAL}` + `{RUN_DATE}`.
- **L3:** paste `docs/loop/prompts/L3-haiku-heartbeat.md` into a **Haiku**
  session; the runner must include the list of open fleet PR titles
  (`gh pr list --state open --json title` or the REST equivalent via
  `mint-fleet-token.mjs`) since the prompt forbids the model from fetching them.
- Landing output: branch `loop/<date>-<layer>`, push via
  `node scripts/mint-fleet-token.mjs` + REST PR (recipe:
  `project_fleet_push_pr_mechanism`).

## Scheduling

- **L1+L2:** one weekly scheduled task, Sundays (suggested 06:00 ET), chained:
  L1 for every vertical×persona, then L2 per vertical, then one PR with the
  whole run. Skip a vertical if its registry entry is unchanged AND last week's
  map had zero verdict changes — note the skip in the PR body, never silently.
- **L3:** daily 02:00 ET scheduled task using the exact prompt file. Cron note:
  02:00 ET is inside the DST danger window — schedule as 07:00 UTC to avoid
  skipped/double fires.

## Kill switch

Three levels, cheapest first:
1. **Pause the schedule** (both tasks) — nothing else needed; the system is
   pull-based and stateless between runs.
2. **`memory/data/loop/state.yaml` → set `schema_version: 0`** — any L3 run
   that still fires refuses to act (the prompt's version check) and defers.
3. **Delete `docs/loop/prompts/`** on a branch — no prompts, no runs.
There is no runtime component; killing the loop cannot affect the product.

## Cost per run (claude-api pricing, 2026-06 card: Fable $10/$50 per MTok, Haiku $1/$5; cache reads ~0.1×)

**L1, per vertical×persona map:** ~150–250k input tokens (registry, audits,
prior map; largely cacheable within a run), ~10–15k output.
≈ $2.00–2.50 input + $0.50–0.75 output → **~$2.50–3.25 per map**.
Current roster ≈ 7 maps (5 verticals, 2 personas for the two big ones) →
**~$18–23 per weekly L1 pass**.

**L2, per vertical:** ~80–120k input, ~8–12k output → **~$1.50–2.10**;
5 verticals → **~$8–11 per weekly L2 pass**.

**Weekly Fable total: roughly $26–34.** Worst case (nothing caches, verbose
maps) ~$50. Cap: if a single map exceeds ~$5 of output (≈100k output tokens)
something is wrong — kill and inspect.

**L3 nightly Haiku:** ~30–50k input ($0.03–0.05), ~2–4k output ($0.01–0.02) →
**~$0.05–0.10 per night, ~$2–3/month**. If a nightly run costs more than ~$0.25
it is reading too much — the prompt limits inputs deliberately.

**System total: ~$120–160/month**, dominated by the weekly Fable pass.

## Failure modes (summary — full table in 00-DESIGN.md)

- L1 misses a Sunday → L3 keeps working off the previous week (run_date is
  explicit); `consecutive_empty_runs` flags staleness at 7.
- L3 opens a bad docs PR → it is ready-for-review, never auto-merge; voice-gate
  + brand-gate run in CI; revert is one click.
- Schema drift → bump `schema_version` in schema.yaml AND the prompts in the
  same PR; L3 defers on any mismatch rather than guessing.
