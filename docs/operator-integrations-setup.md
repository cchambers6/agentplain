# Operator: Google Cloud Project setup for agentplain Gmail integration

**Audience:** Conner. One-time setup before the first OAuth connect.
**Time:** ~25 min if Google Cloud Console is open already.
**Status:** PR-B operator surface ships behind these steps. PR-C
functional acceptance demo runs against your real `connerchambers6@gmail.com`
once these are wired.

## What this gets you

After all steps below complete:

- A Google Cloud Project that owns the OAuth client + Pub/Sub topic.
- A Pub/Sub topic `gmail-pushes` that Gmail Push posts to.
- A Pub/Sub push subscription `gmail-pushes-agentplain` that forwards
  every notification to `https://agentplain.com/api/webhooks/google`.
- Service-account-backed OIDC authentication on the push subscription
  so agentplain can verify Pub/Sub is who it claims to be.
- The env vars agentplain needs in Vercel.

## Step 1 — Create the Google Cloud Project

1. Open https://console.cloud.google.com.
2. New project: `agentplain-prod` (or `agentplain-preview` for the preview
   environment — see Step 7 for env-tier discipline).
3. Note the project id (e.g. `agentplain-prod-426119`). You'll paste it
   below.

## Step 2 — Enable the APIs

Enable in this project:

- **Gmail API** — https://console.cloud.google.com/apis/library/gmail.googleapis.com
- **Cloud Pub/Sub API** — https://console.cloud.google.com/apis/library/pubsub.googleapis.com

Both via "Enable" button in the console.

## Step 3 — Create the OAuth consent screen

Path: APIs & Services → OAuth consent screen.

- **User type:** External (start in Testing mode; production verification
  is a separate Google review step that happens after the first 100 users).
- **App name:** agentplain
- **User support email:** connerchambers6@gmail.com
- **Authorized domains:** agentplain.com
- **Developer contact:** connerchambers6@gmail.com
- **Scopes:** add
  - `openid`
  - `email`
  - `profile`
  - `https://www.googleapis.com/auth/gmail.readonly`
- **Test users:** add `connerchambers6@gmail.com` (and any other
  dogfood test accounts).

## Step 4 — Create the OAuth client

Path: APIs & Services → Credentials → "Create Credentials" → "OAuth client ID".

- **Application type:** Web application
- **Name:** `agentplain web (prod)` or `agentplain web (preview)`
- **Authorized redirect URIs:** add ALL of:
  - `https://agentplain.com/api/auth/oauth/google/callback` (production)
  - The Vercel Preview URL pattern, if you'll OAuth-test against preview
    (e.g. `https://agentplain-<preview-hash>.vercel.app/api/auth/oauth/google/callback`)
  - `http://localhost:3000/api/auth/oauth/google/callback` (local dev)

Note the **Client ID** and **Client secret**.

## Step 5 — Create the Pub/Sub topic + grant Gmail publish access

Path: Pub/Sub → Topics → "Create topic".

- **Topic id:** `gmail-pushes`
- The full topic name will be `projects/<your-project-id>/topics/gmail-pushes`.

Grant Gmail permission to publish to it. Per
https://developers.google.com/workspace/gmail/api/guides/push (read 2026-05-11):

```sh
gcloud pubsub topics add-iam-policy-binding gmail-pushes \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

(Or do it through the console: Topic → Permissions → Add principal →
`gmail-api-push@system.gserviceaccount.com` → role `Pub/Sub Publisher`.)

## Step 6 — Create the push subscription with OIDC authentication

Path: Pub/Sub → Subscriptions → "Create subscription".

- **Subscription id:** `gmail-pushes-agentplain`
- **Topic:** `gmail-pushes`
- **Delivery type:** Push
- **Push endpoint:** `https://agentplain.com/api/webhooks/google`
- **Enable authentication:** YES
- **Service account:** create a dedicated one if it doesn't exist
  (suggested: `pubsub-pusher@<your-project-id>.iam.gserviceaccount.com`),
  or pick an existing one.
- **Audience:** `https://agentplain.com/api/webhooks/google` (same as
  push endpoint).
