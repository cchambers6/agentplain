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
import type { ComplianceFlag } from '../agents/sentinel';
import { withRls, type RlsContext } from '../db';
import { notifyApprovalQueued } from '../push';
import { encryptPayloadForWrite } from '../security/payload-crypto';
import { getVerticalContent } from '../verticals';
import type { AgentLoopWork } from '../verticals/types';
import { categoryToApprovalKind, type OfficeAdminApprovalPayload } from './office-admin';
import {
  applyApprovalThreshold,
  PENDING_DECISION,
  type ApprovalThresholdDecision,
} from './approval-threshold';
import {
  decideBoundedExecute,
  boundedExecuteStatusFlip,
  shouldSurfaceUnconfiguredMaster,
  type ComposedGateOutcomes,
} from './bounded-execute';
import { isBillingSyncFrozen } from '@/lib/billing/sync-freshness';
import type { OpsFlagStore } from '@/lib/ops/flag-store';
import type { WorkApprovalKind } from '@prisma/client';
import type { SkillRunRecord, SkillStepRecord, SkillRunOutcome } from './types';
import {
  guaranteeActionForOutcome,
  recordSavedTime,
} from '@/lib/guarantee/saved-time';

/**
 * Fallback agent slug for runs the vertical roster does not claim — e.g.
 * office-admin triage (cross-vertical, no roster card) and noise/vendor
 * outcomes that produce no owned work. The five chain skills are one
 * pipeline, so a single slug is correct here.
 *
 * Runs that DO map to a named roster capability (a buyer inquiry, a
 * showing request) are attributed to that capability's slug instead —
 * see `resolveOwningAgentSlug`. That is what makes the `/agents` cards
 * resolve to real activity instead of a perpetual "rooting in" spinner.
 */
export const SKILL_CHAIN_AGENT_SLUG = 'inbox-triage-fleet';

/**
 * Map a completed run's outcome to the loop-work bucket a roster agent can
 * own. Returns null when the run is admin triage or produced no owned work
 * (noise / transactional / vendor) — those fall back to SKILL_CHAIN_AGENT_SLUG.
 *
 * Keep the buckets in sync with `AgentLoopWork` in `lib/verticals/types.ts`.
 * Scheduling wins over draft because a scheduling-needed run produces both a
 * proposal AND a reply draft, and the showing scheduler owns that run.
 */
function workFromOutcome(outcome: SkillRunOutcome): AgentLoopWork | null {
  if (outcome.officeAdminPayload) return null;
  if (outcome.scheduledProposal || outcome.category === 'scheduling-needed') {
    return 'scheduling';
  }
  if (outcome.category === 'draft-needed' || outcome.category === 'lead') {
    return 'buyer-inquiry';
  }
  return null;
}

/**
 * Resolve the roster agent that owns this run, or null to use the fallback.
 * Looks up the workspace's vertical roster and finds the single `live` agent
 * whose `owns` list claims the run's work bucket. Verticals that have not yet
 * declared `runtime`/`owns` bindings resolve to null (legacy behavior — the
 * run is attributed to SKILL_CHAIN_AGENT_SLUG, exactly as before).
 */
function resolveOwningAgentSlug(record: SkillRunRecord): string | null {
  const work = workFromOutcome(record.outcome);
  if (!work) return null;
  const roster = getVerticalContent(record.verticalSlug)?.agentRoster ?? [];
  const owner = roster.find(
    (a) => a.runtime === 'live' && (a.owns?.includes(work) ?? false),
  );
  return owner?.slug ?? null;
}

export interface PersistArtifactsResult {
  /** Number of HandoffLogEntry rows written this call. */
  handoffsWritten: number;
  /** Number of WorkApprovalQueueItem rows written (0 or 1). */
  approvalsWritten: number;
  /** Approval row id when one was written; null otherwise. */
  approvalId: string | null;
}

