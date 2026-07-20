# Design-for-profit loop — RUNBOOK

How to run, conduct, kill, and pay for the loop. Internal doc.
Cadence model (2026-07-03 v3): **continuous multi-track passes, non-stop,
conducted by a 30-minute Haiku governor.** Nine tracks share one queue by
weighted rotation. **Profitability is the loop's objective, not its stop
condition** — every pass must end in a design decision, a merge-ready fix
spec, or a specific action that makes the business more profitable; the loop
itself never stops. There is no calendar stop either: `pass_model` is a knob,
not a stop. Model routing per the 2026-07-19 ratified plan
(`project_model_routing_plan_2026_07_19`): Fable (`claude-fable-5`) for
passes, Haiku for governor ticks, Sonnet for mechanical between-pass steps.
No weekly cron anywhere.

## The layers at a glance

| Layer | Model | Cadence | Reads | Writes |
|---|---|---|---|---|
| Track passes (9 lenses — `docs/loop/prompts/TRACKS.md`) | `pass_model` in state.yaml (claude-fable-5 today) | continuous — fired by governor, one pass at a time, weighted rotation | repo + memory + other tracks' outputs + corrective_nudges | each track's allowed doc paths + state close-out incl. declared deliverables |
| L3 governor | claude-haiku-4-5 | every 30 min (~48 ticks/day) | state.yaml + dispatch session list | state.yaml (ticks, gates, nudges), fires/stops passes |

A **pass** = one code session running one track's lens for the chosen queue
item (l1-journey passes run L1 then L2 back-to-back). Passes never
self-chain — only the governor fires them, one at a time.

## The objective: design for profitable

Every pass optimizes the same objective — make the design of the business
more profitable — and proves it with a declared deliverable in
`last_pass_deliverables`: a **design decision**, a **fix spec**, or an
**action** (definitions in TRACKS.md). The governor's PRIMARY quality gate
checks this; a pass that ends in analysis with no deliverable is gated
`drift` and the track inherits a corrective nudge. The CEO track owns the
working definition of "profitable" (Pass 1: cash-breakeven at 3–9 customers;
~$10K MRR ≈ founder-inclusive profitability) and refines it with evidence.
No new analysis layers, ever: the 2026-07-02 audits, kaizens, and deep-dives
are the evidence base — passes consume them and design from them.

## The nine tracks and their rotation weights

Definitions in `docs/loop/prompts/TRACKS.md`; the governor's fixed 20-slot
cycle encodes the weights (see L3 prompt STEP 2b):

| # | Track | Weight | Slots/20 | Lens in one line |
|---|---|---|---|---|
| 1 | `ceo` | 20% | 4 | design the shortest path to a profitable business (perpetual queue item) |
| 2 | `chief-of-staff` | 15% | 3 | design the execution sequence: blockers, redundancy, Conner decision queue |
| 3 | `product-owner` | 15% | 3 | design each product piece to be profitable |
| 4 | `l1-journey` | 15% | 3 | design the journey the customer would pay for (wants → verdicts) |
| 5 | `l2-profitability` | 10% | 2 | design the margin: per want — cost, price capture, classification |
| 6 | `tab-audit` | 10% | 2 | design every route to earn its place: keep / fix / merge / delete |
| 7 | `agent-audit` | 5% | 1 | design a fleet that pays for itself: keep / fix / retire per agent |
| 8 | `business-model` | 5% | 1 | design the pricing that captures the value (facts.ts proposals ONLY, never edits) |
| 9 | `vertical-priority` | 5% | 1 | design where the focus goes: double down / hold / cut |

**Freshness cap:** a track whose last pass finished < 6h ago is skipped in
the rotation scan — no lens monopolizes the loop even when its slots come up.
**Per-track queue cap:** 5 open items; passes append follow-ups to their own
track only. **CEO invariant:** the ceo item is perpetual — re-enqueued by
each CEO pass, re-seeded by the governor if ever missing.

## Ratified decisions the loop must respect (do not re-propose)

- **CEO kill list ratified by delegation (Conner, 2026-07-03):**
  `docs/ceo/2026-07-02/03-what-CEO-would-cut.md` stands; the FLEET decides
  which kills to execute (a separate PR handles execution). Loop passes may
  extend the kill list with new evidence but must not re-litigate items on
  it, and must not duplicate the execution work.
- **flatsbo stays live (Conner ruling, 2026-07-03):** the planning
  direction-check's "waitlist-dark flatsbo" recommendation is OVERRIDDEN.
  No track may re-propose darkening, pausing, or deprioritizing flatsbo —
  treat it as settled unless Conner reopens it.

