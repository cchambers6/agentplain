// Daily 07:00-ET cron: PAST_DUE dunning. Walks every PAST_DUE
// subscription, sends the failed-payment recovery emails (at fail / +7d /
// +14d), and hard-gates (suspends) a subscription once its grace window
// is exhausted. All decision + send logic lives in lib/billing/dunning.ts
// so it's unit-testable without Inngest; this file is the schedule + the
// disable-gate + cron-monitor + error-reporting wrappers, matching
// trial-expiration-warnings.ts.
//
// Gated on STRIPE_BILLING_ENABLED: when billing is off (the default,
// pre-launch) there are no PAST_DUE subscriptions anyway, but we skip the
// sweep entirely so it never touches Stripe state before activation.
//
// Inngest's `cron` runs in UTC. "0 11 * * *" = 07:00 ET during EDT —
// one hour after the trial-warning sweep so the two billing emails don't
// land in the same minute.

import { withSystemContext as defaultWithSystemContext } from "@/lib/db";
import { env } from "@/lib/env";
import { runDunningSweep } from "@/lib/billing/dunning";
import { getLogger, withCronMonitor } from "@/lib/observability";
import { inngest } from "../client";
import { runWithDisableGate } from "../run-with-disable-gate";
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from "../with-error-reporting";

export const DUNNING_SWEEP_FUNCTION_ID = "agentplain-stripe-dunning-sweep";
export const DUNNING_SWEEP_CRON = "0 11 * * *";

export const stripeDunningSweepFn = inngest.createFunction(
  {
    id: DUNNING_SWEEP_FUNCTION_ID,
    name: "agentplain PAST_DUE dunning sweep",
    triggers: [{ cron: DUNNING_SWEEP_CRON }],
  },
  async () =>
    runWithDisableGate(DUNNING_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        { slug: DUNNING_SWEEP_FUNCTION_ID, schedule: DUNNING_SWEEP_CRON },
        () =>
          withInngestErrorReporting(
            { functionId: DUNNING_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: "inngest",
                function_id: DUNNING_SWEEP_FUNCTION_ID,
              });

              if (!env.stripeBillingEnabled()) {
                logger.info("dunning sweep skipped — STRIPE_BILLING_ENABLED off");
                return { skipped: true as const };
              }

              const origin =
                process.env.APP_PUBLIC_ORIGIN ?? "http://localhost:3000";
              logger.info("dunning sweep started");

              const result = await runDunningSweep({
                systemContext: defaultWithSystemContext,
                appOrigin: origin,
                onItemError: (candidate, err) => {
                  reportInngestItemFailure(err, {
                    functionId: DUNNING_SWEEP_FUNCTION_ID,
                    extraTags: {
                      workspace_id: candidate.workspaceId,
                      subscription_id: candidate.subscriptionId,
                    },
                  });
                  logger.error("dunning item failed", err, {
                    workspace_id: candidate.workspaceId,
                    subscription_id: candidate.subscriptionId,
                  });
                },
              });

              logger.info("dunning sweep finished", {
                candidates: result.candidates,
                emails_sent: result.emailsSent,
                hard_gated: result.hardGated,
                noops: result.noops,
              });
              return result;
            },
          ),
      ),
    ),
);
