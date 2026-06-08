import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db';
import { PrismaMemoryStore } from '@/lib/plaino/memory';
import { buildFeedbackRulesBlock } from '../feedback-rules';
import { getLlmProvider } from '@/lib/llm';
import { PrismaRedlineStore } from '@/lib/agents/sentinel/prisma-redline-store';
import type { RedlineStore } from '@/lib/agents/sentinel/redline-store';
import type { LlmProvider } from '@/lib/llm/types';
import type { IMemoryStore } from '@/lib/plaino/memory/types';
import {
  buildComplianceSnapshot,
  type SystemContextRunner,
} from './activity-snapshot';
import { PrismaComplianceApprovalSink } from './prisma-approval-sink';
import { runSkill } from './skill';
import type { SkillResult } from '../types';
import type {
  ComplianceApprovalSink,
  ComplianceSnapshot,
  ComplianceSkillOutput,
} from './types';

const COMPLIANCE_FEEDBACK_SCOPES = ['legal-flagging'] as const;

export interface RunComplianceWatchForWorkspaceInput {
  workspaceId: string;
  sink?: ComplianceApprovalSink | null;
  memory?: IMemoryStore | null;
  systemContext?: SystemContextRunner;
  llm?: LlmProvider;
  /** Durable counsel-redline store for the learned-language rewrite loop.
   *  Defaults to PrismaRedlineStore; pass `null` to skip the learned path. */
  redlineStore?: RedlineStore | null;
  now?: Date;
  snapshot?: ComplianceSnapshot;
}

export async function runComplianceWatchForWorkspace(
  input: RunComplianceWatchForWorkspaceInput,
): Promise<SkillResult<ComplianceSkillOutput>> {
  const sink =
    input.sink === undefined
      ? new PrismaComplianceApprovalSink()
      : input.sink;
  const memory =
    input.memory === undefined
      ? new PrismaMemoryStore(input.workspaceId, {
          ctx: SYSTEM_OPERATOR_CONTEXT,
        })
      : input.memory;

  // Rewrite-and-stage runs at snapshot build time so the LLM grounds each
  // compliant replacement in the rule that fired. Use the caller's provider
  // when given (tests), else the composed prod provider; the deterministic
  // fallback inside stageRewrites covers an LLM failure.
  const rewriteLlm = input.llm ?? getLlmProvider();
  const redlineStore =
    input.redlineStore === undefined
      ? new PrismaRedlineStore()
      : input.redlineStore;

  const snapshot =
    input.snapshot ??
    (await buildComplianceSnapshot({
      workspaceId: input.workspaceId,
      now: input.now,
      systemContext: input.systemContext,
      llm: rewriteLlm,
      redlineStore: redlineStore ?? undefined,
    }));

  let feedbackRulesBlock = '';
  if (memory) {
    try {
      feedbackRulesBlock = await buildFeedbackRulesBlock({
        memory,
        workspaceId: input.workspaceId,
        scopes: COMPLIANCE_FEEDBACK_SCOPES,
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
    now: input.now,
    llm: input.llm,
  });
}
