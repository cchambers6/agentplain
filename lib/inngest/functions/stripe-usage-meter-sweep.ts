/**
 * Inngest cron: Stripe usage-meter daily sweep.
 *
 * Runs once per day at 07:00 UTC (03:00 ET — Conner's spec). On each
 * pass it scans `LlmUsageRecord` for rows where `stripeReportedAt IS
 * NULL`, sums the period's micro-cents per workspace, and POSTs one
 * Billing Meter Event per workspace to Stripe. Successfully reported
 * rows are stamped `stripeReportedAt = now` so the next pass starts
 * with a smaller backlog.
 *
 * The sweep is env-gated: until `STRIPE_USAGE_METER_ENABLED=true` AND
 * `STRIPE_USAGE_METER_EVENT_NAME` is set, NO Stripe call goes out and
 * the rows stay unreported. The customer-facing usage pane (see
 * `app/(product)/app/workspace/[id]/settings/billing/UsagePanel.tsx`)
 * accurately reads "tracked but not yet metered" in that state — the
 * cron and the UI agree.
 *
 * Per `feedback_cold_start_safe_agents`: durable state on every fire.
 * No caching of which workspaces "owe" a meter between fires — the
 * `stripeReportedAt` column is the source of truth.
 *
 * Per `project_no_outbound_architecture`: this cron emits to Stripe
 * (a financial billing surface), NOT to customers. Customer
 * notifications about usage stay in-app.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import {
  withInngestErrorReporting,
} from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';
import { runStripeMeterSweep } from '@/lib/billing/usage/stripe-meter';

export const STRIPE_USAGE_METER_SWEEP_FUNCTION_ID =
  'agentplain-stripe-usage-meter-sweep';
/** Daily at 07:00 UTC (03:00 ET, accounting for ET being UTC-4 in DST;
 *  Inngest crons are UTC). Quiet hour for both Stripe and our customers
 *  so any rate-limit retry has clear runway before workday traffic. */
export const STRIPE_USAGE_METER_SWEEP_CRON = '0 7 * * *';
/** On-demand trigger for dev-console smoke-testing. */
export const STRIPE_USAGE_METER_SWEEP_TRIGGER_EVENT =
  'agentplain/stripe-usage-meter-sweep.requested';

export const stripeUsageMeterSweepFn = inngest.createFunction(
  {
    id: STRIPE_USAGE_METER_SWEEP_FUNCTION_ID,
    name: 'agentplain stripe usage-meter daily sweep',
    triggers: [
      { cron: STRIPE_USAGE_METER_SWEEP_CRON },
      { event: STRIPE_USAGE_METER_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(STRIPE_USAGE_METER_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: STRIPE_USAGE_METER_SWEEP_FUNCTION_ID,
          schedule: STRIPE_USAGE_METER_SWEEP_CRON,
          checkinMargin: 10,
          maxRuntime: 15,
        },
        () =>
          withInngestErrorReporting(
            { functionId: STRIPE_USAGE_METER_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: STRIPE_USAGE_METER_SWEEP_FUNCTION_ID,
              });
              logger.info('stripe-usage-meter sweep started');
              const out = await runStripeMeterSweep();
              logger.info('stripe-usage-meter sweep finished', {
                considered: out.workspacesConsidered,
                reported: out.workspacesReported,
                skipped_no_customer: out.workspacesSkippedNoCustomer,
                skipped_no_usage: out.workspacesSkippedNoUsage,
                skipped_disabled: out.workspacesSkippedDisabled,
                micro_cents_reported: String(out.microCentsReported),
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
