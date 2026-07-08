# Pattern: heartbeat governor as conductor (not a worker)

**Group:** fleet-ops · **Seeded by:** `docs/loop/prompts/L3-haiku-heartbeat.md`, `docs/loop/00-DESIGN.md`; memory: project_loop_v3_nine_tracks_2026_07_03, project_dept_fleet_ops_head_2026_07_03 ("governor NEVER scheduled — #349 dormant").

## When to use — trigger phrases
- "design the loop conductor / heartbeat"
- "who fires the next pass" / "how do we detect a stalled pass"
- any system that must schedule other agents on a cadence

## Inputs
- The track roster + weights, the state store (`state.yaml`), the tick cadence (30 min).

## Procedure — the conductor's three steps every tick
1. **Reconcile the in-flight pass**: is one running? Past the 4h timeout? Stalled? On completion, apply the quality gate; on stall/drift, write a `corrective_nudge` for that track's next fire.
2. **Fire the next pass** by weighted rotation: CEO is an always-queued invariant; apply the freshness cap (eligible if last-fired ≥6h ago or never); handle idle/empty branches deterministically.
3. **Write tick metrics**: update `last_tick_at`, record the tick.

## Output
A cheap, deterministic scheduler that keeps exactly one worker moving and never designs anything itself.

## Guardrails
- **The conductor conducts; it does not do track work.** Keep it a state machine. Worker design belongs to L1/L2/etc. (Opus); the conductor can stay cheap (Haiku).
- **It must actually be scheduled.** The recurring, embarrassing failure: the governor is *designed* but left *unscheduled* (#349 dormant) — a conductor that never ticks does nothing. Verify the schedule exists and fires.
- **Deterministic branching only** — no creative latitude in the conductor. Same state in → same decision out (resume-safe).
- **Cold-start-safe** — read `state.yaml` every tick; never rely on in-memory state surviving between ticks.
- Silence must be safe: if there's nothing eligible to fire, the idle branch is explicit, not a crash.

## Worked example
L3 (`docs/loop/prompts/L3-haiku-heartbeat.md`) is exactly this: a 30-minute state machine that reconciles → fires-by-weight → ticks, with the CEO track as an invariant and a 6h freshness cap. Its standing risk — recorded across multiple fleet-ops memories — is that the schedule was never wired, so the whole loop sat dormant. Design the conductor *and* confirm it's on a cron.
