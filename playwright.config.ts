/**
 * Playwright configuration for the revenue-path E2E suite.
 *
 * Env required (shared between webServer and test process):
 *   SESSION_PASSWORD   — iron-session seal secret (≥32 chars)
 *   DATABASE_URL       — Postgres connection (test DB; never prod)
 *   ENCRYPTION_KEY     — 64-hex AES key matching the server's key
 *   ALLOW_E2E_SEED     — must be "yes" to permit DB seeding
 *
 * Env defaults assumed for test mode:
 *   AUTH_PROVIDER=test, BILLING_PROVIDER=test (no real email/Stripe)
 *
 * Local: copy .env.test.example → .env.test and fill in values.
 * CI:    GitHub Actions injects secrets directly; webServer inherits them.
 */

import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Load .env.test or .env.local for local runs (CI injects directly).
// Skip variables already set so CI secrets take precedence.
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnvFile(".env.test");
loadEnvFile(".env.local");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",

  // 60s per-test; the suite target is <5 min total for 6 specs.
  timeout: 60_000,

  // 1 retry in CI to absorb transient flakiness; 0 locally for fast feedback.
  retries: process.env.CI ? 1 : 0,

  // Sequential: tests share a single test DB; parallelism causes data races.
  workers: 1,

  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Don't follow redirects to Stripe/external — test intercepts them.
    extraHTTPHeaders: {},
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start the Next.js dev server unless the caller points at an existing host.
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          // Providers — no real Stripe/email costs in tests.
          AUTH_PROVIDER: "test",
          BILLING_PROVIDER: "test",
          // TestBillingProvider's default webhook secret (see lib/billing/test-provider.ts).
          STRIPE_WEBHOOK_SECRET: "test_whsec",
          // E2E seeding opt-in for routes that write test data.
          ALLOW_E2E_SEED: "yes",
          E2E_SEED_MAX_EXISTING_WORKSPACES: "200",
          // Surface these so the dev server can mint/verify sessions and encrypt payloads.
          SESSION_PASSWORD: process.env.SESSION_PASSWORD ?? "",
          ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? "",
          DATABASE_URL: process.env.DATABASE_URL ?? "",
          DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "",
          APP_PUBLIC_ORIGIN: BASE_URL,
        },
      },
});
