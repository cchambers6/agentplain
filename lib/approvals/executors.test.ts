/**
 * lib/approvals/executors.test.ts
 *
 * Pins the dispatch seam: that approving something now DOES something, that
 * running it twice does it once, and that a broken executor cannot take the
 * customer's decision down with it.
 *
 * Drives the real registry and the real executors against injected ports.
 * Nothing here re-implements the code under test; the fakes are the ports
 * (store, renderer, flag reader, mailbox), which is exactly the seam those
 * ports exist to provide.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkApprovalKind } from '@prisma/client';

import {
  APPROVAL_EXECUTORS,
  executorsForKind,
  isAcceptedStatus,
  runApprovalExecutors,
  type ApprovalExecutionContext,
  type ApprovalExecutorDeps,
  type ApprovalPayloadStore,
  type MailboxDraftPort,
} from './executors';
import {
  ARTIFACT_PAYLOAD_KEY,
  ARTIFACT_HANDOFF_KINDS,
  KINDS_WITHOUT_PRODUCER,
} from './executors/artifact-handoff';
import {
  MAILBOX_DRAFT_HANDOFF_FLAG,
  MAILBOX_DRAFT_PAYLOAD_KEY,
  mailboxDraftIdempotencyKey,
} from './executors/mailbox-draft-handoff';

const WS = 'ws-1';
const ITEM = 'item-1';

/** Recording payload store. Merges, exactly as the production one must. */
class FakeStore implements ApprovalPayloadStore {
  writes: Array<{ key: string; value: unknown; fingerprint: string }> = [];
  private seen = new Map<string, string>();

  async writeKey(args: {
    workspaceId: string;
    itemId: string;
    key: string;
    value: unknown;
    fingerprint: string;
  }): Promise<'written' | 'unchanged'> {
    if (this.seen.get(args.key) === args.fingerprint) return 'unchanged';
    this.seen.set(args.key, args.fingerprint);
    this.writes.push({ key: args.key, value: args.value, fingerprint: args.fingerprint });
    return 'written';
  }
}

class FakeMailbox implements MailboxDraftPort {
  readonly name = 'fake-mailbox';
  calls: Array<{ to: string[]; subject: string; body: string; idempotencyKey: string }> = [];
  private byKey = new Map<string, string>();

  async createDraft(args: {
    workspaceId: string;
    to: string[];
    subject: string;
    body: string;
    idempotencyKey: string;
  }): Promise<{ providerDraftId: string; reused: boolean }> {
    this.calls.push({
      to: args.to,
      subject: args.subject,
      body: args.body,
      idempotencyKey: args.idempotencyKey,
    });
    const prior = this.byKey.get(args.idempotencyKey);
    if (prior) return { providerDraftId: prior, reused: true };
    const id = `draft-${this.byKey.size + 1}`;
    this.byKey.set(args.idempotencyKey, id);
    return { providerDraftId: id, reused: false };
  }
}

/** Minimal renderer stub in the shape the real one returns. */
function stubRender(overrides: Record<string, unknown> = {}) {
  return () =>
    ({
      kindLabel: 'follow-up nudge',
      body: ['Just following up on invoice 1041.'],
      chrome: ['Awaiting your approval. Nothing has been sent.'],
      recipients: ['ap@acme.example.com'],
      editableBody: 'Just following up on invoice 1041.',
      title: 'Invoice 1041',
      ...overrides,
    }) as never;
}

function deps(over: Partial<ApprovalExecutorDeps> = {}): ApprovalExecutorDeps {
  return {
    store: new FakeStore(),
    render: stubRender(),
    flags: { isEnabled: () => false },
    ...over,
  };
}

function ctx(over: Partial<ApprovalExecutionContext> = {}): ApprovalExecutionContext {
  return {
    workspaceId: WS,
    itemId: ITEM,
    kind: 'FOLLOW_UP_NUDGE' as WorkApprovalKind,
    agentSlug: 'invoice-chase-general',
    refTable: 'InvoiceChaseDraft',
    refId: 'draft-9',
    payload: { subject: 'Invoice 1041', body: 'Just following up.', balanceUsd: 4200 },
    actorUserId: 'user-1',
    route: 'human',
    status: 'APPROVED',
    ...over,
  };
}

