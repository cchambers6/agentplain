# Dossier: Windows worktree mechanics

Every recorded incident in the worktree/junction/hook domain, with the skill that now encodes the lesson. Scale context: **199 registered worktrees**, every wave in its own tree, zero cross-wave commit pollution since the isolation rule landed (`docs/fleet-architecture.md:63`, `docs/kaizen/2026-07-02/10-fleet-ops.md` win-8).

| # | Incident | Citation | Lesson → skill |
|---|---|---|---|
| 1 | `git worktree remove --force` followed the `node_modules` junction and **emptied the shared modules** other live waves depended on (recovered via `npm ci`) | `feedback_worktree_remove_force_follows_junctions` (2026-06-11) | `rmdir` junction FIRST → [[isolated-worktree]] |
| 2 | Junction chosen over symlink/copy: NTFS junction is a reparse *point* — `rmdir` removes the point, not the target; `rm -rf` follows it | junction recipes across fleet memories; `docs/kaizen/2026-07-02/01-engineering.md` friction-9 | junction + `rmdir`-only → [[isolated-worktree]] |
| 3 | Fresh worktrees have `.husky/pre-push` but no install-generated `.husky/_/` — **pushes complete in <2s with zero build output**; only hint is a stray tsx line | `feedback_prepush_gate_skipped_fresh_worktrees` | run the build yourself → [[rebase-first-full-build]] |
| 4 | `tsx ERR_MODULE_NOT_FOUND` in the pre-push hook **exits 0 without compiling** — a real build break passes silently; Vercel catches it first | `feedback_rebase_union_dup_any_file_build_required` | Vercel commit status = authoritative gate → [[rebase-first-full-build]] |
| 5 | EPERM on the shared Prisma engine DLL under concurrent `prisma generate` across worktrees | `project_prisma_no_engine_unblocks_prepush`; kaizen 01 friction-9 | `PRISMA_GENERATE_NO_ENGINE=true` → [[isolated-worktree]], [[prisma-migration]] |
| 6 | Pre-commit gate red on files the wave never touched (other waves' pre-existing failures) | sequential-landings memory (sanctioned bypass) | `HUSKY=0` for that case only → [[isolated-worktree]] |
| 7 | Branch already checked out in another live worktree — `worktree add <path> <branch>` refuses; teardown would lose that session's context | `feedback_detached_worktree_rebase_pattern` (2026-06-11, #219/#224) | `--detach` + `--force-with-lease=<branch>:<sha>` → [[detached-worktree-rebase]] |
| 8 | Backslash worktree paths + `cmd //c` junction syntax quoting traps; bash `/tmp` ≠ node `os.tmpdir()` | kaizen 01 friction-8 | explicit absolute Windows paths everywhere → [[fleet-token-push]] |

**The teardown liturgy (memorize this one):** `rmdir` the junction → `git worktree remove` → never `rm -rf` a junction → never `--force` while a junction exists.
