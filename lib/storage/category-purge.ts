/**
 * lib/storage/category-purge.ts
 *
 * Per-category "one-tap delete" for the customer storage surface. Unlike the
 * full workspace teardown (`lib/customer-files/deletion.ts`), this lets the
 * owner clear ONE category at a time without closing the workspace.
 *
 * Conservative by design — each category deletes only what's safe to remove
 * while the workspace stays live:
 *   • conversations  — all chat threads (+messages) + workspace-scoped Plaino
 *                      conversations.
 *   • preferences-memory — learned memory, preference signals, draft
 *                      corrections, and the learned-notes list (explicit
 *                      settings like tone/schedule are kept — the customer
 *                      set those deliberately).
 *   • approvals      — DECIDED work items + handoff/skill-run history. PENDING
 *                      approvals and the AuditLog are kept (live work + the
 *                      proof trail must survive).
 *   • support        — RESOLVED tickets/requests (+ their messages). Open
 *                      issues are kept so the service team keeps context.
 *   • knowledge      — all CUSTOMER-kind ingested documents + embeddings.
 *
 * The "necessary" categories (auth-workspace, billing) are NOT purgeable here
 * — disconnecting a connector or closing the workspace is their path.
 *
 * Runs under `withSystemContext` (like teardown) AFTER the caller has proven
 * BROKER_OWNER membership; every delete is scoped by `workspaceId`.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext, SYSTEM_OPERATOR_CONTEXT } from '../db/rls';
import { getKnowledgeStore } from '../knowledge';
import type { IKnowledgeStore } from '../knowledge/types';

export type PurgeableCategory =
  | 'conversations'
  | 'preferences-memory'
  | 'approvals'
  | 'support'
  | 'knowledge';

export const PURGEABLE_CATEGORIES: readonly PurgeableCategory[] = [
  'conversations',
  'preferences-memory',
  'approvals',
  'support',
  'knowledge',
];

export function isPurgeableCategory(id: string): id is PurgeableCategory {
  return (PURGEABLE_CATEGORIES as readonly string[]).includes(id);
}

export interface PurgeCategoryResult {
  category: PurgeableCategory;
  deleted: Record<string, number>;
}

export interface PurgeCategoryArgs {
  workspaceId: string;
  category: PurgeableCategory;
  /** Knowledge store override (tests). */
  store?: IKnowledgeStore;
  /** Prisma tx override (tests). */
  client?: Prisma.TransactionClient;
}

export async function purgeCategory(
  args: PurgeCategoryArgs,
): Promise<PurgeCategoryResult> {
  if (!args.workspaceId) throw new Error('purgeCategory requires a workspaceId');
  const { workspaceId, category } = args;

  if (category === 'knowledge') {
    const store = args.store ?? getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);
    const res = await store.delete({ allWorkspaceCustomerDocs: { workspaceId } });
    return {
      category,
      deleted: { customerEmbeddings: res.ok ? res.value.deleted : 0 },
    };
  }

  const run = async (
    tx: Prisma.TransactionClient,
  ): Promise<Record<string, number>> => {
    switch (category) {
      case 'conversations': {
        const messages = (
          await tx.chatMessage.deleteMany({ where: { workspaceId } })
        ).count;
        const threads = (
          await tx.chatThread.deleteMany({ where: { workspaceId } })
        ).count;
        const plaino = (
          await tx.plainoConversation.deleteMany({ where: { workspaceId } })
        ).count;
        return { chatMessages: messages, chatThreads: threads, plainoConversations: plaino };
      }
      case 'preferences-memory': {
        const memory = (
          await tx.workspaceMemoryEntry.deleteMany({ where: { workspaceId } })
        ).count;
        const signals = (
          await tx.preferenceSignal.deleteMany({ where: { workspaceId } })
        ).count;
        const feedback = (
          await tx.preferenceFeedback.deleteMany({ where: { workspaceId } })
        ).count;
        // Reset learned notes but keep deliberate settings (tone, schedule).
        await tx.workspacePreference.updateMany({
          where: { workspaceId },
          data: { learnedDraftNotes: [] },
        });
        return {
          memoryEntries: memory,
          preferenceSignals: signals,
          preferenceFeedback: feedback,
        };
      }
      case 'approvals': {
        const approvals = (
          await tx.workApprovalQueueItem.deleteMany({
            where: { workspaceId, status: { not: 'PENDING' } },
          })
        ).count;
        const handoffs = (
          await tx.handoffLogEntry.deleteMany({ where: { workspaceId } })
        ).count;
        const skillRuns = (
          await tx.skillRun.deleteMany({ where: { workspaceId } })
        ).count;
        return {
          decidedApprovals: approvals,
          handoffs,
          skillRuns,
        };
      }
      case 'support': {
        // Resolved-only — keep open issues so the service team has context.
        const messages = (
          await tx.supportTicketMessage.deleteMany({
            where: { workspaceId, ticket: { status: { in: ['RESOLVED', 'CLOSED'] } } },
          })
        ).count;
        const tickets = (
          await tx.supportTicket.deleteMany({
            where: { workspaceId, status: { in: ['RESOLVED', 'CLOSED'] } },
          })
        ).count;
        const requests = (
          await tx.supportRequest.deleteMany({
            where: { workspaceId, resolvedAt: { not: null } },
          })
        ).count;
        return {
          supportTicketMessages: messages,
          supportTickets: tickets,
          supportRequests: requests,
        };
      }
      default: {
        // Exhaustiveness — unreachable, but keeps the switch honest.
        const _never: never = category;
        throw new Error(`purgeCategory: unsupported category ${String(_never)}`);
      }
    }
  };

  const deleted = args.client
    ? await run(args.client)
    : await withSystemContext(run);

  return { category, deleted };
}
