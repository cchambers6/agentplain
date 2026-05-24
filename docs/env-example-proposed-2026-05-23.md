# Proposed .env.example replacement (2026-05-23)

This is the new shape of `.env.example` to match the current `lib/env.ts`
surface + the directly-read `process.env` accesses (MCP_API_KEY,
GOOGLE_PUBSUB_TOPIC, GMAIL_WEBHOOK_*).

The fleet sandbox cannot edit `.env.example` directly (permission rules
treat any `.env*` file as secret-adjacent). Conner: review the block below,
then either:

  cp docs/env-example-proposed-2026-05-23.md /tmp/proposed.txt
  # strip the markdown header lines, keep only the file body, then
  mv /tmp/body.env C:/agentplain/.env.example

…or just paste the body verbatim into your editor over the existing
`.env.example` and commit.

Once `.env.example` is up to date, delete this file.

---

## File body (copy everything between the BEGIN/END markers)

```bash
# ===== BEGIN .env.example =====
# =============================================================================
# agentplain — environment variables
# =============================================================================
# Tier rules per feedback_no_prod_secrets_in_dev:
#   * Production-tier secrets (signing keys, prod DB creds, prod API keys)
#     live in Production Vercel only.
#   * Preview gets separate values (preview DB, Stripe test keys).
#   * Development gets local values that fail loudly if missing.
#
# This file is the SHAPE only — never check actual values into git.
#
# Source of truth for the accessor + (required vs optional) semantics is
# lib/env.ts. A key here is REQUIRED iff env.ts calls required() for it; the
# rest are OPTIONAL with documented defaults / fallbacks.

# =============================================================================
# Core app / sessions
# =============================================================================
# Public origin of the deployed app. Used in magic-link emails AND as the
# `origin` arg to every OAuth authorize-URL builder, which means every
# `redirect_uri` Microsoft/Google/etc. sees is derived from this value.
# Production is APEX (https://agentplain.com) per metadataBase + the sitemap;
# any callback registered with a vendor MUST live under this exact host or
# the OAuth handshake will fail with redirect_uri_mismatch.
# Required in practice; env.ts soft-defaults to localhost only so unit tests
# don't have to set it.
APP_PUBLIC_ORIGIN="http://localhost:3000"

# 32+ char random string, separate per env. Production-tier in production only.
# Used by iron-session to seal both the auth session cookie AND the OAuth
# state cookie. Required.
SESSION_PASSWORD="dev-only-replace-in-real-environments-with-32-plus-byte-random"
SESSION_COOKIE_NAME="agentplain_session"

# AES-GCM symmetric key for at-rest encryption of OAuth access/refresh tokens
# in IntegrationCredential rows (lib/security/encryption.ts). REQUIRED — every
# OAuth callback throws when encryptTokenSet() runs without it. Generate with:
#   openssl rand -hex 32
ENCRYPTION_KEY=""

# WebAuthn / passkeys (lib/auth/webauthn/config.ts). RP_ID is the registrable
# domain the browser binds the credential to — NO scheme, NO port (e.g.
# "agentplain.com" or "localhost"). Optional; when unset we derive it from
# APP_PUBLIC_ORIGIN's hostname, which is correct for apex production AND
# localhost dev. Override only when serving from a subdomain but wanting
# apex-scoped credentials.
# RP_ID="agentplain.com"
# RP_NAME="agentplain"

# =============================================================================
# Database (Neon Postgres)
# =============================================================================
# Pooled URL for runtime queries. Required.
DATABASE_URL="postgresql://user:pass@localhost:5432/agentplain_dev?schema=public"

# Pooled URL alias used by callers that want to be explicit. Optional;
# defaults to DATABASE_URL.
# DATABASE_POOL_URL="postgresql://user:pass@localhost:5432/agentplain_dev?schema=public&pgbouncer=true"

# Direct (non-pooled) connection string. Used by `prisma migrate deploy` —
# pooled connections can't run DDL. REQUIRED. Per feedback_no_prod_secrets_in_dev
# this never silently defaults to DATABASE_URL.
DATABASE_URL_DIRECT="postgresql://user:pass@localhost:5432/agentplain_dev?schema=public"

# =============================================================================
# Auth / email (Resend magic-link delivery)
# =============================================================================
RESEND_API_KEY=""
RESEND_FROM_EMAIL="agentplain <claude@agentplain.com>"

# Comma-separated emails granted is_operator=true at first sign-in.
# Production-tier per feedback_no_prod_secrets_in_dev.
OPERATOR_EMAIL_ALLOWLIST=""

# Custom-inquiry destination. Submissions from /custom's contact form are
# emailed to this address. Optional; defaults to hello@agentplain.com.
# CUSTOM_INQUIRY_TO="hello@agentplain.com"

# Customer-support destination. In-app support messages are emailed here.
# Optional; defaults to hello@agentplain.com.
# SUPPORT_EMAIL="hello@agentplain.com"

# =============================================================================
# Stripe — Prices resolved by lookup_key (see lib/pricing/tiers.ts +
# scripts/stripe/setup-products.ts). NO per-tier price-id env vars.
# =============================================================================
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# =============================================================================
# Inngest (trial-expiration cron + skill scheduling)
# =============================================================================
# Local dev mode auto-detects the dev server and signing is a no-op;
# production needs both keys set.
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""

# =============================================================================
# Notion (briefing read-through cache, operator-internal canonical)
# =============================================================================
NOTION_API_KEY=""
# Notion 2025-09 API: data source id (NOT database id). Get it from
# `client.databases.retrieve(databaseId).data_sources[0].id` once.
# Optional — when unset the briefings card degrades to "no briefings yet".
NOTION_BRIEFINGS_DATA_SOURCE_ID=""

# =============================================================================
# MCP shared secret
# =============================================================================
# Required header (`x-agentplain-mcp-key`) for fleet callers (skill runner,
# smoke test, cron) hitting the workspace-scoped MCP routes at
# /api/integrations/<slug>-mcp/[workspaceId]. Without it, only session-
# authenticated workspace members can call those routes — fleet callers 503.
# Generate with: openssl rand -hex 32
MCP_API_KEY=""

# =============================================================================
# Google OAuth + Gmail webhooks
# =============================================================================
# Setup: docs/operator-integrations-setup.md.
# Per feedback_no_prod_secrets_in_dev: dev .env.local uses a dev-tier Google
# Cloud project; production values in Vercel Production only.
# REDIRECT URIs to register on the OAuth client (apex — must match APP_PUBLIC_ORIGIN):
#   https://agentplain.com/api/auth/oauth/google/callback                 (Gmail)
#   https://agentplain.com/api/integrations/google-drive/oauth/callback   (Drive)
GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""

# Fully-qualified Pub/Sub topic name that Gmail Push posts to.
# Format: projects/<project-id>/topics/<topic-id>
GOOGLE_PUBSUB_TOPIC=""

# OIDC audience the Pub/Sub push subscription signs its JWTs with — typically
# the webhook URL itself. Used by lib/integrations/google/webhook-handler.ts
# to verify inbound notifications.
GMAIL_WEBHOOK_OIDC_AUDIENCE="https://agentplain.com/api/webhooks/google"

# Service account email Pub/Sub uses to sign the OIDC token.
GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL=""

# =============================================================================
# Microsoft (M365 / Outlook / Teams / OneDrive / Excel) OAuth + webhooks
# =============================================================================
# Setup: docs/operator-integrations-setup.md + the M365 connector docs.
# /common authority accepts both work/school and personal MSAs; tenant
# lockdown happens at Entra app-registration time.
# REDIRECT URIs to register on the SAME Entra app (apex — must match APP_PUBLIC_ORIGIN):
#   https://agentplain.com/api/integrations/outlook/oauth/callback            (Outlook)
#   https://agentplain.com/api/integrations/microsoft/oauth/callback           (Teams/OneDrive/Excel)
MICROSOFT_OAUTH_CLIENT_ID=""
MICROSOFT_OAUTH_CLIENT_SECRET=""

# Optional. Defaults to https://login.microsoftonline.com/common.
# MICROSOFT_OAUTH_AUTHORITY="https://login.microsoftonline.com/common"

# Shared secret echoed back on every Microsoft Graph webhook notification's
# clientState field. Required for the Outlook webhook receiver to accept
# inbound notifications. Set to a 32-byte random hex string:
#   openssl rand -hex 32
MICROSOFT_WEBHOOK_CLIENT_STATE=""

# =============================================================================
# DocuSign (eSignature) OAuth + Connect webhook
# =============================================================================
# Setup: docs/integrations-setup-docusign-qbo-drive-slack.md.
# "client id" is DocuSign's Integration Key; the secret is a generated
# Secret Key on that integration.
# REDIRECT URI to register: https://agentplain.com/api/integrations/docusign/oauth/callback
DOCUSIGN_OAUTH_CLIENT_ID=""
DOCUSIGN_OAUTH_CLIENT_SECRET=""

# Selects the auth server: https://account-d.docusign.com (demo/sandbox,
# the default) or https://account.docusign.com (production). The per-account
# REST base URI is discovered at connect time via /oauth/userinfo and stored
# on the credential — NOT an env var.
# DOCUSIGN_OAUTH_BASE_URI="https://account-d.docusign.com"

# HMAC key configured in DocuSign admin → Connect. Every inbound Connect
# POST is verified against this before we write a WebhookEvent row.
# Optional; if unset, Connect events are accepted but flagged verified:false.
DOCUSIGN_CONNECT_HMAC_KEY=""

# =============================================================================
# QuickBooks Online (Intuit) OAuth
# =============================================================================
# Setup: docs/integrations-setup-docusign-qbo-drive-slack.md.
# REDIRECT URI to register: https://agentplain.com/api/integrations/quickbooks/oauth/callback
# The realmId (company id) is returned on the OAuth callback and persisted on
# the credential — NOT an env var. Intuit rotates refresh tokens on every
# refresh; the auth resolver always persists the returned refresh token.
QUICKBOOKS_OAUTH_CLIENT_ID=""
QUICKBOOKS_OAUTH_CLIENT_SECRET=""

# Selects the API base (sandbox-quickbooks.api.intuit.com vs
# quickbooks.api.intuit.com). Keep consistent with which Intuit app's keys
# you set above, or every API call 401s. Defaults to "sandbox".
# QUICKBOOKS_ENVIRONMENT="sandbox"

# =============================================================================
# Slack OAuth (v2) — user-token scopes (not bot)
# =============================================================================
# Setup: docs/integrations-setup-docusign-qbo-drive-slack.md.
# REDIRECT URI to register: https://agentplain.com/api/integrations/slack/oauth/callback
# Slack user tokens don't expire unless token rotation is enabled on the app,
# so the credential is stored with a far-future expiry and no refresh token.
SLACK_OAUTH_CLIENT_ID=""
SLACK_OAUTH_CLIENT_SECRET=""

# =============================================================================
# Knowledge substrate (lib/knowledge — pgvector + embeddings)
# =============================================================================
# Adapter selection. Defaults are the production choices; tests / preview-
# without-a-DB swap to the in-memory test store.
# KNOWLEDGE_STORE="pgvector"             # 'pgvector' | 'test'
# KNOWLEDGE_EMBEDDING_PROVIDER="openai"  # 'openai' | 'test'

# OPENAI_API_KEY enables the OpenAI embedding provider; when absent the
# factory falls back to the deterministic test embedder so the chain stays
# runnable without a paid key. Per feedback_no_prod_secrets_in_dev: dev uses
# a dev-tier key.
OPENAI_API_KEY=""
# Optional override; defaults to text-embedding-3-small.
# OPENAI_EMBEDDING_MODEL="text-embedding-3-small"

# =============================================================================
# Adapter selection (test/dev can swap to in-memory impls)
# =============================================================================
# auth: 'resend' | 'test'
AUTH_PROVIDER="resend"
# billing: 'stripe' | 'test'
BILLING_PROVIDER="stripe"
# briefings: 'notion' | 'test'
BRIEFINGS_PROVIDER="notion"

# =============================================================================
# Sentry (runtime error reporting)
# =============================================================================
# Production-tier per feedback_no_prod_secrets_in_dev. Leave empty in dev /
# preview; the observability adapter falls back to a noop reporter and the
# Sentry SDK init becomes a no-op. Add real DSN in Vercel Production env only.
SENTRY_DSN=""
# Same DSN exposed to the browser bundle. Sentry DSNs are public-by-design
# (they only authorize ingest, not read), but we still gate on prod so
# dev/preview don't ship a client-side init pointing at a non-existent
# project. When unset, the client-side Sentry.init is skipped.
NEXT_PUBLIC_SENTRY_DSN=""

# Optional adapter override. Defaults to 'sentry' when SENTRY_DSN is set,
# 'noop' otherwise.
# OBSERVABILITY_PROVIDER="sentry"   # 'sentry' | 'noop'

# Optional explicit environment tag. Defaults to VERCEL_ENV → NODE_ENV.
# SENTRY_ENVIRONMENT="production"

# Optional explicit release tag. Defaults to VERCEL_GIT_COMMIT_SHA (Vercel
# injects this automatically on every deploy).
# SENTRY_RELEASE=""

# Source-map upload (build-time only — used by withSentryConfig). Auth token
# is Conner-only and lives in Vercel Production. Leave empty until source
# maps are wired.
# SENTRY_AUTH_TOKEN=""
# SENTRY_ORG_SLUG=""
# SENTRY_PROJECT=""
# ===== END .env.example =====
```

