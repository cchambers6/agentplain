# agentplain — fleet technical architecture

Audience: Conner, technical reference.
Scope: how the agent fleet is actually wired in this repo today.
Out of scope: business positioning, pricing, marketing narrative.

Every structural claim cites the source file. Where something is built but
config-gated, that is called out explicitly. Where a vendor SDK or external
substrate is involved, the adapter/abstraction boundary is named.

The product is built _by_ the fleet. Sections describe code shapes, not
human engineer-days.

---

## 1. Repo + directory layout

Top level of `C:\agentplain\`:

```
app/                        Next.js 14 App Router — three route groups
  (marketing)/              public site (homepage, /[vertical], /pricing, /custom)
  (operator)/operator/      operator surface (fleet, inquiries, integrations, leadership-board)
  (product)/app/            customer surface (sign-in, workspace/[id]/{agents,approvals,activity,...})
  api/                      route handlers
    auth/                   NextAuth + magic-link
    custom-inquiry/         Inquiry intake (NEW → TRIAGED_*)
    health/                 /api/health
    inngest/route.ts        Inngest serve handshake — registers all cron fns
    integrations/           per-provider OAuth + workspace-scoped MCP routes
      gmail-mcp/[workspaceId]/route.ts
      outlook-mcp/[workspaceId]/route.ts
      docusign-mcp, excel-mcp, onedrive-mcp, quickbooks-mcp,
      slack-mcp, teams-mcp, google-drive-mcp
    knowledge/mcp/route.ts  JSON-RPC 2.0 over the pgvector substrate
    stripe/webhook/         Stripe billing webhook
    webhooks/{google,microsoft}/  Gmail Pub/Sub + Graph notifications