- **Acknowledgement deadline:** 60 seconds (Pub/Sub default is 10; the
  agentplain handler writes a `WebhookEvent` row + ACKs fast, but
  give yourself headroom).
- **Message retention duration:** default (7 days).
- **Dead-letter topic:** optional but recommended; create
  `gmail-pushes-dlq` and configure 5 redelivery attempts.

The service account's email is what agentplain expects as the JWT `email`
claim during signature verification — save it for Step 7.

## Step 7 — Wire the env vars in Vercel

Path: Vercel → agentplain project → Settings → Environment Variables.

Per `feedback_no_prod_secrets_in_dev`: production tier values go in
Production only; preview gets a separate (preview-tier) Google Cloud Project.

| Variable | Value |
| --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` | Step 4 client id |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Step 4 client secret |
| `GOOGLE_PUBSUB_TOPIC` | `projects/<project-id>/topics/gmail-pushes` (full name) |
| `GMAIL_WEBHOOK_OIDC_AUDIENCE` | `https://agentplain.com/api/webhooks/google` (matches Step 6 audience) |
| `GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL` | Step 6 service account email |
| `ENCRYPTION_KEY` | 64-char hex; generate with `openssl rand -hex 32`. **Different value per env.** Loss = stored tokens unreadable. |

## Step 8 — Verify

1. Visit `https://agentplain.com/operator/integrations` while signed in
   as `connerchambers6@gmail.com` (or any user with `isOperator=true`).
2. If `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` are not set, the page shows a
   yellow banner. Set them and re-deploy if needed.
3. Pick a workspace under "Connect a workspace" and click "Connect Gmail →".
4. Google's consent screen should display the agentplain app + the
   `gmail.readonly` scope. Approve.
5. You land back on `/operator/integrations?connected=<credential-id>`.
   The credentials table shows a row with status `ACTIVE`; the
   subscriptions column shows one `ACTIVE` row.
6. Send yourself an email at `connerchambers6@gmail.com`. Within
   30 seconds, the "Recent webhook events" section shows a new row.

If anything fails, the redirect lands at
`/operator/integrations?error=<code>&detail=<short-detail>`. Common codes:

- `google_oauth_not_configured` — env vars missing (Step 7)
- `token_exchange_failed` — Step 4 redirect URI doesn't match the one the
  connect route used
- `subscription_failed` — Step 5 IAM binding missing, or Step 6 service
  account email mismatch
- `state_mismatch` — the OAuth state cookie expired; restart the flow

## Step 9 — After PR-C lands

PR-C wires the **read → categorize → coordinate → schedule → draft**
value loop on top of the `WebhookEvent` rows this PR-B plumbing
collects. Acceptance for the integration as a whole is a recorded
24-hour dogfood run against `connerchambers6@gmail.com` per
`feedback_integration_acceptance_is_functional.md`.

Until that lands, the `agent-state/integrations_audit_log.md` entry for
the integration reads `plumbing landed, behavior pending`.

---

# Operator: Microsoft (Azure) setup for agentplain Outlook integration

**Audience:** Conner. One-time setup before the first Outlook OAuth
connect.
**Time:** ~15 min if the Azure portal is open already (no Pub/Sub
equivalent — Graph pushes directly to our webhook URL).

## What this gets you

After all steps below complete:

- An Azure AD app registration that owns the OAuth client + the Graph
  subscription create permission.
- A redirect URI pointing at
  `https://agentplain.com/api/integrations/outlook/oauth/callback`.
- A delegated permission set (`Mail.Read`, `Mail.ReadWrite`,
  `offline_access`, `openid`, `email`, `profile`). **`Mail.Send` is
  intentionally omitted** per the no-outbound architecture.
- A 32-byte shared secret (`clientState`) that Graph echoes back on every
  webhook notification.
- The env vars agentplain needs in Vercel.

## Step 1 — Create the Azure AD app registration

