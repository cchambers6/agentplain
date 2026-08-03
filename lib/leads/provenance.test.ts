/**
 * lib/leads/provenance.test.ts
 *
 * The LeadCapture write door.
 *
 * A lead is the first record a prospect ever creates with us, and the
 * operator working it at /operator/leads has to know whether it came out
 * of a real conversation, off a marketing page, or from a bare form post.
 * That answer has to be IN the row — reconstructing it later from a
 * timestamp is guesswork. So the door refuses a lead it cannot cite, and
 * the stub tx below proves the refusal happens before the insert.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';

import { buildLeadCaptureProvenance, createLeadCaptureRow } from './index';
import { ProvenanceError } from '../provenance/types';

const DATA = {
  email: 'owner@example.com',
  name: 'Sam Rivera',
  business: 'Rivera Realty',
  vertical: 'real-estate',
  intent: 'Wants to see the after-hours lead triage.',
  sourcePage: '/real-estate',
  conversationId: null,
  askedAboutClaude: false,
} as unknown as Prisma.LeadCaptureUncheckedCreateInput;

function stubTx() {
  const calls: Array<Record<string, unknown>> = [];
  const tx = {
    leadCapture: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push(args.data);
        return { id: 'lead-1' };
      },
    },
  };
  return { calls, tx: tx as unknown as Prisma.TransactionClient };
}

describe('buildLeadCaptureProvenance — the citation degrades honestly', () => {
  it('cites the conversation when the widget linked one', () => {
    const p = buildLeadCaptureProvenance({
      conversationId: 'conv-9',
      sourcePage: '/real-estate',
    });
    assert.equal(p.sourceRef, 'PlainoConversation:conv-9');
    assert.equal(p.sourceType, 'customer-chat');
    assert.equal(p.origin, 'customer');
    assert.equal(p.storedBy, 'plaino-widget');
    assert.equal(p.confidence, 1);
    assert.equal(
      p.verified,
      false,
      'nobody has confirmed the email is real — triage does that',
    );
  });

  it('falls back to the page they submitted from', () => {
    const p = buildLeadCaptureProvenance({
      conversationId: null,
      sourcePage: '/cpa',
    });
    assert.equal(p.sourceRef, '/cpa');
  });

  it('says "direct" rather than inventing a source', () => {
    const p = buildLeadCaptureProvenance({
      conversationId: null,
      sourcePage: null,
    });
    assert.equal(p.sourceRef, 'LeadCapture:direct');
  });
});

describe('createLeadCaptureRow — the door', () => {
  it('rejects an invalid block and never reaches the insert', async () => {
    const { calls, tx } = stubTx();
    await assert.rejects(
      () =>
        createLeadCaptureRow(tx, {
          data: DATA,
          provenance: { sourceType: 'customer-chat' } as never,
        }),
      ProvenanceError,
    );
    assert.equal(calls.length, 0, 'no uncitable lead may land');
  });

  it('rejects a block built for a different record type', async () => {
    const { calls, tx } = stubTx();
    await assert.rejects(
      () =>
        createLeadCaptureRow(tx, {
          data: DATA,
          provenance: {
            ...buildLeadCaptureProvenance({
              conversationId: 'conv-9',
              sourcePage: null,
            }),
            recordType: 'memory-entry',
          } as never,
        }),
      /recordType mismatch/,
    );
    assert.equal(calls.length, 0);
  });

  it('writes the lead WITH its citation', async () => {
    const { calls, tx } = stubTx();
    const created = await createLeadCaptureRow(tx, {
      data: DATA,
      provenance: buildLeadCaptureProvenance(
        { conversationId: 'conv-9', sourcePage: '/real-estate' },
        new Date('2026-08-02T12:00:00.000Z'),
      ),
    });
    assert.equal(created.id, 'lead-1');
    assert.equal(calls.length, 1);
    const stored = calls[0].provenance as Record<string, unknown>;
    assert.equal(stored.recordType, 'lead');
    assert.equal(stored.sourceRef, 'PlainoConversation:conv-9');
    assert.equal(stored.capturedAt, '2026-08-02T12:00:00.000Z');
    // The row's own columns are passed through untouched.
    assert.equal(calls[0].email, 'owner@example.com');
  });
});
