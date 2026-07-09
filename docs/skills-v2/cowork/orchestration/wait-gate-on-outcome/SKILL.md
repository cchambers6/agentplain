---
name: wait-gate-on-outcome
description: Gate downstream work on the observable outcome, never on a vehicle — not a PR number, not a session's self-report, not merged=true. Use when blocking on a dispatched pass, sequencing after a fix "lands," or writing any wait condition into a brief. The artifact is the truth; everything else is a claim.
---

# Wait-gate on the outcome, not the PR number

A wait-gate keyed to a specific PR deadlocks the moment the goal arrives by another vehicle — and fleet builds routinely fold fixes into larger merge chains.

## The canonical incident

PR #235 (ApprovalCard dedupe) was **closed without merging** — its one-line fix had already landed on main via commit `30aa598` inside the #224 merge chain. Any agent gating on "#235 merged" was blocked forever on a dead PR while the goal was already achieved.

## Procedure

1. **Name the outcome before dispatching:** a file state on `origin/main`, a green gate, a state-store deliverable, a live session — not "PR #N merged."
2. **Write the gate as a check against the artifact:**
   - "wait until `grep -c 'const AGENT_DISPLAY_NAMES' ApprovalCard.tsx` on origin/main returns 1" — not "wait for #235"
   - `git ls-tree origin/main -- <file>` / grep against `origin/main` — not PR state
   - the loop's version: the quality gate parses the pass's **files** (schema-valid yaml, promised paths exist, voice-gate clean); it never trusts a claimed-complete status (`docs/loop/prompts/L3-haiku-heartbeat.md`)
3. **Block on the right signal:** harness-tracked agent → its completion notification (don't poll); external state (CI, deploy) → poll the platform API on a cadence matched to its rate of change; docs-in-place → the files existing + the report-back.
4. **When a fix-PR closes unmerged:** check whether the fix is already on main before diagnosing a problem.

## Rules

- **`merged=true` proves nothing about main** for stacked PRs — content can be stranded on a dead branch ([[stacked-pr-discipline]], the #222 incident).
- **A returned PR URL that 404s, or a session that died mid-write, is not done** — verify per [[push-verification]].
- **Not every pass ends in a PR.** Loop passes commit docs-only straight to main; some passes only update `state.yaml`. A "wait for the PR URL" gate on those waits forever.
- **Session self-reports are claims** (`feedback_no_guesses_no_estimates`) — the orchestrator verifies before relaying or unblocking.

## Example invocation

> **Input:** "Wave B starts when the duplicate-const fix lands. Write the gate."
>
> **Output shape:** `GATE: git fetch && git grep -c 'const AGENT_DISPLAY_NAMES' origin/main -- app/.../ApprovalCard.tsx == 1. Check on wake; any vehicle (any PR, direct commit) satisfies it. Do not key on a PR number.`

## Compose with

[[push-verification]] · [[stacked-pr-discipline]] · [[payload-oversize-handling]] (when the awaited session died) · [[scheduled-task-liveness]] (liveness judged by observed fires)

## Origin

`feedback_wait_gate_on_outcome_not_pr_number` (#235, 2026-06-11) · mechanical artifact-gating: `docs/loop/00-DESIGN.md` ("the yaml block is the contract; the governor never parses prose") + L3 QUALITY GATE.
