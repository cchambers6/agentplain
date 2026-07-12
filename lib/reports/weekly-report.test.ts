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
  businessDaysSince,
  FIRST_WEEK_NOTE_SENT_ACTION,
  sendWeeklyReportForWorkspace,
  WEEKLY_REPORT_SENT_ACTION,
} from './weekly-report';

const WS = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-06-12T12:00:00.000Z');
/** Long before NOW — clears the first-full-week gate for the legacy cases. */
const ESTABLISHED_CREATED_AT = new Date('2026-01-05T00:00:00.000Z');

interface FakeOpts {
  weeklyReportEnabled?: boolean;
  brokerEmail?: string | null;
  subscriptionStatus?: string;
  setupDeactivatedAt?: Date | null;
  alreadySentForDate?: string | null;
  createdAt?: Date;
  firstReportMode?: string | null;
  alreadyNotedForDate?: string | null;
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
        createdAt: opts.createdAt ?? ESTABLISHED_CREATED_AT,
        setupDeactivatedAt: opts.setupDeactivatedAt ?? null,
        preference: {
          weeklyReportEnabled: opts.weeklyReportEnabled ?? true,
          firstReportMode: opts.firstReportMode ?? null,
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
      findFirst: async (args: {
        where?: { action?: string; targetId?: string };
      }) => {
        if (
          args.where?.action === FIRST_WEEK_NOTE_SENT_ACTION &&
          opts.alreadyNotedForDate &&
          args.where?.targetId === opts.alreadyNotedForDate
        ) {
          return { id: 'existing-note' };
        }
        if (
          args.where?.action !== FIRST_WEEK_NOTE_SENT_ACTION &&
          opts.alreadySentForDate &&
          args.where?.targetId === opts.alreadySentForDate
        ) {
          return { id: 'existing' };
        }
        return null;
      },
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

// ── First-full-week gate (pilot dry-run 2026-07-11, P0-2) ─────────────────────
//
// Canonical pilot calendar: partner activates Monday 2026-07-06, the report
// cron fires Friday 2026-07-10. The prior Mon–Sun window (Jun 29 – Jul 5,
// forDate 2026-07-05) predates the workspace entirely — the "quiet week"
// body must never render against it.

const MONDAY_ACTIVATION = new Date('2026-07-06T13:00:00.000Z');
const FIRST_FRIDAY = new Date('2026-07-10T12:00:00.000Z');
const FIRST_FRIDAY_FOR_DATE = '2026-07-05';

describe('sendWeeklyReportForWorkspace — first-full-week gate', () => {
  it('businessDaysSince pins the gate edges', () => {
    // Monday activation → same-week Friday: Tue+Wed+Thu+Fri = 4 (< 5, gated).
    assert.equal(businessDaysSince(MONDAY_ACTIVATION, FIRST_FRIDAY), 4);
    // Monday activation → NEXT Friday: 9 (≥ 5, real report sends).
    assert.equal(
      businessDaysSince(MONDAY_ACTIVATION, new Date('2026-07-17T12:00:00.000Z')),
      9,
    );
  });

  it("mode 'note' (default): sends the first-week note, never the quiet-week body", async () => {
    const { systemContext, auditCreates } = fakeSystemContext({
      createdAt: MONDAY_ACTIVATION,
    });
    const { provider, sent } = recordingEmail();
    const res = await sendWeeklyReportForWorkspace({
      workspaceId: WS,
      now: FIRST_FRIDAY,
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
    });

    assert.equal(res.sent, true);
    assert.equal(res.firstWeekNote, true);
    assert.equal(res.forDate, FIRST_FRIDAY_FOR_DATE);
    assert.equal(sent.length, 1);

    const msg = sent[0];
    assert.equal(msg.to, 'owner@acme.test');
    assert.match(msg.subject, /first full report/);
    assert.equal(msg.tags?.kind, 'weekly_report_first_week_note');
    // The quiet-week report copy must not appear anywhere in the note.
    for (const body of [msg.subject, msg.text, msg.html]) {
      assert.ok(!/was quiet/i.test(body), 'quiet-week body must never render');
      assert.ok(!/kept watch/i.test(body), 'quiet-week subject must never render');
    }
    // Unsubscribe compliance carries over from the report stream.
    assert.ok(msg.headers?.['List-Unsubscribe']?.includes('/api/reports/weekly/unsubscribe'));

    // Audited under its own action so next Friday's REAL report is untouched.
    const noteAudit = auditCreates.find(
      (a) => a.action === FIRST_WEEK_NOTE_SENT_ACTION,
    );
    assert.ok(noteAudit, 'expected a first_week_note audit row');
    assert.equal(noteAudit?.targetId, FIRST_FRIDAY_FOR_DATE);
    assert.ok(
      !auditCreates.some((a) => a.action === WEEKLY_REPORT_SENT_ACTION),
      'no weekly_report.sent row for a first-week note',
    );
  });

  it("mode 'delay': sends nothing until the first full week completes", async () => {
    const { systemContext, auditCreates } = fakeSystemContext({
      createdAt: MONDAY_ACTIVATION,
      firstReportMode: 'delay',
    });
    const { provider, sent } = recordingEmail();
    const res = await sendWeeklyReportForWorkspace({
      workspaceId: WS,
      now: FIRST_FRIDAY,
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
    });
    assert.equal(res.sent, false);
    assert.equal(res.skipped, 'first_week_pending');
    assert.equal(sent.length, 0);
    assert.equal(auditCreates.length, 0);
  });

  it('the note is idempotent — a same-week cron retry no-ops', async () => {
    const { systemContext } = fakeSystemContext({
      createdAt: MONDAY_ACTIVATION,
      alreadyNotedForDate: FIRST_FRIDAY_FOR_DATE,
    });
    const { provider, sent } = recordingEmail();
    const res = await sendWeeklyReportForWorkspace({
      workspaceId: WS,
      now: FIRST_FRIDAY,
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
    });
    assert.equal(res.sent, false);
    assert.equal(res.skipped, 'already_sent');
    assert.equal(sent.length, 0);
  });

  it('an established workspace still gets the real report (gate passes)', async () => {
    const { systemContext } = fakeSystemContext({
      createdAt: ESTABLISHED_CREATED_AT,
    });
    const { provider, sent } = recordingEmail();
    const res = await sendWeeklyReportForWorkspace({
      workspaceId: WS,
      now: FIRST_FRIDAY,
      systemContext,
      email: provider,
      appOrigin: 'https://app.agentplain.com',
    });
    assert.equal(res.sent, true);
    assert.equal(res.firstWeekNote, undefined);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].tags?.kind, 'weekly_report');
  });
});
