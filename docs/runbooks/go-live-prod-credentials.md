# Go-live: production credentials for self-serve operation

**Audience:** Conner. Copy-paste runbook to flip agentplain from
*code-ready* to *live, customer-operable, no-human-in-the-loop* by setting
prod credentials only — no feature-code changes.

**Source of truth for env var names:** [`lib/env.ts`](../../lib/env.ts).
Every variable below cites the file:line where it is read. If a name in
this doc disagrees with `lib/env.ts`, **`lib/env.ts` wins.**

**Companion audit:** [`docs/self-serve-readiness-2026-05-27.md`](../self-serve-readiness-2026-05-27.md)
(PR #97) enumerates the load-bearing unlocks below with the same file:line
cites.

**Done =** a test customer can sign up, connect Gmail, see the loop produce
an approval-queue item, and add a card — with **nobody at agentplain
involved**.

---

## Order of operations

Set values top-to-bottom — each block makes the next one runnable:

1. **Table-stakes app config so signup works at all:** `ENCRYPTION_KEY`,
   `DATABASE_URL` + `DATABASE_URL_DIRECT`, `SESSION_PASSWORD`,
   `RESEND_API_KEY`.
2. **Cron + LLM so the loop runs:** `INNGEST_EVENT_KEY` +
   `INNGEST_SIGNING_KEY`, `ANTHROPIC_API_KEY`.
3. **Customer connect surfaces:** Google OAuth + Pub/Sub, Microsoft OAuth +
   Graph webhook secret.
4. **Billing on real cards:** `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`,
   then `npx tsx scripts/stripe/setup-products.ts` against live.
5. **Lower-priority connectors when needed:** DocuSign, QuickBooks, Slack
   (and Drive, which reuses Google).

`SENTRY_DSN` is optional but recommended before opening to a real
customer — without it cron failures are invisible
([`lib/env.ts:209-219`](../../lib/env.ts)).

---

## Vercel env-tier discipline (read once, applies to every block)

Per [`feedback_no_prod_secrets_in_dev`](../../) (referenced inline at
`lib/env.ts:5,76,117-118,131-133,154,201,207-208` and in
[`docs/operator-integrations-setup.md`](../operator-integrations-setup.md)
Step 7):

- **Production secrets go in Vercel → Project → Settings → Environment
  Variables, scoped to `Production` only.** Never check the
  `Preview` / `Development` boxes for a `sk_live_…`, prod Google OAuth
  client, prod Azure secret, or prod `ENCRYPTION_KEY`.
- **Preview / Development tiers get separate, dev-tier credentials** from
  the same vendor (sandbox keys, dev OAuth clients, separate Pub/Sub
  topics) — or no value at all if the surface degrades cleanly.
- **`ENCRYPTION_KEY` is different per env.** Losing it = stored OAuth
  tokens unreadable. ([`docs/operator-integrations-setup.md:127`](../operator-integrations-setup.md))

When this doc says "set in Vercel," it means **Production scope only**
unless explicitly noted.

---

## 0. Table-stakes app config

These are required for any deploy to boot and for signup to issue magic
links. Set them first.

### `ENCRYPTION_KEY` — 64-char hex

- **What it does:** encrypts OAuth tokens at rest. Without it, every
  decryption path throws and the loop silently fails. Required:
  [`lib/env.ts:144`](../../lib/env.ts).
- **Generate the value:**
  ```bash
  openssl rand -hex 32
  ```
  (PowerShell alternative documented at
  [`docs/operator-integrations-setup.md:238-240`](../operator-integrations-setup.md).)
- **Set in:** Vercel → Production. Different value per env. Never reused,
  never rotated without a credential re-encrypt plan.
- **Verify:** after setting, deploy and visit `/api/health` — should
  return 200. Then connect any OAuth provider end-to-end (Section 3
  below); if `ENCRYPTION_KEY` is wrong, the token persistence step throws
  `encryption_key_unavailable`.

### `DATABASE_URL` + `DATABASE_URL_DIRECT`

- **What they do:** pooled (`DATABASE_URL`) for app runtime; direct
  (`DATABASE_URL_DIRECT`) for `prisma migrate deploy`, which pooled
  connections cannot run. Required:
  [`lib/env.ts:70`](../../lib/env.ts), [`lib/env.ts:77`](../../lib/env.ts).
- **Where to obtain:** Neon Console → Project → Branches → Production
  branch → "Connection details". Copy both the **Pooled** and
  **Direct** strings. [VERIFY: confirm Neon's current UI label —
  standard vendor flow.]
- **Set in:** Vercel → Production. Preview can use a separate Neon
  branch's connection strings; never default `DATABASE_URL_DIRECT` to
  `DATABASE_URL` (the env getter explicitly throws — see
  [`lib/env.ts:74-77`](../../lib/env.ts)).
- **Verify:** Vercel deploy logs show `prisma migrate deploy` runs and
  reports `No pending migrations`. Visit `/api/health` → 200.

### `SESSION_PASSWORD`

- **What it does:** iron-session seal secret for the auth cookie and the
  OAuth-state cookie. Required: [`lib/env.ts:55`](../../lib/env.ts).
- **Generate the value:**
  ```bash
  openssl rand -hex 32
  ```
- **Set in:** Vercel → Production. **Do not rotate** without invalidating
  all sessions; rotating logs every customer out.
- **Verify:** sign up at `https://agentplain.com/app/sign-up` — magic
  link arrives and verify completes (this also exercises Resend below).

### `RESEND_API_KEY`

- **What it does:** delivers magic-link emails, trial-warning emails,
  support routing emails. Required:
  [`lib/env.ts:80`](../../lib/env.ts). Without it signup never completes.
- **Where to obtain:** Resend Dashboard → API Keys → "Create API Key".
  Production scope; sender domain `agentplain.com` must be verified
  (DNS records).
- **Set in:** Vercel → Production. `RESEND_FROM_EMAIL` defaults to
  `agentplain <claude@agentplain.com>` ([`lib/env.ts:82`](../../lib/env.ts))
  — override only if you ship from a different mailbox.
- **Verify:** sign up at `/app/sign-up` with a real email you control.
  Magic-link arrives within seconds. Resend Dashboard → Logs shows the
  send.

---

## 1. Inngest — `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`

Without these, the 5-minute drain cron and the trial-expiration cron
never fire in prod; the loop stops at "`WebhookEvent` row persisted,
never processed."

- **Env vars (read at):** [`lib/env.ts:92`](../../lib/env.ts) +
  [`lib/env.ts:93`](../../lib/env.ts). Note: these are read via
  `optional()` (not `required()`) because local dev auto-detects the
  Inngest dev server and signing is a no-op there
  ([`lib/env.ts:89-91`](../../lib/env.ts)). Production needs both set —
  the cron is the only thing draining `WebhookEvent` rows.
- **Where to obtain:** Inngest Cloud Dashboard → Manage → **Event keys**
  (event key) and → **Signing keys** (signing key). [VERIFY: confirm
  current Inngest UI labels — standard vendor flow.] Also cited at
  [`docs/billing/SETUP.md:21-22`](../billing/SETUP.md).
- **Set in:** Vercel → Production.
- **Webhook to register with Inngest:** Inngest Dashboard → "Apps" →
  point at `https://agentplain.com/api/inngest` (the serve route
  registered at [`app/api/inngest/route.ts:15,26`](../../app/api/inngest/route.ts)).
  [VERIFY: register app via Inngest's current UI — standard vendor flow.]
- **Verify:**
  1. Inngest Dashboard → Functions — list shows
     `agentplain-process-webhook-event`,
     `agentplain-trial-warnings`, and any other registered functions.
  2. Connect Gmail (Section 3), send yourself an email, wait ≤5 min.
  3. Visit `/app/workspace/<id>` — the inbox shows a real
     `WorkApprovalQueueItem`, not the demo `LoopPreview` empty-state.

---

## 2. `ANTHROPIC_API_KEY`

- **What it does:** drives every drafting / categorize / coordinate /
  schedule step in the skill chain. Read directly from `process.env` at
  [`lib/llm/index.ts:45`](../../lib/llm/index.ts) (not via
  `lib/env.ts`). Without it the chain falls back to the heuristic
  `TestLlmProvider` and drafts will be unusable — set this **before**
  any real customer touches the system.
- **Where to obtain:** Anthropic Console → Settings → API Keys → "Create
  Key". [VERIFY: standard vendor flow.]
- **Set in:** Vercel → Production.
- **Verify:** after Section 3 (Google/MS) is wired, send yourself an
  email at the connected account. Within 5 minutes a draft appears in
  the approval queue; the draft body is coherent prose (Claude), not
  the canned heuristic output.

---

## 3. Google OAuth (Gmail + Drive) + Pub/Sub push

Unlocks the Gmail + Drive marketplace tiles **and** the inbound value
loop on Google accounts.

### Env vars

| Variable | Read at | Notes |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | [`lib/env.ts:122`](../../lib/env.ts) | Step 4 below |
| `GOOGLE_OAUTH_CLIENT_SECRET` | [`lib/env.ts:123`](../../lib/env.ts) | Step 4 below |
| `GOOGLE_PUBSUB_TOPIC` | [`lib/env.ts:124`](../../lib/env.ts) | Full name `projects/<project-id>/topics/gmail-pushes` |
| `GMAIL_WEBHOOK_OIDC_AUDIENCE` | [`lib/env.ts:125`](../../lib/env.ts) | `https://agentplain.com/api/webhooks/google` |
| `GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL` | [`lib/env.ts:126`](../../lib/env.ts) | The service account on the Pub/Sub push subscription |

### Vendor console — Google Cloud Console

1. **Create the project** (`agentplain-prod` — separate from any preview
   project per the env-tier rule).
2. **Enable APIs:** Gmail API, Cloud Pub/Sub API, Google Drive API. [VERIFY:
   standard vendor flow.]
3. **OAuth consent screen** — External; app name `agentplain`; authorized
   domain `agentplain.com`; scopes `openid`, `email`, `profile`,
   `https://www.googleapis.com/auth/gmail.readonly`,
   `https://www.googleapis.com/auth/drive.file`,
   `https://www.googleapis.com/auth/drive.readonly`.
4. **OAuth Client ID** (Web application). Authorized redirect URIs (paths
   derived from
   [`lib/integrations/oauth-urls.ts:42,65`](../../lib/integrations/oauth-urls.ts)
   and [`app/api/auth/oauth/google/connect/route.ts:84`](../../app/api/auth/oauth/google/connect/route.ts)):
   - `https://agentplain.com/api/auth/oauth/google/callback` (Gmail)
   - `https://agentplain.com/api/integrations/google-drive/oauth/callback` (Drive)
5. **Pub/Sub topic** `gmail-pushes`. Grant
   `serviceAccount:gmail-api-push@system.gserviceaccount.com` the
   `roles/pubsub.publisher` role.
6. **Push subscription** `gmail-pushes-agentplain`:
   - Push endpoint: `https://agentplain.com/api/webhooks/google`
     (receiver: [`app/api/webhooks/google/route.ts`](../../app/api/webhooks/google/route.ts))
   - OIDC authentication: ON. Service account: a dedicated
     `pubsub-pusher@<project-id>.iam.gserviceaccount.com`.
   - Audience: `https://agentplain.com/api/webhooks/google` (must equal
     `GMAIL_WEBHOOK_OIDC_AUDIENCE`).

Detailed click-through: [`docs/operator-integrations-setup.md`](../operator-integrations-setup.md) Steps 1-6.

### Set in Vercel

All five Google env vars → **Production scope only**.

### Verify

1. Sign in as the operator account (allowlisted via
   `OPERATOR_EMAIL_ALLOWLIST` —
   [`lib/env.ts:110`](../../lib/env.ts)) and connect Gmail through a
   test workspace's integrations page.
2. Send yourself an email at the connected Google address.
3. Within ≤30 s a `WebhookEvent` row is written (visible in the operator
   panel); within ≤5 min an approval-queue item appears in
   `/app/workspace/<id>` (requires Section 1 Inngest).
4. Disconnect → reconnect Gmail — Drive marks "connected" too (shared
   credential, expected per
   [`docs/integrations-setup-docusign-qbo-drive-slack.md:122-126`](../integrations-setup-docusign-qbo-drive-slack.md)).

---

## 4. Microsoft OAuth (Outlook / Teams / OneDrive / Excel) + Graph webhook secret

### Env vars

| Variable | Read at | Notes |
|---|---|---|
| `MICROSOFT_OAUTH_CLIENT_ID` | [`lib/env.ts:134`](../../lib/env.ts) | Azure App registration → Application (client) ID |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | [`lib/env.ts:135`](../../lib/env.ts) | Azure → Certificates & secrets → client secret value |
| `MICROSOFT_OAUTH_AUTHORITY` | [`lib/env.ts:136-137`](../../lib/env.ts) | Defaults to `https://login.microsoftonline.com/common`. Override only for single-tenant lockdown. |
| `MICROSOFT_WEBHOOK_CLIENT_STATE` | [`lib/env.ts:143`](../../lib/env.ts) | 32-byte random hex. Echoed back on every Graph notification — forging requires knowing this secret. |

### Vendor console — Azure Portal / Microsoft Entra

1. **App registration** — multi-tenant + personal Microsoft accounts
   (the `/common` authority); name `agentplain-prod`. [VERIFY: standard
   vendor flow in entra.microsoft.com.]
2. **Redirect URIs** (Web), both required (paths derived from
   [`lib/integrations/oauth-urls.ts:133,160`](../../lib/integrations/oauth-urls.ts)):
   - `https://agentplain.com/api/integrations/outlook/oauth/callback`
   - `https://agentplain.com/api/integrations/microsoft/oauth/callback`
     (shared callback for Teams / OneDrive / Excel)
3. **Client secret** under Certificates & secrets → New client secret
   (24-month expiry; set a rotate reminder).
4. **API permissions (Delegated):** `Mail.Read`, `Mail.ReadWrite`,
   `offline_access`, `openid`, `email`, `profile`. **Do NOT add
   `Mail.Send`** — `project_no_outbound_architecture.md`.
5. **Generate `MICROSOFT_WEBHOOK_CLIENT_STATE`:**
   ```bash
   openssl rand -hex 32
   ```

Detailed click-through:
[`docs/operator-integrations-setup.md`](../operator-integrations-setup.md)
Steps 1-5 (Microsoft section, lines 167-267).

### Microsoft Graph webhook URL

Graph subscriptions are created from inside the app at connect time;
the `notificationUrl` they register is
`https://agentplain.com/api/webhooks/microsoft`
(receiver: [`app/api/webhooks/microsoft/route.ts`](../../app/api/webhooks/microsoft/route.ts)).
No console step needed — but the URL must be reachable over public
HTTPS, which is why local dev tunnels through ngrok / cloudflared
([`docs/operator-integrations-setup.md:265-267`](../operator-integrations-setup.md)).

### Set in Vercel

All four MS env vars → **Production scope only**.

### Verify

1. Connect Outlook on a test workspace's integrations page.
2. Microsoft consent screen displays `agentplain` + the requested
   delegated permissions. Approve → land on
   `/app/workspace/<id>/integrations?connected=outlook`.
3. Send yourself an email at the connected mailbox. Within ≤5 min an
   approval-queue item appears (same loop as Gmail).
4. After Outlook connects, the Teams / OneDrive / Excel tiles light up
   (same OAuth app, shared M365 credential row).

---

## 5. Stripe live — billing on real cards

Unlocks link 5 (billing) entirely.

### Env vars

| Variable | Read at | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | [`lib/env.ts:86`](../../lib/env.ts) | `sk_live_…` in Production. `sk_test_…` everywhere else. |
| `STRIPE_WEBHOOK_SECRET` | [`lib/env.ts:87`](../../lib/env.ts) | Different value per env. |

No `STRIPE_PRICE_*` env vars — Prices are resolved by `lookup_key`
([`lib/pricing/tiers.ts`](../../lib/pricing/tiers.ts) +
[`docs/billing/SETUP.md:24-26`](../billing/SETUP.md)).

### Vendor console — Stripe Dashboard

1. **API keys:** Stripe Dashboard → Developers → API keys → reveal the
   live secret key. [VERIFY: standard vendor flow.]
2. **Webhook endpoint:** Stripe Dashboard → Developers → Webhooks → Add
   endpoint
   ([`docs/billing/SETUP.md:63-80`](../billing/SETUP.md)):
   - URL: `https://agentplain.com/api/stripe/webhook`
     (receiver: [`app/api/stripe/webhook/route.ts`](../../app/api/stripe/webhook/route.ts))
   - API version: `2026-04-22.dahlia`
     (pinned in [`lib/billing/stripe-provider.ts`](../../lib/billing/stripe-provider.ts))
   - Events: `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.trial_will_end`, `invoice.created`,
     `invoice.finalized`, `invoice.paid`,
     `invoice.payment_succeeded`, `invoice.payment_failed`,
     `invoice.voided`.
3. **Reveal signing secret** → that's `STRIPE_WEBHOOK_SECRET`.

### Set in Vercel

Both Stripe env vars → **Production scope only**. Preview / Development
get `sk_test_…` + the dashboard's test-mode webhook secret instead.

### Provision Products + Prices (one-time, idempotent)

```bash
# Dry-run first
STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/stripe/setup-products.ts --dry-run

# Apply
STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/stripe/setup-products.ts
```

Script: [`scripts/stripe/setup-products.ts`](../../scripts/stripe/setup-products.ts).
End state in Stripe: **3 Products** (Regular / Partner / Max) × **5
seat bands** = **15 Prices**, named
`agentplain_<tier>_seats_<band>_monthly`
([`docs/billing/SETUP.md:46-56`](../billing/SETUP.md)).

Re-run safely whenever pricing tiers change — old Prices get archived,
new ones reclaim the lookup_key.

### Verify

1. Sign up a fresh test customer at `/app/sign-up`. No card requested
   (trial-period-days = 30,
   [`lib/billing/stripe-provider.ts:128-146`](../../lib/billing/stripe-provider.ts)).
2. Visit `/app/workspace/<id>/settings/billing` — banner reads "Trial
   ends in 30 days" + an "Add payment method" CTA.
3. Click "Add payment method" → Stripe Checkout opens in **setup mode**.
   Use a real card (or test card if still on `sk_test_…`); Checkout
   completes.
4. Return to billing → CTA flips to "Update payment method" once Stripe
   fires `customer.subscription.updated` through the webhook
   (idempotency guard verified: re-triggering returns
   `{received: true, duplicate: true}`,
   [`docs/billing/SETUP.md:102-103`](../billing/SETUP.md)).
5. Stripe Dashboard → Customers shows the new customer with one
   subscription + one PaymentMethod.

---

## 6. Lower-priority connectors (DocuSign / QuickBooks / Slack)

Same shape as Google/Microsoft. Per the readiness audit's unlock list,
these are lower priority than Google + MS because the V1 value loop is
email-shaped. Full per-vendor walk-throughs already exist at
[`docs/integrations-setup-docusign-qbo-drive-slack.md`](../integrations-setup-docusign-qbo-drive-slack.md);
**use those as the source of truth — this section is the index.**

| Provider | Env vars (read at `lib/env.ts:line`) | Redirect URI to register | Webhook URL |
|---|---|---|---|
| **DocuSign** | `DOCUSIGN_OAUTH_CLIENT_ID` (155), `DOCUSIGN_OAUTH_CLIENT_SECRET` (156), `DOCUSIGN_OAUTH_BASE_URI` (157-158, defaults `account-d.docusign.com`), `DOCUSIGN_CONNECT_HMAC_KEY` (162) | `https://agentplain.com/api/integrations/docusign/oauth/callback` (path from [`lib/integrations/oauth-urls.ts:81`](../../lib/integrations/oauth-urls.ts)) | DocuSign Connect → `https://agentplain.com/api/integrations/docusign/connect` (path from [`app/api/integrations/docusign/oauth/callback/route.ts:175`](../../app/api/integrations/docusign/oauth/callback/route.ts)) |
| **QuickBooks Online** | `QUICKBOOKS_OAUTH_CLIENT_ID` (171), `QUICKBOOKS_OAUTH_CLIENT_SECRET` (172), `QUICKBOOKS_ENVIRONMENT` (173-174, `sandbox` default; flip to `production` for live realmIds) | `https://agentplain.com/api/integrations/quickbooks/oauth/callback` (path from [`lib/integrations/oauth-urls.ts:99`](../../lib/integrations/oauth-urls.ts)) | n/a (poll-based) |
| **Slack** | `SLACK_OAUTH_CLIENT_ID` (181), `SLACK_OAUTH_CLIENT_SECRET` (182) | `https://agentplain.com/api/integrations/slack/oauth/callback` (path from [`lib/integrations/oauth-urls.ts:116`](../../lib/integrations/oauth-urls.ts)) | n/a (poll-based) |
| **Google Drive** | none new — reuses `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` from Section 3 | `https://agentplain.com/api/integrations/google-drive/oauth/callback` (path from [`lib/integrations/oauth-urls.ts:65`](../../lib/integrations/oauth-urls.ts)) | n/a |

All four — once configured — light up the corresponding marketplace
tile and self-serve via the same `/api/integrations/[id]/oauth/start`
route ([`app/api/integrations/[integrationId]/oauth/start/route.ts`](../../app/api/integrations/[integrationId]/oauth/start/route.ts))
that Google + Microsoft use. The approval-gated action set
(`record_payment`, `share_file`, `post_message`, `send_dm`) is enforced
in code regardless of who connected
([`docs/integrations-setup-docusign-qbo-drive-slack.md:162-174`](../integrations-setup-docusign-qbo-drive-slack.md)).

---

## 7. Optional: observability — `SENTRY_DSN`

- **What it does:** activates Sentry as the observability provider.
  Without it, [`env.observabilityProvider()`](../../lib/env.ts) falls
  through to noop ([`lib/env.ts:209-219`](../../lib/env.ts)) and cron
  failures are invisible.
- **Env vars (read at):**
  - `SENTRY_DSN` → [`lib/env.ts:220`](../../lib/env.ts)
  - `NEXT_PUBLIC_SENTRY_DSN` → [`lib/env.ts:224`](../../lib/env.ts)
    (public, can equal `SENTRY_DSN`; kept separate so client-side can be
    disabled independently)
  - `SENTRY_ENVIRONMENT` → [`lib/env.ts:225-229`](../../lib/env.ts)
    (defaults to `VERCEL_ENV`)
- **Where to obtain:** Sentry Dashboard → Projects → agentplain → Client
  Keys (DSN). [VERIFY: standard vendor flow.]
- **Set in:** Vercel → Production initially per the env-tier rule
  ([`lib/env.ts:207-208`](../../lib/env.ts)).
- **Verify:** trigger an error in a cron (or `throw` once from a feature
  branch deploy) → event lands in Sentry within seconds tagged with
  the `VERCEL_GIT_COMMIT_SHA` as release
  ([`lib/env.ts:232-233`](../../lib/env.ts)).

---

## Final acceptance — the only test that matters

A test customer, with **nobody at agentplain touching anything**:

1. Visits `https://agentplain.com/app/sign-up`, enters a real email.
2. Verifies the magic-link, lands in their workspace.
3. Clicks "Connect Gmail" on the integrations tile, completes Google
   consent, lands back on `?connected=…`.
4. Sends an email into the connected mailbox.
5. Within ≤5 min sees a real approval-queue item on `/app/workspace/<id>`
   with a Claude-drafted reply.
6. Visits `/app/workspace/<id>/settings/billing`, clicks "Add payment
   method", completes Stripe Checkout, sees the card on file.

If all six work without you opening the operator panel, **the
go-live is done.**

---

## Honesty register — what was not verified end-to-end while writing this

Marked inline as `[VERIFY]`. Concretely:

- Vendor-console click-paths are described at the level of "where to
  look" (e.g. "Stripe Dashboard → Developers → API keys"), not as
  step-by-step button labels — those drift between vendor UI versions.
  Treat them as the standard vendor flow; verify the exact widget
  position in the vendor's current UI.
- The Microsoft Graph webhook receiver
  ([`app/api/webhooks/microsoft/route.ts`](../../app/api/webhooks/microsoft/route.ts))
  was flagged `[UNVERIFIED]` in the
  [readiness audit](../self-serve-readiness-2026-05-27.md); this runbook
  inherits that flag. The validation-handshake behavior described at
  [`docs/operator-integrations-setup.md:296-300`](../operator-integrations-setup.md)
  is the documented contract.
- Neon's "Pooled" / "Direct" connection-string UI label is current as
  of [`reference_vercel_neon_setup`](../../) at time of writing —
  `[VERIFY]` against today's Neon console UI.

Every env var name in this doc was cross-checked against
[`lib/env.ts`](../../lib/env.ts) by reading the file. If a name here is
wrong, that file is the truth and this doc is the bug.