lib/                        domain modules — single swap points per domain
  agents/sentinel/          compliance corpus loader + literal-match scanner
  auth/                     NextAuth wrapping
  billing/                  Stripe provisioning
  brand/                    locked brand spec (in-repo)
  customer-files/           file ingestion + retrieve.ts (driver: DriveFileSource)
  db/{prisma.ts,rls.ts}     Prisma singleton + RLS GUC wrapper
  email/                    Resend adapter
  env.ts                    typed env reader (single SSOT)
  inngest/                  client + functions/ + disable-flag + cron wrappers
  integrations/             per-vendor adapters + per-vendor MCP servers
    mcp-core/               shared HTTP + JSON-RPC dispatch for MCP routes
    gmail-mcp/, outlook-mcp/, docusign-mcp/, ... (workspace-scoped servers)
    google/, microsoft/, docusign/, quickbooks/, slack/  (vendor SDK adapters)
    marketplace.ts          tile catalog (single source of truth)
    config-status.ts        env-presence gating
    oauth-urls.ts           authorize-URL builder
    webhook-idempotency.ts  dedupe + backoff for WebhookEvent
  knowledge/                pgvector store + OpenAI embedder + test impls
  llm/                      Anthropic provider + test provider
  observability/            Sentry provider, noop, structured logger, cron-monitor
  ops/                      OpsControlPlane (capability_inbox proposal #12 — partial)
  preferences/              WorkspacePreference capture, store, render
  skills/                   the value loop + per-skill catalog (see §4, §5)
  verticals/                10 verticals × content.ts + agent roster + JTBD tables
prisma/
  schema.prisma             45 models/enums (see §8); 981 lines
  migrations/               20260508000000_phase1_init + subsequent
scripts/                    one-shot scripts (seed-knowledge, demo-skill-chain,
                            inspect-knowledge-substrate, test-gmail-mcp, ...)
tests/                      Playwright + integration test harnesses
agent-state/                runtime JSONL logs (skill-runs/), audit notes
outputs/                    longform fleet-produced markdown (audits, packets)
memory/                     in-repo project memory pointers (small — most lives in
                            ~/.claude/projects/C--agentplain/memory/)
.husky/                     pre-push hook (lint + next build + 5-commit-behind soft cap)
sentry.{server,edge,client}.config.ts  Sentry boot, gated on SENTRY_DSN
instrumentation.ts          Next instrumentation hook that loads sentry config
next.config.mjs             withSentryConfig wrapping; routing config
tailwind.config.ts          brand tokens
```

The shape that matters: every external dependency is reached through a
folder under `lib/<domain>/`. Skills (`lib/skills/`), routes (`app/api/`),
and crons (`lib/inngest/functions/`) speak interfaces and types from
those folders — never the vendor SDK. This is the "no silent vendor
lock-in" rule from
`~/.claude/projects/C--agentplain/memory/feedback_no_silent_vendor_lock.md`
made structural.

---

## 2. The agent fleet org

### 2.1 How an agent is defined

Agents in this project are Claude Code _skills_. Each skill is a directory
under `C:\Users\conne\.claude\skills\<slug>\` with a single
`SKILL.md` file. As of writing there are 78 SKILL.md files
(`find C:/Users/conne/.claude/skills -name SKILL.md | wc -l → 78`).

Frontmatter shape — minimum:

```yaml
---
name: <slug>
description: <one paragraph; includes trigger phrases the harness keys on>
type: skill
recommended_model: opus | sonnet | haiku
---
```

Frontmatter shape — extended (see `flatsbo-attorney-firstpass/SKILL.md:1-11`):

```yaml
---
name: flatsbo-attorney-firstpass
description: ...
type: project
manager: conner
direct_reports: []
escalation_path: [conner]
decision_authority: flag-only (no clause modifications)
recommended_model: opus
recommended_effort: xhigh
---
```

Body conventions, observed across all 78 SKILL.md files:

- **Mission** — load-bearing one-paragraph statement of what the agent
  exists for. `b2b-ceo/SKILL.md:10` and `flatsbo-chief-of-staff/SKILL.md:10`
  are canonical.
- **How the service partnership lock shapes this role** — Reads the
  ratified `project_service_partnership_positioning.md` and restates
  what that lock means for this seat.
- **Reports — Up / Down / Peers** — explicit org graph in prose.
  `b2b-ceo/SKILL.md:28-34` enumerates direct reports
  (`b2b-eng-tech-lead`, `flatsbo-b2b-sales-director`,
  `b2b-client-service-director`) and the peer link to `flatsbo-ceo`.
- **Activate when** — the list of triggers (cron, keyword, peer
  escalation, approval-queue event).
- **On every activation, read these in order** — a numbered, mandatory
  read list of memory files. `b2b-ceo/SKILL.md:70-83` is 13 items;
  `flatsbo-capability-builder/SKILL.md:60+` is six "context blocks."
- **Activation outputs** — what the seat writes back: decisions log,
  recommendations file, daily-loop entry, fleet activity log.
- **Read on activation / Log on completion** — the contract for
  participating in the cross-fleet activity log
  (`b2b-ceo/SKILL.md:231-247`).
- **Proactive-work discipline** — daily-loop format
  (`today-i-did` / `what-i-struggled` / `what-would-make-me-better`)
  and the **voice block** requirement on every PENDING recommendation
  (`b2b-ceo/SKILL.md:249-277`).
- **SKILL evolution protocol** — "do NOT auto-overwrite this SKILL.md;
  propose evolutions in `<slug>_skills_updates.md`"
  (`b2b-ceo/SKILL.md:212-213`). The capability-builder ratifies.

### 2.2 Hierarchy and classes

The org graph is encoded in SKILL.md "Reports" sections, not in a
machine-readable file. Reading those sections yields the structure
below (file references are sample anchors, not exhaustive).

```
Conner
 ├─ Class B / meta agents (cross-business)
 │   ├─ flatsbo-chief-of-staff  (Tier 0; daily 06:00 ET brief; CoS for BOTH products)
 │   └─ flatsbo-capability-builder  (Tier 0/1 meta; every-3h sweep; ratifies SKILL.md changes)
 ├─ Class C / org-shared services
 │   └─ flatsbo-attorney-firstpass (first-pass legal review — flags only, never modifies)
 ├─ flatsbo-ceo   (FlatSBO consumer marketplace)
 │   └─ flatsbo-tech-lead → flatsbo-eng-{backend,frontend,qa,ops}, flatsbo-area-*, flatsbo-{compliance,security,seo,…}
 └─ b2b-ceo       (agentplain B2B)
     ├─ b2b-eng-tech-lead → b2b-eng-{backend,frontend,integrations,qa}
     ├─ flatsbo-b2b-sales-director → flatsbo-b2b-sales-{research,pitch,roi,rep,followup,collateral}
     └─ b2b-client-service-director (heads of vertical)
         ├─ b2b-head-of-realty            (ACTIVE — Product 2, locked 2026-04-29)
         ├─ b2b-head-of-insurance         (LATENT)
         ├─ b2b-head-of-home-services     (LATENT)
         └─ vertical ICs (realty-listing-coordinator, realty-buyer-inquiry-router,
            realty-showing-scheduler, realty-compliance-sentinel, realty-crm-hygiene,
            realty-production-reporter, realty-recruiter-assistant)
```

Source: `b2b-ceo/SKILL.md:28-34`, `b2b-head-of-realty/SKILL.md:49-60`,
`flatsbo-attorney-firstpass/SKILL.md:3-11`, plus the cross-references in
`flatsbo-chief-of-staff/SKILL.md:30-35`. The "two products coordinate
through one activity log" decision is stated at
`flatsbo-chief-of-staff/SKILL.md:35`.

Class summary as practiced today:

| Class | Examples | Property |
|---|---|---|
| Class A (per-business CEOs) | `flatsbo-ceo`, `b2b-ceo` | Top of their business chain; routes work; report up to Conner only. |
| Class B (cross-functional meta) | `flatsbo-chief-of-staff`, `flatsbo-capability-builder` | Tier 0; cross both products; do not own execution; surface, propose, ratify. |
| Class C (org-shared service) | `flatsbo-attorney-firstpass` | Cross-business shared function; flag-only / read-only authority. |
| Tier 1 (directors, tech leads) | `b2b-eng-tech-lead`, `flatsbo-tech-lead`, `b2b-client-service-director`, `flatsbo-b2b-sales-director` | Own decomposition + merge-gate inside their pod; route work down. |
| Tier 1.5 (vertical heads) | `b2b-head-of-realty`, `b2b-head-of-insurance`, `b2b-head-of-home-services` | Own one vertical's roadmap + sales narrative + integration prio. |
| ICs (specialists + per-vertical agents) | `b2b-eng-backend`, `flatsbo-area-*`, `realty-*` | Do the work; never orchestrate. |

### 2.3 The leadership-autonomy mandate

The mandate "look for how things can run better and run them better"
is encoded as the **autonomous-improvement mandate** in the senior
seats' SKILL.md files. Two anchors:

- `b2b-ceo/SKILL.md:26` — "every weekly review includes a check on 'what
  made the service partnership easier or harder to deliver this week,
  and what skill / runbook / artifact would make it easier next week.'"
- `b2b-head-of-realty/SKILL.md:26` — "weekly review asks 'what one
  change would make the service partnership easier to deliver inside
  realty businesses next week'."

Capability-builder is the seat that ratifies the resulting SKILL.md
changes (`flatsbo-capability-builder/SKILL.md:38` —
"introduce-don't-overwrite rule").

### 2.4 Hierarchical approval chain

Only escalations + strategic items reach Conner. The chain in prose:

```
IC / specialist  ──► Tier 1 director or vertical Head
                                    │
        decision in scope?  ───────►│  decide locally, log to decisions_log
        out of scope / strategic ──►▼
                            Class A CEO (b2b-ceo or flatsbo-ceo)
                                    │
                                    ▼
                                 Conner
```

Encoded at multiple seats — `b2b-ceo/SKILL.md:197-202` ("the CEO routes;
it does not orchestrate") and the **$1K+ investment gate** at
`b2b-ceo/SKILL.md:131-145` (Bezos one-way / two-way door framing,
Klein pre-mortem for one-way ≥ $1K).

The same chain shows up structurally in code at
`prisma/schema.prisma:140-147`: the `CapabilityProposalState` enum is
`DRAFT → AWAITING_VOICE_BLOCK → AWAITING_REVIEW → RATIFIED/REJECTED/SUPERSEDED`,
mirroring the human ratification step.

---

## 3. How the fleet actually runs (cron substrates)

The fleet runs on two cron substrates in different repos. Both produce
**WorkApprovalQueueItem** rows (when proposing customer-facing work) or
**memory deltas** (when proposing fleet-level work).

### 3.1 agentplain — Inngest (in this repo)

Inngest is the production cron + event runner for the agentplain runtime.
Registered at `app/api/inngest/route.ts:14-33`:

```ts
// app/api/inngest/route.ts:25
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    trialExpirationWarningsFn,           // billing reminder cron
    integrationRenewalSweepFn,           // OAuth token + Gmail watch renewal
    processWebhookEventFn,               // ← the value-loop drain
    customerFilesIngestionSweepFn,       // Drive→KnowledgeDocument
  ],
});
```

Enumerated functions, their schedules, and where each is defined:

| Function id | Cron | Defined in | What it does |
|---|---|---|---|
| `agentplain-process-webhook-event` | `*/5 * * * *` | `lib/inngest/functions/process-webhook-event.ts:53-57` | Drains unprocessed `WebhookEvent` rows for `GOOGLE` + `M365` and runs the value loop. |
| `agentplain-integration-renewal-sweep` | `0 */2 * * *` | `lib/inngest/functions/integration-renewal-sweep.ts:45-47` | Refreshes OAuth access tokens (5 min leeway) + extends Gmail `users.watch` subscriptions (24 h lookahead; 7-day max per Google's docs). |
| `agentplain-trial-warnings` | `0 10 * * *` | `lib/inngest/functions/trial-expiration-warnings.ts:34-35` | 7 / 3 / 1-day trial expiration emails via the Resend adapter; uses `Subscription.lastTrialWarningDays` to guard double-fire. |
| `agentplain-customer-files-ingestion-sweep` | `0 */6 * * *` | `lib/inngest/functions/customer-files-ingestion-sweep.ts:58-69` | Walks Workspaces and re-ingests files. Today's default `DriveFileSource` returns `NOT_CONFIGURED` until per-workspace Google Drive OAuth lands — the cron is a graceful no-op per workspace pre-OAuth. |

Every Inngest function body is wrapped in the same composition pattern.
From `process-webhook-event.ts:258-284`:

```ts
async () =>
  runWithDisableGate(PROCESS_WEBHOOK_EVENT_FUNCTION_ID, () =>
    withCronMonitor(
      { slug: PROCESS_WEBHOOK_EVENT_FUNCTION_ID,
        schedule: PROCESS_WEBHOOK_EVENT_CRON },
      () =>
        withInngestErrorReporting(
          { functionId: PROCESS_WEBHOOK_EVENT_FUNCTION_ID },
          async () => { ... },
        ),
    ),
  )
