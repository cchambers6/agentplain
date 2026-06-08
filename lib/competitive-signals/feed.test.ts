/**
 * lib/competitive-signals/feed.test.ts
 *
 * Proves the competitive-signal feed:
 *   1. produces real-shaped, grounded signals from the fixture provider;
 *   2. defaults to the fixture provider (flag off) and names the live-research
 *      gap so a fixture-backed digest is never presented as live truth;
 *   3. the live web provider falls back to fixtures + reports isLive=false when
 *      no search port is injected, and normalizes real hits when one is;
 *   4. dedupes by signal id and assembles one section per vertical head.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FixtureSignalProvider,
  WebResearchSignalProvider,
  buildCompetitiveSignalDigest,
  getCompetitiveSignalProvider,
  renderDigestText,
  VERTICAL_HEAD_SLUG,
  COMPETITIVE_SIGNAL_DISCIPLINE,
  type CompetitiveSignal,
  type WebResearchSearchPort,
} from './index';

const NOW = new Date('2026-06-07T00:00:00Z');

describe('FixtureSignalProvider', () => {
  it('returns real-shaped, grounded signals for a vertical', async () => {
    const provider = new FixtureSignalProvider({ now: NOW });
    const res = await provider.fetchSignals({
      vertical: 'realty',
      lookbackDays: 90,
      limit: 8,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.ok(res.value.length > 0, 'expected realty fixtures within 90 days');
    for (const sig of res.value) {
      assert.equal(sig.vertical, 'realty');
      assert.ok(sig.headline.length > 0);
      assert.ok(sig.summary.length > 0);
      // Grounding contract: every signal carries a source + url.
      assert.ok(sig.sourceUrl && sig.sourceUrl.startsWith('http'));
      assert.ok(sig.source.length > 0);
      assert.match(sig.observedAt, /^\d{4}-\d{2}-\d{2}/);
    }
  });

  it('respects the lookback window — a tight window drops older signals', async () => {
    const provider = new FixtureSignalProvider({ now: NOW });
    const wide = await provider.fetchSignals({ vertical: 'realty', lookbackDays: 90, limit: 8 });
    const tight = await provider.fetchSignals({ vertical: 'realty', lookbackDays: 7, limit: 8 });
    assert.equal(wide.ok && tight.ok, true);
    if (!wide.ok || !tight.ok) return;
    assert.ok(
      tight.value.length < wide.value.length,
      'a 7-day window should drop the older fixtures the 90-day window keeps',
    );
  });

  it('sorts high-severity signals first', async () => {
    const provider = new FixtureSignalProvider({ now: NOW });
    const res = await provider.fetchSignals({ vertical: 'realty', lookbackDays: 90, limit: 8 });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const ranks = res.value.map((s) => (s.severity === 'high' ? 3 : s.severity === 'medium' ? 2 : 1));
    const sorted = [...ranks].sort((a, b) => b - a);
    assert.deepEqual(ranks, sorted, 'signals should be severity-descending');
  });
});

describe('getCompetitiveSignalProvider — selection', () => {
  it('defaults to the fixture provider (flag off)', () => {
    const provider = getCompetitiveSignalProvider({ provider: 'fixture' });
    assert.equal(provider.name, 'fixture');
    assert.equal(provider.isLive, false);
  });

  it('returns a non-live web provider when no search port is injected', () => {
    const provider = getCompetitiveSignalProvider({ provider: 'web' });
    assert.equal(provider.name, 'web-research');
    assert.equal(provider.isLive, false, 'web provider with no dispatch is not live');
  });
});

describe('WebResearchSignalProvider', () => {
  it('falls back to fixtures + stays non-live when no search port is wired', async () => {
    const provider = new WebResearchSignalProvider();
    assert.equal(provider.isLive, false);
    const res = await provider.fetchSignals({ vertical: 'realty', lookbackDays: 90, limit: 8 });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.ok(res.value.length > 0, 'fixture fallback should produce signals, never silently empty');
  });

  it('normalizes real hits + reports isLive when a search port is injected', async () => {
    const port: WebResearchSearchPort = {
      name: 'stub-search',
      async search() {
        return [
          {
            title: 'Competitor X raises a Series B for brokerage AI',
            snippet: 'The startup raised funding to expand its product.',
            url: 'https://example.com/news/1',
            source: 'Example News',
            publishedAt: '2026-06-03',
          },
        ];
      },
    };
    const provider = new WebResearchSignalProvider({ search: port });
    assert.equal(provider.isLive, true, 'a wired search port makes the provider live');
    const res = await provider.fetchSignals({ vertical: 'realty', lookbackDays: 90, limit: 8 });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.length, 1);
    assert.equal(res.value[0].category, 'funding', 'funding language should classify as funding');
    assert.equal(res.value[0].sourceUrl, 'https://example.com/news/1');
    assert.equal(res.value[0].vertical, 'realty');
  });

  it('surfaces a provider error when the live search throws', async () => {
    const port: WebResearchSearchPort = {
      name: 'flaky-search',
      async search() {
        throw new Error('upstream 503');
      },
    };
    const provider = new WebResearchSignalProvider({ search: port });
    const res = await provider.fetchSignals({ vertical: 'realty', lookbackDays: 90, limit: 8 });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'PROVIDER_UNAVAILABLE');
  });
});

describe('buildCompetitiveSignalDigest', () => {
  it('assembles one section per vertical head and totals signals', async () => {
    const provider = new FixtureSignalProvider({ now: NOW });
    const { digest, failures } = await buildCompetitiveSignalDigest({
      provider,
      now: NOW,
    });
    assert.equal(failures.length, 0);
    assert.equal(digest.sections.length, 3, 'realty + insurance + home-services');
    for (const section of digest.sections) {
      assert.equal(section.headSlug, VERTICAL_HEAD_SLUG[section.vertical]);
    }
    const computedTotal = digest.sections.reduce((n, s) => n + s.signals.length, 0);
    assert.equal(digest.totalSignals, computedTotal);
    assert.ok(digest.totalSignals > 0);
  });

  it('names the live-research gap when the provider is not live', async () => {
    const provider = new FixtureSignalProvider({ now: NOW });
    const { digest } = await buildCompetitiveSignalDigest({ provider, now: NOW });
    assert.equal(digest.providerIsLive, false);
    assert.ok(
      digest.gaps.some((g) => /live web research is not dispatched/i.test(g)),
      'a fixture-backed digest must NAME the live-research gap',
    );
  });

  it('records an empty section as a named gap, not a fabricated quiet quarter', async () => {
    const emptyProvider = {
      name: 'empty',
      isLive: true,
      async fetchSignals() {
        return { ok: true as const, value: [] as CompetitiveSignal[] };
      },
    };
    const { digest } = await buildCompetitiveSignalDigest({
      provider: emptyProvider,
      verticals: ['realty'],
      now: NOW,
    });
    assert.equal(digest.totalSignals, 0);
    assert.ok(digest.sections[0].gaps.some((g) => /no competitive movements/i.test(g)));
    // Live provider → no live-research feed gap.
    assert.equal(digest.gaps.length, 0);
  });

  it('dedupes signals by id', async () => {
    const dupSignal: CompetitiveSignal = {
      id: 'dup-1',
      vertical: 'realty',
      category: 'market-move',
      severity: 'low',
      headline: 'dup',
      summary: 'dup',
      sourceUrl: 'https://example.com',
      source: 'Example',
      observedAt: '2026-06-01',
    };
    const dupProvider = {
      name: 'dup',
      isLive: true,
      async fetchSignals() {
        return { ok: true as const, value: [dupSignal, { ...dupSignal }] };
      },
    };
    const { digest } = await buildCompetitiveSignalDigest({
      provider: dupProvider,
      verticals: ['realty'],
      now: NOW,
    });
    assert.equal(digest.sections[0].signals.length, 1, 'duplicate ids collapse to one');
  });

  it('renders a text digest carrying the discipline + no-outbound note', async () => {
    const provider = new FixtureSignalProvider({ now: NOW });
    const { digest } = await buildCompetitiveSignalDigest({ provider, now: NOW });
    const text = renderDigestText(digest);
    assert.match(text, /COMPETITIVE-SIGNAL FEED/);
    assert.match(text, new RegExp(`discipline=${COMPETITIVE_SIGNAL_DISCIPLINE}`));
    assert.match(text, /No outbound/);
    assert.match(text, new RegExp(VERTICAL_HEAD_SLUG.realty));
  });
});
