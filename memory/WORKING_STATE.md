# WORKING_STATE — live fleet state

**Refreshed by:** the Librarian roll-up, every 15 min (`agentplain-librarian-rollup`). · **Read by:** Tier-2/3 sessions to know "what is live right now" and by the Dispatch parent to pick up pending fires. · **Process source:** `docs/specs/AGENTPLAIN_OPERATING_SYSTEM_2026_06_15.md` Section 3.

> Committed template. The operational copy lives at the live session-memory path and is what the roll-up rewrites each pass; keep it in sync with this template's section structure.

**Last refreshed:** _<ISO-8601 UTC — Librarian stamps each pass>_

## Sentinel state

- `ANTHROPIC_API_KEY`: paused (policy — I-6). _<flip only on Conner decision>_
- Budget caps: _<ok | Tier-N breached — from budget-state.yaml>_

## Running orchestrators

_<Tier-3/4 sessions currently live; "none" if idle. scheduled-task roll-ups are NOT orchestrators.>_

- _none_

## Open PRs

_<from the PR sweep: number, title, mergeable?, branch. "none open" if clean.>_

- _none_

## Conner queue (head)

_<top items from conner-queue.yaml, highest priority first.>_

- _none pending_

## Pending fires (waiting on dispatch parent)

_<Mirrored from `memory/data/pending-fires.yaml` by the Librarian: every entry with `status: claimed` that has not yet been moved to `fired`/`failed` by the Dispatch parent. The Dispatch parent fires each one via `mcp__dispatch__start_code_task` on Conner's next message, then stamps `status: fired` + `fired_session_id` + `fired_at` in the YAML. See LIBRARIAN_CHARTER.md "Pending-fires pickup protocol".>_

| id | title | model | budget cap | severity | cv-bar | claimed at |
|----|-------|-------|-----------|----------|--------|-----------|
| _<none claimed>_ | | | | | | |

<!-- Example row (delete when a real fire is claimed):
| fire-2026-06-15T22-30-00Z-plaino-paused-banner | Plaino-paused universal banner | claude-opus-4-8 | $80 | P1 | 5 | 2026-06-15T22:31:00Z |
-->
