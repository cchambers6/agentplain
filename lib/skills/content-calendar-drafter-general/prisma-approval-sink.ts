/**
 * Production sink — persists one `CalendarProposal` per workspace per
 * week as a `WorkApprovalQueueItem` (kind=CONTENT_CALENDAR, discipline='marketing').
 * Payload encrypted with the v1 envelope.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  CALENDAR_AGENT_SLUG,
  CALENDAR_REF_TABLE,
  type CalendarApprovalSink,
  type CalendarProposal,
} from './types';

export interface PrismaCalendarApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaCalendarApprovalSink implements CalendarApprovalSink {
  readonly name = 'prisma' as const;

  constructor(private readonly options: PrismaCalendarApprovalSinkOptions = {}) {}

  async record(args: {
    workspaceId: string;
    proposal: CalendarProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildCalendarApprovalRow(args.workspaceId, args.proposal);
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
        `PrismaCalendarApprovalSink failed: ${message}`,
      );
    }
  }
}

export function buildCalendarApprovalRow(
  workspaceId: string,
  proposal: CalendarProposal,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: CALENDAR_AGENT_SLUG,
    kind: 'CONTENT_CALENDAR',
    refTable: CALENDAR_REF_TABLE,
    refId: proposal.forWeekStarting,
    status: 'PENDING',
    discipline: 'marketing',
    payload: encryptPayloadForWrite({
      proposalId: proposal.proposalId,
      forWeekStarting: proposal.forWeekStarting,
      preamble: proposal.preamble,
      days: proposal.days,
      verticalSlug: proposal.snapshot.verticalSlug,
      recentCounts: proposal.snapshot.recentCounts,
      noOutbound:
        'No outbound. Calendar drafted into /approvals for operator review — nothing posts to social or email.',
    }),
  };
}
