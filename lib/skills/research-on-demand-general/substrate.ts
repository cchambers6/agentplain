/**
 * Two impls of `IResearchSubstratePort` — production + recording. The
 * production impl delegates to `retrieveCustomerContext` (the MCP-
 * fronted boundary the support-handler already uses), so the skill
 * never opens a direct DB connection.
 *
 * Per `project_mcp_first_integration_architecture` + the
 * two-implementation rule: this is the single seam between the skill
 * and the customer-files retrieval surface.
 */

import { retrieveCustomerContext } from '../../customer-files';
import {
  getWebSearchProvider,
  type IWebSearchPort,
} from '../../integrations/web-search';
import type { SupportContextSnippet } from '../support-handler';
import type { IResearchSubstratePort } from './types';

export class CustomerFilesResearchSubstrate implements IResearchSubstratePort {
  readonly name = 'customer-files-mcp' as const;

  async searchForResearch(args: {
    workspaceId: string;
    query: string;
    k: number;
  }): Promise<SupportContextSnippet[]> {
    const snippets = await retrieveCustomerContext({
      workspaceId: args.workspaceId,
      query: args.query,
      k: args.k,
    });
    return snippets.map((s) => ({
      title: s.title,
      bodyExcerpt: s.body,
      sourceUrl: s.sourceUrl,
      similarity: s.similarity,
    }));
  }
}

/**
 * Web-search-backed substrate (wave-5, theme #11 / ratif #8). Grounds the
 * research brief on LIVE web sources behind `IWebSearchPort` so citations
 * point at real URLs instead of model memory. Falls back to the fixture
 * corpus when no web-search key is configured (the factory decides); the
 * `isLive` flag flows through so the skill can name its grounding honestly.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this substrate calls the
 * web-search PORT, never a vendor SDK. The vendor wire shape stays inside
 * `lib/integrations/web-search/`.
 */
export class WebSearchResearchSubstrate implements IResearchSubstratePort {
  readonly name = 'web-search' as const;
  private readonly web: IWebSearchPort;

  constructor(web: IWebSearchPort = getWebSearchProvider()) {
    this.web = web;
  }

  /** True when the underlying provider reaches live web sources. The skill
   *  reads this to decide whether to emit the "no web search wired" gap. */
  get isLive(): boolean {
    return this.web.isLive;
  }

  async searchForResearch(args: {
    workspaceId: string;
    query: string;
    k: number;
  }): Promise<SupportContextSnippet[]> {
    const outcome = await this.web.search({
      query: args.query,
      maxResults: args.k,
    });
    if (!outcome.ok) {
      // A web-search failure is not a fabrication risk — return nothing so
      // the skill emits its honest "found nothing" placeholder. The error
      // is swallowed (best-effort) like the other substrate reads.
      console.warn(
        `WebSearchResearchSubstrate: search failed (${outcome.error.code}): ${outcome.error.message}`,
      );
      return [];
    }
    return outcome.results.slice(0, args.k).map((r) => ({
      title: r.title,
      bodyExcerpt: r.snippet,
      sourceUrl: r.url,
      // Web providers report a relevance score, not a cosine similarity.
      // We surface it in the same [0,1] field the operator already reads;
      // null scores map to a neutral 0.5 so the citation still renders.
      similarity: r.score ?? 0.5,
    }));
  }
}

export class RecordingResearchSubstrate implements IResearchSubstratePort {
  readonly name = 'recording' as const;
  readonly calls: Array<{ workspaceId: string; query: string; k: number }> = [];
  private readonly snippetsByWorkspace: Map<string, SupportContextSnippet[]>;

  constructor(seed: Record<string, SupportContextSnippet[]>) {
    this.snippetsByWorkspace = new Map(Object.entries(seed));
  }

  async searchForResearch(args: {
    workspaceId: string;
    query: string;
    k: number;
  }): Promise<SupportContextSnippet[]> {
    this.calls.push({
      workspaceId: args.workspaceId,
      query: args.query,
      k: args.k,
    });
    return (this.snippetsByWorkspace.get(args.workspaceId) ?? []).slice(0, args.k);
  }
}
