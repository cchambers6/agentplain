# Night3 — Multi-tier overnight plan (2026-06-09)

**Coordinator turn established ground truth first. The mandate's premises shifted; the plan below is the reshaped, honest version.**

## Ground truth (all verified this turn, with artifacts)

| Fact | Evidence |
|---|---|
| Fleet App token **works** (prior "expired" blocker is gone) | `node .claude/worktrees/mint-fleet-token.mjs` → 40-char token; `GET /repos/cchambers6/agentplain` → 200 with write perms |
| `main` is at **#195** | `git log origin/main` → `218750d Merge PR #195 (report/overnight-ambition)`; night2 waves #193 value-ledger, #194 cost-aware-routing already merged |
| Only **1 open PR**: #191 (stale plan) | `GET /pulls?state=open` → `[191]` |
| Local main tree is **stale (#133) + contaminated** | `git status` → ~20 untracked wave files; `git worktree list` → 67 worktrees |
| Test runner is **green and DB/key-free** | `node --import tsx --test tests/approvals-renderer.test.ts` from main tree → 11 pass / 0 fail |
| App `ANTHROPIC_API_KEY` is **sentinel-paused** | per `SPRINT_PROGRESS.md`; LLM surfaces cannot be verified live tonight |

## Why this is NOT 8–15 "ambition waves"

The audit-resolution memory (`audit_resolution_results_2026_06_07.md`) is explicit: the fleet's dominant gap is *"the port exists, the adapter does not,"* and the remaining blockers are **credentials and decisions Conner owns** — Buildium/Qualia self-serve, EZLynx/Encompass partner-gated, Gmail/M365 consent, counsel sign-off, vendor API keys, and Conner's auto-execute threshold. **A subagent cannot unblock those overnight.** Spawning scaffolding PRs against a paused-key tree would violate the standing rules: *no quick fixes, integration-acceptance-is-functional, cite-the-artifact.*

So tonight does the work that is **both genuinely unblocked AND CI-verifiable without Conner**, and converts everything else into a crisp morning decision packet.

## The 4 waves

| # | Wave | Model tier | Verifiable by | Collision isolation |
|---|---|---|---|---|
| night3-1 | **Decision packet** — credential-gated ambition items → mobile-tappable CONNER ACTIONS (one question + recommended answer each) | opus | doc review | own worktree, docs-only |
| night3-2 | **Test-coverage hardening** — add real node tests to under-tested merged modules (value-ledger #193, cost-aware-routing #194, budget seam, resolve-reply) | sonnet | `npm test` green | own worktree |
| night3-3 | **Code-quality / simplify sweep** on the night2 merges + dead-code in the merged surface | sonnet | `npm test` + typecheck | own worktree |
| night3-4 | **Tree & worktree hygiene** — triage 67 worktrees, document safe-prune set, `.gitignore` audit for token/secret leakage | haiku | `git worktree list` diff | docs + .gitignore only |

> **Tier note:** the Agent tool exposes `opus / sonnet / haiku`, not the 5 named variants (4-8/4-8[1m]/4-7) the mandate's table assumes. Assignments map to the closest available tier and are recorded honestly in the morning report.

## Hard rules carried from memory
- Every wave: own `git worktree`, fresh token mint per push, `PRISMA_GENERATE_NO_ENGINE=true` (never `HUSKY=0` unless a *peer's* uncommitted files break the gate), commit own files explicitly.
- No merges by the fleet — Conner merges from mobile.
- CI green before a wave reports done. Dies twice → CONNER ATTENTION + move on.

## Deliverable by morning
`report: night3 results + morning decisions` PR — landed PRs, mergeable-now list, CONNER ACTIONS with recommended answers, blockers, top revolutionary items, tier cost breakdown, tomorrow's top 3.
