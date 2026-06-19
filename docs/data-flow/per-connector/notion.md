# Notion (provider: NOTION)

**Pattern:** Indexed store (opt-in) — exception to pure pass-through.

## What we store
- Your Notion OAuth tokens, **encrypted at rest** (`IntegrationCredential`).
- For pages you **explicitly ask us to index**: the chunked text + a private
  vector index, scoped to your workspace (`KnowledgeDocument` + `Embedding`,
  `contextKind = CUSTOMER`).
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## Why this one stores
Same as Google Drive: making your Notion pages searchable for Plaino requires
indexing their text. Opt-in, per source, disclosed as "Ingested documents."

## What we do NOT store
- Pages you didn't ask us to index — read in-flight via the Notion MCP dispatch
  route and discarded.

## On disconnect
Disconnecting Notion deletes every indexed Notion page + its embeddings for
your workspace (`customerFileSourceNamesForProvider('NOTION')` = `notion`) —
the privacy bar from the wave-7 brief.
