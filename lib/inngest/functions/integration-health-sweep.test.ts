/**
 * lib/inngest/functions/integration-health-sweep.test.ts
 *
 * Bar (if Conner died tomorrow): a local-business owner whose Gmail token
 * expired finds out FROM US — with a one-click fix — within 24h, NOT from
 * weeks of silently-missing drafts. This sweep is that surface.
 *
 * Pins: an UNHEALTHY probe persists UNHEALTHY (the banner reads this) + emails
 * the owner ONCE per breakage (no daily spam) + escalates to a human only after
 * >72h (once) + on recovery flushes the workspace's retry queue.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runIntegrationHealthSweep,
  ESCALATE_AFTER_MS,
  INTEGRATION_HEALTH_SWEEP_CRON,
  INTEGRATION_HEALTH_SWEEP_FUNCTION_ID,
} from './integration-health-sweep';
import { TestIntegrationHealthProbe } from '@/lib/integrations/health-probe';
import { InMemoryHealthStore } from '@/lib/integrations/health-store';
import { InMemoryRetryStore } from '@/lib/integrations/retry-store';
import type { PageHumanInput } from '@/lib/ops/page-human';
import type { EmailProvider, SendEmailRequest } from '@/lib/email';

const WS = '22222222-2222-2222-2222-222222222222';
const NOW = new Date('2026-06-10T00:00:00Z');

function fakeEmail() {
  const sent: SendEmailRequest[] = [];
  const provider: EmailProvider = {
    providerName: 'test',
    async send(req) {
      sent.push(req);
      return { messageId: 'm_1' };
    },
  };
  return { sent, provider };
}

function fakePager() {
  const pages: PageHumanInput[] = [];
  const fn = async (input: PageHumanInput) => {
    pages.push(input);
    return {
      delivered: true, recipients: ['ops@agentplain.com'],
      usedFallbackRecipient: false, persisted: true, auditLogId: 'a1',
    };
  };
  return { pages, fn };
}

const ONE_GMAIL = [
  { workspaceId: WS, workspaceName: 'Maple Realty', provider: 'GOOGLE' as const, ownerEmail: 'owner@maple.com' },
];

describe('integration health sweep — healthy', () => {
  it('persists HEALTHY, banners nothing, emails no one', async () => {
    const store = new InMemoryHealthStore();
    const email = fakeEmail();
    const report = await runIntegrationHealthSweep({
      listConnected: async () => ONE_GMAIL,
      probe: new TestIntegrationHealthProbe({ [`${WS}:GOOGLE`]: { status: 'healthy', kind: 'CREDENTIAL_ONLY' } }),
      store,
      email: email.provider,
      now: NOW,
    });
    assert.equal(report.healthy, 1);
    assert.equal(report.emailsSent, 0);
    assert.equal(store.peek(WS, 'GOOGLE')?.status, 'HEALTHY');
    assert.equal(email.sent.length, 0);
  });
});

describe('integration health sweep — breakage', () => {
  it('persists UNHEALTHY (banner reads this) + emails the owner ONCE', async () => {
    const store = new InMemoryHealthStore();
    const email = fakeEmail();
    const probe = new TestIntegrationHealthProbe({
      [`${WS}:GOOGLE`]: { status: 'unhealthy', kind: 'CREDENTIAL_ONLY', detail: 'GRANT_REVOKED' },
    });

    // First run: breakage detected → UNHEALTHY + one email.
    const r1 = await runIntegrationHealthSweep({
      listConnected: async () => ONE_GMAIL, probe, store, email: email.provider, now: NOW,
    });
    assert.equal(r1.unhealthy, 1);
    assert.equal(r1.emailsSent, 1);
    assert.equal(store.peek(WS, 'GOOGLE')?.status, 'UNHEALTHY');
    assert.ok(store.peek(WS, 'GOOGLE')?.unhealthySince, 'breakage anchored');
    assert.equal(email.sent.length, 1);
    assert.match(email.sent[0].subject, /Reconnect Gmail/);

    // Second run next day, still broken: NO repeat email (no daily spam).
    const r2 = await runIntegrationHealthSweep({
      listConnected: async () => ONE_GMAIL, probe, store, email: email.provider,
      now: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    });
    assert.equal(r2.emailsSent, 0, 'no second email for the same breakage');
    assert.equal(email.sent.length, 1, 'still just one email total');
  });

  it('does NOT change customer-facing state on an indeterminate probe', async () => {
    const store = new InMemoryHealthStore();
    const email = fakeEmail();
    const report = await runIntegrationHealthSweep({
      listConnected: async () => ONE_GMAIL,
      probe: new TestIntegrationHealthProbe({
        [`${WS}:GOOGLE`]: { status: 'indeterminate', detail: '503 transient' },
      }),
      store,
      email: email.provider,
      now: NOW,
    });
    assert.equal(report.indeterminate, 1);
    assert.equal(report.unhealthy, 0);
    assert.equal(email.sent.length, 0, 'no false-alarm email on a transient blip');
    assert.notEqual(store.peek(WS, 'GOOGLE')?.status, 'UNHEALTHY');
  });
});

describe('integration health sweep — >72h escalation', () => {
  it('pages a human exactly once after the breakage exceeds 72h', async () => {
    const breakageStart = NOW;
    const store = new InMemoryHealthStore([
      {
        workspaceId: WS, provider: 'GOOGLE', status: 'UNHEALTHY', checkKind: 'CREDENTIAL_ONLY',
        lastError: 'GRANT_REVOKED', lastCheckedAt: breakageStart, unhealthySince: breakageStart,
        notifiedAt: breakageStart, escalatedAt: null,
      },
    ]);
    const email = fakeEmail();
    const pager = fakePager();
    const probe = new TestIntegrationHealthProbe({
      [`${WS}:GOOGLE`]: { status: 'unhealthy', kind: 'CREDENTIAL_ONLY', detail: 'GRANT_REVOKED' },
    });
    const past72h = new Date(breakageStart.getTime() + ESCALATE_AFTER_MS + 60_000);

    const r1 = await runIntegrationHealthSweep({
      listConnected: async () => ONE_GMAIL, probe, store, email: email.provider,
      page: pager.fn as never, now: past72h,
    });
    assert.equal(r1.escalated, 1);
    assert.equal(pager.pages.length, 1);
    assert.equal(pager.pages[0].severity, 'warn');
    assert.match(pager.pages[0].summary, /broken > 72h/);
    assert.equal(store.peek(WS, 'GOOGLE')?.escalatedAt?.getTime(), past72h.getTime());

    // A later run does NOT page again for the same breakage.
    const r2 = await runIntegrationHealthSweep({
      listConnected: async () => ONE_GMAIL, probe, store, email: email.provider,
      page: pager.fn as never, now: new Date(past72h.getTime() + 24 * 60 * 60 * 1000),
    });
    assert.equal(r2.escalated, 0);
    assert.equal(pager.pages.length, 1, 'escalation fired once per breakage');
  });

  it('does NOT escalate before 72h', async () => {
    const store = new InMemoryHealthStore([
      {
        workspaceId: WS, provider: 'GOOGLE', status: 'UNHEALTHY', checkKind: 'CREDENTIAL_ONLY',
        lastError: 'x', lastCheckedAt: NOW, unhealthySince: NOW, notifiedAt: NOW, escalatedAt: null,
      },
    ]);
    const pager = fakePager();
    const report = await runIntegrationHealthSweep({
      listConnected: async () => ONE_GMAIL,
      probe: new TestIntegrationHealthProbe({ [`${WS}:GOOGLE`]: { status: 'unhealthy', kind: 'CREDENTIAL_ONLY', detail: 'x' } }),
      store,
      email: fakeEmail().provider,
      page: pager.fn as never,
      now: new Date(NOW.getTime() + 48 * 60 * 60 * 1000), // only 48h
    });
    assert.equal(report.escalated, 0);
    assert.equal(pager.pages.length, 0);
  });
});

describe('integration health sweep — recovery flushes the retry queue', () => {
  it('on UNHEALTHY→HEALTHY transition, resumes queued work + clears bookkeeping', async () => {
    const store = new InMemoryHealthStore([
      {
        workspaceId: WS, provider: 'GOOGLE', status: 'UNHEALTHY', checkKind: 'CREDENTIAL_ONLY',
        lastError: 'was broken', lastCheckedAt: NOW, unhealthySince: NOW, notifiedAt: NOW, escalatedAt: null,
      },
    ]);
    // A queued draft sits waiting on the broken Gmail integration.
    const retryStore = new InMemoryRetryStore([
      {
        id: 'q1', workspaceId: WS, provider: 'GOOGLE', actionKind: 'lead-triage.persist-draft',
        payload: {} as never, idempotencyKey: 'd1', status: 'PENDING', attempts: 0,
        nextAttemptAt: null, lastError: null, diedAt: null, resolvedAt: null,
        createdAt: NOW, updatedAt: NOW,
      },
    ]);
    let resumed = false;
    const report = await runIntegrationHealthSweep({
      listConnected: async () => ONE_GMAIL,
      probe: new TestIntegrationHealthProbe({ [`${WS}:GOOGLE`]: { status: 'healthy', kind: 'CREDENTIAL_ONLY' } }),
      store,
      retryStore,
      registry: { 'lead-triage.persist-draft': async () => { resumed = true; return { ok: true }; } },
      email: fakeEmail().provider,
      now: new Date(NOW.getTime() + 60_000),
    });

    assert.equal(report.recovered, 1, 'recovery detected');
    assert.equal(report.resumedActions, 1, 'queued work flushed on reconnect');
    assert.ok(resumed, 'the queued draft handler ran');
    assert.equal(retryStore.rows[0].status, 'RESOLVED');
    const row = store.peek(WS, 'GOOGLE');
    assert.equal(row?.status, 'HEALTHY');
    assert.equal(row?.unhealthySince, null, 'breakage anchor cleared');
    assert.equal(row?.notifiedAt, null, 'notify de-dupe cleared so a future breakage re-notifies');
    assert.equal(row?.escalatedAt, null, 'escalation de-dupe cleared');
  });
});

describe('integration health sweep — cron metadata', () => {
  it('keeps the documented id + daily schedule', () => {
    assert.equal(INTEGRATION_HEALTH_SWEEP_FUNCTION_ID, 'agentplain-integration-health-sweep');
    assert.equal(INTEGRATION_HEALTH_SWEEP_CRON, '0 9 * * *');
  });
});
