# Lens pass — CEO / Chief-of-Staff / direction-check template

**Domain:** orchestration · **Kind:** ready-to-paste dispatch prompt · **Seeded by:** `docs/ceo/2026-07-02/`, `docs/chief-of-staff/2026-07-02/`, `docs/planning/2026-07-02/`.

## What a lens pass is

Apply **one perspective to a bounded scope** and emit decisions. Three canonical lenses, same output shape:

| Lens | Question it answers | Files (2026-07-02) |
|------|--------------------|--------------------|
| **CEO** | What's the shortest path to profitable, and the single biggest lever this week? | `00-current-state`, `01-path-to-profitable`, `02-biggest-lever-this-week`, `03-what-CEO-would-cut`, `04-open-questions-for-conner` |
| **Chief-of-Staff** | What's the right *execution sequence*, and what's blocking/redundant? | `00-fleet-sequence-next-14d`, `01-blocked-items`, `02-redundant-work`, `03-conner-queue-priority`, `04-fleet-health-signals`, `05-what-i-would-tell-conner-in-a-1-1` |
| **Direction-check / Planning** | Is the *strategy* right, is the activity mix right, where does it stall? | `00-direction-verdict`, `01-alignment-check`, `02-strategy-gaps`, `03-sequencing-critique`, `04-what-to-stop`, `05-what-to-start`, `06-planning-cadence` |

## When to use — trigger phrases

- "run a CEO pass" / "what's the biggest lever this week"
- "chief-of-staff pass" / "sequence the next two weeks" / "what's blocked / redundant"
- "direction check" / "is our strategy right" / "planning verdict"

## Inputs

- `{LENS}` — CEO | Chief-of-Staff | Direction-check.
- `{SCOPE}` — what the lens looks at (the whole company, the next 14 days, the strategy).
- `{SOURCES}` — the audits/retros/deep-dives/memories the pass must cite.
- The **ratified-frame preamble** (`../governance/ratified-frame-preamble.md`) — always prepended.

## The template (paste, fill the {braces})

```md
{{RATIFIED-FRAME-PREAMBLE}}

# You are the {LENS} for agentplain. Scope: {SCOPE}.

Apply the {LENS} lens and emit DECISIONS, not narrative. This is a design-FOR-profitable pass.

## Read first (cite what you use; do not re-derive)
{SOURCES}   <!-- e.g. docs/audits/full-audit-2026-07-02/MASTER-SYNTHESIS.md,
                    docs/kaizen/2026-07-02/MASTER-IMPROVEMENT-PLAN.md, relevant memories -->

## Write these files under docs/{lens-dir}/{DATE}/
{ENUMERATE THE LENS FILES FROM THE TABLE ABOVE}

## Each file's discipline
- **CEO**: shortest path reasoning; name the ONE biggest lever and the action that pulls it;
  a cut list that extends the ratified kill list; open questions each with {default + blocker +
  ratification-required}.
- **Chief-of-Staff**: sequencing principle → Days 0–2 / 2–7 / 7–14; separate Conner's queue from
  the fleet's; each blocked/redundant item names what it blocks or what to merge it into.
- **Direction-check**: a three-line verdict (strategy / activity-mix / execution-stall) up top,
  then a preconditions table with probability calls; end with what-to-stop and what-to-start.

## Output discipline
- Decisions > narrative. Every claim carries a signal ref or `todo-real-signal`. Truth Wave: cite PR#/path.
- The CEO pass ends with `04-open-questions-for-conner`; the CoS pass ends with the 1-1 brief;
  the direction-check ends with cadence (when this loop fires again).

## Report back
- File paths written. Top 3 decisions. For CEO: the single biggest lever. For CoS: the top item
  in Conner's queue. For direction-check: the one-line verdict.
```

## Output shape

A dated directory of short decision docs (see the table). The CEO and CoS passes feed the **consolidated Conner queue** (see `../patterns/consolidated-conner-queue.md`); the direction-check gates whether more planning loops fire (it can enforce KILL #1).

## Guardrails

- **Bounded scope, single lens.** A CEO pass that starts sequencing execution is doing the CoS's job — keep lenses distinct so their outputs compose instead of overlap.
- **Decisions, not a book report.** If a file is all summary and no call, it's `drift`.
- **The direction-check can pull the brakes.** Its `04-what-to-stop` is where KILL #1 ("no new analysis loops") gets enforced — respect it; don't spawn another audit because a lens pass "found gaps."
- **Consolidate the Conner queue.** CEO open-questions + CoS Conner-queue must be merged into one queue, not two competing lists (memory: the "conner-queue split-brain" — repo YAML vs fleet memory — is the failure mode to avoid).

## Worked example

The 2026-07-02 planning direction-check (memory: PR #350) opened with a three-line verdict — *strategy right / activity mix wrong / fails-on-execution-stall* — named "entity = biggest silent gap," and set the next planning fire to ~07-08. The CEO pass 1 (PR #348) named the lever ("first 5 GA-RE design-partner sends this week") and the cash-breakeven band (3–9 customers), which then propagated verbatim into the ratified-frame preamble every downstream head used.
