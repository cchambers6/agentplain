/**
 * lib/integrations/web-search/web-search.test.ts
 *
 * Wave-5 (theme #11 / ratif #8). Proves the web-search seam: the fixture
 * provider returns real-shaped cited results with no creds; the HTTP
 * provider normalizes a Tavily-shaped response behind the port; and the
 * WebSearchResearchSubstrate maps results into the SupportContextSnippet
 * shape the research skill grounds on.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FixtureWebSearchProvider,
  HttpWebSearchProvider,
  getWebSearchProvider,
} from './index';
import { WebSearchResearchSubstrate } from '../../skills/research-on-demand-general';

describe('FixtureWebSearchProvider', () => {
  it('returns real-shaped cited results matching the query keywords', async () => {
    const provider = new FixtureWebSearchProvider();
    const out = await provider.search({ query: 'georgia disclosure', maxResults: 3 });
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.ok(out.results.length > 0);
    // Every result carries a live-shaped URL + title — the load-bearing
    // "cite reality" contract.
    for (const r of out.results) {
      assert.match(r.url, /^https?:\/\//);
      assert.ok(r.title.length > 0);
    }
    // Keyword match surfaces the disclosure entry first.
    assert.match(out.results[0].title.toLowerCase(), /disclosure/);
  });

  it('isLive is false so the brief names fixture grounding honestly', () => {
    assert.equal(new FixtureWebSearchProvider().isLive, false);
  });

  it('falls back to top-scored corpus when nothing matches', async () => {
    const out = await new FixtureWebSearchProvider().search({
      query: 'zzzzz-nonsense-token',
      maxResults: 2,
    });
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.results.length, 2);
  });
});

describe('HttpWebSearchProvider (Tavily shape)', () => {
  it('normalizes a Tavily-shaped JSON response behind the port', async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          results: [
            {
              title: 'Live source A',
              url: 'https://example.com/a',
              content: 'snippet a',
              score: 0.91,
              published_date: '2026-01-02',
            },
            { title: 'Live source B', url: 'https://example.com/b', content: 'snippet b' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    const provider = new HttpWebSearchProvider({
      vendor: 'tavily',
      apiKey: 'test-key',
      fetchImpl: fakeFetch,
    });
    assert.equal(provider.isLive, true);
    const out = await provider.search({ query: 'anything', maxResults: 5 });
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.results.length, 2);
    assert.equal(out.results[0].url, 'https://example.com/a');
    assert.equal(out.results[0].score, 0.91);
    assert.equal(out.results[0].publishedAt, '2026-01-02');
    assert.equal(out.results[1].score, null);
  });

  it('maps a 429 to a RATE_LIMITED outcome (no throw)', async () => {
    const fakeFetch: typeof fetch = async () => new Response('', { status: 429 });
    const provider = new HttpWebSearchProvider({
      vendor: 'tavily',
      apiKey: 'k',
      fetchImpl: fakeFetch,
    });
    const out = await provider.search({ query: 'x' });
    assert.equal(out.ok, false);
    if (out.ok) return;
    assert.equal(out.error.code, 'RATE_LIMITED');
  });
});

describe('getWebSearchProvider factory', () => {
  it('defaults to the fixture provider with no env', () => {
    const prev = process.env.WEB_SEARCH_PROVIDER;
    delete process.env.WEB_SEARCH_PROVIDER;
    try {
      assert.equal(getWebSearchProvider().name, 'fixture');
    } finally {
      if (prev !== undefined) process.env.WEB_SEARCH_PROVIDER = prev;
    }
  });

  it('falls back to fixture when tavily selected but no key set (CONNER ACTION surfaced via isLive)', () => {
    const prevP = process.env.WEB_SEARCH_PROVIDER;
    const prevK = process.env.TAVILY_API_KEY;
    process.env.WEB_SEARCH_PROVIDER = 'tavily';
    delete process.env.TAVILY_API_KEY;
    try {
      const p = getWebSearchProvider();
      assert.equal(p.name, 'fixture');
      assert.equal(p.isLive, false);
    } finally {
      if (prevP !== undefined) process.env.WEB_SEARCH_PROVIDER = prevP;
      else delete process.env.WEB_SEARCH_PROVIDER;
      if (prevK !== undefined) process.env.TAVILY_API_KEY = prevK;
    }
  });
});

describe('WebSearchResearchSubstrate', () => {
  it('maps web results into SupportContextSnippet with live source URLs', async () => {
    const sub = new WebSearchResearchSubstrate(new FixtureWebSearchProvider());
    const snippets = await sub.searchForResearch({
      workspaceId: 'ws-1',
      query: '1099 month-end close deadlines',
      k: 3,
    });
    assert.ok(snippets.length > 0);
    for (const s of snippets) {
      assert.ok(s.sourceUrl && s.sourceUrl.startsWith('http'));
      assert.ok(typeof s.similarity === 'number');
    }
    // The substrate exposes whether grounding is live so the skill can
    // name it honestly.
    assert.equal(sub.isLive, false);
  });
});
