/**
 * lib/integrations/web-search/http-provider.ts
 *
 * Live implementation of `IWebSearchPort` over an HTTP search provider —
 * Tavily or BrightData's SERP endpoint. This is the ONLY file that knows a
 * provider's wire shape; everything upstream speaks `IWebSearchPort`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the provider URL + response
 * mapping live here behind the port. Swapping Tavily → BrightData is a
 * config flip (`WEB_SEARCH_PROVIDER`), not a code change at any call site.
 *
 * Per `feedback_no_guesses_no_estimates`: the Tavily request/response
 * shape follows https://docs.tavily.com/api-reference/endpoint/search
 * (POST /search, `api_key` + `query` + `max_results`; results carry
 * `title` / `url` / `content` / `score` / `published_date`). BrightData's
 * SERP API is wired through the same normalizer with its own envelope.
 *
 * Cold-start safe: the key is read at construction from the injected
 * config; nothing is memoized across calls beyond the immutable config.
 */

import type {
  IWebSearchPort,
  WebSearchQuery,
  WebSearchResult,
  WebSearchOutcome,
  WebSearchError,
} from './types';

export type HttpWebSearchVendor = 'tavily' | 'brightdata';

export interface HttpWebSearchConfig {
  vendor: HttpWebSearchVendor;
  apiKey: string;
  /** Override the endpoint (tests / self-hosted gateways). Defaults per
   *  vendor. */
  endpoint?: string;
  /** Injected fetch for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Request timeout in ms. Default 8000. */
  timeoutMs?: number;
}

const DEFAULT_ENDPOINTS: Record<HttpWebSearchVendor, string> = {
  tavily: 'https://api.tavily.com/search',
  brightdata: 'https://api.brightdata.com/serp/req',
};

export class HttpWebSearchProvider implements IWebSearchPort {
  readonly name: HttpWebSearchVendor;
  readonly isLive = true;
  private readonly cfg: Required<Omit<HttpWebSearchConfig, 'endpoint'>> & {
    endpoint: string;
  };

  constructor(config: HttpWebSearchConfig) {
    if (!config.apiKey) {
      throw new Error('HttpWebSearchProvider: apiKey is required');
    }
    this.name = config.vendor;
    this.cfg = {
      vendor: config.vendor,
      apiKey: config.apiKey,
      endpoint: config.endpoint ?? DEFAULT_ENDPOINTS[config.vendor],
      fetchImpl: config.fetchImpl ?? fetch,
      timeoutMs: config.timeoutMs ?? 8000,
    };
  }

  async search(query: WebSearchQuery): Promise<WebSearchOutcome> {
    const maxResults = clampMax(query.maxResults);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await this.cfg.fetchImpl(this.cfg.endpoint, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(this.requestBody(query.query, maxResults)),
        signal: controller.signal,
      });
      if (res.status === 429) {
        return err('RATE_LIMITED', `${this.name} returned 429`);
      }
      if (!res.ok) {
        return err('UPSTREAM_ERROR', `${this.name} returned HTTP ${res.status}`);
      }
      const json: unknown = await res.json();
      const results = this.normalize(json).slice(0, maxResults);
      return { ok: true, results };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.toLowerCase().includes('abort')) {
        return err('NETWORK', `${this.name} request timed out`);
      }
      return err('NETWORK', `${this.name} request failed: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  private headers(): Record<string, string> {
    const base: Record<string, string> = { 'content-type': 'application/json' };
    if (this.cfg.vendor === 'brightdata') {
      base.authorization = `Bearer ${this.cfg.apiKey}`;
    }
    // Tavily passes the key in the body (`api_key`), not a header.
    return base;
  }

  private requestBody(query: string, maxResults: number): Record<string, unknown> {
    if (this.cfg.vendor === 'tavily') {
      return {
        api_key: this.cfg.apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
      };
    }
    // BrightData SERP request envelope.
    return { query, num: maxResults };
  }

  private normalize(json: unknown): WebSearchResult[] {
    if (!json || typeof json !== 'object') return [];
    const obj = json as Record<string, unknown>;
    // Tavily: { results: [{ title, url, content, score, published_date }] }
    // BrightData SERP: { organic: [{ title, link, description, ... }] }
    const raw =
      (Array.isArray(obj.results) && obj.results) ||
      (Array.isArray(obj.organic) && obj.organic) ||
      [];
    const out: WebSearchResult[] = [];
    for (const item of raw as unknown[]) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const url = pickString(r, ['url', 'link']);
      const title = pickString(r, ['title']);
      if (!url || !title) continue;
      out.push({
        title,
        url,
        snippet: pickString(r, ['content', 'description', 'snippet']) ?? '',
        score: typeof r.score === 'number' ? r.score : null,
        publishedAt:
          pickString(r, ['published_date', 'date', 'publishedAt']) ?? null,
      });
    }
    return out;
  }
}

function pickString(
  obj: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return null;
}

function err(code: WebSearchError['code'], message: string): WebSearchOutcome {
  return { ok: false, error: { code, message } };
}

function clampMax(maxResults: number | undefined): number {
  const m = maxResults ?? 5;
  if (m < 1) return 1;
  if (m > 20) return 20;
  return m;
}
