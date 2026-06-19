# Slack / Microsoft Teams (providers: SLACK, M365)

**Pattern:** Pass-through read + notify/write-back. Non-critical (notify/mirror).

## What we store
- Your Slack OAuth tokens (or Teams via the M365 grant), **encrypted at rest**
  (`IntegrationCredential`).
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## What we do NOT store
- **Your messages.** Channel and thread content is read in-flight via the MCP
  dispatch route when a skill needs it, processed in memory, and discarded.

## Flow
A skill reads the channels/threads you point us at in-flight, and writes back
into the threads you already work in (a status ping, a summary). Slack/Teams
hold the canonical conversation. These connectors are tagged `non-critical`:
if they're down, the primary work still happens and only the notification is
held in the retry queue until reconnect.

## On disconnect
Token deleted. No messages were ever stored.