```

Three concentric wrappers, in order from outside in:

1. **`runWithDisableGate`** (`lib/inngest/run-with-disable-gate.ts`)
   reads `INNGEST_FN_DISABLE_<NORMALIZED_ID>` from env. Pausing a
   function is one env-var flip, no redeploy. The prefix +
   normalization rule is in `lib/inngest/disable-flag.ts:36-53`.
   "Inngest itself is the live fleet runner per
   `reference_inngest_is_the_live_fleet`. The disable-flag pattern …
   is the in-house portability surface above Inngest" —
   `app/api/inngest/route.ts:10-13`.
2. **`withCronMonitor`** (`lib/observability/cron-monitor.ts:177-198`)
   sends Sentry `captureCheckIn` events around the run
   (`start → ok/error`). Gated on `SENTRY_DSN` —
   `cron-monitor.ts:89-100`. No DSN ⇒ noop runner.
3. **`withInngestErrorReporting`** (`lib/inngest/with-error-reporting.ts`)
   tags failures with `boundary=inngest, function_id=<id>` so the
   Sentry "issues by tag" view groups cleanly.

### 3.2 Cold-start-safe agents

`feedback_cold_start_safe_agents.md` is encoded structurally in every
cron body. Each function re-reads everything it needs from durable
state on every fire:

- `process-webhook-event.ts:81-98` — `prisma.webhookEvent.findMany`
  every fire; no in-memory cursor.
- `process-webhook-event.ts:129-132` — `getWorkspacePreference(ctx, id)`
  is called inside the per-event loop, never cached across events.
- `integration-renewal-sweep.ts:66-72` — re-queries
  `webhookSubscription.findMany` per fire.
- `process-webhook-event.ts:138-140` — customer-context retriever is a
  closure built per event; not memoized.

The skill chain itself (`lib/skills/runner.ts:75-127`) takes preferences
+ resolver as **inputs** so the runner cannot accidentally cache them
across runs.

### 3.3 flatsbo — GitHub Actions (cross-reference)

The sibling repo `C:\flatsbo` runs its fleet on GitHub Actions cron
workflows, **not** Inngest. There are 29 workflow files in
`C:\flatsbo\.github\workflows\` — 26 are cron-prefixed
(`cron-cos-daily-brief.yml`, `cron-b2b-head-of-realty-daily.yml`,
`cron-capability-builder-morning.yml`, …) plus `ci.yml`, `lint.yml`,
`main-sentinel.yml`, `post-merge-smoke.yml`.

Each cron workflow shape (`cron-cos-daily-brief.yml:21-76`):

```yaml
on:
  schedule:
    - cron: '8 10 * * *'         # staggered minute to avoid the :00 thundering herd
  workflow_dispatch:
concurrency:
  group: cron-cos-daily-brief
  cancel-in-progress: false
jobs:
  fire:
    if: ${{ ... || vars.USE_GHA_CRON == 'true' }}
    steps:
      - actions/checkout
      - actions/setup-node@v4 (node 20, cache: npm)
      - npm ci
      - npx prisma generate
      - npx tsx scripts/cron/run-skill.ts <skill-id>
      - npx tsx scripts/cron/commit-output.ts <skill-id>
```

Crons stagger by minute (`'17 13 * * *'` for realty head,
`'19 13,20 * * *'` for listing-coord readiness, `'0 */3 * * *'` for
capability-builder, etc.) to spread load.

**The commit-cron-output path** is what makes the fleet
self-driving: when a cron produces a memory delta, it gets pushed to
its own branch and a PR opens against `main`.

- Mint installation token via `lib/github/app-auth.ts` (GitHub App
  installation flow, ~1h tokens, private key from
  `FLEET_GH_APP_PRIVATE_KEY` env or path —
  `app-auth.ts:18-22`). Per-vendor portability interface is
  `ForgeAppAuth` (`app-auth.ts:51-54`).
- Stage / commit / `push --force-with-lease` to
  `fleet/auto/<cronId>` (`commit-cron-output.ts:1-37`). Force-push is
  safe because the branch is exclusively fleet-owned and each run
  recomputes from `base + delta`.
- Open or update the PR via `IPullRequestAdapter` (vendor-neutral).
- Re-read the remote ref via GitHub API after push;
  push is not "done" until the remote SHA matches local HEAD —
  `commit-cron-output.ts:35-37`, the feedback_verify_after_create
  discipline.

**Why two substrates, not one?** agentplain's value loop fires on a
**user event** (Gmail Pub/Sub push → `WebhookEvent` row → 5-min sweep)
so a long-running cron platform with retries + dead-letter is the
right shape. flatsbo's fleet fires on a **calendar** (daily briefs,
weekly recaps) and needs git push as a side effect, which GHA gives
for free. The dual-run safety toggle `USE_GHA_CRON` lets each cron
roll back without removing the workflow
(`cron-cos-daily-brief.yml:18-19,42`).

---

## 4. The value loop

The five-phase value loop is the agentplain runtime's product. It
reads inbound messages and produces structured proposals; it never
sends.

```
WebhookEvent (Gmail Pub/Sub or Graph notification)
        │
        ▼  cron *5 min*
    processUnprocessedWebhookEvents()  ── lib/inngest/functions/process-webhook-event.ts:73
        │
        ▼  per event
    runSkillChain()                    ── lib/skills/runner.ts:110
        │
        ▼  ordered phases
   ┌────────────────────────────────────────────────────────────┐
   │ 1. Read           lib/skills/read.ts            (fetch+parse) │
   │ 1.5 Office-admin  lib/skills/office-admin/      (short-circuit)│
   │ 2. Categorize     lib/skills/categorize.ts                    │
   │     ├─ noise/transactional/vendor/lead → mark processed       │
   │     ├─ scheduling-needed → 3 + 4 + 5                          │
   │     └─ draft-needed → 3 + 5                                   │
   │ 3. Coordinate     lib/skills/coordinate.ts                    │
   │ 4. Schedule       lib/skills/schedule.ts        (conditional) │
   │ 5. Draft          lib/skills/draft.ts           (conditional) │
   │ 5.5 Compliance    lib/agents/sentinel/scanner.ts (literal-match│
   │                                                  over draft) │
   │ 6. Mark processed                                             │
   └────────────────────────────────────────────────────────────┘
        │
        ▼
    persistSkillRunArtifacts()         ── lib/skills/persist-artifacts.ts:34
        │
        ▼
   HandoffLogEntry rows  (one per stage transition)
   WorkApprovalQueueItem rows  (one per draft / admin action /
                                compliance flag — PENDING by default)
   AuditLog row  action='skills.loop.completed'
