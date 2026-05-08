// BriefingsProvider abstraction.
//
// Per project_one_customer_surface: customers NEVER bounce to Notion.
// Briefings are READ from Notion (operator-internal canonical content store)
// and RENDERED in the product. No "open in Notion" links anywhere in
// customer routes.
//
// The interface intentionally exposes only what a customer-facing renderer
// needs. Pages, blocks, page properties — none of that surfaces. The
// underlying impl (Notion API today; Postgres-native at Phase 3+) can swap
// freely behind this seam.

export interface Briefing {
  /** Provider-side stable id (e.g. Notion page id). Not shown to users. */
  sourceId: string;
  /** Workspace this briefing belongs to. */
  workspaceId: string;
  title: string;
  /** Iso8601. */
  publishedAt: string;
  /** Plaintext body of the briefing. */
  body: string;
  /** Optional structured sections — render as headers when present. */
  sections?: BriefingSection[];
  /** Cache freshness; product surfaces a `StaleBadge` when past TTL. */
  fetchedAt: string;
  isStale: boolean;
}

export interface BriefingSection {
  heading: string;
  body: string;
}

export interface FetchBriefingsInput {
  workspaceId: string;
  /** Max age before the cache layer treats data as stale. Default 5 min per spec. */
  ttlSeconds?: number;
  limit?: number;
}

export interface BriefingsProvider {
  readonly providerName: string;

  /** Fetch the latest briefings for a workspace. Caller scopes by workspaceId. */
  fetchBriefings(input: FetchBriefingsInput): Promise<Briefing[]>;

  /** Drop the cache for a workspace (e.g. after operator forces a re-render). */
  invalidate(workspaceId: string): Promise<void>;
}