## Scheduled task: the governor (the only cron in the system)

Drop into `create_scheduled_task`:

```json
{
  "name": "agentplain-loop-governor",
  "schedule": "*/30 * * * *",
  "timezone": "UTC",
  "cwd": "C:\\agentplain",
  "model": "claude-haiku-4-5-20251001",
  "prompt": "You are the loop governor. Execute docs/loop/prompts/L3-haiku-heartbeat.md exactly — read it, then follow its decision tree top to bottom, first matching branch only. Work against memory/data/loop/state.yaml (schema v3) on a fresh pull of main. The loop runs forever — it has no stop condition; profitability is the objective passes design toward, not a gate, and pausing is Conner's operator action, never yours. Launch passes on the model named by pass_model in state.yaml. Commit state.yaml changes directly to main with message 'loop: governor tick'.",
  "allowed_tools": ["Read", "Edit", "Write", "Bash", "list_code_tasks", "start_code_task", "stop_code_task"],
  "max_runtime_minutes": 10
}
```

Notes: the tool names in `allowed_tools` map to whatever the dispatch runner
exposes for session list / launch / stop — keep the trio, rename to the
runner's actual identifiers. The governor is safe to double-fire (STEP 1
reconciliation makes ticks idempotent); it is NOT safe to run two governors
concurrently — one scheduled task only.

There is **no scheduled task for any track** — the governor fires the next
rotation pick the moment the previous pass completes (checked every tick),
which in practice means a new pass roughly every 1–3 hours depending on pass
runtime, and a stall-replacement at 4h guaranteed by the governor's STEP 1b.

## Manual-fire recipe (hand-trigger the next pass)

From `C:\agentplain` (or a fresh worktree per the parallel-waves recipe):

1. Read `memory/data/loop/state.yaml` → run the rotation by hand: from
   `rotation_cursor + 1`, first track that is unpaused, has a queue item, and
   is ≥ 6h fresh; take that track's first item. Note pending
   `corrective_nudges` targeting it or `all`.
