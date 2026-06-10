/**
 * Inngest cron: retry-queue resume backstop (pfd-2 integration self-heal).
 *
 * The PRIMARY resume trigger is the daily integration-health sweep, which
 * flushes a workspace+provider's queue the instant that integration recovers
 * (HEALTHY transition). This cron is the BACKSTOP: it sweeps the whole queue on
 * a slow timer so a row never sits forever if a recovery transition was missed
 * (e.g. an integration that recovered between health checks, or a row enqueued
 * against a provider the health sweep didn't probe that day).
 *
 * It runs every 6 hours across ALL providers, re-running eligible PENDING/HELD
 * rows whose backoff has elapsed, and dead-letters rows past the attempt/age
 * cap — paging a human (warn) on each dead-letter so a stuck customer action is
 * never silent.
 *
 * Cold-start safe: reads durable rows on every fire.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';
import { pageHuman as defaultPageHuman } from '@/lib/ops/page-human';
import {
  resumeRetryableActions,
  type ResumeResult,
} from '@/lib/integrations/retry-queue';
import {
  buildRetryHandlerRegistry,
} from '@/lib/integrations/retry-handlers';
import type { RetryHandlerRegistry } from '@/lib/integrations/retry-queue';

export const RETRY_QUEUE_RESUME_SWEEP_FUNCTION_ID =
  'agentplain-retry-queue-resume-sweep';
/** Every 6 hours. The daily health sweep is the fast path; this is the net. */
export const RETRY_QUEUE_RESUME_SWEEP_CRON = '0 */6 * * *';
export const RETRY_QUEUE_RESUME_REQUESTED_EVENT =
  'agentplain/retry-queue-resume.requested';

export interface RetryResumeBackstopDeps {
  registry?: RetryHandlerRegistry;
  page?: typeof defaultPageHuman;
  now?: Date;
}

export async function runRetryQueueResumeBackstop(
  deps: RetryResumeBackstopDeps = {},
): Promise<ResumeResult> {
  const registry = deps.registry ?? buildRetryHandlerRegistry();
  const page = deps.page ?? defaultPageHuman;
  const now = deps.now ?? new Date();

  return resumeRetryableActions({
    registry,
    now,
    onDeadLetter: (row, reason) =>
      page({
        severity: 'warn',
        summary: `Queued ${row.actionKind} dead-lettered (${row.provider})`,
        details:
          `A retryable action (${row.actionKind}, ${row.provider}) for workspace ` +
          `${row.workspaceId} dead-lettered after the backstop sweep: ${reason}. ` +
          `idempotencyKey=${row.idempotencyKey}. The customer sees a note on their ` +
          `integrations page; a human should confirm whether the work needs to be ` +
          `re-done manually.`,
        source: 'retry-queue-resume-backstop',
        workspaceId: row.workspaceId,
      }),
  });
}

export const retryQueueResumeSweepFn = inngest.createFunction(
  {
    id: RETRY_QUEUE_RESUME_SWEEP_FUNCTION_ID,
    name: 'agentplain retry queue resume backstop',
    triggers: [
      { cron: RETRY_QUEUE_RESUME_SWEEP_CRON },
      { event: RETRY_QUEUE_RESUME_REQUESTED_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(RETRY_QUEUE_RESUME_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: RETRY_QUEUE_RESUME_SWEEP_FUNCTION_ID,
          schedule: RETRY_QUEUE_RESUME_SWEEP_CRON,
          checkinMargin: 15,
          maxRuntime: 30,
        },
        () =>
          withInngestErrorReporting(
            { functionId: RETRY_QUEUE_RESUME_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: RETRY_QUEUE_RESUME_SWEEP_FUNCTION_ID,
              });
              logger.info('retry queue resume backstop started');
              try {
                const out = await runRetryQueueResumeBackstop();
                logger.info('retry queue resume backstop finished', {
                  considered: out.considered,
                  resolved: out.resolved,
                  retried: out.retried,
                  dead: out.dead.length,
                  no_handler: out.noHandler,
                });
                return out;
              } catch (err) {
                reportInngestItemFailure(err, {
                  functionId: RETRY_QUEUE_RESUME_SWEEP_FUNCTION_ID,
                });
                throw err;
              }
            },
          ),
      ),
    ),
);
