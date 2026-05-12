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
