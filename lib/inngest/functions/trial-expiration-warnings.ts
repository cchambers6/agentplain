// Daily 06:00 ET cron: find TRIALING Subscriptions whose trial ends in
// 7 / 3 / 1 days and emit one transactional email per threshold per
// subscription (lastTrialWarningDays guards against double-fire).
//
// Per feedback_no_silent_vendor_lock + project_no_outbound_architecture:
// agentplain agents do NOT send outbound on a customer's behalf, but a
// product-side transactional billing notice to the broker-owner's own
// inbox is in scope — same shape Stripe sends invoice receipts directly.
// Resend access flows through the lib/email/ adapter, not direct SDK.
//
// Inngest's `cron` runs in UTC. "0 10 * * *" = 06:00 ET during EDT,
// 05:00 ET during EST — close enough to "morning ET" for the daily
// warning cadence; tighten to a TZ-aware schedule when we move to
// timezone-aware customer comms.

import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { getEmailProvider } from "@/lib/email";
import { withSystemContext as defaultWithSystemContext } from "@/lib/db";
import type { SystemContextRunner } from "@/lib/billing/provisioning";
import type { EmailProvider } from "@/lib/email";
import {
  TRIAL_WARNING_THRESHOLDS_DAYS,
  monthlyChargeUsdCents,
  tierFromVerticalTier,
} from "@/lib/pricing/tiers";
import { inngest } from "../client";
import { runWithDisableGate } from "../run-with-disable-gate";

export const TRIAL_WARNINGS_FUNCTION_ID = "agentplain-trial-warnings";
export const TRIAL_WARNINGS_CRON = "0 10 * * *";

interface CandidateSubscription {
  workspaceId: string;
  workspaceName: string;
  brokerOwnerEmail: string;
  workspaceSlug: string;
  subscriptionId: string;
  trialEndsAt: Date;
  daysRemaining: number;
  threshold: number;
  tierLabel: string;
  perSeatCents: number;
  seats: number;
  totalCents: number;
}

export async function findTrialWarningCandidates(
  now: Date = new Date(),
  systemContext: SystemContextRunner = defaultWithSystemContext,
): Promise<CandidateSubscription[]> {
  return systemContext(async (tx) => {
    const trialing = await tx.subscription.findMany({
      where: {
        status: "TRIALING" satisfies SubscriptionStatus,
        trialEndsAt: { not: null },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            memberships: {
              where: { role: "BROKER_OWNER", status: "ACTIVE" },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { user: { select: { email: true } } },
            },
          },
        },
      },
    });
    // Smallest-first scan so a row at e.g. 2 days picks the 3-day threshold
    // (not the 7-day threshold). TRIAL_WARNING_THRESHOLDS_DAYS is declared
    // 7→1 for human readability; the threshold-match scan needs 1→7.
    const ascendingThresholds = [...TRIAL_WARNING_THRESHOLDS_DAYS].sort(
      (a, b) => a - b,
    );
    const out: CandidateSubscription[] = [];
    for (const sub of trialing) {
      if (!sub.trialEndsAt) continue;
      const days = Math.ceil(
        (sub.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );
      const threshold = ascendingThresholds.find((t) => days <= t);
      if (threshold === undefined) continue;
      // Don't re-fire for the same or smaller threshold (smaller =
      // already warned at a more-urgent threshold than this).
      if (
        sub.lastTrialWarningDays !== null &&
        sub.lastTrialWarningDays <= threshold
      ) {
        continue;
      }
      const brokerEmail = sub.workspace?.memberships[0]?.user.email ?? null;
      if (!brokerEmail || !sub.workspace) continue;
      const tier = tierFromVerticalTier(sub.tier);
      const charge = monthlyChargeUsdCents(tier, sub.seats);
      out.push({
        workspaceId: sub.workspace.id,
        workspaceName: sub.workspace.name,
        workspaceSlug: sub.workspace.slug,
        brokerOwnerEmail: brokerEmail,
        subscriptionId: sub.id,
        trialEndsAt: sub.trialEndsAt,
        daysRemaining: Math.max(0, days),
        threshold,
        tierLabel: `agentplain ${capitalize(tier)}`,
        perSeatCents: charge.perSeatCents,
        seats: sub.seats,
        totalCents: charge.totalCents,
      });
    }
    return out;
  });
}

