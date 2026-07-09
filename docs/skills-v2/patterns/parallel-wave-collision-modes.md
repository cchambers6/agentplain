# Dossier: parallel-wave collision modes

Four distinct ways parallel branches hurt each other. They get conflated in retros; keeping them separate is what makes the mitigations precise.

| Mode | Mechanism | Recorded incident | Lesson → skill |
|---|---|---|---|
| **1. Rebase tax** | every merge forces every other in-flight PR to rebase; N² work | 2026-05-11: 5 parallel PRs, ~3h of cascading rebases vs ~30min sequential; residue: p90 turnaround 22.1h, 3 PRs >72h (`feedback_sequential_not_parallel_for_overlapping_prs`; kaizen 01 friction-6) | pre-fanout overlap audit; sequential landings; merge-train not merge-day → [[sequential-landings]] |
| **2. HEAD collision** | concurrent tasks on one checkout switch each other's branch mid-run — file overlap irrelevant | 2026-05-27: integrations task found itself on the passkey task's branch, edits stranded in the working tree (recovered) | worktree per task; re-assert `git branch --show-current` before commit → [[isolated-worktree]], [[sequential-landings]] |
| **3. Stack corruption** | child merged back into parent → empty diffs; wrong merge order → content stranded with `merged=true` | 2026-06-11: #217 absorbed #220/#221 (empty diffs); #222 merged into a branch 28s after that branch merged to main — content never reached main (`feedback_stacked_pr_backmerge_antipattern`) | never backmerge; leaf-to-root; `ls-tree origin/main` to verify → [[stacked-pr-discipline]], [[wait-gate-on-outcome]] |
| **4. Union duplication** | 3-way auto-merge silently duplicates byte-identical top-level defs — in files neither side hand-edited; no conflict marker | 2026-06-11: #224 rebase produced clean `route.ts` but duplicated `AGENT_DISPLAY_NAMES` in `ApprovalCard.tsx`; pre-push showed green (broken tsx hook); Vercel red (`feedback_rebase_union_dup_any_file_build_required`) | full build after any multi-commit union rebase → [[rebase-first-full-build]] |

**Cross-mode rules:**
- Migration timestamps are a fifth, smaller collision: hand-minted round numbers (`…100000`) collided across waves — 8 duplicates reached main; a heal pass re-minted them (kaizen 01 friction-5) → [[prisma-migration]].
- The **planning-level analogue** is real: ten department plans reconciled by one coordination pass with a *sequential* fix wave and an explicit conflicts file → [[cross-department-coordination]]. Same physics, higher altitude.
- The **UX-level analogue** too: zero file overlap, same customer moment, contradictory UX (#246 vs #248) — the merge silently made a product decision (`feedback_user_moment_is_pr_boundary`) → [[sequential-landings]], [[no-scope-creep-fix]].
