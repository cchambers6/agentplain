/**
 * Tests for the approval-notification morning digest (pilot dry-run
 * 2026-07-11, P0-1 — the delivery path for pings held by the
 * business_hours / digest preference modes). DI throughout.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import type { EmailProvider, SendEmailRequest } from '@/lib/email';
import {
  APPROVAL_DIGEST_SENT_ACTION,
  runApprovalDigestSweep,
} from '../approval-digest-sweep';

const NOW = new Date('2026-07-13T12:30:00.000Z'); // Monday 8:30am ET
const DAY_KEY = '2026-07-13';

function fakeSystemContext(opts: { alreadySentDay?: string | null } = {}) {
  const auditCreates: Array<Record<string, unknown>> = [];
  const tx = {
    auditLog: {
      findFirst: async (args: { where?: { targetId?: string } }) =>
        opts.alreadySentDay && args.where?.targetId === opts.alreadySentDay
          ? { id: 'existing' }
          : null,
      create: async (args: { data: Record<string, unknown> }) => {
        auditCreates.push(args.data);
        return { id: 'new' };
      },
    },
  } as unknown as Prisma.TransactionClient;
  const systemContext = <T,>(
    fn: (t: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> => fn(tx);
  return { systemContext, auditCreates };
}

function recordingEmail(): { provider: EmailProvider; sent: SendEmailRequest[] } {
  const sent: SendEmailRequest[] = [];
  const provider: EmailProvider = {
    providerName: 'test',
    async send(req) {
      sent.push(req);
      return { messageId: 're_test_digest' };
    },
  };
  return { provider, sent };
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Peachtree Realty',
    approvalEmailMode: 'digest',
    pendingCount: 3,
    brokerOwnerEmails: ['sarah@peachtree.test'],
    ...overrides,
  };
}

describe('runApprovalDigestSweep', () => {
  it('emails one morning summary of everything waiting, and audits it', async () => {
    const { systemContext, auditCreates } = fakeSystemContext();
    const { provider, sent } = recordingEmail();
    const res = await runApprovalDigestSweep({
      listCandidates: async () => [candidate()],
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
      now: NOW,
    });

    assert.equal(res.digestsSent, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'sarah@peachtree.test');
    assert.match(sent[0].subject, /3 drafts are waiting/);
    assert.equal(sent[0].tags?.kind, 'approval_digest');

    const audit = auditCreates.find(
      (a) => a.action === APPROVAL_DIGEST_SENT_ACTION,
    );
    assert.ok(audit, 'expected an approval_digest.sent audit row');
    assert.equal(audit?.targetId, DAY_KEY);
  });

  it("skips 'always' partners — they were emailed per draft already", async () => {
    const { systemContext } = fakeSystemContext();
    const { provider, sent } = recordingEmail();
    const res = await runApprovalDigestSweep({
      listCandidates: async () => [candidate({ approvalEmailMode: 'always' })],
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
      now: NOW,
    });
    assert.equal(res.skippedImmediateMode, 1);
    assert.equal(sent.length, 0);
  });

  it('skips when nothing is pending', async () => {
    const { systemContext } = fakeSystemContext();
    const { provider, sent } = recordingEmail();
    const res = await runApprovalDigestSweep({
      listCandidates: async () => [candidate({ pendingCount: 0 })],
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
      now: NOW,
    });
    assert.equal(res.skippedNothingPending, 1);
    assert.equal(sent.length, 0);
  });

  it('is idempotent per day — a cron retry never double-emails', async () => {
    const { systemContext } = fakeSystemContext({ alreadySentDay: DAY_KEY });
    const { provider, sent } = recordingEmail();
    const res = await runApprovalDigestSweep({
      listCandidates: async () => [candidate()],
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
      now: NOW,
    });
    assert.equal(res.skippedAlreadySentToday, 1);
    assert.equal(sent.length, 0);
  });
});
