# Gmail (provider: GOOGLE)

**Pattern:** Pass-through read + write-back draft.

## What we store
- Your Google OAuth tokens, **encrypted at rest** (`IntegrationCredential`).
- A Gmail watch subscription pointer (`WebhookSubscription`) + the Pub/Sub
  *notification* envelopes (`WebhookEvent.rawPayload` = `{emailAddress, historyId}`
  — a "you have new mail" ping, **not** the mail itself).
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## What we do NOT store
- **Your emails.** Message bodies, subjects, senders, attachments are read
  in-flight via the Gmail MCP server (`lib/integrations/gmail-mcp/`) when a
  skill needs them — triage, draft a reply, schedule — and discarded. They are
  never written to our database.

## Flow
1. Pub/Sub pings us "history changed" → `WebhookEvent` row (notification only).
2. A skill fetches the relevant messages in-flight (`McpInboxFetcher` →
   `passThroughFetch`), processes them in memory.
3. It drafts a reply into your **approval queue** (`WorkApprovalQueueItem`).
   The draft (Plaino's output, not a copy of your mailbox) is kept so he learns
   your style; deleted when you close the account.
4. On approval, the draft is created in **your** Gmail (`gmail.compose`); we do
   not keep a copy — your Sent folder is canonical.

## On disconnect
Token + watch subscription + notification events deleted.
