"use server";

// Server action for the /operator/workspaces tier override surface.
//
// Flips Workspace.verticalTier — and the workspace's Subscription.tier
// when one exists — to a new tier, with an AuditLog row capturing the
// change. Stripe state is intentionally untouched:
//
//   * MAX overrides are the most common case (Max is quote-based per
//     `project_stripe_both_surfaces.md` 2026-05-15 — no Stripe Product
//     to swap to). The override marks the workspace as Max so the
//     customer billing surface renders the Max card; invoicing happens
//     out of band via manual invoicing.
//
//   * Regular/Partner overrides (e.g. operator-driven mid-engagement
//     re-classification) DO leave the existing Stripe Subscription in
//     place. Operator is expected to reconcile via the customer-side
//     change-plan flow or Stripe dashboard.
//
// Per `feedback_no_quick_fixes.md` the right shape is a separate
// reconciliation flow rather than auto-canceling Stripe here — that's
// the next PR. This action is bounded: DB state + audit only.
//
// Per `feedback_no_silent_vendor_lock.md` this file does NOT import the
// Stripe SDK directly. All Stripe coupling lives behind
// `lib/billing/getBillingProvider()`.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  TIER_ORDER,
  verticalTierFromTier,
  type TierName,
} from "@/lib/pricing/tiers";
import {
  BUDGET_SETTINGS_KEY,
  resolveBudgetCapUsd,
  withBudgetCapUsd,
} from "@/lib/billing/budget";

export async function overrideWorkspaceTierAction(
  formData: FormData,
): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  const rawTier = String(formData.get("tier") ?? "").toLowerCase();
  if (!workspaceId) {
    throw new Error("workspaceId is required.");
  }
  if (!(TIER_ORDER as readonly string[]).includes(rawTier)) {
    throw new Error(`Unknown tier "${rawTier}".`);
  }
  const targetTier = rawTier as TierName;
  const targetEnum = verticalTierFromTier(targetTier);

  await withSystemContext(async (tx) => {
    const existing = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, verticalTier: true, slug: true },
    });
    if (!existing) {
      throw new Error(`Workspace ${workspaceId} not found.`);
    }
    if (existing.verticalTier === targetEnum) {
      // No-op overrides still get audited so operator intent is durable.
      await tx.auditLog.create({
        data: {
          actorUserId: session.userId,
          workspaceId,
          action: "operator.workspace_tier_noop",
          targetTable: "Workspace",
          targetId: workspaceId,
          payload: {
            tier: targetEnum,
          } satisfies Prisma.InputJsonValue,
        },
      });
      return;
    }
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { verticalTier: targetEnum },
    });
    // Mirror onto the Subscription row when one exists so the customer's
    // billing page reads the new tier consistently. We don't touch the
    // Stripe-side fields (stripeSubscriptionId, status, etc.) — that's
    // the reconciliation flow's job.
    const sub = await tx.subscription.findUnique({
      where: { workspaceId },
      select: { id: true },
    });
    if (sub) {
      await tx.subscription.update({
        where: { workspaceId },
        data: { tier: targetEnum },
      });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        workspaceId,
        action: "operator.workspace_tier_override",
        targetTable: "Workspace",
        targetId: workspaceId,
        payload: {
          fromTier: existing.verticalTier,
          toTier: targetEnum,
          subscriptionAlsoUpdated: Boolean(sub),
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath("/operator/workspaces");
  redirect(
    `/operator/workspaces?flash=ok&workspaceId=${encodeURIComponent(workspaceId)}&to=${encodeURIComponent(targetTier)}`,
  );
}

// Apply (or clear) a workspace's EXPLICIT monthly token cap from the operator
// deep-dive. This is the only cap the LLM budget gate throttles on — the
// "recommended cap" surfaced in the UI (MRR × 0.30, lib/billing/recommendations.ts)
// is advisory until an operator applies it here. An empty `capUsd` clears the
// cap (workspace returns to NO_CAP — never throttled).
//
// The cap is stored on Workspace.settings.tokenBudgetUsdMonthly via the shared
// `withBudgetCapUsd` merge helper so other settings keys are preserved. Every
// change writes an AuditLog row (durable operator intent), mirroring the tier
// override above. Stripe is untouched — this is a usage-governor setting, not
// a billing change.
export async function applyBudgetCapAction(
  formData: FormData,
): Promise<void> {
  const session = await requireUser();
  if (!session.isOperator) {
    throw new Error("Forbidden — operator only.");
  }
  const workspaceId = String(formData.get("workspaceId") ?? "").trim();
  if (!workspaceId) {
    throw new Error("workspaceId is required.");
  }
  const rawCap = String(formData.get("capUsd") ?? "").trim();
  let capUsd: number | null = null;
  if (rawCap !== "") {
    const parsed = Number(rawCap);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid cap "${rawCap}".`);
    }
    // 0 (or blank) clears the cap; any positive value sets it.
    capUsd = parsed > 0 ? Math.round(parsed) : null;
  }

  await withSystemContext(async (tx) => {
    const existing = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, settings: true },
    });
    if (!existing) {
      throw new Error(`Workspace ${workspaceId} not found.`);
    }
    const previousCap = resolveBudgetCapUsd(existing.settings, null);
    const nextSettings = withBudgetCapUsd(existing.settings, capUsd);
    await tx.workspace.update({
      where: { id: workspaceId },
      data: { settings: nextSettings as Prisma.InputJsonValue },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: session.userId,
        workspaceId,
        action: "operator.workspace_budget_cap_set",
        targetTable: "Workspace",
        targetId: workspaceId,
        payload: {
          settingsKey: BUDGET_SETTINGS_KEY,
          fromCapUsd: previousCap,
          toCapUsd: capUsd,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  revalidatePath(`/operator/workspaces/${workspaceId}`);
  revalidatePath("/operator/workspaces");
}
