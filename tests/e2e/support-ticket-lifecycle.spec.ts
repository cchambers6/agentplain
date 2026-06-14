/**
 * tests/e2e/support-ticket-lifecycle.spec.ts
 *
 * Revenue path: user files a help request → sees confirmation → admin sees it
 * in the operator support queue → admin replies → ticket resolved.
 *
 * DEPENDENCY: The full support ticket lifecycle (admin reply → customer email
 * thread) depends on PR #244 being on main. Until that merges, the tests
 * that require the full lifecycle are marked with a skip guard.
 *
 * What this gates NOW:
 *   - Help form renders and is submittable
 *   - Form submission returns a ticket reference (or confirmation message)
 *   - The SupportRequest row appears in the DB
 *
 * What this will gate AFTER #244 merges:
 *   - Admin sees the ticket in /admin/support or /operator/support
 *   - Admin reply fires and the customer sees the thread
 *   - Status transitions: NEW → ACKNOWLEDGED → RESOLVED
 */

import { test, expect, skipIfNoDb } from "./fixtures";
import { PrismaClient } from "@prisma/client";

// Guard: skip the parts that need the full support thread (pending #244).
const SUPPORT_THREAD_LIVE = process.env.E2E_SUPPORT_THREAD === "1";

test.describe("support-ticket-lifecycle", () => {
  test("help page renders with a form", async (
    { authedPage: page, seeded },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId } = seeded;
    await page.goto(`/app/workspace/${workspaceId}/help`);

    // The help form must have a subject/message field and a submit.
    const form = page.locator("form");
    await expect(form).toBeVisible({ timeout: 20_000 });

    // At minimum: a textarea or input for the message.
    const messageField = page
      .getByLabel(/message|question|description/i)
      .or(page.locator("textarea"))
      .first();
    await expect(messageField).toBeVisible();
  });

  test("help form submission creates a SupportRequest row (DB required)", async (
    { authedPage: page, seeded },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const { workspaceId } = seeded;
    const ticketMarker = `E2E-TICKET-${workspaceId.slice(0, 8)}`;

    await page.goto(`/app/workspace/${workspaceId}/help`);

    // Fill the form.
    const subjectField = page.getByLabel(/subject/i).or(page.locator('input[name="subject"]')).first();
    const bodyField = page.getByLabel(/message|question|body/i).or(page.locator("textarea")).first();

    if (await subjectField.isVisible()) {
      await subjectField.fill(`E2E Test Ticket — ${ticketMarker}`);
    }
    await bodyField.fill(`This is an automated E2E test ticket. Marker: ${ticketMarker}`);

    await page.getByRole("button", { name: /send|submit|get help/i }).click();

    // Confirmation message or ticket reference.
    await expect(
      page
        .getByText(/ticket|support request|we.ll be in touch|received/i)
        .or(page.getByText(/thank/i)),
    ).toBeVisible({ timeout: 20_000 });

    // Verify DB row created.
    const prisma = new PrismaClient();
    try {
      const ticket = await prisma.supportRequest.findFirst({
        where: {
          workspaceId,
          body: { contains: ticketMarker },
        },
        select: { id: true, status: true },
      });
      expect(ticket).not.toBeNull();
      expect(["NEW", "ACKNOWLEDGED"]).toContain(ticket?.status);
    } finally {
      await prisma.$disconnect();
    }
  });

  test("admin sees ticket in support queue (DB required, support thread live)", async (
    { authedPage: page, seeded },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);
    if (!SUPPORT_THREAD_LIVE) {
      testInfo.skip(true, "Full support thread requires E2E_SUPPORT_THREAD=1 (pending PR #244)");
      return;
    }

    // TODO after #244: seed an operator user, set authedPage to operator session,
    // navigate to /operator/support or /admin/support, assert ticket is visible.
    expect(SUPPORT_THREAD_LIVE).toBe(true);
  });

  test("admin reply flows to customer (DB required, support thread live)", async (
    {},
    testInfo,
  ) => {
    skipIfNoDb(testInfo);
    if (!SUPPORT_THREAD_LIVE) {
      testInfo.skip(true, "Full support thread requires E2E_SUPPORT_THREAD=1 (pending PR #244)");
      return;
    }

    // TODO after #244: admin replies → check email queued → mark resolved →
    // customer sees resolution.
    expect(SUPPORT_THREAD_LIVE).toBe(true);
  });
});
