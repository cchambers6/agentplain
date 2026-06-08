/**
 * lib/competitive-signals/web-research-provider.ts
 *
 * The flag-gated LIVE implementation of `CompetitiveSignalProvider`. Selected
 * when COMPETITIVE_SIGNAL_PROVIDER=web. It fronts the connected web-research
 * surface — Bright Data MCP, the same surface every `b2b-head-of-*` and the
 * media/creative roster already lists as a primaryTool — behind this domain's
 * provider port (feedback_no_silent_vendor_lock: no scattered direct vendor
 * calls).
 *
 * ── Honest seam (mirrors research-on-demand-general) ──
 * There is no JSON-RPC dispatch wired to the advertised Bright Data MCP
 * endpoint in agentplain's runtime today (same no-dispatch gap documented for
 * the other advertised `<id>-mcp` endpoints in project_mcp_smoke_wave3). Rather
 * than fabricate live results, this provider:
 *   - accepts an injectable `search` port so the moment a real MCP dispatch
 *     (or any HTTP research client) is wired, it drops in with no other change;
 *   - when no `search` port is injected, falls back to the fixture corpus and
 *     reports `isLive=false` for that call so the digest NAMES the gap. The
 *     feed is never silently empty and never presents fixtures as live truth.
 *
 * This is the same pattern research-on-demand uses for its un-wired web search
 * gap — name the limitation, ground on what we actually have.
 */

import {
  type CompetitiveSignal,
  type CompetitiveSignalProvider,
  type SignalProviderResult,
  type SignalQuery,
  signalError,
  signalOk,
} from './types';
import { FixtureSignalProvider } from './fixture-provider';

/**
 * The narrow research port the live provider needs. A real implementation
 * issues a web search / scrape via Bright Data MCP (or any research client)
 * and returns normalized hits. Kept minimal so the two-implementation rule is
 * cheap to satisfy and the vendor stays swappable.
 */
export interface WebResearchSearchPort {
  readonly name: string;
  search(args: {
    query: string;
    lookbackDays: number;
    limit: number;
  }): Promise<WebResearchHit[]>;
}

export interface WebResearchHit {
  title: string;
  snippet: string;
  url: string;
  source: string;
  publishedAt: string;
}

export interface WebResearchSignalProviderArgs {
  /** Live research port. When omitted, the provider falls back to fixtures
   *  and flips `isLive` to false for the call (gap is named in the digest). */
  search?: WebResearchSearchPort;
}

/** Per-vertical query templates. The search port turns these into hits. */
const VERTICAL_QUERIES: Record<SignalQuery['vertical'], string> = {
  realty:
    'real estate brokerage technology AI launches pricing funding regulation last 90 days',
  insurance:
    'insurance brokerage AMS AI product launch pricing regulation last 90 days',
  'home-services':
    'home services trades software AI dispatch intake launch funding last 90 days',
};

export class WebResearchSignalProvider implements CompetitiveSignalProvider {
  readonly name = 'web-research';
  private readonly search?: WebResearchSearchPort;
  private readonly fixtureFallback: FixtureSignalProvider;

  constructor(args: WebResearchSignalProviderArgs = {}) {
    this.search = args.search;
    this.fixtureFallback = new FixtureSignalProvider();
  }

  /** Live only when a real search port is wired. Off the port we are
   *  serving fixtures, and the digest must say so. */
  get isLive(): boolean {
    return this.search !== undefined;
  }

  async fetchSignals(
    query: SignalQuery,
  ): Promise<SignalProviderResult<CompetitiveSignal[]>> {
    if (!this.search) {
      // No dispatch wired — honest fixture fallback. The digest reads
      // `providerIsLive=false` and names the "live web research not wired"
      // gap. NOT an error: the feed still produces real-shaped signals.
      return this.fixtureFallback.fetchSignals(query);
    }

    let hits: WebResearchHit[];
    try {
      hits = await this.search.search({
        query: VERTICAL_QUERIES[query.vertical],
        lookbackDays: query.lookbackDays,
        limit: query.limit,
      });
    } catch (err) {
      return signalError(
        'PROVIDER_UNAVAILABLE',
        `web-research search failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const signals = hits
      .slice(0, query.limit)
      .map((hit, idx) => normalizeHit(hit, query, idx));
    return signalOk(signals);
  }
}

/** Turn a raw research hit into a normalized `CompetitiveSignal`. The LLM
 *  classification of category/severity is a follow-up; the deterministic
 *  normalizer keeps the live path real-shaped and grounded today. */
function normalizeHit(
  hit: WebResearchHit,
  query: SignalQuery,
  idx: number,
): CompetitiveSignal {
  return {
    id: `${query.vertical}-web-${idx}-${hashUrl(hit.url)}`,
    vertical: query.vertical,
    // Deterministic, conservative classification until an LLM pass lands.
    category: inferCategory(hit),
    severity: 'medium',
    headline: hit.title.trim(),
    summary: hit.snippet.replace(/\s+/g, ' ').trim().slice(0, 400),
    sourceUrl: hit.url,
    source: hit.source,
    observedAt: hit.publishedAt,
  };
}

function inferCategory(hit: WebResearchHit): CompetitiveSignal['category'] {
  const text = `${hit.title} ${hit.snippet}`.toLowerCase();
  if (/\b(raise|raised|funding|series|seed|round)\b/.test(text)) return 'funding';
  if (/\b(pricing|price|per[- ]seat|tier)\b/.test(text)) return 'pricing-change';
  if (/\b(regulat|compliance|disclosure|settlement|doi|naic)\b/.test(text)) {
    return 'regulatory';
  }
  if (/\b(partner|partnership|integration)\b/.test(text)) return 'partnership';
  if (/\b(launch|ships|shipped|adds|added|releases|new feature)\b/.test(text)) {
    return 'competitor-launch';
  }
  return 'market-move';
}

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i += 1) {
    h = (h * 31 + url.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export const __testing = { normalizeHit, inferCategory };
