// PAST_DUE dunning — failed-payment recovery with a grace period.
//
// When a renewal invoice fails, Stripe fires `invoice.payment_failed` and
// our webhook flips the Subscription to PAST_DUE (lib/billing/webhook-
// dispatch.ts). This module owns what happens NEXT:
//
//   1. The fleet KEEPS RUNNING through the end of the period the customer
//      already paid for (the grace window). The read-time gate
//      (lib/billing/workspace-paused-gate.ts) honors the same window, so
//      a failed renewal never cuts service mid-period.
//   2. Three escalating failed-payment emails go to the broker-owner's
//      inbox — at fail (day 0), +7 days, and +14 days — each a friendly
//      "here's how to fix it" with a link to /settings/billing.
//   3. Once the grace window is exhausted (the paid-through date passes)
//      the subscription is HARD-GATED: status flips to PAUSED, which the
//      gate treats as "skill fires paused until billing is current".
//
// Per project_no_outbound_architecture: a product-side transactional
// billing notice to the customer's OWN inbox is in scope (same shape as
// Stripe's own receipts) — agents still never send outbound on the
// customer's behalf. Per feedback_no_silent_vendor_lock the Resend call
// goes through the lib/email/ adapter.
//
// Per feedback_cold_start_safe_agents: this sweep holds NO in-memory
// state. Which dunning stage a subscription has reached is DERIVED every
// run from durable rows — the earliest `invoice.payment_failed`
// BillingEvent (when the dunning clock started) and the
// `billing.dunning_email_sent` AuditLog rows (which stages already
// fired). That keeps the feature zero-migration and idempotent: a
// re-run on the same day re-derives the same state and no-ops.

import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { getEmailProvider } from "@/lib/email";
import type { EmailProvider } from "@/lib/email";
import { withSystemContext as defaultWithSystemContext } from "@/lib/db";
import type { SystemContextRunner } from "@/lib/billing/provisioning";
import {
  monthlyChargeUsdCents,
  tierFromVerticalTier,
} from "@/lib/pricing/tiers";

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Stages ────────────────────────────────────────────────────────────

export type DunningStage = "FAIL" | "D7" | "D14";

/** Days after the FIRST failed payment that each email fires. */
export const DUNNING_STAGE_DAYS: Record<DunningStage, number> = {
  FAIL: 0,
  D7: 7,
  D14: 14,
};

/** Escalation order — index = severity. A stage is "covered" once any
 *  equal-or-higher stage has been sent, so a sweep that missed a day
 *  sends only the most-urgent reached email instead of a burst. */
export const DUNNING_STAGE_ORDER: readonly DunningStage[] = [
  "FAIL",
  "D7",
  "D14",
];

// ─── Candidate + action shapes ─────────────────────────────────────────

export interface DunningCandidate {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  brokerOwnerEmail: string;
  /** Subscription ROW id (not the Stripe id). */
  subscriptionId: string;
  status: SubscriptionStatus;
  /** Paid-through date — the grace-window boundary. Null when Stripe
   *  never gave us a period anchor (treated as past-grace). */
  currentPeriodEnd: Date | null;
  /** Earliest `invoice.payment_failed` for this subscription — the
   *  dunning clock's t0. */
  firstFailedAt: Date;
  /** Dunning stages already emailed (from AuditLog). */
  stagesSent: readonly DunningStage[];
  /** Monthly charge for the copy ("$X is past due"). */
  amountUsdCents: number;
}

export type DunningAction =
  | { kind: "send"; stage: DunningStage }
  | { kind: "hard_gate" }
  | { kind: "noop"; reason: string };

// ─── Decision ──────────────────────────────────────────────────────────

const stageIndex = (s: DunningStage): number => DUNNING_STAGE_ORDER.indexOf(s);

/** True once any equal-or-higher-severity stage has been emailed. */
function isStageCovered(
  stage: DunningStage,
  sent: readonly DunningStage[],
): boolean {
  const target = stageIndex(stage);
  return sent.some((s) => stageIndex(s) >= target);
}

/** The most-urgent stage whose day threshold the clock has reached. */
function reachedStage(daysSinceFail: number): DunningStage | null {
  let reached: DunningStage | null = null;
  for (const s of DUNNING_STAGE_ORDER) {
    if (daysSinceFail >= DUNNING_STAGE_DAYS[s]) reached = s;
  }
  return reached;
}

/**
 * Decide the single action for one PAST_DUE subscription this run.
 *
 * Priority:
 *   1. If the most-urgent reached stage hasn't been covered → send it.
 *   2. Else, if the grace window is exhausted and the row is still
 *      PAST_DUE → hard-gate (suspend). (Runs the day AFTER the final
 *      email at the earliest — the email always goes first.)
 *   3. Else → noop.
 */