2. Confirm nothing is in flight: `pass_in_flight_session_id: null` (if not
   null and stale, clear it — you are doing the governor's 1b by hand).
3. Start a code session on `pass_model` with exactly the governor's STEP 2c
   launch prompt (fill in pass number, track, scope, nudges).
4. If the governor task is live, set `pass_in_flight_session_id` to your
   session id so the next tick doesn't double-fire; if it isn't, quality-gate
   the output yourself against the gate in the L3 prompt (deliverable gate
   first, then full gate for l1-journey/l2-profitability or light gate
   otherwise) and advance `rotation_cursor` to the slot you used.

## Queue algorithm (how the loop decides what's next)

Track choice: the governor's fixed 20-slot weighted rotation (above).
Within `l1-journey`: coverage-greedy then depth, per `00-DESIGN.md` § Queue
algorithm — unchanged. Within every other track: items ordered by
`priority`; the finishing pass appends its own follow-ups (cap 5) and the
seeded items in state.yaml carry the initial priorities. Saturation valve:
a track that finds nothing new leaves its queue empty rather than inventing
work; the rotation simply skips it until a pass on another track (usually
CEO or chief-of-staff) files new items for it via `corrective_nudges` or its
own follow-up rights.

## Model routing (updated 2026-07-19 — still a knob, not a stop)

Ratified 2026-07-19 (`project_model_routing_plan_2026_07_19` +
`feedback_fable_is_max_default_2026_07_19`): Fable is Max-plan-included at
50% share — no longer scarce. The Jul-7 window-close contingency this section
used to plan for is retired. The routing:

- **Track passes:** `pass_model: claude-fable-5` — every pass is judgment
  work (design decisions, fix specs), which routes to Fable by default.
- **Governor ticks:** `claude-haiku-4-5-20251001` — deterministic branching,
  triage tier.
- **Mechanical between-pass steps** run outside the loop (merging pass
  output, state repairs, config fixes): `claude-sonnet-5`.
- **Opus 4.8** only for genuinely 1M-context passes or Fable-unavailable
  fallback — rare.

The knob semantics are unchanged — `pass_model` in state.yaml takes any model
id and the governor reads it on the next fire. The two throttle moves below
remain valid **operator** options if Conner ever wants to cut spend, but the
default is Fable; downgrading on your own initiative to save a resource that
is no longer scarce is exactly what the routing plan bans:

- **Option A — switch the fleet model:** set `pass_model:
  claude-opus-4-8` in state.yaml (one line; the governor reads it on the
  next fire). Opus rates are $5/$25 per MTok (half of Fable) → roughly
  $1.30–1.70 per journey map, $0.80–1.10 per L2 vertical at the v2
  calibration; a continuous ~10-pass/day loop ≈ $25–40/day. Any cheaper
  model that meets the quality gate is equally legal — the knob takes any
  model id.
- **Option B — narrow the loop to the strategic tracks:** set
  `paused: true` on tracks 4–9 (`l1-journey`, `l2-profitability`,
  `tab-audit`, `agent-audit`, `business-model`, `vertical-priority`) in
  `tracks`, keep `ceo` + `chief-of-staff` live, and set `pass_model:
  claude-opus-4-8`. The rotation then only ever lands on the two strategic
  lenses (~7 slots of 20 → in practice every eligible fire alternates
  between them under the 6h freshness cap ≈ 2–4 passes/day) — strategy stays
  fresh at a few dollars a day while the mapping tracks hibernate with their
  queues intact. Un-pause any track to resume it; nothing is lost.

Both options are reversible edits to state.yaml only, and both are Conner's
moves — the loop itself never downgrades its own model.

## Operator controls (Conner only — the loop never stops itself)

The loop's own logic has no stop, pause, or throttle branch. The controls
are operator actions:

1. **Delete (or pause) the `agentplain-loop-governor` scheduled task** — the
   whole loop stops: no conductor, no passes. This is the primary switch.
2. In-flight pass: send its session a stop message (or let it finish — it
   can't fire a successor).
3. Scalpel version: `paused: true` per track in state.yaml pauses just that
   lens; the rotation skips it, its queue keeps.
4. Throttle: use per-track pauses or a cheaper `pass_model` — pass rate is
   bounded by pass runtime, so slowing the tick only slows stall recovery.
There is no runtime component; stopping the loop cannot affect the product.

## Cost

- **Track passes: plan-included** — Fable is Max-plan-included at 50% share
  (2026-07-19, `feedback_fable_is_max_default_2026_07_19`).
  Token-equivalent value for calibration: ~$2.50–3.25 per journey map +
  ~$1.50–2.10 per L2 vertical at Fable card rates ($10/$50 per MTok); the
  new lens tracks (CEO, CoS, product-owner, tab/agent audits, business-model,
  vertical-priority) read more than they write and should land at or under
  the L2 shape. No measured per-pass numbers exist yet for the new tracks —
  the first week of `pass_records` is the calibration artifact.
- **Governor**: ~48 ticks/day; each tick reads state.yaml + session list and
  writes a few lines (~5–15k in / <1k out on Haiku at $1/$5 per MTok) →
  **well under $1/day**, ~$15–20/month worst case with quality-gate ticks.
- **If throttled** (operator choice only, per the Model routing section):
  ~$25–40/day for the full 9-track loop on Opus, a few dollars a day for
  Option B's strategic-only mode.
- Sanity caps: a pass emitting >100k output tokens or a governor tick that
  wants to read content files wholesale is misbehaving — kill and inspect.

## Failure modes (delta from 00-DESIGN.md table)

- Governor task itself skipped/dead → passes stop being fired; detection is
  the same staleness check as before: `last_tick_at` older than ~2h means the
  conductor is down (precedent: weekly kaizen skipped 2026-06-28 unnoticed —
  check `last_tick_at` when in doubt).
- Two passes racing (double-fire) → prevented by STEP 1 reconciliation +
  single-governor rule; if it happens anyway both push docs-only commits —
  worst case is a state.yaml push race, and the loser's pass gets re-gated
  from its files, no data loss.
- **Analysis drift (the failure this v3 amendment exists to prevent)** — a
  pass produces another audit/retro/synthesis instead of a deliverable →
  caught mechanically by the `deliverable_ok` gate → verdict `drift` +
  corrective nudge; repeated drift on one track is a prompt problem — fix
  TRACKS.md via a reviewed PR, don't nudge forever.
- A track starves (always fresh-capped or empty when its slot comes up) →
  visible as `passes_completed` flat-lining in `tracks`; the CEO pass reads
  that table and files a nudge — starvation is a strategy signal, not a bug.
- Business-model pass edits `lib/billing/facts.ts` → light gate `paths_ok`
  check makes it an automatic `rejected` + revert; facts.ts stays SSOT.
- Direct-to-main discipline → passes commit ONLY under their track's allowed
  paths (TRACKS.md table — all inert: never built, never shipped to a
  customer surface) + memory/data/loop/, voice-gate first. A bad pass is a
  `git revert` + governor re-queue — cheap by design. The system's own
  docs/prompts/schema still change via reviewed PRs like this one.
