/**
 * lib/integrations/inbox/types.ts
 *
 * Provider-neutral inbox-snapshot port. Wave-2 ("real inbox + per-message
 * intelligence") needs a way to read the *current* inbox tip on a cron
 * fire — i.e. WITHOUT a WebhookEvent cursor in hand. The existing
 * `MessageFetcher` port (lib/skills/types.ts) is event-cursor-shaped:
 * `fetchMessagesForEvent(event)` resolves a Pub/Sub historyId. The
 * chief-of-staff scheduler runs on a 15-minute cron with no event, so it
 * needs a peer port that lists the inbox directly.
 *
 * This port is the seam. Two implementations land alongside it per the
 * two-implementation rule (`feedback_runner_portability.md`):
 *   - `./mcp-inbox-fetcher.ts`  — prod, backed by the Gmail / Outlook MCP
 *     servers (the same servers `GmailMessageAdapter` / `OutlookMessageAdapter`
 *     wrap). No new vendor SDK call sites.
 *   - `./fixture-inbox-fetcher.ts` — deterministic, in-memory. Lets the
 *     scheduler + lead-triage run in dev with no live credentials.
 *
 * Per `feedback_no_silent_vendor_lock.md`: callers (the scheduler fetcher)
 * speak THIS interface only; googleapis / Graph stay confined to
 * `lib/integrations/google` + `lib/integrations/microsoft`.
 *
 * Per `feedback_cold_start_safe_agents.md`: each `fetchInbox` re-reads the
 * inbox from the MCP server, which re-resolves the credential. No instance
 * memoizes messages across fires.
 */

import type { ParsedMessage, SkillResult } from '@/lib/skills/types';

export interface InboxFetchArgs {
  workspaceId: string;
  /** Cap on messages returned. Provider-side clamp applies. Default 25. */
  maxResults?: number;
  /** Optional provider search query (Gmail/Graph syntax). Defaults to the
   *  inbox view. */
  query?: string;
}

/**
 * The inbox-snapshot port. Returns the current inbox tip as provider-
 * neutral `ParsedMessage[]` — the same shape `MessageFetcher` returns, so
 * downstream skills consume it unchanged.
 */
export interface InboxSnapshotFetcher {
  readonly name: string;
  fetchInbox(args: InboxFetchArgs): Promise<SkillResult<ParsedMessage[]>>;
}