describe('isAcceptedStatus', () => {
  it('treats APPROVED and AUTO_APPROVED as one accepted class', () => {
    assert.equal(isAcceptedStatus('APPROVED'), true);
    assert.equal(isAcceptedStatus('AUTO_APPROVED'), true);
  });

  it('rejects every non-accepted status', () => {
    for (const s of ['PENDING', 'REJECTED', 'EXPIRED', '', null, undefined]) {
      assert.equal(isAcceptedStatus(s as never), false, `${String(s)} must not be accepted`);
    }
  });
});

describe('registry', () => {
  it('registers both executors and keys them by kind', () => {
    assert.equal(APPROVAL_EXECUTORS.length, 2);
    const names = APPROVAL_EXECUTORS.map((e) => e.name).sort();
    assert.deepEqual(names, ['ARTIFACT_HANDOFF', 'MAILBOX_DRAFT_HANDOFF']);

    const forNudge = executorsForKind('FOLLOW_UP_NUDGE' as WorkApprovalKind).map((e) => e.name);
    assert.deepEqual(forNudge.sort(), ['ARTIFACT_HANDOFF', 'MAILBOX_DRAFT_HANDOFF']);
  });

  it('ARTIFACT_HANDOFF runs before the fallible executor', () => {
    assert.equal(APPROVAL_EXECUTORS[0]!.name, 'ARTIFACT_HANDOFF');
  });

  it('the mailbox executor is barred from the machine route', () => {
    const mailbox = APPROVAL_EXECUTORS.find((e) => e.name === 'MAILBOX_DRAFT_HANDOFF')!;
    assert.equal(
      mailbox.routes.includes('machine'),
      false,
      'an AUTO_APPROVED row had no human look at it, so it must not put a ' +
        'drafted message into anyone\'s mailbox',
    );
    assert.deepEqual([...mailbox.routes].sort(), ['human', 'operator-support']);

    const artifact = APPROVAL_EXECUTORS.find((e) => e.name === 'ARTIFACT_HANDOFF')!;
    assert.deepEqual(
      [...artifact.routes].sort(),
      ['human', 'machine', 'operator-support'],
      'a purely internal record is safe on every route',
    );
  });

  it('a machine-route dispatch runs the artifact executor and skips the mailbox', async () => {
    const mailbox = new FakeMailbox();
    const out = await runApprovalExecutors(
      ctx({ route: 'machine', status: 'AUTO_APPROVED', actorUserId: null }),
      // Flag ON, port present: the ONLY thing stopping it is the route bar.
      deps({ mailbox, flags: { isEnabled: () => true } }),
    );

    assert.equal(out.find((o) => o.executor === 'ARTIFACT_HANDOFF')!.status, 'executed');
    const m = out.find((o) => o.executor === 'MAILBOX_DRAFT_HANDOFF')!;
    assert.equal(m.status, 'skipped');
    assert.match(m.detail ?? '', /not enabled for the "machine" route/);
    assert.equal(mailbox.calls.length, 0, 'the connector must never be reached');
  });

  it('excludes exactly the kinds nothing produces (admission criterion A5)', () => {
    assert.deepEqual(
      [...KINDS_WITHOUT_PRODUCER].sort(),
      ['LISTING_RECOMMENDATION', 'PRICING_RECOMMENDATION', 'RESEARCH_BRIEF'],
    );
    for (const k of KINDS_WITHOUT_PRODUCER) {
      assert.equal(
        executorsForKind(k).some((e) => e.name === 'ARTIFACT_HANDOFF'),
        false,
        `${k} has no producer and must get no artifact executor`,
      );
    }
    // examined N of M -- "found nothing" and "examined nothing" must be
    // distinguishable, so assert the population is non-trivial.
    assert.equal(ARTIFACT_HANDOFF_KINDS.length, 27);
    assert.equal(ARTIFACT_HANDOFF_KINDS.length + KINDS_WITHOUT_PRODUCER.length, 30);
  });

  it('a kind with no registered executor dispatches to nothing, quietly', async () => {
    const out = await runApprovalExecutors(
      ctx({ kind: 'RESEARCH_BRIEF' as WorkApprovalKind }),
      deps(),
    );
    assert.deepEqual(out, []);
  });
});

