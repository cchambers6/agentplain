# Pattern: isolated worktree (parallel-safe builds)

**Group:** code/process · **Seeded by:** every parallel fleet wave, e.g. PR #295–#306 heal pass, #344–#369; memory: feedback_parallel_waves_use_worktrees, feedback_fleet_waves_use_worktree.

## When to use — trigger phrases
- "run this as an isolated worktree" / "don't touch my working tree"
- multiple fleet sessions building different branches at once
- any PR that must be built off a clean `origin/main` while other work is in flight

## Inputs
- A branch name and a base ref (usually `origin/main`).
- The primary checkout at `C:\agentplain` (source of the junctioned `node_modules`).

## Procedure
```bash
# 1. detached worktree off the base ref
git worktree add C:/agentplain-wt-<name> --detach origin/main
# 2. junction node_modules from the primary checkout (Windows) — NEVER copy or reinstall
cmd //c "mklink /J C:\agentplain-wt-<name>\node_modules C:\agentplain\node_modules"
# 3. create the feature branch inside the worktree
git -C C:/agentplain-wt-<name> switch -c <branch>
# ...edit, commit, push (see code-hygiene/fleet-token-push.md)...
# 4. CLEANUP — junction first, THEN remove the worktree
cmd //c "rmdir C:\agentplain-wt-<name>\node_modules"   # remove junction BEFORE worktree remove
git worktree remove C:/agentplain-wt-<name> --force
```

## Output
An isolated checkout that shares `node_modules` with the primary tree but has its own branch, index, and working files — parallel-safe.

## Guardrails
- **Cleanup order is load-bearing:** `rmdir node_modules` (the junction) **before** `git worktree remove`. Reverse order and git deletes the *real* modules through the junction. (memory: worktree node_modules junction recipe)
- **Never `rm -rf` a junction** — use `rmdir` / `cmd //c rmdir`. `rm -rf` follows into the real directory.
- Set `HUSKY=0` when a pre-commit gate fails on files you didn't touch (others' pre-existing failures).
- `PRISMA_GENERATE_NO_ENGINE=1` unblocks the pre-push hook without a full engine download.
- Overlapping PRs land **sequentially, not in parallel** (memory: feedback_sequential_not_parallel_for_overlapping_prs).

## Worked example
The overnight wave (PR #369) built four RE-path fixes in `C:/agentplain-wt-overnight` off `origin/main`, junctioned `node_modules`, pushed via the fleet token, then cleaned up junction-first. See `../code-hygiene/fleet-token-push.md` for the full push+cleanup sequence.
