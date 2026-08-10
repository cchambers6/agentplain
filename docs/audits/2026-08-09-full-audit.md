# agentplain — full audit, 2026-08-09

**Pinned to `origin/main` @ `5606114b446f6b8cccdf865eaa7532eb3826d542`** (2026-07-12 00:26:55 -0400, "fix(pilot): P0 bundle … (#389)").
Every claim below cites a sha, a file:line, a command output, or a timestamp. Items I could not verify are labelled **UNVERIFIED** rather than inferred.
Audit worktree: `C:/agentplain/agentplain-audit-0809` (detached from `origin/main`, verified `git rev-parse HEAD` = 5606114 before any read).

---

## (a) Executive summary

1. **`origin/main` has not moved in 28 days** (last commit 2026-07-12) while **8 CI-green PRs sit unmerged** and **3 commits sit unpushed on local `main`**. The fleet is building; nothing is landing.
2. That single stall is upstream of most of what follows: the brand/voice zero-baseline, the pricing fix, and the trust scaffolding are all *written and green* — just not on main.
3. **Main is healthy where it counts**: `build:no-migrate` exits 0, there are zero conflict markers, and the pre-push husky gate is **installed and functional** (7 layers) — the "known no-op" in memory is stale.
4. **The L3 loop is not merely frozen — it never ticked.** `state.yaml` shows `pass_number: 1`, `last_tick_at: null`, 5 of 9 tracks never run.
5. Diagnosis: the fleet-side heartbeat is a **deliberate no-op** — its own prompt says "~800 wasted ticks" and instructs it to write nothing while deferred. It ticks without committing *by design*.
6. **The fix already exists and is one manual run from proving out**: `agentplain-loop-governor` is staged on the capable scheduler, enabled, never executed. It waits on Conner.
7. **Customer-facing billing drift is live**: the RAG corpus still sells Partner as "4 hrs/mo reserved time" + "monthly business review", contradicting `facts.ts` on two ratified points.
8. **Only 3 verticals are live** (real-estate, cpa, law) — and **property-management is one line from live**: its daily sweep already runs, but the readiness manifest doesn't list it, so PM signups are sent to the waitlist for nothing.
9. **Two credential files sit untracked-but-unignored in the repo root**, one `git add -A` from being committed.
10. **Both schedulers were dark 2026-08-06 → 2026-08-09**, and the watchdog that should have caught it is on the dead scheduler.

**Good news worth recording:** connector dispatch is fully covered (15/15), the DocuSign no-outbound gate is wired and passing 15/15, and vendor-invisibility is clean. Three memory items were stale in our favour.

---

## (b) Findings

### P0

