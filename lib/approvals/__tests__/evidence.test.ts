/**
 * lib/approvals/__tests__/evidence.test.ts
 *
 * The approval evidence ledger. These assertions are about a legal artifact,
 * not a feature: each one corresponds to a question a plaintiff's counsel can
 * be expected to ask.
 *
 * Reports `examined N of M` and fails when N is zero, per the repo standard —
 * `assert.deepEqual(x, [])` passes on an empty input set, and a corpus loop
 * that generates zero cases reports `fail 0`.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');

import {
  recordApprovalEvidenceTx,
  extractRecipients,
  extractFromAccount,
  extractSubject,
  extractApprovedBody,
  extractHumanEdited,
  readApprovedBody,
} from '../evidence';

// ── A transaction client that records what was written ──────────────────
interface Written {
  [k: string]: unknown;
}
function fakeTx(onCreate?: () => void) {
  const rows: Written[] = [];
  const tx = {
    approvalEvidence: {
      create: async ({ data }: { data: Written }) => {
        if (onCreate) onCreate();
        rows.push(data);
        return { id: 'evidence-1' };
      },
    },
  };
  return { tx: tx as never, rows };
}

const BASE = {
  workspaceId: '11111111-1111-1111-1111-111111111111',
  approvalItemId: '22222222-2222-2222-2222-222222222222',
  kind: 'DRAFT_EMAIL',
  agentSlug: 'lead-triage-realestate',
  refTable: 'Lead',
  refId: 'lead-7',
  decisionReason: null as string | null,
  decidedAt: new Date('2026-09-14T10:00:00.000Z'),
  decidedByUserId: '33333333-3333-3333-3333-333333333333',
} as const;

describe('recordApprovalEvidenceTx', () => {
  test('stores the FULL approved body, not a hash', async () => {
    const { tx, rows } = fakeTx();
    await recordApprovalEvidenceTx(tx, {
      ...BASE,
      decision: 'APPROVED',
      route: 'human',
      payload: { body: 'Hi Jane — the inspection is booked for Tuesday.' },
    });
    assert.equal(rows.length, 1, 'exactly one evidence row per decision');
    // The point of the design Conner chose: discovery asks for the document,
    // and a hash cannot produce the document.
    assert.equal(
      readApprovedBody(rows[0].approvedBody),
      'Hi Jane — the inspection is booked for Tuesday.',
    );
    // ...and it is not sitting in plaintext next to a ciphertext column.
    assert.notEqual(
      JSON.stringify(rows[0].approvedBody).includes('inspection'),
      true,
      'body must be encrypted at rest, same envelope as the queue payload',
    );
  });

  test('records a DECLINE with its reason', async () => {
    const { tx, rows } = fakeTx();
    await recordApprovalEvidenceTx(tx, {
      ...BASE,
      decision: 'REJECTED',
      decisionReason: 'Wrong property address.',
      route: 'human',
      payload: { body: 'draft text' },
    });
    // A ledger containing only approvals reads like an auto-approver. The
    // refusal is the evidence that a human was judging.
    assert.equal(rows[0].decision, 'REJECTED');
    assert.equal(rows[0].decisionReason, 'Wrong property address.');
    assert.equal(readApprovedBody(rows[0].approvedBody), 'draft text');
  });

  test('decidedAt is carried through, sentAt is NOT invented', async () => {
    const { tx, rows } = fakeTx();
    await recordApprovalEvidenceTx(tx, {
      ...BASE,
      decision: 'APPROVED',
      route: 'human',
      payload: { body: 'x' },
    });
    assert.deepEqual(rows[0].decidedAt, BASE.decidedAt);
    // Decision time and send time are distinct. The fleet drafts; the
    // customer's own system sends. Stamping sentAt here would assert a send
    // we did not perform and cannot observe.
    assert.equal(rows[0].sentAt, undefined);
  });

  test('the three routes are recorded positively, not inferred', async () => {
    const routes = ['human', 'machine', 'operator'] as const;
    let examined = 0;
    for (const route of routes) {
      const { tx, rows } = fakeTx();
      await recordApprovalEvidenceTx(tx, {
        ...BASE,
        decision: route === 'machine' ? 'AUTO_APPROVED' : 'APPROVED',
        decidedByUserId: route === 'human' ? BASE.decidedByUserId : null,
        route,
        payload: { body: 'x' },
      });
      assert.equal(rows[0].route, route);
      examined += 1;
    }
    // A null actor id alone cannot distinguish "the threshold accepted this"
    // from "an agentplain operator resolved a support request".
    assert.equal(examined, routes.length, `examined ${examined} of ${routes.length} routes`);
    assert.ok(examined > 0, 'examined must not be zero');
  });

  test('a write failure PROPAGATES so the decision rolls back', async () => {
    const { tx } = fakeTx(() => {
      throw new Error('evidence insert failed');
    });
    await assert.rejects(
      () =>
        recordApprovalEvidenceTx(tx, {
          ...BASE,
          decision: 'APPROVED',
          route: 'human',
          payload: { body: 'x' },
        }),
      /evidence insert failed/,
    );
    // Deliberate. A decision that commits without its evidence is the exact
    // failure this table exists to prevent; swallowing the error would
    // reintroduce it while making the ledger look complete.
  });
});

describe('payload field extraction', () => {
  test('humanEdited is true only when editApprovalDraft stamped editedAt', () => {
    const cases: Array<[unknown, boolean]> = [
      [{ body: 'x' }, false],
      [{ body: 'x', editedAt: '2026-09-14T09:00:00.000Z' }, true],
      [{ body: 'x', editedAt: '' }, false],
      [{ body: 'x', editedAt: 7 }, false],
      [null, false],
    ];
    let examined = 0;
    for (const [payload, expected] of cases) {
      assert.equal(extractHumanEdited(payload), expected);
      examined += 1;
    }
    assert.equal(examined, cases.length, `examined ${examined} of ${cases.length}`);
    assert.ok(examined > 0, 'examined must not be zero');
  });

  test('recipients come from discrete fields, NEVER from a display line', () => {
    // KNOWN-POSITIVE CONTROL first: prove the extractor can find a recipient
    // at all, so the negative below is evidence rather than a broken probe.
    assert.deepEqual(extractRecipients({ recipients: ['a@b.com'] }), ['a@b.com']);
    assert.deepEqual(extractRecipients({ to: 'c@d.com' }), ['c@d.com']);

    // THE NEGATIVE. `recipientLine` is a humanized string that also carries
    // the subject ("To: a@b.com   Re: <subject>"), and on reply-draft kinds
    // that subject came from an inbound email a STRANGER sent. Parsing it
    // would let a stranger put themselves on the To line of our legal record
    // by writing an address into their subject.
    assert.deepEqual(
      extractRecipients({
        recipientLine: 'To: victim@client.com    Re: attacker@evil.com',
      }),
      [],
    );
  });

  test('empty-ish values do not masquerade as content', () => {
    assert.deepEqual(extractRecipients({ recipients: ['', '  '] }), []);
    assert.equal(extractFromAccount({ from: '   ' }), null);
    assert.equal(extractSubject({ subject: '' }), null);
    // "" rather than null: many approval kinds are structured, not prose.
    // The snapshot is authoritative there, and "" says "no body" without
    // pretending the row is incomplete.
    assert.equal(extractApprovedBody({ status: 'ok' }), '');
  });

  test('body precedence prefers the edit sheet’s own field', () => {
    // `editableBody` is the stable contract the edit sheet seeds from, so it
    // is what the human actually saw and changed.
    assert.equal(
      extractApprovedBody({ body: 'rendered', editableBody: 'raw' }),
      'raw',
    );
  });
});
