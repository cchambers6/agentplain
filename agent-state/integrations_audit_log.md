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
