# Self-serve readiness audit — 2026-05-27

**Question:** What stands between a customer running end-to-end with **zero
agentplain human in the loop**?

**North star:** A managed service the fleet operates — not a DIY tool. The
"human in the loop" we care about is **on agentplain's side**: a customer
can sign up, connect a tool, watch the loop run, get billed, and get help,
without anyone at agentplain touching their workspace.

**Scope rules:** every claim cites a file:line in this repo. Subagent / grep
output verified by reading the file directly. `[UNVERIFIED]` tags anything
not anchored to a read.

---

## Per-link verdict table

| # | Link | Works no-human today? | Precise blocker / control point | Classification |
|---|------|----------------------|---------------------------------|----------------|
| 1 | Signup → branded workspace | **YES** | Self-serve action `signUpAction` (`app/(product)/app/actions.ts:35`) → `signUpBrokerOwner` creates User + Workspace + Membership + OnboardingState + audit log in one tx (`lib/auth/flows.ts:70-189`), then provisions trial Stripe sub (`lib/billing/provisioning.ts:66-143`). Magic-link issued (`lib/auth/flows.ts:210-258`); verify route writes session and redirects straight to `/app/workspace/[id]` (`app/(product)/app/verify/route.ts:35-67`). No operator approval step in the path. | **DONE** |
| 2 | Connect integrations (OAuth) | **PARTIAL — gated on prod OAuth creds** | Code path is fully self-serve: tile click → `/api/integrations/[integrationId]/oauth/start` (`app/api/integrations/[integrationId]/oauth/start/route.ts:93-182`) → provider authorize → callback persists encrypted credential + creates webhook subscription (`app/api/auth/oauth/google/callback/route.ts:99-325`). UI gates each tile on `isIntegrationConfigured(entry)` (`app/(product)/app/workspace/[id]/integrations/page.tsx:79`) so unwired providers degrade to "your service partner wires it on the welcome call" instead of dead-ending (`app/(product)/app/workspace/[id]/onboarding/page.tsx:421-437`). Active providers (Google, M365, DocuSign, QuickBooks, Slack) defined in `lib/integrations/marketplace.ts:71-271`; configured-check in `lib/integrations/config-status.ts:37-59`. **Blocker is config, not code:** `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` (`lib/env.ts:122-123`), `MICROSOFT_OAUTH_CLIENT_ID` + `MICROSOFT_OAUTH_CLIENT_SECRET` (`lib/env.ts:134-135`), `DOCUSIGN_OAUTH_CLIENT_*` (`lib/env.ts:155-156`), `QUICKBOOKS_OAUTH_CLIENT_*` (`lib/env.ts:171-172`), `SLACK_OAUTH_CLIENT_*` (`lib/env.ts:181-182`), plus `ENCRYPTION_KEY` (`lib/env.ts:144`) for token decryption, plus `GOOGLE_PUBSUB_TOPIC` + `GMAIL_WEBHOOK_OIDC_AUDIENCE` (`lib/env.ts:124-127`) and `MICROSOFT_WEBHOOK_CLIENT_STATE` (`lib/env.ts:143`) for inbound push. | **CONNER-ONLY** (per-provider OAuth app registration + Vercel env vars; the code is shipped) |
| 3 | Value loop on the connected account | **YES (once #2 unblocks)** | Push receivers persist `WebhookEvent` rows: Gmail (`app/api/webhooks/google/route.ts:36-161`), Microsoft (`app/api/webhooks/microsoft/route.ts` [UNVERIFIED — not read]). Inngest cron `*/5 * * * *` (`lib/inngest/functions/process-webhook-event.ts:54`) drains them through `runSkillChain` (`lib/skills/runner.ts:110-385`): read → office-admin classify → categorize → coordinate → schedule → draft → compliance scan → persist into `WorkApprovalQueueItem` via `persistSkillRunArtifacts`. Adapter picks the live credential: `GmailMessageAdapter` (`lib/skills/gmail-fetcher.ts:66-72`) and `OutlookMessageAdapter` (`lib/inngest/functions/process-webhook-event.ts:234-247`) instantiate against the workspace's stored OAuth row — **not seed/demo data**. The only "demo" surface is the empty-state `LoopPreview` shown when no handoffs exist yet, explicitly labeled "example · what lands here once mail flows" (`app/(product)/app/workspace/[id]/page.tsx:341-394`). What flips it from demo to live: `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (`lib/env.ts:92-93`) so the cron actually fires in prod, and `ANTHROPIC_API_KEY` (`lib/llm/index.ts:45-51`) — without it the chain falls back to the heuristic TestLlmProvider and drafts will be poor quality but the loop still runs end-to-end. | **CONNER-ONLY** (Inngest prod keys + Anthropic key; code is shipped) |
| 4 | Support | **NO** | Form at `/app/workspace/[id]/help` (`app/(product)/app/workspace/[id]/help/page.tsx:13-37`) submits to `submitSupportRequest` (`lib/support/index.ts:34-122`): persists a `SupportRequest` row, then emails `SUPPORT_EMAIL` (`lib/env.ts:194`, default `hello@agentplain.com`). The persisted email body itself points triage at `/operator/support` (`lib/support/index.ts:144,154`), which is the operator triage UI (`app/(operator)/operator/support/page.tsx:1`). **Every support request terminates at a human inbox today.** No fleet handler categorizes, drafts a reply, or auto-resolves. | **FLEET-BUILDABLE** (a fleet-side support skill that drafts the first-touch reply into an operator review queue is the leverage move) |
| 5 | Billing | **YES (once #2's `STRIPE_*` creds + `setup-products.ts` are run)** | Trial provisioned at signup (`lib/billing/provisioning.ts:66-143`) with `trial_period_days: 30` and `missing_payment_method: "pause"` (`lib/billing/stripe-provider.ts:128-146`) — no card required to start. Customer adds a card via `addPaymentMethodAction` → Stripe Checkout `mode=setup` (`app/(product)/app/workspace/[id]/settings/billing/actions.ts:45-60` → `lib/billing/stripe-provider.ts:226-257`). Plan/seat changes route through Stripe Checkout `mode=subscription` (`actions.ts:62-117`), portal at `openPortalAction` (`actions.ts:127-137`), cancellation at-period-end (`actions.ts:139-185`). Stripe webhook idempotently persisted at `app/api/stripe/webhook/route.ts:24-90`; dispatch in `lib/billing/webhook-dispatch.ts` [UNVERIFIED — not read]. Trial-end nudges fire on a daily cron (`lib/inngest/functions/trial-expiration-warnings.ts:33-100`). **Conner-only config:** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (`lib/env.ts:86-87`), and `npx tsx scripts/stripe/setup-products.ts` to provision the 3 Products × 5 seat bands (`docs/billing/SETUP.md:30-57`). Self-serve checkout is in code; Max tier deliberately routes to `/custom?type=max` (`actions.ts:73-78`) — quote-based by design, not a gap. | **CONNER-ONLY** (Stripe live keys + run setup script once; the code is shipped) |
| 6 | Data control (export + workspace-close) | **IN-PROGRESS** | Lib-layer teardown is shipped: `tearDownWorkspaceData` deletes all tenant rows (CUSTOMER knowledge + embeddings, approvals, handoffs, webhook events/subscriptions, integration credentials, preferences, inquiries) (`lib/customer-files/deletion.ts:248-312`). Per-integration disconnect with three-phase cleanup is live and customer-callable (`app/(product)/app/workspace/[id]/integrations/[integrationId]/actions.ts:39-151`). **What is NOT yet wired:** no customer-facing UI calls `tearDownWorkspaceData`; no `/export` route. Active branch `feat/customer-data-export-and-teardown-2026-05-27` (per `git branch -a`) is the in-flight PR Conner flagged. | **FLEET-BUILDABLE — already in flight** |

---

## Conner-only unlock list

The minimum set of prod config/secrets that — once set — flips the most
links from "code-ready" to "live, customer-operable":

1. **Stripe live mode** — `STRIPE_SECRET_KEY` (`sk_live_…`) + `STRIPE_WEBHOOK_SECRET` (`lib/env.ts:86-87`). Then run `npx tsx scripts/stripe/setup-products.ts` once against live (`docs/billing/SETUP.md:30-57`). **Unlocks link 5 (billing) entirely.**
2. **Google OAuth (Gmail + Drive)** — `GOOGLE_OAUTH_CLIENT_ID` + `GOOGLE_OAUTH_CLIENT_SECRET` (`lib/env.ts:122-123`), plus `GOOGLE_PUBSUB_TOPIC` + `GMAIL_WEBHOOK_OIDC_AUDIENCE` + `GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL` (`lib/env.ts:124-127`) for inbound push. **Unlocks the Gmail + Drive tiles in link 2 and the value loop on Google accounts (link 3).**
3. **Microsoft OAuth (Outlook + Teams + OneDrive/SharePoint + Excel)** — `MICROSOFT_OAUTH_CLIENT_ID` + `MICROSOFT_OAUTH_CLIENT_SECRET` (`lib/env.ts:134-135`) plus `MICROSOFT_WEBHOOK_CLIENT_STATE` (`lib/env.ts:143`). **Unlocks four marketplace tiles in link 2 and the value loop on M365 accounts (link 3).**
4. **`ENCRYPTION_KEY`** — 64-char hex, set in Vercel Production (`lib/env.ts:144`). Without it, every credential decryption path throws a "connection intact; access resumes once the key is restored" error (`lib/integrations/mcp-core/credential.ts:65`, etc.) and the loop in link 3 silently fails.
5. **Inngest prod keys** — `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (`lib/env.ts:92-93`). Without these, the 5-minute drain cron and the trial-expiration cron never fire; the loop in link 3 stops at "WebhookEvent persisted, never processed."
6. **`ANTHROPIC_API_KEY`** — (`lib/llm/index.ts:45-51`). Loop still runs without it but on the heuristic TestLlmProvider; drafts will be unusable. Set this **before** opening to a real customer.
7. **`RESEND_API_KEY`** — (`lib/env.ts:80`). Required for magic-link delivery; without it signup verify links never arrive.
8. **DocuSign / QuickBooks / Slack OAuth** — same shape as Google/Microsoft (`lib/env.ts:155-182`). Lower priority than Google/Microsoft since the V1 value loop is email-shaped.
9. **`SESSION_PASSWORD`** + `DATABASE_URL` + `DATABASE_URL_DIRECT` — table-stakes app config (`lib/env.ts:55,70-77`).
10. **`SENTRY_DSN`** — optional but recommended; without it `observabilityProvider()` falls through to noop (`lib/env.ts:209-219`) and cron failures are invisible.

**Items 1–6 are the load-bearing unlock.** Once those are set, links 1, 2 (Google + M365), 3, and 5 all run with zero agentplain human in the loop.

---

## Fleet-buildable backlog (ordered by leverage)

1. **Customer-facing workspace close + data export** — wire a UI surface to the already-shipped `tearDownWorkspaceData` (`lib/customer-files/deletion.ts:248`) and add a JSON-export route. Closes link 6. **In-flight on `feat/customer-data-export-and-teardown-2026-05-27`** — finish-line, not net-new.
2. **Fleet-side support handler** — today every support request terminates at the `hello@agentplain.com` inbox (`lib/support/index.ts:90-94`). Build an Office-Admin-style skill that reads inbound `SupportRequest` rows, drafts a first-touch reply into an operator review queue, and auto-resolves low-risk categories (password help, "where is X" navigation). Closes link 4 and is the single biggest "no human at agentplain" gap once items 1–6 of the unlock list are set.
3. **HubSpot + PayPal + Canva connectors** — three marketplace entries currently in `coming-soon` status (`lib/integrations/marketplace.ts:179-271`). Adding them widens the value loop's reach without changing its shape.
4. **Cursor-precise Gmail history walk** — Phase A fetcher lists `in:inbox` and takes the top 10 (`lib/skills/gmail-fetcher.ts:86-110`); Phase B's `users.history.list`-backed MCP tool is noted as deferred (file header comment, lines 25-34). Replay precision matters when a customer has a high-volume inbox or the loop falls behind.
5. **Microsoft Graph webhook route audit** — listed at `app/api/webhooks/microsoft/route.ts` but not read in this audit. [UNVERIFIED] that the M365 push path has parity with Gmail's verify→persist→ACK shape.

---

## Brand-name consistency check

The named character is consistent: every customer-facing surface that names
the service partner reads from `servicePartnerForWorkspace()`
(`lib/onboarding/service-partner.ts:28-32`), which returns `PLAINO_PARTNER.name`
= "Plaino". Verified at 22 call sites across `app/(product)/`,
`components/ui/ap/`, and `lib/auth/resend-provider.ts` (which signs magic-link
emails "Plaino, your service partner at agentplain", lines 31, 42).

Other "Sarah / James / Daniel / Emma / Maya / Owen" string matches in the
repo are NOT the partner — they are example customer / counterparty names in
test fixtures (`tests/`, `lib/skills/*/skill.test.ts`) and marketing-page
narrative copy (e.g. `lib/verticals/real-estate/content.ts:263` — Sarah is
the broker character in a scenario vignette, not the service partner). The
old name-pool (referenced in `service-partner.ts:5` as a historical note)
is removed.

**No customer-facing surface names the service partner anything other than Plaino.**

---

## What this audit deliberately did NOT verify

- The Microsoft webhook receiver (`app/api/webhooks/microsoft/route.ts`) was
  not opened — tagged `[UNVERIFIED]` above.
- The Stripe webhook dispatcher (`lib/billing/webhook-dispatch.ts`) was not
  opened — the route's idempotency + signature verify is verified; the
  per-event handlers (`invoice.paid`, `customer.subscription.updated`, etc.)
  are not.
- No runtime check that Vercel Production env vars are actually set. The
  audit reads the **code that requires them**; whether the value exists in
  Vercel is Conner's view to confirm.
- Test suite was not run as part of this audit.
