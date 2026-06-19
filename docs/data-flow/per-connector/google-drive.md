# Google Drive (provider: GOOGLE)

**Pattern:** Indexed store (opt-in) — the one exception to pure pass-through.

## What we store
- Your Google OAuth tokens, **encrypted at rest** (`IntegrationCredential`,
  shared with the Gmail grant).
- For documents you **explicitly ask us to index**: the chunked text +
  a private vector index, scoped to your workspace
  (`KnowledgeDocument` + `Embedding`, `contextKind = CUSTOMER`). Document bodies
  are encrypted at rest where the deployment has encryption enabled.
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## Why this one stores
To let Plaino ground its work in **your** documents, those documents have to be
searchable — which means indexing their text + embeddings. This is opt-in: it
only happens for sources you point us at. It's the single category of connector
data we persist, and it's disclosed as "Ingested documents" on the storage
surface.

## What we do NOT store
- Files you didn't ask us to index. We list/read other Drive files in-flight
  only and discard them.

## On disconnect
Disconnecting Google deletes **every** indexed Drive document + its embeddings
for your workspace (`deleteIntegrationCustomerData` →
`customerFileSourceNamesForProvider('GOOGLE')` = `google-drive`). The
Drive-tombstone reaper also removes indexed docs whose source file was deleted.
