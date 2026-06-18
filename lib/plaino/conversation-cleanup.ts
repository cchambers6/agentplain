/**
 * lib/plaino/conversation-cleanup.ts
 *
 * The sweep behind the chat-retention commitment. For each active workspace
 * it resolves the effective retention window (tier ceiling + customer
 * opt-in + per-thread override — see `chat-retention.ts`) and deletes chat
 * threads whose last activity has aged past it. Deleting a `ChatThread`
 * cascades its `ChatMessage` rows (FK `onDelete: Cascade`); memory entries
 * Plaino extracted survive (their source-message FK is `SetNull`).
 *
 * Per `feedback_cold_start_safe_agents`: holds no in-memory state — every
 * run re-reads the windows from the DB. Per `feedback_runner_portability`:
 * the candidate lister + per-workspace cleaner are injectable for tests.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext } from '../db/rls';
import { getLogger } from '../observability';
import { isThreadExpired, resolveChatRetentionDays } from './chat-retention';

export interface ConversationCleanupResult {
  workspacesConsidered: number;
  threadsDeleted: number;
  messagesDeleted: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface WorkspaceCleanupResult {
  threadsDeleted: number;
  messagesDeleted: number;
}

export interface RunConversationCleanupArgs {
  now?: Date;
  /** Override the workspace lister (tests). */
  listCandidates?: () => Promise<string[]>;
  /** Override the per-workspace cleaner (tests). */
  cleanupWorkspace?: (
    workspaceId: string,
    now: Date,
  ) => Promise<WorkspaceCleanupResult>;
}

export async function runConversationCleanup(
  args: RunConversationCleanupArgs = {},
): Promise<ConversationCleanupResult> {
  const now = args.now ?? new Date();
  const listCandidates = args.listCandidates ?? defaultListCandidates;
  const cleanup = args.cleanupWorkspace ?? cleanupWorkspaceConversations;

  const candidates = await listCandidates();
  const result: ConversationCleanupResult = {
    workspacesConsidered: candidates.length,
    threadsDeleted: 0,
    messagesDeleted: 0,
    failures: [],
  };

  for (const workspaceId of candidates) {
    try {
      const r = await cleanup(workspaceId, now);
      result.threadsDeleted += r.threadsDeleted;
      result.messagesDeleted += r.messagesDeleted;
    } catch (err) {
      result.failures.push({
        workspaceId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

async function defaultListCandidates(): Promise<string[]> {
  return withSystemContext(async (tx) => {
    const rows = await tx.chatThread.findMany({
      distinct: ['workspaceId'],
      select: { workspaceId: true },
    });
    return rows.map((r) => r.workspaceId);
  });
}

/**
 * Delete every expired thread for one workspace. Resolves the workspace-wide
 * window (subscription tier + opt-in), then evaluates each thread (honoring a
 * per-thread `retentionDays` override) and deletes the expired set in one
 * pass.
 */
export async function cleanupWorkspaceConversations(
  workspaceId: string,
  now: Date,
  opts: { client?: Prisma.TransactionClient } = {},
): Promise<WorkspaceCleanupResult> {
  const run = async (tx: Prisma.TransactionClient): Promise<WorkspaceCleanupResult> => {
    const subscription = await tx.subscription.findUnique({
      where: { workspaceId },
      select: { tier: true },
    });
    const preference = await tx.workspacePreference.findUnique({
      where: { workspaceId },
      select: { chatRetentionDays: true },
    });

    const threads = await tx.chatThread.findMany({
      where: { workspaceId },
      select: { id: true, updatedAt: true, retentionDays: true },
    });

    const expiredIds: string[] = [];
    for (const t of threads) {
      const effectiveRetentionDays = resolveChatRetentionDays({
        tier: subscription?.tier ?? null,
        workspaceOverrideDays: preference?.chatRetentionDays ?? null,
        threadOverrideDays: t.retentionDays ?? null,
      });
      if (isThreadExpired({ updatedAt: t.updatedAt, effectiveRetentionDays, now })) {
        expiredIds.push(t.id);
      }
    }

    if (expiredIds.length === 0) {
      return { threadsDeleted: 0, messagesDeleted: 0 };
    }

    // Count messages first (cascade deletes them with the thread) for an
    // accurate audit number, then delete the threads.
    const messagesDeleted = await tx.chatMessage.count({
      where: { threadId: { in: expiredIds } },
    });
    const del = await tx.chatThread.deleteMany({
      where: { id: { in: expiredIds }, workspaceId },
    });

    return { threadsDeleted: del.count, messagesDeleted };
  };

  if (opts.client) return run(opts.client);
  return withSystemContext(run);
}

export function logConversationCleanup(result: ConversationCleanupResult): void {
  getLogger().info('conversation-cleanup sweep finished', {
    boundary: 'inngest',
    considered: result.workspacesConsidered,
    threads_deleted: result.threadsDeleted,
    messages_deleted: result.messagesDeleted,
    failed: result.failures.length,
  });
}
