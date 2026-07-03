# Customer-journey loop — RUNBOOK

How to run, conduct, kill, and pay for the loop. Internal doc.
Cadence model (2026-07-02 v2): **continuous L1+L2 Fable passes until
2026-07-07, conducted by a 30-minute Haiku governor.** No weekly cron
anywhere. Rationale: Fable is included in the MAX plan window until Jul 7
(`reference_claude_fable_5_back_2026_06_28`); the loop burns that window
back-to-back, then stops.

## The layers at a glance

| Layer | Model | Cadence | Reads | Writes |
|---|---|---|---|---|
| L1 journey-mapper | claude-fable-5 (until Jul 7) | continuous — fired by governor, one pass at a time | repo + memory + existing maps + corrective_nudges | `docs/journeys/<date>/` (or in-place deepening) |
| L2 profitability lens | claude-fable-5 (until Jul 7) | same pass, after L1 | L1 output + billing facts | `docs/profitability/<date>/`, backlog cards, state.yaml pass close-out |
| L3 governor | claude-haiku-4-5 | every 30 min (~48 ticks/day) | state.yaml + dispatch session list | state.yaml (ticks, gates, nudges), fires/stops passes, one WORKING_STATE pause note |

A **pass** = one Fable code session running L1 then L2 for the scope at the
head of `queue` in `memory/data/loop/state.yaml`. Passes never self-chain —
only the governor fires them, one at a time.

## Scheduled task: the governor (the only cron in the system)

Drop into `create_scheduled_task`:

```json
{
  "name": "agentplain-loop-governor",
  "schedule": "*/30 * * * *",
  "timezone": "UTC",
  "cwd": "C:\\agentplain",
  "model": "claude-haiku-4-5",
  "prompt": "You are the loop governor. Execute docs/loop/prompts/L3-haiku-heartbeat.md exactly — read it, then follow its decision tree top to bottom, first matching branch only. Work against memory/data/loop/state.yaml on a fresh pull of main. Commit state.yaml changes directly to main with message 'loop: governor tick'.",
  "allowed_tools": ["Read", "Edit", "Write", "Bash", "list_code_tasks", "start_code_task", "stop_code_task"],
  "max_runtime_minutes": 10
}
```

Notes: the tool names in `allowed_tools` map to whatever the dispatch runner
exposes for session list / launch / stop — keep the trio, rename to the
runner's actual identifiers. The governor is safe to double-fire (STEP 1
reconciliation makes ticks idempotent); it is NOT safe to run two governors
concurrently — one scheduled task only.

There is **no scheduled task for L1/L2** — the governor fires passes the
moment the previous one completes (checked every tick), which in practice
means a new Fable pass roughly every 1–3 hours depending on pass runtime, and
a stall-replacement at 4h guaranteed by the governor's STEP 1b.

## Manual-fire recipe (hand-trigger the next pass)

From `C:\agentplain` (or a fresh worktree per the parallel-waves recipe):

1. Read `memory/data/loop/state.yaml` → note `queue[0]` (pass N, scope) and
   any `corrective_nudges` with `status: pending`.
