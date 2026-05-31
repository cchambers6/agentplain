/**
 * lib/skills/finance-pulse-general/run-for-workspace.ts
 *
 * Production entry point for the weekly finance-pulse cron sweep. Reads
 * the workspace's trailing 7-day snapshot (internal counts + QuickBooks
 * summary when connected) + FEEDBACK rules under the finance scope, runs
 * the skill, and persists via `PrismaFinancePulseApprovalSink`.
 *
 * Per `feedback_cold_start_safe_agents.md`: every call constructs fresh
 * state — no module-level cache.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every external dependency
 * (memory store, sink, LLM provider, QuickBooks MCP builder) is
 * injectable so tests don't need Postgres or the Anthropic SDK.
 */

import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db';
import { PrismaMemoryStore } from '@/lib/plaino/memory';
import { buildFeedbackRulesBlock } from '../feedback-rules';
import type { LlmProvider } from '@/lib/llm/types';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import {
  buildFinancePulseSnapshot,
  type SystemContextRunner,
} from './activity-snapshot';
import { PrismaFinancePulseApprovalSink } from './prisma-approval-sink';
import { runSkill } from './skill';
import type { SkillResult } from '../types';
import type {
  FinancePulseApprovalSink,
  FinancePulseSkillOutput,
  FinancePulseSnapshot,
} from './types';

/** Scopes the finance pulse reads from FEEDBACK memory. The new
 *  `analytics` scope is the closest cousin for reporting-style rules;
 *  `reporting` is the legacy scope. `general` is layered in by
 *  `readFeedbackRules` automatically. There is no `finance`
 *  PreferenceScopeId today — rules written under `general` or
 *  `reporting` apply to the finance pulse. */
const FINANCE_PULSE_FEEDBACK_SCOPES = ['analytics', 'reporting'] as const;

export interface RunFinancePulseForWorkspaceInput {
  workspaceId: string;
  /** Override the sink — defaults to `PrismaFinancePulseApprovalSink`.
   *  Pass null to skip persistence (used by the dev-console smoke
   *  command). */
  sink?: FinancePulseApprovalSink | null;
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
  snapshot?: FinancePulseSnapshot;
  /** Override the QuickBooks MCP builder. Tests inject so we don't reach
   *  for the real Intuit API. Pass null to bypass QuickBooks entirely. */
  buildQuickbooksMcp?:
    | import('./activity-snapshot').BuildFinancePulseSnapshotInput['buildQuickbooksMcp'];
  /** Workspace-tunable depth. Defaults to `summary`. */
  pulseDepth?: 'summary' | 'detailed';
}

export async function runFinancePulseForWorkspace(
  input: RunFinancePulseForWorkspaceInput,
): Promise<SkillResult<FinancePulseSkillOutput>> {
  const sink =
    input.sink === undefined
      ? new PrismaFinancePulseApprovalSink()
      : input.sink;
  const memory =
    input.memory === undefined
      ? new PrismaMemoryStore(input.workspaceId, {
          ctx: SYSTEM_OPERATOR_CONTEXT,
        })
      : input.memory;

  const snapshot =
    input.snapshot ??
    (await buildFinancePulseSnapshot({
      workspaceId: input.workspaceId,
      now: input.now,
      systemContext: input.systemContext,
      buildQuickbooksMcp: input.buildQuickbooksMcp,
    }));

  let feedbackRulesBlock = '';
  if (memory) {
    try {
      feedbackRulesBlock = await buildFeedbackRulesBlock({
        memory,
        workspaceId: input.workspaceId,
        scopes: FINANCE_PULSE_FEEDBACK_SCOPES,
      });
    } catch (err) {
      console.warn(
        `finance-pulse: failed to read FEEDBACK rules — continuing without. ${
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
    pulseDepth: input.pulseDepth,
  });
}