/**
 * Wave-3 bounded-auto-execute wiring. When supplied, the persist site may
 * flip an eligible, enabled, under-ceiling approval row from PENDING to
 * AUTO_APPROVED *and* write an immutable AuditLog row recording what was
 * done on the owner's behalf — but ONLY if every standing gate in
 * `gates` already passed for this fire (composition, not duplication).
 *
 * Omit this entirely (the default) and behavior is identical to before:
 * no auto-execute, every row lands at the threshold-layer's decision
 * (PENDING unless the Wave-1 confidence path already flipped it). This
 * keeps the seam fail-closed and backward compatible — a caller has to
 * deliberately opt in by passing a store + gate outcomes.
 */
export interface BoundedExecuteConfig {
  /** DB-backed flag store holding the per-class enable + ceiling rows. */
  store: OpsFlagStore;
  /** Outcomes of the standing gates the CALLER already ran for this fire.
   *  Any gate false fails bounded-execute closed. */
  gates: ComposedGateOutcomes;
  /** Env snapshot for the master switch. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
}

export interface PersistArtifactsArgs {
  workspaceId: string;
  record: SkillRunRecord;
  /** Optional override for tests — defaults to `withRls(systemContext)`. */
  client?: Prisma.TransactionClient;
  /** Wave-3 — opt-in bounded auto-execute. Omit to disable (default). */
  boundedExecute?: BoundedExecuteConfig;
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
    // Test / caller-supplied transaction path: stay pure — the push trigger
    // only fires on the production (committed) path so suites stay
    // deterministic and offline. The saved-time credit DOES run here (on
    // the supplied client) so unit tests can assert the counter ticks.
    const clientResult = await writeArtifacts(
      args.client,
      args.workspaceId,
      args.record,
      args.boundedExecute,
    );
    await recordRunSavedTime(args.workspaceId, args.record, {
      client: args.client,
    }).catch(() => undefined);
    return clientResult;
  }
  const result = await withRls(ctx, (tx) =>
    writeArtifacts(tx, args.workspaceId, args.record, args.boundedExecute),
  );
  // The transaction has committed. Fire the approval-ready notification
  // (email per the partner's preference + push to any registered device)
  // so the owner knows a draft is waiting. Best-effort and self-contained —
  // notifyApprovalQueued never throws, but we still guard so a regression
  // here can't poison the persist result. Awaited (not floated) because
  // un-awaited promises are dropped in serverless.
  if (result.approvalsWritten > 0) {
    await notifyApprovalQueued({
      workspaceId: args.workspaceId,
      count: result.approvalsWritten,
    }).catch(() => undefined);
  }
  // Credit the trial-guarantee counter for the work this run delivered.
  // Post-commit + best-effort: the time-savings ledger is a secondary,
  // idempotent side effect (feedback_cold_start_safe_agents) — a failure
  // here must never poison the primary artifact write. Idempotent via the
  // (workspace, source, action) unique key, so a retried run is a no-op.
  await recordRunSavedTime(args.workspaceId, args.record).catch(() => undefined);
  return result;
}

/**
 * Trial-guarantee attribution. Translate a completed run into a saved-time
 * credit and append it to the ledger that drives the workspace counter +
 * the Day-7 walk-away evaluation. Idempotent: the source is the run's
 * WebhookEvent, so re-processing the same event never double-counts.
 *
 * No-ops silently for runs that produced no owner-time saving (noise,
 * vendor mail, transactional notices) — `guaranteeActionForOutcome`
 * returns null and there's nothing honest to credit.
 */
async function recordRunSavedTime(
  workspaceId: string,
  record: SkillRunRecord,
  opts?: { client?: Prisma.TransactionClient },
): Promise<void> {
  const actionType = guaranteeActionForOutcome(record.outcome);
  if (!actionType) return;
  await recordSavedTime({
    workspaceId,
    actionType,
    verticalSlug: record.verticalSlug,
    source: { table: 'WebhookEvent', id: record.webhookEventId },
    client: opts?.client,
  });
}

