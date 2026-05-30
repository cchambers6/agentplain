/**
 * Production entry point for the weekly content-calendar cron sweep.
 * Reads the workspace's vertical + trailing-week activity, runs the
 * skill, and persists via `PrismaCalendarApprovalSink`.
 */

import { SYSTEM_OPERATOR_CONTEXT, withSystemContext } from '@/lib/db';
import { PrismaMemoryStore } from '@/lib/plaino/memory';
import { verticalSlugFromEnum } from '@/lib/auth/vertical-enum';
import { buildFeedbackRulesBlock } from '../feedback-rules';
import type { LlmProvider } from '@/lib/llm/types';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import { PrismaCalendarApprovalSink } from './prisma-approval-sink';
import { runSkill } from './skill';
import type { SkillResult } from '../types';
import type {
  CalendarApprovalSink,
  CalendarSnapshot,
  CalendarSkillOutput,
} from './types';

const CALENDAR_FEEDBACK_SCOPES = [
  'content',
  'email-draft',
  'customer-comms',
] as const;

export interface RunCalendarDrafterForWorkspaceInput {
  workspaceId: string;
  sink?: CalendarApprovalSink | null;
  memory?: IMemoryStore | null;
  llm?: LlmProvider;
  now?: Date;
}

export async function runCalendarDrafterForWorkspace(
  input: RunCalendarDrafterForWorkspaceInput,
): Promise<SkillResult<CalendarSkillOutput>> {
  const sink =
    input.sink === undefined ? new PrismaCalendarApprovalSink() : input.sink;
  const memory =
    input.memory === undefined
      ? new PrismaMemoryStore(input.workspaceId, { ctx: SYSTEM_OPERATOR_CONTEXT })
      : input.memory;

  const now = input.now ?? new Date();
  const snapshot = await buildSnapshot(input.workspaceId, now);

  let feedbackRulesBlock = '';
  if (memory) {
    try {
      feedbackRulesBlock = await buildFeedbackRulesBlock({
        memory,
        workspaceId: input.workspaceId,
        scopes: CALENDAR_FEEDBACK_SCOPES,
      });
    } catch {
      // best-effort
    }
  }

  return runSkill({
    workspaceId: input.workspaceId,
    snapshot,
    sink: sink ?? undefined,
    feedbackRulesBlock,
    now,
    llm: input.llm,
  });
}

async function buildSnapshot(
  workspaceId: string,
  now: Date,
): Promise<CalendarSnapshot> {
  return withSystemContext(async (tx) => {
    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, vertical: true },
    });
    if (!workspace) {
      throw new Error(`content-calendar: workspace ${workspaceId} not found`);
    }
    const windowFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const approvalsCreated = await tx.workApprovalQueueItem.count({
      where: {
        workspaceId,
        proposedAt: { gte: windowFrom },
      },
    });
    const instructions = await tx.workApprovalQueueItem.count({
      where: {
        workspaceId,
        kind: 'PLAINO_INSTRUCTION',
        proposedAt: { gte: windowFrom },
      },
    });
    return {
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      verticalSlug: verticalSlugFromEnum(workspace.vertical),
      forWeekStarting: nextMondayIso(now),
      recentCounts: { approvalsCreated, instructions },
    };
  });
}

/** Returns the Monday of the upcoming week (in UTC), as ISO yyyy-MM-dd.
 *  When the cron fires on Monday, this is "today" — the calendar covers
 *  this week. */
function nextMondayIso(d: Date): string {
  const day = d.getUTCDay();
  const offset = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const monday = new Date(d.getTime() + offset * 24 * 60 * 60 * 1000);
  return monday.toISOString().slice(0, 10);
}
