/**
 * lib/customer-data/teardown-scheduler.ts
 *
 * The hourly sweep that closes the loop between customer-initiated soft
 * closure (`closure.ts`) and the cascading row purge
 * (`lib/customer-files/deletion.ts#tearDownWorkspaceData`).
 *
 * Why a sweep instead of a delayed Inngest event scheduled at initiation:
 *   1. The customer can cancel during the grace window. The sweep reads
 *      the row each tick — a cancellation flips the row back to ACTIVE
 *      and the sweep silently passes over it. A delayed event would fire
 *      regardless, requiring a guard at the worker; the sweep makes the
 *      guard implicit.
 *   2. The grace window can be extended by support (env override). A
 *      delayed event captured the OLD deadline; the sweep always reads
 *      the current `scheduledHardPurgeAt`.
 *
 * Cron cadence: hourly. The customer's promise is "purged within N days
 * after grace ends"; an hourly worst-case is well inside that envelope
 * and keeps the per-tick batch small.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import { tearDownWorkspaceData } from '@/lib/customer-files/deletion';
import { getKnowledgeStore } from '@/lib/knowledge';
import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db/rls';
import type { IKnowledgeStore } from '@/lib/knowledge/types';
import { getLogger, withCronMonitor } from '@/lib/observability';
import { inngest } from '@/lib/inngest/client';
import { runWithDisableGate } from '@/lib/inngest/run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '@/lib/inngest/with-error-reporting';

export const WORKSPACE_TEARDOWN_SWEEP_FUNCTION_ID =
  'agentplain-workspace-teardown-sweep';

/** Hourly. Inngest cron is in UTC; "0 * * * *" = top of every hour. */
export const WORKSPACE_TEARDOWN_SWEEP_CRON = '0 * * * *';

/** Smoke-test event so the operator can manually fire the sweep without
 *  waiting for the cron tick. */
export const WORKSPACE_TEARDOWN_SWEEP_TRIGGER_EVENT =
  'agentplain/workspace-teardown-sweep.requested';

/** Max workspaces to purge per tick. Hard cap so a backlog scenario can't
 *  exhaust the Inngest run budget; a backlog will drain across ticks. */
export const PER_SWEEP_LIMIT = 25;

type SystemContextRunner = <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

export interface DuePurgeCandidate {
  workspaceId: string;
  workspaceName: string;
  closingInitiatedAt: Date;
  scheduledHardPurgeAt: Date;
}

/**
 * Find workspaces whose grace window has elapsed.
 *   closureStatus = CLOSING
 *   scheduledHardPurgeAt < now
 */
export async function findWorkspacesDueForHardPurge(
  now: Date = new Date(),
  systemContext: SystemContextRunner = defaultWithSystemContext,
  limit: number = PER_SWEEP_LIMIT,
): Promise<DuePurgeCandidate[]> {
  return systemContext(async (tx) => {
    const rows = await tx.workspace.findMany({
      where: {
        closureStatus: 'CLOSING',
        scheduledHardPurgeAt: { lt: now },
      },
      orderBy: { scheduledHardPurgeAt: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        closingInitiatedAt: true,
        scheduledHardPurgeAt: true,
      },
    });
    return rows
      .filter(
        (
          r,
        ): r is {
          id: string;
          name: string;
          closingInitiatedAt: Date;
          scheduledHardPurgeAt: Date;
        } => r.closingInitiatedAt !== null && r.scheduledHardPurgeAt !== null,
      )
      .map((r) => ({
        workspaceId: r.id,
        workspaceName: r.name,
        closingInitiatedAt: r.closingInitiatedAt,
        scheduledHardPurgeAt: r.scheduledHardPurgeAt,
      }));
  });
}

export interface HardPurgeResult {
  workspaceId: string;
  customerEmbeddingsDeleted: number;
  workApprovalsDeleted: number;
  handoffsDeleted: number;
  webhookEventsDeleted: number;
  webhookSubscriptionsDeleted: number;
  integrationCredentialsDeleted: number;
  preferenceSignalsDeleted: number;
  workspacePreferencesDeleted: number;
  inquiriesDeleted: number;
  closedAt: Date;
}

/**
 * Run the cascading delete for one workspace + flip the closure status to
 * CLOSED + write a closing audit row.
 */
