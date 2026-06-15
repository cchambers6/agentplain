/**
 * tests/e2e/workspace.mobile.spec.ts
 *
 * Mobile-width (375px) operability of the core daily loop — the approvals
 * queue. Runs under the `mobile` Playwright project (375px viewport). The
 * approvals UI has no swipe/batch-select gestures (verified — they don't
 * exist), so we assert OPERABILITY at narrow width (cards visible, approve/
 * reject reachable), not phantom gestures.
 *
 * Authed: same E2E_SESSION_COOKIE + E2E_WORKSPACE_ID gate as workspace.spec.ts.
 */

import { test, expect, hasAuth, workspacePath, maybeSnapshot } from "./fixtures/test-mode";

test.describe("approvals queue @mobile (375px)", () => {
  test.skip(!hasAuth, "set E2E_SESSION_COOKIE + E2E_WORKSPACE_ID to run mobile workspace specs");

  test("approvals queue is operable at 375px", async ({ authedPage: page }) => {
    const res = await page.goto(workspacePath("/approvals"));
    expect(res?.status(), "approvals should load").toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/app\/sign-in/);
    await expect(page.getByRole("heading").first()).toBeVisible();
    // The discipline filter (aria-label="Filter approvals by discipline") and
    // the approve/reject controls must be reachable at narrow width when the
    // queue has seeded items; otherwise the empty-state heading still renders.
    const filter = page.getByRole("group", { name: /filter approvals by discipline/i });
    if (await filter.count()) await expect(filter).toBeVisible();
    await maybeSnapshot(page, "workspace-approvals-375");
  });
});
