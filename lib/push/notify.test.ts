/**
 * Tests for the approval-ready notification trigger (pilot dry-run
 * 2026-07-11, P0-1). DI throughout — a fake systemContext serves the
 * workspace read, a recording EmailProvider captures sends, and the
 * device lookup is stubbed empty (the mobile app has not shipped; email
 * must deliver on its own).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import type { EmailProvider, SendEmailRequest } from '@/lib/email';
import {
  decideApprovalEmailDelivery,
  isWithinBusinessHoursEt,
} from '@/lib/notifications/approval-ready-email';
import { notifyApprovalQueued } from './notify';

const WS = '22222222-2222-2222-2222-222222222222';
// Friday 2026-07-10 10:30pm ET — a lead lands after the office closed.
// (02:30Z on the 11th; EDT is UTC-4.)
const AFTER_HOURS = new Date('2026-07-11T02:30:00.000Z');
// Friday 2026-07-10 11:00am ET — squarely inside business hours.
const MIDDAY = new Date('2026-07-10T15:00:00.000Z');

interface FakeOpts {
  approvalEmailMode?: string | null;
  members?: Array<{ userId: string; email: string | null }>;
}

function fakeSystemContext(opts: FakeOpts) {
  const findUniqueArgs: Array<Record<string, unknown>> = [];
  const members = opts.members ?? [
    { userId: 'user-owner', email: 'sarah@peachtree.test' },
  ];
  const tx = {
    workspace: {
      findUnique: async (args: {
        select?: {
          memberships?: { where?: { userId?: string } };
        };
      }) => {
        findUniqueArgs.push(args);
        const approverFilter = args.select?.memberships?.where?.userId;
        const matched = approverFilter
          ? members.filter((m) => m.userId === approverFilter)
          : members;
        return {
          name: 'Peachtree Realty',
          preference:
            opts.approvalEmailMode === undefined
              ? null
              : { approvalEmailMode: opts.approvalEmailMode },
          memberships: matched.map((m) => ({
            userId: m.userId,
            user: { email: m.email },
          })),
        };
      },
    },
  } as unknown as Prisma.TransactionClient;
  const systemContext = <T,>(
    fn: (t: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> => fn(tx);
  return { systemContext, findUniqueArgs };
}

function recordingEmail(): { provider: EmailProvider; sent: SendEmailRequest[] } {
  const sent: SendEmailRequest[] = [];
  const provider: EmailProvider = {
    providerName: 'test',
    async send(req) {
      sent.push(req);
      return { messageId: 're_test_notify' };
    },
  };
  return { provider, sent };
}

const noDevices = async () => [];

describe('business-hours window (ET)', () => {
  it('classifies the pilot clock correctly', () => {
    assert.equal(isWithinBusinessHoursEt(AFTER_HOURS), false);
    assert.equal(isWithinBusinessHoursEt(MIDDAY), true);
    // Saturday noon ET is outside the window regardless of hour.
    assert.equal(
      isWithinBusinessHoursEt(new Date('2026-07-11T16:00:00.000Z')),
      false,
    );
  });

  it('mode decision matrix', () => {
    assert.equal(decideApprovalEmailDelivery('always', AFTER_HOURS), 'send');
    assert.equal(
      decideApprovalEmailDelivery('business_hours', AFTER_HOURS),
      'hold_for_digest',
    );
    assert.equal(decideApprovalEmailDelivery('business_hours', MIDDAY), 'send');
    assert.equal(
      decideApprovalEmailDelivery('digest', MIDDAY),
      'hold_for_digest',
    );
  });
});

describe('notifyApprovalQueued — email channel', () => {
  it('default mode emails the broker-owner even after hours (the sold premise)', async () => {
    const { systemContext } = fakeSystemContext({});
    const { provider, sent } = recordingEmail();
    const res = await notifyApprovalQueued(
      { workspaceId: WS },
      {
        systemContext,
        email: provider,
        listDevices: noDevices,
        appOrigin: 'https://app.agentplain.com',
        now: AFTER_HOURS,
      },
    );

    assert.equal(res.emailsSent, 1);
    assert.equal(res.emailsHeldForDigest, 0);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'sarah@peachtree.test');
    assert.match(sent[0].subject, /drafted a reply/);
    assert.ok(
      sent[0].html.includes(`https://app.agentplain.com/app/workspace/${WS}/approvals`),
      'email must deep-link the approvals queue',
    );
    assert.equal(sent[0].tags?.kind, 'approval_ready');
    // Honesty bar: the email never claims anything was sent for the owner.
    assert.ok(!/we sent|was sent/i.test(sent[0].text));
  });

  it("mode 'business_hours' holds an after-hours ping for the morning digest", async () => {
    const { systemContext } = fakeSystemContext({
      approvalEmailMode: 'business_hours',
    });
    const { provider, sent } = recordingEmail();
    const res = await notifyApprovalQueued(
      { workspaceId: WS },
      {
        systemContext,
        email: provider,
        listDevices: noDevices,
        appOrigin: 'https://app.agentplain.com',
        now: AFTER_HOURS,
      },
    );
    assert.equal(res.emailsSent, 0);
    assert.equal(res.emailsHeldForDigest, 1);
    assert.equal(sent.length, 0);
  });

  it("mode 'business_hours' sends immediately during the day", async () => {
    const { systemContext } = fakeSystemContext({
      approvalEmailMode: 'business_hours',
    });
    const { provider, sent } = recordingEmail();
    const res = await notifyApprovalQueued(
      { workspaceId: WS },
      {
        systemContext,
        email: provider,
        listDevices: noDevices,
        appOrigin: 'https://app.agentplain.com',
        now: MIDDAY,
      },
    );
    assert.equal(res.emailsSent, 1);
    assert.equal(sent.length, 1);
  });

  it("mode 'digest' never emails immediately", async () => {
    const { systemContext } = fakeSystemContext({ approvalEmailMode: 'digest' });
    const { provider, sent } = recordingEmail();
    const res = await notifyApprovalQueued(
      { workspaceId: WS },
      {
        systemContext,
        email: provider,
        listDevices: noDevices,
        appOrigin: 'https://app.agentplain.com',
        now: MIDDAY,
      },
    );
    assert.equal(res.emailsSent, 0);
    assert.equal(res.emailsHeldForDigest, 1);
    assert.equal(sent.length, 0);
  });

  it('an unknown stored mode falls back to always — a bad row can never silence the ping', async () => {
    const { systemContext } = fakeSystemContext({ approvalEmailMode: 'x-typo' });
    const { provider, sent } = recordingEmail();
    const res = await notifyApprovalQueued(
      { workspaceId: WS },
      {
        systemContext,
        email: provider,
        listDevices: noDevices,
        appOrigin: 'https://app.agentplain.com',
        now: AFTER_HOURS,
      },
    );
    assert.equal(res.emailsSent, 1);
    assert.equal(sent.length, 1);
  });

  it('count > 1 renders plural copy', async () => {
    const { systemContext } = fakeSystemContext({});
    const { provider, sent } = recordingEmail();
    await notifyApprovalQueued(
      { workspaceId: WS, count: 3 },
      {
        systemContext,
        email: provider,
        listDevices: noDevices,
        appOrigin: 'https://app.agentplain.com',
        now: MIDDAY,
      },
    );
    assert.match(sent[0].subject, /3 replies/);
  });

  it('a routed DisciplineHead is the only recipient', async () => {
    const { systemContext } = fakeSystemContext({
      members: [
        { userId: 'user-owner', email: 'sarah@peachtree.test' },
        { userId: 'user-head', email: 'head@peachtree.test' },
      ],
    });
    const { provider, sent } = recordingEmail();
    const res = await notifyApprovalQueued(
      { workspaceId: WS, requiredApproverUserId: 'user-head' },
      {
        systemContext,
        email: provider,
        listDevices: noDevices,
        appOrigin: 'https://app.agentplain.com',
        now: MIDDAY,
      },
    );
    assert.equal(res.emailsSent, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'head@peachtree.test');
  });

  it('a provider failure degrades to zero counts, never throws', async () => {
    const { systemContext } = fakeSystemContext({});
    const failing: EmailProvider = {
      providerName: 'failing',
      async send() {
        throw new Error('resend down');
      },
    };
    const res = await notifyApprovalQueued(
      { workspaceId: WS },
      {
        systemContext,
        email: failing,
        listDevices: noDevices,
        appOrigin: 'https://app.agentplain.com',
        now: MIDDAY,
      },
    );
    assert.equal(res.emailsSent, 0);
  });
});