2. Confirm nothing is in flight: `pass_in_flight_session_id: null` (if not
   null and stale, clear it — you are doing the governor's 1b by hand).
3. Start a Fable code session with exactly the governor's launch prompt:
   > Run loop pass {N}: {scope}. Follow docs/loop/prompts/L1-journey-mapper.md
   > then docs/loop/prompts/L2-profitability-lens.md. Before beginning, read
   > memory/data/loop/state.yaml and address every pending corrective_nudges
   > entry, marking each consumed. Pending nudges: {notes or "none"}. On
   > completion update state.yaml per the pass-writer rules in
   > memory/data/loop/schema.yaml, run npm run voice-gate on your files, and
   > commit directly to main (allowed paths only: docs/journeys/,
   > docs/profitability/, docs/loop/backlog/, memory/data/loop/) with message
   > "loop: pass {N} — {scope-short}". Push. Do not open a PR.
4. If the governor task is live, set `pass_in_flight_session_id` to your
   session id so the next tick doesn't double-fire; if it isn't, quality-gate
   the output yourself against the checklist in the L3 prompt.

## Queue algorithm (how the loop decides what's next)

Encoded in `00-DESIGN.md` § Queue algorithm; summary: greedy on the biggest
unmapped area (whole vertical > missing persona) until every `coverage_map`
cell has `depth ≥ 1`, then rotate to deepening in descending
`open_gap_count / depth` order, refreshing the stalest map on ties. The
finishing L2 stage appends the computed next entries to the queue tail; the
governor only pops heads. Seeded sequence: pass 2 = law + property-management,
pass 3 = general + deepen real-estate--individual-agent, pass 4 = deepen cpa.

## Stopping condition — 2026-07-07

`stop_after: 2026-07-07T00:00:00Z` in state.yaml. From that tick on, the
governor fires nothing, posts one pause note to `memory/WORKING_STATE.md`,
and keeps ticking cheaply (metrics only). **Do not edit `stop_after` without
Conner's call.**

### After Jul 7 (the transition decision)

Options, in recommended order:
1. **On-demand only** (default): keep the governor (it costs almost nothing
   and keeps state reconciled); fire passes by the manual recipe when a big
   product change or new audit lands. Cost: per-pass at then-current rates.
2. **Step down to Opus 4.8 continuous**: change the model in the pass launch
   prompt to `claude-opus-4-8` and clear/extend `stop_after`. Opus rates are
   $5/$25 per MTok (half of Fable) → roughly $1.30–1.70 per journey map,
   $0.80–1.10 per L2 vertical; a continuous ~10-pass/day loop ≈ $25–40/day —
   only worth it if the fleet is actually consuming the backlog cards faster
   than weekly.
3. **Stop entirely**: delete the governor task; the maps stay useful as
   static artifacts and can be revived any time.

## Kill switch

1. **Delete (or pause) the `agentplain-loop-governor` scheduled task** — the
   whole loop stops: no conductor, no passes. This is the primary switch.
2. In-flight pass: send its session a stop message (or let it finish — it
   can't fire a successor).
3. Belt-and-braces: set `stop_after` in state.yaml to a past datetime — a
   still-scheduled governor then refuses to fire (STEP 2).
There is no runtime component; killing the loop cannot affect the product.

## Cost

- **L1+L2 passes until Jul 7: $0 marginal** — plan-included Fable window
  (that's the whole point of the continuous cadence). Token-equivalent value
  for calibration: ~$2.50–3.25 per map + ~$1.50–2.10 per L2 vertical at
  Fable card rates ($10/$50 per MTok).
- **Governor**: ~48 ticks/day; each tick reads state.yaml + session list and
  writes a few lines (~5–15k in / <1k out on Haiku at $1/$5 per MTok) →
  **well under $1/day**, ~$15–20/month worst case with quality-gate ticks.
- Sanity caps: a pass emitting >100k output tokens or a governor tick that
  wants to read journey files wholesale is misbehaving — kill and inspect.

## Failure modes (delta from 00-DESIGN.md table)

- Governor task itself skipped/dead → passes stop being fired; detection is
  the same staleness check as before: `last_tick_at` older than ~2h means the
  conductor is down (precedent: weekly kaizen skipped 2026-06-28 unnoticed —
  check `last_tick_at` when in doubt).
- Two passes racing (double-fire) → prevented by STEP 1 reconciliation +
  single-governor rule; if it happens anyway both push docs-only commits —
  worst case is a state.yaml push race, and the loser's pass gets re-gated
  from its files, no data loss.
- Direct-to-main discipline → passes commit ONLY under docs/journeys/,
  docs/profitability/, docs/loop/backlog/, memory/data/loop/ (all inert:
  never built, never shipped to a customer surface) and voice-gate first.
  A bad pass is a `git revert` + governor re-queue — cheap by design. The
  system's own docs/prompts/schema still change via reviewed PRs like this
  one.