export function decideDunningAction(
  candidate: DunningCandidate,
  now: Date,
): DunningAction {
  if (candidate.status !== "PAST_DUE") {
    return { kind: "noop", reason: `status=${candidate.status} — not dunning` };
  }

  const daysSinceFail = Math.floor(
    (now.getTime() - candidate.firstFailedAt.getTime()) / DAY_MS,
  );
  const reached = reachedStage(daysSinceFail);
  if (reached && !isStageCovered(reached, candidate.stagesSent)) {
    return { kind: "send", stage: reached };
  }

  // Grace exhausted when the paid-through date has passed. A null anchor
  // is fail-closed to "exhausted" so a subscription Stripe never gave us
  // a period for still gets suspended once the emails are done.
  const graceExhausted =
    candidate.currentPeriodEnd === null || now >= candidate.currentPeriodEnd;
  if (graceExhausted) {
    return { kind: "hard_gate" };
  }

  return {
    kind: "noop",
    reason: `within grace through ${candidate.currentPeriodEnd?.toISOString() ?? "unknown"}; all reached stages covered`,
  };
}

// ─── Candidate gathering ───────────────────────────────────────────────

export async function findDunningCandidates(
  now: Date = new Date(),
  systemContext: SystemContextRunner = defaultWithSystemContext,
): Promise<DunningCandidate[]> {
  return systemContext(async (tx) => {
    const pastDue = await tx.subscription.findMany({
      where: { status: "PAST_DUE" satisfies SubscriptionStatus },
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

    const out: DunningCandidate[] = [];
    for (const sub of pastDue) {
      const brokerEmail = sub.workspace?.memberships[0]?.user.email ?? null;
      if (!brokerEmail || !sub.workspace) continue;

      // t0 = earliest payment-failure BillingEvent for this subscription.
      // Fall back to "now" when none is recorded yet (the failure that
      // flipped the status may not have minted a BillingEvent we can find)
      // so the FAIL email still fires this run.
      const firstFail = await tx.billingEvent.findFirst({
        where: {
          subscriptionId: sub.id,
          type: "invoice.payment_failed",
        },
        orderBy: { receivedAt: "asc" },
        select: { receivedAt: true },
      });
      const firstFailedAt = firstFail?.receivedAt ?? now;

      const sentRows = await tx.auditLog.findMany({
        where: {
          action: "billing.dunning_email_sent",
          targetId: sub.id,
        },
        select: { payload: true },
      });
      const stagesSent = sentRows
        .map((r) => readStage(r.payload))
        .filter((s): s is DunningStage => s !== null);

      const tier = tierFromVerticalTier(sub.tier);
      const charge = monthlyChargeUsdCents(tier, sub.seats);

      out.push({
        workspaceId: sub.workspace.id,
        workspaceName: sub.workspace.name,
        workspaceSlug: sub.workspace.slug,
        brokerOwnerEmail: brokerEmail,
        subscriptionId: sub.id,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        firstFailedAt,
        stagesSent,
        amountUsdCents: charge.totalCents,
      });
    }
    return out;
  });
}

function readStage(payload: Prisma.JsonValue | null): DunningStage | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const stage = (payload as Record<string, unknown>).stage;
  if (stage === "FAIL" || stage === "D7" || stage === "D14") return stage;
  return null;
}

// ─── Action execution ──────────────────────────────────────────────────

export interface EmitDunningActionOpts {
  email?: EmailProvider;
  systemContext?: SystemContextRunner;
  appOrigin?: string;
}

export async function emitDunningAction(
  candidate: DunningCandidate,
  action: DunningAction,
  opts: EmitDunningActionOpts = {},
): Promise<void> {
  if (action.kind === "noop") return;
  const systemContext = opts.systemContext ?? defaultWithSystemContext;

  if (action.kind === "hard_gate") {
    await systemContext(async (tx) => {
      await tx.subscription.update({
        where: { id: candidate.subscriptionId },
        data: { status: "PAUSED" satisfies SubscriptionStatus },
      });
      await tx.auditLog.create({
        data: {
          workspaceId: candidate.workspaceId,
          action: "billing.subscription.suspended_past_due",
          targetTable: "Subscription",
          targetId: candidate.subscriptionId,
          payload: {
            currentPeriodEnd: candidate.currentPeriodEnd?.toISOString() ?? null,
            firstFailedAt: candidate.firstFailedAt.toISOString(),
          } satisfies Prisma.InputJsonValue,
        },
      });
    });
    return;
  }

  // action.kind === "send"
  const email = opts.email ?? getEmailProvider();
  const origin = (opts.appOrigin ?? "http://localhost:3000").replace(/\/$/, "");
  const billingUrl = `${origin}/app/workspace/${candidate.workspaceId}/settings/billing`;
  const copy = renderDunningEmail({
    candidate,
    stage: action.stage,
    billingUrl,
  });

  await email.send({
    to: candidate.brokerOwnerEmail,
    subject: copy.subject,
    html: copy.html,
    text: copy.text,
    tags: {
      kind: "dunning",
      stage: action.stage,
      workspace_id: candidate.workspaceId,
    },
  });

  await systemContext(async (tx) => {
    await tx.auditLog.create({
      data: {
        workspaceId: candidate.workspaceId,
        action: "billing.dunning_email_sent",
        targetTable: "Subscription",
        targetId: candidate.subscriptionId,
        payload: {
          stage: action.stage,
          brokerOwnerEmail: candidate.brokerOwnerEmail,
          firstFailedAt: candidate.firstFailedAt.toISOString(),
        } satisfies Prisma.InputJsonValue,
      },
    });
  });
}

// ─── Sweep runner ──────────────────────────────────────────────────────

export interface RunDunningSweepDeps {
  now?: Date;
  email?: EmailProvider;
  systemContext?: SystemContextRunner;
  appOrigin?: string;
  /** Injected for tests; live caller uses `findDunningCandidates`. */
  findCandidates?: (
    now: Date,
    systemContext: SystemContextRunner,
  ) => Promise<DunningCandidate[]>;
  /** Per-candidate failure hook so one bad row doesn't abort the sweep. */
  onItemError?: (candidate: DunningCandidate, err: unknown) => void;
}

export interface RunDunningSweepResult {
  candidates: number;
  emailsSent: number;
  hardGated: number;
  noops: number;
}

export async function runDunningSweep(
  deps: RunDunningSweepDeps = {},
): Promise<RunDunningSweepResult> {
  const now = deps.now ?? new Date();
  const systemContext = deps.systemContext ?? defaultWithSystemContext;
  const find = deps.findCandidates ?? findDunningCandidates;

  const candidates = await find(now, systemContext);
  let emailsSent = 0;
  let hardGated = 0;
  let noops = 0;

  for (const candidate of candidates) {
    const action = decideDunningAction(candidate, now);
    if (action.kind === "noop") {
      noops++;
      continue;
    }
    try {
      await emitDunningAction(candidate, action, {
        email: deps.email,
        systemContext,
        appOrigin: deps.appOrigin,
      });
      if (action.kind === "send") emailsSent++;
      else hardGated++;
    } catch (err) {
      deps.onItemError?.(candidate, err);
    }
  }

  return {
    candidates: candidates.length,
    emailsSent,
    hardGated,
    noops,
  };
}

// ─── Email rendering ───────────────────────────────────────────────────

interface RenderArgs {
  candidate: DunningCandidate;
  stage: DunningStage;
  billingUrl: string;
}

const STAGE_SUBJECT: Record<DunningStage, string> = {
  FAIL: "Your agentplain payment didn't go through",
  D7: "Still need a card update to keep your fleet running",
  D14: "Last reminder: update your card to avoid a pause",
};

function graceLine(candidate: DunningCandidate): string {
  if (!candidate.currentPeriodEnd) {
    return "Your fleet keeps running for now, but please update your card to avoid a pause.";
  }
  return `Your fleet keeps running through ${formatDate(candidate.currentPeriodEnd)} — after that, agents pause until billing is current.`;
}

export function renderDunningEmail(args: RenderArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const { candidate, stage, billingUrl } = args;
  const subject = STAGE_SUBJECT[stage];
  const amount = formatCents(candidate.amountUsdCents);
  const grace = graceLine(candidate);

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif; color:#1A1A1F; background:#F7F4ED; padding:32px;">
  <h2 style="font-weight:500; color:#1A1A1F;">We couldn't process your last payment.</h2>
  <p>Your most recent ${escapeHtml(amount)} invoice for <strong>${escapeHtml(candidate.workspaceName)}</strong> didn't go through. It happens — usually an expired card or a bank hold.</p>
  <p>${escapeHtml(grace)}</p>
  <p>Fixing it takes under a minute — add or update your card here:</p>
  <p><a href="${billingUrl}" style="display:inline-block; padding:12px 20px; background:#1A1A1F; color:#F7F4ED; text-decoration:none; font-weight:500;">Update payment method</a></p>
  <p style="font-size:13px; color:#726A5E;">Once your card is updated we retry automatically — nothing else for you to do.</p>
  <p style="font-size:13px; color:#726A5E;">Plaino, your service partner at agentplain</p>
  <p style="font-size:12px; color:#726A5E; margin-top:24px;">You're receiving this because you have an agentplain workspace.</p>
</body></html>`;

  const text = `We couldn't process your last payment.

Your most recent ${amount} invoice for ${candidate.workspaceName} didn't go through. It happens — usually an expired card or a bank hold.

${grace}

Update your card (under a minute): ${billingUrl}

Once your card is updated we retry automatically — nothing else for you to do.

Plaino, your service partner at agentplain

You're receiving this because you have an agentplain workspace.`;

  return { subject, html, text };
}

// ─── Formatting ────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