```

Sources:

- The 5-skill contract: `lib/skills/types.ts:56-59` defines
  `ISkill<TInput, TOutput>`; each phase has `run()` returning
  `SkillResult<T>`.
- Branch logic by intent: `lib/skills/runner.ts:267-277`.
- Office-admin pre-pass that short-circuits before vertical
  categorize: `lib/skills/runner.ts:198-234` —
  verification codes / password resets / billing notices / security
  alerts get routed to the approval queue without a vertical-LLM
  pass.
- Confidence floor demotes low-confidence categorize results to noise:
  `lib/skills/runner.ts:255-265` (threshold 0.6).
- Draft persistence threshold: `lib/skills/draft.ts:52` —
  `DEFAULT_PERSIST_THRESHOLD = 0.5`. Below 0.5 the draft is generated
  but **not persisted** to Gmail Drafts; it lives in the approval
  queue for human handling.

### 4.1 The trust boundary — no-auto-send architecture

`project_no_outbound_architecture.md` is the load-bearing rule for
this loop. It is encoded in three places that together form a
**compile-time** guarantee that no skill can send on the customer's
behalf:

1. **The `DraftPersister` interface has no `send` method.**
   `lib/skills/types.ts:218-228` defines exactly one mutation:
   `persistDraft({ ... }): Promise<SkillResult<{ providerDraftId }>>`.
   There is no `sendMessage` / `submitDraft` / `users.messages.send`
   path declared. A skill cannot call what does not exist in the
   interface it consumes.

   ```ts
   // lib/skills/types.ts:218
   export interface DraftPersister {
     readonly name: string;
     persistDraft(args: {
       workspaceId: string;
       threadId: string;
       inReplyToMessageId: string | null;
       toEmails: string[];
       subject: string;
       body: string;
     }): Promise<SkillResult<{ providerDraftId: string }>>;
   }
   ```

2. **The Gmail MCP server exposes `users.drafts.create` only.**
   `lib/integrations/gmail-mcp/server.ts:16-19` — "this file exposes
   `users.drafts.create` (the customer's system later sends from
   Drafts) but never `users.messages.send` or `users.drafts.send`.
   Code that deviates fails contract tests."

3. **Scope policy in `marketplace.ts`.** The OAuth scopes the connect
   flow requests are listed at
   `lib/integrations/marketplace.ts:71-99`. Gmail asks for
   `gmail.readonly, gmail.modify, gmail.compose` — no `gmail.send`.
   Outlook asks for `Mail.Read, Mail.ReadWrite, offline_access` — no
   `Mail.Send` (explicitly noted in the comment at
   `marketplace.ts:91-95`).

Verification: `grep -rn "gmail.send\|usersMessagesSend\|@sendgrid\|twilio"`
across `lib/` returns no callers in `lib/skills/` or `lib/integrations/`
that would send a message. The only `sendgrid|twilio` mentions are in
`lib/skills/office-admin/screen.ts:66` — a regex of vendor domains the
classifier recognizes as automated email sources (so it can route
their messages to the admin queue).

`WorkApprovalQueueItem` is created **unconditionally** for any draft
the chain produces (`lib/skills/persist-artifacts.ts:1-25` — "one row
per draft the chain produced, so `/approvals` lists drafts for human
review before the customer's send happens out of Gmail Drafts").
There is no auto-approve path for these rows; the customer's broker-
owner decides.

### 4.2 The JSONL run log

After every chain pass, the runner appends a `SkillRunRecord` to
`agent-state/skill-runs/<yyyymmdd>.jsonl` (`lib/skills/runner.ts:425-436`).
Failures to write are best-effort warnings — never fail the loop on
log I/O. The on-disk log is the human-readable companion to the
`AuditLog` row written at `process-webhook-event.ts:166-181`.

### 4.3 Retry + dead-letter

Per-event failures don't kill the sweep. `process-webhook-event.ts:184-213`:

- A throw is captured to Sentry tagged with workspace_id + event_id.
- `decideRetry({ attemptCount + 1 })`
  (`lib/integrations/webhook-idempotency.ts`) computes exponential
  backoff and the deadletter cutoff.
- `WebhookEvent.attemptCount` bumps; `nextAttemptAt` advances;
  `deadlettered=true` past the threshold.
- `readyForProcessingFilter()` excludes deadlettered + in-backoff rows
  from the next sweep.

The renewal sweep applies the **verify-after-create** discipline at
`integration-renewal-sweep.ts:229-236, 281-287` — after every Prisma
mutation it reads the row back and asserts the expected fields are
set; a verify failure is propagated as a typed error rather than
silently leaving stale rows.

---

## 5. Skills system

### 5.1 The skill catalog

`lib/skills/registry.ts:62-739` lists every catalog skill. Each entry
(`SkillCatalogEntry`, `registry.ts:38-60`) declares:

```ts
{
  slug,               // matches lib/skills/<slug>/
  name,               // customer-facing
  vertical,           // 'all' | 'real-estate' | 'cpa' | 'law' | 'ria' | …
  description,
  kind: 'draft' | 'triage' | 'coordinate',  // never 'send'
  mcpDependencies: [
    { provider, status: 'built' | 'in-flight' | 'stubbed-json', note }
  ],
  groundedIn: [<memory file paths or external rules>],
  defaultEnabled?: boolean,                  // office-admin = true
}
```

Catalog contents today (`registry.ts:62-731`):

| Slug | Vertical | Kind | MCP-built deps | Stubbed-JSON deps |
|---|---|---|---|---|
| `chief-of-staff-scheduler` | all | coordinate | gmail, outlook, work-approval-queue | google-calendar, m365-calendar |
| `office-admin` | all (default-on) | triage | gmail, outlook | — |
| `inbox-triage-general` | all | triage | gmail, outlook | work-approval-queue |
| `follow-up-chaser-general` | all | draft | gmail, outlook | work-approval-queue |
| `process-doc-drafter-general` | all | draft | — | workspace-activity-log, notion, work-approval-queue |
| `invoice-chasing-realestate` | real-estate | draft | gmail | quickbooks, follow-up-boss |
| `lead-triage-realestate` | real-estate | triage | gmail | follow-up-boss (outlook in-flight) |
| `month-end-close-cpa` | cpa | coordinate | gmail | quickbooks |
| `law-intake-conflict-screen` | law | triage | gmail | clio |
| `ria-client-update-draft` | ria | draft | gmail | orion, redtail |
| `insurance-coi-request` | insurance | coordinate | gmail | ezlynx |
| `mortgage-document-chase` | mortgage | coordinate | gmail | encompass |
| `home-services-estimate-followup` | home-services | draft | gmail | acculynx |
| `recruiting-candidate-status-update` | recruiting | draft | gmail | greenhouse |
| `property-management-rent-collection-chase` | property-management | coordinate | gmail | appfolio |
| `title-escrow-closing-doc-chase` | title-escrow | coordinate | gmail | softpro |

The `stubbed-json` status is honest about scope: the skill body accepts
the same provider-neutral JSON shape today that the eventual MCP
adapter will produce. Switching to a live MCP is a new factory binding,
not a rewrite. This is the **two-implementation rule** from
`feedback_runner_portability.md` made structural.

### 5.2 Vertical binding — `boundSkill` and `owns[]`

Each of the 10 verticals declares an **agent roster** in
`lib/verticals/<slug>/content.ts`. Each roster entry maps to either:

- a **catalog skill slug** via `boundSkill` (e.g. real-estate's
  Chief of Staff card binds to `chief-of-staff-scheduler` at
  `lib/verticals/real-estate/content.ts:81-92`), or
- an **owned loop work bucket** (`buyer-inquiry`, `scheduling`,
  `compliance-check`) via `owns[]` — meaning the inbox chain's
  outcome attribution lands on this roster card. E.g. realty's
  Buyer Inquiry Router owns `["buyer-inquiry"]` at
  `lib/verticals/real-estate/content.ts:36-42`.

The validation rule lives in
`lib/verticals/types.ts:204-213` and is test-gated by
`tests/vertical-roster-bindings.test.ts`:

> `runtime: 'live'` requires at least one of `owns[]` or `boundSkill`.
> When `boundSkill` is set it MUST point to a `SKILL_CATALOG` entry.
> **NO HOLLOW SHELLS.** A bound skill must ship with real logic +
> stubbed-fetcher fallback + a passing test or the card stays `rooting`.

### 5.3 Per-skill structure on disk

Each skill is a folder under `lib/skills/<slug>/`. Example —
`lib/skills/chief-of-staff-scheduler/`:

```
index.ts               public exports
types.ts               ApprovalSink interface, ChiefOfStaff{Input,Output},
                       proposal kinds