## What changed vs. the existing `.env.example` (cbb7cfb)

**Removed (obsolete):** `STRIPE_PRICE_TIER_*` (all 6 keys). The price model
moved to Stripe lookup_keys per `lib/pricing/tiers.ts` +
`scripts/stripe/setup-products.ts` — no code reads `STRIPE_PRICE_TIER_*` anymore.

**Added (missing — read by `lib/env.ts` or directly):**
- `ENCRYPTION_KEY` (required — every OAuth callback throws without it)
- `DATABASE_URL_DIRECT` (required — prisma migrate deploy)
- `MCP_API_KEY` (required — fleet callers to MCP routes)
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_PUBSUB_TOPIC`, `GMAIL_WEBHOOK_OIDC_AUDIENCE`, `GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL`
- `MICROSOFT_OAUTH_CLIENT_ID` / `MICROSOFT_OAUTH_CLIENT_SECRET`
- `MICROSOFT_OAUTH_AUTHORITY` (commented — optional)
- `MICROSOFT_WEBHOOK_CLIENT_STATE`
- `DOCUSIGN_OAUTH_CLIENT_ID` / `DOCUSIGN_OAUTH_CLIENT_SECRET`
- `DOCUSIGN_OAUTH_BASE_URI` (commented — optional, default demo)
- `DOCUSIGN_CONNECT_HMAC_KEY`
- `QUICKBOOKS_OAUTH_CLIENT_ID` / `QUICKBOOKS_OAUTH_CLIENT_SECRET`
- `QUICKBOOKS_ENVIRONMENT` (commented — optional, default sandbox)
- `SLACK_OAUTH_CLIENT_ID` / `SLACK_OAUTH_CLIENT_SECRET`
- `KNOWLEDGE_STORE`, `KNOWLEDGE_EMBEDDING_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`
- `CUSTOM_INQUIRY_TO`, `SUPPORT_EMAIL` (commented — optional)
- `RP_ID`, `RP_NAME` (commented — optional)
- `OBSERVABILITY_PROVIDER`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`,
  `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT`
- `NEXT_PUBLIC_SENTRY_DSN`
- `DATABASE_POOL_URL` (commented — optional)

**Inline redirect URIs** now documented next to each OAuth provider block so
the registration step matches the code's `env.appPublicOrigin()` derivation
exactly. Every callback resolves to `https://agentplain.com/...` (apex),
matching `APP_PUBLIC_ORIGIN` in Vercel Production.

**Comments updated** to reflect: APP_PUBLIC_ORIGIN drives OAuth redirect
URIs (not just magic-link emails); `STRIPE_PRICE_TIER_*` is gone; the
knowledge substrate falls back to a test embedder when OPENAI_API_KEY is
absent; ENCRYPTION_KEY is required and the symptom is OAuth-callback throw.
