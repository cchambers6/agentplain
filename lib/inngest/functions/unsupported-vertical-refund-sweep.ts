/**
 * Inngest cron: unsupported-vertical leak-path auto-refund sweep (pfd-4).
 *
 * Daily sweep that finds paying workspaces in an UNSUPPORTED vertical
 * (registry truth), aged past the grace window, with ZERO value delivered,
 * and either auto-refunds them (when UNSUPPORTED_VERTICAL_AUTO_REFUND=on)
 * or — by default — pages a human in detect-only mode.
 *
 * Wrapped in `runWithDisableGate` so an operator can pause it from the
 * OpsFlag table on the next tick (same control plane as every other cron).
 *
 * Cadence: daily at 17:00 UTC (1pm ET) — an hour after the abandoned-signup
 * sweep so the two lifecycle sweeps don't contend.
 *
 * Per feedback_cold_start_safe_agents: stateless. Every fire re-reads
 * candidates + the once-per-lifetime guard from Postgres.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';
import { runUnsupportedVerticalRefundSweep } from '@/lib/billing/unsupported-vertical-refund';

export const UNSUPPORTED_VERTICAL_REFUND_SWEEP_FUNCTION_ID =
  'agentplain-unsupported-vertical-refund-sweep';
/** Daily at 17:00 UTC (1pm ET). One decision per workspace per day; the
 *  once-per-lifetime OpsFlag guard prevents re-processing. */
export const UNSUPPORTED_VERTICAL_REFUND_SWEEP_CRON = '0 17 * * *';
export const UNSUPPORTED_VERTICAL_REFUND_SWEEP_TRIGGER_EVENT =
  'agentplain/unsupported-vertical-refund-sweep.requested';

export const unsupportedVerticalRefundSweepFn = inngest.createFunction(
  {
    id: UNSUPPORTED_VERTICAL_REFUND_SWEEP_FUNCTION_ID,
    name: 'agentplain unsupported-vertical leak-path auto-refund sweep',
    triggers: [
      { cron: UNSUPPORTED_VERTICAL_REFUND_SWEEP_CRON },
      { event: UNSUPPORTED_VERTICAL_REFUND_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(UNSUPPORTED_VERTICAL_REFUND_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: UNSUPPORTED_VERTICAL_REFUND_SWEEP_FUNCTION_ID,
          schedule: UNSUPPORTED_VERTICAL_REFUND_SWEEP_CRON,
          checkinMargin: 15,
          maxRuntime: 120,
        },
        () =>
          withInngestErrorReporting(
            { functionId: UNSUPPORTED_VERTICAL_REFUND_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: UNSUPPORTED_VERTICAL_REFUND_SWEEP_FUNCTION_ID,
              });
              logger.info('unsupported-vertical refund sweep started');
              const out = await runUnsupportedVerticalRefundSweep();
              logger.info('unsupported-vertical refund sweep finished', {
                considered: out.workspacesConsidered,
                refunded: out.refunded,
                detectOnlyPaged: out.detectOnlyPaged,
                overCapPaged: out.overCapPaged,
                refundFailedPaged: out.refundFailedPaged,
                alreadyHandled: out.alreadyHandled,
                noCharges: out.noCharges,
                totalRefundedUsdCents: out.totalRefundedUsdCents,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
