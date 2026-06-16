/**
 * tests/e2e/fixtures/test-mode.ts
 *
 * Shared setup for the customer-path E2E smoke suite. Three tiers, gated by
 * env so a bare run is a clean partial pass (never a false red):
 *
 *   1. PUBLIC (marketing + auth pages) — needs only E2E_BASE_URL. Drives the
 *      live preview/prod with no auth.
 *   2. AUTHED (workspace) — additionally needs a signed-in session injected
 *      via E2E_SESSION_COOKIE (a sealed iron-session value) + the workspace it
 *      belongs to via E2E_WORKSPACE_ID. This reuses the exact convention the
 *      passkey ceremony spec already uses, so NO database or session minting
 *      happens at test time — you hand the suite a cookie + a workspace id
 *      (e.g. from `tests/e2e/smoke-authenticated.ts`, which seeds + mints).
 *   3. AUTH-FLOW (signup submit, remember-me cookie, logout) — needs the app
 *      to be running with AUTH_PROVIDER=test + BILLING_PROVIDER=test so the
 *      flow completes without real email/Stripe. Gated by E2E_AUTH_FLOW=1.
 *
 * Visual regression (toHaveScreenshot) is OPT-IN via E2E_VISUAL=1, so the
 * suite never fails on a missing committed baseline; otherwise screenshots are
 * captured as artifacts only.
 *
 * Test-mode env reality (verified lib/env.ts:37–38): the flags are
 * AUTH_PROVIDER=test and BILLING_PROVIDER=test. There is NO `TEST_MODE_ENABLED`
 * env var in this codebase — the original brief named one that does not exist.
 */

import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

// ── Env rails ────────────────────────────────────────────────────────────────

export const BASE_URL = process.env.E2E_BASE_URL;
export const WORKSPACE_ID = process.env.E2E_WORKSPACE_ID;
export const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE;
export const SESSION_COOKIE_NAME =
  process.env.E2E_SESSION_COOKIE_NAME ?? "agentplain_session";

export const VISUAL = process.env.E2E_VISUAL === "1";
export const AUTH_FLOW = process.env.E2E_AUTH_FLOW === "1";

export const hasBaseUrl = Boolean(BASE_URL);
export const hasAuth = Boolean(SESSION_COOKIE && WORKSPACE_ID);

// ── Ground-truth route data (cited inventory, verified 2026-06-15) ────────────

/** The 10 locked verticals + the `general` on-ramp (lib/verticals/index.ts:46–62). */
export const VERTICAL_SLUGS = [
  "real-estate",
  "mortgage",
  "insurance",
  "property-management",
  "title-escrow",
  "recruiting",
  "home-services",
  "cpa",
  "law",
  "ria",
  "general",
] as const;

/** Marketing nav (components/Header.tsx:30–36, :83, :88) — http path links only. */
export const MARKETING_NAV: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Verticals", href: "/verticals" },
  { label: "Pricing", href: "/pricing" },
  { label: "Custom", href: "/custom" },
  { label: "About", href: "/about" },
  { label: "Sign in", href: "/app/sign-in" },
];

/** Footer path links (components/Footer.tsx) — excludes mailto + hash anchors. */
export const FOOTER_LINKS: ReadonlyArray<string> = [
  "/verticals",
  "/general",
  "/pricing",
  "/custom",
  "/app/sign-up",
  "/app/sign-in",
  "/about",
  "/privacy",
  "/terms",
  "/security",
];

/**
 * Workspace nav tabs, in order — the 5 customer-job tabs after the 13→5 IA
 * collapse (lib/workspace/nav.ts → WORKSPACE_TABS, rendered in layout.tsx).
 */
export const WORKSPACE_NAV: ReadonlyArray<{ label: string; segment: string }> = [
  { label: "Today", segment: "" },
  { label: "Plaino", segment: "/talk" },
  { label: "Connections", segment: "/connections" },
  { label: "Reports", segment: "/reports" },
  { label: "Account", segment: "/settings" },
];

/**
 * Routes the 5 tabs absorbed — no longer in the top nav, but still reachable
 * via in-tab hubs and backward-compat. Each must still render (no 404/500).
 * /fleet and /help are intentionally absent: they 308-redirect (next.config).
 */
export const WORKSPACE_ABSORBED_ROUTES: ReadonlyArray<string> = [
  "/activity",
  "/approvals",
  "/integrations",
  "/marketplace",
  "/agents",
  "/disciplines",
  "/compliance",
  "/briefings",
  "/reports/weekly",
  "/support",
  "/support/new",
];

/** Settings sub-tabs (app/(product)/app/workspace/[id]/settings/*). */
export const SETTINGS_SEGMENTS: ReadonlyArray<string> = [
  "/settings",
  "/settings/billing",
  "/settings/data",
  "/settings/passkeys",
  "/settings/schedule",
  "/settings/skills",
  "/settings/work-thresholds",
  "/settings/pause",
];

// ── Session injection ─────────────────────────────────────────────────────────

/**
 * Inject the provided sealed session cookie into the browser context so authed
 * routes render the signed-in state. No-op if no cookie is configured (the
 * authed describes self-skip before this runs).
 */
export async function applySessionCookie(
  context: BrowserContext,
  baseURL: string,
): Promise<void> {
  if (!SESSION_COOKIE) return;
  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: SESSION_COOKIE,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
    },
  ]);
}

/** Path under the seeded workspace, e.g. workspacePath("/talk"). */
export function workspacePath(segment = ""): string {
  return `/app/workspace/${WORKSPACE_ID}${segment}`;
}

// ── Visual helper ──────────────────────────────────────────────────────────────

/**
 * Visual regression when E2E_VISUAL=1 (requires committed baselines), else a
 * best-effort artifact screenshot. Never throws on the artifact path so a
 * missing report dir can't turn a green render into a red.
 */
export async function maybeSnapshot(page: Page, name: string): Promise<void> {
  if (VISUAL) {
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
    return;
  }
  await page
    .screenshot({ path: `playwright-report/screenshots/${name}.png`, fullPage: true })
    .catch(() => {
      /* artifact best-effort */
    });
}

// ── Extended test with an authed page fixture ──────────────────────────────────

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page, context, baseURL }, use) => {
    await applySessionCookie(context, baseURL ?? BASE_URL ?? "http://localhost:3000");
    await use(page);
  },
});

export { expect };