async function writeArtifacts(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  record: SkillRunRecord,
  boundedExecute?: BoundedExecuteConfig,
): Promise<PersistArtifactsResult> {
  // Resolve once: the roster agent that owns this run (or null → fallback).
  // Both the handoff trace root and the approval agentSlug use it so the
  // /agents card for the owning capability resolves to real activity.
  const owningAgentSlug = resolveOwningAgentSlug(record);

  const handoffs = buildHandoffsFromSteps({
    workspaceId,
    record,
    owningAgentSlug,
  });
  if (handoffs.length > 0) {
    await tx.handoffLogEntry.createMany({ data: handoffs });
  }

  const approval = buildApprovalFromOutcome({
    workspaceId,
    record,
    owningAgentSlug,
  });
  let approvalId: string | null = null;
  let approvalsWritten = 0;
  if (approval) {
    // Wave-1 audit fix §9 #2 — workspace's WorkThresholdConfig decides
    // PENDING vs AUTO_APPROVED on the *confidence* axis. Default = PENDING.
    let decision = await applyApprovalThreshold({
      workspaceId,
      kind: approval.kind,
      confidence: extractConfidence(record.outcome),
      tx,
    });
    // Wave-3 — bounded auto-execute. A second, STRICTER axis ($/risk +
    // per-class enable + reversibility allowlist + composed standing
    // gates). Only consulted when the row is still PENDING after the
    // confidence layer, and only when the caller opted in. When it fires
    // it flips to AUTO_APPROVED *and* writes an immutable AuditLog row.
    if (decision.status === 'PENDING' && boundedExecute) {
      decision = await applyBoundedExecuteDecision({
        tx,
        workspaceId,
        kind: approval.kind,
        refTable: approval.refTable,
        refId: approval.refId,
        agentSlug: approval.agentSlug,
        boundedExecute,
        priorDecision: decision,
      });
    }
    const created = await tx.workApprovalQueueItem.create({
      data: { ...approval, ...decision },
      select: { id: true },
    });
    approvalId = created.id;
    approvalsWritten = 1;
  }

  // Compliance sentinel: when the scanner found literal matches, write a
  // second approval row attributed to the vertical's compliance-sentinel
  // slug so the /agents card for sentinel resolves to real review work
  // and the operator sees the flag alongside the draft in /approvals.
  const complianceApproval = buildComplianceApproval({ workspaceId, record });
  if (complianceApproval) {
    // The compliance gate respects WorkThresholdConfig's existing
    // `requiresApprovalAboveSeverity` column — that's the field the
    // settings page has been writing all along; this is the read.
    const decision = await applyApprovalThreshold({
      workspaceId,
      kind: 'COMPLIANCE_FLAG',
      severity: extractTopComplianceSeverity(record.outcome),
      tx,
    });
    await tx.workApprovalQueueItem.create({
      data: { ...complianceApproval, ...decision },
      select: { id: true },
    });
    approvalsWritten += 1;
  }

  return {
    handoffsWritten: handoffs.length,
    approvalsWritten,
    approvalId,
  };
}

interface ApplyBoundedExecuteArgs {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  kind: WorkApprovalKind;
  refTable: string;
  refId: string;
  agentSlug: string;
  boundedExecute: BoundedExecuteConfig;
  priorDecision: ApprovalThresholdDecision;
}

/**
 * Run the bounded-execute policy for one approval row. On the single
 * allow branch it returns an AUTO_APPROVED decision AND writes an
 * immutable AuditLog row recording exactly what was auto-executed on the
 * owner's behalf (so the activity feed + audit log surface it). On every
 * deny branch it returns the prior (PENDING) decision unchanged.
 *
 * Never throws — a decision/audit failure falls back to the prior
 * decision (PENDING, the safe default). An auto-execute that could not be
 * audited must NOT proceed silently, so a failed AuditLog write also
 * falls back to PENDING.
 */
