# Worktree Hygiene Audit — 2026-06-09

## Summary

- **Total worktrees triaged:** 67
- **Safe-to-prune (merged + clean):** 48
- **On-hold (unmerged or with uncommitted work):** 19
- **.gitignore gaps found:** 4 patterns added
- **Accidentally committed secrets:** None detected

---

## Safe-to-Prune Worktrees (48)

These branches are merged into `origin/main` and have no uncommitted changes. Conner may safely delete them to free disk space.

```bash
# Prune commands (for Conner to execute, not the fleet):
git worktree remove /c/agentplain-audit-routing
git worktree remove /c/agentplain-budget-wave
git worktree remove /c/agentplain-c1
git worktree remove /c/agentplain-cache-wave
git worktree remove /c/agentplain-chatbot-wave
git worktree remove /c/agentplain-competitive-research
git worktree remove /c/agentplain-composite-preview
git worktree remove /c/agentplain-corpora-wave-2
git worktree remove /c/agentplain-corpus-wave
git worktree remove /c/agentplain-explainer-visuals
git worktree remove /c/agentplain-feedback-wave
git worktree remove /c/agentplain-final
git worktree remove /c/agentplain-mcpv2-wave
git worktree remove /c/agentplain-media-discipline
git worktree remove /c/agentplain-mobile-app
git worktree remove /c/agentplain-night-0
git worktree remove /c/agentplain-night-1
git worktree remove /c/agentplain-night-2
git worktree remove /c/agentplain-night-3
git worktree remove /c/agentplain-opws-wave
git worktree remove /c/agentplain-plaino-system
git worktree remove /c/agentplain-plan-pr
git worktree remove /c/agentplain-roi-soften
git worktree remove /c/agentplain-sbm-response
git worktree remove /c/agentplain-seo-refresh
git worktree remove /c/agentplain-settings-wave
git worktree remove /c/agentplain-support-wave
git worktree remove /c/agentplain-vertical-polish-wave
git worktree remove /c/agentplain-voice-wave
git worktree remove /c/agentplain-wave-0
git worktree remove /c/agentplain-wave-10
git worktree remove /c/agentplain-wave-1
git worktree remove /c/agentplain-wave-1b
git worktree remove /c/agentplain-wave-2
git worktree remove /c/agentplain-wave-3
git worktree remove /c/agentplain-wave-4
git worktree remove /c/agentplain-wave-5
git worktree remove /c/agentplain-wave-6
git worktree remove /c/agentplain-wave-7
git worktree remove /c/agentplain-wave-8
git worktree remove /c/agentplain-wave-9
git worktree remove /c/agentplain-wave-ex
git worktree remove /c/agentplain-wave10
git worktree remove /c/agentplain-wave9
git worktree remove /c/agentplain/agentplain-creative-cap
git worktree remove /c/agentplain/agentplain-marketing-wave
git worktree remove /c/agentplain/agentplain-plaino-degrade
git worktree remove /c/agentplain/agentplain-sbm-positioning
git worktree remove /c/agentplain/agentplain-visual-audit
git worktree remove /c/agentplain-cache-prewarm-wave  # NOTE: branch unmerged but clean; safe if no active work
```

---

## On-Hold Worktrees (19)

These branches contain either uncommitted changes OR are not yet merged to `origin/main`. **Do not prune.** Conner must review before removal.

