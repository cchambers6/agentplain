---
name: detached-worktree-rebase
description: Rebase a PR branch that is already checked out in another live worktree — git refuses to check a branch out twice. Use a detached worktree plus an explicit branch-specific force-with-lease. Use when "worktree add <path> <branch>" fails with "already checked out," or when rebasing another session's in-flight branch without tearing down its worktree.
---

# Detached-worktree rebase (`--force-with-lease=<branch>:<sha>`)

A branch can't be checked out in two worktrees at once. When a PR branch lives in another session's tree, rebase it from a **detached** worktree — and push with the **explicit, branch-specific** lease, because the bare form is rejected from detached HEAD.

## Procedure (confirmed working, #219/#224, 2026-06-11)

```bash
# 0. Is it actually checked out elsewhere?
git worktree list

# 1. Capture the CURRENT remote SHA BEFORE rebasing — it's the lease value
OLD_SHA=$(git rev-parse origin/<branch>)

# 2. Detached worktree at the remote ref
git worktree add --detach <path> origin/<branch>

# 3. Rebase the detached HEAD
cd <path> && git rebase origin/main

# 4. Push with the EXPLICIT lease — bare --force-with-lease is rejected from detached HEAD ("stale info")
git push origin HEAD:<branch> --force-with-lease=<branch>:${OLD_SHA}
```

## Expected noise (do not misread these)

- **`ERR_MODULE_NOT_FOUND: Cannot find package 'tsx'`** from the pre-push hook prints but **exits 0** — the push proceeds. The real signal is git printing `[rejected]` vs `forced update`. (Corollary: the hook also didn't build anything — see [[rebase-first-full-build]].)
- **Empty commits silently dropped** during the rebase are correct when the replayed content already landed on main via another PR — no work is lost; the function shipped under its own PR.

## Rules

- **Capture `OLD_SHA` before the rebase**, not after — the lease must name the pre-rebase remote state or it protects nothing.
- **Explicit form only from detached HEAD:** `--force-with-lease=<branch>:<full-sha>`. The bare form fails first try, every time.
- **Don't tear down the other worktree to "free" the branch** — that drops its uncommitted context. The detach pattern exists so live worktrees stay live.
- After push, verify per [[push-verification]] (ls-remote SHA = your new HEAD).

## Example invocation

> **Input:** "PR #224 is stale against main but its branch is live in `C:/agentplain-pfd-4` — rebase it without touching that tree."
>
> **Output shape:** `OLD_SHA` captured → detached worktree → rebase (two empty commits dropped: their content merged via #217/#220) → `git push origin HEAD:pfd/... --force-with-lease=pfd/...:<OLD_SHA>` → `forced update` → ls-remote confirms.

## Compose with

[[isolated-worktree]] (base mechanics) · [[rebase-first-full-build]] (build before trusting the push) · [[sequential-landings]] (why the rebase queue exists at all)

## Origin

`feedback_detached_worktree_rebase_pattern` — confirmed 2026-06-11 on the fleet-runs-fleet #219/#224 rebase chain, where all 7 pfd-* branches had live worktrees.