| # | Finding | Evidence |
|---|---|---|
| P0-1 | **Delivery stall.** `origin/main` unchanged for 28 days. 8 CI-green PRs unmerged (#380, #390–#396); 3 commits unpushed on local `main` (`9171f9d`, `0b983a7`, `469f4f5`). Nothing reaches production. | `git log origin/main -1` → `5606114` @ 2026-07-12; `git rev-list --left-right --count origin/main...HEAD` → `0  3`; GitHub REST `/pulls?state=open` → 10 open, all `combined=success` |
| P0-2 | **Plaintext GitHub tokens in the repo root, unignored.** `.flt` holds a GitHub App installation token (`ghs_3714103_…`, exp 2026-08-03 — expired). `.claude/check-flatsbo-prs.mjs:1` holds a second hardcoded `ghs_` token. Neither is tracked *nor* gitignored → one `git add -A` from being committed. `.gitignore` covers `*.pem` and `.claude/worktrees/` but not these. | `git check-ignore .flt` → exit 1 (not ignored); `git ls-files --error-unmatch .flt` → not tracked; `.claude/check-flatsbo-prs.mjs:1` |
| P0-3 | **Loop never ran.** `memory/data/loop/state.yaml` on main: `pass_number: 1`, `last_pass_completed_at: 2026-07-02T20:00:00Z`, `last_tick_at: null`, `tick_metrics: []`, `stalls_logged: 0`. 5 of 9 tracks at `passes_completed: 0` (product-owner, tab-audit, agent-audit, business-model, vertical-priority). | `git show origin/main:memory/data/loop/state.yaml`; last commit touching it `dfd788b` @ 2026-07-04 |

### P1

| # | Finding | Evidence |
|---|---|---|
| P1-1 | **Billing SSOT drift reaching customers.** `lib/knowledge/seed-data.ts:689` sells Partner as "Named-service-partner with **4 hrs/mo reserved time** … reserved hours each month … and **monthly business review**." Contradicts `facts.ts` twice: `PARTNER_SUPPORT.includesConnerTime = false` and `quarterlyAsyncCheckIn: true`. Seeded to the RAG corpus by `scripts/seed-knowledge.ts` — the corpus customer chat retrieves from. This is the exact leak vector flagged in `project_voice_hygiene_zero_baseline_2026_07_19`. | `lib/knowledge/seed-data.ts:689` vs `lib/billing/facts.ts:65,78-85` |
| P1-2 | **Two operator pages have no authorization assertion.** `app/(operator)/operator/tickets/page.tsx` and `…/tickets/[ticketId]/page.tsx` contain no `isOperator` / `requireOperator` / `requireUser` / `redirect`. The other **17 of 19** operator pages all assert. They read support threads across all workspaces relying on the layout redirect alone. Open since 2026-07-02 (INBOX `p1_operator_tickets_pages_layout_only_auth`). | grep over all 19 `app/(operator)/**/page.tsx` — 17 OK, 2 MISS |
| P1-3 | **Only 3 verticals are live**, not 4+general — and **property-management is one line from live, blocking revenue for no reason.** Its daily sweep `propertyManagementRentCollectionChaseSweepFn` **exists and auto-registers** (`lib/inngest/functions/property-management-rent-collection-chase-sweep.ts:264`, cron `0 12 * * *`), structurally identical to the CPA sweep that *is* trusted. The only thing missing is the string `'property-management-rent-collection-chase'` in `SKILLS_WITH_PRODUCTION_CALLER`. Until it's added, the signup gate sends every PM customer to the waitlist while the workflow runs daily. Separately, `general` → `no-killer-workflow-defined` even though `invoice-chase-general` **is** in the manifest with a live sweep — orphaned because no vertical maps to it. | Ran `resolveVerticalReadiness` over all 11 slugs → `SUPPORTED COUNT: 3 of 11`; `verticalReadinessSelfCheck()` → `[]`; `lib/verticals/readiness.ts:103-118,63-76`; sweep file confirmed exporting `inngest.createFunction` |
| P1-4 | **Both schedulers were dark ~3.5 days** (2026-08-06 → 2026-08-10T00:46Z). `agentplain-audit-queue-seeder-local` is `*/30` but last ran 2026-08-06T13:45Z (~165 missed slots). Three tasks then fired within 60 ms of each other at 2026-08-10T00:46:27Z — a catch-up burst on app open, i.e. the scheduler only runs while the desktop app is open. **`scheduler-liveness-watchdog`, the task that exists to catch this, last ran 2026-08-06T11:55Z** — the watchdog is on the dead scheduler. | `list_scheduled_tasks` — `lastRunAt` fields |
| P1-5 | **The memory/telemetry write-back layer is inert.** `INBOX.md` is 170 KB, mtime 2026-07-02 — no Librarian roll-up in 5 weeks. `memory/data/conner-queue.yaml` `pending:` contains only commented examples. `memory/data/budget-state.yaml` still reads week `2026-06-15 → 2026-06-22`, `spent_usd: 0`. `pending-fires.yaml` has 0 entries. | file mtimes + `grep -c "^  - id:"` → 0 |

### P2

| # | Finding | Evidence |
|---|---|---|
| P2-1 | **Brand/voice gates pass but not at zero.** `brand-gate` → "11 known baseline violation(s); 0 new". `voice-gate` → "Baseline: 31 \| Found: 24 \| New: 0". The zero-baseline work is in **unmerged PR #390** — memory's "ZERO baseline" describes the branch, not main. | `npm run brand-gate`, `npm run voice-gate` on 5606114 |
| P2-2 | **voice-gate ratchet has 7 slots of slack.** Baseline declares 31, only 24 exist. Up to 7 new tics can land without failing the gate. | same output as P2-1 |
| P2-3 | **Billing SSOT is advisory, not enforced.** Only **5** files import `lib/billing/facts.ts`; ~30 customer surfaces hardcode "7-day"/"14-day" as literals. Values currently agree — nothing keeps them agreeing. | `grep -rln "billing/facts"` → 5; ~30 literal hits across `app/(marketing)`, `app/(product)` |
| P2-4 | **PR #367 is obsolete, not mergeable.** `chore(loop): seed state.yaml queue` — `mergeable=false`, `state=dirty`, 37 days old, conflicts with main on `state.yaml`; superseded by the v3 reseed in #349 (`dfd788b`). Should be **closed**, not merged. | REST `mergeable=false`; `git merge-tree` → conflict |
| P2-5 | **PR #351 is a DRAFT and off-topic.** `feat(dewpoint): find and interpret dew-point predictions`, author `cchambers6`, 934 additions, 37 days old, unrelated to agentplain. Drafts cannot be merged from mobile — a standing violation. | REST `draft=true`, `user.login=cchambers6` |
| P2-6 | **Next.js pinned 14.2.18** (CVE-2025-29927 middleware bypass; patched 14.2.25). Impact here is limited: `middleware.ts` only sniffs cookie *presence* and real authorization lives in route handlers — but it is the outer layer in front of the two unguarded pages in P1-2. | `package.json:42`; `middleware.ts:1-16,38-45` |
| P2-7 | **Two silent import failures in the build.** `'useActionState' is not exported from 'react'` (`ClosureConfirmForm.tsx`) and `'captureCheckIn' is not exported from '@sentry/nextjs'` (`lib/observability/cron-monitor.ts`) — the latter means cron check-in monitoring is a no-op. Build still exits 0. | `build:no-migrate` log |
| P2-8 | **Repo-root clutter, untracked and unignored**: `output-file`, `.depfile`, `.l3probe`, `.l3probe2`, `.l3-write-probe`, `UsersconneAppDataLocalTemppr279.json`, plus ~30 stray worktree directories. | `git status`; `git check-ignore` |

### Verified healthy (memory was stale — in our favour)

| Item | Status | Evidence |
|---|---|---|
| Pre-push husky gate | **Installed and functional**, not a no-op. `core.hooksPath=.husky/_`, shim → `h` → `../pre-push`. 7 layers: staleness, lint, brand-gate, voice-gate, connector-dispatch, build, schema-drift. | `git config core.hooksPath`; `.husky/_/pre-push`; `.husky/pre-push` |
| `build:no-migrate` on main | **Passes**, exit 0 | background run, exit 0 |
| Rebase/union damage | **None** — zero conflict markers repo-wide | grep for `<<<<<<<` / `>>>>>>>` |
| Connector MCP dispatch | **Fully covered** — "26 catalog entries, 15 available, 15 with a dispatch route". The 5-connector 404 issue is fixed. | `npm run check:connector-dispatch` |
| DocuSign no-outbound gate | **Wired and passing 15/15**, incl. send-without-token rejected, void, expiry, cross-envelope replay, cross-workspace | `node --test lib/integrations/docusign-mcp/*.test.ts` |
| Vendor invisibility | **Clean** — 3 hits, all `Anthropic` on `/privacy` + `/security` (the ratified subprocessor exception) | grep over `app/(marketing)`, `app/(product)`, `components/` |
| `lib/billing/facts.ts` | **Intact** — trial 7, extended 14 (cpa/law), money-back 14, card-at-signup true, Conner-time = max only | `lib/billing/facts.ts:27-85` |
| Vertical readiness invariants | `verticalReadinessSelfCheck()` → `[]` | executed |

---

## Item-by-item detail

### 1. Repo / main health
- HEAD `5606114b446f6b8cccdf865eaa7532eb3826d542`, 2026-07-12 00:26:55 -0400. **28 days with no commit.**
- Unpushed on local `main` (3): `9171f9d` voice+brand zero baseline (2026-07-19), `0b983a7` placeholder launch gate (2026-07-19), `469f4f5` docs/incident-log (2026-08-02).
- **Merge-order trap:** PR #390's head sha **is** `9171f9d` — identical to the local unpushed commit, so pushing local `main` auto-closes #390. PR #391's head (`d6da50f`) is a *different* sha from local `0b983a7` with the same content, so pushing first would leave #391 showing an empty/conflicting diff. **Land the PRs on GitHub first, then rebase local main — not the reverse.**
- Build gate: real. Husky: installed. No rebase-union damage.

### 2. Open PRs (10)
All 10 are CI-green (`combined=success`). 9 mergeable/clean, 1 dirty.

| PR | Age | State | Size | Note |
|---|---|---|---|---|
| #396 | 15d | clean | 4f +110/−21 | pricing facts from SSOT |
| #395 | 21d | clean | 12f +88/−27 | model-routing propagation |
| #394 | 21d | clean | 18f +360/−27 | vertical value-bar |
| #393 | 21d | clean | 13f +321/−99 | click-path closeout (3 CI checks incl. connector-dispatch) |
| #392 | 21d | clean | 13f +795/−0 | trust / social proof |
| #391 | 21d | clean | 16f +79/−953 | placeholder launch gate (brand-gate check green) |
| #390 | 21d | clean | 36f +122/−416 | voice+brand ZERO baseline |
| #380 | 30d | clean | 10f +1050/−0 | AI Headmaster POC plan (docs) |
| #367 | 37d | **dirty** | 1f +158/−0 | obsolete → close |
| #351 | 37d | **DRAFT** | 8f +934/−0 | off-topic, author `cchambers6` |

Every fleet[bot] branch from the 2026-07-19/07-25 wave was built, went green, and was never merged.

### 3. The L3 loop — diagnosis
State (above) shows the loop at pass 1 with `last_tick_at: null`. The cause is documented in the heartbeat's own prompt:

`C:\Users\conne\Claude\Scheduled\agentplain-loop-heartbeat\SKILL.md` (regenerated 2026-07-19) states:
> "KNOWN RUNNER CONSTRAINT (verified 2026-07-19, ~800 wasted ticks): this scheduled-task environment has NO dispatch tooling … and NO writable checkout of main … every tick will be a DEFERRED no-op."

Step 3 of that prompt instructs: if dispatch is absent **and** main's sha is unchanged **and** pass_number is unchanged, "**append nothing, write nothing else anywhere**". So: **the loop ticks without committing, by design.** `last_tick_at: null` is the designed output of a deferred tick, not evidence of a crash.

Status ledger `…/agent/memory/data/l3-heartbeat-status.txt` contains exactly one line:
`2026-07-19T20:02:36Z | dispatch=absent | main=5606114 | pass_number=1 | verdict=DEFERRED` (mtime 2026-07-19).
Because the design suppresses writes when nothing changes — and main's sha genuinely has not changed since 2026-07-12 — **whether the heartbeat has ticked at all since 2026-07-19 is UNVERIFIED**: the fleet-side scheduler stores no run records (only `SKILL.md`), so both "ran and correctly wrote nothing" and "never ran" produce this identical evidence.

**The fix is already built and staged.** `agentplain-loop-governor` exists on the Claude Code scheduler, `enabled: true`, `schedule: "Manual only"`, and **has no `lastRunAt` — it has never been executed.** Its own description: "First manual run = the mode-2 acceptance test. Conner adds the */30 cron only after that passes AND the fleet-side `agentplain-loop-heartbeat` is disabled (one governor only)."

**Caveat on the runner-incapability premise.** The `fire-path-probe-2026-07-19` result concludes a scheduled session cannot push — but the probe used the *ambient git credential helper*, and its own last line concedes "a token-injected push URL remains untested as a possible workaround." That token-injected path is the documented working recipe in `project_fleet_push_pr_mechanism`, and it is what this audit used successfully to reach the GitHub API. So **"the runner cannot write to the repo" is UNPROVEN** — the probe tested one mechanism and generalised. Re-probe with the mint-token path before accepting the constraint.

### 4. Production config (Vercel, Production scope)
29 variables set. Load-bearing flags:

| Variable | State | Age |
|---|---|---|
| `ANTHROPIC_API_KEY` | **SET** | 68d |
| `FLEET_TRUSTED_HUMAN_EMAIL` | **SET** | 56d |
| `STRIPE_CHECKOUT_ENABLED` | **SET** (value encrypted) | 70d |
| `BUILDIUM_ADAPTER_LIVE` | **NOT SET** | — |
| `LLM_DEGRADED_MODE` | **NOT SET** | — |

Also set: `DATABASE_URL`, `DATABASE_URL_DIRECT`, `ENCRYPTION_KEY`, `SESSION_PASSWORD`, `STRIPE_SECRET_KEY`/`PUBLISHABLE_KEY`/`WEBHOOK_SECRET`, `RESEND_API_KEY`, `SENTRY_*`, `GOOGLE_OAUTH_*`, `MICROSOFT_OAUTH_*`, `INNGEST_*`, `MCP_API_KEY`, `NOTION_API_KEY`, `APP_PUBLIC_ORIGIN`, `OPERATOR_EMAIL_ALLOWLIST`, `GMAIL_WEBHOOK_*`, `GOOGLE_PUBSUB_TOPIC`.

Two limits, stated plainly: variable **values** were not read (`vercel env pull` was denied in this session), so `STRIPE_CHECKOUT_ENABLED`'s value is **UNVERIFIED** — only its presence is confirmed. And whether the `ANTHROPIC_API_KEY` *credential* is paused at the provider is not determinable from Vercel; **UNVERIFIED** here. Pausing is recorded as intentional budget policy and is not flagged as a defect.

### 5–8
Covered in the findings tables above (P1-1 / P2-1..3 billing; P2-1..2 brand; P1-3 verticals; connectors + DocuSign under "Verified healthy").

### 9. Test suite
`npm test` on `origin/main`: **5849 tests, 5787 pass, 41 fail, 21 skipped, 1269 suites** (401 s). The failure count is **exactly the 41 recorded 5 weeks ago** — no regression, and no progress either.

The 41 are not 41 independent bugs. They cluster:

- **~15 stale Inngest tests — NOT a production gap.** Tests like `route.ts references monthEndCloseCpaSweepFn` and `serve route file literally references processWebhookEventFn` grep `app/api/inngest/route.ts` for literal function names. That array was **deliberately removed**: the route now auto-derives from `lib/inngest/registry.ts` via `require.context("./functions", …)`, and the file's own header says "DO NOT add a function array here … Do NOT modify this file." All 50 function files sit directly under `lib/inngest/functions/` and are picked up at build time; the build passes, so the registry's duplicate-id guard resolved cleanly. **The tests assert a removed implementation detail.** They cannot be run outside webpack (`require.context is not a function` under tsx), which is *why* they were written as file greps — the refactor then invalidated them without anyone re-writing them. Fix the tests, not the route.
- **~10 brand-token tests** (`clay is #B65D3A`, `paper is #F7F4ED`, `brand tokens — canonical`, `baseline is empty (zero ratified-debt violations)`) — these assert the zero-baseline end-state that lives in **unmerged PR #390/#391**. They fail on main *because* those PRs haven't landed. Landing P0-1 fixes them.
- **A real customer-surface violation**: `app/(marketing)/style/page.tsx :: must not match internal version literal V0/v0 (banned on customer surfaces)`.
- **Genuine coverage gaps worth attention**: `every model with a workspaceId column has RLS enabled in a migration`, `discloses every workspace-scoped model (no silent storage)`, `tearDownWorkspaceData`, `clears every workspace-scoped tenant row…`. These correspond to the unmerged `fix/deletion-sweep-coverage-2026-08-01` and `provenance-writedoor-2026-08-01` branches.
- **`property-management-rent-collection-chase (runtime:live) is sweep-dispatched OR non-sweep caller-covered`** — the test that correctly catches P1-3 above.

So the honest read: the suite is *already telling us* about P0-1 and P1-3. Nobody has been reading it.

---

## (c) SYSTEMATIC vs JUDGMENT

### SYSTEMATIC — the fleet can fix these without Conner

| Item | Action |
|---|---|
| P0-2 | Delete `.flt`; strip the hardcoded token from `.claude/check-flatsbo-prs.mjs`; add `.flt`, `output-file`, `.depfile`, `.l3probe*`, `.claude/*.mjs` to `.gitignore`. Rotate the app credential as a precaution. |
| P1-1 | Rewrite `seed-data.ts:689` to read from `PARTNER_SUPPORT`; re-seed the corpus. Add a test asserting no corpus chunk contradicts `facts.ts`. |
| P1-2 | Add the 2-line operator assertion to both ticket pages (copy the pattern from the other 17). |
| P1-3 | **One-line fix**: add `'property-management-rent-collection-chase'` to `SKILLS_WITH_PRODUCTION_CALLER` (`readiness.ts:103-118`) — the sweep already runs daily. Then map `general` → `invoice-chase-general` so the orphaned live workflow counts. |
| Tests | Rewrite the ~15 stale Inngest tests to assert against the registry contract instead of grepping `route.ts` for a deliberately-removed array. Fix the `V0/v0` literal on `style/page.tsx`. |
| P2-2 | Re-baseline `voice-gate` to the 24 actual violations, removing the 7 slots of slack. |
| P2-3 | Replace hardcoded trial/guarantee literals with `facts.ts` reads; add a gate that fails on new literals. |
| P2-4 | Close #367 as superseded by #349. |
| P2-6 | Bump Next.js 14.2.18 → 14.2.25+. |
| P2-7 | Fix or remove the two broken imports; `captureCheckIn` silently disables cron monitoring. |
| P2-8 | Clean repo-root clutter and stray worktrees. |
| P1-5 | Restart the Librarian roll-up; reset `budget-state.yaml` to the current week. |

### JUDGMENT — needs Conner

| # | Decision | Why only Conner | Recommended default |
|---|---|---|---|
| **J1** | **Land the 8 green PRs.** Merge order: GitHub first (#390 → #391 → #392 → #393 → #394 → #395 → #396, then #380), *then* rebase local `main`. Close #367 and #351. | Merging is a mobile action only Conner performs; #351 is his own draft. | Merge all 8; close #367 (obsolete) and #351 (off-topic). |
| **J2** | **Activate the L3 governor.** Run `agentplain-loop-governor` once manually as its acceptance test; if the verdict line is clean, add the `*/30` cron and disable the fleet-side `agentplain-loop-heartbeat`. | The task is explicitly staged waiting on his go/no-go, and requires one-governor-only arbitration. | Run the acceptance test this week. Re-probe the push path with the mint-token recipe first — the "runner can't write" premise is unproven. |
| **J3** | **Decide where the scheduler lives.** Both schedulers are dark whenever the desktop app is closed; the outage ran 3.5 days undetected because the watchdog shares the dead runner. The GHA `repository_dispatch` route is already specced in `docs/specs/audit-fire-gha-bridge-2026-06-15.md`. | Infrastructure + cost commitment; changes where the fleet's autonomy actually runs. | Move the heartbeat + watchdog to the GHA route; keep local scheduling only for tasks that need the desktop. |

Everything else on the judgment side is deliberately excluded to keep this queue short. The `ANTHROPIC_API_KEY` pause is recorded as settled policy and needs no decision.

---

*Audit method: `git fetch origin` then all reads pinned to `origin/main` via a dedicated worktree; PR data from the GitHub REST API with a freshly minted fleet token (`gh` CLI is unauthenticated in this environment); gates, build, tests, and the vertical-readiness resolver executed rather than reasoned about.*
