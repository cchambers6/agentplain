# Kaizen retro — Engineering (2026-07-02)

**Scope:** merged PRs 2026-05-03 → 2026-07-02 on `cchambers6/agentplain` (302 PRs, 667 commits to main) and `cchambers6/flatsbo` (25 PRs, #16–#40). Data pulled from git history on both repos, the GitHub Actions API, and the PR search API on 2026-07-02. Every number below is measured, not estimated; method notes at the bottom.

**Memory caveat:** the retro brief asked to load seven memories. Six do not exist on disk (`feedback_stacked_pr_backmerge_antipattern`, `feedback_rebase_union_dup_any_file_build_required`, `feedback_prepush_gate_skipped_fresh_worktrees`, `feedback_worktree_remove_force_follows_junctions`, `feedback_wait_gate_on_outcome_not_pr_number`, `reference_vercel_prisma_migrate_deploy_fragility`). Only `feedback_code_tasks_rebase_first` exists — and it is still a STUB from 2026-05-11. Where those lessons were re-derivable from git/CI evidence they appear below with citations; where they weren't, they are not asserted. The gap itself is Friction #1.

---

## 10 patterns we do well

1. **Incident → durable gate, not incident → apology.** Every production break in the window produced a permanent guard: broken main twice in one week → Layer-2 build gate in `.husky/pre-push` (documented inline, 2026-05-18); Neon outage × migrate-on-every-build → migrate gated to `VERCEL_ENV=production` (PR #307); stale-base preview failures → Layer-0 staleness gate (refuses pushes >5 commits behind origin/main).

2. **Invariants encoded as CI, not as tribal knowledge.** `connector-dispatch-coverage.yml` enforces "marketplace 'available' ⇒ dispatch route exists" (from PR #277); `schema-drift.yml` enforces "schema edit ⇒ migration exists," with a checked-in baseline (`prisma/schema-drift-baseline.sql`) and a README explaining every accepted drift line. The gates encode *why* in comments.

3. **Zero reverts in 60 days.** 667 commits to agentplain main, 0 revert commits. Forward-fix discipline is real: breakage gets a root-caused fix PR (e.g. #307, #313), not a rollback-and-forget.

4. **Fast merge cadence.** Median PR turnaround 3.9h (n=312 merged PRs); 120 merged in under an hour. For a solo-reviewer repo fed by an agent fleet, main does not bottleneck on review latency.

5. **Conventional, scoped, story-telling commit subjects.** `feat(guarantee):`, `fix(vercel):`, `chore(brand):` — 60 days of history are scannable; the subject line alone usually states both the change and the reason (`fix(vercel): build-preview db-free — gate migrate to prod`).

6. **Squash-merge discipline on feature waves.** The 2026-06-19 wave landed #295–#306 as 12 clean single commits on main; history stays linear and bisectable despite heavy multi-agent parallelism.

7. **Recipes get persisted and reused.** The fleet push/PR mechanism, the `PRISMA_GENERATE_NO_ENGINE=true` pre-push unblock, worktree path traps, and the sequential-landing rule all live as memory files with concrete commands — this retro reused three of them directly instead of re-deriving.

8. **Worktree isolation for parallel waves is now the norm.** After the 2026-05-11 shared-tree disaster (a parallel wave's `git checkout` silently reverted another wave's tracked edits), every wave runs in its own worktree — `git worktree list` today shows 10+ isolated kaizen/audit worktrees and zero cross-wave commit pollution incidents since the rule landed.

9. **Truthfulness enforced by tests.** `tests/brand-gate.test.ts` (R1 vendor names, R2 placeholders, R3 hex drift, R5 icon families) plus voice-gate keep brand/claims regressions machine-checked with fixture pairs (`tests/fixtures/brand-gate/*-violation.*` vs `*-clean.*`) rather than eyeball-checked.

10. **Audit cadence closes the loop same-day.** The 2026-07-02 ten-department audit produced findings *and* fix PRs (#322–#332) within the day, each with P0/P1 severity discipline and a memory ledger entry — audits emit work, not just documents.

---

## 10 patterns causing friction

1. **Lessons named in briefs are never written to memory.** 6 of 7 memories this retro was told to load don't exist; the 7th (`feedback_code_tasks_rebase_first`) has said "STUB — awaiting canonical mirror" since 2026-05-11. The failure modes those names describe (stacked-PR backmerge, pre-push gate skipped in fresh worktrees, `worktree remove --force` following junctions into shared `node_modules`) were expensive enough to name — and the knowledge is already gone. We pay to relearn.

2. **PR-blocking CI is path-scoped; most PRs get zero server-side checks.** On main today, only three workflows run on `pull_request`, all path-filtered: `schema-drift.yml` (prisma/**), `auth-tests.yml` (lib/auth/**), `connector-dispatch-coverage.yml` (lib/integrations/**). A PR touching `app/`, `components/`, or `lib/anything-else` runs **no** GitHub check. `npm run typecheck` exists in package.json and is wired into nothing. The audit-6 memory records the direct consequence: the #299 portal test *fails on main* with no CI coverage to have caught it.

3. **The quality gate is client-side and bypassable — and the bypass is routinized.** All lint/build/test enforcement lives in `.husky/pre-push` on the author's machine. 5 commits in the window document `HUSKY=0` / `--no-verify` / `SKIP_PREPUSH_REBASE_GATE` bypasses, and the sequential-landings memory *sanctions* `HUSKY=0` when the gate fails on other waves' files. A hook whose own runbook includes "when to skip it" is not a gate; combined with #2, a bypassed push can reach a merged PR untouched by any check.

4. **PRs are too big to review.** Of 280 measured merged PRs: average 1,285 insertions, 115 (41%) over 1,000, 12 over 5,000. PR #305 was 96 files / 7,171 insertions ("write-action depth across 9 connectors"); #162 was 10,369 insertions. At median 3.9h turnaround, a 7k-line PR is being merged on trust, not review — which is how audit waves keep finding P0s *after* merge (see #327's five P0s on the already-merged #299 portal).

5. **Schema-drift is 82% of all CI failure.** 17 failed Actions runs in 60 days; 14 were `schema-drift`. The recipe (raw-SQL/index migrations need a drift-baseline entry) has been in memory since June, but it's applied at *debug* time, after the red X — not at authoring time. Same class: duplicate migration timestamps live on main right now (8 duplicated 14-digit stamps incl. `20260531100000`, `20260603000000`, `20260617000000` — hand-minted round numbers colliding across parallel waves; the 2026-06-19 PR-heal pass fixed this once already).

6. **Merge-day batching recreates the rebase cascade the sequential rule was written to kill.** 12 PRs landed on 2026-06-19 after a dedicated "PR heal pass" (dup migration timestamps, 63-char index drift); 11 PRs are open today, all created 2026-07-02. Between batches, PRs sit — #316 and #320 (Heritage Plains, branch-dated 06-20/06-22) merged 2026-07-02, ~10 days open, and #320 had to track a moving main the whole time. The p90 turnaround (22.1h) and 3 PRs >72h are all batch-wait artifacts.

7. **The shared main tree is a junk drawer.** `git status` on `C:\agentplain` today: parked on a June-3 plan branch (5 weeks stale — the on-disk `.github/workflows/` is missing 4 of the 5 workflows that exist on origin/main), ~25 stray wave directories (`agentplain-w-hero/`, `wt-seo/`, …), one-off root scripts (`.mk-junction-w5.mjs`, `.get-token.mjs`, `pr-sweep.mjs`), stray screenshots, and `UsersconneAppDataLocalTemppr279.json` — a file literally named by the Windows-path-mangling bug the fleet-push memory warns about. Every wave that reads the "main tree" risks reading stale reality (this retro initially concluded CI had one workflow, from disk, before checking origin/main).

8. **Push/PR plumbing is re-derived per session.** The working recipe (mint `.mjs` token ≈1h TTL, inline-URL push, REST PR create, re-mint before the PR call, mask the token in output) is spread across 4+ memory files, each documenting a new trap: credential-helper quoting, bash-vs-node `/tmp` divergence, backslash worktree paths, `cmd //c` junction syntax, EPERM on the shared Prisma engine DLL. Each fleet session pays a plumbing tax before doing its actual job — this one included.

9. **Fresh worktrees are second-class build environments.** A pinned sibling worktree (like this one) has no `node_modules`; the choices are junction-to-shared (EPERM under concurrent `prisma generate` — PR #155/#156 era) or `npm ci` (~1 min, 800+ packages, per worktree per wave). With 10+ kaizen/audit worktrees live today, that's real minutes and disk multiplied per wave, and it's the pressure that produces the `HUSKY=0` bypasses in #3.

10. **flatsbo is idle-rotting with findings parked.** Zero merges since #40 (2026-05-25). The 12-loop audit synthesis (`ccb168a`, master ranked fix list) sits as a local commit on top of local main. Deliberate prioritization ("agentplain is THE priority") — but there's no keep-warm mechanism: no scheduled CI, no dependency updates, no smoke run. The cost of the eventual return grows silently, and the audit output depreciates unmerged.

---

## Top 5 process improvements

1. **PR size budget: ≤800 insertions / ≤30 files, enforced in the wave brief and checked at PR-open.** Waves must decompose (e.g. #305 was 9 connectors — that's 9 reviewable PRs or a stacked series). A one-line Actions job fails PRs over budget with an override label (`size-exception`) that requires a stated reason. **Measure:** share of merged PRs >1,000 insertions, 41% today → <15% within 30 days; P0s found by post-merge audits on freshly merged PRs → trending to 0.

2. **"No recovery without a memory" rule.** Any bypass (`HUSKY=0`), heal pass, worktree recovery, or CI-failure debug session must end by writing/updating the memory file *in the same session*, and the PR body links it. Kill the STUB state: a stub older than 7 days counts as missing. **Measure:** the 6 missing memories from this brief exist within a week; STUB count in MEMORY.md → 0; repeat-incident count (same trap, second memory entry) → tracked and ↓.

3. **Migration authoring protocol: mint timestamps at rebase time, machine-generated.** Migration dir names come from `date +%Y%m%d%H%M%S` at final rebase (never hand-typed round numbers like `…100000`), plus a required drift-baseline entry whenever the SQL contains anything Prisma's schema language can't express. Add a duplicate-timestamp check to `schema-drift.yml` (it's one `uniq -d`). **Measure:** schema-drift CI failures, 14/60d → ≤2/month; duplicate stamps on main, 8 today → 0 new.

4. **Merge-train instead of merge-day.** A ready PR merges within 24h or gets an explicit "waiting-on-X" label; overlapping-surface PRs land smallest-first per the sequential rule; open-PR count capped at ~6 before new waves dispatch. **Measure:** p90 turnaround 22.1h → <12h; PRs open >72h, 3 → 0; heal passes needed per merge batch → 0.

5. **Weekly main-tree hygiene sweep (scheduled, not aspirational).** Weekly job: `git worktree prune`, delete merged-branch worktrees, quarantine root-level strays into `.claude/worktrees/`, return the main checkout to `main` at origin. Main tree `git status` must be clean; waves must read repo state from `origin/main`, not disk. **Measure:** untracked root entries in `C:\agentplain`, ~40 today → <5; stale-disk misreads (like this retro's CI miscount) → 0.

---

## Top 3 tooling investments

1. **`fleet-ship.mjs` — one door for push+PR.** Wraps: mint token (TTL-aware, re-mint on 401), push via inline-URL with output masking, REST PR create/update, and the `PRISMA_GENERATE_NO_ENGINE` decision. Replaces the 4-memory recipe and the per-session `.get-token.mjs`/`.mk-pr.mjs` one-offs visible in today's git status. Payback: every fleet wave, immediately; deletes friction #8 and most of the Windows-path trap surface.

2. **Server-side CI floor: one `pr-checks.yml` running typecheck + unit tests + brand/voice gates on every PR.** `tsc --noEmit`, `node --import tsx --test tests/*.test.ts` (including `brand-gate.test.ts`), lint. This is the counterpart to the husky hook that cannot be `HUSKY=0`-ed, and it's what makes bypass-under-pressure (#3) safe instead of dangerous. The portal-test-fails-on-main incident is the standing proof of need. Cost: one workflow file + ~3–5 min per PR.

3. **`wt.mjs` — worktree lifecycle manager.** `wt new <name>` (forward-slash paths, branch off origin/main, node_modules strategy: junction + NO_ENGINE by default, self-`npm ci` when concurrent waves detected, verify `git worktree list` before returning) and `wt done <name>` (junction-safe teardown: remove the junction as a link *first*, never `rm -rf` through it, then `git worktree remove` + prune). Encodes the backslash trap, the junction-follow deletion hazard, and the EPERM recipe so no wave re-learns them.

---

## Fleet-Ops gaps that hurt Engineering

1. **No overlap check at dispatch time.** The sequential-landings rule requires a pre-fanout file-overlap audit, but nothing runs it — conflicts surface at push time (staleness gate, foreign-file build failures) or merge time (heal passes). Fleet-Ops should require each wave brief to declare its expected file-set and refuse/serialize overlapping dispatches. Engineering pays the rebase cascades and heal passes (#5, #6 above) when it doesn't happen.

2. **No post-wave retro step, so memory decays by default.** Waves end at "PR open." Nothing prompts "what trap did you hit; write it down" — which is exactly how six named lessons evaporated (friction #1) and how a rule file stays a STUB for 52 days. A 5-minute mandatory retro-write step in the wave template (with the PR link) converts every recovery into a recipe.

3. **No spend/observability meter on fleet work.** This brief said "report actual spend" — and there is nothing to read: no per-wave token accounting, no wall-clock ledger, no cost-per-PR. Engineering can't tune model tiers, wave sizes, or parallelism against cost, and "no ceiling" is unfalsifiable. Minimum viable: each wave logs session id, wall-clock, model, and (where the harness exposes it) token counts into `agent-state/`, aggregated weekly by the kaizen loop.

4. **Bakeoff/duplicate dispatch isn't labeled.** Today both `wt-kaizen-1` (branch `kaizen/engineering-retro-2026-07-02`, committed but no PR) and this `wt-kaizen-1-fable` run exist for the same retro, discoverable only by collision at `git worktree add`. If it's a deliberate bakeoff, the brief should say so and name the comparison judge; if it isn't, Fleet-Ops double-dispatched. Either way Engineering burns a duplicate wave without a decision rule for which output wins.

---

## Method + spend

- **PR counts/sizes:** `git log origin/main --since=2026-05-03` with first-parent shortstats on merge commits (n=280 sized) plus squash-commit shortstats; flatsbo via local `git log` (last merge #40, 2026-05-25).
- **CI:** GitHub Actions API, runs created ≥2026-05-03: 347 total, 17 failed (schema-drift 14, e2e 2, auth-tests 1). Workflow triggers read from `origin/main`, not the (stale) working tree.
- **Turnaround:** PR search API, 312 merged PRs: median 3.9h, avg 9.3h, p90 22.1h, 120 <1h, 28 >24h, 3 >72h. Open PRs at time of writing: 11 (#322–#332, all created 2026-07-02).
- **Spend:** single inline session (no multi-agent workflow), ~35 tool invocations, one worktree created, one PR opened. Exact token spend is not exposed to this session — see Fleet-Ops gap #3; reporting a number would be fabrication.
