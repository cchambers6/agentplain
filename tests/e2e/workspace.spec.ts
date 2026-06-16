/**
 * tests/e2e/workspace.spec.ts
 *
 * Authenticated workspace coverage: every nav tab renders, the integrations
 * cards expose their connect / manage / disconnect affordances, the Plaino
 * composer accepts input, and the settings sub-tabs render.
 *
 * Auth model (see fixtures/test-mode.ts): inject a sealed session via
 * E2E_SESSION_COOKIE + point at its workspace with E2E_WORKSPACE_ID. No DB or
 * session minting happens here — `tests/e2e/smoke-authenticated.ts` seeds a
 * workspace and mints a session you can feed in. The whole describe self-skips
 * when those aren't set, so nightly preview runs stay green on the public tier.
 *
 * Interactions are NON-MUTATING by design: we assert controls render and open
 * (e.g. the disconnect confirm dialog) but cancel out — we never complete an
 * OAuth connect or an actual disconnect against the target deployment.
 *
 * Selectors verified 2026-06-15 (workspace layout NAV, IntegrationTile,
 * DisconnectButton, TalkComposer).
 */

import { test, expect, hasAuth, WORKSPACE_NAV, SETTINGS_SEGMENTS, workspacePath, maybeSnapshot, AUTH_FLOW } from "./fixtures/test-mode";

test.describe("authenticated workspace", () => {
  test.skip(
    !hasAuth,
    "set E2E_SESSION_COOKIE + E2E_WORKSPACE_ID (e.g. from tests/e2e/smoke-authenticated.ts) to run workspace specs",
  );

  test("workspace overview renders without redirect to sign-in", async ({ authedPage: page }) => {
    const res = await page.goto(workspacePath(""));
    expect(res?.status(), "overview should load (not 401/redirect)").toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/app\/sign-in/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await maybeSnapshot(page, "workspace-overview");
  });

  // All 12 nav tabs render their page (no dead tab, no auth bounce).
  for (const tab of WORKSPACE_NAV) {
    test(`nav tab "${tab.label}" renders`, async ({ authedPage: page }) => {
      const res = await page.goto(workspacePath(tab.segment));
      expect(res?.status(), `${tab.label} tab should load`).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/app\/sign-in/);
      await expect(page.getByRole("heading").first()).toBeVisible();
    });
  }

  test("nav strip exposes every tab as a link", async ({ authedPage: page }) => {
    await page.goto(workspacePath(""));
    for (const tab of WORKSPACE_NAV) {
      await expect(
        page.getByRole("link", { name: tab.label, exact: false }).first(),
        `nav should show "${tab.label}"`,
      ).toBeVisible();
    }
  });

  test("Plaino composer accepts a message", async ({ authedPage: page }) => {
    await page.goto(workspacePath("/talk"));
    const input = page.getByLabel(/your message to plaino/i);
    await expect(input).toBeVisible();
    await input.fill("E2E smoke: what's in my queue today?");
    await expect(input).toHaveValue(/queue today/);
    await expect(page.getByRole("button", { name: /send to plaino/i })).toBeEnabled();
    await maybeSnapshot(page, "workspace-talk");
  });

  test("Plaino submit returns a turn or an honest degraded notice", async ({ authedPage: page }) => {
    // The prod model credential is paused by policy, so the real customer
    // experience is the degraded path. Either a rendered turn OR the degraded
    // notice is a PASS; a raw 5xx / unhandled error is the failure we guard.
    test.skip(!AUTH_FLOW, "set E2E_AUTH_FLOW=1 to exercise the Plaino turn submission");
    await page.goto(workspacePath("/talk"));
    await page.getByLabel(/your message to plaino/i).fill("E2E degraded-mode probe");
    await page.getByRole("button", { name: /send to plaino/i }).click();
    // Accept the user's message echoing back OR the in-character degraded copy.
    await expect(
      page.getByText(/degraded probe|offline for the moment|fetching|what's not yet wired/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("integrations page lists connector tiles with action affordances", async ({ authedPage: page }) => {
    await page.goto(workspacePath("/integrations"));
    await expect(
      page.getByRole("heading", { name: /bring us into the tools/i }),
    ).toBeVisible();
    // At least one connector tile (data-testid="integration-tile-<id>").
    const tiles = page.locator('[data-testid^="integration-tile-"]');
    await expect(tiles.first()).toBeVisible();
    expect(await tiles.count()).toBeGreaterThan(0);
    // Each tile carries one of the known affordances.
    const affordances = page.getByText(
      /connect →|manage →|join the waitlist →|your service partner connects this/i,
    );
    await expect(affordances.first()).toBeVisible();
    await maybeSnapshot(page, "workspace-integrations");
  });

  test("disconnect flow opens its confirm dialog then cancels (non-mutating)", async ({ authedPage: page }) => {
    await page.goto(workspacePath("/integrations"));
    // A connected tile links to the detail page via "manage →".
    const manage = page.getByRole("link", { name: /manage →/i }).first();
    test.skip(
      !(await manage.count()),
      "no connected integration on this workspace — seed one to exercise disconnect",
    );
    await manage.click();
    const disconnect = page.getByRole("button", { name: /^disconnect/i }).first();
    await expect(disconnect).toBeVisible();
    await disconnect.click();
    // Confirmation surfaces "keep connected" (cancel) + a confirm "disconnect".
    const keep = page.getByRole("button", { name: /keep connected/i });
    await expect(keep).toBeVisible();
    await keep.click(); // cancel — do NOT mutate the real credential
  });

  // Settings sub-tabs all render.
  for (const seg of SETTINGS_SEGMENTS) {
    test(`settings tab ${seg} renders`, async ({ authedPage: page }) => {
      const res = await page.goto(workspacePath(seg));
      expect(res?.status(), `${seg} should load`).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/app\/sign-in/);
      await expect(page.getByRole("heading").first()).toBeVisible();
    });
  }
});
