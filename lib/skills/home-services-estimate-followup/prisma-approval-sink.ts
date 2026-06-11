/**
 * lib/skills/home-services-estimate-followup/prisma-approval-sink.ts
 *
 * Production `EstimateApprovalSink` — persists each `HomeownerNudgeDraft` as
 * one `WorkApprovalQueueItem` (kind=FOLLOW_UP_NUDGE, status=PENDING).
 *
 * Pattern: mirrors `lib/skills/follow-up-chaser-general/prisma-approval-sink.ts`
 * exactly. Same no-outbound contract, same RLS pattern, same cold-start safety.
 *
 * Value-impact payload: `estimateAmountUsd` is embedded in the encrypted payload
 * so the operator console can display "you have $X,XXX in unanswered quotes"
 * and the value ledger can surface revenue influenced per nudge. When the owner
 * approves a FOLLOW_UP_NUDGE item, the standard `computeWorkspaceValueLedger`
 * credits the labor hours saved (5 min × $45/hr = $3.75 per item). The
 * `estimateAmountUsd` supplements that with the at-risk pipeline $ so the
 * operator understands the real revenue stake.
 *
 * No schema change: `estimateAmountUsd` lives inside the encrypted `payload`
 * JSON blob — zero new columns or migrations.
 *
 * Per `project_no_outbound_architecture.md`: RECORDS ONLY.
 * Per `feedback_cold_start_safe_agents.md`: stateless — every call constructs
 * fresh Prisma context via `withRls`.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type { EstimateApprovalSink, EstimateNudgeApproval, HomeownerNudgeDraft } from './types';

export const HOME_SERVICES_ESTIMATE_FOLLOWUP_AGENT_SLUG = 'home-services-estimate-followup';
export const ESTIMATE_FOLLOWUP_REF_TABLE = 'EstimateFollowupNudge';

export interface PrismaEstimateApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaEstimateApprovalSink implements EstimateApprovalSink {
  readonly name = 'prisma' as const;

  constructor(private readonly options: PrismaEstimateApprovalSinkOptions = {}) {}

  async record(args: {
    workspaceId: string;
    approval: EstimateNudgeApproval;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildEstimateApprovalRow(args.workspaceId, args.approval.draft);
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
        `PrismaEstimateApprovalSink failed to persist draft ${args.approval.draft.draftId}: ${message}`,
      );
    }
  }
}

export function buildEstimateApprovalRow(
  workspaceId: string,
  draft: HomeownerNudgeDraft,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: HOME_SERVICES_ESTIMATE_FOLLOWUP_AGENT_SLUG,
    kind: 'FOLLOW_UP_NUDGE',
    refTable: ESTIMATE_FOLLOWUP_REF_TABLE,
    refId: draft.draftId,
    status: 'PENDING',
    discipline:
      SKILL_DISCIPLINE[HOME_SERVICES_ESTIMATE_FOLLOWUP_AGENT_SLUG] ?? null,
    payload: encryptPayloadForWrite({
      draftId: draft.draftId,
      estimateId: draft.estimateId,
      /** Dollar value of the estimate at the time the nudge was drafted.
       *  This is the revenue at stake — a $6,000 unanswered quote means a
       *  $6,000 loss if the homeowner goes to a competitor. The operator
       *  console surfaces this so the business owner understands the stakes
       *  before deciding whether to approve/skip the nudge. */
      estimateAmountUsd: draft.estimateAmountUsd,
      stage: draft.stage,
      toEmails: draft.toEmails,
      subject: draft.subject,
      body: draft.body,
      confidence: draft.confidence,
      noOutbound:
        'No nudge sent. Operator approves and the customer\'s own mailbox performs the send.',
    }),
  };
}