export async function hardPurgeWorkspace(args: {
  workspaceId: string;
  now?: Date;
  systemContext?: SystemContextRunner;
  store?: IKnowledgeStore;
}): Promise<HardPurgeResult> {
  const now = args.now ?? new Date();
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const store = args.store ?? getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);

  // Pre-check: only purge workspaces still in CLOSING. A cancellation
  // racing with this call is fine — the read here sees the flip and we
  // bail out without touching any rows.
  const pre = await systemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: args.workspaceId },
      select: { id: true, closureStatus: true },
    }),
  );
  if (!pre) {
    throw new Error(`workspace ${args.workspaceId} not found`);
  }
  if (pre.closureStatus !== 'CLOSING') {
    throw new Error(
      `workspace ${args.workspaceId} is in ${pre.closureStatus}, refusing to purge`,
    );
  }

  const counts = await tearDownWorkspaceData({
    workspaceId: args.workspaceId,
    store,
  });

  await systemContext(async (tx) => {
    await tx.workspace.update({
      where: { id: args.workspaceId },
      data: {
        closureStatus: 'CLOSED',
        closedAt: now,
        scheduledHardPurgeAt: null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: null, // system actor; closingInitiatedByUserId on
        //              the workspace row records the customer who asked.
        workspaceId: args.workspaceId,
        action: 'workspace.closure.hard_purged',
        targetTable: 'Workspace',
        targetId: args.workspaceId,
        payload: {
          // Cast through a generic record — the strongly-typed
          // TearDownWorkspaceDataResult object is JSON-serializable but
          // does not assignment-check against Prisma's `InputJsonValue`
          // recursive shape. The data on the wire is identical.
          counts: counts as unknown as Record<string, number>,
          closedAt: now.toISOString(),
        },
      },
    });
  });

  return {
    workspaceId: args.workspaceId,
    customerEmbeddingsDeleted: counts.customerEmbeddingsDeleted,
    workApprovalsDeleted: counts.workApprovalsDeleted,
    handoffsDeleted: counts.handoffsDeleted,
    webhookEventsDeleted: counts.webhookEventsDeleted,
    webhookSubscriptionsDeleted: counts.webhookSubscriptionsDeleted,
    integrationCredentialsDeleted: counts.integrationCredentialsDeleted,
    preferenceSignalsDeleted: counts.preferenceSignalsDeleted,
    workspacePreferencesDeleted: counts.workspacePreferencesDeleted,
    inquiriesDeleted: counts.inquiriesDeleted,
    closedAt: now,
  };
}

/**
 * Inngest function: hourly sweep. Per memory
 * `feedback_cold_start_safe_agents.md`: every fire re-reads durable
 * state, never relies on prior-tick context.
 */
export const workspaceTeardownSweepFn = inngest.createFunction(
  {
    id: WORKSPACE_TEARDOWN_SWEEP_FUNCTION_ID,
    name: 'agentplain workspace teardown sweep',
    triggers: [
      { cron: WORKSPACE_TEARDOWN_SWEEP_CRON },
      { event: WORKSPACE_TEARDOWN_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(WORKSPACE_TEARDOWN_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: WORKSPACE_TEARDOWN_SWEEP_FUNCTION_ID,
          schedule: WORKSPACE_TEARDOWN_SWEEP_CRON,
        },
        () =>
          withInngestErrorReporting(
            { functionId: WORKSPACE_TEARDOWN_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: WORKSPACE_TEARDOWN_SWEEP_FUNCTION_ID,
              });
              const candidates = await findWorkspacesDueForHardPurge();
              logger.info('workspace teardown sweep started', {
                candidates: candidates.length,
              });
              let purged = 0;
              for (const c of candidates) {
                try {
                  const result = await hardPurgeWorkspace({
                    workspaceId: c.workspaceId,
                  });
                  purged += 1;
                  logger.info('workspace hard-purged', {
                    workspace_id: result.workspaceId,
                    customer_embeddings_deleted:
                      result.customerEmbeddingsDeleted,
                    work_approvals_deleted: result.workApprovalsDeleted,
                    handoffs_deleted: result.handoffsDeleted,
                    webhook_events_deleted: result.webhookEventsDeleted,
                    webhook_subscriptions_deleted:
                      result.webhookSubscriptionsDeleted,
                    integration_credentials_deleted:
                      result.integrationCredentialsDeleted,
                    preference_signals_deleted:
                      result.preferenceSignalsDeleted,
                    workspace_preferences_deleted:
                      result.workspacePreferencesDeleted,
                    inquiries_deleted: result.inquiriesDeleted,
                  });
                } catch (err) {
                  reportInngestItemFailure(err, {
                    functionId: WORKSPACE_TEARDOWN_SWEEP_FUNCTION_ID,
                    extraTags: { workspace_id: c.workspaceId },
                  });
                  logger.error('workspace hard-purge failed', err, {
                    workspace_id: c.workspaceId,
                  });
                }
              }
              logger.info('workspace teardown sweep finished', {
                candidates: candidates.length,
                purged,
              });
              return { candidates: candidates.length, purged };
            },
          ),
      ),
    ),
);
