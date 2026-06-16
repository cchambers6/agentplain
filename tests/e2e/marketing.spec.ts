/**
 * tests/e2e/marketing.spec.ts
 *
 * Smoke + render coverage for the most-clicked PUBLIC marketing paths. Runs
 * unauthenticated against E2E_BASE_URL (a deployed preview in CI, or local dev).
 * Self-skips when E2E_BASE_URL is unset — a bare run is a clean no-op.
 *
 * Pattern per check: navigate → assert landmark element present → (where it's a
 * CTA) click → assert expected destination → capture screenshot artifact.
 *
 * NOTE: the original brief listed /sell, /services, /financing, /instant-offer
 * — those are FlatSBO routes and DO NOT exist in agentplain. The real marketing
 * surface is /, /[vertical], /verticals, /pricing, /custom, /about, /privacy,
 * /terms, /security (verified app/(marketing)/*). We test what ships.
 */

import { test, expect } from "@playwright/test";
import {
  hasBaseUrl,
  MARKETING_NAV,
  FOOTER_LINKS,
  VERTICAL_SLUGS,
  maybeSnapshot,
} from "./fixtures/test-mode";

test.describe("marketing surfaces", () => {
  test.skip(!hasBaseUrl, "set E2E_BASE_URL to run marketing e2e specs");

  test("home renders hero + primary CTA → sign-up", async ({ page }) => {
    await page.goto("/");
    // Hero h1 (app/(marketing)/page.tsx:75–80).
    await expect(
      page.getByRole("heading", { level: 1, name: /lift up/i }),
    ).toBeVisible();
    // Primary CTA (page.tsx:138).
    const startTrial = page
      .getByRole("link", { name: /start free trial/i })
      .first();
    await expect(startTrial).toBeVisible();
    await maybeSnapshot(page, "marketing-home");

    await startTrial.click();
    await expect(page).toHaveURL(/\/app\/sign-up/);
  });

  test("home nav links all resolve to non-404", async ({ page, request }) => {
    await page.goto("/");
    // Assert each nav item is present in the header, then that its target
    // responds < 400 (no dead routes).
    for (const item of MARKETING_NAV) {
      await expect(
        page.getByRole("link", { name: item.label, exact: false }).first(),
      ).toBeVisible();
    }
    for (const item of MARKETING_NAV) {
      const res = await request.get(item.href);
      expect(
        res.status(),
        `${item.href} should not be a dead route`,
      ).toBeLessThan(400);
    }
  });

  test("footer links all resolve to non-404", async ({ request }) => {
    for (const href of FOOTER_LINKS) {
      const res = await request.get(href);
      expect(res.status(), `${href} should resolve`).toBeLessThan(400);
    }
  });

  test("pricing renders headings + start-trial CTA", async ({ page }) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("heading", { name: /ways to partner/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /start free trial/i }).first(),
    ).toBeVisible();
    await maybeSnapshot(page, "marketing-pricing");
  });

  test("verticals index renders the ten-vertical grid", async ({ page }) => {
    await page.goto("/verticals");
    await expect(
      page.getByRole("heading", { name: /ten verticals/i }),
    ).toBeVisible();
    // Each vertical chip links to /<slug>.
    for (const slug of VERTICAL_SLUGS) {
      if (slug === "general") continue; // on-ramp, not in the locked-ten grid
      await expect(
        page.locator(`a[href$="/${slug}"]`).first(),
        `verticals page should link to /${slug}`,
      ).toBeVisible();
    }
    await maybeSnapshot(page, "marketing-verticals");
  });

  // Each vertical landing page renders and exposes a sign-up CTA carrying the
  // vertical query param. One test, parameterised across all real slugs.
  for (const slug of VERTICAL_SLUGS) {
    test(`vertical page /${slug} renders with a sign-up CTA`, async ({ page }) => {
      const res = await page.goto(`/${slug}`);
      expect(res?.status(), `/${slug} should not 404`).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      // Vertical CTA → /app/sign-up?vertical=<slug> (VerticalCta component).
      await expect(
        page.locator('a[href*="/app/sign-up"]').first(),
      ).toBeVisible();
    });
  }

  test("unknown vertical returns 404 (notFound)", async ({ request }) => {
    // [vertical]/page.tsx:54 — invalid slug → notFound().
    const res = await request.get("/this-is-not-a-real-vertical");
    expect(res.status()).toBe(404);
  });

  for (const route of ["/about", "/custom", "/privacy", "/terms", "/security"]) {
    test(`legal/company page ${route} renders`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res?.status(), `${route} should not 404`).toBeLessThan(400);
      await expect(page.getByRole("heading").first()).toBeVisible();
    });
  }
});
