/**
 * lib/skills/persist-artifacts.ts
 *
 * Turn a `SkillRunRecord` (the pure-data output of `runSkillChain`) into
 * the two customer-visible side effects:
 *
 *   1. `HandoffLogEntry` — one row per stage transition so the workspace
 *      overview's "What's running now" feed and the agents page's
 *      per-agent counts have real content.
 *   2. `WorkApprovalQueueItem` — one row per draft the chain produced, so
 *      `/approvals` lists drafts for human review before the customer's
 *      send happens out of Gmail Drafts.
 *
 * The runner stays pure (no Prisma imports) per the orchestrator/adapter
 * split in `feedback_runner_portability.md`. This module is the only
 * place that writes loop output into the customer-facing tables.
 *
 * Per `feedback_cold_start_safe_agents.md`: each call here is independent
 * and reads no in-memory cache. Re-running the same record is idempotent
 * via the dedupe key (`refTable=WebhookEvent` + `refId=event.id`).
 *
 * Per `project_no_outbound_architecture.md`: nothing here sends. Drafts
 * are surfaced for human approval; the customer's existing system sends
 * out of Gmail Drafts.
 */

import type { Prisma } from '@prisma/client';
import { withRls, type RlsContext } from '../db';
import type { SkillRunRecord, SkillStepRecord, SkillRunOutcome } from './types';

/**
 * Stable agent slug — every handoff + approval surfaces this so the
 * agents page can group by agent. We use one slug for the V1 chain
 * because the five skills are a single agent's pipeline, not five agents.
 * When the fleet expands to per-agent chains, this becomes the agent's
 * slug rather than this constant.
 */
export const SKILL_CHAIN_AGENT_SLUG = 'inbox-triage-fleet';

export interface PersistArtifactsResult {
  /** Number of HandoffLogEntry rows written this call. */
  handoffsWritten: number;
  /** Number of WorkApprovalQueueItem rows written (0 or 1). */
  approvalsWritten: number;
  /** Approval row id when one was written; null otherwise. */
  approvalId: string | null;
}

export interface PersistArtifactsArgs {
  workspaceId: string;
  record: SkillRunRecord;
  /** Optional override for tests — defaults to `withRls(systemContext)`. */
  client?: Prisma.TransactionClient;
}

/**
 * Persist HandoffLogEntry + WorkApprovalQueueItem rows for a completed
 * skill run. Idempotent: re-running for the same WebhookEvent overwrites
 * the prior approval row (status=PENDING re-pushes the latest draft) but
 * appends new handoffs (the log is append-only by design).
 */
export async function persistSkillRunArtifacts(
  args: PersistArtifactsArgs,
): Promise<PersistArtifactsResult> {
  const ctx: RlsContext = {
    userId: null,
    workspaceId: args.workspaceId,
    isOperator: true,
  };
  if (args.client) {
    return writeArtifacts(args.client, args.workspaceId, args.record);
  }
  return withRls(ctx, (tx) => writeArtifacts(tx, args.workspaceId, args.record));
}

async function writeArtifacts(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  record: SkillRunRecord,
): Promise<PersistArtifactsResult> {
  const handoffs = buildHandoffsFromSteps({
    workspaceId,
    record,
  });
  if (handoffs.length > 0) {
    await tx.handoffLogEntry.createMany({ data: handoffs });
  }

  const approval = buildApprovalFromOutcome({
    workspaceId,
    record,
  });
  let approvalId: string | null = null;
  if (approval) {
    const created = await tx.workApprovalQueueItem.create({
      data: approval,
      select: { id: true },
    });
    approvalId = created.id;
  }

  return {
    handoffsWritten: handoffs.length,
    approvalsWritten: approval ? 1 : 0,
    approvalId,
  };
}

interface BuildHandoffsArgs {
  workspaceId: string;
  record: SkillRunRecord;
}

/**
 * Walk the SkillRunRecord's steps and emit one HandoffLogEntry per
 * transition. We treat each step's `summary` as the human-readable
 * handoff label so the overview UI shows "read → categorize · intent=…"
 * instead of opaque ids.
 *
 * The first step has no "from" agent — we use a synthetic `inbound`
 * label so the row still renders cleanly.
 */
