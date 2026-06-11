/**
 * lib/skills/customer-support-triage/run-for-request.ts
 *
 * Production entry point for the customer-support-triage skill. The
 * Inngest support-handler-on-create function calls this BEFORE the
 * draft-for-review path, with a SupportRequest id. It:
 *   1. loads the request under the RLS system context (cold-start safe —
 *      every fire re-reads the row),
 *   2. builds the provider-neutral snapshot,
 *   3. binds the production ports (LLM provider, pageHuman, Prisma
 *      metrics + escalation marker, repo KB, ops flag store),
 *   4. runs the triage decision.
 *
 * The caller decides what to do with the outcome:
 *   - escalated   → relay the honest escalation reply; SKIP the draft path
 *     (a human owns it). Already paged + marked here.
 *   - auto-answered → relay the grounded reply; SKIP the draft path.
 *   - auto-resolved → stage the bounded action; SKIP the draft path.
 *   - drafted     → fall through to the existing SUPPORT_HANDLER_REPLY_DRAFT
 *     path (self-routing floor).
 *
 * Per feedback_no_silent_vendor_lock.md: no vendor SDK here. The LLM goes
 * through getLlmProvider() (the rotation/paused/budget stack), the page
 * through lib/ops/page-human, the DB through the RLS context.
 */

import { withSystemContext } from '../../db';
import { getLlmProvider } from '../../llm';
import { pageHuman } from '../../ops/page-human';
import { PrismaOpsFlagStore } from '../../ops/prisma-flag-store';
import { servicePartnerForWorkspace } from '../../onboarding/service-partner';
import { skillError } from '../types';
import type { ComposedGateOutcomes } from '../bounded-execute';
import { runTriage } from './triage';
import { RepoKbLoader } from './kb-loader';
import {
  PrismaEscalationMarker,
  PrismaTriageMetricsSink,
} from './prisma-bindings';
import type {
  IEscalationMarker,
  IKbLoader,
  ITriageMetricsSink,
  Pager,
  SupportMessageSnapshot,
  TriageResult,
} from './types';
import type { LlmProvider } from '../../llm/types';
import type { OpsFlagStore } from '../../ops/flag-store';

export interface RunTriageForRequestInput {
  supportRequestId: string;
  /** Standing gates already evaluated by the caller for this fire
   *  (gateSkillFire + billing-pause). Threaded in, never re-queried. */
  gates: ComposedGateOutcomes;
  /** Test overrides — production omits all of these. */
  llm?: LlmProvider;
  kb?: IKbLoader;
  store?: OpsFlagStore;
  pager?: Pager;
  metrics?: ITriageMetricsSink;
  escalationMarker?: IEscalationMarker;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}

export async function runTriageForRequest(
  input: RunTriageForRequestInput,
): Promise<TriageResult> {
  const snapshot = await loadSnapshot(input.supportRequestId);
  if (!snapshot) {
    return skillError(
      'NOT_APPLICABLE',
      `SupportRequest ${input.supportRequestId} not found (deleted between submit and triage?)`,
    );
  }

  return runTriage({
    message: snapshot,
    kb: input.kb ?? new RepoKbLoader(),
    // getLlmProvider() returns the composed stack (rotation/paused/budget).
    // The triage layer treats a thrown/PAUSED provider as degraded.
    llm: input.llm ?? getLlmProvider(),
    store: input.store ?? new PrismaOpsFlagStore(),
    pager: input.pager ?? pageHuman,
    metrics: input.metrics ?? new PrismaTriageMetricsSink(),
    escalationMarker: input.escalationMarker ?? new PrismaEscalationMarker(),
    gates: input.gates,
    env: input.env,
    now: input.now,
  });
}

async function loadSnapshot(
  supportRequestId: string,
): Promise<SupportMessageSnapshot | null> {
  const row = await withSystemContext((tx) =>
    tx.supportRequest.findUnique({
      where: { id: supportRequestId },
      select: {
        id: true,
        workspaceId: true,
        subject: true,
        body: true,
        createdAt: true,
        workspace: { select: { name: true, vertical: true } },
        fromUser: { select: { email: true, name: true } },
      },
    }),
  );
  if (!row) return null;
  return {
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
  };
}