export async function emitTrialWarning(
  candidate: CandidateSubscription,
  appOrigin: string,
  opts?: {
    email?: EmailProvider;
    systemContext?: SystemContextRunner;
  },
): Promise<void> {
  const email = opts?.email ?? getEmailProvider();
  const systemContext = opts?.systemContext ?? defaultWithSystemContext;
  const billingUrl = `${appOrigin.replace(/\/$/, "")}/app/workspace/${candidate.workspaceId}/settings/billing`;
  const days = candidate.daysRemaining;
  const dayLabel =
    days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`;
  const subject = `agentplain trial ends ${dayLabel}`;
  const html = renderHtml({ candidate, billingUrl, dayLabel });
  const text = renderText({ candidate, billingUrl, dayLabel });
  await email.send({
    to: candidate.brokerOwnerEmail,
    subject,
    html,
    text,
    tags: {
      kind: "trial_warning",
      workspace_id: candidate.workspaceId,
      threshold: String(candidate.threshold),
    },
  });

  await systemContext(async (tx) => {
    await tx.subscription.update({
      where: { id: candidate.subscriptionId },
      data: { lastTrialWarningDays: candidate.threshold },
    });
    await tx.auditLog.create({
      data: {
        workspaceId: candidate.workspaceId,
        action: "billing.trial_warning_sent",
        targetTable: "Subscription",
        targetId: candidate.subscriptionId,
        payload: {
          thresholdDays: candidate.threshold,
          daysRemaining: candidate.daysRemaining,
          brokerOwnerEmail: candidate.brokerOwnerEmail,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });
}

export const trialExpirationWarningsFn = inngest.createFunction(
  {
    id: TRIAL_WARNINGS_FUNCTION_ID,
    name: "agentplain trial-end warnings",
    triggers: [{ cron: TRIAL_WARNINGS_CRON }],
  },
  async () => {
    const gate = await runWithDisableGate(TRIAL_WARNINGS_FUNCTION_ID, async () => {
      const candidates = await findTrialWarningCandidates();
      const origin = process.env.APP_PUBLIC_ORIGIN ?? "http://localhost:3000";
      let sent = 0;
      for (const c of candidates) {
        try {
          await emitTrialWarning(c, origin);
          sent++;
        } catch (err) {
          console.error(
            `trial warning failed for ${c.brokerOwnerEmail}`,
            err,
          );
        }
      }
      return { candidates: candidates.length, sent };
    });
    return gate;
  },
);

function renderHtml(args: {
  candidate: CandidateSubscription;
  billingUrl: string;
  dayLabel: string;
}): string {
  const { candidate, billingUrl, dayLabel } = args;
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif; color:#2A2620; background:#F4EEE3; padding:32px;">
  <h2 style="font-weight:500; color:#2A2620;">Your agentplain trial ends ${escapeHtml(dayLabel)}.</h2>
  <p>You're on <strong>${escapeHtml(candidate.tierLabel)}</strong> — ${candidate.seats} seat${candidate.seats === 1 ? "" : "s"} at ${formatCents(candidate.perSeatCents)}/seat/mo. After ${escapeHtml(dayLabel)}, your card on file will be charged ${formatCents(candidate.totalCents)} on a monthly cycle.</p>
  <p>If you haven't added a card yet, your fleet pauses when the trial ends. Add one in under a minute:</p>
  <p><a href="${billingUrl}" style="display:inline-block; padding:12px 20px; background:#2A2620; color:#F4EEE3; text-decoration:none; font-weight:500;">Open billing</a></p>
  <p style="font-size:13px; color:#5A5D62;">Month-to-month. Cancel any time from the same page.</p>
  <p style="font-size:13px; color:#5A5D62;">— agentplain</p>
</body></html>`;
}

function renderText(args: {
  candidate: CandidateSubscription;
  billingUrl: string;
  dayLabel: string;
}): string {
  const { candidate, billingUrl, dayLabel } = args;
  return `Your agentplain trial ends ${dayLabel}.

You're on ${candidate.tierLabel} — ${candidate.seats} seat(s) at ${formatCents(candidate.perSeatCents)}/seat/mo. After ${dayLabel}, your card on file will be charged ${formatCents(candidate.totalCents)} on a monthly cycle.

Open billing: ${billingUrl}

Month-to-month. Cancel any time.

— agentplain`;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
