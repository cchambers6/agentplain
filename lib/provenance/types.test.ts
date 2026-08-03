/**
 * lib/provenance/types.test.ts
 *
 * The core "a provenance-less write is REJECTED" proof.
 *
 * These tests are the reason the rest of the retrofit can be trusted:
 * every enforced write door funnels through `assertProvenance`, so if
 * this file passes, a malformed block cannot reach the database from
 * ANY of the four doors. Each rejection case below corresponds to a real
 * way a writer could lie — a missing citation, a made-up hash, a
 * confidence above certainty, an inference claiming to be verified, or a
 * block built for a different table.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  assertProvenance,
  buildProvenance,
  parseStoredProvenance,
  ProvenanceError,
  provenanceSchema,
  type Provenance,
} from './types';
import { describeProvenance, sourceChatMessageIdFromRef } from './describe';

const HASH = 'a'.repeat(64);
const CHAT_ID = '4e3f8c1a-0b21-4a7f-9f0e-1c2d3e4f5a6b';

function validBlock(overrides: Partial<Provenance> = {}): Record<string, unknown> {
  return {
    sourceType: 'customer-chat',
    origin: 'customer',
    recordType: 'memory-entry',
    sourceRef: `ChatMessage:${CHAT_ID}`,
    storedBy: 'plaino',
    sourceHash: null,
    confidence: 0.9,
    verified: false,
    capturedAt: '2026-08-02T12:00:00.000Z',
    ...overrides,
  };
}

describe('provenanceSchema — a valid block round-trips', () => {
  it('accepts a complete, honest block', () => {
    const parsed = provenanceSchema.parse(validBlock());
    assert.equal(parsed.sourceType, 'customer-chat');
    assert.equal(parsed.origin, 'customer');
    assert.equal(parsed.sourceRef, `ChatMessage:${CHAT_ID}`);
    assert.equal(parsed.sourceHash, null);
  });

  it('accepts a 64-hex sourceHash', () => {
    const parsed = provenanceSchema.parse(validBlock({ sourceHash: HASH }));
    assert.equal(parsed.sourceHash, HASH);
  });

  it('accepts confidence at both bounds', () => {
    assert.equal(provenanceSchema.parse(validBlock({ confidence: 0 })).confidence, 0);
    assert.equal(provenanceSchema.parse(validBlock({ confidence: 1 })).confidence, 1);
  });
});

describe('provenanceSchema — rejections (the door holds)', () => {
  const rejected: Array<[string, Record<string, unknown>]> = [
    ['missing sourceRef', omit(validBlock(), 'sourceRef')],
    ['missing storedBy', omit(validBlock(), 'storedBy')],
    ['missing capturedAt', omit(validBlock(), 'capturedAt')],
    ['missing verified', omit(validBlock(), 'verified')],
    ['empty sourceRef', validBlock({ sourceRef: '' })],
    ['bad sourceType enum', validBlock({ sourceType: 'telepathy' } as never)],
    ['bad origin enum', validBlock({ origin: 'vibes' } as never)],
    ['bad recordType enum', validBlock({ recordType: 'invoice' } as never)],
    ['confidence 1.2', validBlock({ confidence: 1.2 })],
    ['confidence -0.1', validBlock({ confidence: -0.1 })],
    ['non-hex sourceHash', validBlock({ sourceHash: 'not-a-hash' })],
    ['short sourceHash', validBlock({ sourceHash: 'abc123' })],
    ['unknown extra key', { ...validBlock(), sneakyField: 'x' }],
    [
      'agent-inference claiming verified:true',
      validBlock({
        sourceType: 'agent-inference',
        origin: 'agent',
        verified: true,
      }),
    ],
    [
      'agent-inference claiming customer origin',
      validBlock({ sourceType: 'agent-inference', origin: 'customer' }),
    ],
    [
      'customer-chat claiming agent origin',
      validBlock({ sourceType: 'customer-chat', origin: 'agent' }),
    ],
    [
      'customer-edit claiming derived origin',
      validBlock({ sourceType: 'customer-edit', origin: 'derived' }),
    ],
    ['capturedAt not a datetime', validBlock({ capturedAt: 'yesterday' })],
    ['null value entirely', null as never],
    ['a string instead of a block', 'customer-chat' as never],
  ];

  for (const [label, value] of rejected) {
    it(`assertProvenance throws: ${label}`, () => {
      assert.throws(
        () => assertProvenance('memory-entry', value),
        (err: unknown) => {
          assert.ok(
            err instanceof ProvenanceError,
            `expected ProvenanceError, got ${String(err)}`,
          );
          return true;
        },
      );
    });
  }

  it('assertProvenance throws when the block is for a DIFFERENT record type', () => {
    const block = validBlock({ recordType: 'saved-time' });
    assert.throws(
      () => assertProvenance('approval-item', block),
      /recordType mismatch/,
    );
  });

  it('the ProvenanceError names the door that rejected the write', () => {
    try {
      assertProvenance('lead', omit(validBlock(), 'sourceRef'));
      assert.fail('expected a throw');
    } catch (err) {
      assert.ok(err instanceof ProvenanceError);
      assert.equal(err.recordType, 'lead');
      assert.match(err.message, /Refusing to write a lead without valid provenance/);
    }
  });
});

describe('buildProvenance — every construction path parses', () => {
  it('stamps capturedAt and defaults sourceHash + verified', () => {
    const p = buildProvenance({
      sourceType: 'customer-chat',
      origin: 'customer',
      recordType: 'memory-entry',
      sourceRef: `ChatMessage:${CHAT_ID}`,
      storedBy: 'plaino',
      confidence: 0.9,
      now: new Date('2026-08-02T12:00:00.000Z'),
    });
    assert.equal(p.capturedAt, '2026-08-02T12:00:00.000Z');
    assert.equal(p.sourceHash, null);
    assert.equal(p.verified, false);
  });

  it('refuses to build a dishonest block (inference + verified)', () => {
    assert.throws(
      () =>
        buildProvenance({
          sourceType: 'agent-inference',
          origin: 'agent',
          recordType: 'memory-entry',
          sourceRef: 'PlainoConversation:abc',
          storedBy: 'plaino',
          confidence: 0.6,
          verified: true,
        }),
      ProvenanceError,
    );
  });

  it('refuses an out-of-range confidence', () => {
    assert.throws(
      () =>
        buildProvenance({
          sourceType: 'system',
          origin: 'derived',
          recordType: 'saved-time',
          sourceRef: 'WebhookEvent:1',
          storedBy: 'seed-demo',
          confidence: 42,
        }),
      ProvenanceError,
    );
  });
});

describe('parseStoredProvenance — reads never throw', () => {
  it('returns null for a legacy NULL column', () => {
    assert.equal(parseStoredProvenance(null), null);
    assert.equal(parseStoredProvenance(undefined), null);
  });

  it('returns null for unparseable legacy JSON instead of throwing', () => {
    assert.equal(parseStoredProvenance({ some: 'old shape' }), null);
    assert.equal(parseStoredProvenance('garbage'), null);
  });

  it('returns the block when the stored JSON is valid', () => {
    const p = parseStoredProvenance(validBlock());
    assert.ok(p);
    assert.equal(p.storedBy, 'plaino');
  });
});

describe('describeProvenance — customer vocabulary only', () => {
  it('translates a chat-sourced memory into the customer citation', () => {
    const p = provenanceSchema.parse(validBlock());
    assert.equal(describeProvenance(p), 'you told Plaino this in chat');
  });

  it('hedges an unconfirmed inference out loud', () => {
    const p = provenanceSchema.parse(
      validBlock({
        sourceType: 'agent-inference',
        origin: 'agent',
        confidence: 0.6,
        sourceRef: 'PlainoConversation:c-1',
      }),
    );
    assert.equal(
      describeProvenance(p),
      'Plaino worked this out on its own — unconfirmed',
    );
  });

  it('never leaks an engineer label or a vendor name', () => {
    const banned = [
      'agent-inference',
      'skill-run',
      'crm-import',
      'csv-upload',
      'customer-chat',
      'provenance',
      'Claude',
      'Anthropic',
      'sourceRef',
    ];
    for (const sourceType of [
      'customer-chat',
      'customer-edit',
      'operator-entry',
      'webhook',
      'crm-import',
      'csv-upload',
      'agent-inference',
      'skill-run',
      'system',
    ] as const) {
      const origin =
        sourceType === 'customer-chat' || sourceType === 'customer-edit'
          ? 'customer'
          : sourceType === 'agent-inference'
            ? 'agent'
            : 'derived';
      const copy = describeProvenance(
        provenanceSchema.parse(
          validBlock({ sourceType, origin, sourceRef: 'Thing:1' }),
        ),
      );
      for (const term of banned) {
        assert.ok(
          !copy.toLowerCase().includes(term.toLowerCase()),
          `copy for ${sourceType} leaked "${term}": ${copy}`,
        );
      }
    }
  });
});

describe('sourceChatMessageIdFromRef', () => {
  it('recovers the chat id from a ChatMessage ref', () => {
    const p = provenanceSchema.parse(validBlock());
    assert.equal(sourceChatMessageIdFromRef(p), CHAT_ID);
  });

  it('returns null for a non-chat ref (no link to invent)', () => {
    const p = provenanceSchema.parse(
      validBlock({ sourceRef: 'WebhookEvent:evt-1' }),
    );
    assert.equal(sourceChatMessageIdFromRef(p), null);
  });

  it('returns null for a ChatMessage ref carrying no id', () => {
    const p = provenanceSchema.parse(validBlock({ sourceRef: 'ChatMessage:' }));
    assert.equal(sourceChatMessageIdFromRef(p), null);
  });
});

function omit(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}
