// Wave-2 briefings generator — per-workspace activity snapshot.
//
// Reads the last 24h of workspace activity into a narrow, redacted
// shape the LLM composes the briefing from. The shape is intentionally
// small: counts + the top 5 approval kinds + open thread titles. We
// never feed the LLM raw draft text — that would echo customer-facing
// content into a different surface and bloat the prompt.
//
// Per `feedback_cold_start_safe_agents.md`: every read is durable.
// Per `project_no_outbound_architecture.md`: this is a READ-ONLY helper.
// Per `feedback_runner_portability.md`: caller injects the tx runner so
// the generator unit tests don't need Postgres.

import type { DbTransactionClient } from '@/lib/db';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import type {
  BriefingActivitySnapshot,
  BriefingSummary,
} from './types';

export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

export interface BuildActivitySnapshotInput {
  workspaceId: string;
  /** Newest-end of the briefing window — defaults to "now". */
  now?: Date;
  /** Window length in hours. Default 24 — matches the daily cadence. */
  windowHours?: number;
  /** Override for tests; live caller uses `withSystemContext`. */
  systemContext?: SystemContextRunner;
}

export async function buildActivitySnapshot(
  input: BuildActivitySnapshotInput,
): Promise<BriefingActivitySnapshot> {
  const now = input.now ?? new Date();
  const windowHours = input.windowHours ?? 24;
  const windowFrom = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const systemContext = input.systemContext ?? defaultWithSystemContext;

  return systemContext(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      throw new Error(
        `buildActivitySnapshot: workspace ${input.workspaceId} not found`,
      );
    }

    // Approvals — every row whose proposedAt OR decidedAt falls in the
    // window. We slice the count by status afterwards.
    const approvals = await tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { proposedAt: { gte: windowFrom } },
          { decidedAt: { gte: windowFrom } },
        ],
      },
      select: {
        kind: true,
        status: true,
        payload: true,
        proposedAt: true,
      },
      orderBy: { proposedAt: 'desc' },
    });

    const pendingApprovals = approvals.filter((a) => a.status === 'PENDING').length;
    const decidedInWindow = approvals.filter(
      (a) =>
        a.status === 'APPROVED' ||
        a.status === 'REJECTED' ||
        a.status === 'AUTO_APPROVED',
    ).length;

    // Top approval-kind buckets (up to 5).
    const kindCounts = new Map<string, number>();
    for (const a of approvals) {
      kindCounts.set(a.kind, (kindCounts.get(a.kind) ?? 0) + 1);
    }
    const topApprovalKinds = [...kindCounts.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Pending-highlight titles. Pull from the payload's `title`/`subject`
    // field if the kind has one; fall back to the kind name. Cap at 5.
    const pendingHighlights: BriefingActivitySnapshot['pendingHighlights'] = approvals
      .filter((a) => a.status === 'PENDING')
      .slice(0, 5)
      .map((a) => ({
        kind: a.kind,
        title: extractApprovalTitle(a.payload, a.kind),
      }));

    const newChatThreads = await tx.chatThread.count({
      where: {
        workspaceId: input.workspaceId,
        createdAt: { gte: windowFrom },
      },
    });

    const newInstructions = await tx.workApprovalQueueItem.count({
      where: {
        workspaceId: input.workspaceId,
        kind: 'PLAINO_INSTRUCTION',
        proposedAt: { gte: windowFrom },
      },
    });

    // Learned-from-corrections notes counted via the append-only
    // PreferenceSignal log — `source` IN (DRAFT_EDIT, DRAFT_REJECT).
    const newLearnedNotes = await tx.preferenceSignal.count({
      where: {
        workspaceId: input.workspaceId,
        capturedAt: { gte: windowFrom },
        source: { in: ['DRAFT_EDIT', 'DRAFT_REJECT'] },
      },
    });

    const summary: BriefingSummary = {
      approvalsInWindow: approvals.length,
      pendingApprovals,
      decidedInWindow,
      newChatThreads,
      newInstructions,
      newLearnedNotes,
      topApprovalKinds,
    };

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      windowFrom: windowFrom.toISOString(),
      windowTo: now.toISOString(),
      summary,
      pendingHighlights,
    };
  });
}

/**
 * Best-effort title from a WorkApprovalQueueItem.payload. The shape
 * varies by kind; we look at the common fields (`title`, `subject`,
 * `summary`) and fall back to the kind name. Limited to 80 chars so the
 * briefing prompt stays small.
 */
function extractApprovalTitle(payload: unknown, kind: string): string {
  if (!payload || typeof payload !== 'object') return kindLabel(kind);
  const p = payload as Record<string, unknown>;
  const fields = ['title', 'subject', 'summary', 'name'] as const;
  for (const f of fields) {
    const v = p[f];
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim().slice(0, 80);
    }
  }
  return kindLabel(kind);
}

function kindLabel(kind: string): string {
  return kind.toLowerCase().replace(/_/g, ' ');
}
