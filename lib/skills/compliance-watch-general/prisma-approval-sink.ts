import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import {
  COMPLIANCE_AGENT_SLUG,
  COMPLIANCE_REF_TABLE,
  type ComplianceApprovalSink,
  type ComplianceProposal,
} from './types';

export interface PrismaComplianceApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaComplianceApprovalSink implements ComplianceApprovalSink {
  readonly name = 'prisma' as const;

  constructor(
    private readonly options: PrismaComplianceApprovalSinkOptions = {},
  ) {}

  async record(args: {
    workspaceId: string;
    proposal: ComplianceProposal;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildComplianceApprovalRow(args.workspaceId, args.proposal);
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
        `PrismaComplianceApprovalSink failed: ${message}`,
      );
    }
  }
}

export function buildComplianceApprovalRow(
  workspaceId: string,
  proposal: ComplianceProposal,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: COMPLIANCE_AGENT_SLUG,
    kind: 'COMPLIANCE_DIGEST',
    refTable: COMPLIANCE_REF_TABLE,
    refId: proposal.forDate,
    status: 'PENDING',
    discipline: 'legal',
    payload: encryptPayloadForWrite({
      proposalId: proposal.proposalId,
      forDate: proposal.forDate,
      body: proposal.body,
      matches: proposal.matches,
      approvalsScanned: proposal.snapshot.approvalsScanned,
      verticalSlug: proposal.snapshot.verticalSlug,
      noOutbound:
        'No outbound. Compliance digest drafted into /approvals for operator review.',
    }),
  };
}
