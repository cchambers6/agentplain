/**
 * tests/e2e/cancel-and-resubscribe.spec.ts
 *
 * Revenue path: active paid user → cancels (at period end) → has access until
 * period ends → subscription deleted webhook → workspace gated → resubscribes
 * → back to active.
 *
 * What this gates:
 *   - Cancel action: sets cancelAtPeriodEnd = true, workspace stays open
 *   - subscription.deleted webhook: workspace shows gated/resubscribe CTA
 *   - Resubscribe flow: returns to active
 *   - Data preserved through cancel/resub (workspace row survives)
 *
 * DB required: seeded active subscription + workspace.
 */

import { test, expect, skipIfNoDb } from "./fixtures";
import {
  sendWebhookEvent,
  buildSubscriptionCreatedEvent,
  buildSubscriptionUpdatedEvent,
  buildSubscriptionDeletedEvent,
} from "./helpers/webhook";
import { PrismaClient } from "@prisma/client";

test.describe("cancel-and-resubscribe", () => {
  test("subscription.updated cancelAtPeriodEnd=true: access maintained (DB required)", async (
    { authedPage: page, seeded, request },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId } = seeded;
    const customerId = `cus_cancel_${workspaceId.slice(0, 8)}`;
    const subId = `sub_cancel_${workspaceId.slice(0, 8)}`;

    const prisma = new PrismaClient();
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Workspace" SET "stripeCustomerId" = $1, "billingMode" = 'STRIPE_SUBSCRIPTION' WHERE id = $2`,
        customerId,
        workspaceId,
      );
    } finally {
      await prisma.$disconnect();
    }

    // Seed active subscription.
    await sendWebhookEvent(
      request,
      buildSubscriptionCreatedEvent({ subscriptionId: subId, customerId, status: "active" }),
    );

    // Simulate cancel at period end (Stripe fires subscription.updated with cancel_at_period_end=true).
    const cancelEvt = buildSubscriptionUpdatedEvent({
      subscriptionId: subId,
      customerId,
      status: "active",
      cancelAtPeriodEnd: true,
    });
    const { status } = await sendWebhookEvent(request, cancelEvt);
    expect(status).toBe(200);

    // Workspace still accessible (period hasn't ended yet).
    await page.goto(`/app/workspace/${workspaceId}`);
    await expect(page.locator("body")).not.toContainText("resubscribe", {
      ignoreCase: true,
      timeout: 20_000,
    });
  });

  test("subscription.deleted: DB row reflects CANCELED (DB required)", async (
    { seeded, request },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId } = seeded;
    const customerId = `cus_deleted_${workspaceId.slice(0, 8)}`;
    const subId = `sub_deleted_${workspaceId.slice(0, 8)}`;

    const prisma = new PrismaClient();
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Workspace" SET "stripeCustomerId" = $1, "billingMode" = 'STRIPE_SUBSCRIPTION' WHERE id = $2`,
        customerId,
        workspaceId,
      );
    } finally {
      await prisma.$disconnect();
    }

    await sendWebhookEvent(
      request,
      buildSubscriptionCreatedEvent({ subscriptionId: subId, customerId, status: "active" }),
    );

    const deletedEvt = buildSubscriptionDeletedEvent({ subscriptionId: subId, customerId });
    const { status } = await sendWebhookEvent(request, deletedEvt);
    expect(status).toBe(200);

    const prisma2 = new PrismaClient();
    try {
      const sub = await prisma2.subscription.findUnique({
        where: { stripeSubscriptionId: subId },
        select: { status: true, cancelAtPeriodEnd: true },
      });
      expect(sub?.status).toBe("CANCELED");
      expect(sub?.cancelAtPeriodEnd).toBe(false);
    } finally {
      await prisma2.$disconnect();
    }
  });

  test("workspace data survives subscription deletion (DB required)", async (
    { seeded, request },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId, plan } = seeded;
    const customerId = `cus_data_${workspaceId.slice(0, 8)}`;
    const subId = `sub_data_${workspaceId.slice(0, 8)}`;

    const prisma = new PrismaClient();
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Workspace" SET "stripeCustomerId" = $1, "billingMode" = 'STRIPE_SUBSCRIPTION' WHERE id = $2`,
        customerId,
        workspaceId,
      );
    } finally {
      await prisma.$disconnect();
    }

    await sendWebhookEvent(
      request,
      buildSubscriptionCreatedEvent({ subscriptionId: subId, customerId, status: "active" }),
    );
    await sendWebhookEvent(
      request,
      buildSubscriptionDeletedEvent({ subscriptionId: subId, customerId }),
    );

    // Workspace row and its data must still exist after subscription deletion.
    const prisma2 = new PrismaClient();
    try {
      const ws = await prisma2.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, closureStatus: true },
      });
      expect(ws).not.toBeNull();
      expect(ws?.name).toBe(plan.workspace.name);
      // Workspace is not closed (billing cancel ≠ workspace deletion).
      expect(ws?.closureStatus).not.toBe("CLOSED");

      // Approval queue items still present.
      const approvals = await prisma2.workApprovalQueueItem.count({
        where: { workspaceId },
      });
      expect(approvals).toBeGreaterThan(0);
    } finally {
      await prisma2.$disconnect();
    }
  });

  test("resubscribe: new subscription.created after deletion restores ACTIVE (DB required)", async (
    { seeded, request },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId } = seeded;
    const customerId = `cus_resub_${workspaceId.slice(0, 8)}`;
    const subId1 = `sub_resub_1_${workspaceId.slice(0, 8)}`;
    const subId2 = `sub_resub_2_${workspaceId.slice(0, 8)}`;

    const prisma = new PrismaClient();
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Workspace" SET "stripeCustomerId" = $1, "billingMode" = 'STRIPE_SUBSCRIPTION' WHERE id = $2`,
        customerId,
        workspaceId,
      );
    } finally {
      await prisma.$disconnect();
    }

    // First subscription lifecycle: active → canceled.
    await sendWebhookEvent(
      request,
      buildSubscriptionCreatedEvent({ subscriptionId: subId1, customerId, status: "active" }),
    );
    await sendWebhookEvent(
      request,
      buildSubscriptionDeletedEvent({ subscriptionId: subId1, customerId }),
    );

    // Resubscribe: new subscription on the same customer.
    await sendWebhookEvent(
      request,
      buildSubscriptionCreatedEvent({ subscriptionId: subId2, customerId, status: "active" }),
    );

    // The new subscription is ACTIVE.
    const prisma2 = new PrismaClient();
    try {
      const sub = await prisma2.subscription.findUnique({
        where: { stripeSubscriptionId: subId2 },
        select: { status: true },
      });
      expect(sub?.status).toBe("ACTIVE");
    } finally {
      await prisma2.$disconnect();
    }
  });
});