1. Open https://entra.microsoft.com → Applications → App registrations.
2. New registration:
   - **Name:** `agentplain-prod` (or `agentplain-preview`)
   - **Supported account types:** "Accounts in any organizational
     directory (Any Microsoft Entra ID tenant — Multitenant) and personal
     Microsoft accounts". This is the `/common` authority — broadest
     audience, since Conner's M365 mailbox lives in one tenant but future
     customers will be in other tenants.
   - **Redirect URI:** Web → `https://agentplain.com/api/integrations/outlook/oauth/callback`.
     (Preview environment: also add the preview URL.)
3. Note the **Application (client) ID** and the **Directory (tenant) ID**.

## Step 2 — Create a client secret

Path: Certificates & secrets → "New client secret".

- **Description:** `agentplain-oauth`
- **Expires:** 24 months (set a calendar reminder to rotate).
- Copy the **Value** (not the Secret ID) — it's only shown once.

## Step 3 — Configure API permissions

Path: API permissions → "Add a permission" → "Microsoft Graph" →
"Delegated permissions".

Add:
- `Mail.Read`
- `Mail.ReadWrite`
- `offline_access`
- `openid`
- `email`
- `profile`

**Do NOT add `Mail.Send`** — agentplain's no-outbound rule means we never
want that grant.

If your tenant requires admin consent, click "Grant admin consent for
`<tenant>`" so the broker-owner can complete the connect flow without an
extra approval round-trip.

## Step 4 — Generate the webhook shared secret

Microsoft Graph subscriptions verify authenticity via a `clientState`
field, set at subscription create time and echoed back on every
notification. Generate a 32-byte hex string:

```powershell
# PowerShell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

or

```bash
# bash / git-bash
openssl rand -hex 32
```

Save the output. It goes into `MICROSOFT_WEBHOOK_CLIENT_STATE` in
Vercel. Never log it; never commit it.

## Step 5 — Wire the env vars into Vercel

Set in **Vercel Production** (per `feedback_no_prod_secrets_in_dev`,
production secrets do NOT live in `.env.local`):

- `MICROSOFT_OAUTH_CLIENT_ID` — Step 1 Application (client) ID
- `MICROSOFT_OAUTH_CLIENT_SECRET` — Step 2 Value
- `MICROSOFT_OAUTH_AUTHORITY` — defaults to
  `https://login.microsoftonline.com/common`; override only for
  single-tenant lockdown
- `MICROSOFT_WEBHOOK_CLIENT_STATE` — Step 4 hex string

For local dev, use a dev-tier Azure app registration with `localhost`
redirect URIs and a separate `MICROSOFT_WEBHOOK_CLIENT_STATE`. The
Microsoft Graph subscription notificationUrl MUST be HTTPS — local dev
typically tunnels through `ngrok` or `cloudflared` to satisfy this.

## Step 6 — Connect Conner's Outlook

1. Visit `https://agentplain.com/app/workspace/<your-workspace>/integrations`.
2. Click "Connect Outlook →" on the tile.
3. Microsoft's consent screen displays agentplain + the requested
   delegated permissions. Approve.
4. You land back on the integrations page with `?connected=outlook`.
5. The integrations page shows Outlook as connected.

If anything fails, the redirect lands at
`/app/workspace/<id>/integrations?error=<code>&detail=<short-detail>`.
Common codes:

- `microsoft_oauth_not_configured` — Step 5 env vars missing
- `token_exchange_failed` — Step 1 redirect URI doesn't match
- `state_mismatch` — the OAuth state cookie expired; restart the flow
- `token_missing_refresh_token` — `offline_access` was not granted; re-run
  the consent flow

## Step 7 — Subscribe Outlook to push notifications

Phase B ships the OAuth callback + the webhook receiver, but the
subscription-create call is invoked from the operator integrations panel
once OAuth lands. The same `integration-renewal-sweep` cron that handles
Gmail renewals (every 2 hours) renews Outlook subscriptions via Graph
PATCH before the 48h expiry.

Validation handshake: when the subscription is first created, Graph POSTs
`?validationToken=…` to `/api/webhooks/microsoft`. The route echoes the
token back as `text/plain` 200 within 10 seconds. If the handshake fails,
subscription creation upstream returns 400 — typically a misconfigured
`notificationUrl` (must be the public HTTPS URL of agentplain).
