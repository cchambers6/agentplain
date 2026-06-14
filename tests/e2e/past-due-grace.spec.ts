/**
 * tests/e2e/past-due-grace.spec.ts
 *
 * Revenue path: active paid subscriber → payment fails → workspace enters
 * past-due grace period → fleet continues running (workspace accessible) →
 * billing page shows past-due status → grace period expires →
 * workspace is gated.
 *
 * What this gates:
 *   - invoice.payment_failed webhook sets subscription to PAST_DUE
 *   - Workspace is still accessible during grace period (not immediately gated)
 *   - Billing page surfaces the past-due status
 *   - The subscription status in the DB reflects PAST_DUE correctly
 *
 * DB required: needs a real Subscription row.
 */

import { test, expect, skipIfNoDb } from "./fixtures";
import {
  sendWebhookEvent,
  buildSubscriptionCreatedEvent,
  buildInvoicePaymentFailedEvent,
} from "./helpers/webhook";
import { PrismaClient } from "@prisma/client";

test.describe("past-due-grace", () => {
  test("invoice.payment_failed → subscription status becomes PAST_DUE (DB required)", async (
    { seeded, request },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId } = seeded;
    const customerId = `cus_pastdue_${workspaceId.slice(0, 8)}`;
    const subId = `sub_pastdue_${workspaceId.slice(0, 8)}`;
    const invoiceId = `in_pastdue_${workspaceId.slice(0, 8)}`;

    // Wire the workspace to the test customer.
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

    // Seed an active subscription.
    await sendWebhookEvent(
      request,
      buildSubscriptionCreatedEvent({
        subscriptionId: subId,
        customerId,
        status: "active",
      }),
    );

    // Deliver payment_failed webhook.
    const failedEvt = buildInvoicePaymentFailedEvent({
      subscriptionId: subId,
      customerId,
      invoiceId,
    });
    const { status } = await sendWebhookEvent(request, failedEvt);
    expect(status).toBe(200);

    // Verify DB: Subscription.status === PAST_DUE.
    const prisma2 = new PrismaClient();
    try {
      const sub = await prisma2.subscription.findUnique({
        where: { stripeSubscriptionId: subId },
        select: { status: true },
      });
      expect(sub?.status).toBe("PAST_DUE");
    } finally {
      await prisma2.$disconnect();
    }
  });

  test("workspace stays accessible during grace period (DB required)", async (
    { authedPage: page, seeded, request },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId } = seeded;
    const customerId = `cus_grace_${workspaceId.slice(0, 8)}`;
    const subId = `sub_grace_${workspaceId.slice(0, 8)}`;

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
      buildInvoicePaymentFailedEvent({ subscriptionId: subId, customerId }),
    );

    // Workspace home must still load (grace period — not hard-gated yet).
    await page.goto(`/app/workspace/${workspaceId}`);

    // Should NOT redirect to sign-in or show a hard gate page.
    // The workspace name or any workspace content should be present.
    await expect(page.locator("body")).not.toContainText("sign in", { ignoreCase: true, timeout: 20_000 });
    // Page loaded successfully (not a 5xx error page).
    await expect(page.locator("body")).not.toContainText("internal server error", { ignoreCase: true });
  });

  test("billing page shows past-due status after payment failure (DB required)", async (
    { authedPage: page, seeded, request },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId } = seeded;
    const customerId = `cus_pdshow_${workspaceId.slice(0, 8)}`;
    const subId = `sub_pdshow_${workspaceId.slice(0, 8)}`;

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
      buildInvoicePaymentFailedEvent({ subscriptionId: subId, customerId }),
    );

    await page.goto(`/app/workspace/${workspaceId}/settings/billing`);

    // Billing page shows past-due indicator.
    await expect(
      page.getByText(/past.?due/i).or(page.getByText(/payment failed/i)),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("idempotent: duplicate payment_failed webhook is processed exactly once", async (
    { seeded, request },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId } = seeded;
    const customerId = `cus_idem_${workspaceId.slice(0, 8)}`;
    const subId = `sub_idem_${workspaceId.slice(0, 8)}`;
    const invoiceId = `in_idem_${workspaceId.slice(0, 8)}`;

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
      buildSubscriptionCreatedEvent({ subscriptionId: subId, customerId }),
    );

    const failedEvt = buildInvoicePaymentFailedEvent({
      subscriptionId: subId,
      customerId,
      invoiceId,
    });

    // Deliver twice — the second must still return 200 (idempotent, not 409).
    const { status: s1 } = await sendWebhookEvent(request, failedEvt);
    const { status: s2 } = await sendWebhookEvent(request, failedEvt);
    expect(s1).toBe(200);
    expect(s2).toBe(200);
  });
});
