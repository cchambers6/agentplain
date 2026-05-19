# Pre-pilot ship readiness — 2026-05-18

**Audit branch:** `docs/pre-pilot-ship-readiness-2026-05-18` (off `origin/main` @ `2a10b0c`)
**DONE bar (locked, per `project_agentplain_is_priority.md`):**

> Customer signup → workspace → connect Gmail → see value loop → pay via Stripe.

Every status cell cites a file:line, a git ref, or an HTTP response — no "should be working" per `feedback_no_guesses_no_estimates.md`.

---

## 1. Verdict

**Conditional GO.** The DONE bar is *built end-to-end* — sign-up, OAuth, MCP servers, skill chain, Inngest cron, handoff + approval writers, three-tier billing, Stripe webhook dispatch, and the customer surfaces around all of it are on `origin/main` @ `2a10b0c`. The wiring gap the 2026-05-17 audit named — `processWebhookEventFn` not registered + no cron — was closed by Wave A1 commit `c1e7485` and is live (`app/api/inngest/route.ts:29`, `lib/inngest/functions/process-webhook-event.ts:42,158`).

What's missing is **proof**, not code. Three things gate first-paying-customer:

1. **The 5-skill loop has never been verified end-to-end on a real inbox.** Code path is wired; we have not watched a single `WebhookEvent` row go from `processed=false` → `processed=true` with a corresponding `HandoffLogEntry` + Gmail Draft on a live mailbox.
2. **Stripe Checkout has never been run in live mode against a real card.** Webhook dispatch + Subscription state machine is implemented; we have not observed `TRIALING → ACTIVE` flipping on a real `customer.subscription.updated` event.
3. **Outlook is OAuth-only on `main` — no Graph subscription + no webhook receiver.** Outlook customers can connect but the loop will never fire for them. Phase B (commit `8aa8ed5` on `feat/outlook-mcp-phase-b-2026-05-18`, unmerged) closes this; until it ships, the pilot must be a **Gmail-only customer**.

Sell once #1 and #2 are validated on Conner's own inbox + a real $0.50 test charge, and the pilot is scoped to a Gmail user. Outlook is a fast-follow, not a launch blocker — provided the pilot is selected from a Gmail-using vertical.

---

## 2. The DONE bar — step-by-step status

Legend: ✓ verified by code + observed behavior · ⚠ code wired, not observed end-to-end · ✗ broken or missing

