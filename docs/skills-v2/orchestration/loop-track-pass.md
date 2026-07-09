# Loop track pass — worker template (L1 / L2) + governor pointers

**Kind:** ready-to-paste track prompt · **Canonical skills:** [`../cowork/orchestration/loop-track-pass/SKILL.md`](../cowork/orchestration/loop-track-pass/SKILL.md) (worker), [`../cowork/fleet-ops/heartbeat-governor/SKILL.md`](../cowork/fleet-ops/heartbeat-governor/SKILL.md) (conductor) · **Seeded by:** `docs/loop/00-DESIGN.md`, `docs/loop/RUNBOOK.md`, `docs/loop/prompts/*`, `docs/loop/templates/*`.

```md
{{RATIFIED-FRAME-PREAMBLE}}

# Loop — you are the {TRACK} track. Assigned scope: {SCOPE}. Pending nudges: {verbatim, or "none"}.
Design this piece to be profitable. DESIGN — not audit, not assess, not analyze.

## Hard skeleton (all five, in order)
1. Read memory/data/loop/state.yaml (schema-versioned). Confirm scope matches the queue item.
2. Address every corrective_nudges entry targeting {TRACK}; apply throughout; mark status: consumed.
3. ONE increment of design work (track shape below). No new analysis layer.
4. Close state.yaml: remove the queue item; stamp last_completed_at; increment pass_number;
   write last_pass_deliverables as [{type: design-decision|fix-spec|action, ref}]; ≤5 follow-ups.
   A pass with no typed deliverable is drift and inherits a nudge.
5. npm run voice-gate. Commit docs-only, DIRECTLY to main, allowed paths ONLY
   (docs/journeys/ docs/profitability/ docs/loop/backlog/ memory/data/loop/),
   message: "loop: pass {N} [{TRACK}] — {scope-short}". Push. No PR.

## Track shapes
- L1 journey-mapper (docs/loop/templates/journey.md): persona (every claim cited or
  persona_source set) → 8-stage map → per-stage table | Want | Signal | Delivering? | Evidence/gap |
  in CUSTOMER VOCABULARY (Setting up / Working / Watching — never cron/webhook/RLS) →
  machine yaml block (THE contract; make the prose agree with it) → cross-vertical clusters.
  "delivering: yes" requires an opened code path. Verdict against the DEGRADED experience too —
  the paused prod key is a live experience, not an edge case.
- L2 profitability-lens (docs/loop/templates/profitability.md): one workstream traced to
  gross-margin impact → a design decision that raises contribution or cuts cost-to-serve.
```

**Load-bearing reminders (from the design doc, verbatim-grade):**
- No stop condition, no milestone field — "design it to be profitable, not design until it is profitable." Do not reintroduce the field.
- The governor never parses prose — its gate is mechanical (parse, count, grep, voice-gate). Ship a valid yaml block or get rejected.
- One governor only; 4h stall presumption; nudges are the only feedback channel; recovery for a bad pass is `git revert` + re-queue.
- Before calling the loop live at all: the three liveness checks (scheduled · can-dispatch · feeder-fresh) in [`../cowork/fleet-ops/scheduled-task-liveness/SKILL.md`](../cowork/fleet-ops/scheduled-task-liveness/SKILL.md).