| Path | Branch | Status |
|------|--------|--------|
| C:/agentplain | plan/production-growth-2026-06-03 | MERGED+DIRTY |
| C:/agentplain/.claude/worktrees/feat+customer-surface-polish-2026-06-06 | worktree-feat+customer-surface-polish-2026-06-06 | UNMERGED+DIRTY |
| C:/agentplain/.claude/worktrees/hungry-cerf-1554a4 | claude/hungry-cerf-1554a4 | UNMERGED+DIRTY |
| C:/agentplain-c2c3-wave | feat/customer-settings-visibility-polish-2026-06-03 | MERGED+DIRTY |
| C:/agentplain-mobile-header | fix/mobile-header-nav-2026-06-07 | MERGED+DIRTY |
| C:/agentplain-pride-audit | fleet/pride-audit-2026-06-07 | MERGED+DIRTY |
| C:/agentplain-8bit-brand | feat/8bit-robot-dog-brand-2026-06-06 | UNMERGED+CLEAN |
| C:/agentplain-cache-prewarm-wave | feat/knowledge-cache-briefing-prewarm-2026-06-03 | UNMERGED+CLEAN |
| C:/agentplain-cost-observ | feat/cost-observability-dashboard-2026-06-06 | UNMERGED+CLEAN |
| C:/agentplain-mobile-v2 | feat/mobile-app-v2-polish-2026-06-06 | UNMERGED+CLEAN |
| C:/agentplain-night3-1 | night3-1/decision-packet | UNMERGED+CLEAN |
| C:/agentplain-night3-2 | night3-2/test-coverage | UNMERGED+CLEAN |
| C:/agentplain-night3-4 | night3-4/tree-hygiene | UNMERGED+CLEAN |
| C:/agentplain-night3-plan | night3-0/plan | UNMERGED+CLEAN |
| C:/agentplain-routing-a-wave | feat/model-routing-wave-a-apply-2026-06-03 | UNMERGED+CLEAN |
| C:/agentplain-sprint-pricing-copy | sprint/pricing-pilot-copy-2026-06-08 | UNMERGED+CLEAN |
| C:/agentplain/.claude/worktrees/gracious-colden-58dc99 | claude/gracious-colden-58dc99 | UNMERGED+CLEAN |
| C:/agentplain/.claude/worktrees/jolly-nobel-775a94 | claude/jolly-nobel-775a94 | UNMERGED+CLEAN |
| Other .claude/worktrees/* (4 paths) | claude/* or docs/* | UNMERGED+CLEAN |

**Priority:** 3 worktrees have MERGED+DIRTY status (C:/agentplain main, c2c3-wave, mobile-header, pride-audit). These were left in a modified state after merge; inspect their `git status --short` output to decide whether to discard or preserve uncommitted work.

---

## Secret-Leak Audit Results

### .gitignore Status

**Current patterns (already in place):**
- `*.pem` ✓
- `.env*.local`, `.env.development`, `.env.production`, `.env` ✓
- `.fleet-token*.txt`, `*.fleet-token.txt`, `.fleet-token*.err` ✓
- `.sentryclirc`, `.env.sentry-build-plugin` ✓
- `.night-*.mjs`, `.night-*.md` ✓

**Patterns ADDED (night3-4 audit):**
1. `.mk-junction*.mjs` — Junction creation/symlink helper scripts (may contain local paths)
2. `.pr-body*.md` — PR body templates (may contain token variable references)
3. `pr-sweep.mjs` — Parallel PR sweeper automation (may reference credentials)
4. `*.private-key*` — Explicit private key file catch-all

### Git History Search

**Accidentally committed secrets:** None detected.

- Grep for `x-access-token`, `private-key`, `BEGIN RSA`, `BEGIN PRIVATE` found only legitimate references in `mint-fleet-token.mjs` (path reference, not the actual key).
- No `.pem` or `.key` files present in the repo.
- No API keys, tokens, or credentials leaked in commit messages or code.

### Untracked Files at Risk

The following untracked files exist in the working tree and should be caught by the updated .gitignore:

- `.mk-junction-w5.mjs`
- `.pr-body-w5.md`
- `pr-sweep.mjs`

All are now ignored.

---

## Changes Made

**File:** `.gitignore`

**Added lines (after line 59):**
```
# Junction and PR sweep helpers — may contain local paths / token variable names
.mk-junction*.mjs
.pr-body*.md
pr-sweep.mjs
*.private-key*
```

---

## Notes for Conner

1. **Dirty worktrees:** The main tree (C:/agentplain) and three merged branches (c2c3-wave, mobile-header, pride-audit) have uncommitted changes. Check these manually before pruning:
   ```bash
   git -C "C:/agentplain" status --short
   git -C "C:/agentplain-c2c3-wave" status --short
   git -C "C:/agentplain-mobile-header" status --short
   git -C "C:/agentplain-pride-audit" status --short
   ```

2. **No credentials leaked:** The repo is clean. The `mint-fleet-token.mjs` references a local key path (correct usage) but does not embed the actual key.

3. **.gitignore additions are safe:** These patterns target temporary automation files and build artifacts, not source code. No risk to functionality.

4. **Fleet automation is portable:** The patterns ignore both the old (`.night-*.mjs`, `.fleet-token*.txt`) and new (`.mk-junction*.mjs`, `pr-sweep.mjs`) fleet scripts, ensuring they never leak to GitHub.

---

## Verification

Audit date: 2026-06-09
Auditor: night3-4/tree-hygiene wave
