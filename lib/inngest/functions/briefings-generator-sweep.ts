/**
 * Inngest cron: daily briefings generator sweep.
 *
 * Runs `0 13 * * 1-5` (Mon–Fri 13:00 UTC ≈ 09:00 ET; honest about DST
 * drift — we use UTC, not a TZ-aware schedule, so EST mornings land at
 * 08:00 and EDT mornings at 09:00). For each ACTIVE workspace whose
 * `WorkspacePreference.briefingsMutedAt` is NULL:
 *
 *   1. Generate today's briefing via
 *      `lib/skills/briefing-generator#generateBriefingForWorkspace`.
 *   2. If the row was newly inserted (idempotency guard), send a
 *      lightweight transactional email to the broker-owner with a
 *      deep link to the briefings page.
 *   3. Stamp `WorkspaceBriefing.emailedAt` so a same-day cron retry
 *      doesn't re-send.
 *
 * Honesty concession: the per-workspace generation is a single LLM
 * call. At launch scale (handful of workspaces) the daily fan-out is
 * cheap; at hundreds of workspaces this becomes a per-call cost worth
 * batching. Documented in PR #122 description so the next wave can
 * fold in a budget-aware path.
 *
 * Per `project_no_outbound_architecture.md`: notification email is
 * product-side transactional (agentplain → broker-owner inbox), same
 * scope as the trial-warning email.
 *
 * Per `feedback_cold_start_safe_agents.md`: every fire reads durable
 * state. No in-memory cache across the cron tick.
 *
 * Per `feedback_runner_portability.md`: the workspace lister + the
 * per-workspace generator + the email sender are injectable so the
 * sweep tests don't need Postgres / Anthropic / Resend.
 */

import { withSystemContext } from '@/lib/db/rls';
import { env } from '@/lib/env';
import {
  generateBriefingForWorkspace,
  type GenerateBriefingForWorkspaceResult,
} from '@/lib/skills/briefing-generator';
import { notifyBriefingReady } from '@/lib/skills/briefing-generator/email';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const BRIEFINGS_GENERATOR_SWEEP_FUNCTION_ID =
  'agentplain-briefings-generator-sweep';
/** Mon–Fri 13:00 UTC (≈ 09:00 ET; we accept DST drift between 08:00
 *  EST and 09:00 EDT — the daily cadence is "morning ET", not a hard
 *  SLA). */
export const BRIEFINGS_GENERATOR_SWEEP_CRON = '0 13 * * 1-5';
/** On-demand trigger for dev-console smoke-testing. */
export const BRIEFINGS_GENERATOR_SWEEP_TRIGGER_EVENT =
  'agentplain/briefings-generator-sweep.requested';

export interface BriefingsSweepResult {
  workspacesConsidered: number;
  briefingsWritten: number;
  briefingsAlreadyExisted: number;
  workspacesMuted: number;
  notificationsSent: number;
  failures: Array<{ workspaceId: string; reason: string }>;
}

interface SweepWorkspaceCandidate {
  id: string;
  name: string;
  brokerOwnerEmail: string | null;
  briefingsMutedAt: Date | null;
}

export interface RunBriefingsSweepArgs {
  listCandidates?: () => Promise<SweepWorkspaceCandidate[]>;
  generate?: typeof generateBriefingForWorkspace;
  notify?: typeof notifyBriefingReady;
  now?: Date;
  appOrigin?: string;
}

export async function runBriefingsSweep(
  args: RunBriefingsSweepArgs = {},
): Promise<BriefingsSweepResult> {
  const list = args.listCandidates ?? defaultListCandidates;
  const generate = args.generate ?? generateBriefingForWorkspace;
  const notify = args.notify ?? notifyBriefingReady;
  const now = args.now ?? new Date();
  const appOrigin = args.appOrigin ?? env.appPublicOrigin();

  const candidates = await list();
  const result: BriefingsSweepResult = {
    workspacesConsidered: candidates.length,
    briefingsWritten: 0,
    briefingsAlreadyExisted: 0,
    workspacesMuted: 0,
    notificationsSent: 0,
    failures: [],
  };

  for (const ws of candidates) {
    if (ws.briefingsMutedAt) {
      result.workspacesMuted += 1;
      continue;
    }

    let outcome: GenerateBriefingForWorkspaceResult;
    try {
      outcome = await generate({ workspaceId: ws.id, now });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: BRIEFINGS_GENERATOR_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'generate' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
      continue;
    }

    if (!outcome.inserted) {
      result.briefingsAlreadyExisted += 1;
      continue;
    }
    result.briefingsWritten += 1;

    if (!ws.brokerOwnerEmail || !outcome.briefingId) {
      // No broker-owner to email yet, or the row didn't materialize
      // (PERMISSION corner case the generator surfaces as briefingId=null).
      continue;
    }

    try {
      await notify({
        brokerOwnerEmail: ws.brokerOwnerEmail,
        workspaceName: ws.name,
        workspaceId: ws.id,
        briefingId: outcome.briefingId,
        summary: outcome.summary,
        appOrigin,
      });
      await withSystemContext(async (tx) => {
        await tx.workspaceBriefing.update({
          where: { id: outcome.briefingId! },
          data: { emailedAt: now },
        });
      });
      result.notificationsSent += 1;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      reportInngestItemFailure(err, {
        functionId: BRIEFINGS_GENERATOR_SWEEP_FUNCTION_ID,
        extraTags: { workspace_id: ws.id, phase: 'notify' },
      });
      result.failures.push({ workspaceId: ws.id, reason });
    }
  }
  return result;
}

async function defaultListCandidates(): Promise<SweepWorkspaceCandidate[]> {
  return withSystemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: {
        closureStatus: 'ACTIVE',
        memberships: { some: { status: 'ACTIVE', role: 'BROKER_OWNER' } },
      },
      select: {
        id: true,
        name: true,
        preference: { select: { briefingsMutedAt: true } },
        memberships: {
          where: { status: 'ACTIVE', role: 'BROKER_OWNER' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { email: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      brokerOwnerEmail: ws.memberships[0]?.user.email ?? null,
      briefingsMutedAt: ws.preference?.briefingsMutedAt ?? null,
    }));
  });
}

export const briefingsGeneratorSweepFn = inngest.createFunction(
  {
    id: BRIEFINGS_GENERATOR_SWEEP_FUNCTION_ID,
    name: 'agentplain briefings generator (daily Mon–Fri ~09:00 ET)',
    triggers: [
      { cron: BRIEFINGS_GENERATOR_SWEEP_CRON },
      { event: BRIEFINGS_GENERATOR_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(BRIEFINGS_GENERATOR_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: BRIEFINGS_GENERATOR_SWEEP_FUNCTION_ID,
          schedule: BRIEFINGS_GENERATOR_SWEEP_CRON,
          // Daily cadence — give the monitor generous margin so a slow
          // workspace fan-out doesn't trip false-positives.
          checkinMargin: 15,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: BRIEFINGS_GENERATOR_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: BRIEFINGS_GENERATOR_SWEEP_FUNCTION_ID,
              });
              logger.info('briefings generator sweep started');
              const out = await runBriefingsSweep();
              logger.info('briefings generator sweep finished', {
                considered: out.workspacesConsidered,
                briefings_written: out.briefingsWritten,
                already_existed: out.briefingsAlreadyExisted,
                muted: out.workspacesMuted,
                notifications_sent: out.notificationsSent,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
