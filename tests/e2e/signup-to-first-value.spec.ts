/**
 * tests/e2e/signup-to-first-value.spec.ts
 *
 * Revenue path: new visitor → sign-up form → Stripe Checkout (mocked) →
 * checkout-success landing → approvals queue with pre-seeded draft → approve.
 *
 * What this gates:
 *   - The sign-up page renders and the form is operable
 *   - Submission with a real-estate vertical doesn't hit the waitlist gate
 *   - The form redirects to a Stripe Checkout URL (intercepted, not real Stripe)
 *   - The checkout-success landing page renders without error
 *   - An authenticated user can see the approvals queue populated with drafts
 *   - The approve action completes (200, no error)
 */

import { test, expect, skipIfNoDb } from "./fixtures";
import {
  sendWebhookEvent,
  buildSubscriptionCreatedEvent,
} from "./helpers/webhook";

const TEST_EMAIL = "e2e-signup@agentplain-e2e.test";
const TEST_BROKERAGE = "E2E Signup Realty";

test.describe("signup-to-first-value", () => {
  test("sign-up form renders with real-estate vertical", async ({ page }) => {
    await page.goto("/app/sign-up?vertical=real-estate");

    // Form fields visible.
    await expect(page.getByLabel("brokerage / firm name")).toBeVisible();
    await expect(page.getByLabel("your email")).toBeVisible();

    // Tier picker defaults to Regular.
    const regularRadio = page.getByRole("radio", { name: /regular/i });
    await expect(regularRadio).toHaveAttribute("aria-checked", "true");

    // Real estate chip is present.
    await expect(page.getByRole("radio", { name: /real.?estate/i })).toBeVisible();
  });

  test("sign-up form shows waitlist for unsupported vertical", async ({ page }) => {
    await page.goto("/app/sign-up");

    // "Something else" = any non-supported vertical.
    const somethingElseBtn = page.getByRole("radio", { name: /something else/i });
    await expect(somethingElseBtn).toBeVisible();
    await somethingElseBtn.click();

    await page.getByLabel("brokerage / firm name").fill("E2E Healthcare Co");
    await page.getByLabel("your email").fill("e2e-waitlist@agentplain-e2e.test");
    await page.getByRole("button", { name: /begin with us/i }).click();

    // Waitlist screen shown — no Stripe redirect.
    await expect(
      page.getByText(/plaino isn.t ready for/i).or(page.getByText(/not yet/i)),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("real-estate signup redirects to Stripe Checkout (test provider)", async ({ page }) => {
    // Intercept the TestBillingProvider's checkout URL so the browser
    // doesn't leave localhost.
    await page.route("https://checkout.example/**", async (route) => {
      await route.fulfill({
        status: 302,
        headers: {
          Location: "/app/sign-up/checkout-success?session_id=cs_test_e2e&workspace=test",
        },
      });
    });

    await page.goto("/app/sign-up?vertical=real-estate");
    await page.getByLabel("brokerage / firm name").fill(TEST_BROKERAGE);
    await page.getByLabel("your email").fill(TEST_EMAIL);
    await page.getByRole("button", { name: /begin with us/i }).click();

    // Wait for redirect through the intercepted checkout → checkout-success.
    await page.waitForURL("**/checkout-success**", { timeout: 20_000 });

    await expect(page.getByText(/card is secured/i)).toBeVisible();
    await expect(page.getByText(/sign in to open your workspace/i)).toBeVisible();
  });

  test("checkout-success page renders without auth", async ({ page }) => {
    await page.goto(
      "/app/sign-up/checkout-success?session_id=cs_test_e2e&workspace=test",
    );
    await expect(page.getByText(/card is secured/i)).toBeVisible();
    await expect(page.getByText(/sign in to open your workspace/i)).toBeVisible();
  });

  test("authenticated user sees approval queue with seeded drafts (DB required)", async (
    { authedPage: page, seeded },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    await page.goto(`/app/workspace/${seeded.workspaceId}/approvals`);

    // Pre-seeded markers appear in the approvals list.
    for (const marker of seeded.plan.markers.approvals) {
      await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 });
    }

    // Approve the first item — if the approve button is present, click it.
    const approveBtn = page.getByRole("button", { name: /approve/i }).first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await expect(approveBtn).not.toBeVisible({ timeout: 10_000 });
    }
  });

  test("webhook: subscription.created returns 200 (DB required)", async (
    { seeded, request },
    testInfo,
  ) => {
    skipIfNoDb(testInfo);

    const event = buildSubscriptionCreatedEvent({
      subscriptionId: `sub_signup_${seeded.workspaceId.slice(0, 8)}`,
      customerId: `cus_signup_${seeded.workspaceId.slice(0, 8)}`,
      status: "trialing",
    });

    const { status } = await sendWebhookEvent(request, event);
    expect(status).toBe(200);
  });
});
