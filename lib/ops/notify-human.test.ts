/**
 * Tests for the notify-human seam (pfd-4).
 *
 * The bar: a page is durable (OpsFlag row) even if the email fails — the
 * surface self-routes to a human and the page is never lost.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notifyHuman, HUMAN_PAGE_FLAG_PREFIX } from './notify-human';
import { InMemoryOpsFlagStore } from './flag-store';
import { TestEmailProvider } from '@/lib/email/test-provider';

describe('notifyHuman', () => {
  it('writes a durable OpsFlag page row AND emails the operator', async () => {
    const flagStore = new InMemoryOpsFlagStore();
    const email = new TestEmailProvider();
    const deadline = new Date('2026-06-13T17:00:00.000Z');

    const result = await notifyHuman(
      {
        key: 'unsupported-vertical-refund:ws-1',
        subject: 'Leaking workspace',
        body: 'Workspace ws-1 is leaking. Refund or ratify.',
        deadline,
        severity: 'critical',
      },
      { flagStore, email, recipients: ['ops@agentplain.example'] },
    );

    assert.equal(result.flagName, `${HUMAN_PAGE_FLAG_PREFIX}unsupported-vertical-refund:ws-1`);
    assert.equal(result.emailed, true);
    const row = flagStore.peek(result.flagName);
    assert.ok(row, 'durable flag row written');
    assert.equal(row?.value, 'open');
    assert.match(row?.note ?? '', /Deadline: 2026-06-13/);
    assert.equal(email.sent.length, 1);
    assert.equal(email.sent[0].to, 'ops@agentplain.example');
  });

  it('still writes the durable flag when the email provider throws (page never lost)', async () => {
    const flagStore = new InMemoryOpsFlagStore();
    const throwingEmail = {
      providerName: 'throwing',
      send: async () => {
        throw new Error('resend down');
      },
    };

    const result = await notifyHuman(
      {
        key: 'k',
        subject: 's',
        body: 'b',
        deadline: new Date(),
      },
      { flagStore, email: throwingEmail, recipients: ['ops@agentplain.example'] },
    );

    assert.equal(result.emailed, false, 'email failed');
    assert.ok(flagStore.peek(result.flagName), 'but the durable page survived');
  });
});
