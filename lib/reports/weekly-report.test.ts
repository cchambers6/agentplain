/**
 * Tests for the weekly report SEND orchestration. DI throughout — a fake
 * systemContext serves all reads, a fake EmailProvider records sends.
 */

// A valid 64-hex ENCRYPTION_KEY so the HMAC unsubscribe-token signer works in
// the happy-path send. Set before importing the module under test.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ?? 'a'.repeat(64);

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import type { EmailProvider, SendEmailRequest } from '@/lib/email';
import {
  sendWeeklyReportForWorkspace,
  WEEKLY_REPORT_SENT_ACTION,
} from './weekly-report';

const WS = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-06-12T12:00:00.000Z');

interface FakeOpts {
  weeklyReportEnabled?: boolean;
  brokerEmail?: string | null;
  subscriptionStatus?: string;
  setupDeactivatedAt?: Date | null;
  alreadySentForDate?: string | null;
}

function fakeSystemContext(opts: FakeOpts) {
  const auditCreates: Array<Record<string, unknown>> = [];
  const tx = {
    workspace: {
      findUnique: async () => ({
        id: WS,
        name: 'Acme Realty',
        vertical: 'REAL_ESTATE',
        closureStatus: 'ACTIVE',
        setupDeactivatedAt: opts.setupDeactivatedAt ?? null,
        preference: {
          weeklyReportEnabled: opts.weeklyReportEnabled ?? true,
        },
        memberships:
          opts.brokerEmail === null
            ? []
            : [{ user: { email: opts.brokerEmail ?? 'owner@acme.test' } }],
      }),
    },
    subscription: {
      findUnique: async () => ({
        status: opts.subscriptionStatus ?? 'ACTIVE',
        currentPeriodEnd: null,
      }),
    },
    workApprovalQueueItem: {
      findMany: async () => [],
      count: async () => 0,
    },
    auditLog: {
      findFirst: async (args: { where?: { targetId?: string } }) =>
        opts.alreadySentForDate &&
        args.where?.targetId === opts.alreadySentForDate
          ? { id: 'existing' }
          : null,
      create: async (args: { data: Record<string, unknown> }) => {
        auditCreates.push(args.data);
        return { id: 'new' };
      },
      count: async () => 0,
    },
    llmUsageRecord: {
      aggregate: async () => ({
        _sum: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          costMicroCents: 0n,
        },
        _count: { _all: 0 },
      }),
      groupBy: async () => [],
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
      return { messageId: 're_test_123' };
    },
  };
  return { provider, sent };
}

describe('sendWeeklyReportForWorkspace', () => {
  it('skips an opted-out workspace before sending', async () => {
    const { systemContext } = fakeSystemContext({ weeklyReportEnabled: false });
    const { provider, sent } = recordingEmail();
    const res = await sendWeeklyReportForWorkspace({
      workspaceId: WS,
      now: NOW,
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
    });
    assert.equal(res.sent, false);
    assert.equal(res.skipped, 'opted_out');
    assert.equal(sent.length, 0);
  });

  it('skips when there is no broker-owner recipient', async () => {
    const { systemContext } = fakeSystemContext({ brokerEmail: null });
    const { provider, sent } = recordingEmail();
    const res = await sendWeeklyReportForWorkspace({
      workspaceId: WS,
      now: NOW,
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
    });
    assert.equal(res.skipped, 'no_recipient');
    assert.equal(sent.length, 0);
  });

  it('skips a billing-paused (abandoned-signup) workspace', async () => {
    const { systemContext } = fakeSystemContext({
      setupDeactivatedAt: new Date('2026-05-01T00:00:00Z'),
    });
    const { provider, sent } = recordingEmail();
    const res = await sendWeeklyReportForWorkspace({
      workspaceId: WS,
      now: NOW,
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
    });
    assert.equal(res.skipped, 'billing_paused');
    assert.equal(sent.length, 0);
  });

  it('is idempotent — skips when a report for the week was already sent', async () => {
    // The reported week's Sunday anchor for NOW (2026-06-12) is 2026-06-07.
    const { systemContext } = fakeSystemContext({
      alreadySentForDate: '2026-06-07',
    });
    const { provider, sent } = recordingEmail();
    const res = await sendWeeklyReportForWorkspace({
      workspaceId: WS,
      now: NOW,
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
    });
    assert.equal(res.skipped, 'already_sent');
    assert.equal(res.forDate, '2026-06-07');
    assert.equal(sent.length, 0);
  });

  it('sends with a List-Unsubscribe header and records the send for idempotency', async () => {
    const { systemContext, auditCreates } = fakeSystemContext({});
    const { provider, sent } = recordingEmail();
    const res = await sendWeeklyReportForWorkspace({
      workspaceId: WS,
      now: NOW,
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
    });

    assert.equal(res.sent, true);
    assert.equal(res.forDate, '2026-06-07');
    assert.equal(sent.length, 1);

    const msg = sent[0];
    assert.equal(msg.to, 'owner@acme.test');
    assert.match(msg.subject, /Acme Realty/);
    assert.ok(msg.headers?.['List-Unsubscribe']?.includes('/api/reports/weekly/unsubscribe'));
    assert.equal(
      msg.headers?.['List-Unsubscribe-Post'],
      'List-Unsubscribe=One-Click',
    );
    assert.equal(msg.tags?.kind, 'weekly_report');

    // Exactly one audit row recording the send, keyed by the week forDate.
    const sendAudit = auditCreates.find(
      (a) => a.action === WEEKLY_REPORT_SENT_ACTION,
    );
    assert.ok(sendAudit, 'expected a weekly_report.sent audit row');
    assert.equal(sendAudit?.targetId, '2026-06-07');
  });
});