skill.ts               core logic — Prisma-free, takes ApprovalSink as port
json-fetcher.ts        stubbed-JSON fetcher (the two-impl bottom half)
approval-sink.ts       in-memory RecordingApprovalSink (tests)
prisma-approval-sink.ts PrismaApprovalSink — only file in this skill that imports prisma
run-for-workspace.ts   production wrapper that binds PrismaApprovalSink
skill.test.ts          end-to-end test
prisma-approval-sink.test.ts
```

Notable contract — the **persistence boundary is a port at the skill's
edge**, not buried in the skill body. From
`chief-of-staff-scheduler/run-for-workspace.ts:7-13`:

> The skill itself (`./skill.ts`) stays Prisma-free per
> `feedback_runner_portability.md` — only this thin wrapper imports the
> Prisma binding. Tests can still call `runSkill` directly with a
> `RecordingApprovalSink` and assert the no-outbound contract without
> touching the database.

### 5.4 Vertical-specific vs shared skills

- **Shared (vertical: `'all'`)** — `chief-of-staff-scheduler`,
  `office-admin`, `inbox-triage-general`, `follow-up-chaser-general`,
  `process-doc-drafter-general`. These run regardless of vertical.
  `office-admin` is `defaultEnabled: true`
  (`registry.ts:173`) — every workspace gets it on signup.
- **Vertical-specific** — one or more per vertical. Realty has the
  most (invoice-chasing, lead-triage); the other 9 each have one
  flagship skill today.

The runner does **not** dispatch by skill catalog slug. It runs the
fixed five-phase pipeline, and the **prompt bundle** is keyed by
vertical (`lib/skills/runner.ts:112` —
`getPromptBundleByEnum(workspace.vertical as Vertical)`). Catalog
entries describe **callable** skills (the chief-of-staff-scheduler is
called from the per-workspace daily run, not from the inbox chain).

### 5.5 No direct vendor SDK calls

Per `feedback_no_silent_vendor_lock.md`, **vendor SDKs are confined
to `lib/integrations/<provider>/`.** Skills (and the runner) call
provider-neutral interfaces:

- `MessageFetcher` (`lib/skills/types.ts:115-130`) — used by
  Read + Coordinate. Production wiring is
  `GmailMessageAdapter` (in `lib/skills/gmail-fetcher.ts`, which
  wraps the Gmail MCP server at
  `lib/integrations/gmail-mcp/server.ts`) or `OutlookMessageAdapter`
  (`lib/skills/outlook-fetcher.ts`). The runner is provider-agnostic
  — `process-webhook-event.ts:225-239` picks the adapter from the
  credential's `provider` enum value.
- `DraftPersister` (`lib/skills/types.ts:218-228`) — both adapters
  implement both interfaces, so the same object satisfies
  `fetcher: adapter, persister: adapter`
  (`process-webhook-event.ts:141-148`).
- `LlmProvider` (`lib/llm/types.ts`) — Anthropic in production,
  test heuristic stub for unit + e2e tests.

---

## 6. Memory / knowledge substrate

There are **three** distinct memory layers in this project. They serve
different audiences and have different lifecycles.

### 6.1 Production knowledge substrate — pgvector + MCP

The customer-runtime knowledge layer. Live in Postgres.

**Storage** — `prisma/schema.prisma:689-726`:

- `KnowledgeDocument` (human-readable: title + body + sourceUrl +
  verticalSlug + metadata, plus `contextKind` and optional
  `workspaceId`).
- `Embedding` — one row per `(sourceType, sourceId)`. The vector
  column is `Unsupported("vector(1536)")`
  (`schema.prisma:746`) — Prisma's escape hatch for pgvector
  columns. All I/O happens through `$queryRawUnsafe` inside
  `lib/knowledge/pgvector-store.ts` (the only file that does so).
- Dimension `1536` matches OpenAI `text-embedding-3-small`
  (`schema.prisma:714-718`).

**Five context kinds** — `prisma/schema.prisma:228-234` /
`lib/knowledge/types.ts:97-102`:

| ContextKind | workspaceId | Description |
|---|---|---|
| `SKILL` | NULL | Capability documentation (read/categorize/coordinate/schedule/draft + the skill catalog). |
| `CUSTOMER` | **required** | Workspace-scoped knowledge — CRM facts, prefs, history. |
| `VERTICAL` | NULL | Pattern-level vertical knowledge (real estate vs CPA vs law). |
| `CROSS_CUSTOMER` | NULL | Anonymized fleet learnings derived offline. |
| `COMPLIANCE` | NULL | State + per-vertical rule corpus (fair housing, RESPA, …). |

The rule "`workspaceId` is required for `CUSTOMER` and forbidden
otherwise" is enforced **at three layers**:

1. Application — `KnowledgeUpsertInput` validation
   (`lib/knowledge/types.ts:114-130`) returns
   `CUSTOMER_REQUIRES_WORKSPACE` or `NON_CUSTOMER_HAS_WORKSPACE`.
2. Database — Postgres CHECK constraint on `KnowledgeDocument` +
   `Embedding`.
3. RLS — the trigger in the migration enforces the policy at row read.

**RLS** — `lib/db/rls.ts:43-58`. Every Prisma query that touches a
workspace-scoped table runs inside a `$transaction` whose first
statement is `set_config('app.user_id', ..., true)` +
`set_config('app.workspace_id', ..., true)` +
`set_config('app.is_operator', ..., true)`. The `true` scopes the GUC
to the transaction so a leaked pool connection can never carry
context to the next request.

Helpers:

- `withRls(ctx, fn)` — explicit context.
- `withSystemContext(fn)` — operator/system (no workspace) — used by
  cron handlers, webhook handlers, and the auth flow before a session
  exists (`lib/db/rls.ts:64-68`).
- `SYSTEM_OPERATOR_CONTEXT` — the singleton context object.

**Substrate boundary** — `lib/knowledge/index.ts`. Two interfaces
satisfy the two-impl rule:

| Interface | Production impl | Test impl |
|---|---|---|
| `IEmbeddingProvider` (`lib/knowledge/types.ts:84-93`) | `OpenAIEmbeddingProvider` (`openai-embedding.ts`) — the **only** file that imports the OpenAI SDK | `TestEmbeddingProvider` — deterministic hash-to-vector |
| `IKnowledgeStore` (`lib/knowledge/types.ts:185-193`) | `PgvectorKnowledgeStore` — the **only** file that issues pgvector SQL | `TestKnowledgeStore` — process-singleton, in-memory |

Selection happens in `lib/knowledge/index.ts:44-93` based on
`KNOWLEDGE_EMBEDDING_PROVIDER` + `KNOWLEDGE_STORE` env vars; the
fallback when `OPENAI_API_KEY` is absent is the test embedder, so the
chain stays runnable on mock data until the prod key lands.

**MCP exposure** — `app/api/knowledge/mcp/route.ts:1-28`. The
substrate is reached via JSON-RPC 2.0 with method names
`knowledge.search`, `knowledge.upsert`, `knowledge.delete`. Auth:
shared-secret header `x-agentplain-mcp-key` against `MCP_API_KEY`;
optional `x-agentplain-workspace-id` header scopes the call. Without
the workspace header, calls run as operator/system.

**Retrieval into the loop** — `process-webhook-event.ts:138-140`
constructs a `customerContextResolver` closure that, on each fire,
calls `retrieveCustomerContext({ workspaceId, query })` and inlines
the top-k snippets into the draft + coordinate prompts at
`runner.ts:174-190`. Best-effort: a retrieval error never drops the
loop (the runner catches and falls back at
`runner.ts:185-189`).

### 6.2 Markdown memory layer A — orchestrator/agent memory

This is the file system Claude Code reads to know who Conner is, what
the project is, and how to behave. Layout:

```
~/.claude/projects/C--agentplain/memory/
  MEMORY.md                    one-line index of every memory file
  feedback_*.md                feedback-class entries (corrections + confirmations)
  project_*.md                 project-class entries (state, ratifications)
  PROJECT_STATE.md             snapshot of in-flight work
  user_*.md                    user-class entries (about Conner)
  reference_*.md               reference-class entries (external system pointers)
