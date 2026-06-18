// Every-6-hours cron: for each workspace with a token budget set, check
// whether month-to-date or today's spend has crossed a new 50% / 75% / 90%
// threshold and email the owner ONE heads-up if so. A per-dimension, per-
// period watermark in Workspace.settings guarantees at most one email per
// threshold per period — no double-fire across sweeps.
//
// This is the WARNING LIGHT that pairs with the hard GATE in
// lib/billing/budget.ts (which blocks new LLM calls at 100% — the structural
// auto-pause). See lib/billing/budget-alerts.ts for the pure threshold +
// dedup logic; this file is the only IO caller.
//
// Per feedback_no_silent_vendor_lock + project_no_outbound_architecture:
// product-side transactional notice to the owner's own inbox, via the
// lib/email/ adapter — same shape as the trial-end warning. Inngest cron runs
// in UTC; budget windows are UTC, so the period keys line up.

import type { Prisma } from '@prisma/client';
import { getEmailProvider } from '@/lib/email';
import type { EmailProvider } from '@/lib/email';
import { withSystemContext } from '@/lib/db';
import {
  getWorkspaceDualBudgetSnapshot,
  resolveBudgetCapUsd,
  resolveDailyBudgetCapUsd,
} from '@/lib/billing/budget';
import {
  composeBudgetAlertEmail,
  evaluateWorkspaceAlerts,
  readBudgetAlertState,
  withBudgetAlertState,
  type BudgetAlertFire,
} from '@/lib/billing/budget-alerts';
import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const BUDGET_ALERT_FUNCTION_ID = 'agentplain-budget-alerts';
export const BUDGET_ALERT_CRON = '0 */6 * * *';

export interface BudgetAlertCandidate {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
}

/**
 * Find workspaces that have AT LEAST ONE cap set (daily or monthly) and an
 * active owner to notify. Settings is a JSON blob, so the cap filter is done
 * in JS after a single lean query (id + name + settings + first owner email).
 * Closed workspaces are skipped — a budget alert on a closing account is noise.
 */
export async function findBudgetAlertCandidates(
  systemContext = withSystemContext,
): Promise<BudgetAlertCandidate[]> {
  return systemContext(async (tx) => {
    const workspaces = await tx.workspace.findMany({
      where: { closureStatus: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        settings: true,
        memberships: {
          where: { role: 'BROKER_OWNER', status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { email: true } } },
        },
      },
    });
    const out: BudgetAlertCandidate[] = [];
    for (const w of workspaces) {
      const hasCap =
        resolveBudgetCapUsd(w.settings, null) !== null ||
        resolveDailyBudgetCapUsd(w.settings, null) !== null;
      if (!hasCap) continue;
      const ownerEmail = w.memberships[0]?.user.email ?? null;
      if (!ownerEmail) continue;
      out.push({
        workspaceId: w.id,
        workspaceName: w.name,
        ownerEmail,
      });
    }
    return out;
  });
}

/**
 * Evaluate one candidate and, if a new threshold was crossed, send the email
 * and advance the watermark + write an audit row — but ONLY after a successful
 * send, so a transient email failure retries next sweep rather than silently
 * marking the threshold "fired". Returns the fires it sent (empty when none).
 */
export async function emitBudgetAlert(
  candidate: BudgetAlertCandidate,
  appOrigin: string,
  opts?: {
    email?: EmailProvider;
    systemContext?: typeof withSystemContext;
    now?: Date;
  },
): Promise<BudgetAlertFire[]> {
  const email = opts?.email ?? getEmailProvider();
  const systemContext = opts?.systemContext ?? withSystemContext;
  const now = opts?.now ?? new Date();

  const evaluated = await systemContext(async (tx) => {
    const dual = await getWorkspaceDualBudgetSnapshot(tx, {
      workspaceId: candidate.workspaceId,
      now,
    });
    if (!dual) return null;
    const workspace = await tx.workspace.findUnique({
      where: { id: candidate.workspaceId },
      select: { settings: true },
    });
    const prior = readBudgetAlertState(workspace?.settings);
    return { evaluation: evaluateWorkspaceAlerts(dual, prior, now), settings: workspace?.settings };
  });
  if (!evaluated || evaluated.evaluation.fires.length === 0) return [];

  const usageUrl = `${appOrigin.replace(/\/$/, '')}/app/workspace/${candidate.workspaceId}/usage`;
  const { subject, html, text } = composeBudgetAlertEmail({
    workspaceName: candidate.workspaceName,
    fires: evaluated.evaluation.fires,
    usageUrl,
  });
  await email.send({
    to: candidate.ownerEmail,
    subject,
    html,
    text,
    tags: {
      kind: 'budget_alert',
      workspace_id: candidate.workspaceId,
      thresholds: evaluated.evaluation.fires
        .map((f) => `${f.dimension}:${Math.round(f.threshold * 100)}`)
        .join(','),
    },
  });

  // Persist the advanced watermark + audit trail only after the send landed.
  await systemContext(async (tx) => {
    const fresh = await tx.workspace.findUnique({
      where: { id: candidate.workspaceId },
      select: { settings: true },
    });
    await tx.workspace.update({
      where: { id: candidate.workspaceId },
      data: {
        settings: withBudgetAlertState(
          fresh?.settings ?? evaluated.settings ?? {},
          evaluated.evaluation.nextState,
        ) as Prisma.InputJsonValue,
      },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: candidate.workspaceId,
        action: 'billing.budget_alert_sent',
        targetTable: 'Workspace',
        targetId: candidate.workspaceId,
        payload: {
          ownerEmail: candidate.ownerEmail,
          fires: evaluated.evaluation.fires.map((f) => ({
            dimension: f.dimension,
            thresholdPct: Math.round(f.threshold * 100),
            consumedUsd: Math.round(f.status.consumedUsd * 100) / 100,
            capUsd: f.status.capUsdMonthly,
          })),
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  return evaluated.evaluation.fires;
}

export const budgetAlertSweepFn = inngest.createFunction(
  {
    id: BUDGET_ALERT_FUNCTION_ID,
    name: 'agentplain budget alerts (50/75/90%)',
    triggers: [{ cron: BUDGET_ALERT_CRON }],
  },
  async () =>
    runWithDisableGate(BUDGET_ALERT_FUNCTION_ID, () =>
      withCronMonitor(
        { slug: BUDGET_ALERT_FUNCTION_ID, schedule: BUDGET_ALERT_CRON },
        () =>
          withInngestErrorReporting(
            { functionId: BUDGET_ALERT_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: BUDGET_ALERT_FUNCTION_ID,
              });
              const candidates = await findBudgetAlertCandidates();
              const origin =
                process.env.APP_PUBLIC_ORIGIN ?? 'http://localhost:3000';
              logger.info('budget alerts sweep started', {
                candidates: candidates.length,
              });
              let sent = 0;
              for (const c of candidates) {
                try {
                  const fires = await emitBudgetAlert(c, origin);
                  if (fires.length > 0) sent++;
                } catch (err) {
                  reportInngestItemFailure(err, {
                    functionId: BUDGET_ALERT_FUNCTION_ID,
                    extraTags: { workspace_id: c.workspaceId },
                  });
                  logger.error('budget alert send failed', err, {
                    workspace_id: c.workspaceId,
                    owner_email: c.ownerEmail,
                  });
                }
              }
              logger.info('budget alerts sweep finished', {
                candidates: candidates.length,
                sent,
              });
              return { candidates: candidates.length, sent };
            },
          ),
      ),
    ),
);
