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

## Ratified governance decisions — 2026-07-03

**Delegated by Conner Chambers, ratified by fleet, 2026-07-03.**

### Kill list (CEO Pass 1)

| Kill | Status | Restart trigger |
|------|--------|-----------------|
| #1 No new audit/retro loops | RATIFIED | Top-20 fix table burned down |
| #2 GTM except GA RE closed | RATIFIED | 2 RE design partners live (weekly-running) |
| #3 flatsbo waitlist-dark | **OVERRIDDEN** — flatsbo stays live | N/A |
| #4 Client portal as funded workstream | RATIFIED | First signed partner asks for it |
| #5 No LLM-dependent features | RATIFIED | Conner restores production key |
| #6 Paid media + photography | HOLD | First design partner trial→paid |
| #7 No new surface area | RATIFIED | Profitable milestone + 1 top-20 card shipped |

Full ratification doc: `docs/kills/2026-07-03/RATIFIED.md`

### Copy rulings (CEO Pass 1 contradictions)

- **Contradiction 1 — /security absolutes:** Option A ratified. Incident response 24-hour containment SLA softened to "as quickly as possible." Founding-team name redacted. No funded hardening workstream. Full ruling: `docs/copy-rulings/2026-07-03/security-page.md`

- **Contradiction 2 — model-vendor invisibility:** `feedback_model_vendor_invisible_on_customer_surfaces` (load-bearing) supersedes `project_sbm_wrapper_positioning_2026_06_06`. Model vendor is invisible on every customer-rendered surface, no exceptions beyond legal subprocessor disclosure. 7 non-subprocessor occurrences found — flagged for follow-up scrub PR. Full ruling: `docs/copy-rulings/2026-07-03/model-vendor-invisibility.md`
