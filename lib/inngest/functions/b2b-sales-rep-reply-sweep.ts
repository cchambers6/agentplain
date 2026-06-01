/**
 * B2B sales rep — daily reply sweep. Ported from flatsbo on 2026-05-29.
 * See b2b-ceo-daily.ts header for full context on the move + stub posture.
 *
 * Cron: '0 21 * * *' (17:00 ET during EDT).
 * Disable flag: INNGEST_FN_DISABLE_B2B_SALES_REP_REPLY_SWEEP.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';

export const B2B_SALES_REP_REPLY_SWEEP_FUNCTION_ID =
  'b2b-sales-rep-reply-sweep';
export const B2B_SALES_REP_REPLY_SWEEP_CRON = '0 21 * * *';

export interface B2bSalesRepReplySweepResult {
  status: 'pending-runner-port';
  reason: string;
}

export async function runB2bSalesRepReplySweep(): Promise<B2bSalesRepReplySweepResult> {
  return {
    status: 'pending-runner-port',
    reason:
      'b2b-sales-rep-reply-sweep moved from flatsbo on 2026-05-29; ' +
      'CronDefinition runner pending port.',
  };
}

export const b2bSalesRepReplySweepFn = inngest.createFunction(
  {
    id: B2B_SALES_REP_REPLY_SWEEP_FUNCTION_ID,
    name: 'B2B sales rep — daily reply sweep (stub, awaiting runner port)',
    triggers: [{ cron: B2B_SALES_REP_REPLY_SWEEP_CRON }],
  },
  async () =>
    runWithDisableGate(B2B_SALES_REP_REPLY_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: B2B_SALES_REP_REPLY_SWEEP_FUNCTION_ID,
          schedule: B2B_SALES_REP_REPLY_SWEEP_CRON,
          checkinMargin: 15,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: B2B_SALES_REP_REPLY_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: B2B_SALES_REP_REPLY_SWEEP_FUNCTION_ID,
              });
              const out = await runB2bSalesRepReplySweep();
              logger.info('b2b-sales-rep-reply-sweep stub fired', {
                status: out.status,
                reason: out.reason,
              });
              return out;
            },
          ),
      ),
    ),
);
