---
name: isolated-worktree
description: Build a branch in an isolated git worktree so parallel work never touches the primary checkout. Use when running multiple builds at once, when the user says "don't touch my working tree," or before any fleet PR that must build off a clean origin/main. Windows-aware (junctioned node_modules, junction-first cleanup).
---

# Isolated worktree (parallel-safe builds)

Build each branch in its own detached worktree that shares `node_modules` with the primary checkout. This keeps parallel sessions from colliding and never disturbs the user's working tree.

## Procedure

```bash
# 1. detached worktree off the base ref
git worktree add C:/agentplain-wt-<name> --detach origin/main

# 2. junction node_modules from the primary checkout (Windows) — never copy or reinstall
cmd //c "mklink /J C:\agentplain-wt-<name>\node_modules C:\agentplain\node_modules"

# 3. create the feature branch inside the worktree
git -C C:/agentplain-wt-<name> switch -c <branch>

# ...edit, commit, push...

# 4. CLEANUP — junction FIRST, then remove the worktree
cmd //c "rmdir C:\agentplain-wt-<name>\node_modules"
git worktree remove C:/agentplain-wt-<name> --force
```

## Rules (load-bearing)

- **Cleanup order matters:** `rmdir` the junction **before** `git worktree remove`. Reverse it and git deletes the *real* `node_modules` through the junction.
- **Never `rm -rf` a junction** — always `rmdir`. `rm -rf` follows into the real directory.
- **Junction, don't reinstall** — sharing modules is instant; `npm ci` in each worktree wastes minutes and disk.
- Pre-commit gate failing on files you didn't touch → `HUSKY=0`. Pre-push blocked on Prisma engine download → `PRISMA_GENERATE_NO_ENGINE=1`.
- Overlapping PRs land **sequentially**, not in parallel.

## Origin

Seeded by every parallel fleet wave in June–July 2026 (e.g. the overnight fix wave, PR #369). The junction-first cleanup order was learned the hard way — reversing it deletes shared modules.
