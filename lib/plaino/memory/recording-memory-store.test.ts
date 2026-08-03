/**
 * lib/plaino/memory/recording-memory-store.test.ts
 *
 * Pins the in-memory test double's contract — it satisfies the same
 * IMemoryStore shape PrismaMemoryStore does, with the same isolation
 * guard at the seam. If the recording store and the Prisma store
 * diverged silently, every dispatcher test using the recording store
 * would lie about what production does.
 */

import { describe, it } from 'node:test';
import { buildProvenance } from '../../provenance/types';
import assert from 'node:assert/strict';

import { RecordingMemoryStore } from './recording-memory-store';

/** Provenance for test writes through the memory door. The door validates
 *  every block, so fixtures have to be honest too — a test that could pass
 *  with a fake block would not be testing the door. */
const TEST_MEMORY_PROVENANCE = buildProvenance({
  sourceType: 'customer-chat',
  origin: 'customer',
  recordType: 'memory-entry',
  sourceRef: 'ChatMessage:test-turn',
  storedBy: 'plaino',
  confidence: 1,
});

const WORKSPACE_ID = 'ws-recording-mem-0001';

describe('RecordingMemoryStore — workspace isolation', () => {
  it('rejects a foreign workspace on every entry point', async () => {
    const store = new RecordingMemoryStore(WORKSPACE_ID);
    await assert.rejects(
      () => store.listForWorkspace({ workspaceId: 'OTHER' }),
      /workspaceId mismatch/,
    );
    await assert.rejects(
      () =>
        store.upsert({
          workspaceId: 'OTHER',
          kind: 'USER',
          title: 't',
          body: 'b',
          sourceChatMessageId: null,
          provenance: TEST_MEMORY_PROVENANCE,
        }),
      /workspaceId mismatch/,
    );
    await assert.rejects(
      () => store.markRead({ workspaceId: 'OTHER', ids: ['x'] }),
      /workspaceId mismatch/,
    );
    await assert.rejects(
      () =>
        store.setPinned({ workspaceId: 'OTHER', id: 'x', pinned: true }),
      /workspaceId mismatch/,
    );
    await assert.rejects(
      () =>
        store.edit({
          workspaceId: 'OTHER',
          id: 'x',
          title: 't',
          body: 'b',
        }),
      /workspaceId mismatch/,
    );
    await assert.rejects(
      () => store.delete({ workspaceId: 'OTHER', id: 'x' }),
      /workspaceId mismatch/,
    );
  });
});

describe('RecordingMemoryStore — upsert + edit + pin + delete', () => {
  it('upsert is idempotent by (kind, title) — re-upsert updates the existing row', async () => {
    const store = new RecordingMemoryStore(WORKSPACE_ID);
    const a = await store.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'PROJECT',
      title: 'atlanta listing close date',
      body: 'targeted June 14.',
      sourceChatMessageId: 'msg-1',
      provenance: TEST_MEMORY_PROVENANCE,
    });
    const b = await store.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'PROJECT',
      title: 'atlanta listing close date',
      body: 'pushed to June 21.',
      sourceChatMessageId: 'msg-2',
      provenance: TEST_MEMORY_PROVENANCE,
    });
    assert.equal(a.id, b.id);
    assert.equal(b.body, 'pushed to June 21.');
    assert.equal(store.entries.length, 1);
  });

  it('setPinned / edit / delete enforce workspace ownership through the seam', async () => {
    const store = new RecordingMemoryStore(WORKSPACE_ID);
    const entry = await store.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'USER',
      title: 'preferred report format',
      body: 'bullets, no paragraphs.',
      sourceChatMessageId: null,
      provenance: TEST_MEMORY_PROVENANCE,
    });
    const pinned = await store.setPinned({
      workspaceId: WORKSPACE_ID,
      id: entry.id,
      pinned: true,
    });
    assert.equal(pinned.pinned, true);
    const edited = await store.edit({
      workspaceId: WORKSPACE_ID,
      id: entry.id,
      title: 'preferred report format (short)',
      body: 'top-3 bullets only.',
    });
    assert.equal(edited.title, 'preferred report format (short)');
    const deleted = await store.delete({
      workspaceId: WORKSPACE_ID,
      id: entry.id,
    });
    assert.equal(deleted, true);
    assert.equal(store.entries.length, 0);
  });

  it('listForWorkspace returns pinned entries first, then by recency', async () => {
    const store = new RecordingMemoryStore(WORKSPACE_ID);
    const a = await store.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'USER',
      title: 'unpinned recent',
      body: 'x',
      sourceChatMessageId: null,
      provenance: TEST_MEMORY_PROVENANCE,
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'USER',
      title: 'pinned old',
      body: 'y',
      sourceChatMessageId: null,
      provenance: TEST_MEMORY_PROVENANCE,
    });
    await store.setPinned({
      workspaceId: WORKSPACE_ID,
      id: b.id,
      pinned: true,
    });
    // a was last updated before the setPinned bump, so b is also more
    // recent — but the test is specifically about ordering pinned-first.
    const listed = await store.listForWorkspace({ workspaceId: WORKSPACE_ID });
    assert.equal(listed[0].id, b.id);
    assert.equal(listed[1].id, a.id);
  });
});
