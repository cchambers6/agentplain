/**
 * Inngest cron: quarterly credential-test sweep.
 *
 * Bar (the "if Conner died tomorrow" test): a fleet-global key (Stripe,
 * Resend, Anthropic) can silently expire and break EVERY customer at once,
 * with no customer or operator the wiser until something visibly breaks. This
 * cron exercises each configured global key with the CHEAPEST read-only call
 * the vendor offers (through the existing adapters), and:
 *   - 401/invalid → pages a human (critical) AND writes a fleet-wide
 *     OPS_CREDENTIAL_HEALTH_<PROVIDER> ops flag so the operator UI surfaces the
 *     dead key + the customer-facing reconnect/restore prompt path fires.
 *   - healthy → clears any stale unhealthy flag for that provider.
 *   - not configured → skipped cleanly + reported (NO page — an unset key in
 *     this environment is expected, not a failure).
 *
 * Special case — Resend: testing the email key by SENDING an email is
 * self-referential (the channel we'd PAGE through is the very thing under
 * test). So we probe Resend with its cheapest authenticated READ
 * (domains.list), and when Resend is the dead key, the OPS_CREDENTIAL_HEALTH
 * flag row is the loud-fail artifact the operator UI reads — because paging by
 * email is impossible when email is down. We still CALL pageHuman (it persists
 * an AuditLog row even when its own email send fails), so there are TWO durable
 * records of a dead Resend key, neither of which depends on email working.
 *
 * Scope note (honest): this checks GLOBAL env keys only. Per-workspace customer
 * credentials (Buildium, Qualia, Gmail, …) are NOT global keys — they're
 * already covered by lib/inngest/functions/integration-renewal-sweep.ts (which
 * marks a credential REVOKED/EXPIRED and triggers that workspace's reconnect
 * prompt). Re-probing them here would duplicate that loop. Qualia/Buildium are
 * reported as "not a fleet key — covered by the renewal sweep" so the cron's
 * report is honest about what it does and does not verify.
 *
 * Quarterly schedule + manually triggerable via the
 * agentplain/ops.credential-test.requested event.
 *
 * Cold-start safe (feedback_cold_start_safe_agents): reads keys from env on
 * every fire; no in-memory health cache.
 */

import { inngest } from "../client";
import { runWithDisableGate } from "../run-with-disable-gate";
import {
  reportInngestItemFailure,
  withInngestErrorReporting,
} from "../with-error-reporting";
import { getLogger, withCronMonitor } from "@/lib/observability";
import { pageHuman as defaultPageHuman } from "@/lib/ops/page-human";
import {
  LiveCredentialProbes,
  type CredentialProbes,
  type ProbeOutcome,
  type ProbeProvider,
} from "@/lib/ops/credential-probes";
import { PrismaOpsFlagStore } from "@/lib/ops/prisma-flag-store";
import type { OpsFlagStore } from "@/lib/ops/flag-store";

export const CREDENTIAL_TEST_SWEEP_FUNCTION_ID = "agentplain-credential-test-sweep";
/** First day of each quarter at 08:00 UTC. Manually triggerable any time. */
export const CREDENTIAL_TEST_SWEEP_CRON = "0 8 1 1,4,7,10 *";
export const CREDENTIAL_TEST_REQUESTED_EVENT = "agentplain/ops.credential-test.requested";

/** OpsFlag name for a provider's last-observed health. `invalid` = the key the
 *  vendor rejected; absent/`healthy` = fine. The operator UI + the customer
 *  reconnect/restore prompt read this flag. Mirrors the env-var-name-as-flag
 *  convention used by the disable gate. */
export function credentialHealthFlagName(provider: ProbeProvider): string {
  return `OPS_CREDENTIAL_HEALTH_${provider}`;
}

/** A 24h restore deadline — the bar's hard ceiling for a paged human. */
const RESTORE_DEADLINE_MS = 24 * 60 * 60 * 1000;

export interface CredentialSweepReport {
  outcomes: ProbeOutcome[];
  paged: ProbeProvider[];
  disabled: ProbeProvider[];
  /** Providers that are per-workspace, not fleet keys — reported, not probed. */
  perWorkspaceNotProbed: string[];
}

export interface CredentialSweepDeps {
  probes?: CredentialProbes;
  flagStore?: OpsFlagStore;
  page?: typeof defaultPageHuman;
  now?: Date;
}

/**
 * The testable core. Probes each global key; pages + disables on invalid;
 * clears stale flags on healthy. Never throws — a probe that itself errors is
 * captured in the report.
 */
export async function runCredentialTestSweep(
  deps: CredentialSweepDeps = {},
): Promise<CredentialSweepReport> {
  const probes = deps.probes ?? new LiveCredentialProbes();
  const flagStore = deps.flagStore ?? new PrismaOpsFlagStore();
  const page = deps.page ?? defaultPageHuman;
  const now = deps.now ?? new Date();

  const outcomes: ProbeOutcome[] = [
    await probes.probeStripe(),
    await probes.probeResend(),
    await probes.probeAnthropic(),
  ];

  const report: CredentialSweepReport = {
    outcomes,
    paged: [],
    disabled: [],
    perWorkspaceNotProbed: [
      "BUILDIUM (per-workspace — covered by integration-renewal-sweep)",
      "QUALIA (per-workspace — covered by integration-renewal-sweep)",
    ],
  };

  for (const outcome of outcomes) {
    if (outcome.status === "invalid") {
      await handleInvalid(outcome, { flagStore, page, now });
      report.paged.push(outcome.provider);
      report.disabled.push(outcome.provider);
    } else if (outcome.status === "healthy") {
      // Clear any stale unhealthy flag so a recovered key un-disables itself.
      await flagStore.set(credentialHealthFlagName(outcome.provider), "healthy", {
        updatedBy: "system:credential-test-sweep",
        note: `verified healthy ${now.toISOString()}`,
      });
    }
    // not_configured / transient → no flag write, no page (an unset key is
    // expected; a transient blip is not a key failure and would false-page).
  }

  return report;
}

