/**
 * lib/memory/tiering.test.ts
 *
 * Pins the pure tiering decision logic and the object-store offload/hydrate
 * round-trip (against InMemoryObjectStore — no DB). The DB-mutating
 * archive/restore/sweep are covered by the live-DB integration test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryObjectStore } from '../storage/object-store';
import {
  COLD_TOMBSTONE,
  HOT_MAX_AGE_DAYS,
  WARM_MAX_AGE_DAYS,
  ageDaysOf,
  classifyTier,
  desiredTier,
  fetchArchivedBody,
  hydrateBody,
  lastActivityAt,
  offloadBody,
} from './tiering';

const daysAgo = (n: number, from: Date): Date => new Date(from.getTime() - n * 24 * 60 * 60 * 1000);

describe('tiering — classifyTier', () => {
  it('pinned is always HOT regardless of age', () => {
    assert.equal(classifyTier(0, true), 'HOT');
    assert.equal(classifyTier(365, true), 'HOT');
  });
  it('unpinned ages HOT → WARM → COLD at the boundaries', () => {
    assert.equal(classifyTier(0, false), 'HOT');
    assert.equal(classifyTier(HOT_MAX_AGE_DAYS - 0.1, false), 'HOT');
    assert.equal(classifyTier(HOT_MAX_AGE_DAYS, false), 'WARM');
    assert.equal(classifyTier(WARM_MAX_AGE_DAYS - 0.1, false), 'WARM');
    assert.equal(classifyTier(WARM_MAX_AGE_DAYS, false), 'COLD');
    assert.equal(classifyTier(400, false), 'COLD');
  });
});

describe('tiering — age helpers', () => {
  const now = new Date('2026-06-17T00:00:00.000Z');
  it('lastActivityAt picks the freshest of created/updated/lastRead', () => {
    const entry = {
      createdAt: daysAgo(100, now),
      updatedAt: daysAgo(50, now),
      lastReadAt: daysAgo(3, now),
    };
    assert.equal(lastActivityAt(entry).getTime(), daysAgo(3, now).getTime());
  });
  it('lastActivityAt tolerates a null lastReadAt', () => {
    const entry = {
      createdAt: daysAgo(100, now),
      updatedAt: daysAgo(50, now),
      lastReadAt: null,
    };
    assert.equal(lastActivityAt(entry).getTime(), daysAgo(50, now).getTime());
  });
  it('desiredTier uses age + pinned', () => {
    const stale = { createdAt: daysAgo(200, now), updatedAt: daysAgo(200, now), lastReadAt: null };
    assert.equal(desiredTier({ ...stale, pinned: false }, now), 'COLD');
    assert.equal(desiredTier({ ...stale, pinned: true }, now), 'HOT');
    const fresh = { createdAt: daysAgo(1, now), updatedAt: daysAgo(1, now), lastReadAt: null };
    assert.equal(desiredTier({ ...fresh, pinned: false }, now), 'HOT');
    assert.ok(ageDaysOf(stale, now) > WARM_MAX_AGE_DAYS);
  });
});

describe('tiering — offload / fetch / hydrate round-trip', () => {
  it('offloadBody writes ciphertext the fetch reads back identically', async () => {
    const store = new InMemoryObjectStore();
    const ciphertext = 'v1:1111:2222:deadbeefcafe';
    const off = await offloadBody({
      store,
      workspaceId: 'ws-1',
      entryId: 'entry-1',
      ciphertext,
    });
    assert.ok(off.ok);
    assert.match(off.ok ? off.ref : '', /^mem:\/\/ws\/ws-1\/entries\/entry-1\.enc$/);

    const back = await fetchArchivedBody({ store, workspaceId: 'ws-1', entryId: 'entry-1' });
    assert.ok(back.ok);
    assert.equal(back.ok && back.ciphertext, ciphertext);
  });

  it('hydrateBody returns the inline body for non-cold entries without touching the store', async () => {
    const store = new InMemoryObjectStore();
    const res = await hydrateBody(
      { id: 'e', workspaceId: 'w', body: 'v1:inline', tier: 'HOT', pinned: false, archivedRef: null },
      store,
    );
    assert.ok(res.ok);
    assert.equal(res.ok && res.ciphertext, 'v1:inline');
  });

  it('hydrateBody fetches from the store for a cold (tombstoned) entry', async () => {
    const store = new InMemoryObjectStore();
    await offloadBody({ store, workspaceId: 'w', entryId: 'e', ciphertext: 'v1:cold' });
    const res = await hydrateBody(
      {
        id: 'e',
        workspaceId: 'w',
        body: COLD_TOMBSTONE,
        tier: 'COLD',
        pinned: false,
        archivedRef: 'mem://ws/w/entries/e.enc',
      },
      store,
    );
    assert.ok(res.ok);
    assert.equal(res.ok && res.ciphertext, 'v1:cold');
  });

  it('COLD_TOMBSTONE is deliberately not a valid v1 envelope', () => {
    assert.doesNotMatch(COLD_TOMBSTONE, /^v1:/);
  });
});
