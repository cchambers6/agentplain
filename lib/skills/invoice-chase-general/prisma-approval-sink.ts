/**
 * lib/skills/invoice-chase-general/prisma-approval-sink.ts
 *
 * Production `InvoiceChaseApprovalSink` — persists each
 * `InvoiceChaseDraft` as one `WorkApprovalQueueItem` (kind=FOLLOW_UP_NUDGE,
 * status=PENDING) with the invoice balance embedded in the payload for
 * ROI tracking in the value ledger.
 *
 * Why FOLLOW_UP_NUDGE?
 *   - Already on the bounded-execute ALLOWLIST in lib/skills/bounded-execute.ts.
 *   - When the master switch flips ON, these auto-approve without owner
 *     friction — which is the exact "wake up to chased invoices" outcome.
 *   - The kind is semantically correct: this IS a follow-up nudge for a
 *     stalled payment.
 *
 * Value-impact hook: the approval payload carries `balanceUsd` — the AR
 * dollars being chased. When the operator approves (status → APPROVED /
 * AUTO_APPROVED), the value ledger's `dollarsInfluenced` reflects the
 * actual invoice balance, not just the generic FOLLOW_UP_NUDGE
 * labor-time estimate. This is the provable ROI for the "wake up to
 * chased invoices" owner outcome.
 *
 * Per `project_no_outbound_architecture.md`: RECORDS ONLY. No mail send.
 *
 * RLS + cold-start safety: identical pattern to PrismaFollowUpApprovalSink
 * in lib/skills/follow-up-chaser-general.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type SkillResult } from '../types';
import type { InvoiceChaseApprovalSink, InvoiceChaseDraft } from './types';

export const INVOICE_CHASE_GENERAL_AGENT_SLUG = 'invoice-chase-general';
export const INVOICE_CHASE_GENERAL_REF_TABLE = 'InvoiceChaseGeneralDraft';

export interface PrismaInvoiceChaseApprovalSinkOptions {
  client?: PrismaClient;
  tx?: Prisma.TransactionClient;
}

export class PrismaInvoiceChaseApprovalSink
  implements InvoiceChaseApprovalSink
{
  readonly name = 'prisma' as const;

  constructor(
    private readonly options: PrismaInvoiceChaseApprovalSinkOptions = {},
  ) {}

  async record(args: {
    workspaceId: string;
    draft: InvoiceChaseDraft;
  }): Promise<SkillResult<{ sinkId: string }>> {
    const row = buildApprovalRow(args.workspaceId, args.draft);
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
        `PrismaInvoiceChaseApprovalSink failed to persist draft ${args.draft.draftId}: ${message}`,
      );
    }
  }
}

export function buildApprovalRow(
  workspaceId: string,
  draft: InvoiceChaseDraft,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  return {
    workspaceId,
    agentSlug: INVOICE_CHASE_GENERAL_AGENT_SLUG,
    kind: 'FOLLOW_UP_NUDGE',
    refTable: INVOICE_CHASE_GENERAL_REF_TABLE,
    refId: draft.draftId,
    status: 'PENDING',
    discipline:
      SKILL_DISCIPLINE[INVOICE_CHASE_GENERAL_AGENT_SLUG] ?? null,
    payload: encryptPayloadForWrite({
      draftId: draft.draftId,
      invoiceId: draft.invoiceId,
      docNumber: draft.docNumber,
      customerName: draft.customerName,
      customerEmail: draft.customerEmail,
      // Value-impact field: the AR balance being chased.
      // When this item is APPROVED / AUTO_APPROVED, the operator can
      // point to this figure as the AR dollars Plaino influenced.
      balanceUsd: draft.balanceUsd,
      daysOverdue: draft.daysOverdue,
      tier: draft.tier,
      subject: draft.subject,
      body: draft.body,
      confidence: draft.confidence,
      reasoning: draft.reasoning,
      noOutbound:
        'No invoice chase email sent. Operator approves and their own ' +
        'email client performs the send. Per project_no_outbound_architecture.md.',
    }),
  };
}
