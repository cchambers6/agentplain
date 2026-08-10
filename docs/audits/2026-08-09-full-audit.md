# agentplain — full audit, 2026-08-09

> ## ⚠️ CORRECTIONS — read before anything below
>
> Post-audit verification against **artifact mtimes and file contents** (rather than schedule arithmetic) overturned several findings in this document, including two of its loudest. The full account is in `docs/plans/2026-08-09-remediation-plan.md` (PR #398). Summary of what is **retracted**:
>
> | Claim in this document | Status |
> |---|---|
> | "Librarian: ~3,336 silent executions over 34.8 days" (P1-5, summary line 7) | **FALSE.** Two errors: it read the **wrong `INBOX.md`** (the inert repo-side copy, 170 KB / mtime 07-02) instead of the live agent-mode store (**654,717 bytes / mtime 2026-08-09 21:26**), and it counted scheduled **slots** as executions. The live store has **407 `[PROCESSED]` markers — 94 on 08-01, 95 on 08-02** — inside the window called silent. The Librarian is healthy. |
> | "L3 loop: ~850 silent ticks" (summary line 6, §3) | **Number unsupported.** Same slot-arithmetic error; no per-run artifact exists, so executions cannot be counted. Only one execution is directly evidenced. |
> | "Silent no-ops are a class, not an incident" (summary line 7) | **Collapses.** Both instances were wrong. |
> | "The deferred branch has no escalation path" (§3) | **FALSE.** `WORKING_STATE.md` carries **10 detailed L3 governor tick blocks from 2026-07-19**, self-diagnosing to the exact failing step, and raised **`l3-loop-inert-needs-runner`** to Conner. It escalated correctly; nobody answered. |
> | "`conner-queue.yaml` is empty — only commented examples" (P1-5) | **Wrong file.** The real queue is **33,346 bytes with 11 pending items.** |
> | "Nothing detected the outage" (summary lines 2–3) | **Softened.** The Librarian detected and recorded it ~16 min after recovery. Nothing detected it **during**, and nothing alerted Conner — that weaker claim stands, and the P0 for an off-host check is unchanged. |
> | Outage duration "three days" | **Disputed.** The `lastRunAt` cluster implies ~3 days; the Librarian's own note says **~139.7 h (~5.8 days)**. Unresolved. |
>
> **Root cause of these errors:** two parallel memory stores share filenames, and the standing instructions point at the inert one. A prior `WORKING_STATE` entry had explicitly warned against the exact inference made here — *"Do NOT read absent L3 blocks as a silent-fire stall."* Fixing the dual-store trap is item **W2-6** of the remediation plan.
>
> **Everything file-based and directly verified stands unchanged**: the 28-day delivery stall, the 8 unmerged green PRs, the credential files, the Partner "4 hrs/mo" corpus drift, the 3 live verticals + the property-management one-liner, the 2 unguarded operator pages, plugin sprawl and the host wedge, the 41 test failures, and all gate/build results.

**Pinned to `origin/main` @ `5606114b446f6b8cccdf865eaa7532eb3826d542`** (2026-07-12 00:26:55 -0400, "fix(pilot): P0 bundle … (#389)").
Every claim below cites a sha, a file:line, a command output, or a timestamp. Items I could not verify are labelled **UNVERIFIED** rather than inferred.
Audit worktree: `C:/agentplain/agentplain-audit-0809` (detached from `origin/main`, verified `git rev-parse HEAD` = 5606114 before any read).

---

## (a) Executive summary

1. **The entire scheduled fleet stopped for three days** (2026-08-06 → 2026-08-09). Root cause is not a scheduler bug — it is **host memory exhaustion wedging Claude Desktop**: 15.6 GB RAM, 0.98 GB free, `claude` (18 procs, 6.59 GB) + `node` MCP servers (24 procs, 2.40 GB) = 8.99 GB, 57.6% of the machine.
2. **Nothing detected it.** The liveness watchdog runs *on the scheduler it monitors*, so it died with it. This is the third consecutive audit to find a different dead task, and **all three were found only because a human manually asked**.
3. **That is the P0**: there is no off-host liveness check, and there cannot be a useful on-host one. Everything else in this report is a thing the fleet could fix; this is the thing that makes the fleet unable to notice it is broken.
4. **Proximate cause is plugin sprawl** — 40+ plugins installed, 30+ unauthenticated and therefore incapable of doing any work, while still spawning node processes and holding RAM on a 16 GB machine.
5. **`origin/main` has not moved in 28 days** (last commit 2026-07-12) while **8 CI-green PRs sit unmerged** and **3 commits sit unpushed on local `main`**. The fleet is building; nothing is landing.
6. **The L3 loop has not advanced past pass 1 since 2026-07-02**, blocked at STEP 2c for want of a runner with dispatch + repo write. It **self-diagnosed this correctly on 2026-07-19** and raised `l3-loop-inert-needs-runner` to Conner, where it has sat unanswered for three weeks. *(The "~850 silent ticks" framing is retracted — see banner.)*
7. ~~**And it is a class, not an incident**: `agentplain-librarian-rollup` shows the identical signature — ~3,336 executions over 34.8 days with zero writes.~~ **RETRACTED — see corrections banner.** The Librarian is healthy (407 `[PROCESSED]` markers); this claim read the wrong file and counted slots as executions.
8. **Main is healthy where it counts**: `build:no-migrate` exits 0, zero conflict markers, and the pre-push husky gate is **installed and functional** (7 layers) — the "known no-op" in memory is stale.
9. **Customer-facing billing drift is live**: the RAG corpus still sells Partner as "4 hrs/mo reserved time", contradicting `facts.ts` on two ratified points. **Only 3 verticals are live**, and **property-management is one line from live**.
10. **Two credential files sit untracked-but-unignored in the repo root**, one `git add -A` from being committed.

**Good news worth recording:** connector dispatch is fully covered (15/15), the DocuSign no-outbound gate is wired and passing 15/15, and vendor-invisibility is clean. Three memory items were stale in our favour.

---

## Scheduler execution outage (2026-08-06 → 2026-08-09) — P0

**This outranks everything else in this report.** Not because of what broke, but because of what failed to notice.

### What happened

The entire scheduled-task fleet — both schedulers — stopped executing for ~3 days. Every enabled task's last run clusters in a 90-minute window on 2026-08-06 and nothing fired afterwards:

| Task | Cadence | Last run |
|---|---|---|
| `agentplain-librarian-rollup` | `*/15` | 2026-08-06T13:32:02Z |
| `agentplain-watchdog` | `0,30 * * * *` | 2026-08-06T13:45:02Z |
| `agentplain-loop-heartbeat` | `*/30` | 2026-08-06T13:31:02Z |
| `agentplain-audit-queue-autofire` | — | 2026-08-06T13:15:02Z |
| `chiron-demo-readiness-watchdog` | — | 2026-08-06T12:30:01Z |
| `agentplain-morning-brief` | `0 8 * * *` | 2026-08-06T12:15:01Z |
| `agentplain-audit-queue-seeder-local` | `*/30` | 2026-08-06T13:45:07Z |
| `scheduler-liveness-watchdog` | daily | 2026-08-06T11:55:07Z |

All reported `enabled: true` throughout.

### Root cause — host stability, not a scheduler defect

Confirmed on the host at 2026-08-09 ~20:51 ET: **memory exhaustion wedged Claude Desktop.**

- 15.6 GB total RAM, **0.98 GB free (93.7% used)**
- `claude`: 18 processes, 6.59 GB
- `node` (MCP plugin servers): 24 processes, 2.40 GB
- Combined **8.99 GB = 57.6% of system RAM**
- App restarted 20:45:44 ET; all 42 processes fresh from that restart, `Responding=True`, zero stranded processes
- `agentplain-morning-brief` fired its first run since 08-06 within minutes of the restart

Conner independently reported "claude was black" plus a file-lock dialog on relaunch — consistent with the renderer being killed under memory pressure, then 40+ children holding handles through a slow shutdown.

**Explicitly discarded hypothesis:** an earlier read of `nextRunAt` values (01:01–02:00Z on 2026-08-10) suggested "the daemon is scheduling but not executing." That was an artifact of the app having just restarted and recomputed every slot minutes before the read. There is no scheduler defect. Do not re-derive this.

### The structural finding — this is the part that matters

The outage ran for three days and **nothing detected it**. The reason is architectural, not incidental:

> **`scheduler-liveness-watchdog` runs on the scheduler it monitors.** When the scheduler dies, the watchdog dies with it, and a dead watchdog is indistinguishable from a healthy one that has nothing to report. Silence is its success signal *and* its failure signal.

This is not a one-off. **Three consecutive audits have each caught a different dead-task failure, and every one was found only by a manual, human-triggered audit** — never by the fleet. The fleet has no capacity to notice its own absence. Adding another on-host watchdog cannot fix this at any level of effort.

### Proposed external check (concrete)

A liveness check must run **off the host** and be **pull-based on a positive heartbeat**, so that "no signal" is itself the alarm:

1. **Heartbeat writer (on-host, cheap).** Add one line to the existing `agentplain-watchdog` task: on every run, `PUT` a timestamp to a durable external store. The lowest-friction option needing no new infrastructure is a commit or a Gist update via the existing fleet token — e.g. stamp `memory/data/fleet-heartbeat.txt`. No new service, no new credential.
2. **External observer (off-host).** A GitHub Actions workflow on a `schedule:` cron — GHA runs on GitHub's infrastructure, so it is immune to this failure mode by construction. It reads the heartbeat and fails the run if the timestamp is older than a threshold (2 h is comfortably above the `*/30` cadence).
3. **Notification path that does not traverse the dead host.** A failing GHA run emails the repo owner by default. That is sufficient and requires zero setup.
4. **Threshold discipline.** Alert on *staleness*, never on an error signal — the failure mode here produces no errors at all, only absence.

The `repository_dispatch` route already specced in `docs/specs/audit-fire-gha-bridge-2026-06-15.md` establishes the same GHA-side beachhead; this check can share it. Estimated scope: one ~15-line workflow file plus one line in an existing task.

### Two task-hygiene items

- **`dispatch-journal-daily-sweep` is still `enabled: true`** three weeks after being tombstoned for deletion. It has been firing (or queued to fire) work that was explicitly retired.
- **`chiron-build-heartbeat` has been disabled since 2026-08-01** — intentional or not, it is not running and nothing surfaces that.

---

## (b) Findings

### P0

| # | Finding | Evidence |
|---|---|---|
| P0-1 | **Delivery stall.** `origin/main` unchanged for 28 days. 8 CI-green PRs unmerged (#380, #390–#396); 3 commits unpushed on local `main` (`9171f9d`, `0b983a7`, `469f4f5`). Nothing reaches production. | `git log origin/main -1` → `5606114` @ 2026-07-12; `git rev-list --left-right --count origin/main...HEAD` → `0  3`; GitHub REST `/pulls?state=open` → 10 open, all `combined=success` |
| P0-2 | **Plaintext GitHub tokens in the repo root, unignored.** `.flt` holds a GitHub App installation token (`ghs_3714103_…`, exp 2026-08-03 — expired). `.claude/check-flatsbo-prs.mjs:1` holds a second hardcoded `ghs_` token. Neither is tracked *nor* gitignored → one `git add -A` from being committed. `.gitignore` covers `*.pem` and `.claude/worktrees/` but not these. | `git check-ignore .flt` → exit 1 (not ignored); `git ls-files --error-unmatch .flt` → not tracked; `.claude/check-flatsbo-prs.mjs:1` |
| P0-3 | **No off-host liveness check exists, and no on-host one can work.** The 3-day outage above went undetected because `scheduler-liveness-watchdog` runs on the scheduler it monitors. Three consecutive audits have each found a different dead task; all three were found by a human asking, never by the fleet. | See §Scheduler execution outage |
| P0-4 | **Loop is frozen, with two stacked causes that separate cleanly.** `memory/data/loop/state.yaml` on main: `pass_number: 1`, `last_pass_completed_at: 2026-07-02T20:00:00Z`, `last_tick_at: null`, `tick_metrics: []`, `stalls_logged: 0`; 5 of 9 tracks at `passes_completed: 0`. The outage explains staleness only after 2026-08-06T13:31Z. The **pre-existing bug is independently confirmed** — see §3 below. | `git show origin/main:memory/data/loop/state.yaml`; last commit touching it `dfd788b` @ 2026-07-04 |
| P0-5 | **Plugin sprawl is the proximate cause of the wedge.** 40+ plugins installed; **30+ unauthenticated and therefore incapable of doing any work**, while still spawning node processes and holding RAM. 24 node MCP processes held 2.40 GB on a 16 GB machine. This session's own MCP roster lists 30 auth-required plugin servers by name plus "…and 25 more". Only 8 are CLI-scope (`.claude/plugins/installed_plugins.json`), so the bulk live in the desktop connector layer. | host process census 2026-08-09 ~20:51 ET; `installed_plugins.json` → 8 entries |

### P1

| # | Finding | Evidence |
|---|---|---|
| P1-1 | **Billing SSOT drift reaching customers.** `lib/knowledge/seed-data.ts:689` sells Partner as "Named-service-partner with **4 hrs/mo reserved time** … reserved hours each month … and **monthly business review**." Contradicts `facts.ts` twice: `PARTNER_SUPPORT.includesConnerTime = false` and `quarterlyAsyncCheckIn: true`. Seeded to the RAG corpus by `scripts/seed-knowledge.ts` — the corpus customer chat retrieves from. This is the exact leak vector flagged in `project_voice_hygiene_zero_baseline_2026_07_19`. | `lib/knowledge/seed-data.ts:689` vs `lib/billing/facts.ts:65,78-85` |
| P1-2 | **Two operator pages have no authorization assertion.** `app/(operator)/operator/tickets/page.tsx` and `…/tickets/[ticketId]/page.tsx` contain no `isOperator` / `requireOperator` / `requireUser` / `redirect`. The other **17 of 19** operator pages all assert. They read support threads across all workspaces relying on the layout redirect alone. Open since 2026-07-02 (INBOX `p1_operator_tickets_pages_layout_only_auth`). | grep over all 19 `app/(operator)/**/page.tsx` — 17 OK, 2 MISS |
| P1-3 | **Only 3 verticals are live**, not 4+general — and **property-management is one line from live, blocking revenue for no reason.** Its daily sweep `propertyManagementRentCollectionChaseSweepFn` **exists and auto-registers** (`lib/inngest/functions/property-management-rent-collection-chase-sweep.ts:264`, cron `0 12 * * *`), structurally identical to the CPA sweep that *is* trusted. The only thing missing is the string `'property-management-rent-collection-chase'` in `SKILLS_WITH_PRODUCTION_CALLER`. Until it's added, the signup gate sends every PM customer to the waitlist while the workflow runs daily. Separately, `general` → `no-killer-workflow-defined` even though `invoice-chase-general` **is** in the manifest with a live sweep — orphaned because no vertical maps to it. | Ran `resolveVerticalReadiness` over all 11 slugs → `SUPPORTED COUNT: 3 of 11`; `verticalReadinessSelfCheck()` → `[]`; `lib/verticals/readiness.ts:103-118,63-76`; sweep file confirmed exporting `inngest.createFunction` |
| P1-4 | **Task-list hygiene.** `dispatch-journal-daily-sweep` is still `enabled: true` three weeks after being tombstoned for deletion. `chiron-build-heartbeat` has been disabled since 2026-08-01 with nothing surfacing that. Retired and dormant tasks are indistinguishable from live ones in the task list. | `list_scheduled_tasks`; §Scheduler execution outage |
| ~~P1-5~~ | **RETRACTED IN FULL — see corrections banner.** The claim that the Librarian ran ~3,336 times writing nothing was false: it read the inert repo-side `INBOX.md` rather than the live agent-mode store, and counted slots as executions. The Librarian is healthy (654 KB, mtime 2026-08-09 21:26, 407 `[PROCESSED]` markers, numbered passes in `WORKING_STATE.md`). The `conner-queue.yaml` "empty" claim was the same wrong-file error — the real queue has **11 pending items**. **What replaces it:** the repo-side `memory/` tree is a second, largely inert copy that standing instructions wrongly treat as canonical (remediation item W2-6), and the real Conner queue is written faithfully but read by nobody (item W1-4). | live store: 654,717 B, mtime 2026-08-09 21:26, 407 markers; real `conner-queue.yaml` 33,346 B / 11 pending |

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

### 3. The L3 loop — two stacked causes, separated

The loop's committed state is stale, and there are **two independent candidate causes**. They separate cleanly on the timeline, so both can be settled rather than confused.

**Committed state as of the last real tick** (`agentplain-loop-heartbeat` lastRunAt **2026-08-06T13:31:02Z**):

| Field | Value |
|---|---|
| `pass_number` | 1 |
| `last_pass_completed_at` | 2026-07-02T20:00:00Z |
| `last_tick_at` | `null` |
| `tick_metrics` | `[]` |
| `stalls_logged` | 0 |
| tracks at `passes_completed: 0` | 5 of 9 — product-owner, tab-audit, agent-audit, business-model, vertical-priority |

Last commit touching `state.yaml`: `dfd788b`, 2026-07-04.

**Cause A — the 3-day outage (2026-08-06T13:31Z → 2026-08-09).** Fully explains any staleness *inside that window*, and nothing outside it. The loop was not ticking at all; there is nothing further to diagnose there.

**Cause B — the pre-existing tick-without-commit behaviour. CONFIRMED PRESENT, and independent of the outage.** The isolation is decisive:

- The status ledger `l3-heartbeat-status.txt` contains **exactly one line**, `2026-07-19T20:02:36Z | dispatch=absent | main=5606114 | pass_number=1 | verdict=DEFERRED`, with file mtime **2026-07-19 16:02** — re-verified after the restart, still one line.
- The heartbeat ran on `*/30` from that timestamp through **2026-08-06T13:31:02Z** — a window of **~17.7 days ≈ 850 ticks**.
- That window **ends before the outage begins**. So the outage cannot account for it.
- Across ~850 executions the ledger gained **zero** new lines and `state.yaml` gained zero commits.

**But it is not a defect — it is spec-compliant.** The heartbeat's own prompt (regenerated 2026-07-19) states the constraint and then instructs the behaviour:

> "KNOWN RUNNER CONSTRAINT (verified 2026-07-19, ~800 wasted ticks): this scheduled-task environment has NO dispatch tooling … and NO writable checkout of main … every tick will be a DEFERRED no-op."
> — `C:\Users\conne\Claude\Scheduled\agentplain-loop-heartbeat\SKILL.md`

Step 3 of that prompt instructs: if dispatch is absent **and** main's sha is unchanged **and** pass_number is unchanged, "**append nothing, write nothing else anywhere**". All three conditions held continuously (main has been pinned at `5606114` since 2026-07-12). So every one of those ~850 ticks *correctly* did nothing. `last_tick_at: null` is the **designed output of a deferred tick**, not evidence of a crash.

**So what is actually wrong.** The implementation matches its spec; the spec is what's wrong. The deferred branch has **no escalation path**:

- no counter of consecutive deferred ticks,
- no "deferred for N days" threshold that raises anything,
- no write to `conner-queue.yaml` (still empty — only commented examples),
- no entry in `stalls_logged` (still `0`, despite ~850 stalls by any ordinary reading of the word).

The prompt's author optimised the deferred tick to be "CHEAP and IDEMPOTENT" and succeeded completely — it became **silent**. ~850 executions, ~17.7 days, zero signal. The loop was not failing loudly and being ignored; it was failing quietly and correctly.

This is the same architectural flaw as P0-3, one level down: **a component whose failure mode is silence, monitored only by watching for noise.**

**Prior-audit correction.** The 2026-07-19 audit recorded this as "UNVERIFIED — cannot distinguish 'ran and correctly wrote nothing' from 'never ran' from the repo alone." That was correct *from the repo alone*, and it is now **resolved**: the scheduler's `lastRunAt` for `agentplain-loop-heartbeat` (2026-08-06T13:31:02Z) proves the task **was executing** throughout. The repo genuinely cannot distinguish the two — the scheduler's own run record can. Future audits should read both.

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
| **P0-5 — plugin sprawl** | **Highest-leverage systematic item.** Uninstall the 30+ unauthenticated plugins: they cannot perform work by definition (no credentials) yet each spawns a node MCP process holding RAM. On a 16 GB host this is the proximate cause of the wedge. Audit the 40+ installed against what the fleet actually calls, and keep only those. Recheck the process census afterwards to confirm headroom. |
| **P0-3 — external liveness** | Add the heartbeat line to `agentplain-watchdog` + the ~15-line GHA staleness workflow (see §Scheduler execution outage). Both are mechanical; neither needs a decision. |
| **P0-4 — loop escalation** | Add a consecutive-deferred-tick counter to the heartbeat spec and a threshold that writes to `conner-queue.yaml` and increments `stalls_logged`. The bug is silence, so the fix is a signal. |
| P1-4 | Delete `dispatch-journal-daily-sweep` (tombstoned 3 weeks ago, still enabled). Confirm whether `chiron-build-heartbeat` should stay disabled and annotate it either way. |
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
| P1-5 | Diagnose why the Librarian roll-up writes nothing (it is *running*, so "restart it" is the wrong fix — that was the July assumption). Reset `budget-state.yaml` to the current week. Then apply the same escalation rule as P0-4 to **every** recurring task: a task that completes N times without producing its declared artefact must raise, not shrug. |

### JUDGMENT — needs Conner

| # | Decision | Why only Conner | Recommended default |
|---|---|---|---|
| **J1** | **Land the 8 green PRs.** Merge order: GitHub first (#390 → #391 → #392 → #393 → #394 → #395 → #396, then #380), *then* rebase local `main`. Close #367 and #351. | Merging is a mobile action only Conner performs; #351 is his own draft. | Merge all 8; close #367 (obsolete) and #351 (off-topic). |
| **J2** | **Activate the L3 governor.** Run `agentplain-loop-governor` once manually as its acceptance test; if the verdict line is clean, add the `*/30` cron and disable the fleet-side `agentplain-loop-heartbeat`. | The task is explicitly staged waiting on his go/no-go, and requires one-governor-only arbitration. | Run the acceptance test this week. Re-probe the push path with the mint-token recipe first — the "runner can't write" premise is unproven. |
| **J3** | **Does the fleet keep running on a 16 GB desktop?** The 3-day outage was memory exhaustion, not a bug. Pruning plugins (P0-5) buys headroom and is worth doing regardless — but it raises the ceiling, it doesn't remove it: the fleet's autonomy is still capped by one machine's RAM and by whether the app happens to be open. The real choice is whether scheduled work migrates to a hosted runner (the GHA `repository_dispatch` route in `docs/specs/audit-fire-gha-bridge-2026-06-15.md` is already specced). | Infrastructure and cost commitment; changes where the fleet's autonomy physically lives. | Prune plugins now; move the *heartbeat and watchdog* to GHA this week (small, high-value). Defer the full migration until after the PR backlog lands — but decide it deliberately, not by drift. |

Everything else on the judgment side is deliberately excluded to keep this queue short. The `ANTHROPIC_API_KEY` pause is recorded as settled policy and needs no decision.

**A note on ordering.** J1 (land the PRs) is the largest *value* unlock, but J3's cheap half — the external liveness check — is what stops this report's findings from silently rotting again. Three consecutive audits found dead tasks, each by a human asking. If only one thing gets done, make it the GHA staleness check.

---

*Audit method: `git fetch origin` then all reads pinned to `origin/main` via a dedicated worktree; PR data from the GitHub REST API with a freshly minted fleet token (`gh` CLI is unauthenticated in this environment); gates, build, tests, and the vertical-readiness resolver executed rather than reasoned about.*

*Host-stability facts in §Scheduler execution outage (process census, memory figures, restart time) were verified on the host by Conner at 2026-08-09 ~20:51 ET and are carried here as given, not re-derived. An earlier `nextRunAt`-based inference that the daemon was "scheduling but not executing" was an artifact of reading slots minutes after an app restart; it is withdrawn and should not be revived.*
