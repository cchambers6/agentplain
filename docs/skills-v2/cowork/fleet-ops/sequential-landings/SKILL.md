---
name: sequential-landings
description: Land overlapping PRs sequentially, not in parallel — parallel branches against a fast-moving main pay an N² rebase tax, and concurrent code-tasks in the same repo can switch each other's HEAD mid-run. Use before fanning out any multi-PR wave — run the file-overlap audit first, serialize what overlaps.
---

# Sequential landings — the rebase tax and the HEAD-collision hazard

Spawning N parallel PRs against one repo looks fast and isn't: every merge forces every other in-flight PR to rebase. On 2026-05-11, five parallel agentplain PRs cost ~3 extra hours in cascading rebases vs ~30 min sequential. The kaizen retro measured the residue: p90 PR turnaround 22.1h, all batch-wait artifacts.

## Procedure

1. **Pre-fanout overlap audit** (the step nothing runs automatically — you run it): each wave brief declares its expected file-set + schema additions; cross-reference; any overlap → serialize that subset. Sort serialized queue smallest-first (clears main soonest).
2. **Land one completely** — push → CI/Vercel green → merge → main updated — before the next pushes. Later tasks are briefed to *wait for the merge*, then rebase, then push.
3. **Parallel only when orthogonal:** different repos always; same repo only with zero file overlap AND zero shape dependency (one PR's schema not constraining another's).
4. **Foundation + dependents exception:** a foundation PR lands first; feature PRs branch off it and may run in parallel — but still land in dependency order.
5. **Merge-train, not merge-day:** a ready PR merges within 24h or gets an explicit "waiting-on-X" label. Batching ready PRs for a weekly merge day recreates the cascade the rule was written to kill.

## The sharper hazard (same repo, even with zero file overlap)

Concurrent code-tasks on the same checkout have **switched each other's branch mid-run** (observed 2026-05-27: a task reported "the repo got switched to another task's branch by background activity"). Mitigations, in order: isolated worktrees per task ([[isolated-worktree]]); or brief each task to re-assert `git branch --show-current` matches its own branch before every commit/push. Read-only audits are safe alongside builds.

## Rules

- **"Parallelism is always faster" is false** at batch size N on one repo — count the rebase tax before fanning out.
- **The user's moment is the PR boundary, not the file boundary.** Two waves targeting the same customer moment (#246 signup-funnel vs #248 first-5-min) had zero file overlap and contradictory UX — the merge silently made a product decision. Same moment → one PR, or an explicit handoff (`feedback_user_moment_is_pr_boundary`).
- **When the user insists on parallel,** state the cost and let them choose — then order by smallest scope first and brief conflict-resolution intent per file so tasks don't stall on questions.

## Example invocation

> **Input:** "Fan out 6 fix waves tonight."
>
> **Output shape:** overlap table (wave × expected files) → 2 orthogonal waves fired in parallel worktrees, 4 serialized smallest-first with wait-for-merge briefs → report names the order and why.

## Compose with

[[isolated-worktree]] · [[rebase-first-full-build]] (the cost each rebase carries) · [[stacked-pr-discipline]] (if you stack instead) · [[cross-department-coordination]] (the planning-level analogue: "a sequential fix wave, not a parallel free-for-all")

## Origin

`feedback_sequential_not_parallel_for_overlapping_prs` (2026-05-11 ship day + 2026-05-27 HEAD-collision) · merge-train + no-overlap-check-at-dispatch: `docs/kaizen/2026-07-02/01-engineering.md` friction-6/improvement-4, `docs/kaizen/2026-07-02/10-fleet-ops.md` loopback-3 · `feedback_user_moment_is_pr_boundary`.
