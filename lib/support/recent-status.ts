/**
 * lib/support/recent-status.ts
 *
 * Query the most recent SupportRequest a member submitted in their
 * workspace + report whether the support-handler skill has produced
 * a draft for it yet. Drives the honest /help status surfacing —
 * we say "we've drafted a first response — a human is reviewing it
 * now" only when a draft actually landed in the queue. Otherwise we
 * say "submitted; under review by a human." No invented timelines.
 *
 * Per project_no_outbound_architecture.md: this is a READ ONLY helper.
 * Nothing here sends, drafts, or executes. It reports state.
 *
 * Per memory rule project_no_guesses_no_estimates: every claim cites
 * an artifact — here, a row in SupportRequest + (optionally) a row in
 * WorkApprovalQueueItem joined on refTable=SupportRequest, refId=
 * <supportRequestId>.
 */

import type { PrismaClient } from '@prisma/client';
import { withRls, type RlsContext } from '../db/rls';

export type SupportRecentStatusState =
  | 'none'
  | 'submitted'
  | 'drafted-under-review';

export interface SupportRecentStatus {
  state: SupportRecentStatusState;
  supportRequestId: string | null;
  subject: string | null;
  submittedAt: Date | null;
  draftedAt: Date | null;
}

const SUPPORT_HANDLER_REF_TABLE = 'SupportRequest';
const SUPPORT_HANDLER_KIND = 'SUPPORT_HANDLER_REPLY_DRAFT';

/**
 * Return the recent-status snapshot for the workspace member. The query
 * reads the most recent SupportRequest the user submitted; if a
 * WorkApprovalQueueItem (kind=SUPPORT_HANDLER_REPLY_DRAFT, refTable=
 * SupportRequest, refId=<id>) exists, state is 'drafted-under-review'.
 * Otherwise it's 'submitted'. No row at all → 'none'.
 *
 * Bounded window: only requests submitted within the lookback (default
 * 48h) count toward the status banner. Older requests assume the
 * operator has already responded via email.
 */
export async function getSupportRecentStatus(args: {
  ctx: RlsContext;
  workspaceId: string;
  fromUserId: string;
  lookbackHours?: number;
  now?: Date;
  /** Test override — inject a Prisma-shaped client so unit tests can pin
   *  the query without a live DB. Production callers leave this unset
   *  to use the prisma singleton. */
  client?: PrismaClient;
}): Promise<SupportRecentStatus> {
  const now = args.now ?? new Date();
  const windowHours = args.lookbackHours ?? 48;
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  return withRls(
    args.ctx,
    async (tx) => {
    const recent = await tx.supportRequest.findFirst({
      where: {
        workspaceId: args.workspaceId,
        fromUserId: args.fromUserId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, subject: true, createdAt: true },
    });
    if (!recent) {
      return {
        state: 'none' as const,
        supportRequestId: null,
        subject: null,
        submittedAt: null,
        draftedAt: null,
      };
    }
    const draft = await tx.workApprovalQueueItem.findFirst({
      where: {
        workspaceId: args.workspaceId,
        refTable: SUPPORT_HANDLER_REF_TABLE,
        refId: recent.id,
        kind: SUPPORT_HANDLER_KIND,
      },
      orderBy: { proposedAt: 'desc' },
      select: { proposedAt: true },
    });
    return {
      state: draft
        ? ('drafted-under-review' as const)
        : ('submitted' as const),
      supportRequestId: recent.id,
      subject: recent.subject,
      submittedAt: recent.createdAt,
      draftedAt: draft?.proposedAt ?? null,
    };
    },
    args.client ? { client: args.client } : undefined,
  );
}