function buildHandoffsFromSteps(
  args: BuildHandoffsArgs,
): Prisma.HandoffLogEntryCreateManyInput[] {
  const { workspaceId, record } = args;
  const rows: Prisma.HandoffLogEntryCreateManyInput[] = [];
  let prev = 'inbound';
  // Spread handoff timestamps by a millisecond each so they sort
  // deterministically in the UI (the overview orders by occurredAt desc).
  const base = new Date(record.startedAt).getTime();
  record.steps.forEach((step, idx) => {
    rows.push({
      workspaceId,
      fromAgent: prev,
      toAgent: stepAgentSlug(step),
      handoffType: step.ok ? step.step : `${step.step}.error`,
      payload: {
        step: step.step,
        ok: step.ok,
        summary: step.summary,
        durationMs: step.durationMs,
        errorCode: step.errorCode ?? null,
        webhookEventId: record.webhookEventId,
        verticalSlug: record.verticalSlug,
        runId: record.startedAt,
      } as Prisma.InputJsonValue,
      relatedSubjectTable: 'WebhookEvent',
      relatedSubjectId: record.webhookEventId,
      occurredAt: new Date(base + idx),
    });
    prev = stepAgentSlug(step);
  });
  return rows;
}

/**
 * Build a WorkApprovalQueueItem from a completed run, if the outcome
 * produced a draft. We surface every draft (persisted or not) — that's
 * the whole point of "Decisions waiting for you" per the page copy.
 * Returns null when there's nothing to approve.
 */
function buildApprovalFromOutcome(
  args: BuildHandoffsArgs,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput | null {
  const { workspaceId, record } = args;
  const draft = record.outcome.draft;
  if (!draft) return null;
  return {
    workspaceId,
    agentSlug: SKILL_CHAIN_AGENT_SLUG,
    kind: 'BUYER_INQUIRY_REPLY_DRAFT',
    refTable: 'WebhookEvent',
    refId: record.webhookEventId,
    status: 'PENDING',
    payload: {
      draftId: draft.draftId,
      providerDraftId: draft.providerDraftId,
      subject: draft.subject,
      body: draft.body,
      tone: draft.tone,
      confidence: draft.confidence,
      persisted: draft.persisted,
      category: record.outcome.category,
      threadId: record.outcome.threadId,
      scheduledProposal: record.outcome.scheduledProposal,
      verticalSlug: record.verticalSlug,
      // Surface the read summary so the approver sees what inbound the
      // draft is responding to without leaving the page.
      inboundSummary: extractStepSummary(record.steps, 'read'),
      categorizationSummary: extractStepSummary(record.steps, 'categorize'),
    } as Prisma.InputJsonValue,
  };
}

function extractStepSummary(
  steps: SkillStepRecord[],
  step: SkillStepRecord['step'],
): string | null {
  const match = steps.find((s) => s.step === step);
  return match ? match.summary : null;
}

/**
 * Map a step name to the agent slug we show in the UI. The five skills
 * are one fleet under the hood; surfacing them as separate "agents"
 * gives the customer a feel for what the loop is doing without us
 * having to invent five agent personas.
 */
function stepAgentSlug(step: SkillStepRecord): string {
  switch (step.step) {
    case 'read':
      return 'reader';
    case 'categorize':
      return 'router';
    case 'coordinate':
      return 'coordinator';
    case 'schedule':
      return 'scheduler';
    case 'draft':
      return 'drafter';
    case 'mark-processed':
      return 'completer';
    default:
      return SKILL_CHAIN_AGENT_SLUG;
  }
}

/**
 * Convenience for callers (the Inngest function) that want a one-line
 * summary of what they just persisted, for AuditLog payloads.
 */
export function summarizeOutcome(outcome: SkillRunOutcome): string {
  const parts: string[] = [];
  parts.push(`category=${outcome.category ?? 'none'}`);
  if (outcome.scheduledProposal) {
    parts.push(`slots=${outcome.scheduledProposal.proposedSlots.length}`);
  }
  if (outcome.draft) {
    parts.push(`draft=${outcome.draft.persisted ? 'persisted' : 'queued'}`);
    parts.push(`conf=${outcome.draft.confidence.toFixed(2)}`);
  }
  return parts.join(' ');
}
