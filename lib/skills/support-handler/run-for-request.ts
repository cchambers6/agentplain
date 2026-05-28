/**
 * lib/skills/support-handler/run-for-request.ts
 *
 * Production entry point for the support-handler skill. The Inngest
 * function (`lib/inngest/functions/support-handler-on-create.ts`)
 * calls this with a SupportRequest id; this resolves the row under
 * the workspace RLS context, builds the production substrate +
 * approval sink, runs the skill, and writes an audit log entry.
 *
 * Per feedback_cold_start_safe_agents.md: holds no in-memory state.
 * Every invocation reads SupportRequest + Workspace fresh and
 * constructs new substrate + sink bindings.
 *
 * Per project_no_outbound_architecture.md: the skill drafts only.
 * The original /help notification email (sent in lib/support/index.ts)
 * remains the operator's primary triage signal during the parallel
 * verification window; the approval-queue draft is the additive
 * draft-into-review path.
 *
 * RLS read context:
 *   - The SupportRequest row is workspace-scoped under RLS. The
 *     Inngest fire has no session, so we read under withSystemContext
 *     (isOperator=true) — the same posture the rest of the cron
 *     functions use to drain workspace-scoped tables.
 */

import { withSystemContext } from '../../db/rls';
import { runSkill } from './skill';
import { PrismaApprovalSink } from './prisma-approval-sink';
import { CustomerFilesKnowledgeSubstrate } from './knowledge-substrate';
import { servicePartnerForWorkspace } from '../../onboarding/service-partner';
import { skillError, skillOk, type SkillResult } from '../types';
import type {
  ApprovalSink,
  IKnowledgeSubstratePort,
  SupportHandlerOutput,
  SupportRequestSnapshot,
} from './types';

export interface RunForRequestInput {
  supportRequestId: string;
  /** Override the substrate — defaults to the MCP-backed
   *  CustomerFilesKnowledgeSubstrate. Tests pass a
   *  RecordingKnowledgeSubstrate. */
  substrate?: IKnowledgeSubstratePort;
  /** Override the sink — defaults to PrismaApprovalSink. Tests pass
   *  a RecordingApprovalSink. Pass `null` to skip persistence (the
   *  proposal still comes back on the return value). */
  sink?: ApprovalSink | null;
  /** Override the LLM provider — tests pass a TestLlmProvider seeded
   *  with a deterministic JSON response. */
  llm?: import('../../llm/types').LlmProvider;
  /** Fixed clock for tests. */
  now?: Date;
}

export async function runSupportHandlerForRequest(
  input: RunForRequestInput,
): Promise<SkillResult<SupportHandlerOutput>> {
  const snapshot = await loadSnapshot(input.supportRequestId);
  if (!snapshot.ok) return snapshot;

  const substrate = input.substrate ?? new CustomerFilesKnowledgeSubstrate();
  const sink =
    input.sink === undefined ? new PrismaApprovalSink() : input.sink;

  return runSkill({
    workspaceId: snapshot.value.workspaceId,
    request: snapshot.value,
    substrate,
    sink,
    llm: input.llm,
    now: input.now,
  });
}

async function loadSnapshot(
  supportRequestId: string,
): Promise<SkillResult<SupportRequestSnapshot>> {
  const row = await withSystemContext((tx) =>
    tx.supportRequest.findUnique({
      where: { id: supportRequestId },
      select: {
        id: true,
        workspaceId: true,
        subject: true,
        body: true,
        createdAt: true,
        workspace: {
          select: { name: true, vertical: true },
        },
        fromUser: {
          select: { email: true, name: true },
        },
      },
    }),
  );
  if (!row) {
    return skillError(
      'NOT_APPLICABLE',
      `SupportRequest ${supportRequestId} not found (deleted between submit and fire?)`,
    );
  }
  return skillOk({
    id: row.id,
    workspaceId: row.workspaceId,
    workspaceName: row.workspace?.name ?? 'your workspace',
    verticalSlug: row.workspace?.vertical ?? null,
    fromEmail: row.fromUser?.email ?? 'unknown@unknown',
    fromName: row.fromUser?.name ?? null,
    subject: row.subject,
    body: row.body,
    partnerName: servicePartnerForWorkspace(row.workspaceId),
    receivedAt: row.createdAt,
  });
}