| # | Step | Status | Evidence |
|---|---|---|---|
| 1 | Sign-up renders + creates Workspace | ✓ | `app/(product)/app/sign-up/page.tsx`, `app/(product)/app/sign-up/SignUpForm.tsx`, `app/(product)/app/actions.ts:35-102` (signUpAction). Submitted on live preview 2026-05-18 — workspace + magic-link created (`docs/overnight-product-build-handoff-2026-05-18.md` step 2: notice "Check test-overnight@agentplain.dev. The sign-in link is valid for 15 minutes" only renders when `signUpBrokerOwner()` + `requestMagicLink()` both succeed per `actions.ts:98`). |
| 2 | Magic-link sign-in works | ⚠ | `app/(product)/app/verify/route.ts:35-64` — Route Handler (fixed from page.tsx crash 2234350772). Error path verified: bad token → `/app/sign-in?reason=invalid` (handoff doc step 9, Playwright capture). **Happy path never observed from the audit sandbox** — needs Conner to click a real magic link. |
| 3 | Workspace landing renders on-brand | ⚠ (gate verified, full render unobserved) | `app/(product)/app/workspace/[id]/page.tsx:29-100` — pulls handoffs, approvals count, briefing. Auth gate fires: `/app/workspace/<UUID>` → 307 → `/app/sign-in?next=...` (handoff doc step 3). Full render is auth-gated; not captured in sandbox. |
| 4 | Onboarding shows named service partner intro | ✓ (code) ⚠ (live render unobserved) | `onboarding/page.tsx:67` `servicePartnerForWorkspace(workspaceId)`; line 122-123: `Hi {ownerFirstName}. I'm {partner}, your service partner at agentplain.` Step 2's `connect_integration` step links to `/integrations` + has direct OAuth start (`onboarding/page.tsx:380-396`) — the orphan from 2026-05-17 audit is closed. Gate verified at handoff doc step 3. |
| 5 | Connect Gmail OAuth completes | ⚠ | `app/api/auth/oauth/google/callback/route.ts:158-302` (per 2026-05-17 audit) — full flow exists: token exchange, AES-256-GCM encryption via `lib/security/encryption.ts`, `IntegrationCredential` upsert, `users.watch` Pub/Sub subscribe, `WebhookSubscription` upsert, AuditLog. **No `IntegrationCredential` row observed in production for any real Gmail account.** |
| 6 | Connect Outlook OAuth completes | ⚠ (OAuth only — webhook missing on main) | `app/api/integrations/outlook/oauth/callback/route.ts:84-339` — full M365 token exchange + `/me` profile fetch + `IntegrationCredential` (`provider=M365`) upsert + AuditLog. **BUT no Graph subscription is created, and no `app/api/webhooks/microsoft/` route exists on `main`.** Subscription + webhook handler are on commit `8aa8ed5` (`feat/outlook-mcp-phase-b-2026-05-18`, unmerged per `git branch -a --contains 8aa8ed5`). For an Outlook customer today, the loop will never fire. |
| 7 | Webhook delivers Gmail events | ⚠ | `app/api/webhooks/google/route.ts:35-140` — full implementation: OIDC verify → parse → find subscription by accountEmail → insert `WebhookEvent` → verify-after-create. **No production `WebhookEvent` row ever observed in this audit.** Pub/Sub topic existence on the GCP side (`GOOGLE_PUBSUB_TOPIC`) is `UNKNOWN` per the 2026-05-17 audit §6. |
| 7b | Webhook delivers Outlook events | ✗ on main | No route at `app/api/webhooks/microsoft/`. The receiver lands with commit `8aa8ed5` on the unmerged feature branch. |
| 8 | Inngest cron drains `WebhookEvent` | ⚠ | `app/api/inngest/route.ts:29` registers `processWebhookEventFn`. `lib/inngest/functions/process-webhook-event.ts:42,158` — cron `*/5 * * * *` + on-demand event trigger. Disable-gate flag (`INNGEST_FN_DISABLE_AGENTPLAIN_PROCESS_WEBHOOK_EVENT`) per `lib/inngest/disable-flag.ts`. **Inngest Cloud registration verification + a real fire on a real `WebhookEvent` are unobserved**, per audit §6. |
| 9 | Skill chain runs end-to-end (read → categorize → coordinate → schedule → draft) | ⚠ | `lib/skills/runner.ts` orchestrates the chain (per 2026-05-17 audit §1, row 4). Each skill file present at `lib/skills/{read,categorize,coordinate,schedule,draft}.ts`. The Inngest function calls `runSkillChain` at `process-webhook-event.ts:95-100`. **No skill-runs log entry observed** in `agent-state/skill-runs/` (directory exists, empty per `ls` 2026-05-18). Real-inbox verification is the open `feedback_integration_acceptance_is_functional.md` bar. |
| 10 | `HandoffLogEntry` rows appear | ✓ (writer code) ⚠ (no live rows observed) | `lib/skills/persist-artifacts.ts:86` `tx.handoffLogEntry.createMany(...)` — one row per skill step transition. Called from `process-webhook-event.ts:102-105`. **No live row observed** — the audit can't query the prod DB. |
| 11 | `WorkApprovalQueueItem` rows render as cards | ✓ (writer + UI) ⚠ (no live rows observed) | Writer: `lib/skills/persist-artifacts.ts:95-100` creates a `WorkApprovalQueueItem` (kind `BUYER_INQUIRY_REPLY_DRAFT`) on every draft produced. UI: `app/(product)/app/workspace/[id]/approvals/page.tsx:13-59` renders `PENDING` items via `ApprovalsList.tsx`. The `inbox-triage-fleet` agent slug is constant in V1 (`persist-artifacts.ts:38`). |
| 12 | Customer can approve / edit / reject | ✓ (code) ⚠ (live click-through unobserved) | `approvals/actions.ts:16-65` `decideApprovalAction` — validates decision in `["APPROVED", "REJECTED"]`, transactional update + AuditLog. `approvals/actions.ts:67-115` `editApprovalDraftAction` — rewrites payload body, 50 KB cap, audit row. `ApprovalsList.tsx:43-83` — edit sheet with textarea. No reject-with-reason UI is wired beyond the form's `reason` field; status flips PENDING → REJECTED on submit. |
| 13 | Customer can pick a tier in billing | ✓ | Tier picker is present on **both** `/app/sign-up` (`SignUpForm.tsx:36-56` per 2026-05-17 audit) and `/app/workspace/[id]/settings/billing` (`settings/billing/page.tsx:411-601` per same audit). Both surfaces show Regular / Partner / Max with Max routing to `/custom?type=max` (defense-in-depth in `actions.ts:60-77`). Marketing `/pricing` deployed at agentplain.com confirmed live with `curl -sI` 2026-05-18 (HTTP 200). |
| 14 | Stripe Checkout completes | ⚠ | `lib/billing/stripe-provider.ts:62-75` `StripeBillingProvider` — `apiVersion: "2026-04-22.dahlia"` pinned per commit `9ab106a`. `settings/billing/actions.ts:62-117` (per audit) calls `provider.createCheckoutSession` for tier swap. Webhook receiver at `app/api/stripe/webhook/route.ts:23-64` — verify, idempotency short-circuit on `BillingEvent.stripeEventId @unique`, transactional dispatch. **Live test charge has not been run**; Partner tier Stripe Price existence in live mode is `UNKNOWN` (audit §6). |
| 15 | Stripe webhook flips Workspace to paid | ⚠ | `lib/billing/webhook-dispatch.ts:44-82` dispatches `customer.subscription.created/updated/trial_will_end` to `syncSubscription`; line 113- maps `trial_end`, `current_period_end`, `cancel_at_period_end`, `default_payment_method`, `items[]` quantity + `lookup_key` into the `Subscription` row. `provisioning.subscriptionStatusFromProvider` translates the Stripe status string to `SubscriptionStatus` enum. **No production event ever observed flipping a row.** |
| 16 | Customer sees "Current plan" in billing | ✓ (code) ⚠ (live render unobserved) | `settings/billing/page.tsx:171-263` — "current plan" `ApPaperCard` renders status badge, seat band, monthly charge from `monthlyChargeUsdCents(tier, seats)`. Auth-gated (handoff step 7). |

