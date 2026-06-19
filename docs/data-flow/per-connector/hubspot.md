# HubSpot (provider: HUBSPOT)

**Pattern:** Pass-through read + write-back note.

## What we store
- Your HubSpot OAuth tokens, **encrypted at rest** (`IntegrationCredential`).
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## What we do NOT store
- **Your CRM data.** Contacts, companies, deals, tickets, and engagement
  history are read in-flight via the HubSpot MCP dispatch route
  (`/api/integrations/hubspot/[workspaceId]`) when a skill needs them, processed
  in memory, and discarded. None of it is copied into our database.

## Flow
1. A skill (lead triage, follow-up draft, CRM hygiene) fetches the relevant
   records in-flight.
2. It drafts the work — a reply, a note, a task — into your **approval queue**.
3. On approval, the write goes back to **your** HubSpot. HubSpot remains the
   system of record; we keep no mirror.

## On disconnect
Token deleted. No CRM data was ever stored, so nothing else to purge.
