# Per-connector data flow

One file per connector, stating **exactly what flows where** — so the
pass-through commitment is documented connector by connector, not just
asserted in marketing copy.

agentplain is a **service layer, not a data warehouse**. For every connector
the shape is the same:

```
                  ┌─────────────────────────────────────────┐
   your token     │  agentplain (in-flight, in memory only)  │
  (encrypted,  ───▶  fetch → process → draft → return        │──▶ your approval queue
   the ONLY      │  (nothing persisted to our DB)            │     (draft text; redacted
   thing we keep)└─────────────────────────────────────────┘      7 days after decision)
                                   │
                                   ▼
                    canonical copy stays in YOUR system
                    (Gmail, HubSpot, QuickBooks, …)
```

## The three patterns

Every connector falls into one of three data-flow patterns:

| Pattern | What we store | Examples |
|---|---|---|
| **Pass-through read** | Nothing. We read records in-flight, process, and discard. | Gmail, Outlook, HubSpot, Salesforce, Follow Up Boss, QuickBooks, Slack/Teams (read), Calendar |
| **Indexed store (opt-in)** | The text + a private vector index of documents **you explicitly ask us to index**. Deleted on disconnect. | Google Drive, Notion, OneDrive/SharePoint files |
| **Write-back action** | Nothing of the source. The action's draft lives in your approval queue until you decide; redacted 7 days after. | DocuSign (send/void), Gmail/Outlook (draft), CRM note writes |

## What we ALWAYS store, for every connector

- **The OAuth/API token, encrypted at rest** (AES-256-GCM, `lib/security/encryption.ts`).
  This is the only credential we keep, and it's the only way we can reach the
  connector when there's work to do. Revoked the moment you disconnect.
- **A pass-through breadcrumb** (`storage.ephemeral_fetch` in `AuditLog`):
  "we read N items from your `<provider>` `<resource>` at `<time>` and stored
  none of it." Visible to you on **Account → Your data → What we store**.

## What we NEVER store

- The emails, deals, contacts, calendar events, invoices, messages, or files
  **inside** the systems you connect — except the indexed-store opt-in above.
- We are a pass-through. The canonical copy stays in your system.

## How this is enforced in code

- Connector reads go through `lib/integrations/ephemeral-pass-through.ts`
  (`passThroughFetch`) — fetch → return → forget, with an optional in-memory
  (never DB) short-TTL cache and the breadcrumb.
- No connector read path writes the fetched data to Prisma. The storage
  inventory audit (`docs/architecture/data-storage-inventory-2026-06-18.md`)
  enumerates every `prisma.*.create/upsert` and classifies it; none persist
  connector record bodies.
- The no-silent-storage invariant test (`lib/storage/__tests__/data-categories.test.ts`)
  fails if any new workspace-scoped model escapes disclosure.

See each connector's file for the specifics.
