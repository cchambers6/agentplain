/**
 * lib/integrations/web-search/fixture-provider.ts
 *
 * Second (default) implementation of `IWebSearchPort`. Serves a small
 * committed corpus of realistic, real-shaped web results so dev + CI run
 * the FULL research-grounding path with no live credentials. Per the
 * two-implementation rule this keeps the port honest — the HTTP provider
 * is not the only impl.
 *
 * `isLive = false` so the research brief states its grounding honestly
 * (fixture corpus, not live web). The fixture matches on simple keyword
 * overlap so a query like "georgia disclosure requirements" returns the
 * realty-disclosure entries deterministically.
 */

import type {
  IWebSearchPort,
  WebSearchQuery,
  WebSearchResult,
  WebSearchOutcome,
} from './types';

/** Committed corpus — real-shaped public sources across the verticals the
 *  product serves. Used ONLY when no live web-search key is configured. */
export const FIXTURE_WEB_CORPUS: WebSearchResult[] = [
  {
    title: 'Georgia Seller Property Disclosure — what must be disclosed',
    url: 'https://georgiarealtors.example.org/disclosure-guide',
    snippet:
      'Georgia is a caveat-emptor state, but sellers must not actively conceal known material defects. The Seller Property Disclosure Statement (GAR form) covers structural, systems, environmental, and stigma items.',
    score: 0.92,
    publishedAt: '2025-11-03',
  },
  {
    title: 'IRS month-end close: 1099-NEC filing deadlines for tax year 2025',
    url: 'https://irs.example.gov/1099-nec-deadlines-2025',
    snippet:
      '1099-NEC forms reporting nonemployee compensation are due to recipients and the IRS by January 31. Late filing penalties scale with the size of the business and how late the filing is.',
    score: 0.88,
    publishedAt: '2025-12-15',
  },
  {
    title: 'Insurance brokerage E&O: documenting coverage recommendations',
    url: 'https://insurancejournal.example.com/eo-documentation',
    snippet:
      'Errors-and-omissions exposure for brokers is reduced materially by documenting every coverage recommendation the client declined, in writing, contemporaneously with the renewal conversation.',
    score: 0.84,
    publishedAt: '2025-09-22',
  },
  {
    title: 'Home-services pricing benchmarks: HVAC service-call rates 2025',
    url: 'https://tradesreport.example.com/hvac-rates-2025',
    snippet:
      'Median HVAC diagnostic / service-call fees in the Southeast US range $89–$150, with maintenance-plan members typically waived. Emergency after-hours rates run 1.5–2x.',
    score: 0.79,
    publishedAt: '2025-10-10',
  },
  {
    title: 'B2B SaaS intro-call benchmarks: response rates by sequence touch',
    url: 'https://gtmbenchmarks.example.com/intro-call-rates',
    snippet:
      'Across B2B outbound, a three-touch sequence to a warm-ish prospect converts to a booked intro call at roughly 4–9%. Personalized pre-call research correlates with a 20–30% lift in show rate.',
    score: 0.81,
    publishedAt: '2025-08-30',
  },
];

export class FixtureWebSearchProvider implements IWebSearchPort {
  readonly name = 'fixture' as const;
  readonly isLive = false;
  private readonly corpus: WebSearchResult[];

  constructor(corpus: WebSearchResult[] = FIXTURE_WEB_CORPUS) {
    this.corpus = corpus;
  }

  async search(query: WebSearchQuery): Promise<WebSearchOutcome> {
    const max = clampMax(query.maxResults);
    const terms = tokenize(query.query);
    const scored = this.corpus
      .map((r) => ({ r, overlap: keywordOverlap(terms, r) }))
      .filter((x) => x.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || (b.r.score ?? 0) - (a.r.score ?? 0))
      .slice(0, max)
      .map((x) => x.r);

    // When nothing matches the keywords, return the top-scored corpus
    // entries rather than an empty set — the fixture stands in for "the
    // web has something", and an empty result would mask the grounding
    // path in tests. Real providers can legitimately return [].
    const results = scored.length > 0 ? scored : topByScore(this.corpus, max);
    return { ok: true, results };
  }
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function keywordOverlap(terms: string[], r: WebSearchResult): number {
  const hay = `${r.title} ${r.snippet}`.toLowerCase();
  let n = 0;
  for (const t of terms) if (hay.includes(t)) n += 1;
  return n;
}

function topByScore(corpus: WebSearchResult[], max: number): WebSearchResult[] {
  return [...corpus]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, max);
}

function clampMax(maxResults: number | undefined): number {
  const m = maxResults ?? 5;
  if (m < 1) return 1;
  if (m > 20) return 20;
  return m;
}