```

The four types are defined in the global instructions
(`~/.claude/CLAUDE.md`, `auto memory` section): **user**, **feedback**,
**project**, **reference**.

**Frontmatter shape** (every memory file):

```yaml
---
name: <short-kebab-case-slug>
description: <one line — used to decide future-conversation relevance>
metadata:
  type: user | feedback | project | reference
---

<memory body>
For feedback/project: lead with the rule, then **Why:** then **How to apply:**
```

`MEMORY.md` is the index — never the content. The convention is
strict: one-line pointers, under ~150 chars; lines past 200 may be
truncated when loaded into context.

**Linking** — bodies reference other memories with `[[slug]]`. A
broken `[[slug]]` is intentional ("write later, not error").

Sibling tree — `~/.claude/projects/C--flatsbo/memory/` — holds the
cross-product activity log, decisions log, agent-state subdirs, and
the orchestrator memory tree shared between FlatSBO and agentplain
("memory still co-located at `~/.claude/projects/C--flatsbo/memory/`
per the 2026-04-28 decision until B2B grows enough to warrant
separation" — `flatsbo-chief-of-staff/SKILL.md:33`).

### 6.3 Markdown memory layer B — CLAUDE.md project instructions

Layered. Highest-priority first:

1. **Global** — `~/.claude/CLAUDE.md`. User identity, default
   behavior, active-project pointer, the entire auto-memory protocol.
2. **Per-project** — `C:\agentplain\CLAUDE.md` (when present),
   `C:\flatsbo\CLAUDE.md`. Stack conventions, naming, project-specific
   rules. Always loaded when a Claude Code session opens in that
   directory.
3. **Per-skill** — `~/.claude/skills/<slug>/SKILL.md` (see §2.1).
   Loaded when the skill is invoked.

The hierarchy: project CLAUDE.md takes precedence over global on
project-specific conventions; SKILL.md frontmatter `recommended_model`
hints to the harness which model to run with.

### 6.4 The preference-learning store

`WorkspacePreference` (`prisma/schema.prisma:892-918`) — one row per
workspace, four fields:

- `draftingTone` — `plain | warm-professional | formal` or NULL.
- `categorizationNotes` — free-text from onboarding; inlined verbatim
  into categorize prompt under `WORKSPACE-CATEGORIZATION-NOTES`.
- `calendarWindow` — label like `"9-5 weekdays"` or `"custom"`;
  schedule skill constrains slot proposals accordingly.
- `learnedDraftNotes: String[]` — newest-first, capped at 20. Each
  entry is a one-line observation derived from a `DRAFT_EDIT` or
  `DRAFT_REJECT` signal. Inlined verbatim into the draft prompt under
  a `WORKSPACE-LEARNED PREFERENCES` header.

**Append-only signal log** — `PreferenceSignal`
(`prisma/schema.prisma:924-950`). One row per captured signal so the
aggregate can be rebuilt from history if `WorkspacePreference` is
overwritten.

**Capture path** — `lib/preferences/capture.ts:1-29`:

- `captureDraftEditSignal({ workspaceId, approvalItemId, originalBody,
  finalBody })` — diff origin vs final, derive one-line learned note.
- `captureDraftRejectSignal(...)` — `decisionReason` becomes the
  learned note verbatim.

Both passes (1) write a `PreferenceSignal` row, (2) prepend the
derived note to `WorkspacePreference.learnedDraftNotes`.

**Render into prompts** — `lib/preferences/render.ts:1-25`. The
runner calls `renderPreferencesBlock` twice per fire
(`runner.ts:118-126`) — once with `includeLearnedNotes: true` for the
draft prompt, once with `false` for everything else
(categorize shouldn't be biased by stylistic learnings).

Per `feedback_cold_start_safe_agents.md` the next chain fire reads
the new note fresh from disk (`process-webhook-event.ts:129-132`).

---

## 7. Integrations

### 7.1 MCP-first architecture

Every customer-side integration is a **workspace-scoped MCP server**.
Skill code calls into it via `mcp.call(server, tool, args)` — never
the vendor SDK directly.

Built MCP servers (one folder under `lib/integrations/<slug>-mcp/`):

```
gmail-mcp/        gmail-google     wraps googleapis (the only file allowed to)
outlook-mcp/      outlook-m365     wraps Microsoft Graph
docusign-mcp/     docusign         wraps DocuSign REST
excel-mcp/        excel-m365       wraps Graph Excel
onedrive-mcp/     onedrive-m365    wraps Graph Files
google-drive-mcp/ drive-google     wraps Drive v3
quickbooks-mcp/   quickbooks       wraps Intuit QBO REST
slack-mcp/        slack            wraps Slack Web API
teams-mcp/        teams-m365       wraps Graph Teams
```

Each server implements an interface from its `types.ts` (e.g.
`GmailMcpServer` in `lib/integrations/gmail-mcp/types.ts`). The route
that exposes it lives at
`app/api/integrations/<slug>-mcp/[workspaceId]/route.ts` — thin
wrappers that hand `lib/integrations/mcp-core/route.ts` a server
factory + tool registry.

**Shared route logic** — `lib/integrations/mcp-core/route.ts:1-18`.
Handles:

- Auth layering — `MCP_API_KEY` shared secret OR session
  (operator / ACTIVE member of the workspace).
- JSON-RPC envelope validation.
- HTTP status mapping.
- The `[workspaceId]` path param is the source of truth — server
  builds bound to **that** workspace, cross-workspace access is
  impossible per request.

**Workspace-bound construction** — see
`gmail-mcp/server.ts:61-70`. The server takes `workspaceId` in its
constructor; if absent it throws. Per
`server.ts:21-23` ("every public method re-resolves the credential
via `./auth.ts:resolveCredential`"), no decrypted credential persists
on the instance — cold-start-safe at the MCP level too.

### 7.2 OAuth + config-status gating

Two-stage gating prevents the UI from claiming a connection is "live"
when it would dead-end at OAuth:

- **Catalog** — `lib/integrations/marketplace.ts:71-269`. Single
  source of truth for what integrations exist. Each entry declares
  `id`, `name`, `category`, `mcpEndpointTemplate`,
  `scopes` (no `send` scope ever — `marketplace.ts:91-95`),
  `oauthConfigKey`, `status: 'available' | 'coming-soon' | 'beta'`,
  and `providerKey` (the `IntegrationProvider` enum value the DB
  row will hold).
- **Env-presence check** — `lib/integrations/config-status.ts:33-59`.
  `isProviderConfigured(providerKey)` returns true only when
  `env.<provider>OAuthClientId()` AND `<provider>OAuthClientSecret()`
  are present. Tiles + CTAs gate on this so a click never lands on
  `oauth_not_configured`.

This is the in-house counterpart to feature-flag platforms — gating
without a vendor.

### 7.3 OAuth credential storage

`prisma/schema.prisma:540-580`:

- One `IntegrationCredential` per `(workspaceId, provider, accountId)`.
- `accessTokenEncrypted`, `refreshTokenEncrypted` — AES-256-GCM
  ciphertext (`v1:iv:tag:ciphertext` format). Raw tokens never appear
  in this table or in logs.
- `lib/security/encryption.ts:isEncryptionConfigured()` is checked
  before any decryption — `integration-renewal-sweep.ts:86-96` short-
  circuits with a clear per-row failure reason when the master key is
  missing, rather than throwing per credential.
- `providerMetadata: Json` for non-secret per-account routing data
  (DocuSign `base_uri`, QuickBooks `realmId`, Slack `team_id`).
  Comment at `schema.prisma:565-569` is explicit: "Never store
  secrets here."

### 7.4 The adapter portability pattern

Each vendor folder under `lib/integrations/<vendor>/` exposes a
**provider interface** that the rest of the codebase calls. Two
implementations per interface (`feedback_runner_portability.md`):

```
lib/integrations/google/
  ├─ gmail-provider.ts    GoogleProvider impl — wraps googleapis
  └─ types.ts             GoogleProvider interface
