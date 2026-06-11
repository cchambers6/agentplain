/**
 * lib/skills/month-end-close-cpa/prisma-approval-persister.ts
 *
 * Production `DraftPersister` for the CPA month-end-close skill. The skill
 * itself speaks the `DraftPersister` port (it persists chase emails + a
 * client status update); pfd-8 binds THIS implementation so each draft
 * lands as a `WorkApprovalQueueItem` row the CPA firm reviews in /approvals
 * — closing the audit's silent-gating gap (the skill was module-complete
 * but had no production caller, so a paying CPA workspace never saw a row).
 *
 * Why FOLLOW_UP_NUDGE (no new approval kind, per the wave constraint)?
 *   - A month-end doc-chase IS a follow-up nudge for a missing document —
 *     semantically the same shape as the invoice-chase and follow-up-chaser
 *     skills, which already use this kind.
 *   - It is on the bounded-execute allowlist, so the close-prep chase can
 *     ride the same "wake up to it done" path when Conner enables it.
 *   - The client status update rides the same kind but is tagged in the
 *     payload so the approvals UI can label it distinctly.
 *
 * Per `project_no_outbound_architecture.md`: RECORDS ONLY. The CSM sends
 * from their own system after review. Nothing here calls messages.send.
 *
 * Per `feedback_runner_portability.md` two-implementation rule: this is the
 * Prisma/production impl; the skill already ships `JsonCloseFetcher` + the
 * in-skill `DraftPersister` test doubles (lib/skills/draft.ts patterns).
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless — each persistDraft
 * opens its own RLS-scoped transaction.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRls } from '../../db/rls';
import { SKILL_DISCIPLINE } from '@/lib/disciplines/skill-mapping';
import { encryptPayloadForWrite } from '../../security/payload-crypto';
import { skillError, skillOk, type DraftPersister, type SkillResult } from '../types';

export const MONTH_END_CLOSE_CPA_AGENT_SLUG = 'month-end-close-cpa';
export const MONTH_END_CLOSE_CPA_REF_TABLE = 'MonthEndCloseCpaDraft';

export interface PrismaCloseApprovalPersisterOptions {
  client?: PrismaClient;
  /** Bypass the RLS wrapper and write directly — used by tests that inject
   *  a stub `tx.workApprovalQueueItem.create`. */
  tx?: Prisma.TransactionClient;
}

/**
 * Writes each CPA close draft as a WorkApprovalQueueItem. The `threadId`
 * the skill passes (`close-<clientId>-<period>-{chase,status}`) is the
 * stable `refId` so re-runs overwrite-in-place semantics are achievable by
 * the operator surface and the audit row is traceable to the engagement.
 */
export class PrismaCloseApprovalPersister implements DraftPersister {
  readonly name = 'prisma-cpa-close' as const;

  constructor(
    private readonly options: PrismaCloseApprovalPersisterOptions = {},
  ) {}

  async persistDraft(args: {
    workspaceId: string;
    threadId: string;
    inReplyToMessageId: string | null;
    toEmails: string[];
    subject: string;
    body: string;
  }): Promise<SkillResult<{ providerDraftId: string }>> {
    const row = buildCloseApprovalRow(args);
    try {
      if (this.options.tx) {
        const created = await this.options.tx.workApprovalQueueItem.create({
          data: row,
          select: { id: true },
        });
        return skillOk({ providerDraftId: created.id });
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
      return skillOk({ providerDraftId: id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError(
        'UNKNOWN',
        `PrismaCloseApprovalPersister failed for thread ${args.threadId}: ${message}`,
      );
    }
  }
}

/**
 * Map a CPA close draft to a WorkApprovalQueueItem row. Exposed for tests
 * that assert the row shape without a DB.
 */
export function buildCloseApprovalRow(args: {
  workspaceId: string;
  threadId: string;
  toEmails: string[];
  subject: string;
  body: string;
}): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  const isStatus = args.threadId.endsWith('-status');
  return {
    workspaceId: args.workspaceId,
    agentSlug: MONTH_END_CLOSE_CPA_AGENT_SLUG,
    kind: 'FOLLOW_UP_NUDGE',
    refTable: MONTH_END_CLOSE_CPA_REF_TABLE,
    refId: args.threadId,
    status: 'PENDING',
    discipline: SKILL_DISCIPLINE[MONTH_END_CLOSE_CPA_AGENT_SLUG] ?? 'finance',
    payload: encryptPayloadForWrite({
      threadId: args.threadId,
      draftKind: isStatus ? 'client-status-update' : 'document-chase',
      toEmails: args.toEmails,
      subject: args.subject,
      body: args.body,
      noOutbound:
        'No close email sent. The CSM reviews the draft in /approvals, fills the ' +
        '{{operator: ...}} merge fields, and sends from their own system. Per ' +
        'project_no_outbound_architecture.md.',
    }),
  };
}
