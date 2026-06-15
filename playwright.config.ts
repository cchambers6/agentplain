// Playwright config — passkey / WebAuthn end-to-end ceremony tests.
//
// These specs drive a REAL browser with a CDP virtual authenticator, so they
// require a running app (local dev or a deployed preview) reachable at
// E2E_BASE_URL. They are intentionally kept OUT of the DB-free `npm test`
// node:test suite (which globs tests/*.test.ts) — run them explicitly with:
//
//   E2E_BASE_URL=https://app.agentplain.com npm run test:e2e
//
// or against local dev (E2E_BASE_URL=http://localhost:3000). The spec
// self-skips when E2E_BASE_URL is unset so a bare `npm run test:e2e` is a
// clean no-op rather than a failure.

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // WebAuthn virtual authenticator is a Chromium/CDP feature.
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
