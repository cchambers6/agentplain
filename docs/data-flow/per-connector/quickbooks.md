# QuickBooks (provider: QUICKBOOKS)

**Pattern:** Pass-through read + write-back action.

## What we store
- Your QuickBooks OAuth tokens, **encrypted at rest** (`IntegrationCredential`).
- Pass-through breadcrumbs (`storage.ephemeral_fetch`).

## What we do NOT store
- **Your financial data.** Invoices, customers, balances, payments, and line
  items are read in-flight via the QuickBooks MCP dispatch route when a skill
  needs them (e.g. invoice-chase), processed in memory, and discarded. None of
  your books are copied into our database.

## Flow
1. The invoice-chase skill reads overdue invoices in-flight.
2. It drafts a chase message into your **approval queue** (and, where wired, a
   QuickBooks reminder action).
3. On approval, the action goes back to **your** QuickBooks. QuickBooks is the
   system of record.

## On disconnect
Token deleted. No financial data was ever stored.
