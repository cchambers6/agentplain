/**
 * Behavior tests for approval-queue content ephemerality (DI — no DB).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRedacted,
  redactApprovalPayload,
  redactExpiredApprovalContent,
} from '../content-ephemerality';

describe('redactApprovalPayload', () => {
  it('keeps top-level key names but drops every value', () => {
    const now = new Date('2026-06-18T00:00:00Z');
    const redacted = redactApprovalPayload(
      { draftBody: 'Dear Jane, your offer...', recipientEmail: 'jane@x.com', subject: 'Re: offer' },
      now,
    );
    assert.equal(redacted._redacted, true);
    assert.equal(redacted._redactedAt, now.toISOString());
    assert.deepEqual(
      redacted._originalKeys.sort(),
      ['draftBody', 'recipientEmail', 'subject'],
    );
    // No values survive.
    assert.equal(JSON.stringify(redacted).includes('jane@x.com'), false);
    assert.equal(JSON.stringify(redacted).includes('Dear Jane'), false);
  });

  it('is idempotent — a redacted payload reads as redacted', () => {
    const r = redactApprovalPayload({ a: 1 }, new Date(0));
    assert.equal(isRedacted(r), true);
    assert.equal(isRedacted({ a: 1 }), false);
    assert.equal(isRedacted(null), false);
  });
});

describe('redactExpiredApprovalContent', () => {
  it('redacts expired un-redacted items and skips already-redacted ones', async () => {
    const updates: Array<{ id: string }> = [];
    const candidates = [
      { id: '1', payload: { draftBody: 'secret one' } },
      { id: '2', payload: { _redacted: true, _redactedAt: 'x', _originalKeys: [] } },
      { id: '3', payload: { draftBody: 'secret three' } },
    ];

    const result = await redactExpiredApprovalContent({
      now: new Date('2026-06-18T00:00:00Z'),
      listCandidates: async () => candidates,
      redactItem: async (id) => void updates.push({ id }),
    });

    assert.equal(result.candidatesScanned, 3);
    assert.equal(result.redacted, 2);
    assert.equal(result.alreadyRedacted, 1);
    assert.deepEqual(updates.map((u) => u.id).sort(), ['1', '3']);
  });

  it('passes a cutoff that is retentionDays before now to the lister', async () => {
    let seenCutoff: Date | undefined;
    await redactExpiredApprovalContent({
      now: new Date('2026-06-18T00:00:00Z'),
      retentionDays: 7,
      listCandidates: async (cut) => {
        seenCutoff = cut;
        return [];
      },
      redactItem: async () => {},
    });
    assert.ok(seenCutoff);
    assert.equal(seenCutoff!.toISOString(), '2026-06-11T00:00:00.000Z');
  });
});
