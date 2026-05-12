---
name: integrations_audit_log
description: Append-only audit log of every integration credential / webhook subscription / webhook event. Written by the OAuth callback, the webhook receiver, and the Inngest renewal cron. Newest at bottom (chronological).
type: project
created: 2026-05-11
originSessionId: pr-a-foundation-port-2026-05-11
---

# Integrations audit log

Append-only. Every row is written AFTER reading back actual state from the database (per `feedback_verify_after_create`).

Seeded empty by PR-A. PR-B (Gmail OAuth + Pub/Sub webhook + renewal cron) writes the first rows. Row schema documented in PR-B's `lib/integrations/README.md`.

## 2026-05-11 — PR-B plumbing landed

**Status:** `plumbing landed, behavior pending` per `feedback_integration_acceptance_is_functional.md`.

**Shipped (this PR):**
- Prisma models: `IntegrationCredential`, `WebhookSubscription`, `WebhookEvent` (migration `20260511180000_add_gmail_integration`).
- Adapter layer: `lib/integrations/types.ts` interface + `lib/integrations/google/{oauth,gmail-provider,webhook-handler}.ts` + `lib/integrations/test-provider.ts` (two-impl rule satisfied per `feedback_runner_portability.md`).
- OAuth flow: `app/api/auth/oauth/google/{connect,callback,revoke}/route.ts` with iron-session-sealed CSRF state.
- Webhook receiver: `app/api/webhooks/google/route.ts` with Pub/Sub OIDC verification + `users.history.list` cursor stored.
- Renewal cron: `lib/inngest/functions/integration-renewal-sweep.ts` every 2h, wraps in `runWithDisableGate`, refreshes tokens + re-calls `users.watch` for subscriptions with `expiresAt < now + 24h`.
- Operator UI: `app/(operator)/operator/integrations/page.tsx` — connect / list / disconnect.
- Sync-correctness subtest: `scripts/validate/gmail-sync-check.ts` + `docs/validation/gmail-dogfood.md`.

**Pending (PR-C functional acceptance):**
- Skills consuming `WebhookEvent` rows to execute read → categorize → coordinate → schedule → draft on `connerchambers6@gmail.com`.
- Recorded 24-hour dogfood run with per-step pass/fail rows.
- Until PR-C lands, P0-10 / P0-12 are NOT marked done in `outputs/realty_fleet_hardening_progress.md`.

**Conner-action gates (must complete before first OAuth dogfood test):**
1. Google Cloud Project setup per `docs/operator-integrations-setup.md` (project, APIs, OAuth client, Pub/Sub topic + push subscription with OIDC).
2. Vercel env vars: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_PUBSUB_TOPIC`, `GMAIL_WEBHOOK_OIDC_AUDIENCE`, `GMAIL_WEBHOOK_SERVICE_ACCOUNT_EMAIL`, `ENCRYPTION_KEY` (separate values per env tier per `feedback_no_prod_secrets_in_dev`).
