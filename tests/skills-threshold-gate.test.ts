/**
 * tests/skills-threshold-gate.test.ts
 *
 * Wave-1 audit fix §9 #2 — end-to-end test that proves the
 * WorkThresholdConfig reader actually changes the approval-queue row
 * status that persist-artifacts writes.
 *
 *   1. Configure auto-approve at minConfidence=0.0 → drafted approval
 *      row lands AUTO_APPROVED.
 *   2. Configure auto-approve at minConfidence=0.99 → same draft lands
 *      PENDING (didn't meet the bar).
 *   3. No threshold row at all → PENDING (safe default — backwards
 *      compatible with workspaces that never opted in).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { persistSkillRunArtifacts } from '@/lib/skills/persist-artifacts';
import type { SkillRunRecord } from '@/lib/skills/types';
import type { Prisma } from '@prisma/client';

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000333';

function buildRecord(args: { confidence: number }): SkillRunRecord {
  return {
    startedAt: '2026-05-29T12:00:00.000Z',
    finishedAt: '2026-05-29T12:00:01.000Z',
    durationMs: 1000,
    workspaceId: WORKSPACE_ID,
    workspaceSlug: 'threshold-test',
    verticalSlug: 'real-estate',
    webhookEventId: 'evt-1',
    llmProviderName: 'test',
    fetcherName: 'stub',
    persisterName: 'stub',
    steps: [
      { step: 'read', ok: true, summary: 'ok', durationMs: 1 },
      { step: 'categorize', ok: true, summary: 'intent=draft-needed', durationMs: 1 },
      { step: 'coordinate', ok: true, summary: 'ok', durationMs: 1 },
      { step: 'draft', ok: true, summary: 'ok', durationMs: 1 },
      { step: 'mark-processed', ok: true, summary: 'ok', durationMs: 0 },
    ],
    outcome: {
      category: 'draft-needed',
      threadId: 'thread-1',
      scheduledProposal: null,
      draft: {
        draftId: 'draft-1',
        providerDraftId: null,
        subject: 'Re: question',
        body: 'Thanks for reaching out — happy to help.',
        tone: 'casual',
        confidence: args.confidence,
        persisted: false,
      },
      markedProcessed: true,
      officeAdmin: null,
      officeAdminPayload: null,
      complianceFlags: null,
    },
  };
}

interface StubTxResult {
  approvalRows: Array<Record<string, unknown>>;
}

function buildStubTx(args: {
  threshold: { autoApproveWhen: Prisma.JsonValue | null } | null;
}): { tx: Prisma.TransactionClient; rows: StubTxResult } {
  const approvalRows: Array<Record<string, unknown>> = [];
  let nextId = 1;
  const tx = {
    handoffLogEntry: {
      createMany: async () => ({ count: 0 }),
    },
    workApprovalQueueItem: {
      create: async (createArgs: {
        data: Record<string, unknown>;
        select?: { id?: boolean };
      }) => {
        const id = `approval-${nextId++}`;
        approvalRows.push({ ...createArgs.data, id });
        return { id };
      },
    },
    workThresholdConfig: {
      findUnique: async () => {
        if (!args.threshold) return null;
        return {
          requiresApprovalAboveSeverity: null,
          autoApproveWhen: args.threshold.autoApproveWhen,
        };
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, rows: { approvalRows } };
}

describe('persist-artifacts threshold gate — wave-1 audit §9 #2', () => {
  it('AUTO_APPROVES a drafted row when workspace opted in (minConfidence=0)', async () => {
    const { tx, rows } = buildStubTx({
      threshold: { autoApproveWhen: { minConfidence: 0 } },
    });
    await persistSkillRunArtifacts({
      workspaceId: WORKSPACE_ID,
      record: buildRecord({ confidence: 0.6 }),
      client: tx,
    });
    assert.equal(rows.approvalRows.length, 1);
    assert.equal(rows.approvalRows[0].status, 'AUTO_APPROVED');
    assert.ok(rows.approvalRows[0].decidedAt, 'decidedAt should be set');
    assert.match(
      String(rows.approvalRows[0].decisionReason),
      /workspace threshold config/,
    );
  });

  it('stays PENDING when confidence below opt-in bar', async () => {
    const { tx, rows } = buildStubTx({
      threshold: { autoApproveWhen: { minConfidence: 0.99 } },
    });
    await persistSkillRunArtifacts({
      workspaceId: WORKSPACE_ID,
      record: buildRecord({ confidence: 0.6 }),
      client: tx,
    });
    assert.equal(rows.approvalRows.length, 1);
    assert.equal(rows.approvalRows[0].status, 'PENDING');
    assert.equal(rows.approvalRows[0].decidedAt, null);
  });

  it('stays PENDING when no threshold row exists (safe default)', async () => {
    const { tx, rows } = buildStubTx({ threshold: null });
    await persistSkillRunArtifacts({
      workspaceId: WORKSPACE_ID,
      record: buildRecord({ confidence: 0.95 }),
      client: tx,
    });
    assert.equal(rows.approvalRows.length, 1);
    assert.equal(rows.approvalRows[0].status, 'PENDING');
  });
});
