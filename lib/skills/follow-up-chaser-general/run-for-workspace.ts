/**
 * lib/skills/follow-up-chaser-general/run-for-workspace.ts
 *
 * Production entry point for the follow-up-chaser sweep. Wraps
 * `runSkill` with a `PrismaFollowUpApprovalSink` bound to the workspace
 * so each nudge proposal lands in `WorkApprovalQueueItem` as PENDING
 * for the operator's `/approvals` page.
 *
 * Per the audit (`docs/agent-interviews/01-runtime-skills.md`):
 *   "No production caller." This file IS that caller; the hourly cron
 *   sweep (`lib/inngest/functions/follow-up-chaser-sweep.ts`) invokes it.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless — every call
 * constructs a fresh sink and reads inputs from the caller.
 */

import { FollowUpMultiplexFetcher } from './multiplex-fetcher';
import { runSkill } from './skill';
import { PrismaFollowUpApprovalSink } from './prisma-approval-sink';
import type { SkillResult } from '../types';
import type {
  FollowUpApprovalSink,
  FollowUpFetcher,
  FollowUpInput,
  FollowUpOutput,
} from './types';

export interface RunFollowUpChaserForWorkspaceInput
  extends Omit<FollowUpInput, 'sink' | 'fetcher'> {
  /** Override the fetcher — defaults to the multiplexer that resolves
   *  Google → M365 → NOT_CONFIGURED. Tests pass a
   *  `JsonFollowUpFetcher` seeded with deterministic fixtures. */
  fetcher?: FollowUpFetcher;
  /** Override the sink — defaults to `PrismaFollowUpApprovalSink`. */
  sink?: FollowUpApprovalSink | null;
}

export async function runFollowUpChaserForWorkspace(
  input: RunFollowUpChaserForWorkspaceInput,
): Promise<SkillResult<FollowUpOutput>> {
  const sink =
    input.sink === undefined ? new PrismaFollowUpApprovalSink() : input.sink;
  const fetcher =
    input.fetcher ??
    new FollowUpMultiplexFetcher({ workspaceId: input.workspaceId });
  return runSkill({ ...input, fetcher, sink: sink ?? undefined });
}
