/**
 * lib/skills/persist-artifacts.bounded-execute.test.ts
 *
 * Wave-3 — proves the persist site composes the bounded-execute policy
 * on top of the Wave-1 confidence threshold, and that an auto-executed
 * row ALWAYS carries its immutable AuditLog record (and never lands
 * without one). Uses a fake transaction client so the suite stays
 * offline + deterministic (no DB, no LLM).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// persist-artifacts encrypts the approval payload — set a deterministic
// key so the write path can encrypt without throwing.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { persistSkillRunArtifacts } from './persist-artifacts';
import { InMemoryOpsFlagStore } from '@/lib/ops/flag-store';
import {
  autoExecEnabledFlagName,
  autoExecCeilingFlagName,
  BOUNDED_AUTO_EXECUTE_MASTER_ENV,
} from './bounded-execute';
import type { SkillRunRecord } from './types';
import type { OfficeAdminApprovalPayload } from './office-admin/types';

// ── Fake transaction client ────────────────────────────────────────────
interface CreatedRow {
  data: Record<string, unknown>;
}

function fakeTx() {
  const approvals: CreatedRow[] = [];
  const audits: CreatedRow[] = [];
  const tx = {
    handoffLogEntry: {
      // The record below has no steps, so createMany is never called; stub
      // it anyway so the shape is complete.
      createMany: async () => ({ count: 0 }),
    },
    workApprovalQueueItem: {
      create: async (args: { data: Record<string, unknown>; select?: unknown }) => {
        approvals.push({ data: args.data });
        return { id: `approval-${approvals.length}` };
      },
    },
    auditLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        audits.push({ data: args.data });
        return { id: `audit-${audits.length}` };
      },
    },
    // The threshold reader queries this; return null = no config = PENDING.
    workThresholdConfig: {
      findUnique: async () => null,
    },
  };
  return { tx, approvals, audits };
}

const ADMIN_PAYLOAD: OfficeAdminApprovalPayload = {
  category: 'billing-notice',
  title: 'A billing notice arrived.',
  body: ['We noticed a billing notice from Acme.'],
  priority: 'normal',
  signals: { serviceName: 'Acme' },
  fromDisplay: 'Acme <billing@acme.test>',
  subject: 'Your invoice',
  confidence: 0.9,
  draftBody: 'Noting receipt.',
  draftSubject: 'Re: Your invoice',
  classifiedAtIso: new Date().toISOString(),
};

function recordWithAdminPayload(): SkillRunRecord {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 1,
    workspaceId: 'ws-1',
    workspaceSlug: 'ws',
    verticalSlug: 'real-estate',
    webhookEventId: 'evt-1',
    llmProviderName: 'test',
    fetcherName: 'test',
    persisterName: 'test',
    steps: [],
    outcome: {
      category: null,
      threadId: null,
      scheduledProposal: null,
      draft: null,
      markedProcessed: true,
      officeAdmin: null,
      officeAdminPayload: ADMIN_PAYLOAD,
      complianceFlags: null,
    },
  };
}

const GATES_PASS = {
  fireGatePassed: true,
  billingActive: true,
  activationPassed: true,
};
function env(v: Record<string, string>): NodeJS.ProcessEnv {
  return v as unknown as NodeJS.ProcessEnv;
}

describe('persist-artifacts + bounded-execute', () => {
  it('default (no boundedExecute config) → PENDING, no audit', async () => {
    const { tx, approvals, audits } = fakeTx();
    await persistSkillRunArtifacts({
      workspaceId: 'ws-1',
      record: recordWithAdminPayload(),
      client: tx as never,
    });
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0].data.status, 'PENDING');
    assert.equal(audits.length, 0);
  });

  it('master OFF → PENDING even with config + enabled class', async () => {
    const { tx, approvals, audits } = fakeTx();
    await persistSkillRunArtifacts({
      workspaceId: 'ws-1',
      record: recordWithAdminPayload(),
      client: tx as never,
      boundedExecute: {
        store: new InMemoryOpsFlagStore({
          [autoExecEnabledFlagName('ADMIN_BILLING_NOTICE')]: 'true',
          [autoExecCeilingFlagName('ADMIN_BILLING_NOTICE')]: '100',
        }),
        gates: GATES_PASS,
        env: env({}),
      },
    });
    assert.equal(approvals[0].data.status, 'PENDING');
    assert.equal(audits.length, 0);
  });

  it('fully primed → AUTO_APPROVED + exactly one immutable audit row', async () => {
    const { tx, approvals, audits } = fakeTx();
    await persistSkillRunArtifacts({
      workspaceId: 'ws-1',
      record: recordWithAdminPayload(),
      client: tx as never,
      boundedExecute: {
        store: new InMemoryOpsFlagStore({
          [autoExecEnabledFlagName('ADMIN_BILLING_NOTICE')]: 'true',
          [autoExecCeilingFlagName('ADMIN_BILLING_NOTICE')]: '100',
        }),
        gates: GATES_PASS,
        env: env({ [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: 'on' }),
      },
    });
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0].data.status, 'AUTO_APPROVED');
    assert.equal(approvals[0].data.decidedByUserId, null);
    assert.match(String(approvals[0].data.decisionReason), /bounded-execute/);

    assert.equal(audits.length, 1, 'auto-executed row MUST carry one audit row');
    const audit = audits[0].data;
    assert.equal(audit.action, 'work_approval.auto_executed');
    assert.equal(audit.actorUserId, null);
    assert.equal(audit.workspaceId, 'ws-1');
    assert.equal((audit.payload as Record<string, unknown>).kind, 'ADMIN_BILLING_NOTICE');
  });

  it('billing paused gate → PENDING, no audit (composition, not bypass)', async () => {
    const { tx, approvals, audits } = fakeTx();
    await persistSkillRunArtifacts({
      workspaceId: 'ws-1',
      record: recordWithAdminPayload(),
      client: tx as never,
      boundedExecute: {
        store: new InMemoryOpsFlagStore({
          [autoExecEnabledFlagName('ADMIN_BILLING_NOTICE')]: 'true',
          [autoExecCeilingFlagName('ADMIN_BILLING_NOTICE')]: '100',
        }),
        gates: { ...GATES_PASS, billingActive: false },
        env: env({ [BOUNDED_AUTO_EXECUTE_MASTER_ENV]: 'on' }),
      },
    });
    assert.equal(approvals[0].data.status, 'PENDING');
    assert.equal(audits.length, 0);
  });
});
