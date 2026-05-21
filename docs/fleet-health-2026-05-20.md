# Fleet health diagnostic — 2026-05-20

Diagnostic answer to two questions: (1) are the crons firing? (2) is the
capability-builder actually improving the fleet? Evidence-first per
`feedback_no_guesses_no_estimates`. Every claim cites a file, commit, or
HTTP response. Where a source is unreachable, it's marked **UNKNOWN** with
what's needed to close it.

> **Premise correction up front.** The cron + capability-builder machinery is
> split across **two repos**, not one:
> - **agentplain** (`cchambers6/agentplain`, the stated priority) — has Inngest
>   functions only. **No `.github/workflows` exist anywhere in its history**
>   (verified across all 241 branches). No capability-builder. No GHA crons.
> - **flatsbo** (`cchambers6/flatsbo`) — owns all 5 GHA crons (incl.
>   capability-builder), the `capability_inbox`, and the `CronRun` fire-log
>   table.
>
> So "the fleet" spans both. The autonomous-cron + capability-builder tier is a
> **flatsbo** asset; agentplain (the priority) runs only 2 active Inngest crons
> that do billing/integration plumbing.

---

## 1. Inngest crons (agentplain)

**Registered functions** — `app/api/inngest/route.ts:25`:
- `trialExpirationWarningsFn` — cron `0 10 * * *` (daily ~06:00 ET) —
  `lib/inngest/functions/trial-expiration-warnings.ts:30,168`
- `integrationRenewalSweepFn` — cron `0 */2 * * *` (every 2h) —
  `lib/inngest/functions/integration-renewal-sweep.ts:41`

