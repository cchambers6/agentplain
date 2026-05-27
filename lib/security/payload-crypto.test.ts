/**
 * lib/security/payload-crypto.test.ts
 *
 * Tests for the WorkApprovalQueueItem.payload + HandoffLogEntry.payload
 * at-rest encryption layer. Covers the four scenarios in the data-
 * privacy audit follow-up plan (§4 / §2.5):
 *
 *   1. Round-trip — write encrypted, read back structured payload at the
 *      boundary.
 *   2. The approvals UI's `renderApprovalPayload` still sees the
 *      structured payload through the encryption seam (no behavior
 *      change at the renderer's input).
 *   3. Backfill encrypts a legacy plaintext row, then is idempotent on
 *      re-run (skipped via the envelope shape).
 *   4. A corrupt / undecryptable envelope degrades to `null` rather than
 *      crashing the approvals page render.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import { renderApprovalPayload } from '@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload';
import { encrypt } from './encryption';
import {
  decryptPayloadForRead,
  encryptPayloadForWrite,
  isEncryptedPayload,
} from './payload-crypto';
import {
  backfillPayloads,
  type PayloadBackfillRow,
} from './payload-crypto-backfill';

const TEST_KEY_HEX = randomBytes(32).toString('hex');
let savedKey: string | undefined;

function setupKey(): void {
  savedKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
}
function teardownKey(): void {
  if (savedKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = savedKey;
}

const SAMPLE_DRAFT_PAYLOAD = {
  subject: 'Re: 1247 Magnolia Dr',
  body: 'Hi Sarah — thanks for the note. Happy to send the disclosures.',
  tone: 'warm',
  confidence: 0.82,
  threadId: 'thread-123',
  inboundSummary: 'buyer asking for disclosures + financing terms',
};

describe('payload-crypto: round-trip (write → enveloped-at-rest → read → structured payload)', () => {
  beforeEach(setupKey);
  afterEach(teardownKey);

  it('round-trips a draft approval payload', () => {
    const stored = encryptPayloadForWrite(SAMPLE_DRAFT_PAYLOAD);
    assert.equal(isEncryptedPayload(stored), true, 'stored shape must be an envelope');
    const decrypted = decryptPayloadForRead(stored);
    assert.deepEqual(decrypted, SAMPLE_DRAFT_PAYLOAD);
  });

  it('round-trips a handoff payload with nested object + nulls', () => {
    const payload = {
      step: 'draft',
      ok: true,
      summary: 'drafted reply for buyer inquiry',
      durationMs: 1234,
      errorCode: null,
      webhookEventId: 'evt-xyz-1',
      runId: '2026-05-27T14:00:00.000Z',
      nested: { foo: ['bar', 'baz'], n: 7 },
    };
    const stored = encryptPayloadForWrite(payload);
    assert.deepEqual(decryptPayloadForRead(stored), payload);
  });

  it('round-trips utf-8 content (emoji + accented chars + multi-byte)', () => {
    const payload = {
      subject: 'Closing — soñé con la oferta 🏠',
      body: 'Customer note 你好',
    };
    const stored = encryptPayloadForWrite(payload);
    assert.deepEqual(decryptPayloadForRead(stored), payload);
  });

  it('produces distinct envelopes for the same payload (fresh IV per call)', () => {
    const a = encryptPayloadForWrite(SAMPLE_DRAFT_PAYLOAD) as { enc: string };
    const b = encryptPayloadForWrite(SAMPLE_DRAFT_PAYLOAD) as { enc: string };
    assert.notEqual(a.enc, b.enc, 'IV must rotate per encrypt');
    assert.deepEqual(decryptPayloadForRead(a), SAMPLE_DRAFT_PAYLOAD);
    assert.deepEqual(decryptPayloadForRead(b), SAMPLE_DRAFT_PAYLOAD);
  });
});

describe('payload-crypto: encryptPayloadForWrite is idempotent', () => {
  beforeEach(setupKey);
  afterEach(teardownKey);

  it('returns an already-enveloped value unchanged (no double-encrypt)', () => {
    const once = encryptPayloadForWrite(SAMPLE_DRAFT_PAYLOAD);
    const twice = encryptPayloadForWrite(once);
    assert.equal(twice, once, 'second call must short-circuit on the envelope shape');
    assert.deepEqual(decryptPayloadForRead(twice), SAMPLE_DRAFT_PAYLOAD);
  });

  it('handles null / undefined by writing an empty object envelope', () => {
    const stored = encryptPayloadForWrite(null);
    // {} round-trips as {}; the schema-level field is non-null so this
    // branch is defensive.
    assert.deepEqual(stored, {});
  });
});

describe('payload-crypto: decryptPayloadForRead degrades gracefully', () => {
  beforeEach(setupKey);
  afterEach(teardownKey);

  it('passes a legacy plaintext payload through unchanged (no envelope → no decrypt attempt)', () => {
    const legacy = { subject: 'pre-encryption row', body: 'plaintext body' };
    assert.deepEqual(decryptPayloadForRead(legacy), legacy);
  });

  it('returns null when ciphertext is corrupt (does NOT throw)', () => {
    const corrupt = { enc: 'v1:deadbeefdeadbeefdeadbe:deadbeefdeadbeefdeadbeefdeadbeef:abcd' };
    assert.equal(decryptPayloadForRead(corrupt), null);
  });

  it('passes through legacy values whose shape is not an envelope', () => {
    // No v1 marker inside `enc` → treated as legacy plaintext payload,
    // returned unchanged for the renderer to soft-parse.
    const legacyShape = { enc: 'not-an-envelope' };
    assert.deepEqual(decryptPayloadForRead(legacyShape), legacyShape);
  });

  it('returns null when envelope ciphertext is structurally malformed', () => {
    assert.equal(decryptPayloadForRead({ enc: 'v1:::' }), null);
  });

  it('returns null when ENCRYPTION_KEY is absent (cannot decrypt)', () => {
    const stored = encryptPayloadForWrite(SAMPLE_DRAFT_PAYLOAD);
    delete process.env.ENCRYPTION_KEY;
    assert.equal(decryptPayloadForRead(stored), null);
  });

  it('returns null when key is rotated to a different value', () => {
    const stored = encryptPayloadForWrite(SAMPLE_DRAFT_PAYLOAD);
    process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
    assert.equal(decryptPayloadForRead(stored), null);
  });

  it('rejects an envelope whose ciphertext decrypts to non-JSON', () => {
    // Craft an envelope by encrypting non-JSON content via the same
    // codec — proves the JSON.parse step is what degrades, not the
    // decryption itself. Defends the corrupt-on-disk branch.
    const stored = { enc: encrypt('this is not JSON {') };
    assert.equal(decryptPayloadForRead(stored), null);
  });
});

describe('payload-crypto: approvals renderer sees structured payload through the seam', () => {
  beforeEach(setupKey);
  afterEach(teardownKey);

  it('BUYER_INQUIRY_REPLY_DRAFT — renderer surfaces subject + body after decrypt', () => {
    const stored = encryptPayloadForWrite(SAMPLE_DRAFT_PAYLOAD);
    const decrypted = decryptPayloadForRead(stored);
    const rendered = renderApprovalPayload('BUYER_INQUIRY_REPLY_DRAFT', decrypted);
    assert.ok(
      rendered.body.some((line) => line.includes('disclosures')),
      'renderer must see the decrypted draft body',
    );
    assert.equal(rendered.tone, 'warm');
  });

  it('corrupt envelope renders the calm fallback line, not a crash', () => {
    const rendered = renderApprovalPayload(
      'BUYER_INQUIRY_REPLY_DRAFT',
      decryptPayloadForRead({ enc: 'v1:dead:beef:cafe' }),
    );
    // The renderer's empty-payload branch surfaces a placeholder line
    // rather than 500-ing the page.
    assert.ok(rendered.body.length > 0, 'fallback body line is present');
  });
});

describe('payload-crypto: isEncryptedPayload shape detection is strict', () => {
  it('returns false for non-objects, arrays, and the wrong shape', () => {
    assert.equal(isEncryptedPayload(null), false);
    assert.equal(isEncryptedPayload(undefined), false);
    assert.equal(isEncryptedPayload('v1:x:y:z'), false);
    assert.equal(isEncryptedPayload([{ enc: 'v1:a:b:c' }]), false);
    assert.equal(isEncryptedPayload({ enc: 'v1:a:b:c', extra: 1 }), false);
    assert.equal(isEncryptedPayload({ enc: 'v0:legacy' }), false);
    assert.equal(isEncryptedPayload({ notEnc: 'something' }), false);
  });

  it('returns true only for { enc: v1:... } exactly', () => {
    assert.equal(
      isEncryptedPayload({ enc: 'v1:0011:2233:44' }),
      true,
    );
  });
});

describe('payload-crypto backfill: encrypts legacy plaintext rows and is idempotent', () => {
  beforeEach(setupKey);
  afterEach(teardownKey);

  function makeStore(rows: PayloadBackfillRow[]) {
    const byId = new Map(rows.map((r) => [r.id, { ...r }]));
    return {
      byId,
      async listPage(cursor: string | null): Promise<PayloadBackfillRow[]> {
        const all = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
        if (cursor === null) return all.slice(0, 100);
        const i = all.findIndex((r) => r.id === cursor);
        if (i < 0) return [];
        return all.slice(i + 1, i + 1 + 100);
      },
      async updateRow(id: string, envelope: unknown): Promise<void> {
        const r = byId.get(id);
        if (!r) throw new Error(`fixture missing id ${id}`);
        r.payload = envelope;
      },
    };
  }

  it('encrypts every legacy row on first pass', async () => {
    const store = makeStore([
      { id: '01', payload: { body: 'plaintext one' } },
      { id: '02', payload: { body: 'plaintext two' } },
      { id: '03', payload: { body: 'plaintext three' } },
    ]);
    const stats = await backfillPayloads({
      batchSize: 100,
      listPage: store.listPage,
      updateRow: store.updateRow,
    });
    assert.equal(stats.scanned, 3);
    assert.equal(stats.encrypted, 3);
    assert.equal(stats.alreadyEncrypted, 0);
    assert.equal(stats.failed, 0);
    for (const row of store.byId.values()) {
      assert.equal(
        isEncryptedPayload(row.payload),
        true,
        `row ${row.id} must be enveloped`,
      );
    }
  });

  it('is idempotent on re-run — every row hits the alreadyEncrypted short-circuit', async () => {
    const store = makeStore([
      { id: '01', payload: { body: 'plaintext one' } },
      { id: '02', payload: { body: 'plaintext two' } },
    ]);
    await backfillPayloads({
      batchSize: 100,
      listPage: store.listPage,
      updateRow: store.updateRow,
    });
    const second = await backfillPayloads({
      batchSize: 100,
      listPage: store.listPage,
      updateRow: store.updateRow,
    });
    assert.equal(second.scanned, 2);
    assert.equal(second.encrypted, 0);
    assert.equal(second.alreadyEncrypted, 2);
    assert.equal(second.failed, 0);
  });

  it('dry-run does not write — counts plaintext rows + leaves the store untouched', async () => {
    const store = makeStore([
      { id: '01', payload: { body: 'plaintext one' } },
      { id: '02', payload: { body: 'plaintext two' } },
    ]);
    const stats = await backfillPayloads({
      dryRun: true,
      batchSize: 100,
      listPage: store.listPage,
      updateRow: store.updateRow,
    });
    assert.equal(stats.scanned, 2);
    assert.equal(stats.encrypted, 2);
    for (const row of store.byId.values()) {
      assert.equal(
        isEncryptedPayload(row.payload),
        false,
        `dry-run must NOT persist envelopes`,
      );
    }
  });

  it('continues past a row whose update throws (resilience)', async () => {
    const store = makeStore([
      { id: '01', payload: { body: 'plaintext one' } },
      { id: '02', payload: { body: 'plaintext two' } },
      { id: '03', payload: { body: 'plaintext three' } },
    ]);
    const failingUpdate = async (id: string, envelope: unknown): Promise<void> => {
      if (id === '02') throw new Error('simulated DB conflict');
      await store.updateRow(id, envelope);
    };
    const stats = await backfillPayloads({
      batchSize: 100,
      listPage: store.listPage,
      updateRow: failingUpdate,
    });
    assert.equal(stats.scanned, 3);
    assert.equal(stats.encrypted, 2);
    assert.equal(stats.failed, 1);
    assert.equal(isEncryptedPayload(store.byId.get('01')!.payload), true);
    assert.equal(isEncryptedPayload(store.byId.get('02')!.payload), false);
    assert.equal(isEncryptedPayload(store.byId.get('03')!.payload), true);
  });
});
