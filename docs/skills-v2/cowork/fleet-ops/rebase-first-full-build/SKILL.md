---
name: rebase-first-full-build
description: Rebase on origin/main before first push AND run the full build after any multi-commit rebase — the pre-push hook is broken (tsx failure exits 0 without compiling) and git's 3-way auto-merge can silently duplicate top-level definitions in files you never touched. Use at the start and end of every code task that produces a PR.
---

# Rebase first, full build after — the two gates the hooks won't run for you

Two recorded failure classes, one discipline: stale bases resurface already-fixed bugs, and union rebases silently duplicate code. Neither is caught locally unless you run the gates yourself.

## Procedure

```bash
# FIRST action in the worktree (and again as LAST action before push):
git fetch origin && git rebase origin/main
# conflicts? → don't resolve creatively: git rebase --abort, fresh branch from main, re-apply the work

# AFTER any multi-commit rebase that unioned conflicts — the FULL build, not a grep:
PRISMA_GENERATE_NO_ENGINE=true npm run build:no-migrate 2>&1 | tee /tmp/build.log
grep -c "Failed to compile" /tmp/build.log    # must be 0
```

PR description states: "Rebased on origin/main @ `<sha>` at `<time>`" — the audit trail.

## Why the hooks won't save you

- **`tsx ERR_MODULE_NOT_FOUND` short-circuits the pre-push hook and exits 0** — a real build break passes pre-push silently; Vercel is the first thing that notices (`feedback_rebase_union_dup_any_file_build_required`).
- **Fresh worktrees have no `.husky/_/`** — the hook doesn't run at all (see [[isolated-worktree]]).
- **The dup hazard is not confined to the file you hand-edited.** #224's rebase produced clean `route.ts` (the watched file) while `ApprovalCard.tsx` got a byte-identical duplicated `AGENT_DISPLAY_NAMES` const from the 3-way auto-merge — no conflict marker, webpack "defined multiple times," Vercel red. Only the full build finds dups in files you never touched.

## Rules

- **Rebase-on-main is mandatory, both ends of the task.** The same `lib/security/encryption.ts:114` lint error broke two consecutive Vercel previews on different branches because both built on stale bases (`feedback_code_tasks_rebase_first`).
- **`mergeable: true` means no conflict, NOT that it compiles.**
- **The authoritative compile gate is the Vercel commit status** (the `Vercel` context, not the cosmetic `Vercel Preview Comments`) — poll `/commits/<sha>/statuses` until it flips `pending → success`.
- **Grep-for-dups is a supplement, not a substitute** for the build.
- Landing a compile fix after: it's an added commit — fast-forward push, no force needed.

## Example invocation

> **Input:** "Vercel is red on the rebased branch: 'the name X is defined multiple times' in a file this task never edited."
>
> **Output shape:** full local build reproduces → delete the duplicated block → rebuild to EXIT=0 → dedicated fix commit → plain push → poll the Vercel status on the new head SHA to `success` → report.

## Compose with

[[isolated-worktree]] · [[detached-worktree-rebase]] · [[sequential-landings]] (fewer rebases = fewer union hazards) · [[push-verification]]

## Origin

`feedback_code_tasks_rebase_first` (2026-05-10, twice-repeated Vercel failure) + `feedback_rebase_union_dup_any_file_build_required` (2026-06-11, #224 ApprovalCard dup) + `feedback_prepush_gate_skipped_fresh_worktrees`. CI context: only 3 path-filtered workflows run on PRs (`docs/kaizen/2026-07-02/01-engineering.md` friction-2) — the local full build is load-bearing, not belt-and-suspenders.
