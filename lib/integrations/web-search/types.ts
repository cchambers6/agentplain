/**
 * lib/integrations/web-search/types.ts
 *
 * Provider-neutral web-search seam (wave-5, pride theme #11 / ratif #8).
 * The research-on-demand skill grounds briefs on LIVE web sources through
 * this port instead of model memory.
 *
 * Per `feedback_no_silent_vendor_lock.md` + `feedback_runner_portability.md`:
 * the port is named FIRST; two implementations land alongside it —
 * `FixtureWebSearchProvider` (deterministic corpus, ships always so the
 * interface is honest + dev/CI need no creds) and `HttpWebSearchProvider`
 * (Tavily / BrightData behind a single flag-gated HTTP shape). Skill code
 * speaks `IWebSearchPort` only; no vendor SDK or `fetch(provider-url)`
 * leaks past this directory.
 *
 * Per `project_no_outbound_architecture.md`: web search is a READ. It pulls
 * public sources; it never sends anything on the customer's behalf.
 */

export interface WebSearchResult {
  /** Page / article title. */
  title: string;
  /** The live source URL — load-bearing: this is what makes the brief
   *  cite reality instead of model memory. */
  url: string;
  /** Provider-supplied snippet / extract relevant to the query. */
  snippet: string;
  /** Provider relevance score in [0, 1] when available; null otherwise. */
  score: number | null;
  /** ISO date the source was published, when the provider reports it. */
  publishedAt: string | null;
}

export type WebSearchErrorCode =
  | 'NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'NETWORK'
  | 'MALFORMED_RESPONSE';

export interface WebSearchError {
  code: WebSearchErrorCode;
  message: string;
}

export type WebSearchOutcome =
  | { ok: true; results: WebSearchResult[] }
  | { ok: false; error: WebSearchError };

export interface WebSearchQuery {
  query: string;
  /** Cap on results. Default 5. */
  maxResults?: number;
}

/**
 * The single seam between research code and any web-search vendor.
 * Implementations re-read their own config on construction; callers never
 * pass a key through. `name` discriminates `fixture` / `tavily` /
 * `brightdata` for the operator/audit surface.
 */
export interface IWebSearchPort {
  readonly name: string;
  /** True when this adapter reaches a live provider (a key was present).
   *  False for the fixture adapter — the research brief uses this to name
   *  the grounding honestly ("grounded on live web sources" vs "fixture
   *  corpus — connect a web-search key"). */
  readonly isLive: boolean;
  search(query: WebSearchQuery): Promise<WebSearchOutcome>;
}
