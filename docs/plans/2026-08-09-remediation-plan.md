# Remediation plan — 2026-08-09

Companion to `docs/audits/2026-08-09-full-audit.md` (PR #397). Built on `origin/main` @ `5606114`.

**Read the corrections section first.** Verification after the audit overturned several of its findings, including two of its loudest. This plan is built on what survived, not on the audit's original narrative.

---

## Corrections — what the audit got wrong

These were checked against artifact mtimes and file contents, not against schedule arithmetic. Every one of them made the situation look worse than it is.

| Audit claim | Status | What is actually true |
|---|---|---|
| "Librarian: ~3,336 silent executions over 34.8 days" | **RETRACTED — false** | Two independent errors. (a) **Wrong file.** The audit read `C:\Users\conne\.claude\projects\C--agentplain\memory\INBOX.md` (170 KB, mtime 2026-07-02). The live Librarian INBOX is `…\local-agent-mode-sessions\…\agent\memory\INBOX.md` — **654,717 bytes, mtime 2026-08-09 21:26**. (b) **Slot arithmetic.** Scheduled slots were counted as executions. The Librarian is healthy and busy: **407 `[PROCESSED]` markers**, including **94 on 08-01, 95 on 08-02, 7 on 08-04** — inside the window called silent. `WORKING_STATE.md` logs numbered passes ("215th of 08-02 ET"). 59 `INBOX.md.pre*` per-run backups at ~15-min spacing. |
| "L3 loop: ~850 silent ticks" | **RETRACTED — number unsupported** | Same slot-arithmetic error. No per-run artifact exists for the heartbeat, so executions cannot be counted. Only one execution is directly evidenced (`lastRunAt` 2026-08-06T13:31:02Z). |
| "Silent no-ops are a class, not an incident" | **RETRACTED — collapses** | Both instances were wrong. There is no class. |
| "The deferred branch has no escalation path" | **RETRACTED — false** | It escalated correctly. `WORKING_STATE.md` carries **10 detailed L3 governor tick blocks from 2026-07-19**, self-diagnosing to the exact failing step ("verified blocked at STEP 2c"), and raised **`l3-loop-inert-needs-runner`** to Conner with two named options. |
| "`conner-queue.yaml` is empty — only commented examples" | **RETRACTED — wrong file** | The real queue is **33,346 bytes with 11 pending items**, including `l3-loop-inert-needs-runner`, `revoke-flatsbo-pat`, `push-or-discard-local-merge-commits`, `scheduler-drops-enabled-tasks`. |
| "`last_tick_at: null` ⇒ the loop never ticked" | **RETRACTED** | The governor ticked repeatedly and wrote detailed blocks. It cannot stamp `state.yaml` because it has no repo write, which is the *known* blocker — not evidence of non-execution. |
| "Nothing detected the outage" | **Softened** | The Librarian detected and recorded it ~16 min after recovery (`~139.7h gap`, corroborated fleet-wide). Nothing detected it **during**, and nothing alerted Conner. That weaker claim is the one that stands. |
| Outage duration "~3 days" | **Disputed, unresolved** | Two measurements disagree: the `lastRunAt` cluster implies ~3 days; the Librarian's own post-outage note says **~139.7 h (~5.8 days)**. Not resolved here. Planning uses the Librarian's figure as the system's own record. |

**Why the audit got these wrong, and the fix.** A prior WORKING_STATE entry (2026-07-19) explicitly warned: *"Expect NO new `## L3` blocks in this file unless status actually changes… **Do NOT read absent L3 blocks as a silent-fire stall.**"* The audit made exactly that inference. Root cause is **two parallel memory stores with the same filenames**, and the standing instructions point at the wrong one. That is W2-6 below, and it is the highest-value process fix in this plan.

**What survives unchanged.** Everything file-based and directly verified: the 28-day delivery stall, the 8 unmerged green PRs, the credential files, the Partner "4 hrs/mo" corpus drift, the 3 live verticals + property-management one-liner, the 2 unguarded operator pages, the plugin sprawl and host wedge, the 41 test failures, and all gate/build results.

---

## Corrections to standing memory

Stale beliefs that cost time in this audit. Recording so they stop.

| Belief | Reality |
|---|---|
| "Pre-push husky gate is a known no-op" | **Functional.** `core.hooksPath=.husky/_`; runs 7 layers (staleness, lint, brand-gate, voice-gate, connector-dispatch, `build:no-migrate`, schema-drift). Pushed through it 3× this session. |
| "5 connectors connect but 404 — missing `-mcp` routes" | **Fixed.** 26 catalog entries, 15 available, **15/15 with a dispatch route**. Gate runs in CI. |
| "DocuSign send/void is ungated" | **Wired, 15/15 passing** — incl. send-without-token rejected, expiry, cross-envelope replay, cross-workspace. |
| "Brand/voice gates at ZERO baseline" | Describes **unmerged PR #390**. On main: brand 11, voice 24 (baseline 31). |
| "The Conner queue is empty / escalation is broken" | **11 pending items.** Escalation works; answering is the bottleneck. |
| "`memory/` in the repo is the Librarian's store" | It is **not**. The Librarian writes to the agent-mode session store. The repo copy is a different, largely inert tree. |

---

## Effort key

`S` ≤ 2 h · `M` ~half day · `L` ~1–2 days · `XL` ~1 week+. Estimates are honest, not compressed.

---

## Wave 0 — Stop the bleeding / irreversible-if-missed

**5 items · 3 JUDGMENT · 2 SYSTEMATIC**

### W0-1 · Plaintext credentials in the repo root — SYSTEMATIC · `S`
- **Problem.** `.flt` (GitHub App installation token) and `.claude/check-flatsbo-prs.mjs:1` (hardcoded `ghs_`) are untracked **and unignored** — one `git add -A` from being committed.
- **Fix.** Delete `.flt`; replace the literal in `check-flatsbo-prs.mjs` with a `mint-fleet-token.mjs` call; extend `.gitignore` with `.flt`, `output-file`, `.depfile`, `.l3probe*`, `UsersconneAppData*`, `.claude/*.mjs`.
- **Acceptance.** `git check-ignore -v .flt .claude/check-flatsbo-prs.mjs` exits 0 for both; `grep -rE "ghs_[A-Za-z0-9_]{20,}" . --exclude-dir=node_modules` returns nothing.
- **Rollback.** Revert the `.gitignore` commit; nothing else is destructive (the `.flt` token already expired 2026-08-03).

### W0-2 · Rotate exposed credentials — JUDGMENT · `S`
- **Problem.** The `.flt` token is expired, but the GitHub App private key at `C:\private\*.pem` mints new ones. Separately, `revoke-flatsbo-pat` has been **pending since 2026-06-09**.
- **Fix.** Conner revokes the leaked flatsbo PAT and decides whether to rotate the agentplain App key.
- **Acceptance.** GitHub UI shows the PAT absent; a `mint-fleet-token.mjs` run against the new key returns a working token.
- **Rollback.** N/A — rotation is forward-only. Re-mint if the fleet breaks.

### W0-3 · Land the 8 CI-green PRs — JUDGMENT · `M` (Conner-time; mostly waiting on CI)
- **Problem.** `origin/main` frozen 28 days; #380 and #390–#396 all green and unmerged. Every day compounds rebase risk and keeps fixes off production.
- **Fix.** Merge **on GitHub first**, in order #390 → #391 → #392 → #393 → #394 → #395 → #396 → #380. **Do not push local `main` first** — #390's head sha is byte-identical to local `9171f9d`, so pushing closes it out of order and leaves #391 showing a phantom diff.
- **Acceptance.** `git ls-remote origin refs/heads/main` differs from `5606114`; `gh`/REST shows 0 open fleet PRs from that wave; `npm run build:no-migrate` on the new main exits 0.
- **Rollback.** `git revert` per merge commit — each PR is independently revertable.

### W0-4 · Resolve the 3 unpushed local commits — JUDGMENT · `S`
- **Problem.** `9171f9d`, `0b983a7`, `469f4f5` sit only on the local mount. Queued as `push-or-discard-local-merge-commits` and unanswered.
- **Fix.** After W0-3, rebase local `main` onto the new `origin/main` and discard whatever the merged PRs already carry. Expect `9171f9d` and `0b983a7` to drop out as duplicates, leaving only `469f4f5` (incident-log doc).
- **Acceptance.** `git rev-list --left-right --count origin/main...main` reads `0  0` or `0  1`.
- **Rollback.** The commits are recoverable from reflog for 90 days.

### W0-5 · Close the two dead PRs — SYSTEMATIC · `S`
- **Problem.** #367 is `dirty`, superseded by #349. #351 is an off-topic **draft** (dew-point app) blocking nothing but polluting the list; drafts can't be merged from mobile.
- **Acceptance.** Both show `state: closed` via REST.
- **Rollback.** Reopen — closing a PR is non-destructive.

---

## Wave 1 — Detection

**4 items · 4 SYSTEMATIC · 0 JUDGMENT**

Nothing here needs Conner. This is the wave that stops the next failure from going unnoticed.

### W1-1 · Off-host liveness heartbeat — SYSTEMATIC · `S`
- **Problem.** Nothing alerts during an outage. The on-host watchdog cannot detect its own host being down.
- **Fix.** Add one step to `agentplain-watchdog`: on every run, commit a UTC timestamp to `memory/data/fleet-heartbeat.txt` using the existing fleet token. No new service, no new credential.
- **Acceptance.** After two watchdog runs, `git log --format=%ci -2 -- memory/data/fleet-heartbeat.txt` shows two commits ~30 min apart.
- **Rollback.** Remove the step; the file is inert.

### W1-2 · GitHub Actions staleness alarm — SYSTEMATIC · `S`
- **Problem.** Absence of signal is currently indistinguishable from health.
- **Fix.** `.github/workflows/fleet-liveness.yml`, `schedule:` cron hourly. Reads `fleet-heartbeat.txt`; **fails** if older than 2 h. Runs on GitHub infrastructure, so it is immune to the host failure mode by construction. A failing run emails the repo owner by default — the notification path never traverses the dead host.
- **Acceptance.** Deliberately backdate the heartbeat and confirm the next scheduled run goes red and an email arrives. **Test the alarm, not just the happy path.**
- **Rollback.** Delete the workflow file.
- **Note.** Alarm on **staleness only**. This failure mode produces no errors — only absence.

### W1-3 · Artifact-freshness assertion for every recurring task — SYSTEMATIC · `M`
- **Problem.** `lastRunAt` proves a task started, not that it did anything. This audit's two biggest errors both came from guessing at that gap.
- **Fix.** Extend `scheduler-liveness-watchdog` to a three-way check per task: **`lastRunAt` vs declared cadence vs the mtime of the artifact that task is supposed to write.** Emit only on mismatch. Ship with the correct artifact path per task (e.g. Librarian → agent-store `INBOX.md`; L3 → `l3-heartbeat-status.txt`).
- **Acceptance.** Run it against known-good state → silent. Backdate one artifact → exactly one finding naming that task.
- **Rollback.** Revert the task prompt.
- **Why it matters.** This is the method that caught the audit's own error. Encoding it stops the next audit repeating it.

### W1-4 · Surface the Conner queue where Conner sees it — SYSTEMATIC · `S`
- **Problem.** 11 items are pending, some for 2 months. The queue is written faithfully and read by nobody.
- **Fix.** Have `flatsbo-conner-decision-package-morning` read the **agent-store** `conner-queue.yaml`, and lead the brief with pending items sorted by age, each with its recommended default.
- **Acceptance.** Next morning brief lists all 11 with ages; oldest first.
- **Rollback.** Revert the task prompt.

---

## Wave 2 — The loop, task hygiene, and the memory-store trap

**6 items · 4 SYSTEMATIC · 2 JUDGMENT**

### W2-1 · Re-probe the repo-write path — SYSTEMATIC · `S`
- **Problem.** The whole "loop needs a new runner" conclusion rests on `fire-path-probe-2026-07-19`, which tested **only the ambient git credential helper** and conceded the token-injected URL "remains untested." That untested path is the documented working recipe and is what this session used successfully throughout.
- **Fix.** Re-run the probe from a scheduled-task session using `mint-fleet-token.mjs` + a token-injected push URL.
- **Acceptance.** Probe writes a result file stating push **ok/failed** with the token-injected method named explicitly.
- **Rollback.** Delete the probe branch.
- **Do this before W2-2** — it may show the governor doesn't need re-homing at all.

### W2-2 · Loop-governor acceptance test — JUDGMENT · `S` (Conner: one click)
- **Problem.** `agentplain-loop-governor` is staged, enabled, **never executed**. `l3-loop-inert-needs-runner` has been pending since 2026-07-19.
- **Fix.** Conner runs it once manually. It ends with a verdict line: state-read OK/FAIL, pass-dispatch OK/FAIL, state-write-push OK/FAIL.
- **Acceptance.** The verdict line exists and all three read OK; `git ls-remote origin refs/heads/main` shows a new sha.
- **Rollback.** Governor is manual-only; if it misbehaves, do nothing further.

### W2-3 · Governor cutover — JUDGMENT · `S`
- **Problem.** Two governors must never run at once.
- **Fix.** *Only after W2-2 passes*: add the `*/30` cron to `agentplain-loop-governor` **and** disable `agentplain-loop-heartbeat` in the same sitting.
- **Acceptance.** `state.yaml` `pass_number` advances past 1 within 24 h and `last_tick_at` is non-null.
- **Rollback.** Disable the governor cron, re-enable the heartbeat — returns to today's inert-but-safe state.

### W2-4 · Delete `dispatch-journal-daily-sweep` — SYSTEMATIC · `S`
- **Problem.** Still `enabled: true` three weeks after being tombstoned. Root cause already settled; queued as `delete-dispatch-journal-daily-sweep`.
- **Acceptance.** Absent from `list_scheduled_tasks`.
- **Rollback.** Recreate from the SKILL.md backup.

### W2-5 · Adjudicate `chiron-build-heartbeat` — JUDGMENT · `S`
- **Problem.** Disabled since 2026-08-01 with nothing surfacing whether that was deliberate. Chiron is frozen (#386), so it is probably correct — but "probably" is how tasks rot.
- **Acceptance.** Task is either deleted or carries a dated comment saying why it stays disabled.
- **Rollback.** Re-enable.

### W2-6 · Collapse the dual memory stores — SYSTEMATIC · `M`
- **Problem.** **Two `INBOX.md`/`conner-queue.yaml`/`budget-state.yaml` trees exist** — the agent-mode session store (live) and `C:\Users\conne\.claude\projects\C--agentplain\memory\` (largely inert). The standing memory instructions point at the inert one. This directly caused three false findings in the audit, and this session's own INBOX appends initially landed in the wrong file.
- **Fix.** Pick the agent-mode store as canonical. Replace the inert `INBOX.md` with a stub pointing at the real path. Update the memory instructions and the Librarian protocol to name the absolute canonical path.
- **Acceptance.** The inert `INBOX.md` is ≤ 20 lines and contains the canonical path; a fresh session asked "where does the Librarian INBOX live?" answers with the agent-store path.
- **Rollback.** Restore from `INBOX.md.bak*`.
- **Highest-value process fix in this plan.** It is the root cause of the audit's worst errors.

---

## Wave 3 — Customer-visible correctness

**11 items · 11 SYSTEMATIC · 0 JUDGMENT**

Several are fixed automatically by landing W0-3; those are marked.

### W3-1 · Partner "4 hrs/mo reserved" in the RAG corpus — SYSTEMATIC · `S`
- **Problem.** `lib/knowledge/seed-data.ts:689` sells Partner with "4 hrs/mo reserved time" and "monthly business review", contradicting `facts.ts` on two ratified points (`includesConnerTime: false`, `quarterlyAsyncCheckIn: true`). Customer chat retrieves from this corpus.
- **Fix.** Rewrite the chunk to interpolate `PARTNER_SUPPORT.description`; re-seed.
- **Acceptance.** New test: no corpus chunk matches `/reserved (hours|time)|monthly business review/i`. `npx tsx scripts/verify-knowledge-seed.ts` passes.
- **Rollback.** Revert the commit and re-seed from the prior chunk.

### W3-2 · property-management is one line from live — SYSTEMATIC · `S`
- **Problem.** `propertyManagementRentCollectionChaseSweepFn` runs daily (`0 12 * * *`) and auto-registers, but the slug is missing from `SKILLS_WITH_PRODUCTION_CALLER`, so the signup gate sends every PM customer to the waitlist. **Revenue blocked for nothing.**
- **Fix.** Add `'property-management-rent-collection-chase'` to `lib/verticals/readiness.ts:103-118`.
- **Acceptance.** `resolveVerticalReadiness('property-management').supported === true`; supported count 3 → 4; `verticalReadinessSelfCheck()` still `[]`.
- **Rollback.** Remove the line — reverts to waitlist, which is the safe direction.

### W3-3 · `general` on-ramp orphaned from a live workflow — SYSTEMATIC · `S`
- **Problem.** `invoice-chase-general` has a live daily sweep and is in the caller manifest, but no vertical maps to it, so `general` resolves `no-killer-workflow-defined`.
- **Fix.** Decide deliberately: map `general` → `invoice-chase-general`, **or** document that on-ramps are intentionally never "supported". Do not leave it ambiguous.
- **Acceptance.** Either `resolveVerticalReadiness('general').supported === true`, or a test asserts on-ramps are always unsupported by design.
- **Rollback.** Revert.

### W3-4 · Two operator pages with no authorization — SYSTEMATIC · `S`
- **Problem.** `operator/tickets/page.tsx` and `tickets/[ticketId]/page.tsx` have no `isOperator`/`requireOperator`; the other **17 of 19** do. They read support threads across all workspaces. Open since 2026-07-02.
- **Fix.** Copy the assertion used by the sibling 17.
- **Acceptance.** A test enumerating `app/(operator)/**/page.tsx` asserts **19/19** assert operator identity. Manual: a non-operator session gets redirected.
- **Rollback.** Revert (re-opens the hole — don't).

### W3-5 · Billing SSOT is advisory, not enforced — SYSTEMATIC · `M`
- **Problem.** Only **5** files import `lib/billing/facts.ts`; ~30 customer surfaces hardcode "7-day"/"14-day". Values agree today; nothing keeps them agreeing.
- **Fix.** Replace literals with `facts.ts` reads on the highest-traffic surfaces, then add a gate failing on new trial/guarantee literals outside `facts.ts`.
- **Acceptance.** Gate fails on a deliberately-introduced `"30-day free trial"`, passes on main.
- **Rollback.** Remove the gate; the reads are harmless.

### W3-6 · voice-gate ratchet has 7 slots of slack — SYSTEMATIC · `S`
- **Problem.** Baseline declares 31, only 24 exist — up to 7 new tics can land silently.
- **Fix.** Re-baseline to the actual set. **Do after W0-3**, since #390 changes it.
- **Acceptance.** `Baseline: N | Found: N | New: 0`.
- **Rollback.** Restore the prior baseline JSON.

### W3-7 · `V0/v0` literal on a customer surface — SYSTEMATIC · `S`
- **Problem.** A failing test flags an internal version literal on `app/(marketing)/style/page.tsx`.
- **Acceptance.** That test passes.
- **Rollback.** Revert.

### W3-8 · Next.js 14.2.18 → 14.2.25+ — SYSTEMATIC · `M`
- **Problem.** CVE-2025-29927 middleware bypass. Impact here is limited — middleware only sniffs cookie presence, real auth is in route handlers — but it is the outer layer in front of W3-4.
- **Fix.** Bump; run full build + E2E.
- **Acceptance.** `node -e "require('next/package.json').version"` ≥ 14.2.25; build exits 0; E2E green.
- **Rollback.** Pin back to 14.2.18.
- **Sequence after W3-4** so the inner gate is closed first.

### W3-9 · ~15 stale Inngest tests — SYSTEMATIC · `M`
- **Problem.** They grep `app/api/inngest/route.ts` for literal function names. That array was **deliberately removed** — the route auto-derives from `lib/inngest/registry.ts` via `require.context`, and the file says "Do NOT modify this file." **Not a production gap.**
- **Fix.** Rewrite to assert the registry contract (every file in `lib/inngest/functions/` exports a function with a unique id) rather than file text. They can't run outside webpack, so assert on the filesystem + a build-time duplicate-id check.
- **Acceptance.** Those ~15 pass; total failures drop from 41 to ~26.
- **Rollback.** Revert.

### W3-10 · Two silent import failures — SYSTEMATIC · `S`
- **Problem.** `useActionState` not exported from `react` (`ClosureConfirmForm.tsx`); `captureCheckIn` not exported from `@sentry/nextjs` (`lib/observability/cron-monitor.ts`) — **cron check-in monitoring is a no-op today.**
- **Acceptance.** Build log contains no `Attempted import error`; a deliberate cron failure appears in Sentry.
- **Rollback.** Revert.

### W3-11 · Repo-root clutter — SYSTEMATIC · `S`
- **Problem.** `output-file`, `.depfile`, `.l3probe*`, `UsersconneAppData…json`, plus **~30 stray worktree directories**.
- **Fix.** `git worktree prune`, remove dead dirs, gitignore the scratch files (overlaps W0-1).
- **Acceptance.** `git status --short` shows no untracked scratch; `git worktree list` contains only active worktrees.
- **Rollback.** None needed — nothing tracked is touched.

---

## Wave 4 — Structural

**4 items · 2 SYSTEMATIC · 2 JUDGMENT**

### W4-1 · Prune unauthenticated plugins — SYSTEMATIC · `M`
- **Problem.** 40+ plugins installed; **30+ unauthenticated and therefore incapable of doing any work**, while spawning node MCP processes. Measured: 24 node processes / 2.40 GB on a 15.6 GB host. This is the proximate cause of the wedge that took the fleet down.
- **Fix.** Inventory the 40+ against what the fleet actually calls; uninstall the rest. **Most live in the desktop connector layer**, not `.claude/plugins/installed_plugins.json` (which holds only 8) — prune there.
- **Acceptance.** Post-prune census: node MCP process count and RSS both materially down; free RAM > 4 GB at steady state. Record before/after numbers.
- **Rollback.** Reinstall from the marketplace; no state is lost.
- **Highest-leverage systematic item in the plan.** Costs nothing — these plugins cannot do work by definition.

### W4-2 · Decide the fleet's home — JUDGMENT · `L` to spec, `XL` to migrate
- **Problem.** Fleet autonomy is capped by one desktop's RAM and by whether the app is open. W4-1 raises the ceiling; it does not remove it.
- **Fix.** Conner decides: stay local with pruning + external monitoring, or migrate scheduled work to GHA (`repository_dispatch` route already specced in `docs/specs/audit-fire-gha-bridge-2026-06-15.md`).
- **Acceptance.** A dated decision in `conner-queue.yaml` with rationale. If migrate: one task runs end-to-end on GHA as proof.
- **Rollback.** Migration is per-task; move one, verify, then continue.
- **Honest effort.** Speccing enough to decide: ~1–2 days. Full migration: **a week or more** — every task needs a repo-write path, secret plumbing, and its own acceptance test. Do not start it in the same week as W0-3.

### W4-3 · Scheduled sessions start in `C:\business` — SYSTEMATIC · `S`
- **Problem.** Scheduled sessions default to the archived RecoverAI folder. Queued as `fix-claude-code-scheduler-cwd`. Every task that assumes a cwd is one silent failure away.
- **Acceptance.** A scheduled task echoing `pwd` reports the agentplain path.
- **Rollback.** Restore the prior setting.

### W4-4 · `WORKING_STATE.md` retention — JUDGMENT · `S`
- **Problem.** 70 KB and growing, with a large backlog of `.pre*`/`.tmp` backups. Queued as `working-state-retention-policy`.
- **Fix.** Conner approves a windowed retention policy + a batched prune.
- **Acceptance.** Policy recorded; backup count drops below the agreed ceiling.
- **Rollback.** Backups are recoverable until pruned — prune last.

---

## Totals

| Wave | Items | SYSTEMATIC | JUDGMENT |
|---|---|---|---|
| 0 — stop the bleeding | 5 | 2 | 3 |
| 1 — detection | 4 | 4 | 0 |
| 2 — loop + hygiene | 6 | 4 | 2 |
| 3 — customer-visible | 11 | 11 | 0 |
| 4 — structural | 4 | 2 | 2 |
| **Total** | **30** | **23** | **7** |

**Calendar, honestly.** Wave 0 is gated on Conner's merges, not on effort. Wave 1 is ~1 day of fleet work and can run in parallel with Wave 0. Wave 3 is ~3–4 days of fleet work but should wait for W0-3 to avoid rebase churn. Wave 4's migration is a week-plus and should not start until the backlog is landed. **Realistic end-to-end: 2–3 weeks**, dominated by W0-3 latency and W4-2.

---

## Conner's judgment queue — in order

Seven items. The first three are this week; the rest can wait.

| # | Item | Wave | Why you | Recommended default | Time |
|---|---|---|---|---|---|
| 1 | **Merge the 8 green PRs**, GitHub-first, then rebase local `main` | W0-3/4 | Only you can merge; 28 days of compounding | Merge all 8; close #367 + #351 | ~30 min |
| 2 | **Revoke the leaked flatsbo PAT** (pending since 06-09) + decide on rotating the agentplain App key | W0-2 | Credential authority | Revoke PAT now; rotate App key too | ~10 min |
| 3 | **Run `agentplain-loop-governor` once** | W2-2 | Explicitly staged for your go/no-go | Run it — but let W2-1 re-probe the push path first; the blocker may not exist | ~5 min |
| 4 | **Governor cutover** — `*/30` cron on, heartbeat off, same sitting | W2-3 | One-governor-only arbitration | Do it if #3's verdict is clean | ~5 min |
| 5 | **`chiron-build-heartbeat`** — delete or annotate | W2-5 | Product call on frozen Chiron | Delete; Chiron is frozen | ~2 min |
| 6 | **`WORKING_STATE.md` retention policy** | W4-4 | Data-retention call | Approve a 30-day window + batched prune | ~5 min |
| 7 | **Where the fleet lives** — 16 GB desktop vs GHA migration | W4-2 | Infrastructure + cost | Prune plugins now (W4-1, no decision needed); move heartbeat+watchdog to GHA; defer full migration | ~20 min to decide |

**If you do one thing:** #1. **If you do two:** #1 and #3.

Note that **#2, #3, #5, #6 are already sitting in `conner-queue.yaml`** — some for two months. The escalation machinery works; W1-4 exists because the queue is written faithfully and read by nobody.

---

*Built on `origin/main` @ `5606114`. Corrections verified against artifact mtimes, file contents, and `[PROCESSED]` marker counts — not against schedule arithmetic, which is what produced the retracted claims.*
