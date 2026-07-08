---
name: stacked-pr-discipline
description: Keep a stacked-PR chain structurally sound — never merge a child back into its parent, merge leaf-to-root, and verify content reached main by tree inspection rather than PR state. Use when working a stack of dependent PRs, planning a merge train over one, or diagnosing empty-diff / stranded-content PRs.
---

# Stacked-PR discipline (the back-merge antipattern)

Children branch OFF the parent; the parent never absorbs children. One back-merge corrupts the whole stack's reviewability, and one wrong merge order strands content on a dead branch while GitHub says `merged=true`.

## The two failure modes (both observed 2026-06-11, fleet-runs-fleet stack)

1. **Back-merge pollution.** `pfd/self-healing-credentials` (#217) absorbed "Merge PR #220" and "Merge PR #221" — so #220/#221 showed **empty diffs** (their heads already reachable from their base): un-reviewable, un-meaningful. #224 had merged in four siblings, same pollution at scale.
2. **Stranding.** #222 merged into its parent branch 28 seconds **after** the parent merged to main. GitHub marked #222 `merged=true`, but its content never reached main — it was stranded on a dead branch; only #224's diff carried it forward.

## Rules

- **Never `git merge <child>` into a parent.** If the parent needs the child's state, the child rebases on the parent — never the reverse.
- **Merge order is leaf-to-root:** deepest child into its parent FIRST; parent to main LAST.
- **`merged=true` proves nothing about main.** After any merge train: `git ls-tree origin/main -- <marquee-file>` (or grep against `origin/main`) to confirm the content actually arrived — see [[wait-gate-on-outcome]].
- **PRs merged outside GitHub's merge button don't auto-close** — verify with `GET /pulls/{n}`, not the open-PR list.
- **Recovery:** local branches are often still clean (2 commits locally vs 20 polluted on origin — compare `git log --oneline` both sides). Force-push each parent reset to its own commits rebased on main, then re-stack children.
- **Root cause is shared-checkout parallel work** — the hazard [[isolated-worktree]] exists to remove. Stacks + shared trees don't mix.

## Example invocation

> **Input:** "PR #220 shows an empty diff and #222 says merged but the feature isn't on main."
>
> **Output shape:** diagnose back-merge on the parent (`git log origin/pfd/... --oneline` shows sibling merge commits) → confirm stranding (`git ls-tree origin/main -- lib/.../runtime.ts` missing) → reset parents to own commits, re-stack, re-merge leaf-to-root → tree-inspect main → report which PRs carried which content.

## Compose with

[[sequential-landings]] (prefer not stacking at all) · [[wait-gate-on-outcome]] (outcome over PR state) · [[push-verification]] · [[isolated-worktree]]

## Origin

`feedback_stacked_pr_backmerge_antipattern` (LOAD-BEARING, 2026-06-11 — #217/#220/#221/#222/#224 corruption + stranding, with the recovery that fixed it). Named-but-unwritten in kaizen ghost-file audit (`docs/kaizen/2026-07-02/01-engineering.md` friction-1) — this file is the write-down.
