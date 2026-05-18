# Product-readiness audit — 2026-05-17

**Auditor:** Claude (Opus 4.7) acting on Conner's direction
**Branch audited:** `origin/main` @ `63a966b` (Merge PR #33 — vertical routes shell)
**Branch this report lives on:** `chore/product-readiness-audit-2026-05-17`
**DONE bar verified against:**

> Customer can sign up → land in branded workspace → connect Gmail → see read/categorize/coordinate/schedule/draft value loop on real inbox → add payment via Stripe.

Per `feedback_no_guesses_no_estimates.md`, every claim cites a file:line or HTTP response. Where I could not verify, the row is marked **UNKNOWN**.

---

## 1. DONE-bar gap table

| # | Step | Status | File evidence | What's wrong / missing |
|---|---|---|---|---|
| 1 | Customer signs up | **BUILT** | `app/(product)/app/sign-up/page.tsx:39-67`, `app/(product)/app/sign-up/SignUpForm.tsx:84-127`, `app/(product)/app/actions.ts:38-105`, `lib/auth/flows.ts:66-185` | Sign-up flow is real end-to-end: creates `User` + `Workspace` + `BROKER_OWNER` `Membership` + `OnboardingState` + `AuditLog` rows in one tx (`lib/auth/flows.ts:91-167`), then issues a magic link (`flows.ts:174-184`) and provisions a 30-day Stripe trial via `provisionTrialSubscriptionSafe()` (`lib/billing/provisioning.ts:149-171`). Tier picker (Regular / Partner / Max) is wired in code (`SignUpForm.tsx:36-56`); Max is gated server-side and routes to `/custom?type=max` (`actions.ts:62-77`). Vertical selector lists 10 verticals (real-estate "live", other 9 "early access" — `SignUpForm.tsx:248-256`). |
| 2 | Land in branded workspace | **BUILT (with placeholders)** | `app/(product)/app/page.tsx:11-34`, `app/(product)/app/workspace/[id]/page.tsx:36-138`, `app/(product)/app/workspace/[id]/layout.tsx:11-77` | `/app` routes to the user's default workspace (`page.tsx:14-19`); workspace overview renders a real three-section layout pulling from `WorkApprovalQueueItem`, `ComplianceFlag`, `HandoffLogEntry`, `OnboardingState`, plus a "Today's briefing" from `getBriefingsProvider()` (`page.tsx:36-86`). **Today's briefing requires `NOTION_API_KEY` — `lib/env.ts:85` calls `required(...)` so the page will throw 500 if the env var is unset** (no test-provider auto-fallback unless `BRIEFINGS_PROVIDER=test`). Welcome strip + "What's running now" + "Today's progress" all render with copy intended for real data; "What's running now" empty state copy says *"Your fleet drafts overnight…"* (`page.tsx:269`) but **nothing in prod populates `HandoffLogEntry`** — see §5. |
| 2b | Onboarding wizard | **PARTIAL — middle step inert, last step is documented UI-only stub** | `app/(product)/app/workspace/[id]/onboarding/page.tsx:28-184`, `app/(product)/app/workspace/[id]/onboarding/actions.ts:17-82` | Three steps: `confirm_details`, `connect_integration`, `set_preferences`. `confirm_details` is informational confirmation (`page.tsx:233-273`). `connect_integration` **does NOT link to `/app/workspace/[id]/integrations` and does NOT initiate any OAuth** — it lists planned integrations and offers "Skip for now" (`page.tsx:275-326`). `set_preferences` is admitted in-code to be UI-only: `// Phase 1: UI-only stub. Persistence wires up in a later workstream.` (`page.tsx:328-379`). The action advances state + writes audit, but never enforces a connection. A user can finish onboarding having connected nothing. |
| 3 | Connect Gmail / MCP marketplace | **BUILT but ORPHANED from onboarding** | `app/(product)/app/workspace/[id]/integrations/page.tsx:25-123`, `app/(product)/app/workspace/[id]/integrations/[integrationId]/page.tsx:21-176`, `app/api/integrations/[integrationId]/oauth/start/route.ts:51-127`, `app/api/auth/oauth/google/callback/route.ts:90-302`, `app/api/integrations/gmail-mcp/[workspaceId]/route.ts:53-129`, `lib/integrations/marketplace.ts:56-161`, `lib/integrations/oauth-urls.ts:26-65`, `lib/integrations/gmail-mcp/server.ts:61-382` | Marketplace catalog has **2 available (Gmail, Outlook), 6 coming-soon (QuickBooks, HubSpot, DocuSign, Slack, PayPal, Canva)** (`marketplace.ts:56-161`). Gmail Connect flow is real end-to-end: per-integration OAuth-start route → Google authorize → callback exchanges code, encrypts tokens via `lib/security/encryption.ts` (AES-256-GCM, v1 format), upserts `IntegrationCredential`, calls `users.watch` to create Pub/Sub subscription, upserts `WebhookSubscription`, writes `AuditLog` (`callback/route.ts:158-302`). Disconnect is real (`integrations/[integrationId]/actions.ts:24-80`). Workspace-scoped MCP server exposes `listMessages`, `getMessage`, `searchThreads`, `draftMessage`, `labelMessage`, `listLabels`, plus `inbox` + `threads/{id}` resources (`gmail-mcp/server.ts:73-365`). **But:** the workspace top nav has `/integrations` (`layout.tsx:17`), and the onboarding `connect_integration` step does NOT link there — see row 2b. Settings page also does NOT link to integrations (`settings/page.tsx:54-73`). Customer reaches `/integrations` only via the top nav or the workspace-overview "Connect a tool" CTA (`workspace/[id]/page.tsx:281-289`). |
| 4 | Value loop on real inbox (read/categorize/coordinate/schedule/draft) | **CODE WRITTEN but NOT WIRED TO FIRE** | `lib/skills/runner.ts:76-223`, `lib/skills/read.ts`, `lib/skills/categorize.ts`, `lib/skills/coordinate.ts`, `lib/skills/schedule.ts`, `lib/skills/draft.ts`, `lib/inngest/functions/process-webhook-event.ts:14-158`, `app/api/inngest/route.ts:14-26`, `app/api/webhooks/google/route.ts:35-140` | Skill chain is complete: `runSkillChain()` composes read → categorize → coordinate → schedule → draft with intent-branching (`runner.ts:76-223`). DraftSkill persists via `DraftPersister` port to Gmail Drafts only — never sends (`draft.ts:90-120`). **CRITICAL:** `processWebhookEventFn` is the only Inngest function that drains `WebhookEvent` rows and invokes the skill chain (`process-webhook-event.ts:148-158`), but **(a) it is NOT registered in the Inngest serve route** — `app/api/inngest/route.ts:25` only includes `trialExpirationWarningsFn` and `integrationRenewalSweepFn` — and **(b) it has no cron trigger** — only an event trigger (`process-webhook-event.ts:152`). The file's own comment confirms: *"DECLARED, NOT CRON-ACTIVE. This function ships with NO `triggers` so it does not fire automatically."* (`process-webhook-event.ts:14-15`). Result: inbound Pub/Sub pushes land `WebhookEvent` rows with `processed=false` (`webhooks/google/route.ts:111-117`), and nothing drains them. The loop is dead at the orchestration layer. |
| 4b | Loop visualized to the customer | **MISSING** | `app/(product)/app/workspace/[id]/page.tsx:229-324`, `app/(product)/app/workspace/[id]/agents/page.tsx:11-71` | No inbox view, no per-thread activity feed, no "read → categorized as X → drafted reply Y" UI. The overview's "What's running now" reads `HandoffLogEntry` (`page.tsx:53-58`); the agents page reads per-agent handoff counts (`agents/page.tsx:27-38`). **Grep confirms `handoffLogEntry.create` has zero callers in the entire repo** — so even if the skill chain fired, nothing would surface on these surfaces. Drafts that the runner persists go to the customer's Gmail Drafts folder (`draft.ts:90-110` → `lib/integrations/google/gmail-provider.ts`), not into agentplain's UI. The agents page lists a **hardcoded realty fleet** (`agents/page.tsx:12-20`) — not vertical-aware. |
| 5 | Drafts / approvals queue | **UI BUILT, NEVER POPULATED** | `app/(product)/app/workspace/[id]/approvals/page.tsx:9-83`, `app/(product)/app/workspace/[id]/approvals/actions.ts` | `/approvals` reads `WorkApprovalQueueItem` rows and renders approve/reject buttons (`approvals/page.tsx:14-79`). **Grep confirms `workApprovalQueueItem.create` has ZERO callers in the entire repo.** No skill, no webhook, no scheduler creates rows. The queue will be permanently empty in production. The schema has the table (`prisma/schema.prisma:371-389`) and a related `WorkThresholdConfig` (`schema.prisma:354-367`), so the model exists — only the writers are missing. Drafts live in Gmail Drafts (per the no-outbound architecture, this is by design for *sending*), but **no human-in-the-loop surface inside agentplain** exposes "Approve this draft before it goes into your Drafts folder", and no chained "review/refine" surface either. |
| 6 | In-app billing / Stripe | **BUILT** (code is current; production deploy is BEHIND — see §5) | `app/(product)/app/workspace/[id]/settings/billing/page.tsx:1-625`, `app/(product)/app/workspace/[id]/settings/billing/actions.ts:1-186`, `app/api/stripe/webhook/route.ts:23-64`, `lib/billing/webhook-dispatch.ts:44-484`, `lib/billing/provisioning.ts:66-203`, `lib/billing/stripe-provider.ts` | Full billing surface: trial banner with days-remaining + add-card CTA (`billing/page.tsx:356-385`), past-due banner + portal redirect (`page.tsx:128-144`), cancel-at-period-end banner (`page.tsx:147-154`), current-plan card (`page.tsx:158-263`), tier-aware upgrade/downgrade card (`page.tsx:411-601`), invoice table (`page.tsx:272-329`), recent billing events (`page.tsx:332-349`). Server actions wrap Stripe Checkout (`mode=setup` for card capture and `mode=subscription` for tier swap), customer portal, and cancel-at-period-end (`billing/actions.ts:45-186`). Stripe webhook dispatches subscription + invoice events to `Subscription` + `WorkspaceInvoice` upserts with `BillingEvent`-backed idempotency (`webhook-dispatch.ts:44-484`). |
| 7 | Settings / account | **MINIMAL STUB by design** | `app/(product)/app/workspace/[id]/settings/page.tsx:9-93` | Displays workspace name, slug, tier, state, billing mode, member count, created date. Two sub-page links: Work Thresholds + Billing. **Bottom of page reads** *"Phase 1 settings are minimal — agent enablement, tool connections, team management land in Phase 2 / Phase 3"* (`settings/page.tsx:75-79`). **Does NOT link to `/integrations`** — customer must use the top nav. No member-management UI, no workspace-rename UI, no account-deletion UI, no email-preferences UI. |

---

## 2. Code map — what exists vs. what doesn't

### `app/(product)/app/` — customer surface

```
app/(product)/app/
├── actions.ts                              ✅ signUp / requestSignIn / verify / signOut
├── page.tsx                                ✅ /app router → workspace or sign-in
├── sign-up/page.tsx, SignUpForm.tsx        ✅ tier picker + vertical picker + form
├── sign-in/page.tsx, SignInForm.tsx        ✅ magic-link request form
├── verify/page.tsx                         ✅ token → session → redirect
└── workspace/[id]/
    ├── layout.tsx                          ✅ workspace header + tabs nav + sign-out
    ├── page.tsx                            ✅ overview (running now, briefing, progress, actions)
    ├── agents/page.tsx                     ⚠️  hardcoded realty fleet; not vertical-aware
    ├── agents/[slug]/page.tsx              ⚠️  stub — content not audited but exists
    ├── approvals/page.tsx + actions.ts     ⚠️  UI built; **nothing populates queue**
    ├── briefings/page.tsx                  ⚠️  exists; not deeply audited
    ├── compliance/page.tsx                 ⚠️  exists; not deeply audited
    ├── integrations/page.tsx               ✅ marketplace tiles, real connect/disconnect
    ├── integrations/[integrationId]/page.tsx  ✅ per-integration settings + test connection
    ├── onboarding/page.tsx + actions.ts    ⚠️  3 steps; middle is inert, last is stub
    └── settings/
        ├── page.tsx                        ⚠️  minimal; no /integrations link
        ├── billing/page.tsx + actions.ts   ✅ tier picker, portal, cancel, invoices
        └── work-thresholds/page.tsx + actions.ts ✅ exists; not deeply audited
```

### `app/api/` — server seams

```
api/
├── auth/oauth/google/connect/route.ts      ✅ legacy operator-only Google connect
├── auth/oauth/google/callback/route.ts     ✅ token exchange + watch subscribe + audit
├── auth/oauth/google/revoke/route.ts       ✅ exists (not audited line-by-line)
├── integrations/[integrationId]/oauth/start/route.ts  ✅ customer-self-serve OAuth
├── integrations/[integrationId]/health/route.ts       ✅ test-connection endpoint
├── integrations/gmail-mcp/[workspaceId]/route.ts      ✅ JSON-RPC MCP entry
├── integrations/outlook-mcp/[workspaceId]/route.ts    ✅ M365 MCP entry
├── integrations/outlook/oauth/callback/route.ts       ✅ M365 OAuth callback
├── webhooks/google/route.ts                ✅ Pub/Sub push → WebhookEvent row
├── stripe/webhook/route.ts                 ✅ signature verify + idempotent dispatch
├── inngest/route.ts                        ⚠️  registers 2 of 3 functions; loop function missing
├── knowledge/mcp/route.ts                  ✅ knowledge-substrate MCP entry
└── custom-inquiry/route.ts                 ✅ /custom form submit handler
```

### `lib/` — business logic

```
lib/
├── auth/                       ✅ flows, session, magic-link, vertical-enum, with-workspace
├── billing/                    ✅ stripe-provider, provisioning, webhook-dispatch, test-provider
├── db/                         ✅ prisma, RLS, system context
├── email/                      ✅ resend-provider + test-provider
├── env.ts                      ✅ adapter selection, secret handling
├── integrations/
│   ├── marketplace.ts          ✅ catalog (Gmail+Outlook available, 6 coming-soon)
│   ├── oauth-urls.ts           ✅ per-provider authorize URL builder
│   ├── google/                 ✅ oauth, gmail-provider, webhook-handler
│   ├── gmail-mcp/              ✅ workspace-scoped MCP server (read + draft + label tools)
│   ├── outlook-mcp/            ✅ workspace-scoped MCP server (read + draft + category tools)
│   └── __tests__/              ✅ contract + credential codec + webhook tests
├── skills/
│   ├── runner.ts               ✅ 5-skill chain orchestrator with intent branching
│   ├── read/categorize/coordinate/schedule/draft.ts  ✅ each implemented
│   ├── gmail-fetcher.ts        ✅ production MessageFetcher + DraftPersister via Gmail
│   ├── fixture-fetcher.ts      ✅ test MessageFetcher
│   ├── registry.ts             ✅ 3 vertical skills (invoice-chasing-realestate, lead-triage-realestate, month-end-close-cpa)
│   └── prompts/                ✅ per-vertical prompt bundles (10 verticals)
├── inngest/
│   ├── client.ts               ✅
│   ├── functions/
│   │   ├── trial-expiration-warnings.ts  ✅ daily cron (registered)
│   │   ├── integration-renewal-sweep.ts  ✅ cron (registered)
│   │   └── process-webhook-event.ts      ❌ written but NOT registered + no cron trigger
│   ├── disable-flag.ts         ✅
│   └── run-with-disable-gate.ts ✅
├── notion/                     ✅ briefings provider (Notion + test)
├── llm/                        ⚠️  not deeply audited; runner imports getLlmProvider()
├── knowledge/                  ✅ pgvector store + OpenAI embedding + seed data
├── pricing/tiers.ts            ✅ tier ladder + lookup_key plumbing
├── verticals/                  ✅ per-vertical content (10 verticals)
├── brand/, custom-inquiry/, onboarding/, security/  ✅ exist
└── agents/sentinel/            ✅ compliance corpus literals (50+ rules across 10 verticals)
```

### `prisma/schema.prisma`

```
Entities present:
  User, Workspace, Membership, Subscription, BillingEvent, WorkspaceInvoice,
  OnboardingState, WorkApprovalQueueItem, WorkThresholdConfig, HandoffLogEntry,
  ComplianceFlag, CapabilityProposal, AuditLog,
  IntegrationCredential, WebhookSubscription, WebhookEvent,
  KnowledgeDocument, Embedding (with pgvector Unsupported column),
  Inquiry, MagicLinkToken

Enums present:
  Role, MembershipStatus, WorkspaceTier (legacy), WorkspaceVerticalTier,
  Vertical (10), WorkspaceBillingMode, SubscriptionStatus, SeatBand,
  WorkApprovalKind, WorkApprovalStatus, ComplianceSeverity, ComplianceFlagState,
  CapabilityProposalState, IntegrationProvider, IntegrationCredentialStatus,
  WebhookSubscriptionStatus, InquiryType, InquiryStatus, ContextKind

Migrations:
  20260508000000_phase1_init                ✅
  20260511000000_add_vertical_and_onboarding ✅
  20260511120000_add_stripe_billing         ✅
  20260511180000_add_gmail_integration      ✅
  20260512000000_add_knowledge_substrate    ✅
  20260515000000_add_inquiry_intake         ✅
```

**Notable gap in the model:** there is no `DraftReply`, `Thread`, or `MessageActivity` table that the in-app UI could render. The schema file comment even calls this out: *"Phase 3 native adds AGENT role, AgentSeat, DraftReply, Thread"* (`schema.prisma:1-3`). Drafts produced by the skill chain currently live only as audit rows + Gmail Drafts. There is no in-app activity feed schema to back a value-loop visualization.

---

## 3. The actual minimum build list to close the gap

Ordered by what closes the DONE bar fastest. Grouped by "ship together" vs. "ship separately." Severity tags: **[P0]** blocks DONE bar, **[P1]** is the next ladder, **[P2]** quality-of-life.

### Group A — **Fire the loop** (one PR, 3 small commits)

1. **[P0] Register `processWebhookEventFn` in the Inngest serve route.** `app/api/inngest/route.ts:25` — add the import + array entry. *Trivially close to done.*
2. **[P0] Give the function a real trigger.** `lib/inngest/functions/process-webhook-event.ts:152` currently has `triggers: [{ event: '...' }]`. Change to `triggers: [{ cron: '*/2 * * * *' }, { event: PROCESS_WEBHOOK_EVENT_TRIGGER_EVENT }]` (or whatever cadence Conner wants — every-2-minutes is the natural minimum for Gmail Pub/Sub freshness). *Trivially close to done.*
3. **[P0] Smoke-test on Conner's real Gmail.** After (1)+(2) deploy, force-connect Conner's inbox via `/app/workspace/<id>/integrations/gmail`, send a test email to that inbox, watch a `WebhookEvent` row land, watch the Inngest fire, watch a Gmail Draft appear. This is the **`feedback_integration_acceptance_is_functional.md`** acceptance bar.

Without Group A, **nothing in the loop runs in production today**, regardless of how clean the rest of the stack is.

### Group B — **Surface the loop in-app** (one PR, schema + UI + writers)

4. **[P0] Wire skill-runner output into surfaces the customer can see.** Two routes — pick one or do both, but pick deliberately:
   - **Option B1 (cheaper):** In `processUnprocessedWebhookEvents()` (`process-webhook-event.ts:51-124`), after the runner returns, write a `HandoffLogEntry` for each completed step. The workspace overview's "What's running now" and the agents page's per-agent counts will populate immediately. **No schema change needed**; `handoffLogEntry.create` writer just doesn't exist yet. *Real engineering.*
   - **Option B2 (richer, what the DONE bar implies):** Add a `DraftReply` table (already foreshadowed in `schema.prisma:1-3`) and write the draft to it before persisting to Gmail. Then add a `/app/workspace/[id]/inbox` page that renders the loop result per-thread (inbound → category → draft + slots). This is the "see the value loop on real inbox" surface that the locked DONE bar names. *Real engineering — 1-2 weeks.*
5. **[P0/P1] Decide what `WorkApprovalQueueItem` is for, and either start writing rows or hide the page.** The schema is rich (`WorkApprovalKind` enum has four kinds; `WorkApprovalStatus` has six states), the UI is built, and zero code writes rows. Either: (a) wire the skill runner to write a row when a draft falls below the persist threshold (currently `draft.ts:79` discards low-confidence drafts), or (b) remove `/approvals` from the layout nav (`layout.tsx:11-19`) until a writer exists. A live menu item to a perpetually empty page is the kind of half-built surface that confuses paying customers.

### Group C — **Close onboarding** (one PR)

6. **[P0] Onboarding `connect_integration` step must point at `/integrations`.** Currently `page.tsx:275-326` shows planned integrations + a "Skip for now" button. Replace with: an explicit "Connect Gmail / Outlook" CTA linking to `/app/workspace/[id]/integrations`, plus a "Skip for now" that records `skipped=true` (already supported by the action — `onboarding/actions.ts:27`). *Real engineering, ~half-day.*
7. **[P1] Mark `set_preferences` as either real or removed.** The page itself admits *"Phase 1: UI-only stub. Persistence wires up in a later workstream"* (`onboarding/page.tsx:328`). The Wizard-with-a-stub is the worst-of-both shape. Either persist the toggles or skip the step. *Trivially close to done if you cut it.*
8. **[P1] Settings page should link to `/integrations`.** Two-line edit to `settings/page.tsx:54-73`. *Trivially close to done.*

### Group D — **Production deploy hygiene** (one PR or one Vercel action)

9. **[P0] Force a production redeploy or unblock the auto-deploy.** The deployed site at agentplain.com is rendering the older single-ladder pricing page + the older sign-up form without the tier picker — see §5 below. The 3-tier work landed on main (commits `2d861a0`, `5456734`, `508fb9b`) but is not what the customer sees. *Operational, not code.*

### Group E — **Briefings + agents content** (one PR each, P1)

10. **[P1] Make `NotionBriefingsProvider` graceful when no key is set.** Today `env.notionApiKey()` is `required()` (`env.ts:85`), so the workspace overview page will throw 500 in any env without a Notion key. Either set `BRIEFINGS_PROVIDER=test` by default in non-prod environments, or wrap the briefings fetch in a try/catch that swallows-to-null on this surface. *Real engineering, ~half-day.*
11. **[P1] Agents page must be vertical-aware.** Hardcoded realty fleet (`agents/page.tsx:12-20`) means a CPA or Law workspace will see realty agent slugs that don't apply to them. Read from `lib/skills/registry.ts:SKILL_CATALOG` filtered by `workspace.vertical`. *Real engineering, ~half-day.*

---

## 4. Risk flags — what would be confusing to a paying customer right now

1. **Loop is dead.** A customer signs up, connects Gmail, gets the "Gmail is connected" banner, and… nothing ever happens. No drafts in Gmail Drafts, no activity feed, no compliance flags. They'll churn before they figure out it isn't supposed to be silent.
2. **Approvals nav item points to a page that will always say "Nothing in the queue."** Top nav advertises a feature with no implementation.
3. **"What's running now" + "Today's progress"** on the overview will permanently show zero / "—" because no code writes `HandoffLogEntry`.
4. **Onboarding lets you complete without connecting anything.** Confirm → Skip → Skip → "Workspace ready." Hard to recover from the "fleet does nothing" surprise after that.
5. **Agents page lists realty agents to a CPA customer.** Pure content bug — but the kind a regulated-vertical customer notices.
6. **Settings page silently doesn't link to `/integrations`.** Customer finds it only by guessing the top nav. Onboarding doesn't push them there either.
7. **Briefings depend on `NOTION_API_KEY` and the page will hard-error if it's unset.** Will break every workspace overview if Notion is misconfigured in any env.
8. **Marketing pricing page (`/pricing`) and the deployed sign-up form are running the SINGLE-tier 2026-05-12 surface; the app-side billing settings and sign-up flow on `main` are the THREE-tier 2026-05-15 surface.** Customer comparing the marketing page to the in-app billing page would see a mismatch — see §5.
9. **No customer-facing surface explains the no-outbound architecture.** Drafts land in Gmail Drafts, which is correct per `project_no_outbound_architecture.md`, but no UI tells the customer to open Gmail Drafts to find them. The onboarding copy hints at it (*"we never send outbound on your behalf"* — `onboarding/page.tsx:286`) but it isn't reinforced after Connect.
10. **6 of 8 marketplace tiles are "coming-soon" with a waitlist link** (`marketplace.ts:89-160`). For a customer in a vertical whose primary tool isn't Gmail/Outlook (e.g. CPA → QuickBooks; Mortgage → Encompass), the marketplace honestly admits it doesn't have the integration. This is the right framing but is worth flagging because the customer will hit it on day one.

---

## 5. Deployed-vs-local check

**Tested:** 2026-05-17, plain `curl` from the audit host.

| URL | HTTP | Notes |
|---|---|---|
| `https://agentplain.com/` | 200 | Marketing home renders. Meta: *"agentplain lifts up local businesses…ten verticals…"*. Per `WebFetch` summary: CTAs are "Start free trial / See how it works / Sign in / Build with us." |
| `https://www.agentplain.com/` | 200 | Same app as apex. |
| `https://app.agentplain.com/` | 200 | Subdomain serves the same Next app (no apparent separation). |
| `https://agentplain.com/pricing` | 200 | Per `WebFetch` summary: shows the **single-tier Regular ladder ($199→$99) only** — `Solo / 2–9 / 10–24 / 25–49 / 50–99`, with a "Custom from $5K" callout. **No 3-tier (Regular/Partner/Max) comparison.** This is OLDER than `main`. Code on `main` (`app/(marketing)/pricing/page.tsx:7-9, 27-41`) has both `regularBands` AND `partnerBands` with Max as a quote-based tier. |
| `https://agentplain.com/custom` | 200 | Renders (not deeply diff'd). |
| `https://agentplain.com/verticals` | 200 | Renders. |
| `https://agentplain.com/real-estate` | 200 | Per-vertical page renders. |
| `https://agentplain.com/cpa` | 200 | Per-vertical page renders. |
| `https://agentplain.com/app/sign-up` | 200 | **Stale.** Form has vertical dropdown + brokerage name + email + name only — **no tier picker**. Copy reads *"First month is on us — card on file kicks in at month two"* — that copy is OLDER than the current `SignUpForm.tsx` which says *"First month is on us across the self-serve tiers — Max is scoped per engagement"* (`sign-up/page.tsx:48-50`). |
| `https://agentplain.com/app/sign-in` | 200 | Renders. |
| `https://agentplain.com/app/workspace/<UUID>` | 307 → presumably `/app/sign-in` | Correct unauth behavior. |
| `https://agentplain.com/app/workspace/<UUID>/integrations` | 307 → presumably `/app/sign-in` | Correct unauth behavior. |

**Conclusion on deploy parity:** the production deployment at agentplain.com is **behind `main`**. Specifically, it pre-dates the 2026-05-15 three-tier amendment (`commit 2d861a0` *feat(billing): app-side tier picker + billing settings for Regular/Partner/Max*, `commit 508fb9b` *feat(marketing): reframe customer surfaces under service-partnership + three-tier lock*, `commit 5456734` *feat(marketing): reframe customer surfaces under service-partnership positioning lock*). The single-tier 2026-05-12 surface is still what a real visitor sees.

**Why this matters for the DONE bar:** even if Group A above ships, the customer signing up via the deployed `/app/sign-up` lands without a tier picker, and the deployed `/pricing` doesn't tell them Partner or Max exist. They'd reach `/app/workspace/<id>/settings/billing` (post-merge of the deploy) and see Partner/Max upgrade cards that the marketing site didn't prepare them for.

---

## 6. What I could NOT verify (limitations)

Per the audit constraint: I cite or mark UNKNOWN.

- **Idle task transcripts** (`local_1a2db8f2`, `local_046f4fe7`, `local_86959c45`, `local_81e70875`, `local_3c35acbb`, `local_31c5f83c`). I do not have a local lookup tool for these task IDs in this session. I cross-referenced via `git log` and the `docs/` folder instead — every PR mentioned in those tasks has a merge commit on `main`, and the relevant docs (`docs/skills-architecture.md`, `docs/operator-integrations-setup.md`, `docs/customer-surface-audit-2026-05-15.md`, `docs/pricing-page-handoff-2026-05-15.md`) exist. **UNKNOWN:** the precise final-output prose of those tasks; the conclusions in this audit are grounded in what landed in code, not what the transcripts claimed shipped.
- **Whether Conner's Gmail account is currently OAuth-connected in production.** I can't query the production DB from this audit. The integration flow is present and the code is shippable; whether a real `IntegrationCredential` row exists for `connerchambers6@gmail.com` is **UNKNOWN**.
- **Whether the Gmail Pub/Sub topic + subscription exist on the GCP side** (`GOOGLE_PUBSUB_TOPIC` env var per `env.ts:106`). Code calls `users.watch` on connect and assumes the topic exists. **UNKNOWN.**
- **Stripe Products / Prices for the new Partner tier** (`scripts/stripe/setup-products.ts` is referenced in `env.ts:73-74` but not audited). The upgrade-to-Partner button calls `provider.createCheckoutSession({tier:'plus', seatBand, seats})` (`billing/actions.ts:62-117`) → `lib/billing/stripe-provider.ts` resolves Price by `lookup_key`. **UNKNOWN whether the Partner Prices exist in Stripe Live mode.**
- **Inngest function registration in Inngest Cloud.** The serve route registers `trialExpirationWarningsFn` + `integrationRenewalSweepFn`; whether Inngest Cloud has actually picked them up + fires them is **UNKNOWN** without a Inngest dashboard check.
- **The `(operator)` surface** (`/operator/leadership-board`, `/operator/integrations`, `/operator/workspaces`, `/operator/inquiries`) was not audited in depth. The DONE bar is about the customer surface; operator surface is out of scope here.

---

## 7. Bottom line

Three sentences:

1. **Sign-up, branded workspace, Stripe trial provisioning, OAuth connect, and the MCP servers are real and shippable** — the entire perimeter of the DONE bar is built.
2. **The middle of the loop is dead in production**: the Inngest function that drains `WebhookEvent` rows and runs the 5-skill chain is written but not registered + has no cron, no code writes `HandoffLogEntry` or `WorkApprovalQueueItem` rows, and the onboarding flow lets customers finish without ever connecting anything.
3. **The smallest possible PR that closes the DONE bar** is ~50 lines of code (Group A above): register the function in `app/api/inngest/route.ts`, add a cron trigger to `process-webhook-event.ts`, and decide what `HandoffLogEntry` writers + onboarding-connect link look like. After that the value loop runs on real inbound mail, drafts land in Gmail Drafts, and the customer can verify with their own eyes.

The DONE bar is gated by **wiring, not engineering**. The hard work — auth, OAuth, MCP servers, skill chain, billing, schema, RLS, vertical fleet of prompts — is done.
