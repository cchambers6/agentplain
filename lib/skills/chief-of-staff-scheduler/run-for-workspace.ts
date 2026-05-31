/**
 * lib/skills/chief-of-staff-scheduler/run-for-workspace.ts
 *
 * Production entry point for the chief-of-staff scheduler. Wraps
 * `runSkill` with a `PrismaApprovalSink` bound to the workspace so each
 * proposal lands in `WorkApprovalQueueItem` as PENDING for the
 * operator's `/approvals` page.
 *
 * The skill itself (`./skill.ts`) stays Prisma-free per
 * `feedback_runner_portability.md` — only this thin wrapper imports the
 * Prisma binding. Tests can still call `runSkill` directly with a
 * `RecordingApprovalSink` and assert the no-outbound contract without
 * touching the database.
 *
 * Per `feedback_cold_start_safe_agents.md`: this function holds no
 * in-memory state. Every call constructs a fresh `PrismaApprovalSink`
 * and reads everything it needs from the caller's input.
 */

import { ChiefOfStaffMcpFetcher } from '../scheduler/chief-of-staff-fetcher';
import { runSkill } from './skill';
import { PrismaApprovalSink } from './prisma-approval-sink';
import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db';
import { PrismaMemoryStore } from '@/lib/plaino/memory';
import { getLlmProvider } from '@/lib/llm';
import { buildFeedbackRulesBlock } from '../feedback-rules';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import type { LlmProvider } from '@/lib/llm/types';
import type { SkillResult } from '../types';
import type {
  ApprovalSink,
  ChiefOfStaffFetcher,
  ChiefOfStaffInput,
  ChiefOfStaffOutput,
} from './types';

export interface RunChiefOfStaffForWorkspaceInput
  extends Omit<
    ChiefOfStaffInput,
    'sink' | 'fetcher' | 'llm' | 'feedbackRulesBlock'
  > {
  /** Override the calendar/inbox/todo fetcher — defaults to the real
   *  MCP-backed multiplexer (`ChiefOfStaffMcpFetcher`). Tests pass a
   *  `JsonChiefOfStaffFetcher` seeded with deterministic fixtures. */
  fetcher?: ChiefOfStaffFetcher;
  /** Override the sink — defaults to `PrismaApprovalSink`. Tests pass a
   *  `RecordingApprovalSink` to assert no-outbound without touching the
   *  database. Production callers should leave this undefined. */
  sink?: ApprovalSink | null;
  /** Wave-4 — override the memory store. Defaults to PrismaMemoryStore;
   *  pass null to skip FEEDBACK-rule reads + LLM refinement. */
  memory?: IMemoryStore | null;
  /** Wave-4 — override the LLM provider. Defaults to getLlmProvider();
   *  pass null to skip LLM refinement entirely (heuristic-only). */
  llm?: LlmProvider | null;
}

const CHIEF_OF_STAFF_SCOPES = ['scheduling'] as const;

export async function runChiefOfStaffForWorkspace(
  input: RunChiefOfStaffForWorkspaceInput,
): Promise<SkillResult<ChiefOfStaffOutput>> {
  const sink = input.sink === undefined ? new PrismaApprovalSink() : input.sink;
  const fetcher =
    input.fetcher ??
    new ChiefOfStaffMcpFetcher({ workspaceId: input.workspaceId });

  // Wave-4 — pull FEEDBACK rules under the scheduling scope. The skill
  // only invokes the LLM if rules are non-empty (cost guard).
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
        scopes: CHIEF_OF_STAFF_SCOPES,
      });
    } catch (err) {
      console.warn(
        `chief-of-staff: failed to read FEEDBACK rules — continuing heuristic-only. ${
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
    sink,
    llm: llmForRefine ?? undefined,
    feedbackRulesBlock,
  });
}
