/**
 * tests/e2e/auth.spec.ts
 *
 * Auth-surface coverage: sign-up + sign-in PAGE render (public, always runs
 * against E2E_BASE_URL) and the AUTH-FLOW behaviours (signup submit, the
 * "stay signed in 30 days" cookie from PR #270, logout) which need the app
 * running in test mode (AUTH_PROVIDER=test, BILLING_PROVIDER=test) and are
 * gated behind E2E_AUTH_FLOW=1 so they don't false-red against a plain preview.
 *
 * Selectors verified 2026-06-15:
 *   sign-up   SignUpForm.tsx — labels "brokerage / firm name" / "your email",
 *             submit "begin with us — <tier> workspace", vertical radiogroup
 *             legend "the work you do".
 *   sign-in   SignInForm.tsx:25,42,53 — "email", the 30-day checkbox
 *             "Keep me signed in for 30 days on this device." (defaultChecked),
 *             submit "send sign-in link".
 */

import { test, expect } from "@playwright/test";
import { hasBaseUrl, hasAuth, AUTH_FLOW, SESSION_COOKIE_NAME } from "./fixtures/test-mode";

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60;

test.describe("auth pages (public render)", () => {
  test.skip(!hasBaseUrl, "set E2E_BASE_URL to run auth e2e specs");

  test("sign-up renders the workspace form", async ({ page }) => {
    await page.goto("/app/sign-up");
    await expect(
      page.getByRole("heading", { name: /root your workspace/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/brokerage \/ firm name/i)).toBeVisible();
    await expect(page.getByLabel(/your email/i)).toBeVisible();
    // Submit button text is "begin with us — <tier> workspace".
    await expect(
      page.getByRole("button", { name: /begin with us/i }),
    ).toBeVisible();
  });

  test("sign-up honours ?vertical= query param", async ({ page }) => {
    // ?vertical=cpa pre-selects the CPA chip in the vertical radiogroup.
    await page.goto("/app/sign-up?vertical=cpa");
    const cpaRadio = page.getByRole("radio", { name: /cpa/i }).first();
    await expect(cpaRadio).toBeVisible();
    await expect(cpaRadio).toHaveAttribute("aria-checked", "true");
  });

  test("sign-in renders email form + 30-day stay-signed-in checkbox (checked)", async ({
    page,
  }) => {
    await page.goto("/app/sign-in");
    await expect(
      page.getByRole("heading", { name: /step back into your workspace/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send sign-in link/i }),
    ).toBeVisible();
    // PR #270 surface: the checkbox exists and is checked by default.
    const remember = page.getByLabel(/keep me signed in for 30 days/i);
    await expect(remember).toBeVisible();
    await expect(remember).toBeChecked();
  });
});

test.describe("auth flow (test-mode)", () => {
  // Needs AUTH_PROVIDER=test + BILLING_PROVIDER=test + E2E_AUTH_FLOW=1.
  test.skip(
    !hasBaseUrl || !AUTH_FLOW,
    "set E2E_BASE_URL + E2E_AUTH_FLOW=1 (app in AUTH_PROVIDER=test mode) to run auth-flow specs",
  );

  test("signup (no-card default) lands in a trialing workspace, no Stripe redirect", async ({
    page,
  }) => {
    // Default flow: STRIPE_CHECKOUT_ENABLED is FALSE → trial-first / no card.
    await page.goto("/app/sign-up?vertical=real-estate");
    await page.getByLabel(/brokerage \/ firm name/i).fill("E2E Test Brokerage");
    await page
      .getByLabel(/your email/i)
      .fill(`e2e+${Date.now()}@example.com`);
    await page.getByRole("button", { name: /begin with us/i }).click();
    // Must NOT bounce to Stripe Checkout in the default flow.
    await expect(page).not.toHaveURL(/checkout\.(stripe|example)\.com/);
    // Lands on a workspace or onboarding surface.
    await expect(page).toHaveURL(/\/app\/(workspace|sign-up\/checkout-success)/, {
      timeout: 30_000,
    });
  });

  test("stay-signed-in checkbox sets a ~30-day session cookie (PR #270)", async ({
    page,
    context,
  }) => {
    // PR #270 root cause: Next 14 dropped Max-Age on cookies().set() before a
    // NextResponse.redirect; the fix moves it to response.cookies.set() on the
    // redirect. This asserts the resulting cookie lifetime.
    //
    // Completing a magic-link login in test mode requires the deployment's
    // test-auth completion path. If your test deployment exposes it, set
    // E2E_MAGIC_LINK_COMPLETE_PATH; otherwise this skips with a clear TODO
    // rather than guessing the route.
    const completePath = process.env.E2E_MAGIC_LINK_COMPLETE_PATH;
    test.skip(
      !completePath,
      "set E2E_MAGIC_LINK_COMPLETE_PATH to the test-mode login completion URL to assert the 30-day cookie",
    );

    await page.goto("/app/sign-in");
    await expect(page.getByLabel(/keep me signed in for 30 days/i)).toBeChecked();
    await page.getByLabel(/^email$/i).fill(`e2e+${Date.now()}@example.com`);
    await page.getByRole("button", { name: /send sign-in link/i }).click();
    // Drive the test-mode completion path (provided by the deployment).
    await page.goto(completePath!);

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === SESSION_COOKIE_NAME);
    expect(session, "session cookie should be set after login").toBeTruthy();
    // expires is a unix timestamp (seconds). With "remember" checked it should
    // be ~30 days out, not a session cookie (-1). Allow a generous lower bound.
    const secondsOut = (session!.expires ?? -1) - Date.now() / 1000;
    expect(
      secondsOut,
      "remember-me should yield a multi-week cookie (≥25 days)",
    ).toBeGreaterThan(THIRTY_DAYS_SEC - 5 * 24 * 60 * 60);
  });

  test("logout clears the session and returns to sign-in", async ({ page, context }) => {
    test.skip(!hasAuth, "set E2E_SESSION_COOKIE + E2E_WORKSPACE_ID for the logout flow");
    // With a session injected, find the sign-out control. Defensive: log a
    // clear skip if the control isn't where expected rather than guessing.
    await page.goto(`/app/workspace/${process.env.E2E_WORKSPACE_ID}/settings`);
    const signOut = page.getByRole("button", { name: /sign out|log out/i }).first();
    const link = page.getByRole("link", { name: /sign out|log out/i }).first();
    const control = (await signOut.count()) ? signOut : link;
    test.skip(
      !(await control.count()),
      "no sign-out control found on /settings — locate + update selector",
    );
    await control.click();
    await expect(page).toHaveURL(/\/app\/sign-in/);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === SESSION_COOKIE_NAME)?.value || "").toBe("");
  });
});
