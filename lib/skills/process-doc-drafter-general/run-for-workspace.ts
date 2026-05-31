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
import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db';
import { PrismaMemoryStore } from '@/lib/plaino/memory';
import { getLlmProvider } from '@/lib/llm';
import { buildFeedbackRulesBlock } from '../feedback-rules';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import type { LlmProvider } from '@/lib/llm/types';
import type { SkillResult } from '../types';
import type {
  ProcessDocApprovalSink,
  ProcessDocFetcher,
  ProcessDocInput,
  ProcessDocOutput,
} from './types';

export interface RunProcessDocDrafterForWorkspaceInput
  extends Omit<
    ProcessDocInput,
    'sink' | 'fetcher' | 'llm' | 'feedbackRulesBlock'
  > {
  fetcher?: ProcessDocFetcher;
  sink?: ProcessDocApprovalSink | null;
  /** Wave-4 — override the memory store. Defaults to PrismaMemoryStore;
   *  pass null to skip FEEDBACK-rule reads + LLM refinement. */
  memory?: IMemoryStore | null;
  /** Wave-4 — override the LLM provider. Defaults to getLlmProvider();
   *  pass null to skip LLM refinement entirely (heuristic-only). */
  llm?: LlmProvider | null;
}

const PROCESS_DOC_SCOPES = ['content'] as const;

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

  // Wave-4 — read FEEDBACK rules under the content scope.
  const memory =
    input.memory === undefined
      ? new PrismaMemoryStore(input.workspaceId, {
          ctx: SYSTEM_OPERATOR_CONTEXT,
        })
      : input.memory;
  let feedbackRulesBlock = '';
  if (memory) {
    try {
      feedbackRulesBlock = await buildFeedbackRulesBlock({
        memory,
        workspaceId: input.workspaceId,
        scopes: PROCESS_DOC_SCOPES,
      });
    } catch (err) {
      console.warn(
        `process-doc-drafter: failed to read FEEDBACK rules — continuing heuristic-only. ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
  const llmForRefine =
    input.llm === undefined
      ? memory && feedbackRulesBlock.length > 0
        ? getLlmProvider()
        : null
      : input.llm;

  return runSkill({
    ...input,
    fetcher,
    sink: sink ?? undefined,
    llm: llmForRefine ?? undefined,
    feedbackRulesBlock,
  });
}