lib/integrations/microsoft/
  ├─ outlook-provider.ts  M365Provider impl — wraps Graph
  └─ types.ts
```

The renewal sweep doesn't know which vendor it's renewing — at
`integration-renewal-sweep.ts:181`,
`provider = getProvider(credential.provider)` returns the matching
interface, and the sweep speaks
`provider.refreshTokens(...)` + `provider.renewSubscription(...)`
agnostically.

### 7.5 The Gmail MCP — reference implementation

`lib/integrations/gmail-mcp/` is the most complete example. Files:

```
auth.ts          resolveCredential({ workspaceId }) — re-reads + decrypts per call
index.ts         public exports
json-rpc.ts      envelope helpers
server.ts        ProdGmailMcpServer — implements GmailMcpServer interface
test-server.ts   FixtureGmailMcpServer — in-memory, deterministic
types.ts         GmailMcpServer interface, input/output shapes
```

Tools exposed (`server.ts`, summarized): `listMessages`,
`searchThreads`, `getMessage`, `labelMessage`, `listLabels`, `readResource`
(gmail:// URIs), `draftMessage` (the **only** mutation surface — the
no-outbound contract enforced at the interface).

### 7.6 Webhook ingestion (the Gmail Pub/Sub path)

```
Gmail mailbox change
   │  (Pub/Sub push to /api/webhooks/google)
   ▼
app/api/webhooks/google/route.ts
   │  decode + verify Pub/Sub envelope
   │  inside Pub/Sub's 30-second ACK deadline:
   │    INSERT INTO WebhookEvent (rawPayload, dedupeKey, …)
   │  ACK 200 OK
   ▼
WebhookEvent row (processed=false)
   │
   ▼  every 5 min cron
processUnprocessedWebhookEvents()  ── lib/inngest/functions/process-webhook-event.ts:73
```

`WebhookEvent.dedupeKey` (`schema.prisma:650-655` + unique index
`@@unique([subscriptionId, dedupeKey])` at `schema.prisma:672`) gives
at-least-once delivery clean upserts.

---

## 8. Data model

`prisma/schema.prisma` — 45 enums + models across 981 lines. The
load-bearing models:

```
                                ┌─────────────────────────────────────────────┐
                                │  Workspace                                  │
                                │   id, slug, vertical (Vertical enum),       │
                                │   verticalTier (REGULAR|PLUS|MAX), stateCode│
                                │   billingMode, stripe ids                    │
                                └─────────────────────────────────────────────┘
                                          │ 1:N                       │ 1:1
            ┌──────────────────┬──────────┴──────────┬──────────┐    │
            ▼                  ▼                     ▼          ▼    ▼
       Membership         WorkApprovalQueueItem  HandoffLogEntry  WorkspacePreference
       (User × Role)      (kind ∈ WorkApprovalKind,                Subscription
                          status PENDING by default)               OnboardingState

       IntegrationCredential ──< WebhookSubscription ──< WebhookEvent
       (encrypted tokens,        (Gmail users.watch,       (Pub/Sub envelope,
        per-(ws, provider,        Graph subscription,       processed flag,
        accountId))               expiresAt < 7d Gmail)     dedupe + backoff)

       KnowledgeDocument ──< Embedding   (vector(1536))
       (contextKind ∈ 5,     (workspaceId nullable per kind;
        verticalSlug)         RLS enforces the constraint)

       Subscription ──< BillingEvent
       (Stripe shape)        (one row per stripeEventId — idempotency)

       AuditLog                CapabilityProposal
       (append-only)           (state ∈ DRAFT → AWAITING_VOICE_BLOCK →
                                AWAITING_REVIEW → RATIFIED|REJECTED|SUPERSEDED)

       Inquiry, SupportRequest, ComplianceFlag, MagicLinkToken,
       WebAuthnCredential, WorkThresholdConfig, WorkspaceInvoice,
       PreferenceSignal
```

Selected detail:

- **Verticals** — `Vertical` enum, 10 values, `schema.prisma:39-50`.
  Medical practices intentionally excluded; reactivate on first HIPAA
  customer ask.
- **Tier ladder** — `WorkspaceVerticalTier` (REGULAR/PLUS/MAX) at
  `schema.prisma:52-59`, with `SeatBand` (5 self-serve bands +
  Custom OOB) at `schema.prisma:80-91`. Mapping table:
  `lib/pricing/tiers.ts`. Only REGULAR + Custom are surfaced today;
  Plus/Max are schema-only.
- **`WorkApprovalKind`** — 12 enum values
  (`schema.prisma:93-114`) covering compliance flags, draft kinds,
  office-admin categories (5 of them: verification code, password
  reset, trial ending, billing notice, security alert), and three
  chief-of-staff proposal kinds.
- **`SubscriptionStatus`** — mirrors Stripe's taxonomy 1:1
  (`schema.prisma:70-78`); PAUSED intentionally omitted per
  `project_stripe_both_surfaces.md`.
- **`CapabilityProposalState`** — `schema.prisma:140-147` — the
  approval-chain state machine.

### 8.1 Neon pooled + direct URL setup

`schema.prisma:9-13`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        // pooled (PgBouncer transaction mode)
  directUrl = env("DATABASE_URL_DIRECT") // direct — used by migrate
}
```

