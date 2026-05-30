# Fleet autonomy + customer use audit — brutal honesty pass

**Date:** 2026-05-28 (audit written 2026-05-29)
**Branch:** `audit/fleet-autonomy-2026-05-28`
**Anchor commit:** `24f578c` (origin/main HEAD; PR #119 robot-dog persona)
**Scope:** Read-only. No code/schema changes in this PR.

The brief from Conner verbatim:

> "We need to get very tight on what we offer. Let's avoid computer use for now. The chats and ability for clients to customize is very important though. I think requiring credit card info for the free trial is important too though. What I need from you is to look very critically at how people will actually use the service and if we are delivering those actual uses mcps and most importantly THE AUTONOMY OF THE FLEET."

This audit asks one question six ways. No charitable framing. Every claim is file-cited.

---

## 1. TL;DR

**The fleet is partially autonomous and the autonomy is concentrated in five horizontal skills.** On a customer's connected inbox + calendar, five general-purpose skills fire on cron with no human intervention: `office-admin` (every 5 min), `inbox-triage-general` (every 5 min), `chief-of-staff-scheduler` (every 15 min), `follow-up-chaser-general` (hourly), `process-doc-drafter-general` (weekly Monday). Plus `support-handler` fires reactively when the customer hits `/help` or types REGISTER-class text into `/talk`. That's six skills producing real `WorkApprovalQueueItem` rows for any workspace with a Gmail or M365 credential. That's not theater — it is the strongest thing in the codebase.

**The eleven vertical-specific catalog skills do not fire at all.** `invoice-chasing-realestate`, `lead-triage-realestate`, `month-end-close-cpa`, `law-intake-conflict-screen`, `ria-client-update-draft`, `insurance-coi-request`, `mortgage-document-chase`, `home-services-estimate-followup`, `recruiting-candidate-status-update`, `property-management-rent-collection-chase`, `title-escrow-closing-doc-chase` — eleven directories under `lib/skills/`, eleven `runSkill` entrypoints, zero production callers. A grep for each `runSkill` export turns up only the skill's own README and `__tests__` siblings. A real-estate customer and an insurance customer get the same fleet today. The vertical differentiation lives in marketing copy and the static `agentRoster` content, not in runtime behavior.

**The substrate is real; the fleet on top of it is not breadth-complete.** Nine real workspace-scoped MCP servers exist with working OAuth, encrypted token storage, renewal cron, RLS, and webhook intake: Gmail, Outlook, Teams, OneDrive, Excel, Google Drive, Slack, QuickBooks, DocuSign — plus calendar substrate for Google + M365 (`lib/integrations/google-calendar-mcp`, `outlook-calendar-mcp`). The MCP-first architecture rule is being followed faithfully. The most embarrassing gap: a finished QuickBooks MCP at `lib/integrations/quickbooks-mcp/server.ts` (374 LOC, real API) sits unused while two finance skills carry `stubbed-json` flags in the registry. That's an afternoon of wiring blocking an honest finance discipline claim.

**Customer customization works on two axes and is theatrical on three.** The vertical the customer picks at signup drives the prompt bundle (`lib/skills/runner.ts:112` → `getPromptBundleByEnum`) and the in-product roster (`agents/page.tsx:60-65`). The onboarding preferences block (tone + categorization notes + calendar window + learned-draft notes) is read on every cron fire and inlined into the cached system prompt via `renderPreferencesBlock` (`lib/skills/runner.ts:119-126`). That's two working customization knobs. The other three are write-only or stub: (1) the memory page (`/talk/memory`) is fully editable but invisible to every skill in `lib/skills/*` — no skill imports `WorkspaceMemoryEntry`; (2) the work-thresholds page persists severity gates that no code reads — every draft lands `PENDING` regardless (`prisma-approval-sink.ts:115`); (3) the eight-discipline toggle only gates three Inngest sweeps + the inbox-triage augmentation, leaving the largest runtime path (webhook → `runSkillChain`) ungated. There is no skill marketplace, no per-skill config, no BYO MCP, no signature/cc/aggressiveness control.

**Credit-card-at-trial does not exist.** Signup creates a Stripe customer and a `trialing` subscription with `trial_period_days: 30` and `default_payment_method: null` (`lib/billing/provisioning.ts:60-80`). No payment method is captured. The sign-up form explicitly says "First month is on us — no card required to start" (`SignUpForm.tsx:184`). The trial-warning cron already sends an email containing the phrase "your card on file will be charged" (`trial-expiration-warnings.ts:239`) — a statement that is **false today for every customer who signs up**. At day 31 Stripe pauses billing collection and emits a `paused` status that the webhook dispatcher cannot handle (the enum doesn't include it; the upsert throws; Stripe retries for 72h, all fail; the customer keeps using the fleet for free indefinitely). Conner's instinct is correct.

**`/talk` is broken in prod and the fix is unmerged.** Conner's overnight PR (`feat/overnight-chat-fleet-2026-05-28`, commit `940d0c8`) diagnoses + fixes a `MissingKeyError` on every first `/talk` message because `ENCRYPTION_KEY` is missing in prod Vercel env. Even if that were set, `ANTHROPIC_API_KEY` is also missing in prod — the dispatcher silently falls back to `TestLlmProvider` (`lib/llm/index.ts:60-68`). On main today, `/talk` reaches the dispatcher and dies on first encrypt. The INSTRUCT/PREFERENCE routing the brief assumes is live ships in that same unmerged PR; on main, only ANSWER/REGISTER/DECLINE_HONESTLY paths exist. PR #120 also admits in its own commit body that even after merge, no skill in `lib/skills/*` calls `readFeedbackRules` yet — the PREFERENCE path will be write-only on the fleet side until follow-up wiring lands.

**Honesty bar — one architectural claim is materially overstated.** The homepage line "Every draft — a buyer reply, an admin acknowledgement, a scheduling proposal — lands in your approvals queue as a PENDING row" (`app/(marketing)/page.tsx:283-289`) is false for the eleven vertical drafting skills. Those skills persist drafts via `DraftPersister` into Gmail's drafts folder (`lib/skills/draft.ts:102-109`), not into `WorkApprovalQueueItem`. A real-estate broker reading the homepage will reasonably expect to manage their fleet's drafts inside the agentplain workspace; what they will actually get for vertical-specific work is a pile of items in their Gmail Drafts label. Plus: the pricing surface renders three tiers (Regular / Partner / Max) across `/`, `/pricing`, `/verticals`, and per-vertical pages, in direct violation of the locked 2026-05-12 memory rule that says Plus/Max stay schema-only and the only customer-facing surfaces are Regular + Custom. The code comments cite a "2026-05-15 supersede" that has no corresponding memory file.

**One paragraph verdict.** Service-partner pitch + vertical-aware fleet positioning is bigger than the working code. A customer who connects Gmail and lives in their `/approvals` queue gets value — high-quality first-draft generation from five horizontal skills, real autonomous cadence, real learning loop on email drafts. A customer who reads the homepage and expects an autonomous vertical team that learns their preferences, customizes itself, schedules meetings on their behalf, and bills them automatically at trial-end will find half a working email-drafting assistant, a broken chat, no card on file, eleven theatrical agent cards, and Conner as the manual differentiator behind every vertical promise. The path to honest is small and named: wire vertical skills to a runtime caller (one PR per skill, or one router change in `runner.ts`), wire QuickBooks MCP into the two finance skills, add CC-at-Checkout to signup (~9 files), unmerge the unsubstantiated 3-tier supersede, fix the `/talk` env vars in prod.

---

## 2. Customer journey reality

The audit walks `agentplain.com` → signup → 30 days. For each step: what the copy promises, what the code does, whether a human is required, and whether the human dependency is permanent or a config-gate.

### A. Landing on agentplain.com

**Route:** `app/(marketing)/page.tsx:48-642`. Heavy editorial homepage with two CTAs to `/app/sign-up` (line 138, line 612). Both resolve. JSON-LD structured data wired (`lib/seo/structured-data.ts`).

**Works.** Renders without a human. No config gate.

**Two overclaims to flag here, validated under Lens 6:**
- Line 205: "It runs in the background, all day, on its own." → TRUE for the five horizontal skills; partially misleading because the cron is `*/5 * * * *`, not push-instant. The text on line 236-238 ("reacts in real time to push events") is closer to misleading: pushes are batched on the 5-min cron.
- Line 283-289: "Every draft… lands in your approvals queue as a PENDING row." → FALSE for the eleven vertical-specific drafting skills, which persist via `DraftPersister` to Gmail Drafts (`lib/skills/draft.ts:102-109`).

### B. Sign-up → workspace creation

**Files:** `app/(product)/app/sign-up/SignUpForm.tsx`, `app/(product)/app/actions.ts:35-102`, `lib/auth/flows.ts:70-188`.

`signUpBrokerOwner` writes in one Prisma transaction (`lib/auth/flows.ts:95-170`): `User` → `Workspace` (slug-collision retry loop) → `Membership(BROKER_OWNER, ACTIVE)` → `OnboardingState` → `AuditLog`. Then `requestMagicLink` (`actions.ts:90`) sends a verification email via Resend. The user clicks the magic link to land at `/app/workspace/[id]`.

**Works end-to-end self-serve.** Dependencies: `RESEND_API_KEY` env var. Permanent? No — config gate, one-time prod setup.

### C. Credit card capture at signup — DOES NOT EXIST

Searched `lib/auth/**`, signup action, and `signUpBrokerOwner` for `SetupIntent`, `PaymentMethod`, `subscription.create`, `checkout.sessions` — no hits in the signup path. (Full Lens 5 audit in §6 below.)

Actual flow: signup calls `provisionTrialSubscriptionSafe` (`lib/auth/flows.ts:178-186`) which creates a Stripe customer + a `trialing`-status subscription with `trial_period_days: 30` and `default_payment_method: null` (`lib/billing/provisioning.ts:60-80`). Card capture is deferred to the billing page (`app/(product)/app/workspace/[id]/settings/billing/page.tsx:240-257`, the `addPaymentMethodAction` form). The subscription has `trial_settings.end_behavior.missing_payment_method = "pause"` (`lib/billing/stripe-provider.ts:140`).

**Permanent gap.** The sign-up form copy says "First month is on us — no card required to start" (`SignUpForm.tsx:184`).

### D. Connect first integration (Gmail/M365)

**Files:** `app/api/integrations/[integrationId]/oauth/start/route.ts`, `app/api/integrations/microsoft/oauth/callback/route.ts:92-363`, `app/api/integrations/outlook/oauth/callback/route.ts`, `lib/integrations/google/oauth.ts`, `lib/integrations/microsoft/oauth.ts`.

Real, working OAuth code-grant flow: sealed iron-session state cookie, code exchange at `login.microsoftonline.com/.../oauth2/v2.0/token`, profile fetch from Graph `/me`, token encryption via `encryptTokenSet`, upsert into `IntegrationCredential` (RLS via `withSystemContext`), audit log, redirect. Scope union accumulates across incremental M365 grants (`route.ts:282-284`).

**Env gates:** `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, `ENCRYPTION_KEY` (`route.ts:142-148`). If absent the callback redirects with `error=microsoft_oauth_not_configured`. One-time prod config gates — once Conner sets them, every customer flows through autonomously.

**Works after env config.** Real implementation, not stub.

### E. First inbox the fleet sees — what fires on its own

**File:** `lib/inngest/functions/process-webhook-event.ts:55-120`. Cron `*/5 * * * *`. Reads `WebhookEvent` rows with `processed=false` for providers `GOOGLE` or `M365`, joins through credential + workspace, builds `GmailMessageAdapter` or `OutlookMessageAdapter`, runs `runSkillChain` from `lib/skills/runner.ts`, persists artifacts via `persistSkillRunArtifacts`.

When email lands in the connected inbox, within ≤5 minutes the customer sees a draft acknowledgement on `/approvals`. Plus `office-admin` runs same cadence and emits admin-class approval queue cards (verification codes, password resets, billing notices). Plus the runner runs the generic 5-skill chain (Read → Categorize → Coordinate → Schedule → Draft) keyed off the workspace's vertical prompt bundle.

This is the **one autonomous-on-day-1 loop that genuinely works.** Caveat: only fires when a Gmail Pub/Sub or Outlook Graph subscription is actually registered. That registration is in `lib/integrations/google/webhook-handler.ts` and `lib/integrations/microsoft/subscriptions.ts`. The `INTEGRATION_RENEWAL_SWEEP_CRON = '0 */2 * * *'` keeps subscriptions live.

### F. First chat with Plaino — `/talk`

**Files:** `app/(product)/app/workspace/[id]/talk/actions.ts:37-123`, `lib/plaino/dispatcher.ts:85-270`, `lib/plaino/system-prompt.ts:1-80`.

On origin/main the dispatcher has **three** kinds: ANSWER, REGISTER, DECLINE_HONESTLY (`lib/plaino/dispatcher.ts:399-405`). INSTRUCT and PREFERENCE are NOT in main — they live on the unmerged `feat/overnight-chat-fleet-2026-05-28` (commit `940d0c8`).

When a customer types "draft a follow-up to John":
1. `sendPlainoMessageAction` persists the message (`talk/actions.ts:95`).
2. Dispatcher classifies via LLM. If `kind=REGISTER`, creates a `SupportRequest` (`dispatcher.ts:297-344`) and emits `agentplain/support-request.created`.
3. `support-handler-on-create` Inngest function consumes the event and runs the **single** `support-handler` skill (`lib/skills/support-handler/`) — drafts a generic first-touch reply grounded in the workspace knowledge substrate.

**Critical env gates** (`lib/llm/index.ts:60-68`): if `ANTHROPIC_API_KEY` missing, the dispatcher silently falls back to `TestLlmProvider`. The diagnosis doc (`outputs/pr-body-overnight-chat-fleet.md:3`) confirms `ENCRYPTION_KEY` AND `ANTHROPIC_API_KEY` are missing in prod. As of this audit, `/talk` throws `MissingKeyError` on first `encrypt()` and never reaches the LLM. **`/talk` is broken in prod right now.**

Even after PR #120 merges, "do X" only routes to a single hardcoded support-handler skill. Conner asked whether typing "do X" triggers a REAL vertical skill or the generic drafting fallback. Honest answer: it triggers the support-handler. No real vertical-skill routing.

### G. PREFERENCE persistence — what subsequent skills read

**Files:** `lib/preferences/store.ts`, `lib/preferences/capture.ts:1-60`, `lib/inngest/functions/process-webhook-event.ts` (imports `getWorkspacePreference` at line 48), `lib/skills/runner.ts:38-182`, `lib/skills/prompts/compose.ts:25-44`.

`WorkspacePreference` row holds `draftingTone`, `categorizationNotes`, `calendarWindow`, `learnedDraftNotes[]`, `disabledDisciplines[]`. Capture passes (`captureDraftEditSignal`, `captureDraftRejectSignal`) fire from `app/(product)/app/workspace/[id]/approvals/actions.ts:75-87, 148-159` whenever a customer edits or rejects a draft. They append to `learnedDraftNotes`.

**Who reads preferences:** the email-loop runner only. `runner.ts:38, 119, 123` calls `renderPreferencesBlock` and threads `preferencesBlockForDraft`/`preferencesBlockForOther` into `compose.ts`. Edited drafts on `WorkApprovalQueueItem` rows produced by the email-webhook chain DO improve over time.

**Who does NOT read preferences:**
- `lib/skills/inbox-triage-general/skill.ts:23-306` — pure regex/keyword classifier. Zero preference reads.
- `lib/skills/support-handler/**` — drafts /help replies and Plaino REGISTER drafts. Does not consume preferences.
- `lib/plaino/dispatcher.ts` — pulls workspace MEMORY (`PrismaMemoryStore` at `talk/actions.ts:79`) but NOT `WorkspacePreference`.
- `lib/skills/chief-of-staff-scheduler/**` — checks `disabledDisciplines` only.

The learning loop is **real but narrow.** Email drafts improve. Plaino chat, support drafts, scheduler proposals, vertical drafts: identical at day 30 to day 1.

### H. Approval queue

**Files:** `app/(product)/app/workspace/[id]/approvals/page.tsx`, `actions.ts:24-162`.

`decideApprovalAction` flips `status` to `APPROVED` or `REJECTED`, writes `decidedAt` / `decidedByUserId` / `decisionReason`, and inserts an audit log row. **That is the entire effect of clicking approve.** No executor: grep for `status.*APPROVED|onApproved|executeApproval|sendDraft` returns nothing in `lib/`.

This is intentional per `project_no_outbound_architecture.md`. The customer must manually copy the draft into their own Gmail/Outlook and hit send. The homepage line "Nothing leaves without your name on it" (line 281) describes intent; the mechanic is "Nothing leaves, period — you copy-paste it." That gap is not disclosed.

### I. A week passes — proactive scheduled output

Cron inventory (verified at `lib/inngest/functions/*` and `app/api/inngest/route.ts:33-44`):

| Function | Cron | Source | Customer-visible? |
|---|---|---|---|
| `process-webhook-event` | `*/5 * * * *` | `process-webhook-event.ts:57` | yes — `WorkApprovalQueueItem` rows |
| `scheduler-sweep` | `*/15 * * * *` | `scheduler-sweep.ts:70` | yes — scheduler proposals |
| `follow-up-chaser-sweep` | `0 * * * *` | `follow-up-chaser-sweep.ts:62` | yes — nudge drafts |
| `integration-renewal-sweep` | `0 */2 * * *` | `integration-renewal-sweep.ts:47` | no — infra |
| `customer-files-ingestion-sweep` | `0 */6 * * *` | `customer-files-ingestion-sweep.ts:71` | indirect — better grounding |
| `process-doc-drafter-sweep` | `0 13 * * 1` | `process-doc-drafter-sweep.ts:62` | yes — Monday SOP drafts |
| `trial-expiration-warnings` | `0 10 * * *` | `trial-expiration-warnings.ts:35` | yes — operator email |
| `stripe-usage-meter-sweep` | `0 7 * * *` | `stripe-usage-meter-sweep.ts:40` | no — env-gated to no-op |
| `workspace-teardown-sweep` | `0 * * * *` | `customer-data/teardown-scheduler.ts:41` | no — infra |
| `support-handler-on-create` | event-driven | `support-handler-on-create.ts:48-74` | yes — reactive |

**The roster at `docs/fleet-roster-2026-05-27.md:202-210` says "4 Inngest crons."** That number is stale by six months of shipping. Origin/main today has **10**.

**Briefings page is theatrical.** `app/(product)/app/workspace/[id]/briefings/page.tsx:18` reads from `getBriefingsProvider()` (`lib/notion/index.ts:11-40`). If `NOTION_API_KEY` is unset, returns `[]`. If set, pulls from a manually-curated Notion database. **No code path generates briefings.** Grep `createBriefing|writeBriefing|insertBriefing` → only doc files. The empty-state copy "Briefings land here at 9am ET each workday once your fleet has read enough to have something to say" (`briefings/page.tsx:40`) is fiction.

### J. Customer wants to install a new capability — NOT POSSIBLE

The `/integrations` page (`app/(product)/app/workspace/[id]/integrations/page.tsx`) is a connector marketplace (Gmail, M365, Slack, DocuSign, etc.). Connect-only, not a skill marketplace.

There is no skill marketplace. The agents page (`app/(product)/app/workspace/[id]/agents/page.tsx:41-60`) reads a static `agentRoster` from `lib/verticals/<slug>/content.ts` — content per vertical, not customer-installable. The only customer-facing skill control is the discipline enable/disable toggle (`lib/disciplines/activation.ts:48-60`), which writes to `WorkspacePreference.disabledDisciplines[]`. That's eight on/off switches.

**Day 1 fleet = Day 365 fleet, modulo what Conner ships.**

### K. Customer wants to customize a skill — NOT POSSIBLE

`app/(product)/app/workspace/[id]/agents/[slug]/page.tsx:21-60` is a read-only history page. Discipline detail page (`disciplines/[disciplineId]/page.tsx`) similarly displays state, not config. No UI to adjust prompts, thresholds, cadences, exclusion rules, voice guidelines, or recipients.

**Knobs the customer turns:** connect/disconnect integrations; toggle a discipline on/off; edit a draft body (which becomes a learned note that ONLY influences future email drafts). Conner is the configuration interface for everything else.

### L. Support ticket / help

**Files:** `app/(product)/app/workspace/[id]/help/{page.tsx, actions.ts, HelpForm.tsx}`, `lib/support/index.ts:36-80`, `lib/inngest/functions/support-handler-on-create.ts:38-60`, `lib/skills/support-handler/**`.

Customer fills the form → `submitSupportRequest` persists a `SupportRequest` row (RLS-scoped), sends a notification email to `env.supportEmail()`, fires `agentplain/support-request.created`. Inngest function runs `support-handler` skill, queries the substrate, drafts a first-touch reply via LLM, queues a `WorkApprovalQueueItem(kind=SUPPORT_HANDLER_REPLY_DRAFT, discipline=customer-success)`.

**Where does the customer see the reply?** They don't, directly. Conner must approve the draft, then manually send it from his own email client. Customer experience: file ticket → wait for email from Conner.

**Half-autonomous.** Draft generation is real. Delivery still requires Conner.

### M. 30 days in — does the fleet evolve?

Only `learnedDraftNotes`, written by `captureDraftEditSignal` / `captureDraftRejectSignal` (`lib/preferences/capture.ts`), read by the email-skill runner (`lib/skills/runner.ts:119-123`).

**Scope of evolution:** email drafts produced by `inbox-triage-general` and `follow-up-chaser-general` reflect accumulated `learnedDraftNotes`. Plaino chat, support-handler, scheduler, process-doc-drafter, every vertical skill: do NOT consume `learnedDraftNotes`. Day 30 behavior identical to Day 1.

Plaino has its own per-workspace `WorkspaceMemoryEntry` store (separate from `WorkspacePreference`). Plaino remembers facts the customer told it in chat — when `ENCRYPTION_KEY` is set — but that memory feeds no downstream skill.

---

## 3. Fleet autonomy inventory

Bucket counts, in one table.

### Inngest functions (10 registered at `app/api/inngest/route.ts:33-44`)

| Function | Trigger | Bucket | What it produces |
|---|---|---|---|
| `agentplain-process-webhook-event` | cron `*/5` + event | **AUTONOMOUS** | `WorkApprovalQueueItem` + `AuditLog action='skills.loop.completed'` |
| `agentplain-scheduler-sweep` | cron `*/15` + event | **AUTONOMOUS** | scheduler proposals |
| `agentplain-follow-up-chaser-sweep` | cron `0 * * * *` + event | **AUTONOMOUS** | nudge drafts |
| `agentplain-integration-renewal-sweep` | cron `0 */2 * * *` | **AUTONOMOUS (infra)** | token refresh, no customer-visible |
| `agentplain-customer-files-ingestion-sweep` | cron `0 */6 * * *` | **AUTONOMOUS (infra)** | substrate refresh |
| `agentplain-process-doc-drafter-sweep` | cron `0 13 * * 1` + event | **AUTONOMOUS** | weekly SOP drafts |
| `agentplain-trial-warnings` | cron `0 10 * * *` | **AUTONOMOUS** | trial-warning emails (with one false claim — see §6) |
| `agentplain-stripe-usage-meter-sweep` | cron `0 7 * * *` + event | **AUTONOMOUS (infra, env-gated to no-op today)** | usage to Stripe meter |
| `agentplain-workspace-teardown-sweep` | cron `0 * * * *` + event | **AUTONOMOUS (infra)** | grace-window purges |
| `agentplain-support-handler-on-create` | event `support-request.created` | **REACTIVE** | `SUPPORT_HANDLER_REPLY_DRAFT` queue item |

### Catalog skills (17 in `lib/skills/<slug>/`, registered in `lib/skills/registry.ts:62-790`)

| # | Slug | Vertical | Caller in main | Bucket |
|---|---|---|---|---|
| 1 | `office-admin` | all | `runner.ts:199` (process-webhook-event cron */5) | **AUTONOMOUS** |
| 2 | `inbox-triage-general` | all | `process-webhook-event.ts:187` (same cron) | **AUTONOMOUS** |
| 3 | `chief-of-staff-scheduler` | all | `scheduler-sweep.ts:172` (cron */15) | **AUTONOMOUS** |
| 4 | `follow-up-chaser-general` | all | `follow-up-chaser-sweep.ts:144` (cron 0 *) | **AUTONOMOUS** |
| 5 | `process-doc-drafter-general` | all | `process-doc-drafter-sweep.ts:132` (cron 0 13 * * 1) | **AUTONOMOUS** |
| 6 | `support-handler` | all | `support-handler-on-create.ts:95` (event) | **REACTIVE** |
| 7 | `invoice-chasing-realestate` | real-estate | none (README + tests only) | **STAGED** |
| 8 | `lead-triage-realestate` | real-estate | none | **STAGED** |
| 9 | `month-end-close-cpa` | cpa | none | **STAGED** |
| 10 | `law-intake-conflict-screen` | law | none | **STAGED** |
| 11 | `ria-client-update-draft` | ria | none | **STAGED** |
| 12 | `insurance-coi-request` | insurance | none | **STAGED** |
| 13 | `mortgage-document-chase` | mortgage | none | **STAGED** |
| 14 | `home-services-estimate-followup` | home-services | none | **STAGED** |
| 15 | `recruiting-candidate-status-update` | recruiting | none | **STAGED** |
| 16 | `property-management-rent-collection-chase` | property-management | none | **STAGED** |
| 17 | `title-escrow-closing-doc-chase` | title-escrow | none | **STAGED** |

### Theatrical

The **in-product `runtime: "live"` labels on 11+ vertical agentRoster cards** are theatrical. Per `docs/agent-interviews/01-runtime-skills.md:13-30`, 15 of 16 catalog skills carry a `runtime: "live"` label on at least one vertical's roster despite no production caller and `stubbed-json` MCP backends. The type-comment definition (`lib/verticals/types.ts:196-211`) explicitly says "live → capability whose runtime skill is not wired into the live loop yet" — honest in the comment, opaque to the customer. The marketing `/[vertical]` page does NOT render `agentRoster` (`app/(marketing)/[vertical]/page.tsx:48-83`), so prospects don't see it — but logged-in trialing customers do.

### Summary

| Bucket | Count |
|---|---|
| AUTONOMOUS catalog skills | 5 |
| AUTONOMOUS Inngest functions (incl. infra) | 9 |
| REACTIVE catalog skills | 1 |
| REACTIVE Inngest functions | 1 |
| STAGED catalog skills | 11 |
| THEATRICAL (in-product roster labels) | 15 of 16 cards |

**Last-fire evidence:** no `prisma.cronRun` or `prisma.agentRun` table in the schema. Only `process-webhook-event.ts:237` writes `AuditLog action='skills.loop.completed'`. Other crons rely on Inngest Cloud + Sentry check-ins via `withCronMonitor`. To verify last-fire empirically: query `AuditLog where action='skills.loop.completed' order by created_at desc limit 1` in prod, or read Inngest dashboard.

---

## 4. Customization surface

| Surface | UI? | DB write? | Read path? | Verdict |
|---|---|---|---|---|
| A. Vertical pick at signup | yes (`SignUpForm.tsx:231-243`) | `Workspace.vertical` enum (`schema.prisma:350`) | yes (`runner.ts:112`, `agents/page.tsx:60-65`) | **WORKING** — load-bearing |
| B. Onboarding tone + categorization + calendar window | yes (onboarding flow) | `WorkspacePreference` (`schema.prisma:1005-1039`) | yes (`runner.ts:119-126` → `renderPreferencesBlock`) | **WORKING** |
| C. Discipline enable/disable | yes (`disciplines/page.tsx:117-289`) | `WorkspacePreference.disabledDisciplines` | partial — only `follow-up-chaser-sweep:124-130`, `process-doc-drafter-sweep:114-119`, `scheduler-sweep:143-150`, and `process-webhook-event:176-185` (triage only) | **PARTIAL** — webhook → `runSkillChain` vertical chain is NOT gated |
| D. Skill marketplace install/uninstall | NO | no `Skill` / `WorkspaceSkill` model | n/a | **NO-UI** |
| E. Per-skill config | NO | none | n/a | **NO-UI** |
| F. Memory page edits | yes (`talk/memory/page.tsx`, actions in `talk/memory/actions.ts:31-115`) | `WorkspaceMemoryEntry` (`schema.prisma:1203-1237`, encrypted) | only `lib/plaino/dispatcher.ts` — grep on `lib/skills/` returns "No files found" | **WRITE-ONLY for the fleet** (read only in `/talk` chat) |
| G. Auto-approve thresholds | yes (`settings/work-thresholds/page.tsx`) | `WorkThresholdConfig` (`schema.prisma:488-501`) | **zero readers** — grep returns 4 hits, all schema/page/action/migration | **WRITE-ONLY / NO-EFFECT** |
| H. Custom MCP / BYO connector | NO | `MarketplaceProviderKey` is closed union | n/a | **NO-UI** |
| I. Signature / cc / aggressiveness / brand voice | NO (only 3-tone `draftingTone` enum) | partial via `WorkspacePreference.draftingTone` | yes for tone | **NO-UI beyond tone** |

**Forward look — INSTRUCT/PREFERENCE on `feat/overnight-chat-fleet-2026-05-28`:** adds two new dispatcher paths beyond ANSWER/REGISTER/DECLINE_HONESTLY. INSTRUCT creates a `PLAINO_INSTRUCTION` approval-queue row and fires `agentplain/instruction.created`. PREFERENCE classifier writes a `WorkspaceMemoryEntry` with `kind=FEEDBACK` and a `pref:<scope>` title prefix; `lib/plaino/feedback-rules.ts` exports `readFeedbackRules()`. **Critical gap admitted in the PR body itself: no skill in `lib/skills/*` calls `readFeedbackRules` yet.** Grep on the whole repo (current branch) for `readFeedbackRules|renderFeedbackRulesForPrompt|feedback-rules` returns only the PR body and output artifacts. PREFERENCE path is write-only on the fleet side until follow-up wiring lands.

---

## 5. MCP coverage gaps

### What's wired

Nine real workspace-scoped MCP servers, all with real provider API calls (no stubs in the server layer):

| Slug | LOC | Server | OAuth route | Connect UI | Provider gate |
|---|---|---|---|---|---|
| `gmail-mcp` | 550 | real `googleapis` | implicit Google flow | yes | GOOGLE |
| `outlook-mcp` | 714 | real `graph.microsoft.com` | `microsoft/oauth/callback` | yes | M365 |
| `teams-mcp` | 535 | real Graph | shared M365 callback | yes | M365 |
| `onedrive-mcp` | 485 | real | shared M365 callback | yes | M365 |
| `excel-mcp` | 365 | real | shared M365 callback | yes | M365 |
| `google-drive-mcp` | 358 | real | `google-drive/oauth/callback` | yes | GOOGLE |
| `slack-mcp` | 278 | real `slack.com/api` | `slack/oauth/callback` | yes | SLACK |
| `quickbooks-mcp` | 374 | real `quickbooks.api.intuit.com` | `quickbooks/oauth/callback` | yes | QUICKBOOKS |
| `docusign-mcp` | 313 | real | `docusign/oauth/callback` | yes | DOCUSIGN |

Plus calendar substrate servers (`google-calendar-mcp`, `outlook-calendar-mcp`) — real but invisible in marketplace; consumed library-style by the scheduler.

Coming-soon tiles: HubSpot, PayPal, Canva. Tile exists, server does not.

**Token encryption + renewal:** `lib/inngest/functions/integration-renewal-sweep.ts:43-100` runs every 2 hours, refreshes tokens expiring within 5 min, renews Gmail-watch / Graph-subscription windows up to 24h ahead. Cold-start-safe per architecture.

### What's NOT wired

11 of 17 catalog skills are MCP-less stubs reading JSON, per `lib/skills/registry.ts`:

- **High-value gap (afternoon to fix):** `invoice-chasing-realestate` and `month-end-close-cpa` both flag QuickBooks as `stubbed-json` (registry lines 397-404, 478-486) **while `lib/integrations/quickbooks-mcp/server.ts` is a 374-LOC production server with the OAuth flow and renewal cron wired.** The skill code never imports the MCP server. The hardest part — OAuth + token renewal — is done.
- **No vertical-CRM MCPs scaffolded:** Follow Up Boss, kvCORE, Sierra, BoldTrail, Lofty, Real Geeks. Required for `lead-triage-realestate`, parts of `invoice-chasing-realestate`.
- **No legal-AMS MCPs:** Clio, MyCase, PracticePanther. Required for `law-intake-conflict-screen`.
- **No RIA MCPs:** Orion, Redtail. Required for `ria-client-update-draft`.
- **No insurance-AMS MCPs:** EZLynx, HawkSoft, NowCerts. Required for `insurance-coi-request`.
- **No mortgage-LOS MCPs:** Encompass, Calyx. Required for `mortgage-document-chase`.
- **No trades-software MCPs:** AccuLynx, ServiceTitan, Housecall Pro, Jobber. Required for `home-services-estimate-followup`.
- **No ATS MCPs:** Greenhouse, Lever. Required for `recruiting-candidate-status-update`.
- **No PM MCPs:** AppFolio, Buildium. Required for `property-management-rent-collection-chase`.
- **No title MCPs:** SoftPro, Qualia. Required for `title-escrow-closing-doc-chase`.

### Six customer use cases traced

1. **"Categorize my inbox"** → Gmail/M365 ✓. `office-admin` + `inbox-triage-general` fire on Pub/Sub + Graph webhooks via `process-webhook-event:37-44`. **WORKS.**
2. **"Schedule a meeting with X"** → calendar ✓ + email ✓. `chief-of-staff-scheduler` consumes both calendar MCPs and writes draft replies. Every 15 min. **WORKS** (proposes only, per no-outbound).
3. **"Draft a follow-up to last week's lead"** → CRM ✗ + email ✓. `follow-up-chaser-general` works on email signal alone. CRM ground-truth absent. **PARTIAL.**
4. **"Summarize my last sales call"** → audio + transcription. `teams-mcp:348-394` exposes `getMeetingRecordingTranscript`. **No skill consumes it.** No Zoom MCP, no Meet recording, no Whisper/AssemblyAI pipeline. **MISSING.**
5. **"Find similar customers to X"** → CRM ✗ + warehouse ✗. No HubSpot MCP (coming-soon), no FUB/Sierra/kvCORE, no cross-customer warehouse. **MISSING.**
6. **"Send an invoice to X"** → `quickbooks-mcp:50-100` exposes `createInvoice` and `recordPayment` (the latter behind hard `APPROVAL_REQUIRED` gate). **No skill consumes it.** **MCP READY, SKILL UNWIRED.**

### Discipline delta vs. expansion plan

Plan at `docs/fleet-expansion-plan-2026-05-27.md` §1 declares 8 customer-facing disciplines. Cross-reference against `lib/disciplines/index.ts:29-37` and `lib/integrations/marketplace.ts` `disciplines[]`:

| Discipline | Connectors wired | Skills firing on customer data | Plan wave |
|---|---|---|---|
| Analytics | excel ✓, quickbooks ✓ | **0** — no `data:build-dashboard` wrap | Wave 1 |
| Research | google-drive ✓, onedrive ✓ | **0** — no `enterprise-search:search` wrap | Wave 1 |
| Legal | docusign ✓, onedrive ✓ | **0** — no `legal:review-contract` wrap; `law-intake` stubbed | Wave 1 + Wave 4 |
| Marketing | gmail ✓, outlook ✓ | **0** — no `marketing:draft-content` wrap | Wave 1 |
| Sales-enablement | gmail ✓, outlook ✓, teams ✓ | `follow-up-chaser-general` ✓; `lead-triage-realestate` broken | Wave 1 + Wave 2 |
| Customer-success | gmail ✓, outlook ✓, slack ✓, teams ✓ | `support-handler` ✓, `office-admin` ✓ | already there |
| Finance | quickbooks ✓, onedrive ✓, excel ✓ | `month-end-close-cpa` broken, `invoice-chasing-realestate` broken | Wave 3 |
| Operations | gmail ✓, outlook ✓, teams ✓, slack ✓ | `chief-of-staff-scheduler` ✓, `inbox-triage-general` ✓, `process-doc-drafter-general` partial, `office-admin` ✓ | already there |

**Only 1 of 8 disciplines (operations) is at the bar the plan calls Wave 1.** Customer-success is close. The other six need Wave 1 wraps that don't exist yet.

### Stale `stubbed-json` flags in the registry

These entries claim `status: 'stubbed-json'` for dependencies that are now real:
- `chief-of-staff-scheduler.google-calendar` + `m365-calendar` (registry lines 82-95) — wired today.
- `inbox-triage-general.work-approval-queue` (lines 209-211) — wired (`PrismaTriageApprovalSink`).
- `follow-up-chaser-general.work-approval-queue` (lines 259-261) — wired (`PrismaFollowUpApprovalSink`).

These UNDERSELL the system. The opposite of the usual honesty problem.

---

## 6. Credit-card-at-trial status

### Current state diagram

```
/pricing CTA  ──►  /app/sign-up (form, NO CC field)  ──►  signUpAction (server action)
                                                              │
                                                              ▼
                                                  signUpBrokerOwner()
                                                  ─ User + Workspace + Membership + OnboardingState
                                                  ─ (DB tx commits, NO Stripe touched)
                                                              │
                                                              ▼
                                                  provisionTrialSubscriptionSafe()
                                                  ─ stripe.customers.create({ email, name })   ← NO PM
                                                  ─ stripe.subscriptions.create({
                                                      trial_period_days: 30,
                                                      trial_settings.end_behavior.missing_payment_method = "pause"
                                                    })
                                                  ─ failures swallowed → audit row
                                                              │
                                                              ▼
                                                  requestMagicLink() → email magic link
                                                              │
                                                              ▼
                                                  Click link → /app/verify → full product access

— 30 days pass —
   Daily 10am cron, trial-expiration-warnings.ts
   ─ T-7 / T-3 / T-1 emails. Copy says "your card on file will be charged"   ← FALSE
   ─ No card → Stripe auto-pauses sub via trial_settings (status = "paused")

— Trial ends —
   Stripe fires customer.subscription.updated with status="paused"
   ─ subscriptionStatusFromProvider("paused")
   ─ "paused" NOT in ProviderSubscriptionStatus union (lib/billing/types.ts:89-96)
   ─ STATUS_MAP returns undefined; Prisma upsert receives undefined for enum → THROWS
   ─ Route returns 500 → Stripe retries for 72h → all fail
   ─ App keeps working (no status-based feature gate exists)
```

### What exists

- `app/(product)/app/sign-up/SignUpForm.tsx:184-185` — "First month is on us — no card required to start."
- `lib/auth/flows.ts:178-186` — `provisionTrialSubscriptionSafe` called after workspace tx, swallows failures.
- `lib/billing/provisioning.ts:9-10` (comment): *"Per the brief's `trial_period_days: 30` directive, no card is collected at signup — the trial-end flow drives card-on-file capture later."*
- `lib/billing/stripe-provider.ts:129-149` — Subscription created with `trial_period_days: 30`, `trial_settings.end_behavior.missing_payment_method = "pause"`, `payment_settings.save_default_payment_method = "on_subscription"`.
- `lib/inngest/functions/trial-expiration-warnings.ts:239` — email body says *"After [day], your card on file will be charged…"* — **FALSE today.**
- `lib/inngest/functions/trial-expiration-warnings.ts:240` — *"If you haven't added a card yet, your fleet pauses when the trial ends."* — Stripe pauses billing collection only; the app's no-feature-gate means the fleet keeps running.
- `app/(product)/app/workspace/[id]/settings/billing/page.tsx:130-137, 626-660` — `TrialBanner` prompts add-payment-method if `defaultPaymentMethodId` is null. AFTER signup, AFTER magic-link verify.

### What is missing

| Concern | Current | Required |
|---|---|---|
| CC capture point | Inside `/app/workspace/[id]/settings/billing` AFTER verify | At `/app/sign-up`, before workspace exists |
| Trial path | `subscriptions.create({ trial_period_days, missing_payment_method: "pause" })` with no PM | Stripe Checkout `mode=subscription` with `subscription_data.trial_period_days=30` + `payment_method_collection="always"` |
| Trial-end | Stripe pauses (schema lacks PAUSED enum → 500 on webhook) | Stripe auto-invoices the card; status flips to ACTIVE |
| Email copy | Trial warning email already says "card on file will be charged" | Becomes accurate by design |
| Pricing CTA | Routes to form | Either keep form (capture CC inline) or route to Checkout |
| Pricing copy | "first month free, no card required" | "Card required. First 30 days free. Cancel anytime." |
| `SubscriptionStatus` enum | Missing `PAUSED` | Moot once card-required |
| Feature gating | None (workspace runs regardless of status) | Open question independent of CC-at-signup |

### Files that would change

1. `app/(product)/app/sign-up/SignUpForm.tsx` — remove "no card required"; embed Stripe Elements or redirect to Checkout
2. `app/(product)/app/sign-up/page.tsx:50` — drop "first month is on us"
3. `app/(product)/app/actions.ts:35-102` — `signUpAction` returns Checkout URL, or pre-creates workspace + redirects with `client_reference_id`
4. `lib/billing/provisioning.ts:66-143` — split into `createCustomerForWorkspace` + drop no-card path
5. `lib/billing/stripe-provider.ts:229-260` — `createCheckoutSession` add `subscription_data.trial_period_days=30`
6. `lib/billing/webhook-dispatch.ts` — add `checkout.session.completed` handler that finalizes workspace ↔ subscription link
7. `lib/inngest/functions/trial-expiration-warnings.ts:230-262` — copy becomes true (likely no edit needed)
8. `app/(marketing)/pricing/page.tsx` — copy refresh
9. **NEW**: `app/api/stripe/checkout-session/route.ts` — public route that creates Checkout session before any DB write

Plus 4 test files updated. **~250-400 net LOC. 1-2 focused sessions.**

### Brutal verdict (Lens 5)

The CC-at-trial story is aspirational, not real. The trial-warning email already promises "your card on file will be charged" — a statement that is false today for every customer who signs up. The billing page's PAST_DUE banner says agents will "pause until billing is current" — also false: zero code anywhere in the app reads `subscription.status` to gate any product surface. When the 30-day trial expires without a card, Stripe pauses, the webhook throws, retries fail, the customer keeps using the fleet for free indefinitely. Full Checkout E2E has never been exercised end-to-end in any environment (`docs/stripe-e2e-verification-2026-05-18.md:37`); live Stripe catalog provisioning still sits behind a Conner-only manual runbook step. The longer this ships without CC-at-signup, the more revenue leaks through the no-CC trial door.

---

## 7. Honesty bar violations

| Surface | Claim | Verdict |
|---|---|---|
| `page.tsx:85-92` | "We install the fleet… reads from your email, calendar, CRM, and documents" | **PARTIAL** — email + calendar + Drive fixtures real. CRM read NOT IMPLEMENTED — no CRM adapter exists. |
| `page.tsx:85-86` | "We install the fleet inside your business" | **OVERCLAIMS** — sign-up is self-serve. No human installer. |
| `page.tsx:205` | "It runs in the background, all day, on its own." | **TRUE** for the 5 horizontal skills. |
| `page.tsx:236-238` | "reacts in real time to push events" | **MISLEADING** — pushes are batched on the 5-min cron. Worst-case latency 5 min, not real-time. |
| `page.tsx:225-227` "schedules what needs scheduling" (verb) | Scheduler explicitly never books (`chief-of-staff-scheduler/skill.ts:51-54`) | **OVERCLAIMS by verb** — proposes only. |
| `page.tsx:230-232 + 283-289` "Every draft… lands in your approvals queue as a PENDING row." | True for general/admin/support/scheduler skills. **FALSE for the 9 vertical drafting skills** — they persist via `DraftPersister` to Gmail Drafts (`lib/skills/draft.ts:102-109`), not `WorkApprovalQueueItem`. | **OVERCLAIMS** — universality of approvals queue is false. |
| `page.tsx:248-256` "Onboarding captures your tone… those choices ride into every prompt every fire. Every edit becomes a learned note. The very next fire sees what you taught." | Preferences read at fire time and inlined via `renderPreferencesBlock` (`runner.ts:119-132`). Edit signals append learned notes. | **WORKS** — but only for skills in the email runner chain. |
| `page.tsx:262-275` Drive ingest | Honestly hedged ("runs against on-disk fixtures today… Google Drive lands the same way the moment the OAuth scopes are connected") | **WORKS** — self-disclosed. |
| `FAQ.tsx:55-56` "We never auto-send, never move money, never make commitments." | Type-level enforced; no skill has `kind: 'send'`. | **WORKS.** |
| `FAQ.tsx:51-52` "your service partner handles the install" | Sign-up is self-serve OAuth. | **OVERCLAIMS** — no human service partner in product flow. |
| `briefings/page.tsx:40` "Briefings land here at 9am ET each workday once your fleet has read enough" | No briefing generator exists; reads from a Notion DB nobody populates. | **FICTION.** |
| Trial-warning email `trial-expiration-warnings.ts:239` "your card on file will be charged" | No card was ever collected at signup. | **FALSE.** |
| Billing page `settings/billing/page.tsx:139-159` PAST_DUE banner "agents pause until billing is current" | Zero code reads `subscription.status` to gate any surface. | **FALSE.** |

### Banned framings hit

Per `feedback_everything_tells_a_story.md` and `project_stripe_both_surfaces.md`:

- **"~35 cron-fired agents"** — appears 4 times in customer copy despite homepage's own no-agent-count rule (homepage line 36 enforces this):
  - `app/(marketing)/about/page.tsx:101-102`
  - `app/(marketing)/custom/page.tsx:139`
  - `components/FAQ.tsx:84`
  - `lib/marketing/home-content.ts:63` (rendered into homepage Uniques card)
- **Vertical→tier copy** — DIRECT VIOLATION of locked 2026-05-12 memory rule:
  - `lib/verticals/cpa/content.ts:28` → `tier: "plus"`
  - `lib/verticals/home-services/content.ts:30` → `tier: "plus"`
  - `lib/verticals/law/content.ts:31` → `tier: "max"`
  - `lib/verticals/ria/content.ts:30` → `tier: "max"`
- **3-column tier comparison** — DIRECT VIOLATION:
  - `pricing/page.tsx:128-162` (Regular / Partner / Max grid)
  - `page.tsx:487-519` (homepage Regular / Partner / Max TierCard grid)
  - `verticals/page.tsx:40-44` "Three service-partnership tiers"

The code includes comments asserting a "2026-05-15 ratification" supersede (`pricing/page.tsx:12-15`, `home-content.ts:11`, `PricingTierBanner.tsx:11-12`, `verticals/page.tsx:13-18`, `FAQ.tsx:9-12`) — **no memory file dated 2026-05-15 exists** in `~/.claude/projects/C--agentplain/memory/`. Either the supersede needs to land as a new memory file, or the customer surface needs to roll back to Regular + Custom only.

### Pricing-page internal consistency

The numbers themselves ($199 → $99 Regular ladder, $299 → $199 Partner ladder, $5K-$15K + $200-$500/mo Custom) are internally consistent across `home-content.ts`, `pricing/page.tsx`, `custom/page.tsx`, `verticals/page.tsx`, `PricingTierBanner.tsx`. Fidelity to the current code is good. Fidelity to the locked memory rule is broken.

---

## 8. Top 5 things to fix to make the fleet ACTUALLY autonomous

Ranked by impact × low-hanging fruit:

1. **Wire `quickbooks-mcp` into `invoice-chasing-realestate` and `month-end-close-cpa`.** The finished MCP server (`lib/integrations/quickbooks-mcp/server.ts`, 374 LOC) sits unused while two skills carry `stubbed-json` flags in the registry. The OAuth + token-renewal hard parts are already done. Fix the registry entries from `stubbed-json` to `built`, import the MCP server in the skill files, add a cron caller. **~1 PR. Half a day.** Lights up the finance discipline.

2. **Route the 11 vertical catalog skills from `process-webhook-event` based on `workspace.vertical`.** Today `runSkillChain` runs a generic 5-phase chain regardless of vertical. Add a vertical-specific dispatch in `runner.ts` so when a real-estate workspace's email fires, `lead-triage-realestate` runs in addition to (or instead of) the generic chain. This converts 11 STAGED skills into AUTONOMOUS without writing new skill code. **~1 PR per pair of verticals. 1-2 days total.** Single biggest unlock for "vertical-aware fleet" claim.

3. **Fix `/talk` in prod.** Set `ENCRYPTION_KEY` and `ANTHROPIC_API_KEY` in prod Vercel env. Merge PR #120 (the INSTRUCT/PREFERENCE work on `feat/overnight-chat-fleet-2026-05-28`). **~1 hour of env config + merge.** Without this, the centerpiece "chat with Plaino to instruct or give preferences" is broken.

4. **Add `SubscriptionStatus.PAUSED` to the enum + STATUS_MAP** OR replace the pause flow with CC-at-signup (covered in §6). Today the trial-end webhook throws → 500 → 72h retries fail → customer keeps using the fleet free. **~1 PR. Half a day** if just fixing the enum; **1-2 sessions** if doing the CC-at-signup pivot.

5. **Build the briefings generator.** `briefings/page.tsx:40` promises 9am ET daily briefings; no generator exists; the page reads from Notion only. Either (a) write a new Inngest cron (`agentplain-daily-briefing`, cron `0 13 * * *` UTC = 9am ET) that aggregates the past day's approval-queue activity + open threads + scheduler proposals into a briefing card, OR (b) take the briefings page out of nav and remove the promise. **~1 PR for (a), couple of hours for (b).**

## 9. Top 5 things to fix to make customization ACTUALLY work

1. **Make `WorkspaceMemoryEntry` readable by skills, not just by `/talk`.** Today memory is encrypted and consumed only by `lib/plaino/dispatcher.ts`. Add a `getRelevantMemoryEntries(workspaceId, scope)` reader in `lib/memory/` and inline it into the prompt bundle alongside preferences (`renderPreferencesBlock` companion). Every skill that reads preferences would also read memory. **~1 PR. 1 day.** Unblocks "tell Plaino to remember X, then have the fleet act on it."

2. **Make `WorkThresholdConfig` actually gate approval execution.** The work-thresholds page persists severity gates; zero code reads them. Add a read in `lib/skills/<skill>/approval-sink.ts` or in `decideApprovalAction` so that high-confidence drafts under threshold can auto-approve (still no auto-send, but at least the gate doesn't lie). **~1 PR. 1 day.** Closes the "auto-approve thresholds" lie.

3. **Gate `runSkillChain` on the discipline-disable list.** Today the largest runtime path (`process-webhook-event` → `runSkillChain`) only gates the triage augmentation; the vertical chain runs regardless of which disciplines are off. Add a discipline-gate in `runner.ts` that skips drafting when the relevant discipline is disabled. **~1 PR. Half a day.**

4. **Build per-skill config UI.** Customer cannot say "for follow-up-chaser, wait 7 days not 3" or "cc my paralegal on intake replies." Add a `SkillConfig` Prisma model + a `/skills/<slug>/configure` page + a read in the skill code. Start with the 6 autonomous skills only. **~1 PR per skill. Iterative.**

5. **Build (or remove) the skill marketplace.** Today the agents page is a static read-only display. Either build a real `/skills` page where customers see what's installed, install/uninstall, and see what they could install — backed by a `WorkspaceSkill` join table — OR rebrand the page as "Your fleet" and stop calling it a marketplace. **~1 PR. 1-2 sessions** for the real thing.

### Wire PREFERENCE rules into the fleet (companion to PR #120)

PR #120's own commit body admits no skill calls `readFeedbackRules` yet. The PR needs a follow-up that imports `readFeedbackRules` into `lib/skills/runner.ts` and inlines the rules into the prompt bundle alongside preferences. **~1 PR. Half a day.** Without this, PREFERENCE chat path is write-only.

---

## 10. One-sentence verdict per discipline

The 8 customer-facing disciplines per `lib/disciplines/index.ts:29-37` and the expansion plan §1.

- **Analytics** — No skill in `lib/skills/` fires under this banner; excel + quickbooks MCPs connect but no `data:build-dashboard` wrapper exists. **NOT delivering autonomously.**
- **Research** — google-drive + onedrive MCPs connect; no `enterprise-search:search` wrapper skill; substrate retrieval works only inside `support-handler` and the email runner's grounding. **NOT delivering as a discipline.**
- **Legal** — docusign + drives connect; `law-intake-conflict-screen` skill is STAGED; no `legal:review-contract` wrapper; the realty fair-housing compliance scanner DOES fire on every customer-facing draft. **One real surface (compliance scanner); discipline as a whole NOT delivering.**
- **Marketing** — gmail + outlook connect; no `marketing:draft-content` wrapper; no skill produces marketing artifacts today. **NOT delivering.**
- **Sales-enablement** — `follow-up-chaser-general` AUTONOMOUS hourly is real and useful; `lead-triage-realestate` is STAGED. **Partially delivering — email-chase real, lead-triage absent.**
- **Customer-success** — `support-handler` REACTIVE (REGISTER chat + /help), `office-admin` AUTONOMOUS every 5 min. **Delivering.**
- **Finance** — quickbooks + onedrive + excel connect; `invoice-chasing-realestate` and `month-end-close-cpa` are STAGED with `stubbed-json` despite real QuickBooks MCP available. **NOT delivering — and the gap is closeable in an afternoon.**
- **Operations** — `chief-of-staff-scheduler` AUTONOMOUS every 15 min, `inbox-triage-general` AUTONOMOUS every 5 min, `process-doc-drafter-general` AUTONOMOUS weekly, `office-admin` AUTONOMOUS every 5 min. **Delivering. Only discipline that meets the bar today.**

**Score: 2 of 8 disciplines (operations, customer-success) deliver autonomously. 1 partial (sales-enablement). 5 not delivering.**

---

## Appendix — source provenance

- `lib/inngest/functions/*.ts` × 10 — cron registrations
- `app/api/inngest/route.ts:33-44` — Inngest function registration
- `lib/skills/registry.ts:62-790` — catalog skill registry
- `lib/skills/<slug>/` × 17 — code-defined catalog skills
- `lib/integrations/<slug>-mcp/server.ts` × 9 — real MCP servers
- `lib/integrations/marketplace.ts:96-322` — connector catalog
- `lib/preferences/{store, capture, render}.ts` — preferences read/write
- `lib/billing/{provisioning, stripe-provider, webhook-dispatch}.ts` — Stripe path
- `lib/auth/flows.ts:70-188` — signup
- `app/(marketing)/page.tsx`, `pricing/page.tsx`, `custom/page.tsx`, `verticals/page.tsx`, `about/page.tsx`, per-vertical pages — customer surface
- `docs/fleet-roster-2026-05-27.md` — baseline roster (4-cron number stale)
- `docs/fleet-expansion-plan-2026-05-27.md` — 8-discipline plan
- `docs/agent-interviews/01-runtime-skills.md` — prior interview audit (15 of 16 catalog skills VERIFIED-DEMO-ONLY)
- `outputs/pr-body-overnight-chat-fleet.md` — PR #120 diagnosis of `/talk` prod outage
- Memory: `~/.claude/projects/C--agentplain/memory/project_stripe_both_surfaces.md` (locked 2026-05-12, Regular + Custom only)
