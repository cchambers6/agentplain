/**
 * lib/skills/analytics-weekly-pulse-general/prisma-approval-sink.ts
 *
 * Production sink — persists one `PulseProposal` per workspace per week
 * as a `WorkApprovalQueueItem` (kind=ANALYTICS_PULSE, status=PENDING,
 * discipline='analytics'). Payload encrypted at rest with the v1 envelope.
 *
 * Per `project_no_outbound_architecture.md`: this is a write-only sink
 * into agentplain's own state. The pulse is for the operator to read on
 * /approvals; nothing leaves the workspace.
 *
 * Idempotency: per-week rows are scoped by `refId = forWeekStarting`,
 * so re-running the cron on the same week is a no-op via the same row
 * (the upsert path could be tightened later; for now the operator just
 * sees one row per week — duplicates are visible + dismissable).
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  PULSE_AGENT_SLUG,
  PULSE_REF_TABLE,
  type PulseApprovalSink,
  type PulseProposal,
} from './types';

export interface PrismaPulseApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaPulseApprovalSink implements PulseApprovalSink {
  readonly name = 'prisma' as const;

  constructor(private readonly options: PrismaPulseApprovalSinkOptions = {}) {}

  async record(args: {
    workspaceId: string;
    proposal: PulseProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildPulseApprovalRow(args.workspaceId, args.proposal);
    try {
      if (this.options.tx) {
        const created = await this.options.tx.workApprovalQueueItem.create({
          data: row,
          select: { id: true },
        });
        return skillOk({ sinkId: created.id });
      }
      const ctx = {
        userId: null,
        workspaceId: args.workspaceId,
        isOperator: true,
      } as const;
      const id = await withRls(
        ctx,
        async (tx) => {
          const created = await tx.workApprovalQueueItem.create({
            data: row,
            select: { id: true },
          });
          return created.id;
        },
        this.options.client ? { client: this.options.client } : undefined,
      );
      return skillOk({ sinkId: id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError(
        'UNKNOWN',
        `PrismaPulseApprovalSink failed: ${message}`,
      );
    }
  }
}

export function buildPulseApprovalRow(
  workspaceId: string,
  proposal: PulseProposal,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: PULSE_AGENT_SLUG,
    kind: 'ANALYTICS_PULSE',
    refTable: PULSE_REF_TABLE,
    refId: proposal.forWeekStarting,
    status: 'PENDING',
    discipline: 'analytics',
    payload: encryptPayloadForWrite({
      proposalId: proposal.proposalId,
      forWeekStarting: proposal.forWeekStarting,
      body: proposal.body,
      recommendations: proposal.recommendations,
      counts: proposal.snapshot.counts,
      topKindsByThroughput: proposal.snapshot.topKindsByThroughput,
      installedSkillsNotFiring: proposal.snapshot.installedSkillsNotFiring,
      noOutbound:
        'No outbound. Pulse drafted into /approvals for operator review.',
    }),
  };
}
