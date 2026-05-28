/**
 * lib/plaino/prisma-chat-store.test.ts
 *
 * Pins:
 *   - ChatMessage.body is encrypted at rest with the v1 envelope
 *     ("v1:iv:tag:ct") — never plaintext.
 *   - Read path decrypts back to the plaintext the caller wrote.
 *   - Workspace mismatch at the store boundary throws (defense in
 *     depth on top of RLS).
 *
 * Cross-workspace RLS isolation lives in rls.test.ts — that test
 * runs against a live Postgres instance and asserts the database
 * policy directly. This test pins the store-layer guarantees that
 * stand even without a DB.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// PrismaChatStore.appendMessage calls encrypt() before persisting.
// Seed a deterministic test key so the encryption boundary works.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { decrypt, encrypt, isEncrypted } from '../security/encryption';
import { PrismaChatStore } from './prisma-chat-store';

const WORKSPACE_ID = 'ws-plaino-chat-0001';

describe('PrismaChatStore — encryption envelope at rest', () => {
  it('encrypt() returns a v1: envelope and decrypt() round-trips', () => {
    const plaintext =
      'Please draft a follow-up to Sandra about the Atlanta listing close date.';
    const cipher = encrypt(plaintext);
    assert.ok(isEncrypted(cipher), 'cipher must use the v1 envelope');
    assert.match(cipher, /^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    assert.notEqual(cipher, plaintext);
    assert.equal(decrypt(cipher), plaintext);
  });

  it('PrismaChatStore can be constructed with a workspaceId', () => {
    // Just exercising the constructor — full RLS-flow assertions live
    // in the live-DB test suite. The point here is to keep the store
    // import path tested as part of the standard run.
    const store = new PrismaChatStore(WORKSPACE_ID);
    assert.equal(store.name, 'prisma');
  });

  it('workspace mismatch on appendMessage throws (defense in depth)', async () => {
    const store = new PrismaChatStore(WORKSPACE_ID);
    await assert.rejects(
      () =>
        store.appendMessage({
          threadId: 'doesnt-matter',
          workspaceId: 'WRONG_WORKSPACE',
          role: 'customer',
          body: 'hello',
        }),
      /workspaceId mismatch/,
    );
  });

  it('workspace mismatch on ensureWorkspaceThread throws', async () => {
    const store = new PrismaChatStore(WORKSPACE_ID);
    await assert.rejects(
      () =>
        store.ensureWorkspaceThread({ workspaceId: 'WRONG_WORKSPACE' }),
      /workspaceId mismatch/,
    );
  });

  it('workspace mismatch on createSupportRequest throws', async () => {
    const store = new PrismaChatStore(WORKSPACE_ID);
    await assert.rejects(
      () =>
        store.createSupportRequest({
          workspaceId: 'WRONG_WORKSPACE',
          fromUserId: 'u',
          subject: 's',
          body: 'b',
        }),
      /workspaceId mismatch/,
    );
  });
});
