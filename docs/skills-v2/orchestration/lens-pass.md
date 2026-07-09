# Lens pass — CEO / Chief-of-Staff / direction-check, ready-to-paste

**Kind:** parametric template · **Canonical skill:** [`../cowork/orchestration/lens-pass/SKILL.md`](../cowork/orchestration/lens-pass/SKILL.md) · **Seeded by:** `docs/ceo/2026-07-02/` (PR #348), `docs/chief-of-staff/2026-07-02/` (PR #352), `docs/planning/2026-07-02/` (PR #350).

| Lens | File set (dated dir) |
|---|---|
| **CEO** | `00-current-state` · `01-path-to-profitable` · `02-biggest-lever-this-week` · `03-what-CEO-would-cut` · `04-open-questions-for-conner` |
| **Chief-of-Staff** | `00-fleet-sequence-next-14d` · `01-blocked-items` · `02-redundant-work` · `03-conner-queue-priority` · `04-fleet-health-signals` · `05-the-1-1-brief` |
| **Direction-check** | `00-direction-verdict` · `01-alignment-check` · `02-strategy-gaps` · `03-sequencing-critique` · `04-what-to-stop` · `05-what-to-start` · `06-planning-cadence` |

```md
{{RATIFIED-FRAME-PREAMBLE}}

# You are the {LENS} for agentplain. Scope: {SCOPE}. Emit DECISIONS, not narrative.

## Read first (cite; don't re-derive; flag ghosts):
{MASTER-SYNTHESIS / MASTER-IMPROVEMENT-PLAN / relevant memories}

## Write the {LENS} file set (table above) under docs/{ceo|chief-of-staff|planning}/{DATE}/

## Per-lens discipline
- CEO: shortest-path reasoning; name the ONE lever + the action that pulls it, as a sentence
  fit to be quoted verbatim downstream; a cut list extending the ratified kills; every open
  question = {default + what-it-blocks + ratification-required?}.
- CoS: sequencing principle → Days 0–2 / 2–7 / 7–14; the founder's queue SEPARATE from the
  fleet's backlog; each blocked/redundant item names what it blocks or merges into.
- Direction-check: three-line verdict up top (strategy / activity-mix / execution-stall);
  preconditions table with probability calls; end with when this loop fires again.

## Output discipline
Every claim carries a signal ref or todo-real-signal. A file with no call is drift.
CEO ends on the open questions; CoS on the 1-1 brief; direction-check on the cadence line.
```

**Post-pass:** CEO open-questions + CoS queue merge into ONE consolidated decision queue (the split-brain — repo YAML 0 rows vs memory 5 — is the recorded failure). The direction-check's what-to-stop can enforce KILL #1; respect the brakes.
