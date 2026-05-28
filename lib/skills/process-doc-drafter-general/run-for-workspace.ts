/**
 * lib/skills/process-doc-drafter-general/run-for-workspace.ts
 *
 * Production entry point for the process-doc drafter sweep. Wraps
 * `runSkill` with a `PrismaProcessDocApprovalSink` so each drafted SOP
 * lands in `WorkApprovalQueueItem` as PENDING.
 *
 * Per the audit: this file is the production caller. The weekly cron
 * sweep (`lib/inngest/functions/process-doc-drafter-sweep.ts`) invokes it.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless.
 */

import { ProcessDocMultiplexFetcher } from './multiplex-fetcher';
import { runSkill } from './skill';
import { PrismaProcessDocApprovalSink } from './prisma-approval-sink';
import type { SkillResult } from '../types';
import type {
  ProcessDocApprovalSink,
  ProcessDocFetcher,
  ProcessDocInput,
  ProcessDocOutput,
} from './types';

export interface RunProcessDocDrafterForWorkspaceInput
  extends Omit<ProcessDocInput, 'sink' | 'fetcher'> {
  fetcher?: ProcessDocFetcher;
  sink?: ProcessDocApprovalSink | null;
}

export async function runProcessDocDrafterForWorkspace(
  input: RunProcessDocDrafterForWorkspaceInput,
): Promise<SkillResult<ProcessDocOutput>> {
  const sink =
    input.sink === undefined
      ? new PrismaProcessDocApprovalSink()
      : input.sink;
  const fetcher =
    input.fetcher ??
    new ProcessDocMultiplexFetcher({ workspaceId: input.workspaceId });
  return runSkill({ ...input, fetcher, sink: sink ?? undefined });
}
