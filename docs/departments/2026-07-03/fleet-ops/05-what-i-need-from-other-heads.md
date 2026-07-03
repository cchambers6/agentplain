# What fleet-ops needs from other department heads

Two asks, both small, both blocking fleet-ops acceptance criteria. Each has a
specific artifact and a "done" test.

## From Data (fleet metrics)

**D1 — Wire the cost stamp.** `stampSessionCost` exists with zero call sites (kaizen
9/10; the kaizen master ranked "stamp wiring" first-five). Fleet-ops needs it called
at loop-pass close-out and by the scheduled tasks, writing to
`memory/data/session-costs.yaml`. Without it, the post-Jul-7 cost table
(`03-…transition-plan.md`) runs on card-rate estimates forever, the re-tier audit
aborts a third time on `week_to_date_usd: null`, and the `agent-audit` track stays
paused (its keep/fix/retire calls need cost-per-run evidence).
*Done when:* every loop pass and scheduled run adds a row; the Librarian's hydration
pass (`02-Librarian-evolution.md` N5) finds nothing to backfill.

**D2 — A deliverable-conversion query.** One derivable metric, computed weekly:
backlog cards filed (`docs/loop/backlog/`) vs cards cited by merged PRs, with median
days-to-consumption. This is the loop's only honest usefulness number ("shelf-writing"
detector, `01-…monitoring.md` usefulness row 3) and the review trigger for loop spend.
A script or a documented `git log` recipe both count — no dashboard required.
*Done when:* the number appears in the Librarian's loop-health block weekly.

## From Engineering (dispatch reliability)

**E1 — Close the 17-day dispatch gap.** `mcp__dispatch__start_code_task` has been
unreachable from scheduled-task VMs since 2026-06-15 (kaizen 10/10 friction #3). The
autonomy loop's Tier-2 half still funnels through "Conner's next message" via the
pending-fires file bridge. Two acceptable resolutions, engineering's pick:
(a) reconnect the dispatch MCP in the scheduled-task environment, or (b) land the
already-spec'd GHA bridge (`docs/specs/audit-fire-gha-bridge-2026-06-15.md`) so a
`pending-fires.yaml` append triggers a fire within minutes. Note the governor runs
from a `cwd: C:\agentplain` scheduled task with dispatch-tool access per the RUNBOOK
JSON — confirm that environment actually exposes the session trio before Jul 7, or
the governor is N1-dormant on arrival.
*Done when:* a pending-fire (or governor fire) converts to a running session with no
human message in the path, demonstrated once.

**E2 — Token mint/push wrapper.** Fleet-token TTL (~1h) plus slow pre-push gates
produces pushed-branch-no-PR orphans, re-risked by every wave (kaizen friction #4;
recurred 2026-07-02 on the audit-5 wave). Ask: one blessed script — mint → push →
PR-via-REST with re-mint-on-401 — replacing the per-agent recipe. Two working minters
already exist (`.claude/worktrees/mint-fleet-token.mjs`, `.get-token.mjs`;
`04-memory-rules-audit.md` F3); wrap, don't rewrite.
*Done when:* a wave lands a PR using only the wrapper, and the recipe memories point
at it.

**E3 (standing, not new) — CI floor.** The kaizen master's "CI floor" item: main
fails 41 pre-existing tests (send-path memory, PR #355 context). Fleet-ops treats
those as known-red and does not re-diagnose; engineering owns burning them down.
Listed here only so the dependency is on paper.

## Sequencing

E1 before Jul 7 (the governor is the near-term dispatch consumer). D1 within the
fortnight (calibration week for post-switch costs). D2 and E2 any time inside the
window; both are hours, not days.