Standard Neon pattern. Migrations run against the direct URL because
PgBouncer transaction-mode does not support the session-level commands
Prisma migrate needs.

### 8.2 RLS scope

Applied to every workspace-scoped table via the policy installed in
the `20260508000000_phase1_init` migration. Three GUCs
(`lib/db/rls.ts:5-9`): `app.user_id`, `app.workspace_id`,
`app.is_operator`. Operator context bypasses workspace filters; customer
context sees only its own rows + non-CUSTOMER context-kind rows.

---

## 9. Observability

### 9.1 Sentry wiring

Three boot files at the repo root, each guarded on `SENTRY_DSN`:

- `sentry.server.config.ts:14-32` — Node runtime. `tracesSampleRate:
  0.1`, env + release auto-resolved from Vercel envs.
- `sentry.edge.config.ts` — edge runtime.
- `sentry.client.config.ts` — browser.

`instrumentation.ts` loads the right one based on `NEXT_RUNTIME` and
also exports `captureRequestError` for App Router server actions +
route handlers.

**No application code imports `@sentry/nextjs`.** Domain code goes
through `lib/observability` (`lib/observability/index.ts:1-10`).
Provider selection is `env.observabilityProvider()` →
`sentry` or `noop`.

`lib/observability/` exposes:

- `getErrorReporter()` — cached singleton.
- `reportError(err, ctx)` — convenience.
- `reportMessage(msg, ctx)`.
- `getLogger()` — structured JSON logger; cron + webhook paths never
  `console.*` directly.
- `withCronMonitor(opts, fn)` — see §3.1.
- `__setErrorReporterForTests` / `__setLoggerWriterForTests` /
  `__setCronMonitorRunnerForTests` — recorder hooks for suites.

### 9.2 Cron watchdog

`lib/observability/cron-monitor.ts:1-23` — "who watches the watchdog."
The cron functions are the things that surface failures; nothing else
notices when they stop firing.

Implementation:

- `withCronMonitor({ slug, schedule, timezone?, checkinMargin?,
  maxRuntime? }, fn)` (`cron-monitor.ts:177-198`).
- Production runner — Sentry crons (`buildSentryRunner`,
  `cron-monitor.ts:114-162`) — uses `Sentry.captureCheckIn` with
  `monitorSlug = function id` (same name as the Inngest function, so
  the alert page reads identically).
- Noop runner when `SENTRY_DSN` is unset (`cron-monitor.ts:108-112`).
- Defaults: `checkinMargin: 5 minutes`, `maxRuntime: 10 minutes`,
  `timezone: 'UTC'` — all crons fire UTC.

The wrapper order matters and is consistent across all four functions:

```
runWithDisableGate(  ←  outside — paused fn doesn't ping monitor
  withCronMonitor(   ←  middle — pulse around the body
    withInngestErrorReporting(  ←  inside — throws → Sentry + monitor.error
      doWork())))
```

---

## 10. The "built by agents" loop

The fleet builds and improves itself. Three structural pieces:

### 10.1 CapabilityProposal model

`prisma/schema.prisma:468-484`:

```prisma
model CapabilityProposal {
  id              String                  @id @default(uuid()) @db.Uuid
  workspaceId     String?                 @db.Uuid // NULL = platform-level
  notionPageId    String?                 @unique
  targetAgentSlug String?
  proposer        String?
  body            String
  voiceBlock      String?
  voiceBlockHash  String?
  state           CapabilityProposalState @default(DRAFT)
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt
  ...
}
```

The state machine `DRAFT → AWAITING_VOICE_BLOCK → AWAITING_REVIEW →
RATIFIED|REJECTED|SUPERSEDED` mirrors the hierarchical approval chain.
The **voice block** field is mandatory before review — every PENDING
recommendation must lead with a `### Voice — <agent-slug>` block of ≥
2 sentences in the agent's own voice covering (a) what gap this
proposal closes for the agent, (b) what it cost not to have it
(see `b2b-ceo/SKILL.md:262-267`).

### 10.2 capability_inbox + capability_principles

These are markdown surfaces in
`~/.claude/projects/C--flatsbo/memory/agent-state/`:

- `capability_inbox.md` — the queue where the fleet files proposals.
  Referenced from `lib/ops/types.ts:8` and
  `lib/inngest/disable-flag.ts:4`. The in-house disable-flag pattern
  and the `OpsControlPlane` interface are themselves
  capability_inbox proposals (#13 and #12 respectively).
- `capability_principles.md` — running register of EvolveR-style
  outcome principles (`b2b-ceo/SKILL.md:83`,
  `flatsbo-capability-builder/SKILL.md:32`). Each entry has a score
  `s(p)` that the capability-builder updates from ratification deltas
  in `*_recommendations.md` files. "Closes the learning loop — the
  agent compounds across cycles instead of being bounded by one-shot
  quality."

### 10.3 The Dispatch orchestration layer

Routes work to task sessions. In code:

- `lib/integrations/mcp-core/dispatch.ts` — JSON-RPC dispatch over a
  workspace-scoped MCP server's tool registry. Each route handler
  calls `dispatch(jsonRpcBody, { server, tools, namespace })`
  (`lib/integrations/mcp-core/route.ts:64-69`).
- `lib/ops/types.ts` — the `OpsControlPlane` interface (capability-
  inbox proposal #12) is the **first piece** of an ops-side dispatch:
  uniform interface for vendor management surfaces (GitHub, Vercel,
  Anthropic Console, Stripe Console). Today only the GitHub adapter is
  in tree; remaining adapters + the secrets vault + the org-ops-
  management agent are follow-on work (`lib/ops/types.ts:9-11`).

### 10.4 Fleet-produced output landing path

agentplain (Inngest) — output lands in **Postgres rows**:
`WorkApprovalQueueItem`, `HandoffLogEntry`, `AuditLog`, and the
JSONL run log at `agent-state/skill-runs/<yyyymmdd>.jsonl`.

flatsbo (GitHub Actions) — output lands in **git commits**:
`scripts/cron/commit-output.ts` → `commitAndPushCronOutput` →
PR opened (or reused) against `main` from `fleet/auto/<cronId>`.
A human merges. (Source: §3.3 above + the cross-reference in
`C:\flatsbo\lib\github\commit-cron-output.ts:1-40`.)

Both landing paths share one invariant: the fleet **never bypasses
the review gate**. The customer is the broker-owner for runtime
proposals; Conner is the reviewer for fleet-level proposals; outside
counsel ratifies legal proposals via `flatsbo-attorney-firstpass`.

---

## Appendix: the four locked architectural decisions

These are repeated at every senior seat's SKILL.md
(`b2b-ceo/SKILL.md:85-91`) because they constrain every PR:

1. **Subscription product, our API keys.** Cost-plus markup. No
   bring-your-own-keys in V1.
2. **Per-customer Postgres on Neon branching, stateless-pass-through.**
   We store only agent state, audit log, encrypted OAuth tokens,
   workspace config, durable handles, our own analytics + billing.
3. **Performance-first design.** Worker-memory caching only. Webhook-
   driven invalidation where supported, polling otherwise. No
   persisted caches in our DB.
4. **Customer-owned liability.** Customer is the licensed entity
   (broker for realty, agency for insurance, contractor for trades);
   we are the software vendor. The contract carries the liability
   split.

Any proposal to relax any of them gets routed to Conner per the
hierarchical approval chain.