async function applyBoundedExecuteDecision(
  args: ApplyBoundedExecuteArgs,
): Promise<ApprovalThresholdDecision> {
  try {
    // mode #5 — billing-sync freshness. If the Stripe webhook sync is frozen
    // (stale > 1h), billing-dependent kinds must fail closed. We read the
    // fleet-wide freeze flag once here and thread it into the decision. The
    // read is fail-open (false on error) because the freeze is EXTRA safety
    // on top of the already fail-closed enable/ceiling reads — a transient
    // flag-store blip must not freeze ALL billing work fleet-wide.
    const billingSyncFresh = !(await isBillingSyncFrozen(
      args.boundedExecute.store,
    ).catch(() => false));

    const decision = await decideBoundedExecute({
      kind: args.kind,
      store: args.boundedExecute.store,
      gates: { ...args.boundedExecute.gates, billingSyncFresh },
      env: args.boundedExecute.env,
      // cv-x1 — the workspace's OWN autonomy policy governs the decision
      // (workspace-scoped OpsFlag row → fleet-wide row → default OFF).
      workspaceId: args.workspaceId,
    });

    // mode #3 — surface an AMBIGUOUS master config. When an eligible action
    // wanted to auto-execute but BOUNDED_AUTO_EXECUTE_MASTER was UNSET
    // (neither 'on' nor 'off'), record a LOUD audit row on this attempt so an
    // admin sees the config was never decided — instead of silently treating
    // it as off. Best-effort + console.warn; never blocks the (PENDING) flow.
    if (shouldSurfaceUnconfiguredMaster(decision)) {
      console.warn(
        `[FAIL_LOUD] bounded-execute master switch is UNSET while '${args.kind}' wanted to auto-execute — set BOUNDED_AUTO_EXECUTE_MASTER to 'on' or 'off'. Treated as off; routed to approval.`,
      );
      try {
        await args.tx.auditLog.create({
          data: {
            actorUserId: null,
            workspaceId: args.workspaceId,
            action: 'work_approval.auto_execute_unconfigured',
            targetTable: 'WorkApprovalQueueItem',
            targetId: args.refId,
            payload: {
              kind: args.kind,
              agentSlug: args.agentSlug,
              detail: decision.detail,
              note: 'BOUNDED_AUTO_EXECUTE_MASTER is unset (ambiguous) — surface to admin; treated as off.',
            },
          },
        });
      } catch {
        // Non-fatal — the console.warn already shouted; the action stays PENDING.
      }
    }

    const flip = boundedExecuteStatusFlip(decision);
    if (!flip) {
      // Did not auto-execute — keep the prior PENDING decision. (We do
      // not audit the routine "stayed in queue" case; that's the norm.)
      return args.priorDecision;
    }

    // Auto-executed. The AuditLog row is part of the same transaction as
    // the approval write, so an auto-approve can NEVER land without its
    // immutable record. If this write throws, the catch below reverts the
    // whole thing to PENDING (safe).
    await args.tx.auditLog.create({
      data: {
        // System actor — no human user decided this. The null actor is
        // exactly how the audit trail records "the fleet did this."
        actorUserId: null,
        workspaceId: args.workspaceId,
        action: 'work_approval.auto_executed',
        targetTable: 'WorkApprovalQueueItem',
        targetId: args.refId,
        payload: {
          kind: args.kind,
          agentSlug: args.agentSlug,
          refTable: args.refTable,
          refId: args.refId,
          reason: decision.reason,
          detail: decision.detail,
          estUsd: decision.estUsd,
          ceilingUsd: decision.ceilingUsd,
        },
      },
    });

    return {
      status: flip.status,
      decidedAt: new Date(),
      decidedByUserId: null,
      decisionReason: flip.decisionReason,
    };
  } catch (err) {
    console.warn(
      `bounded-execute decision failed (falling back to PENDING): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return args.priorDecision;
  }
}

interface BuildHandoffsArgs {
  workspaceId: string;
  record: SkillRunRecord;
  /** Roster agent that owns this run, or null when none claims it. */
  owningAgentSlug: string | null;
}

/**
 * Walk the SkillRunRecord's steps and emit one HandoffLogEntry per
 * transition. We treat each step's `summary` as the human-readable
 * handoff label so the overview UI shows "read → categorize · intent=…"
 * instead of opaque ids.
 *
 * The trace root is the owning roster agent (e.g. `realty-buyer-inquiry-
 * router`) when one claims the run, so the agents page's `groupBy(fromAgent)`
 * count resolves to that capability. When no roster agent owns the run
 * (admin triage, noise), we fall back to the synthetic `inbound` label so
 * the row still renders cleanly without inflating any capability's count.
 */
function buildHandoffsFromSteps(
  args: BuildHandoffsArgs,
): Prisma.HandoffLogEntryCreateManyInput[] {
  const { workspaceId, record, owningAgentSlug } = args;
  const rows: Prisma.HandoffLogEntryCreateManyInput[] = [];
  let prev = owningAgentSlug ?? 'inbound';
  // Spread handoff timestamps by a millisecond each so they sort
  // deterministically in the UI (the overview orders by occurredAt desc).
  const base = new Date(record.startedAt).getTime();
  record.steps.forEach((step, idx) => {
    const toAgent = stepAgentSlug(step, record.verticalSlug);
    rows.push({
      workspaceId,
      fromAgent: prev,
      toAgent,
      handoffType: step.ok ? step.step : `${step.step}.error`,
      payload: encryptPayloadForWrite({
        step: step.step,
        ok: step.ok,
        summary: step.summary,
        durationMs: step.durationMs,
        errorCode: step.errorCode ?? null,
        webhookEventId: record.webhookEventId,
        verticalSlug: record.verticalSlug,
        runId: record.startedAt,
      }),
      relatedSubjectTable: 'WebhookEvent',
      relatedSubjectId: record.webhookEventId,
      occurredAt: new Date(base + idx),
    });
    prev = toAgent;
  });
  return rows;
}

/**
 * Build a WorkApprovalQueueItem from a completed run. Two paths:
 *
 *   - office-admin: when the office-admin classifier matched a real
 *     admin category (verification code, password reset, billing, etc.)
 *     the runner has already composed the payload. We write an
 *     `ADMIN_*` kind so the approvals page renders the right affordance.
 *   - draft (existing): when the vertical chain produced a draft, we
 *     write a `BUYER_INQUIRY_REPLY_DRAFT` kind as before.
 *
 * The runner short-circuits before vertical-categorize when admin
 * matches, so the two paths are mutually exclusive within one run.
 *
 * Returns null when neither produced an actionable approval.
 */
function buildApprovalFromOutcome(
  args: BuildHandoffsArgs,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput | null {
  const { workspaceId, record, owningAgentSlug } = args;
  const adminPayload = record.outcome.officeAdminPayload;
  if (adminPayload) {
    return buildAdminApprovalRow({ workspaceId, record, adminPayload });
  }
  const draft = record.outcome.draft;
  if (!draft) return null;
  return {
    workspaceId,
    agentSlug: owningAgentSlug ?? SKILL_CHAIN_AGENT_SLUG,
    kind: 'BUYER_INQUIRY_REPLY_DRAFT',
    refTable: 'WebhookEvent',
    refId: record.webhookEventId,
    status: 'PENDING',
    payload: encryptPayloadForWrite({
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
    }),
  };
}

interface BuildAdminApprovalRowArgs {
  workspaceId: string;
  record: SkillRunRecord;
  adminPayload: OfficeAdminApprovalPayload;
}

function buildAdminApprovalRow(
  args: BuildAdminApprovalRowArgs,
): Prisma.WorkApprovalQueueItemUncheckedCreateInput {
  const { workspaceId, record, adminPayload } = args;
  return {
    workspaceId,
    agentSlug: SKILL_CHAIN_AGENT_SLUG,
    kind: categoryToApprovalKind(adminPayload.category),
    refTable: 'WebhookEvent',
    refId: record.webhookEventId,
    status: 'PENDING',
    payload: encryptPayloadForWrite({
      ...adminPayload,
      verticalSlug: record.verticalSlug,
      // Surface the step summaries so the audit footer renders without
      // a separate query.
      inboundSummary: extractStepSummary(record.steps, 'read'),
      officeAdminSummary: extractStepSummary(record.steps, 'office-admin-classify'),
    }),
  };
}

function extractStepSummary(
  steps: SkillStepRecord[],
  step: SkillStepRecord['step'],
): string | null {
  const match = steps.find((s) => s.step === step);
  return match ? match.summary : null;
}

/** Pick the confidence the workspace threshold should evaluate against.
 *  Office-admin rows carry their own confidence; vertical-chain drafts
 *  carry the DraftReply confidence. Returns undefined when no honest
 *  number exists — the gate then defaults to PENDING. */
function extractConfidence(outcome: SkillRunOutcome): number | undefined {
  if (outcome.officeAdminPayload) return outcome.officeAdminPayload.confidence;
  if (outcome.draft) return outcome.draft.confidence;
  return undefined;
}

/** The compliance gate evaluates against the HIGHEST-severity flag in
 *  the batch — if any flag in the batch crosses the threshold, the
 *  whole row stays PENDING. Returns undefined when no flags exist. */
function extractTopComplianceSeverity(
  outcome: SkillRunOutcome,
): import('@prisma/client').ComplianceSeverity | undefined {
  const flags = outcome.complianceFlags;
  if (!flags || flags.length === 0) return undefined;
  const ranks: Record<string, number> = {
    INFO: 1,
    LOW: 2,
    MEDIUM: 3,
    HIGH: 4,
    BLOCKER: 5,
  };
  let topSev: import('@prisma/client').ComplianceSeverity | undefined;
  let topRank = -1;
  for (const f of flags) {
    const sev = severityFromCategory(f.category);
    if (!sev) continue;
    const r = ranks[sev];
    if (r > topRank) {
      topRank = r;
      topSev = sev;
    }
  }
  return topSev;
}

function severityFromCategory(
  category: string | null | undefined,
): import('@prisma/client').ComplianceSeverity | undefined {
  // The sentinel's ComplianceFlag.category is free-form — we map only
  // the conventional buckets to severity. Unknown categories return
  // undefined; the gate then defaults to PENDING (safe).
  switch (category) {
    case 'info':
      return 'INFO';
    case 'low':
    case 'minor':
      return 'LOW';
    case 'medium':
    case 'standard':
      return 'MEDIUM';
    case 'high':
    case 'critical':
      return 'HIGH';
    case 'blocker':
    case 'block':
      return 'BLOCKER';
    default:
      return undefined;
  }
}

// Re-export the threshold decision type so callers (test sinks, audits)
// can type-narrow against the shape persist-artifacts produces.
export type { ApprovalThresholdDecision };
export { PENDING_DECISION };

/**
 * Map a step name to the agent slug we show in the UI. The chain skills
 * are one fleet under the hood; surfacing them as separate "agents"
 * gives the customer a feel for what the loop is doing without us
 * having to invent personas.
 *
 * `compliance-check` is the exception: it resolves to the workspace's
 * vertical-specific Compliance Sentinel slug (`<vertical>-compliance-
 * sentinel`) so the /agents page's groupBy(fromAgent) attributes the
 * step's hand-off to the live Sentinel card. Verticals without a
 * dedicated Sentinel slug in their roster (today: insurance, mortgage,
 * recruiting, home-services, property-management) fall back to a generic
 * `compliance-sentinel` label so the row is still honest about what ran.
 */
function stepAgentSlug(step: SkillStepRecord, verticalSlug: string): string {
  switch (step.step) {
    case 'read':
      return 'reader';
    case 'office-admin-classify':
      return 'office-admin';
    case 'categorize':
      return 'router';
    case 'coordinate':
      return 'coordinator';
    case 'schedule':
      return 'scheduler';
    case 'draft':
      return 'drafter';
    case 'compliance-check':
      return sentinelSlugForVertical(verticalSlug);
    case 'mark-processed':
      return 'completer';
    default:
      return SKILL_CHAIN_AGENT_SLUG;
  }
}

/**
 * Map a vertical slug to its Compliance Sentinel roster slug. The five
 * verticals that ship a Sentinel card today (real-estate, cpa, law, ria,
 * title-escrow) use a vertical-prefixed slug. Others fall back to a
 * generic label so the handoff log row is still truthful about what ran.
 */
function sentinelSlugForVertical(verticalSlug: string): string {
  const overrides: Record<string, string> = {
    'real-estate': 'realty-compliance-sentinel',
    'title-escrow': 'title-compliance-sentinel',
  };
  if (overrides[verticalSlug]) return overrides[verticalSlug];
  // The remaining sentinel-carrying verticals use the `<slug>-compliance-
  // sentinel` convention. Verticals without a roster card get the generic
  // label below — the handoff still records the step ran honestly.
  const hasRosterSentinel = (getVerticalContent(verticalSlug)?.agentRoster ?? []).some(
    (a) => a.slug === `${verticalSlug}-compliance-sentinel`,
  );
  if (hasRosterSentinel) return `${verticalSlug}-compliance-sentinel`;
  return 'compliance-sentinel';
}

/**
 * Build a COMPLIANCE_FLAG approval row when the sentinel scanner found
 * literal matches against the draft. One row per run, batched flags in
 * the payload so the /approvals page can render them grouped under the
 * sentinel card. Returns null when sentinel did not run or found no
 * matches.
 */
function buildComplianceApproval(args: {
  workspaceId: string;
  record: SkillRunRecord;
}): Prisma.WorkApprovalQueueItemUncheckedCreateInput | null {
  const { workspaceId, record } = args;
  const flags = record.outcome.complianceFlags;
  if (!flags || flags.length === 0) return null;
  const primary = flags[0];
  return {
    workspaceId,
    agentSlug: sentinelSlugForVertical(record.verticalSlug),
    kind: 'COMPLIANCE_FLAG',
    refTable: 'WebhookEvent',
    refId: record.webhookEventId,
    status: 'PENDING',
    payload: encryptPayloadForWrite({
      rule: primary.ruleId,
      summary: `Sentinel matched ${flags.length} literal-trigger phrase${flags.length === 1 ? '' : 's'} against the draft. Each match is grounded in a published citation; rewrite or approve with rationale.`,
      source: primary.source === 'subject' ? 'draft subject line' : 'draft body',
      flags: flags.map((f: ComplianceFlag) => ({
        ruleId: f.ruleId,
        ruleTitle: f.ruleTitle,
        category: f.category,
        matchedPhrase: f.matchedPhrase,
        matchedText: f.matchedText,
        source: f.source,
        excerpt: f.excerpt,
        citation: { ...f.citation },
      })),
      verticalSlug: record.verticalSlug,
    }),
  };
}

/**
 * Convenience for callers (the Inngest function) that want a one-line
 * summary of what they just persisted, for AuditLog payloads.
 */
export function summarizeOutcome(outcome: SkillRunOutcome): string {
  const parts: string[] = [];
  if (outcome.officeAdminPayload) {
    parts.push(`office-admin=${outcome.officeAdminPayload.category}`);
    parts.push(`priority=${outcome.officeAdminPayload.priority}`);
    parts.push(`conf=${outcome.officeAdminPayload.confidence.toFixed(2)}`);
    return parts.join(' ');
  }
  parts.push(`category=${outcome.category ?? 'none'}`);
  if (outcome.scheduledProposal) {
    parts.push(`slots=${outcome.scheduledProposal.proposedSlots.length}`);
  }
  if (outcome.draft) {
    parts.push(`draft=${outcome.draft.persisted ? 'persisted' : 'queued'}`);
    parts.push(`conf=${outcome.draft.confidence.toFixed(2)}`);
  }
  if (outcome.complianceFlags && outcome.complianceFlags.length > 0) {
    parts.push(`compliance-flags=${outcome.complianceFlags.length}`);
  }
  return parts.join(' ');
}
