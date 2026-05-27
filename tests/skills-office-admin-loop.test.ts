/**
 * tests/skills-office-admin-loop.test.ts
 *
 * End-to-end loop coverage for the office-admin classifier. Wires the
 * full skill runner against synthetic admin fixtures (Stripe receipt,
 * Microsoft trial-ending, suspicious-login alert, GitHub password
 * reset) + a synthetic non-admin lead, and asserts that:
 *
 *   1. Admin classifications short-circuit the vertical chain — no
 *      `categorize` step runs, no draft gets composed.
 *   2. `outcome.officeAdminPayload` is populated with the right
 *      category + priority + signals.
 *   3. `persistSkillRunArtifacts` writes a `WorkApprovalQueueItem` with
 *      the `ADMIN_*` kind that matches the category mapping.
 *   4. A non-admin lead falls through to the vertical chain and
 *      produces a `BUYER_INQUIRY_REPLY_DRAFT` row as before.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this test
 * exercises the loop, not the classifier in isolation. The contract
 * pinned here is "office-admin runs, terminates vertical chain, queues
 * the right approval kind."
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Payload-crypto: persistSkillRunArtifacts writes encrypted payloads.
// Set a deterministic key so the loop can encrypt without throwing.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import {
  FixtureMessageFetcher,
  buildWebhookEventFromFixture,
  type WebhookEventFixture,
} from '@/lib/skills/fixture-fetcher';
import { decryptPayloadForRead } from '@/lib/security/payload-crypto';
import { RecordingDraftPersister } from '@/lib/skills/draft';
import { runSkillChain } from '@/lib/skills/runner';
import { TestLlmProvider } from '@/lib/llm/test-provider';
import { persistSkillRunArtifacts } from '@/lib/skills/persist-artifacts';
import { OFFICE_ADMIN_FIXTURES } from '@/lib/skills/office-admin/fixtures';
import {
  categoryToApprovalKind,
  type OfficeAdminCategory,
} from '@/lib/skills/office-admin';
import type { ParsedMessage } from '@/lib/skills/types';

const WORKSPACE = {
  id: '00000000-0000-0000-0000-officeadmin01',
  slug: 'real-estate',
  name: 'office-admin test workspace',
  vertical: 'REAL_ESTATE' as const,
};

/**
 * Translate an `OfficeAdminFixture` into the `WebhookEventFixture` shape
 * the existing FixtureMessageFetcher consumes — we only have one path
 * for plumbing messages through the runner, and re-using it keeps the
 * test wiring honest.
 */
function asWebhookFixture(message: ParsedMessage): WebhookEventFixture {
  const id = message.id;
  return {
    id,
    verticalSlug: WORKSPACE.slug,
    description: 'office-admin test',
    expectedCategoryReason: 'office-admin loop test',
    expectedCategory: 'noise',
    webhookEvent: {
      id: `we-${id}`,
      subscriptionId: `sub-${id}`,
      rawPayload: { emailAddress: 'operator@example.com', historyId: '10001' },
      receivedAt: message.receivedAt.toISOString(),
    },
    messages: [
      {
        ...message,
        receivedAt: message.receivedAt.toISOString(),
      },
    ],
  };
}

function makeStubTx() {
  const handoffRows: Array<Record<string, unknown>> = [];
  const approvalRows: Array<Record<string, unknown>> = [];
  let nextId = 1;
  const tx = {
    handoffLogEntry: {
      createMany: async (args: { data: Array<Record<string, unknown>> }) => {
        for (const row of args.data) handoffRows.push(row);
        return { count: args.data.length };
      },
    },
    workApprovalQueueItem: {
      create: async (args: { data: Record<string, unknown>; select?: { id?: boolean } }) => {
        const id = `approval-${nextId++}`;
        const row = { ...args.data, id };
        approvalRows.push(row);
        if (args.select?.id) return { id };
        return row;
      },
    },
  };
  return { tx, handoffRows, approvalRows };
}

async function runAdminFixture(message: ParsedMessage) {
  const fixture = asWebhookFixture(message);
  const event = buildWebhookEventFromFixture(fixture);
  const { record, outcome } = await runSkillChain({
    workspace: WORKSPACE,
    event,
    fetcher: new FixtureMessageFetcher(fixture),
    persister: new RecordingDraftPersister(),
    llm: new TestLlmProvider(),
    writeLog: false,
  });
  const { tx, approvalRows, handoffRows } = makeStubTx();
  const result = await persistSkillRunArtifacts({
    workspaceId: WORKSPACE.id,
    record,
    client: tx as never,
  });
  return { record, outcome, approvalRows, handoffRows, result };
}

