/**
 * tests/workspace-nav.test.ts
 *
 * Pins the 13→5 workspace IA collapse
 * (docs/specs/workspace-ia-simplification-2026-06-14.md):
 *
 *   1. The nav is exactly the five customer-job tabs, in order.
 *   2. No engineer-vocab tab survives (Fleet / Disciplines / Agents /
 *      Activity / Briefings were org-chart words an owner doesn't think in).
 *   3. Every route the collapse absorbed is still reachable — either it is a
 *      tab's own page, listed in a tab's `match` set (reached via an in-tab
 *      hub), or it is one of the two intentionally redirected routes. Nothing
 *      is silently orphaned.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { WORKSPACE_TABS } from "@/lib/workspace/nav";

describe("workspace nav — 5 customer-job tabs", () => {
  it("renders exactly five tabs, in IA order", () => {
    assert.deepEqual(
      WORKSPACE_TABS.map((t) => t.label),
      ["Today", "Plaino", "Connections", "Reports", "Account"],
    );
  });

  it("Today is the default landing (empty href, first)", () => {
    assert.equal(WORKSPACE_TABS[0].href, "");
    assert.equal(WORKSPACE_TABS[0].label, "Today");
  });

  it("drops every engineer-vocab tab label", () => {
    const labels = new Set(WORKSPACE_TABS.map((t) => t.label));
    for (const banned of [
      "Fleet",
      "Disciplines",
      "Agents",
      "Activity",
      "Briefings",
      "Overview",
      "Help",
      "Compliance",
      "Integrations",
      "Settings",
    ]) {
      assert.ok(!labels.has(banned), `"${banned}" must not be a top-level tab`);
    }
  });

  it("keeps every absorbed route reachable (a tab page, a match, or a redirect)", () => {
    // The 13-tab world's routes. /fleet + /help are the two killed routes
    // (308-redirect via next.config), so they are allowed to be absent here.
    const REDIRECTED = new Set(["/fleet", "/help"]);
    const oldRoutes = [
      "", // Overview → Today
      "/talk",
      "/disciplines",
      "/activity",
      "/approvals",
      "/agents",
      "/compliance",
      "/briefings",
      "/reports/weekly",
      "/integrations",
      "/marketplace",
      "/settings",
      "/support",
    ];

    const tabHrefs = new Set(WORKSPACE_TABS.map((t) => t.href));
    const matched = new Set(WORKSPACE_TABS.flatMap((t) => t.match ?? []));

    for (const route of oldRoutes) {
      if (REDIRECTED.has(route)) continue;
      const reachable =
        tabHrefs.has(route) ||
        matched.has(route) ||
        // sub-route of a tab (e.g. /reports/weekly under /reports, /support → Account)
        WORKSPACE_TABS.some(
          (t) =>
            (t.href !== "" && route.startsWith(`${t.href}/`)) ||
            (t.match ?? []).some(
              (m) => route === m || route.startsWith(`${m}/`),
            ),
        );
      assert.ok(reachable, `route "${route || "(overview)"}" must stay reachable`);
    }
  });

  it("has no duplicate hrefs or labels", () => {
    const hrefs = WORKSPACE_TABS.map((t) => t.href);
    const labels = WORKSPACE_TABS.map((t) => t.label);
    assert.equal(new Set(hrefs).size, hrefs.length, "tab hrefs must be unique");
    assert.equal(new Set(labels).size, labels.length, "tab labels must be unique");
  });
});