**Tally:** 0 ✗ (Outlook webhook missing on main is row 7b — but that's a vertical-isolated gap, not a blocker for a Gmail pilot). 13 ⚠ where the meaningful uncertainty is *unobserved on a real inbox / real card*, not "code missing." 3 ✓ where code + a live observation both exist.

---

## 3. Material risks (sorted by severity)

### S1 — The loop has never fired on a real inbox

Per `feedback_integration_acceptance_is_functional.md`: *"Acceptance = read + categorize + coordinate + schedule + draft on Conner's real inbox."* That bar has not been crossed. Every layer is built; we have unit-test confidence in the parts but zero end-to-end confidence that a Gmail Pub/Sub push at agentplain.com results in a draft landing in the customer's Gmail Drafts folder.

**Best fix (not a quick fix per `feedback_no_quick_fixes.md`):** Conner connects his own Gmail to a production workspace today, sends a test email to that mailbox from a second account, and watches a `WebhookEvent` row land → Inngest cron fire → `HandoffLogEntry` rows appear in the workspace overview → Gmail Draft appear in his Gmail Drafts. This is the published bar — there is no cheaper substitute that produces equivalent confidence.

### S2 — Stripe Checkout has never been completed in live mode

Code path verified by reading; idempotency strategy is sound (BillingEvent + transactional dispatch); Stripe API version is pinned. But the production Stripe account's live-mode Products + Prices for Partner tier are unverified (`scripts/stripe/setup-products.ts` referenced in `lib/env.ts:73-74` per audit §6).

**Best fix:** run `scripts/stripe/setup-products.ts` against live mode if not yet done, then complete one $1 test purchase against a workspace with `mode=setup` for card-on-file + `mode=subscription` for the first invoice. Observe `customer.subscription.updated` flip Subscription.status from TRIALING → ACTIVE.

### S3 — Outlook customers cannot reach the loop on `main`

OAuth completes (M365 credential row gets created), but the customer's Outlook inbox never delivers a webhook because (a) no Graph subscription is created during the OAuth callback, and (b) `app/api/webhooks/microsoft/` does not exist on `main`. A customer signing up via Outlook gets a workspace that looks connected but produces no drafts.

**Best fix:** merge `feat/outlook-mcp-phase-b-2026-05-18` (commit `8aa8ed5`) before any Outlook-using customer signs up. If pilot is gated to Gmail-only (recommended), this becomes a fast-follow, not a launch blocker.

### S4 — Briefings hard-error if NOTION_API_KEY is unset

Per 2026-05-17 audit §1 row 2 + §4 #7: `lib/env.ts:85` calls `required('NOTION_API_KEY')`. If unset, the workspace overview throws 500. Fix recommended in audit Group E item 10 was not in the overnight commit log; this remains open. Pilot deploy must set `NOTION_API_KEY` (real or `BRIEFINGS_PROVIDER=test`).

**Best fix:** wrap the briefings fetch in try/catch → null, or default `BRIEFINGS_PROVIDER=test` in prod when no key is set. Either is half-day of work.

### S5 — Agents page is hardcoded to realty

Per 2026-05-17 audit §1 row 4b + §4 #5: `agents/page.tsx:12-20` lists a hardcoded realty fleet. A CPA or Law workspace sees realty agent slugs. **Mitigation in practice:** the pilot recommendation in §6 below is a realty customer, so this doesn't bite at launch — but it locks the pilot to realty.

**Best fix:** read from `lib/skills/registry.ts:SKILL_CATALOG` filtered by `workspace.vertical` (audit Group E item 11). Half-day.

### S6 — No customer-support tooling — first ticket lands on Conner

There is no in-app support widget, no help@agentplain.com routing, no escalation surface. First confused customer messages Conner directly via whatever channel he gave them.

**Best fix:** wire a `mailto:support@agentplain.com` (or Conner's address) into the workspace footer + onboarding done-state copy. Pre-flight a shared inbox or Front instance before pilot if pilot is expected to message often. Half-day for the wiring; the support inbox decision is Conner's.

### S7 — Knowledge substrate freshness is unverified

`docs/knowledge-substrate.md` + `docs/knowledge-seed-2026-05-14.md` exist; the knowledge MCP route is at `app/api/knowledge/mcp/route.ts`. Whether the seeded content is still authoritative for a realty pilot at 2026-05-18 (after the brand lock + pricing simplification) is `UNKNOWN` to this audit.

**Best fix:** before pilot, re-run a knowledge ingestion check — at minimum, query the knowledge MCP for "fair housing disclosure GA" + "what is my listing fee" + "tier pricing" and confirm the responses reflect *current* brand + pricing copy, not the 2026-05-12 single-tier surface.

### S8 — No production observability beyond Sentry alerting

Sentry runtime alerting landed via commit `2bb8e9e`. No additional dashboards, no Inngest run-rate alerting, no `WebhookEvent.processed=false` backlog alarm. A loop stall (e.g. LLM provider 500-ing for 30 min) would be invisible until a customer noticed.

**Best fix:** add an Inngest alert for `processWebhookEventFn` failure rate + a SQL-backed scheduled check that emails Conner if `count(WebhookEvent where processed=false and receivedAt < now() - interval '10 minutes') > 0`. Pre-pilot if pilot expects same-day responsiveness.

### S9 — Mail.Send is deliberately not in Outlook OAuth scopes — but customers may not understand

Per `outlook/oauth/callback/route.ts:166` + `project_no_outbound_architecture.md`: scope set is `Mail.Read Mail.ReadWrite offline_access` only. Drafts land in Outlook Drafts; the customer's own outbox sends. The onboarding copy hints at this (`onboarding/page.tsx:326-331`: *"Read-only on arrival — we watch for messages, you stay in control. We never send outbound on your behalf; your existing inbox handles every send."*), but no surface explains *where* the customer goes to find the drafted reply.

**Best fix:** add a "Where do my drafts live?" panel to the workspace overview or onboarding done-state — `Open Gmail Drafts → Filter by label "agentplain"` or equivalent. Half-day.

---

## 4. What's NOT blocking but matters

- **Logo v3 not picked.** Brand mark + tokens are locked per `project_brand_locked.md`; visual finalization is decoupled from product ship. Not a launch blocker. Track on the brand backlog.
- **SKILL.md voice patches not applied across the fleet.** Internal agent consistency. Doesn't surface to customers.
- **flatsbo is parked** pending Conner's Georgia license + counsel review per `project_agentplain_is_priority.md`. Independent of agentplain ship.
- **Idle/orphan tasks need triage.** Several "running parallel" task IDs from the morning rundown (`local_*`) — Outlook Phase B is the only one with a deliverable on a branch; Stripe E2E and Inngest cron are validated by code inspection. Recommend explicit close-out of orphan task IDs after pilot ships.
- **Some marketplace tiles are "coming-soon" (6 of 8).** Per `marketplace.ts:89-160`. Honest; will be the right framing if pilot customer asks. Not a blocker.

---

## 5. The minimum path to "yes you can sell this Monday"

Ordered. Owner per item. Cross-references active in-flight tasks where they exist. Per `feedback_no_pilot_deferral.md`: nothing here is "after pilot" — every item ships or is explicitly accepted as residual risk.

### Pre-flight (must clear before outbound)

| # | Item | Owner | Active task |
|---|---|---|---|
| 1 | Conner connects his own Gmail to a fresh production workspace, fires a test email, observes loop fire end-to-end (`WebhookEvent` → cron → `HandoffLogEntry` → Gmail Draft). Closes S1. | **Conner** + fleet (Conner clicks; fleet watches logs) | Inngest cron resurrection (running) — this validation closes it. |
| 2 | Run `scripts/stripe/setup-products.ts` against live Stripe if not done; complete one $1 test purchase end-to-end. Confirm Subscription.status flips. Closes S2. | **Conner** (test card) + `b2b-eng-backend` (verification) | Stripe E2E (running) |
| 3 | Set `NOTION_API_KEY` (or `BRIEFINGS_PROVIDER=test`) in Vercel prod env. Closes S4. | **Conner** (env var) | none in flight |
| 4 | Add support email to workspace footer + onboarding done-state. Closes S6 wiring half. | Fleet (`flatsbo-eng-frontend` analogue on agentplain) | none in flight; spawn task |
| 5 | Knowledge MCP smoke test on three queries (fair housing, listing fee, tier pricing). If stale, re-seed. Closes S7. | Fleet (knowledge substrate owner) | none in flight; spawn task |
| 6 | Decide: gate pilot to Gmail OR merge `feat/outlook-mcp-phase-b-2026-05-18` (commit `8aa8ed5`). **Recommend Gmail-gate** for V1. Closes S3 for V1 scope. | **Conner** (decision) | Outlook MCP Phase B (running, on branch) |

### Should-ship-this-week (residual risk if deferred — Conner accepts explicitly)

| # | Item | Owner |
|---|---|---|
| 7 | Inngest backlog alarm (`WebhookEvent processed=false older than 10 min`). Closes S8. | Fleet |
| 8 | Vertical-aware agents page from `SKILL_CATALOG`. Closes S5 properly. | Fleet |
| 9 | "Where do my drafts live?" panel on workspace overview. Closes S9. | Fleet |
| 10 | Outlook Phase B merge (commit `8aa8ed5`) — moves us from Gmail-only to Gmail-or-Outlook. Closes S3 fully. | Fleet (after pilot select) |

**If items 1-6 land before outbound goes out**, the system is safer than 95% of B2B SaaS launches at the same revenue stage. Items 7-10 ship in the first week of pilot — they are not residual risk, they're real engineering with a real deadline.

---

## 6. Recommended pilot customer profile

Per `feedback_no_new_verticals_finish_locked.md`: finish the realty pilot before opening any other vertical. The recommendation below is locked by that rule, not chosen freshly.

### Why realty

- **Only vertical marked `live` at sign-up.** Other 9 verticals show "early access" disclaimer (`SignUpForm.tsx:248-256` per 2026-05-17 audit).
- **Strongest compliance corpus.** `lib/agents/sentinel/` carries 50+ realty-specific rules (per audit §2). Other verticals are placeholder or partial.
- **Most-tested skills.** `lib/skills/registry.ts` exposes `invoice-chasing-realestate`, `lead-triage-realestate`, plus `month-end-close-cpa`. Two of three are realty.
- **Lowest customer surprise if loop misfires.** A misfile on a buyer-inquiry reply is recoverable (broker re-drafts, sends from Gmail Drafts). A misfile in CPA workflow (close-out, journal entry) is more sensitive.
- **Conner's own network is strongest here.** Georgia real-estate via the flatsbo network.

### ICP for pilot customer #1

- **Single human, owner-operator broker** (not an MLS-wide brokerage; not a franchise office).
- **Brokerage size: 3-15 agents.** Per `b2b-head-of-realty` skill description: 3-30 is the broader ICP; 3-15 is the safer-to-support subset for #1.
- **Vertical:** real-estate (locked).
- **Email provider:** Gmail (Google Workspace). This is the constraint that lets us defer S3 / Outlook Phase B.
- **Geography:** **Georgia, metro Atlanta.** Two reasons: (1) Conner's local network + the flatsbo broker relationships overlap there; (2) Anthropic-tour cities are a fallback if Atlanta doesn't yield a candidate (per `flatsbo-chief-of-staff` skill description note about Anthropic-tour cities).
- **Posture:** owner has explicitly complained about email triage / lead routing eating their day, and currently has no agent suite they pay for. (If they're already on Lofty / Sierra / BoldTrail / Follow Up Boss, that's a "compete vs. coexist" conversation we don't want at launch — defer those prospects to V2.)
- **Compliance posture:** Georgia broker-of-record, license active, no active disclosure complaints. (One bad GREC review during pilot would distort signal.)

### Relationship pattern, not draft outreach

Per `project_no_outreach_drafts_until_ready.md` (and the constraint in the prompt): no prospect emails drafted here. The **pattern** for relationship-tier intro:

- **Source:** warm intro from a flatsbo seller relationship, an Atlanta SaaS founder Conner already trusts, or a referral from the GREC-licensed broker network Conner is plugged into. **Not cold outbound.**
- **Vehicle:** in-person coffee or a Zoom Conner sets up himself, not a sequencing tool.
- **Frame:** "I'm building a service-partnership product that watches your inbox and drafts replies for your review. I want you to be the first paying customer for the same price I'll charge the next ten. Will you let me walk you through it?" — that is a *framing prompt for Conner*, not a copy draft.
- **Ask:** 30 days at Regular tier ($99/seat at the smallest seat band), Conner-supported through onboarding, monthly debrief, the customer keeps every reply they don't approve.

The first-paying-customer conversation is **Conner's** — not the fleet's — per `project_no_outreach_drafts_until_ready.md` and the no-pilot-deferral rule above. Once that customer is happy at 30 days, the next ten are pattern-fit prospects routed through the b2b sales subsystem.

---

## Appendix — citations cross-reference

- `app/api/inngest/route.ts:29` — `processWebhookEventFn` registered (Wave A1, commit `c1e7485`)
- `lib/inngest/functions/process-webhook-event.ts:42,158` — 5-min cron + on-demand trigger
- `lib/skills/persist-artifacts.ts:86,95-100` — handoff + approval writers
- `app/(product)/app/workspace/[id]/approvals/{page,actions,ApprovalsList}.tsx` — approve/edit/reject UI + actions
- `app/(product)/app/verify/route.ts:35-64` — Route Handler (digest 2234350772 fix)
- `app/(product)/app/actions.ts:35-102` — signUpAction + tier defense-in-depth
- `app/(product)/app/workspace/[id]/onboarding/page.tsx:67,122-123,380-396` — service-partner intro + integration CTA (orphan closed)
- `app/api/integrations/outlook/oauth/callback/route.ts:84-339` — M365 OAuth completes
- `feat/outlook-mcp-phase-b-2026-05-18` @ `8aa8ed5` — Outlook webhook + subscription + adapter (unmerged)
- `app/api/webhooks/google/route.ts:35-140` — Pub/Sub receiver
- `app/api/stripe/webhook/route.ts:23-64` + `lib/billing/webhook-dispatch.ts:44-82,113-` — Stripe webhook idempotent dispatch
- `lib/billing/stripe-provider.ts:41,62-75` — Stripe API version `2026-04-22.dahlia` pinned (commit `9ab106a`)
- `agentplain.com` HTTP 200 on `/`, `/app/sign-up`, `/pricing` (2026-05-18 19:25 UTC), brand-locked copy ("Intelligence rooted", "local businesses") confirmed on homepage
- `docs/overnight-product-build-handoff-2026-05-18.md` — Wave-by-wave shipped status + screenshot gallery
- `docs/product-readiness-audit-2026-05-17.md` — prior audit, gate-table grounding

Per `feedback_persistence_discipline.md`: this artifact lives on disk; it is not the conversation that surfaced it.
