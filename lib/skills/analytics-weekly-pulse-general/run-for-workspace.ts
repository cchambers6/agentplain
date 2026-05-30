/**
 * lib/skills/analytics-weekly-pulse-general/run-for-workspace.ts
 *
 * Production entry point for the weekly pulse cron sweep. Reads the
 * workspace's trailing 7-day snapshot + (optional) FEEDBACK rules,
 * runs the skill, and persists via `PrismaPulseApprovalSink`.
 *
 * Per `feedback_cold_start_safe_agents.md`: every call constructs fresh
 * state — no module-level cache.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every external dependency
 * (memory store, sink, LLM provider) is injectable so tests don't need
 * Postgres or the Anthropic SDK.
 */

import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db';
import { PrismaMemoryStore } from '@/lib/plaino/memory';
import { buildFeedbackRulesBlock } from '../feedback-rules';
import type { LlmProvider } from '@/lib/llm/types';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import {
  buildPulseSnapshot,
  type SystemContextRunner,
} from './activity-snapshot';
import { PrismaPulseApprovalSink } from './prisma-approval-sink';
import { runSkill } from './skill';
import type { SkillResult } from '../types';
import type {
  PulseApprovalSink,
  PulseSkillOutput,
} from './types';

/** Scopes the pulse reads from FEEDBACK memory. Analytics is light — we
 *  honor `reporting` rules and the implicit `general` scope the reader
 *  always layers on top. */
const PULSE_FEEDBACK_SCOPES = ['reporting'] as const;

export interface RunAnalyticsPulseForWorkspaceInput {
  workspaceId: string;
  /** Override the sink — defaults to `PrismaPulseApprovalSink`. Pass
   *  null to skip persistence (used by the dev-console smoke command). */
  sink?: PulseApprovalSink | null;
  /** Override the memory store — defaults to `PrismaMemoryStore`. Pass
   *  null to skip FEEDBACK-rule injection. */
  memory?: IMemoryStore | null;
  /** Override the system-context runner. Tests inject. */
  systemContext?: SystemContextRunner;
  /** Override the LLM provider. Tests inject `TestLlmProvider`. */
  llm?: LlmProvider;
  /** Fixed clock for tests. */
  now?: Date;
  /** Optional snapshot override — tests inject so the snapshot reader
   *  doesn't need to be exercised end-to-end every time. */
  snapshot?: import('./types').PulseActivitySnapshot;
}

export async function runAnalyticsPulseForWorkspace(
  input: RunAnalyticsPulseForWorkspaceInput,
): Promise<SkillResult<PulseSkillOutput>> {
  const sink =
    input.sink === undefined ? new PrismaPulseApprovalSink() : input.sink;
  const memory =
    input.memory === undefined
      ? new PrismaMemoryStore(input.workspaceId, { ctx: SYSTEM_OPERATOR_CONTEXT })
      : input.memory;

  const snapshot =
    input.snapshot ??
    (await buildPulseSnapshot({
      workspaceId: input.workspaceId,
      now: input.now,
      systemContext: input.systemContext,
    }));

  let feedbackRulesBlock = '';
  if (memory) {
    try {
      feedbackRulesBlock = await buildFeedbackRulesBlock({
        memory,
        workspaceId: input.workspaceId,
        scopes: PULSE_FEEDBACK_SCOPES,
      });
    } catch (err) {
      console.warn(
        `analytics-pulse: failed to read FEEDBACK rules — continuing without. ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return runSkill({
    workspaceId: input.workspaceId,
    snapshot,
    sink: sink ?? undefined,
    feedbackRulesBlock,
    now: input.now,
    llm: input.llm,
  });
}
