// Playwright config — agentplain customer-path E2E smoke + visual suite.
//
// SCOPE: the most-clicked customer paths (marketing, auth pages, workspace)
// plus the passkey/WebAuthn ceremony spec. These drive a REAL browser against
// a RUNNING app reachable at E2E_BASE_URL — intentionally NOT part of the
// DB-free `npm test` node:test suite (which globs tests/*.test.ts).
//
// Run against a deployed preview (nightly CI) or local dev:
//
//   E2E_BASE_URL=https://<preview>.vercel.app npm run test:e2e
//   E2E_BASE_URL=http://localhost:3000        npm run test:e2e
//
// Test tiers (see tests/e2e/fixtures/test-mode.ts):
//   - Marketing + auth-PAGE specs run unauthenticated; they SELF-SKIP when
//     E2E_BASE_URL is unset, so a bare run is a clean no-op.
//   - Authenticated workspace specs additionally self-skip unless a session is
//     injected (E2E_SESSION_COOKIE + E2E_WORKSPACE_ID) — never a false red.
//   - Visual-regression assertions (toHaveScreenshot) are OPT-IN via E2E_VISUAL=1
//     so the suite never fails on a missing committed baseline.
//
// This config is the canonical home for ALL browser-driven specs in tests/e2e;
// it supersedes the passkey-only config (that spec runs as the `chromium`
// project here).

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const isCI = !!process.env.CI;

// Optionally let Playwright boot a local dev server (handy for a local
// `npm run test:e2e` with nothing already running). Off by default and never
// in CI, where we target an already-deployed preview URL.
const useWebServer = process.env.E2E_WEBSERVER === "1" && !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Single worker: authed specs share one seeded workspace; serial keeps them
  // isolated without per-worker DB partitioning.
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Generous ratio: full-page brand/layout snapshots, not pixel-perfect
      // component diffs. Tightened once baselines stabilise.
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
    },
  },
  reporter: isCI
    ? [
        ["github"],
        ["html", { open: "never", outputFolder: "playwright-report" }],
        ["json", { outputFile: "playwright-report/results.json" }],
        ["list"],
      ]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "chromium",
      testIgnore: ["**/*.mobile.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Narrow viewport (375px) for the mobile-operability checks.
      //   npx playwright test --project=mobile
      name: "mobile",
      testMatch: ["**/*.mobile.spec.ts"],
      use: { ...devices["Pixel 5"], viewport: { width: 375, height: 812 } },
    },
  ],
  ...(useWebServer
    ? {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
      }
    : {}),
});
