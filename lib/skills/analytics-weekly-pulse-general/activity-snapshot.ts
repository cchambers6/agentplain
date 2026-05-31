/**
 * lib/skills/analytics-weekly-pulse-general/activity-snapshot.ts
 *
 * Reads the trailing 7-day window of workspace activity into a narrow,
 * redacted shape the LLM grounds the pulse on. Mirrors the briefings-
 * generator snapshot pattern but rolls up over a 7-day window instead
 * of 24 hours and adds the "installed but not firing" surface so the
 * pulse can name underused skills.
 *
 * Per `feedback_cold_start_safe_agents.md`: every read is durable. The
 * caller (cron) re-reads on every fire.
 * Per `project_no_outbound_architecture.md`: read-only.
 * Per `feedback_runner_portability.md`: the system-context runner +
 * marketplace reader are injectable for tests.
 */

import type { DbTransactionClient } from '@/lib/db';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import { resolveInstallationStatus } from '@/lib/skills/marketplace';
import type { Vertical } from '@prisma/client';
import type { PulseActivitySnapshot } from './types';

export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

export interface BuildPulseSnapshotInput {
  workspaceId: string;
  /** Newest end of the pulse window. Defaults to "now". */
  now?: Date;
  /** Window in days. Default 7 — matches weekly cadence. */
  windowDays?: number;
  /** Override the system-context runner for tests. */
  systemContext?: SystemContextRunner;
  /** Override the installed-skill lister for tests. Defaults to the
   *  live marketplace reader. */
  listInstalledSkills?: (args: {
    workspaceId: string;
    workspaceVertical: Vertical;
  }) => Promise<string[]>;
}

export async function buildPulseSnapshot(
  input: BuildPulseSnapshotInput,
): Promise<PulseActivitySnapshot> {
  const now = input.now ?? new Date();
  const windowDays = input.windowDays ?? 7;
  const windowFrom = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const systemContext = input.systemContext ?? defaultWithSystemContext;

  return systemContext(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      select: { id: true, name: true, vertical: true },
    });
    if (!workspace) {
      throw new Error(
        `analytics-weekly-pulse: workspace ${input.workspaceId} not found`,
      );
    }

    // Approvals — every row whose proposedAt OR decidedAt falls in window.
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
        agentSlug: true,
        status: true,
        proposedAt: true,
        decidedAt: true,
      },
    });

    const approvalsCreated = approvals.filter(
      (a) => a.proposedAt >= windowFrom,
    ).length;
    const approvalsApproved = approvals.filter(
      (a) =>
        (a.status === 'APPROVED' || a.status === 'AUTO_APPROVED') &&
        a.decidedAt &&
        a.decidedAt >= windowFrom,
    ).length;
    const approvalsRejected = approvals.filter(
      (a) => a.status === 'REJECTED' && a.decidedAt && a.decidedAt >= windowFrom,
    ).length;
    const approvalsPending = approvals.filter((a) => a.status === 'PENDING')
      .length;

    // Throughput by approval kind. The pulse names a skill by its kind
    // ("inbox-triage ran 12 times, all approved") so the customer can
    // see exactly which fleet members carried weight.
    const byKind = new Map<
      string,
      { proposed: number; approved: number; rejected: number }
    >();
    for (const a of approvals) {
      const bucket = byKind.get(a.kind) ?? {
        proposed: 0,
        approved: 0,
        rejected: 0,
      };
      if (a.proposedAt >= windowFrom) bucket.proposed += 1;
      if (
        (a.status === 'APPROVED' || a.status === 'AUTO_APPROVED') &&
        a.decidedAt &&
        a.decidedAt >= windowFrom
      ) {
        bucket.approved += 1;
      }
      if (
        a.status === 'REJECTED' &&
        a.decidedAt &&
        a.decidedAt >= windowFrom
      ) {
        bucket.rejected += 1;
      }
      byKind.set(a.kind, bucket);
    }
    const topKindsByThroughput = [...byKind.entries()]
      .map(([kind, counts]) => ({ kind, ...counts }))
      .sort((a, b) => b.proposed - a.proposed)
      .slice(0, 6);

    // Skills that are installed-for-workspace but produced ZERO rows
    // in window — these are the "underused" candidates the pulse calls
    // out. Default reader is the live marketplace; tests inject.
    const installedList =
      input.listInstalledSkills?.({
        workspaceId: input.workspaceId,
        workspaceVertical: workspace.vertical,
      }) ??
      resolveInstallationStatus({
        workspaceId: input.workspaceId,
        workspaceVertical: workspace.vertical,
      }).then((rows) =>
        rows.filter((r) => r.installed && r.runtime === 'live').map((r) => r.slug),
      );
    const installedSlugs = await installedList;
    const firingSlugs = new Set(
      approvals
        .filter((a) => a.proposedAt >= windowFrom)
        .map((a) => a.agentSlug),
    );
    const installedSkillsNotFiring = installedSlugs.filter(
      (slug) => !firingSlugs.has(slug),
    );

    const chatThreads = await tx.chatThread.count({
      where: {
        workspaceId: input.workspaceId,
        createdAt: { gte: windowFrom },
      },
    });

    const instructions = await tx.workApprovalQueueItem.count({
      where: {
        workspaceId: input.workspaceId,
        kind: 'PLAINO_INSTRUCTION',
        proposedAt: { gte: windowFrom },
      },
    });

    const learnedNotes = await tx.preferenceSignal.count({
      where: {
        workspaceId: input.workspaceId,
        source: { in: ['DRAFT_EDIT', 'DRAFT_REJECT'] },
        capturedAt: { gte: windowFrom },
      },
    });

    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      windowFrom: windowFrom.toISOString(),
      windowTo: now.toISOString(),
      counts: {
        approvalsCreated,
        approvalsApproved,
        approvalsRejected,
        approvalsPending,
        chatThreads,
        instructions,
        learnedNotes,
      },
      topKindsByThroughput,
      installedSkillsNotFiring,
    };
  });
}
