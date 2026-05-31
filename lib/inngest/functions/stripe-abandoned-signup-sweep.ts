/**
 * Inngest cron: stripe-abandoned-signup sweep.
 *
 * Wave-4 phase 4 — closes the honesty gap PR #123 named: a workspace
 * that signs up + gets a magic link but abandons Stripe Checkout
 * exists with no usable Subscription. Pre-wave-4, the fleet kept
 * running for the customer on the free side until someone noticed.
 *
 * Cadence: daily at 16:00 UTC (noon ET).
 *
 * Per `project_no_outbound_architecture.md`: the nudge email is a
 * product-side transactional billing message (same shape Stripe sends
 * invoice receipts directly), NOT customer-facing outbound from the
 * agent fleet.
 *
 * Per `feedback_cold_start_safe_agents.md`: stateless. Every fire
 * re-reads the candidate set + the prior lifecycle events from
 * Postgres.
 */

import { inngest } from '../client';
import { runWithDisableGate } from '../run-with-disable-gate';
import { withInngestErrorReporting } from '../with-error-reporting';
import { getLogger, withCronMonitor } from '@/lib/observability';
import { runAbandonedSignupSweep } from '@/lib/billing/abandoned-signup';

export const STRIPE_ABANDONED_SIGNUP_SWEEP_FUNCTION_ID =
  'agentplain-stripe-abandoned-signup-sweep';
/** Daily at 16:00 UTC (noon ET). One nudge / deactivate / archive
 *  decision per workspace per day. */
export const STRIPE_ABANDONED_SIGNUP_SWEEP_CRON = '0 16 * * *';
export const STRIPE_ABANDONED_SIGNUP_SWEEP_TRIGGER_EVENT =
  'agentplain/stripe-abandoned-signup-sweep.requested';

export const stripeAbandonedSignupSweepFn = inngest.createFunction(
  {
    id: STRIPE_ABANDONED_SIGNUP_SWEEP_FUNCTION_ID,
    name: 'agentplain Stripe abandoned-signup sweep',
    triggers: [
      { cron: STRIPE_ABANDONED_SIGNUP_SWEEP_CRON },
      { event: STRIPE_ABANDONED_SIGNUP_SWEEP_TRIGGER_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(STRIPE_ABANDONED_SIGNUP_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: STRIPE_ABANDONED_SIGNUP_SWEEP_FUNCTION_ID,
          schedule: STRIPE_ABANDONED_SIGNUP_SWEEP_CRON,
          checkinMargin: 15,
          maxRuntime: 60,
        },
        () =>
          withInngestErrorReporting(
            { functionId: STRIPE_ABANDONED_SIGNUP_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: 'inngest',
                function_id: STRIPE_ABANDONED_SIGNUP_SWEEP_FUNCTION_ID,
              });
              logger.info('abandoned-signup sweep started');
              const out = await runAbandonedSignupSweep();
              logger.info('abandoned-signup sweep finished', {
                considered: out.workspacesConsidered,
                nudges: out.nudgesSent,
                deactivated: out.deactivated,
                archived: out.archived,
                skipped: out.skipped,
                failed: out.failures.length,
              });
              return out;
            },
          ),
      ),
    ),
);
