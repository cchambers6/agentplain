/**
 * lib/skills/finance-pulse-general/prisma-approval-sink.ts
 *
 * Production sink — persists one `FinancePulseProposal` per workspace
 * per week as a `WorkApprovalQueueItem` (kind=FINANCE_PULSE,
 * status=PENDING, discipline='finance'). Payload encrypted at rest with
 * the v1 envelope.
 *
 * Per `project_no_outbound_architecture.md`: this is a write-only sink
 * into agentplain's own state. The pulse is for the operator to read on
 * /approvals; nothing leaves the workspace.
 *
 * Idempotency: per-week rows are scoped by `refId = forWeekStarting`,
 * so re-running the cron on the same week produces (at most) one row
 * the operator sees and dismisses.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  FINANCE_PULSE_AGENT_SLUG,
  FINANCE_PULSE_REF_TABLE,
  type FinancePulseApprovalSink,
  type FinancePulseProposal,
} from './types';

export interface PrismaFinancePulseApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaFinancePulseApprovalSink
  implements FinancePulseApprovalSink
{
  readonly name = 'prisma' as const;

  constructor(
    private readonly options: PrismaFinancePulseApprovalSinkOptions = {},
  ) {}

  async record(args: {
    workspaceId: string;
    proposal: FinancePulseProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildFinancePulseApprovalRow(args.workspaceId, args.proposal);
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
        `PrismaFinancePulseApprovalSink failed: ${message}`,
      );
    }
  }
}

export function buildFinancePulseApprovalRow(
  workspaceId: string,
  proposal: FinancePulseProposal,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: FINANCE_PULSE_AGENT_SLUG,
    kind: 'FINANCE_PULSE',
    refTable: FINANCE_PULSE_REF_TABLE,
    refId: proposal.forWeekStarting,
    status: 'PENDING',
    discipline: 'finance',
    payload: encryptPayloadForWrite({
      proposalId: proposal.proposalId,
      forWeekStarting: proposal.forWeekStarting,
      body: proposal.body,
      recommendations: proposal.recommendations,
      llmComposed: proposal.llmComposed,
      internal: proposal.snapshot.internal,
      quickbooks: proposal.snapshot.quickbooks,
      workspaceVertical: proposal.snapshot.workspaceVertical,
      noOutbound:
        'No outbound. Finance pulse drafted into /approvals for operator review.',
    }),
  };
}
