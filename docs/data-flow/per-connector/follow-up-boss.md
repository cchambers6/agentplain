# Follow Up Boss (provider: FOLLOW_UP_BOSS)

**Pattern:** Pass-through read + write-back. API-key auth.

## What we store
- Your Follow Up Boss **API key**, encrypted at rest (`IntegrationCredential.
  accessTokenEncrypted`). Validated against the provider before saving.
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## What we do NOT store
- **Your CRM data.** People, deals, events, and notes are read in-flight via
  the Follow Up Boss MCP dispatch route (`/api/integrations/follow-up-boss/
  [workspaceId]`), processed in memory, and discarded.

## Flow
Fetch in-flight → draft (first-touch reply, follow-up) into the approval queue →
on approval, write back to **your** Follow Up Boss account.

## On disconnect
API key deleted. No CRM data was ever stored.