async function handleInvalid(
  outcome: Extract<ProbeOutcome, { status: "invalid" }>,
  ctx: { flagStore: OpsFlagStore; page: typeof defaultPageHuman; now: Date },
): Promise<void> {
  const { provider, detail } = outcome;

  // 1) Auto-disable cleanly: write the fleet-wide health flag the operator UI
  //    reads. For a GLOBAL key there is no per-workspace IntegrationCredential
  //    row to flip — the flag IS the disable + the reconnect-prompt trigger.
  await ctx.flagStore.set(credentialHealthFlagName(provider), "invalid", {
    updatedBy: "system:credential-test-sweep",
    note: `vendor rejected the key (${detail}) at ${ctx.now.toISOString()}`,
  });

  // 2) Page a human (critical, 24h). For Resend, pageHuman's own email send may
  //    itself fail (that's the very key that's dead) — but pageHuman ALSO
  //    persists an AuditLog row, and the OpsFlag above is the loud-fail
  //    artifact, so the dead Resend key is recorded twice without email.
  const resendCaveat =
    provider === "RESEND"
      ? "\n\nNOTE: Resend is the key that failed, so THIS email itself may not " +
        "have reached you. The fleet recorded the failure as an " +
        `OpsFlag (${credentialHealthFlagName(provider)}=invalid) + an AuditLog ` +
        "row — check /operator for the loud-fail artifact."
      : "";

  await ctx.page({
    severity: "critical",
    summary: `${provider} key invalid — vendor rejected the credential`,
    details:
      `The quarterly credential-test sweep got a hard auth failure from ${provider}.\n\n` +
      `Detail: ${detail}\n\n` +
      `Customer impact: ${customerImpact(provider)}\n\n` +
      `To restore: rotate a healthy key into the ${envVarFor(provider)} env var in ` +
      `Vercel Production and redeploy. The next sweep (or a manual trigger) clears ` +
      `the ${credentialHealthFlagName(provider)} flag once the key verifies healthy.` +
      resendCaveat,
    deadline: new Date(ctx.now.getTime() + RESTORE_DEADLINE_MS),
    source: "credential-test-sweep",
  });
}

function customerImpact(provider: ProbeProvider): string {
  switch (provider) {
    case "STRIPE":
      return "Billing is down — no new subscriptions, no card capture, no invoices. Customers can use the product but cannot pay or upgrade.";
    case "RESEND":
      return "Transactional email is down — trial-end warnings, support replies, and operator pages do not reach customers.";
    case "ANTHROPIC":
      return "LLM-backed skills + Plaino degrade to the calm 'briefly offline' copy (the key-rotation layer handles the live failover).";
  }
}

function envVarFor(provider: ProbeProvider): string {
  switch (provider) {
    case "STRIPE":
      return "STRIPE_SECRET_KEY";
    case "RESEND":
      return "RESEND_API_KEY";
    case "ANTHROPIC":
      return "ANTHROPIC_API_KEY";
  }
}

export const credentialTestSweepFn = inngest.createFunction(
  {
    id: CREDENTIAL_TEST_SWEEP_FUNCTION_ID,
    name: "agentplain credential test sweep",
    triggers: [
      { cron: CREDENTIAL_TEST_SWEEP_CRON },
      { event: CREDENTIAL_TEST_REQUESTED_EVENT },
    ],
  },
  async () =>
    runWithDisableGate(CREDENTIAL_TEST_SWEEP_FUNCTION_ID, () =>
      withCronMonitor(
        {
          slug: CREDENTIAL_TEST_SWEEP_FUNCTION_ID,
          schedule: CREDENTIAL_TEST_SWEEP_CRON,
        },
        () =>
          withInngestErrorReporting(
            { functionId: CREDENTIAL_TEST_SWEEP_FUNCTION_ID },
            async () => {
              const logger = getLogger().child({
                boundary: "inngest",
                function_id: CREDENTIAL_TEST_SWEEP_FUNCTION_ID,
              });
              logger.info("credential test sweep started");
              try {
                const report = await runCredentialTestSweep();
                logger.info("credential test sweep finished", {
                  outcomes: report.outcomes.map((o) => ({
                    provider: o.provider,
                    status: o.status,
                  })),
                  paged: report.paged,
                  disabled: report.disabled,
                });
                return report;
              } catch (err) {
                // The core is no-throw by design, but a defensive catch keeps a
                // probe-layer surprise from crashing the cron silently.
                reportInngestItemFailure(err, {
                  functionId: CREDENTIAL_TEST_SWEEP_FUNCTION_ID,
                });
                throw err;
              }
            },
          ),
      ),
    ),
);