describe('ARTIFACT_HANDOFF', () => {
  it('writes a durable artifact carrying the prose and NOT the chrome', async () => {
    const store = new FakeStore();
    const out = await runApprovalExecutors(ctx(), deps({ store }));

    const artifactOutcome = out.find((o) => o.executor === 'ARTIFACT_HANDOFF')!;
    assert.equal(artifactOutcome.status, 'executed');

    const write = store.writes.find((w) => w.key === ARTIFACT_PAYLOAD_KEY)!;
    assert.ok(write, 'an artifact must be persisted under the reserved key');

    const stored = write.value as { v: number; artifact: { blocks: string[] } };
    assert.equal(stored.v, 1);
    const text = stored.artifact.blocks.join('\n');
    assert.match(text, /Just following up on invoice 1041\./);
    assert.doesNotMatch(
      text,
      /Nothing has been sent/,
      'card chrome must never reach the artifact',
    );
  });

  it('is idempotent: a second run writes nothing', async () => {
    const store = new FakeStore();
    const first = await runApprovalExecutors(ctx(), deps({ store }));
    assert.equal(first.find((o) => o.executor === 'ARTIFACT_HANDOFF')!.status, 'executed');
    assert.equal(store.writes.length, 1);

    const second = await runApprovalExecutors(ctx(), deps({ store }));
    assert.equal(
      second.find((o) => o.executor === 'ARTIFACT_HANDOFF')!.status,
      'already-done',
    );
    assert.equal(store.writes.length, 1, 'a re-run must not write a second time');
  });

  it('short-circuits on a payload that already carries a matching fingerprint', async () => {
    const store = new FakeStore();
    await runApprovalExecutors(ctx(), deps({ store }));
    const stored = store.writes[0]!.value as { fingerprint: string };

    const store2 = new FakeStore();
    const out = await runApprovalExecutors(
      ctx({
        payload: {
          subject: 'Invoice 1041',
          body: 'Just following up.',
          balanceUsd: 4200,
          [ARTIFACT_PAYLOAD_KEY]: { v: 1, fingerprint: stored.fingerprint, artifact: {} },
        },
      }),
      deps({ store: store2 }),
    );
    assert.equal(
      out.find((o) => o.executor === 'ARTIFACT_HANDOFF')!.status,
      'already-done',
    );
    assert.equal(store2.writes.length, 0, 'the store must not be touched at all');
  });
});

