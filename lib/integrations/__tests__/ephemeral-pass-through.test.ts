/**
 * Behavior tests for the ephemeral connector pass-through layer (DI — no DB).
 *
 * Proves the data-minimization contract end-to-end for a connector-shaped
 * fetch: the result is returned to the caller, a "did not store" breadcrumb
 * is recorded, the short-TTL in-memory cache serves a repeat read and expires,
 * and NOTHING is persisted (the only side effect is the injected recorder).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryEphemeralCache,
  MAX_CACHE_TTL_MS,
  passThroughFetch,
} from '../ephemeral-pass-through';

const WS = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

interface FakeMessage {
  id: string;
  subject: string;
}

describe('passThroughFetch', () => {
  it('returns the fetched value and records a "did not store" breadcrumb', async () => {
    const breadcrumbs: Array<Record<string, unknown>> = [];
    const messages: FakeMessage[] = [
      { id: '1', subject: 'a' },
      { id: '2', subject: 'b' },
    ];

    const result = await passThroughFetch<FakeMessage[]>(
      { workspaceId: WS, provider: 'GOOGLE', resource: 'inbox' },
      async () => messages,
      { recordFetch: async (a) => void breadcrumbs.push(a), now: () => 0 },
    );

    assert.deepEqual(result, messages);
    assert.equal(breadcrumbs.length, 1);
    assert.equal(breadcrumbs[0].workspaceId, WS);
    assert.equal(breadcrumbs[0].provider, 'GOOGLE');
    assert.equal(breadcrumbs[0].resource, 'inbox');
    assert.equal(breadcrumbs[0].itemCount, 2);
  });

  it('serves a repeat read from the in-memory cache within the TTL, then expires', async () => {
    let calls = 0;
    let clock = 0;
    const cache = new InMemoryEphemeralCache({ now: () => clock });
    const run = () =>
      passThroughFetch<FakeMessage[]>(
        { workspaceId: WS, provider: 'HUBSPOT', resource: 'deals' },
        async () => {
          calls += 1;
          return [{ id: String(calls), subject: 'x' }];
        },
        { cacheKey: 'q1', ttlMs: 1000, cache, audit: false, now: () => clock },
      );

    const first = await run();
    const second = await run(); // within TTL → cached, no new fetch
    assert.equal(calls, 1);
    assert.deepEqual(second, first);

    clock = 1001; // past TTL
    const third = await run();
    assert.equal(calls, 2);
    assert.notDeepEqual(third, first);
  });

  it('never caches when no cacheKey is given (default safest behavior)', async () => {
    let calls = 0;
    const cache = new InMemoryEphemeralCache();
    const run = () =>
      passThroughFetch(
        { workspaceId: WS, provider: 'GOOGLE', resource: 'inbox' },
        async () => {
          calls += 1;
          return calls;
        },
        { cache, audit: false },
      );
    await run();
    await run();
    assert.equal(calls, 2);
  });

  it('clamps cache TTL to the 30-minute ceiling', () => {
    let clock = 0;
    const cache = new InMemoryEphemeralCache({ now: () => clock });
    cache.set('k', 'v', MAX_CACHE_TTL_MS * 10);
    clock = MAX_CACHE_TTL_MS - 1;
    assert.equal(cache.get('k'), 'v');
    clock = MAX_CACHE_TTL_MS + 1;
    assert.equal(cache.get('k'), undefined);
  });

  it('isolates the cache by workspace and clears a workspace on demand', () => {
    const cache = new InMemoryEphemeralCache();
    cache.set('ws1:GOOGLE:inbox:k', 1, 1000);
    cache.set('ws2:GOOGLE:inbox:k', 2, 1000);
    cache.clearWorkspace('ws1');
    assert.equal(cache.get('ws1:GOOGLE:inbox:k'), undefined);
    assert.equal(cache.get('ws2:GOOGLE:inbox:k'), 2);
  });
});
