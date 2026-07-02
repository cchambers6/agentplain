# Kaizen — Engineering Retro (Table-Run)

**Date:** 2026-07-02
**Window analyzed:** 2026-05-03 → 2026-07-02 (60 days)
**Scope:** `agentplain` + `flatsbo`, both `cchambers6/*`
**Method:** merged-PR history, `.husky/pre-push`, `.github/workflows/*`, `prisma/migrations/`, `next.config.mjs`, `docs/incident-log.md`, git merge-cadence analysis, plus the engineering memory files.

> Every pattern below cites a real PR, commit, file, or measured count. Nothing is invented.

---

## The shape of the 60 days (baseline facts)

| Metric | agentplain | flatsbo |
| --- | --- | --- |
| PR merges | **289** (PR #7 → #321) | ~40 (PR #9 → #40) |
| Non-merge commits | 378 | 99 |
| Last merge in window | 2026-07-02 | **2026-05-31** (dormant since) |
| Conventional-commit prefix adherence | 311/378 = **82%** | — |
| Migration timestamp collisions | **8 duplicate prefixes** | — |
| Registered git worktrees | **199** (164 sibling `C:\agentplain-*` dirs) | — |

agentplain runs at ~4.8 merged PRs/day; flatsbo has been intentionally frozen since 2026-05-31 (consistent with the "agentplain is THE priority" mandate). This is a **high-throughput, agent-built, worktree-parallel** engineering org. The friction below is the tax that throughput is currently paying.

---

## 10 patterns we do well

1. **Ratcheting quality gates.** `brand-gate` and `voice-gate` (`.husky/pre-push` Layers 1.5) fail only on *new* violations against a frozen baseline — enforcement without a big-bang cleanup blocker. Wired once the baseline hit zero (PRs #227–#234 for brand; #309-era for voice). This is the right way to introduce a gate into a live codebase.

2. **Root-caused the Neon deploy fragility instead of papering over it.** `scripts/prisma-migrate-gate.mjs` (PR #307) gates `prisma migrate deploy` to `VERCEL_ENV=production`. It fixed two real problems at once: (a) transient Neon P1001 blips reddening *every* open PR's preview build, and (b) preview builds silently mutating the shared production schema. The file's header comment is a model post-mortem.

3. **Rebase-first is enforced, not just documented.** `.husky/pre-push` Layer 0 blocks any push whose branch is >5 commits behind `origin/main`, with a named escape hatch (`SKIP_PREPUSH_REBASE_GATE=1`). This is why agentplain has essentially **zero stacked back-merges** (see friction #9 for the contrast).

4. **Gates were born from a written incident.** The Layer 2 build gate exists because main shipped broken twice in one week (`docs/incident-log.md`, 2026-05-18: the `verify-knowledge-seed.ts` TS error + `/app/verify` cookie crash). The learning loop — incident → root cause → gate — is real and rare.

5. **Schema-drift auto-heal converts a jailbreak into a legitimate path.** Layer 3 of the hook auto-appends raw-index (`GIN`/`trgm`/`pgvector`) `DROP INDEX` lines to the drift baseline instead of leaving `HUSKY=0` as the only exit — narrowing the bypass surface while keeping all *other* drift loud.

6. **Invariant gates, not just style gates.** `connector-dispatch-coverage.yml` + `check:connector-dispatch` encode a product invariant: any connector marked `status:"available"` **must** have a live dispatch route. Added (PR #277) after the "every button silently 404s" triage. Enforcing invariants in CI is a maturity signal.

7. **Worktree-isolated parallelism.** The fleet runs dozens of concurrent waves in isolated worktrees, which is what makes ~5 PRs/day sustainable at all. The pattern itself is sound (the *lifecycle* around it is the debt — friction #6).

8. **Traceable PR/branch naming.** Branches carry `type/topic-date` (`feat/docusign-approval-gate-2026-06-15`); 82% of commits use conventional prefixes. History is navigable without a tracker.

9. **Roll-forward culture, honestly.** Near-zero reverts in 60 days; breakage is fixed forward with named fixes (e.g. `fix/silent-fail-loud-hardening` #239 turned silent failures into loud ones). No churn-y revert/re-land noise on main.

10. **Backward-compat discipline on IA changes.** The 13→5 tab collapse shipped with 308 redirects in `next.config.mjs` for every dropped route (`/help`, `/fleet`, `/how-it-works`) — no dead bookmarks, no onboarding deep-link 404s.

---

## 10 patterns causing friction (with real evidence)

1. **Critical gates are local-only; CI has no backstop.**
   CI (`.github/workflows/`) runs only **auth-tests**, **connector-dispatch-coverage**, and **schema-drift** on PRs. There is **no GitHub Actions job** that runs `lint`, `typecheck`/`build`, `brand-gate`, `voice-gate`, the unit suite (`npm test`), or the UI suite (`npm run test:ui`). All of those live *only* in `.husky/pre-push` — and the hook is bypassable three ways (`HUSKY=0`, `--no-verify`, `SKIP_PREPUSH_REBASE_GATE=1`) with **zero** server-side detection. Every bypass is a silent, unrecoverable hole.

2. **The `typecheck` gate is dead code.**
   `package.json` defines `"typecheck": "tsc --noEmit"` but `grep` across `.husky/`, `.github/`, and `scripts/` shows it is **invoked nowhere**. The only typechecking is `next build`, which — per the 2026-05-18 incident-log entry — does **not** compile files outside the App Router graph. That is precisely how the `scripts/verify-knowledge-seed.ts` TS error reached main. TS in `scripts/`, `tests/`, and tooling remains ungated today.

3. **An acknowledged CI follow-up has sat open for 45 days.**
   The 2026-05-18 incident-log entry literally says: *"A pre-merge GitHub Actions build would be the next defense; tracked as a follow-up."* As of 2026-07-02 no such workflow exists. The single highest-value fix has been named and un-actioned for six weeks.

4. **Migration timestamp collisions from parallel authoring.**
   `prisma/migrations/` has **8 colliding timestamp prefixes**, e.g. `20260603000000_operator_fleet_activity_indexes` **and** `20260603000000_support_draft_into_review`; `20260617000000_add_vertical_mcp_providers` **and** `20260617000000_memory_scale_rls_tiering_byo` (also `…531100000`, `…531200000`, `…610000000`, `…615120000`). Timestamps are hand-forged sequence counters — some are *invalid datetimes* (`…529300000` = hour 30, `…528400000` = hour 40). Prisma orders migrations lexicographically, so same-prefix pairs have **nondeterministic relative order** — a latent prod-vs-preview drift bug. The `schema-drift` gate can't catch it (collisions aren't drift).

5. **Batch rubber-stamp merging — no per-PR review turnaround.**
   **162 of 289 merges (56%) landed within 90 seconds of the previous merge.** Peak bursts hit **5 PRs in a single minute** (2026-06-14 23:03, 2026-06-10 16:44, 2026-05-16 23:45). This is a human clicking "merge" down a stack, not reviewing PRs. With no required CI check (friction #1), nothing independent actually vetted those PRs before they hit main.

6. **Worktree sprawl with no lifecycle.**
   `git worktree list` = **199 entries**; **164** sibling `C:\agentplain-*` directories on disk; **0** pruned. The memory record documents the resulting corruption class: backslash-path worktrees nesting under `C:/agentplain` and a later `rm -rf` deleting the *actual* worktree (recurred twice — PRs #260 and the marketing wave), `prisma generate` EPERM on junctioned `node_modules`, and stray unexpanded-variable junctions breaking `next build`. Every wave pays this tax fresh.

7. **Repeated-surface rework — symptom fixes before root cause.**
   Passkey/auth was reworked across **6 PRs** in the window (#53, #101, #171, #267, #268, #279); the iOS root cause (`rpId` from request host) wasn't isolated until #171, then WebAuthn hints needed #267/#268. Plaino chat: **3 PRs** (#116, #154, #251). Plaino orb-clip: **2** (#242, #266). fix/ branches = 41 vs feat/ = 136. A meaningful slice of throughput is re-touching the same surface.

8. **Rebase cascade under batch landing.**
   When 5 PRs land in a minute (friction #5), the base moves under each subsequent branch, but they were built and gate-checked against an older `main`. The only guard is the pre-push 5-commit staleness gate — which is bypassable and only trips at >5 behind. PRs land having *never* been built against the tree they merge into.

9. **flatsbo's stacked back-merge antipattern (the cautionary contrast).**
   On 2026-05-08 flatsbo merged `origin/main` into **6 feature branches simultaneously** (identical `20:46:02` timestamps: automation-pr-a, local-lint-gates, lint-required-status-check, vercel-deploy-failure-alerting, agent-layer-protection, branch-protection-rulesets). Stacked back-merges tangle history and make each branch's diff-vs-main unreadable. agentplain avoids this via rebase-first (do-well #3) — but the discipline lives only in agentplain's hook, not flatsbo's.

10. **The fleet push/PR mechanism is re-derived from memory every wave.**
    No `gh` CLI exists in this environment. Pushing a fleet branch and opening its PR requires a hand-rolled mint-token + inline-credential-helper + REST-`curl` dance, and the memory (`project_fleet_push_pr_mechanism`) catalogs **five** distinct traps that have each bitten a real PR: token TTL (~1h) expiring mid-build-gate → 401 (PRs #140/#141), the bash-vs-node `/tmp` path divergence, the credential-helper quoting trap (#150), the backslash-worktree nesting trap (#260), and non-fast-forward force-push blocks (#145). This is undifferentiated, error-prone toil on the critical path of *every* PR.

---

## Top 5 process improvements (concrete · actionable · measurable)

### 1. Ship the pre-merge CI gate (`ci.yml`) — closes the 45-day-old follow-up
Add one GitHub Actions workflow, `on: [pull_request, push: branches:[main]]`, running the full local gate server-side: `lint` → `typecheck` → `build:no-migrate` → `brand-gate` → `voice-gate` → `test` → `test:ui`. Mark it a **required status check** on `main`.
- **Measure:** server-enforced gates today = 3 (auth, dispatch, drift) → **9**. Target: 100% of merged PRs show a green required `ci` check. `HUSKY=0`/`--no-verify` stops being a silent hole because CI re-runs everything.
- **Effort:** ~half a day. This single change neutralizes friction #1, #2, #3, #5, and #8.

### 2. Kill migration collisions at the gate
Replace hand-forged timestamps with a `scripts/new-migration.mjs` helper that stamps monotonic real timestamps, and add a `check:migration-collision` step (fail on any duplicate `^\d{14}` prefix or invalid datetime) into the CI job and pre-push.
- **Measure:** duplicate-prefix collisions in `prisma/migrations/` = **8 → 0**; new collisions blocked at PR time, not discovered in prod.
- **Effort:** ~2 hours (the check is a 15-line script).

### 3. Wire the dead `typecheck` and make it cover `scripts/` + `tests/`
Add `npm run typecheck` to both `.husky/pre-push` (before the build gate) and `ci.yml`. This catches the exact class (`scripts/verify-knowledge-seed.ts`) that `next build` structurally misses.
- **Measure:** `typecheck` invocations = **0 → every push/PR**; TS-error-in-tooling shipped-to-main incidents (1 in window) → 0.
- **Effort:** ~1 hour; may surface a backlog of latent errors in scripts/tests (that's the point).

### 4. Make gate bypasses accountable
The incident-log already mandates a bypass ledger — and it is **empty** (`| — | — | — |`) despite documented repeated `HUSKY=0` use. Add a CI check that fails a PR whose head was pushed with a bypass unless a matching `docs/incident-log.md` ledger row exists (detectable via a pushed marker file or a `bypass:` trailer in the commit).
- **Measure:** bypass ledger coverage = **0% → 100%** of bypasses logged with SHA + reason + follow-up.
- **Effort:** ~2 hours.

### 5. Worktree lifecycle: `wt` helper + weekly GC
Ship `scripts/wt.mjs` wrapping create (forward-slash paths, `git worktree list` verify-before-write, junction/`PRISMA_GENERATE_NO_ENGINE` baked in) and `wt gc` (prune worktrees whose branch is merged or gone). Run `wt gc` in the existing kaizen weekly loop (PR #273).
- **Measure:** registered worktrees **199 → <20 active**; recurring backslash-nesting corruption incidents → 0 (they become impossible by construction).
- **Effort:** ~half a day.

---

## Top 3 tooling investments

### 1. Pre-merge CI pipeline (highest leverage by a wide margin)
This is process-improvement #1 as a durable asset, and it subsumes the "brand-gate improvements" and "deploy pipeline hardening" the data points to: brand-gate/voice-gate become **server-enforced** (not local-only), and the build gate the incident log asked for on 2026-05-18 finally exists. One workflow removes the entire "local gate silently bypassed → red main → downstream waves rebase onto breakage" failure class. **Build this first.**

### 2. Playwright: promote the revenue-path suite from nightly-inbox to PR-gating
Today `e2e-nightly.yml` runs the suite (#247/#272) on a `cron` and pipes failures to an inbox — breakage is found *hours after merge*. Add a **PR-gating smoke subset** that runs the highest-value specs (signup → first value, approvals, connector dispatch) against the Vercel **preview URL** for the PR. This is the gate that would have caught the "every button 404s" class (#277) *before* merge instead of in a nightly report. Expand coverage beyond auth (the only surface with true PR-time test coverage today).

### 3. Fleet-ops toolchain (retire the per-wave toil)
Three small tools that each pay for themselves within a week: **(a)** a durable, owned push+PR helper (install `gh`, or a single hardened `scripts/fleet-pr.mjs` that mints-just-in-time and inlines the token) so no wave re-derives the 5 documented traps; **(b)** the `wt` worktree helper from process #5; **(c)** the migration-collision linter from process #2. These are the recurring, undifferentiated costs the fleet pays on the critical path — codify them once.

---

## Fleet Operations gaps that hurt Engineering

**1. Librarian YAML staleness — process docs cite memories that don't exist.**
This retro was instructed to load 7 engineering memories. **Only 2 exist** (`feedback_code_tasks_rebase_first`, `project_prisma_no_engine_unblocks_prepush`). The other five are dangling links: `feedback_stacked_pr_backmerge_antipattern`, `feedback_rebase_union_dup_any_file_build_required`, `feedback_prepush_gate_skipped_fresh_worktrees`, `feedback_worktree_remove_force_follows_junctions`, `feedback_wait_gate_on_outcome_not_pr_number`, `reference_vercel_prisma_migrate_deploy_fragility`. Worse, the one canonical rule that *is* referenced — `feedback_code_tasks_rebase_first` — is a **52-day-old STUB** whose own body says *"content awaiting canonical mirror from orchestrator-source."* The consequences are directly upstream of friction #6 and #10: because the worktree-corruption and fleet-token lessons were never written to canonical memory, **every wave re-derives them from scratch.** Fix: the Librarian owns writing these six files (the raw material exists in `project_fleet_push_pr_mechanism` and this doc) and de-stubbing the rebase rule.

**2. Dispatch reliability — the adapter substrate lags the marketing surface.**
The `connector-dispatch` gate (#277) was added *reactively* after connectors marked "available" silently 404'd on every agent action. The gate now blocks *new* gaps, but the MCP smoke waves (2/3) record that most advertised connector-mcp endpoints still 404 — the invariant is enforced going forward, the backlog of thin adapters is not. Engineering keeps absorbing "connector X doesn't actually work" as unplanned fix PRs.

**3. No cross-repo gate reconciliation.**
flatsbo's own PRs #17–#22 built things agentplain lacks: **branch-protection rulesets**, a **lint-required status check**, and **Vercel deploy-failure alerting**. agentplain has things flatsbo lacks: brand/voice gates, the migrate-gate, schema-drift auto-heal. Two repos, divergent gate maturity, and no Fleet-Ops function reconciling the best of each. agentplain's missing pre-merge CI (friction #1) is partly a flatsbo lesson (`feat/lint-required-status-check`) that never crossed over.

**4. Fleet-token mechanism is un-owned infrastructure.**
Covered in friction #10 — flagged here because it is a Fleet-Ops responsibility, not an individual-wave one. The ~1h token TTL expiring mid-gate is a systemic constraint (two back-to-back build gates can outlast a token), and the fix (just-in-time re-mint before the REST call, or an owned helper) belongs to the platform, not to each engineer.

---

## Bottom line

The engineering org is **fast and disciplined where discipline is codified** (rebase-first, ratcheting gates, incident-driven learning, honest roll-forward) and **fragile exactly where enforcement is local, manual, or unwritten**: no server-side CI backstop, a dead typecheck gate, hand-forged migration timestamps, 199 un-GC'd worktrees, and canonical lessons that live in agents' heads instead of the Librarian's files. **One change — a required pre-merge CI gate — closes the single largest hole and makes the fast merge cadence safe rather than risky.** Everything else is small, scriptable, and measurable.

---

### Appendix — how to reproduce these numbers
```
# merge volume + cadence
git log origin/main --merges --since=2026-05-03 --pretty="%ct|%s" \
  | awk -F'|' 'NR>1{d=p-$1; if(d<=90&&d>=0)b++} {p=$1;t++} END{print b" of "t}'
# migration collisions
ls prisma/migrations/ | grep -oE '^[0-9]{14}' | sort | uniq -d
# gate coverage
grep -Rn 'run:' .github/workflows/     # server-side
sed -n '40,90p' .husky/pre-push        # local-only
grep -rn typecheck .husky .github package.json scripts   # dead gate
# worktrees
git worktree list | wc -l
# rework churn
for t in passkey plaino-chat orb-clip; do git log origin/main --merges \
  --since=2026-05-03 --pretty=%s | grep -iE "$t" | grep -oE '#[0-9]+'; done
```
