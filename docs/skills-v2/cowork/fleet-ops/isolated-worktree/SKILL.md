---
name: isolated-worktree
description: Build a branch in an isolated git worktree so parallel work never touches the primary checkout. Use when running multiple builds at once, when the user says "don't touch my working tree," or before any fleet PR that must build off a clean origin/main. Windows-aware — junctioned node_modules, junction-first teardown, and the fresh-worktree gaps (husky hooks absent, Prisma engine locks).
---

# Isolated worktree (parallel-safe builds)

Each branch builds in its own detached worktree that shares `node_modules` with the primary checkout via an NTFS **junction**. Parallel sessions never collide; the user's working tree is never disturbed.

## Procedure

```bash
# 1. Detached worktree off the base ref
git worktree add C:/agentplain-wt-<name> --detach origin/main

# 2. Junction node_modules from the primary checkout — never copy, never npm ci
cmd //c "mklink /J C:\agentplain-wt-<name>\node_modules C:\agentplain\node_modules"

# 3. Feature branch inside the worktree
git -C C:/agentplain-wt-<name> switch -c <branch>

# ...edit, commit, push (see [[fleet-token-push]] · verify per [[push-verification]])...

# 4. TEARDOWN — junction FIRST, worktree SECOND, never --force with a junction present
cmd //c "rmdir C:\agentplain-wt-<name>\node_modules"
git worktree remove C:/agentplain-wt-<name> --force
```

## Rules (each prevents a recorded failure)

- **Junction, not symlink, not copy.** A junction is a reparse *point*: `rmdir` removes the point and leaves the target intact. That property is the whole safety story of the teardown — and why `npm ci` per worktree (minutes, gigabytes) is never needed.
- **`rmdir` the junction BEFORE `git worktree remove`.** `git worktree remove --force` on Windows uses a recursive delete that **follows junctions** — on 2026-06-11 it emptied the shared `node_modules` that other live waves depended on (recovered with `npm ci`, but any wave mid-flight would have broken). Junction first, always.
- **Never `rm -rf` a junction.** Recursive delete follows the reparse point into the real directory. `rmdir` only.
- **The pre-push build gate does NOT run in a fresh worktree.** Husky's wrappers live in `.husky/_/`, which is install-generated and gitignored — a fresh worktree has `.husky/pre-push` but no `.husky/_/`, so pushes complete in <2s with zero build output. Don't mistake that for green: run the build explicitly (see [[rebase-first-full-build]]) or treat the Vercel commit status as the authoritative compile gate.
- **`PRISMA_GENERATE_NO_ENGINE=true`** before build/push avoids the Prisma engine-DLL download/lock in worktrees. **`HUSKY=0`** when a pre-commit gate fails on files you didn't touch.
- **Overlapping PRs land sequentially** — see [[sequential-landings]]. A worktree isolates files, not the merge order.

## Example invocation

> **Input:** "Ship the overnight fixes without touching my checkout — I have uncommitted work in C:\agentplain."
>
> **Output shape:** worktree at `C:/agentplain-wt-overnight` off `origin/main`, junctioned modules, branch `fix/overnight-wave-<date>`, commits pushed via [[fleet-token-push]], PR opened via [[curl-per-pr-merge]], then junction-first teardown. The primary checkout's status is byte-identical before and after.

## Compose with

[[fleet-token-push]] (the push out of the worktree) · [[rebase-first-full-build]] (the build gate husky won't run) · [[detached-worktree-rebase]] (when the branch is already checked out elsewhere) · [[sequential-landings]] (landing order)

## Origin

Every parallel fleet wave June–July 2026 (e.g. overnight wave, PR #369). Junction-follow deletion: `feedback_worktree_remove_force_follows_junctions` (incident 2026-06-11). Husky gap: `feedback_prepush_gate_skipped_fresh_worktrees`. Prisma no-engine: `project_prisma_no_engine_unblocks_prepush`.
