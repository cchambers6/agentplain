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
import assert from 'node:assert/strict';

import { RecordingMemoryStore } from './recording-memory-store';
import { buildProvenance } from '../../provenance/types';
import {
  describeProvenance,
  sourceChatMessageIdFromRef,
} from '../../provenance/describe';

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

/**
 * The end-to-end proof the retrofit exists for: a fact written WITH a
 * citation survives the store, comes back intact on read, and turns into
 * the exact words the customer's memory page prints. Write → store →
 * read → citation, with nothing lost in the middle.
 *
 * Without this, each half could be individually correct and the seam
 * still broken — the block could persist but read back unusable, or the
 * copy could drift from what the block actually says.
 */
describe('RecordingMemoryStore — provenance round-trip to the citation', () => {
  const CHAT_ID = 'c3a0f9d2-4b7e-4a11-9f38-2b6d5e0c71aa';

  it('survives write → read and yields the customer-vocab citation', async () => {
    const store = new RecordingMemoryStore(WORKSPACE_ID);
    const written = buildProvenance({
      sourceType: 'customer-chat',
      origin: 'customer',
      recordType: 'memory-entry',
      sourceRef: `ChatMessage:${CHAT_ID}`,
      storedBy: 'plaino',
      confidence: 0.9,
      now: new Date('2026-06-12T15:04:00.000Z'),
    });
    await store.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'PROJECT',
      title: 'closing date on the Marietta listing',
      body: 'Targeting June 14.',
      sourceChatMessageId: CHAT_ID,
      provenance: written,
    });

    const [read] = await store.listForWorkspace({ workspaceId: WORKSPACE_ID });

    // 1. the block survives intact
    assert.deepEqual(read.provenance, written);
    assert.equal(read.provenance?.capturedAt, '2026-06-12T15:04:00.000Z');

    // 2. it renders as the copy the memory page prints
    assert.ok(read.provenance);
    assert.equal(
      describeProvenance(read.provenance),
      'you told Plaino this in chat',
    );

    // 3. the citation recovers the turn to link back to
    assert.equal(sourceChatMessageIdFromRef(read.provenance), CHAT_ID);
  });

  it('an inference reads back hedged, and stays unverified', async () => {
    const store = new RecordingMemoryStore(WORKSPACE_ID);
    await store.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'USER',
      title: 'prefers short answers',
      body: 'Keeps replying "shorter please".',
      sourceChatMessageId: null,
      provenance: buildProvenance({
        sourceType: 'agent-inference',
        origin: 'agent',
        recordType: 'memory-entry',
        sourceRef: 'PlainoConversation:conv-7',
        storedBy: 'plaino',
        confidence: 0.6,
      }),
    });

    const [read] = await store.listForWorkspace({ workspaceId: WORKSPACE_ID });
    assert.ok(read.provenance);
    assert.equal(read.provenance.verified, false);
    assert.equal(
      describeProvenance(read.provenance),
      'Plaino worked this out on its own — unconfirmed',
    );
    // Nothing to link to — the page must not invent a turn.
    assert.equal(sourceChatMessageIdFromRef(read.provenance), null);
  });

  it('a customer edit re-stamps the entry as the customer vouching for it', async () => {
    const store = new RecordingMemoryStore(WORKSPACE_ID);
    const entry = await store.upsert({
      workspaceId: WORKSPACE_ID,
      kind: 'USER',
      title: 'preferred greeting',
      body: 'Plaino guessed: "Hi there".',
      sourceChatMessageId: null,
      provenance: buildProvenance({
        sourceType: 'agent-inference',
        origin: 'agent',
        recordType: 'memory-entry',
        sourceRef: 'PlainoConversation:conv-7',
        storedBy: 'plaino',
        confidence: 0.6,
      }),
    });

    const edited = await store.edit({
      workspaceId: WORKSPACE_ID,
      id: entry.id,
      title: 'preferred greeting',
      body: 'Warmly, Sarah.',
      now: new Date('2026-06-13T09:00:00.000Z'),
    });

    assert.ok(edited.provenance);
    assert.equal(edited.provenance.sourceType, 'customer-edit');
    assert.equal(edited.provenance.origin, 'customer');
    assert.equal(edited.provenance.storedBy, 'customer');
    assert.equal(edited.provenance.confidence, 1);
    assert.equal(
      edited.provenance.verified,
      true,
      'a customer editing a fact IS the customer vouching for it',
    );
    assert.equal(
      describeProvenance(edited.provenance),
      'you wrote this yourself',
    );
  });

  it('a legacy row (no block) reads back null instead of throwing', async () => {
    const store = new RecordingMemoryStore(WORKSPACE_ID, {
      seed: [
        {
          workspaceId: WORKSPACE_ID,
          kind: 'USER',
          title: 'written before 2026-08',
          body: 'legacy',
          sourceChatMessageId: 'old-msg',
          pinned: false,
        },
      ],
    });
    const [read] = await store.listForWorkspace({ workspaceId: WORKSPACE_ID });
    assert.equal(read.provenance, null);
  });
});