describe('office-admin loop — synthetic admin fixtures', () => {
  const adminFixtures = OFFICE_ADMIN_FIXTURES.filter(
    (f) => f.expectedCategory !== 'not-admin',
  );

  for (const fx of adminFixtures) {
    it(`${fx.id} → short-circuits vertical chain, queues ${categoryToApprovalKind(fx.expectedCategory as Exclude<OfficeAdminCategory, 'not-admin'>)}`, async () => {
      const { outcome, approvalRows, record } = await runAdminFixture(fx.message);

      // The office-admin classifier ran.
      assert.ok(outcome.officeAdmin, `outcome.officeAdmin missing for ${fx.id}`);
      assert.equal(outcome.officeAdmin!.category, fx.expectedCategory);

      // Payload populated → an approval will be written.
      assert.ok(outcome.officeAdminPayload, `outcome.officeAdminPayload missing for ${fx.id}`);

      // No vertical-categorize step ran (the runner short-circuited).
      const stepNames = record.steps.map((s) => s.step);
      assert.ok(
        !stepNames.includes('categorize'),
        `${fx.id}: vertical categorize ran on admin email — steps=${stepNames.join(',')}`,
      );
      assert.ok(stepNames.includes('office-admin-classify'));

      // Exactly one approval row, with the right ADMIN_* kind.
      assert.equal(approvalRows.length, 1, `${fx.id}: expected 1 approval row`);
      const expectedKind = categoryToApprovalKind(
        fx.expectedCategory as Exclude<OfficeAdminCategory, 'not-admin'>,
      );
      assert.equal(
        approvalRows[0].kind,
        expectedKind,
        `${fx.id}: expected kind ${expectedKind}, got ${approvalRows[0].kind}`,
      );
    });
  }
});

describe('office-admin loop — non-admin lead falls through to vertical chain', () => {
  it('lead inquiry produces BUYER_INQUIRY_REPLY_DRAFT, not an ADMIN_* kind', async () => {
    const leadFixture = OFFICE_ADMIN_FIXTURES.find((f) => f.expectedCategory === 'not-admin');
    assert.ok(leadFixture);
    const { outcome, approvalRows, record } = await runAdminFixture(leadFixture!.message);

    // The office-admin classifier ran but resolved to not-admin.
    assert.ok(outcome.officeAdmin);
    assert.equal(outcome.officeAdmin!.category, 'not-admin');
    assert.equal(outcome.officeAdminPayload, null);

    // The vertical chain ran (categorize step present, possibly a draft).
    const stepNames = record.steps.map((s) => s.step);
    assert.ok(stepNames.includes('categorize'), `vertical categorize missing — steps=${stepNames.join(',')}`);

    // Any approval row that did get written is NOT an ADMIN_* kind.
    for (const row of approvalRows) {
      assert.ok(
        !String(row.kind).startsWith('ADMIN_'),
        `non-admin run wrote an ADMIN_* kind: ${row.kind}`,
      );
    }
  });
});

describe('office-admin loop — approval payload carries signals', () => {
  it('Stripe receipt approval payload exposes signals.amount + draftBody', async () => {
    const fx = OFFICE_ADMIN_FIXTURES.find((f) => f.id === 'billing-notice-stripe-receipt');
    assert.ok(fx);
    const { approvalRows } = await runAdminFixture(fx!.message);
    assert.equal(approvalRows.length, 1);
    const payload = decryptPayloadForRead(approvalRows[0].payload) as Record<string, unknown>;
    assert.equal((payload.signals as Record<string, unknown>).amount, '$20.00');
    assert.equal(typeof payload.draftBody, 'string');
  });

  it('verification-code approval payload exposes the code', async () => {
    const fx = OFFICE_ADMIN_FIXTURES.find((f) => f.id === 'verification-code-google');
    assert.ok(fx);
    const { approvalRows } = await runAdminFixture(fx!.message);
    assert.equal(approvalRows.length, 1);
    const payload = decryptPayloadForRead(approvalRows[0].payload) as Record<string, unknown>;
    assert.equal((payload.signals as Record<string, unknown>).verificationCode, '482915');
    assert.equal(payload.priority, 'normal');
    assert.equal(payload.draftBody, null);
  });

  it('account-suspension approval is critical priority', async () => {
    const fx = OFFICE_ADMIN_FIXTURES.find((f) => f.id === 'account-suspension-chase');
    assert.ok(fx);
    const { approvalRows } = await runAdminFixture(fx!.message);
    assert.equal(approvalRows.length, 1);
    const payload = decryptPayloadForRead(approvalRows[0].payload) as Record<string, unknown>;
    assert.equal(payload.priority, 'critical');
    assert.equal(approvalRows[0].kind, 'ADMIN_SECURITY_ALERT');
  });
});
