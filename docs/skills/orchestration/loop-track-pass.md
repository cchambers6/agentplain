# Loop track pass — L1 / L2 (and the L3 governor) template

**Domain:** orchestration · **Kind:** ready-to-paste track prompt · **Seeded by:** `docs/loop/00-DESIGN.md`, `docs/loop/RUNBOOK.md`, `docs/loop/prompts/{TRACKS.md,L1-journey-mapper.md,L2-profitability-lens.md,L3-haiku-heartbeat.md}`, `docs/loop/templates/{journey.md,profitability.md}`. Loop v3 = design FOR profitable, no stop condition (memory: project_loop_v3_nine_tracks_2026_07_03).

## The system in one paragraph

Loop v3 is a **9-track weighted rotation** driven by a 30-minute **heartbeat governor** (L3). Every worker pass reads `memory/data/loop/state.yaml` (schema v3), consumes any `corrective_nudge` aimed at its track, does one increment of design work, and closes the state with a declared deliverable. The 20-slot weighted cycle: CEO 20% · Chief-of-Staff 15% · Product-Owner 15% · L1-Journey 15% · L2-Profitability 10% · Tab-Audit 10% · Agent-Audit 5% · Business-Model 5% · Vertical-Priority 5%.

## When to use — trigger phrases

- "run an L1 journey-mapper pass" / "map the {vertical} journey"
- "run an L2 profitability-lens pass" / "is this track pulling toward profit"
- "fire the next loop track" / "advance the loop"

## Inputs (per track)

- `{TRACK}` — L1-Journey | L2-Profitability | (CEO/CoS/Product-Owner/Tab-Audit/Agent-Audit/Business-Model/Vertical-Priority).
- `{SCOPE}` — the queue item the governor assigned (a vertical + persona for L1; a workstream for L2).
- `{STATE}` — `memory/data/loop/state.yaml`, schema v3 (source of truth; read on every fire — cold-start-safe).
- The **ratified-frame preamble** (`../governance/ratified-frame-preamble.md`).

## The worker-track template (paste, fill the {braces})

```md
{{RATIFIED-FRAME-PREAMBLE}}

# Loop v3 — you are the {TRACK} track. Assigned scope: {SCOPE}.

## Hard skeleton (do all five, in order)
1. Read memory/data/loop/state.yaml (schema v3). Confirm your assigned scope matches the queue item.
2. Address every `corrective_nudge` targeting {TRACK}; mark each `status: consumed`.
3. Do ONE increment of design work for {TRACK} (see template below). No new analysis layer.
4. Close state.yaml per pass-writer rules:
   - remove your queue item; stamp `last_completed_at`; increment `pass_number`;
   - write `last_pass_deliverables` as [{type, ref}] where type ∈ {design-decision, fix-spec, action};
   - append ≤5 follow-up items for your track.
   Every pass MUST end with ≥1 deliverable, else you are marked `drift` and inherit a corrective nudge.
5. Run `npm run voice-gate`. Commit to main: `loop: pass {N} [{TRACK}] — {scope-short}`.

## Track-specific work
- **L1-Journey** → write per docs/loop/templates/journey.md:
  Persona (one para, every claim cited or `persona_source` set) → stage map
  (Awareness→Consideration→Signup→Activation→Daily-Use→Expansion→Renewal→Advocacy, one ### each) →
  micro-moment table per stage: | Want | Signal | Delivering? (yes/partial/no/not-in-scope) |
  Evidence (code path / doc / `gap: {what's missing}`) | → YAML machine block
  {vertical, persona, persona_source, run_date, produced_by, stages[]} → cross-vertical clusters.
- **L2-Profitability** → write per docs/loop/templates/profitability.md: take one workstream, trace it
  to gross-margin impact, and emit a design-decision that raises contribution or cuts cost-to-serve.

## Output discipline
- Deliverables declared in `last_pass_deliverables` ({type, ref}) — no analysis-only passes.
- Every claim cited or marked `todo-real-signal`. Truth Wave.
```

## The L3 heartbeat governor (conductor, not worker)

L3 (`docs/loop/prompts/L3-haiku-heartbeat.md`) runs every 30 min as a **deterministic state machine** — it schedules, it does not design. Keep it cheap (Haiku is fine for the conductor; worker tracks run Opus per the back-to-opus default). Its three steps:

1. **Reconcile the in-flight pass** — 4h timeout, stall detection, quality gate on completion; a stalled or drift pass gets a `corrective_nudge` for the next fire of that track.
2. **Fire the next pass** by weighted rotation — CEO is an invariant that's always queued; apply the freshness cap (a track is eligible if last fired ≥6h ago or never); handle idle/empty branches.
3. **Write tick metrics** — update `last_tick_at`, record the tick.

See `../patterns/heartbeat-governor-conductor.md` for the conductor-not-worker rule in full.

## Guardrails

- **Read state on every fire (cold-start-safe).** Never assume in-memory state survived; `state.yaml` is the only truth. [feedback_cold_start_safe_agents]
- **No stop condition, no milestone field.** Loop v3 removed the milestone field on purpose — do not reintroduce it. Design continues toward profitable indefinitely. [project_loop_v3_nine_tracks_2026_07_03]
- **Every pass ships a deliverable or it's drift.** Analysis-only passes are the failure mode the corrective-nudge machinery exists to punish.
- **Governor schedules, workers design.** Don't let L3 do track work; don't let a worker re-pick its own scope (the governor assigns it).
- **The governor task must actually be scheduled.** Standing risk (memory, repeated): the governor is designed but was left *unscheduled* (#349 dormant). A designed conductor that never fires does nothing — verify the schedule exists.

## Worked example

L1 in the 2026-07-02 journeys pass mapped the RE persona and surfaced that the first-value path dies at the Connect button (memory: project_journey_loop_system). L2 profitability passes trace a workstream to margin; the ratified RE killer workflow — after-hours lead-triage with TTFDV ≤5 min (memory: PR #359) — is the kind of design-decision an L1/L2 pair converges on and hands to the Product-Owner track.
