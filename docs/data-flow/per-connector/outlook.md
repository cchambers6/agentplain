# Outlook / Microsoft 365 mail (provider: M365)

**Pattern:** Pass-through read + write-back draft.

## What we store
- Your Microsoft OAuth tokens, **encrypted at rest** (`IntegrationCredential`).
- A Graph change-notification subscription pointer (`WebhookSubscription`) +
  the notification envelopes (`WebhookEvent.rawPayload` — resource pointers,
  not message bodies).
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## What we do NOT store
- **Your mail.** Bodies, subjects, senders, attachments are read in-flight via
  the Outlook MCP server (`lib/integrations/outlook-mcp/`) and discarded.

## Flow
Same as Gmail: notification → in-flight fetch → draft into the approval queue →
on approval, draft created in **your** mailbox (`Mail.ReadWrite`, never
`Mail.Send` — outbound stays under your control). Your mailbox is canonical.

## On disconnect
Token + subscription + notification events deleted.
