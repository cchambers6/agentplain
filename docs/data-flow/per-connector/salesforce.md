# Salesforce (provider: SALESFORCE)

**Pattern:** Pass-through read + write-back.

## What we store
- Your Salesforce OAuth tokens, **encrypted at rest** (`IntegrationCredential`).
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## What we do NOT store
- **Your CRM data.** Leads, accounts, opportunities, contacts, and activities
  are read in-flight via the Salesforce MCP dispatch route
  (`/api/integrations/salesforce/[workspaceId]`), processed in memory, and
  discarded.

## Flow
Fetch in-flight → draft into the approval queue → on approval, write back to
**your** Salesforce org. Salesforce is the system of record.

## On disconnect
Token deleted. No CRM data was ever stored.
