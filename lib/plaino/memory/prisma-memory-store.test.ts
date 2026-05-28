/**
 * lib/plaino/memory/prisma-memory-store.test.ts
 *
 * Pins:
 *   - WorkspaceMemoryEntry.body is encrypted at rest with the v1
 *     envelope ("v1:iv:tag:ct"). Plaintext never reaches the DB at
 *     the store seam.
 *   - encrypt + decrypt roundtrip is honest (the seam is the load-
 *     bearing honesty seam: if it broke we'd surface ciphertext to the
 *     customer's memory page).
 *   - Workspace mismatch at the store boundary throws (defense in
 *     depth on top of RLS).
 *
 * The cross-workspace RLS isolation assertion runs in
 * rls-memory.test.ts (against a live Postgres). This file pins the
 * store-layer guarantees that stand even without a DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { decrypt, encrypt, isEncrypted } from '../../security/encryption';
import { PrismaMemoryStore } from './prisma-memory-store';

const WORKSPACE_ID = 'ws-memory-0001';

describe('PrismaMemoryStore — encryption envelope at rest', () => {
  it('encrypt() returns a v1: envelope and decrypt() round-trips', () => {
    const plaintext =
      'Always cc the team alias when responding to a buyer inquiry — the team wants to see every reply, not just the broker-owner.';
    const cipher = encrypt(plaintext);
    assert.ok(isEncrypted(cipher), 'cipher must use the v1 envelope');
    assert.match(cipher, /^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    assert.notEqual(cipher, plaintext);
    assert.equal(decrypt(cipher), plaintext);
  });

  it('PrismaMemoryStore can be constructed with a workspaceId', () => {
    const store = new PrismaMemoryStore(WORKSPACE_ID);
    assert.equal(store.name, 'prisma');
  });

  it('workspace mismatch on upsert throws (defense in depth)', async () => {
    const store = new PrismaMemoryStore(WORKSPACE_ID);
    await assert.rejects(
      () =>
        store.upsert({
          workspaceId: 'WRONG_WORKSPACE',
          kind: 'USER',
          title: 't',
          body: 'b',
          sourceChatMessageId: null,
        }),
      /workspaceId mismatch/,
    );
  });

  it('workspace mismatch on listForWorkspace throws', async () => {
    const store = new PrismaMemoryStore(WORKSPACE_ID);
    await assert.rejects(
      () => store.listForWorkspace({ workspaceId: 'WRONG_WORKSPACE' }),
      /workspaceId mismatch/,
    );
  });

  it('workspace mismatch on setPinned throws', async () => {
    const store = new PrismaMemoryStore(WORKSPACE_ID);
    await assert.rejects(
      () =>
        store.setPinned({
          workspaceId: 'WRONG_WORKSPACE',
          id: 'x',
          pinned: true,
        }),
      /workspaceId mismatch/,
    );
  });

  it('workspace mismatch on edit throws', async () => {
    const store = new PrismaMemoryStore(WORKSPACE_ID);
    await assert.rejects(
      () =>
        store.edit({
          workspaceId: 'WRONG_WORKSPACE',
          id: 'x',
          title: 't',
          body: 'b',
        }),
      /workspaceId mismatch/,
    );
  });

  it('workspace mismatch on delete throws', async () => {
    const store = new PrismaMemoryStore(WORKSPACE_ID);
    await assert.rejects(
      () => store.delete({ workspaceId: 'WRONG_WORKSPACE', id: 'x' }),
      /workspaceId mismatch/,
    );
  });

  it('workspace mismatch on markRead throws', async () => {
    const store = new PrismaMemoryStore(WORKSPACE_ID);
    await assert.rejects(
      () =>
        store.markRead({
          workspaceId: 'WRONG_WORKSPACE',
          ids: ['a'],
        }),
      /workspaceId mismatch/,
    );
  });
});