describe('MAILBOX_DRAFT_HANDOFF', () => {
  it('is OFF by default and reports skipped, not failed', async () => {
    const mailbox = new FakeMailbox();
    const out = await runApprovalExecutors(ctx(), deps({ mailbox }));
    const o = out.find((x) => x.executor === 'MAILBOX_DRAFT_HANDOFF')!;
    assert.equal(o.status, 'skipped');
    assert.match(o.detail ?? '', /APPROVAL_MAILBOX_DRAFT_HANDOFF is off/);
    assert.equal(mailbox.calls.length, 0, 'the connector must not be touched when off');
  });

  it('with the flag on, writes a draft addressed from the DISCRETE recipients', async () => {
    const mailbox = new FakeMailbox();
    const out = await runApprovalExecutors(
      ctx(),
      deps({
        mailbox,
        flags: { isEnabled: (f) => f === MAILBOX_DRAFT_HANDOFF_FLAG },
      }),
    );
    assert.equal(out.find((x) => x.executor === 'MAILBOX_DRAFT_HANDOFF')!.status, 'executed');
    assert.equal(mailbox.calls.length, 1);
    assert.deepEqual(mailbox.calls[0]!.to, ['ap@acme.example.com']);
    assert.equal(mailbox.calls[0]!.subject, 'Invoice 1041');
    assert.equal(mailbox.calls[0]!.body, 'Just following up on invoice 1041.');
  });

  it('uses a ROW-DERIVED idempotency key, stable across runs', async () => {
    const mailbox = new FakeMailbox();
    const flags = { isEnabled: (f: string) => f === MAILBOX_DRAFT_HANDOFF_FLAG };

    await runApprovalExecutors(ctx(), deps({ mailbox, flags }));
    await runApprovalExecutors(ctx(), deps({ mailbox, flags }));

    assert.equal(mailbox.calls[0]!.idempotencyKey, mailboxDraftIdempotencyKey(ITEM));
    assert.equal(
      mailbox.calls[0]!.idempotencyKey,
      mailbox.calls[1]!.idempotencyKey,
      'the key must not vary between runs -- no clock, no run id',
    );
  });

  it('a re-run through the port creates ONE draft, not two', async () => {
    const mailbox = new FakeMailbox();
    const flags = { isEnabled: (f: string) => f === MAILBOX_DRAFT_HANDOFF_FLAG };

    const a = await runApprovalExecutors(ctx(), deps({ mailbox, flags }));
    const b = await runApprovalExecutors(ctx(), deps({ mailbox, flags }));

    assert.equal(a.find((x) => x.executor === 'MAILBOX_DRAFT_HANDOFF')!.status, 'executed');
    assert.equal(
      b.find((x) => x.executor === 'MAILBOX_DRAFT_HANDOFF')!.status,
      'already-done',
    );
    assert.equal(new Set(mailbox.calls.map((c) => c.idempotencyKey)).size, 1);
  });

  it('short-circuits before the connector when the row records a prior draft', async () => {
    const mailbox = new FakeMailbox();
    const out = await runApprovalExecutors(
      ctx({
        payload: {
          subject: 'Invoice 1041',
          [MAILBOX_DRAFT_PAYLOAD_KEY]: { providerDraftId: 'draft-existing', port: 'x' },
        },
      }),
      deps({ mailbox, flags: { isEnabled: (f) => f === MAILBOX_DRAFT_HANDOFF_FLAG } }),
    );
    assert.equal(
      out.find((x) => x.executor === 'MAILBOX_DRAFT_HANDOFF')!.status,
      'already-done',
    );
    assert.equal(mailbox.calls.length, 0);
  });

  it('declines when there is no mailbox port at all', async () => {
    const out = await runApprovalExecutors(
      ctx(),
      deps({ flags: { isEnabled: (f) => f === MAILBOX_DRAFT_HANDOFF_FLAG } }),
    );
    const o = out.find((x) => x.executor === 'MAILBOX_DRAFT_HANDOFF')!;
    assert.equal(o.status, 'skipped');
    assert.match(o.detail ?? '', /no mailbox connector/);
  });

  it('refuses to address a draft from a malformed recipient', async () => {
    const mailbox = new FakeMailbox();
    const out = await runApprovalExecutors(
      ctx(),
      deps({
        mailbox,
        flags: { isEnabled: (f) => f === MAILBOX_DRAFT_HANDOFF_FLAG },
        // A stranger's address smuggled in as a display-string fragment
        // rather than a real discrete recipient.
        render: stubRender({ recipients: ['Re: hello mallory@evil.example.com'] }),
      }),
    );
    const o = out.find((x) => x.executor === 'MAILBOX_DRAFT_HANDOFF')!;
    assert.equal(o.status, 'skipped');
    assert.match(o.detail ?? '', /no valid recipient/);
    assert.equal(mailbox.calls.length, 0);
  });

  it('declines when the approved row carries no draft body', async () => {
    const mailbox = new FakeMailbox();
    const out = await runApprovalExecutors(
      ctx(),
      deps({
        mailbox,
        flags: { isEnabled: (f) => f === MAILBOX_DRAFT_HANDOFF_FLAG },
        render: stubRender({ editableBody: undefined }),
      }),
    );
    const o = out.find((x) => x.executor === 'MAILBOX_DRAFT_HANDOFF')!;
    assert.equal(o.status, 'skipped');
    assert.match(o.detail ?? '', /no draft body/);
    assert.equal(mailbox.calls.length, 0);
  });
});

describe('failure isolation (admission criterion A4)', () => {
  it('a throwing executor becomes a failed OUTCOME and never propagates', async () => {
    const out = await runApprovalExecutors(
      ctx(),
      deps({
        render: () => {
          throw new Error('renderer exploded');
        },
      }),
    );
    const artifact = out.find((o) => o.executor === 'ARTIFACT_HANDOFF')!;
    assert.equal(artifact.status, 'failed');
    assert.match(artifact.detail ?? '', /renderer exploded/);
  });

  it('one broken executor does not silence the others', async () => {
    const mailbox = new FakeMailbox();
    let renders = 0;
    const out = await runApprovalExecutors(
      ctx(),
      deps({
        mailbox,
        flags: { isEnabled: (f) => f === MAILBOX_DRAFT_HANDOFF_FLAG },
        render: ((...args: unknown[]) => {
          renders += 1;
          // Only the FIRST executor's render throws.
          if (renders === 1) throw new Error('boom');
          return stubRender()(...(args as []));
        }) as never,
      }),
    );

    assert.equal(out.length, 2);
    assert.equal(out.find((o) => o.executor === 'ARTIFACT_HANDOFF')!.status, 'failed');
    assert.equal(
      out.find((o) => o.executor === 'MAILBOX_DRAFT_HANDOFF')!.status,
      'executed',
      'the second executor must still run',
    );
  });
});