**NOT registered / not cron-active:**
- `processWebhookEventFn` (the value-loop drain) is **event-triggered only,
  no cron**, and is **not in the serve route's `functions` array** at all
  (`route.ts:25` lists only the two above; `process-webhook-event.ts:11-14,152`
  declares `triggers: [{ event: ... }]` and is explicitly "DECLARED, NOT
  CRON-ACTIVE"). The prompt's assumption that `processWebhookEventFn` is the
  scheduled value-loop cron is **incorrect** — it never fires on a schedule in
  the current code.

**Route health (today, 2026-05-20):** `GET https://app.agentplain.com/api/inngest`
→ **HTTP 401** `{"message":"Unauthorized"}`.
- This is **not** a regression and **not** a middleware block: `middleware.ts:52`
  matches only `/app/*` and `/operator/*` and explicitly leaves `/api/*`
  unguarded. The 401 is **Inngest's own signing-key-protected introspection
  endpoint** responding — i.e. the route is deployed, the Inngest SDK is
  serving, and a bare unauthenticated GET is expected to be rejected.
- **Deployed + reachable: YES** (structured 401 from the SDK, not a 404/5xx).
- **"200 + modified:true" registration probe (cited from yesterday): UNKNOWN
  today** — that response comes from an authenticated PUT/sync. I have no
  `INNGEST_SIGNING_KEY`, so I cannot reproduce it. Re-running it needs the
  signing key.

**Last actual work — scheduled vs. visible:**
- **UNKNOWN.** No `DATABASE_URL` in env, so I cannot query `WebhookEvent`,
  `WebhookSubscription`, `AuditLog`, or any fire-log rows. No
  `scripts/validate/inngest-health-check.ts` exists in the repo
  (`scripts/` has no inngest file).
- **Honest distinction the prompt asked for:** even if these two crons are
  firing on schedule, they almost certainly do **no visible work** right now:
  - `trialExpirationWarningsFn` only acts on `TRIALING` subscriptions
    (`trial-expiration-warnings.ts:52-54`).
  - `integrationRenewalSweepFn` only acts on `WebhookSubscription` rows
    (`integration-renewal-sweep.ts:60`), which require OAuth-connected inboxes
    — and Google/Microsoft OAuth is not set up yet.
  - So "scheduled + healthy" ≠ "doing work." Both are plumbing waiting for data.

**To close the UNKNOWNs:** `INNGEST_SIGNING_KEY` (registration probe) +
`DATABASE_URL` or the Inngest Cloud dashboard (actual fire history).

---

## 2. GHA leadership crons (flatsbo)

agentplain has **zero** GHA workflows. The leadership-autonomy tier lives in
**flatsbo** — `C:\flatsbo\.github\workflows\`:

| Workflow | Schedule | Gated on |
|---|---|---|
| `cron-capability-builder-morning.yml` | `0 */3 * * *` (every 3h) | `vars.USE_GHA_CRON == 'true'` |
| `cron-cos-daily-brief.yml` | `8 10 * * *` (daily) | `vars.USE_GHA_CRON == 'true'` |
| `cron-listing-coord-readiness-sweep.yml` | `0 13,20 * * *` (2×/day) | `vars.USE_GHA_CRON == 'true'` |
| `cron-b2b-sales-rep-pre-call-brief.yml` | `0 11 * * *` (daily) | `vars.USE_GHA_CRON == 'true'` |
| `cron-b2b-sales-rep-reply-sweep.yml` | `0 21 * * *` (daily) | `vars.USE_GHA_CRON == 'true'` |

All five are gated `if: github.event_name == 'workflow_dispatch' || vars.USE_GHA_CRON == 'true'`
(e.g. `cron-capability-builder-morning.yml:36`) and each fires
`npx tsx scripts/cron/run-skill.ts <skill>`.

**Is `USE_GHA_CRON` on?** **UNKNOWN.** It is a GitHub **repo variable**, not a
committed value — it lives in GitHub settings, not in code. The code only
*reads/sets* it through an adapter (`agentplain` has the mirror adapter at
`lib/ops/github/actions-vars.ts`; flatsbo's `cron-cos-daily-brief.yml` comment
says "USE_GHA_CRON=false to roll back," implying default-on intent). Confirming
the current value needs the GitHub API with auth or the repo settings UI.

**When did workflows last run + conclusions?** **UNKNOWN via API.**
`GET https://api.github.com/repos/cchambers6/flatsbo/actions/runs` → **HTTP 404
`{"message":"Not Found"}`** (private repo; unauthenticated access denied). No
`gh` CLI installed, no `GH_TOKEN`/`GITHUB_TOKEN` in env.

**Git evidence of cron work (the part I CAN see):**
- flatsbo local is **0 ahead / 44 behind** `origin/main`, but `origin/main`'s
  newest commit is **2026-05-13** (`aae3f4b`, PR #31). **Zero commits — cron or
  human — in the last 7 days** on origin/main.
- Only commit in flatsbo's last 7 days from an agent: `de841c4`
  `Claude Agent <agent@flatsbo.local>` **2026-05-14** (push-verification
  principle). Nothing since.
- **Caveat that matters:** the capability-builder cron writes to a **Notion
  recommendations DB** (`cron-capability-builder-morning.yml:42`,
  `NOTION_DATABASE_ID_RECOMMENDATIONS`) and a Postgres `CronRun` table
  (`prisma/schema.prisma:231`) — **not git**. So git silence is **not** proof
  the crons aren't firing. The authoritative fire log is `CronRun` + the GitHub
  Actions run history, both of which I cannot reach.

**To close the UNKNOWNs:** GitHub API auth (`gh auth` or a PAT) for run history
+ the `USE_GHA_CRON` value, or `DATABASE_URL` to read the `CronRun` table.

---

## 3. Capability-builder — active / dormant / historically-active-now-quiet?

**Verdict: historically active (late April), now QUIET in everything I can
verify. Live-cron firing status UNKNOWN (Notion/DB/Actions-API gated).**

Definition + cron: `C:\flatsbo\scripts\cron-skills\flatsbo-capability-builder-morning.md`,
fired every 3h by `cron-capability-builder-morning.yml`.

Inbox: `C:\flatsbo\memory\agent-state\capability_inbox.md` — 18 proposals
(#1–#18). Dating:
- **#1–#7: 2026-04-29** — the inaugural *autonomous continuous-scan* sweep
  (`capability_sweep_2026-04-29.md`). **This is the only batch the
  capability-builder surfaced on its own.**
- **#8–#13: 2026-05-09**, **#14–#16: 2026-05-10**, **#17–#18: 2026-05-14** — all
  explicitly tagged **"Operator-routed by Conner via the orchestrator (Dispatch
  session)… Bypasses the capability-builder continuous-scan"** (inbox lines
  50, 83) or "PERMANENT-FIX TASK from Conner." These were handed *to* the
  capability-builder, not generated *by* it. Many still read "pending
  capability-builder pickup" (e.g. #8 line 93, #12 line 147).

**So: no net-new autonomously-surfaced proposal since 2026-04-29 (21 days).**

Corroborating git timestamps:
- `agent_capability_log.md` (the capability-builder's own "weekly digest of what
  shipped") has **exactly one entry, 2026-04-26**. No weekly entry since.
- `capability_learning_catalog.md` last git-written **2026-05-03** (by Conner,
  in the Inngest-migration commit `771b711` — not by the agent).
- `capability_inbox.md` last git-written **2026-05-14** (the operator-routed
  push-verification entries), before that **2026-05-03**.

**Did proposals ship? (cross-reference)**
- **#13 — in-house Inngest per-function pause flag: SHIPPED.** Present in
  agentplain main: `lib/inngest/disable-flag.ts`, `run-with-disable-gate.ts`,
  `lib/ops/inngest/control.ts`; every registered function wraps its body in
  `runWithDisableGate` (`trial-expiration-warnings.ts:175`).
- **#8 — knowledge substrate: shipped (work landed).** Multiple merged branches
  (`feat/agentplain-knowledge-substrate`, `chore/knowledge-substrate-refresh/-reseed`).
- **#2 — Managed Agents eval: shipped** (referenced as existing
  `outputs/managed_agents_eval/eval_matrix.md`, inbox line 91).
- **#1, #3, #4, #5, #6, #7 (inaugural): still marked `PENDING`** in the inbox —
  no status flip to ADOPTED/SHIPPED (`task_budget`, Neon snapshot cost, PII
  redaction hook, Mesh Memory naming, `xhigh` effort, Next.js DevTools).

**Read:** the shipped items (#13, #8, #2) are real and trace to code, but they
were driven through *Conner's Dispatch routing*, not an ongoing autonomous
cadence. The agent's *self-generated* output stream stopped at the 2026-04-29
inaugural sweep. Whether the 3-hour GHA cron is still physically firing (and
writing to Notion) is **UNKNOWN** — but if it is, it has produced nothing that
reached the git-tracked inbox, the weekly capability log, or the learning
catalog in 3 weeks.

---

## 4. Honest bottom line

**Q1 — "Have the crons been firing?"**
- **agentplain Inngest:** route is deployed and reachable (HTTP 401 from the
  Inngest SDK itself, not a regression). Whether the 2 registered crons
  (trial-warnings, integration-renewal) are *firing on schedule* is **UNKNOWN**
  (need signing key / DB / dashboard). Even if firing, both **do no visible
  work** — their target tables are empty until billing trials exist and inbox
  OAuth is connected. The "value-loop drain" (`processWebhookEventFn`) is **not
  a cron at all** — event-only, unregistered.
- **flatsbo GHA crons:** all 5 are scheduled and gated on `USE_GHA_CRON`. Both
  "is `USE_GHA_CRON` on" and "did they run / succeed" are **UNKNOWN** (private
  repo → Actions API 404, no `gh`/token). Git shows **no agent commits since
  2026-05-14 and nothing on origin/main since 2026-05-13** — but these crons
  write to Notion/`CronRun`, not git, so that is not dispositive.
- **Net:** I cannot honestly confirm *firing* from any source I can reach. I can
  confirm *infrastructure is deployed and wired*. Closing the gap needs one of:
  GitHub Actions API auth, `DATABASE_URL`, the Inngest dashboard, or the Notion
  DB.

**Q2 — "Is the capability-builder improving the fleet?"**
- **Historically yes, recently not visibly.** It did real work in late April
  (inaugural 4/29 sweep → #13/#8/#2 shipped). But its **autonomous output has
  been silent for ~3 weeks**: no self-surfaced proposal since 2026-04-29, a
  one-entry weekly log frozen at 2026-04-26, and every 5/09–5/14 inbox item was
  routed *by Conner*, not generated by the agent. If the 3h cron is still
  firing, its product is going somewhere I can't see (Notion) and is **not**
  landing in the git-tracked capability memory.
- **Plainly:** the capability-builder is **not currently demonstrating
  autonomous fleet improvement in any verifiable artifact.** Treat it as
  dormant-until-proven-otherwise; the proof would be a Notion recommendations-DB
  check or a `CronRun` query.

---

## What's needed to turn the UNKNOWNs into facts
1. **GitHub Actions API auth** (`gh auth login` or a PAT) → flatsbo run history,
   conclusions, and the `USE_GHA_CRON` repo-variable value.
2. **`DATABASE_URL`** (flatsbo + agentplain Neon prod) → `CronRun` fire log,
   `AuditLog`, `WebhookEvent` counts — the authoritative "did it fire / do work."
3. **`INNGEST_SIGNING_KEY`** → reproduce the authenticated registration probe on
   `app.agentplain.com/api/inngest`.
4. **Notion recommendations DB access** → whether the capability-builder cron is
   producing output outside git.
