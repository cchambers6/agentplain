# DocuSign (provider: DOCUSIGN)

**Pattern:** Write-back action, approval-gated.

## What we store
- Your DocuSign OAuth tokens, **encrypted at rest** (`IntegrationCredential`).
- The approval-gate record for each send/void (`WorkApprovalQueueItem` of kind
  `DOCUSIGN_ENVELOPE_SEND` / `_VOID`). The draft envelope details persist only
  until you decide, then are redacted 7 days after the decision.
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## What we do NOT store
- **Your signed documents.** Envelopes, recipients, and signed PDFs live in
  **your** DocuSign account. We read status in-flight; we do not keep the docs.

## Flow
A skill proposes an envelope send (or void). It is **gated** at the factory
seam (`withDocuSignApproval`) — nothing leaves until you grant a fingerprint-
bound, 24h-TTL approval. On approval the action executes against **your**
DocuSign; the canonical record is in DocuSign.

## On disconnect
Token deleted. Decided approval rows redact on the normal 7-day schedule.
