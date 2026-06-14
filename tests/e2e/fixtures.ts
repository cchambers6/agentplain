/**
 * tests/e2e/fixtures.ts
 *
 * Extended Playwright test fixture that wires seed + session into every spec.
 * Each test gets an isolated seed key so concurrent CI runs don't collide.
 *
 * Usage:
 *   import { test, expect } from './fixtures';
 *   test('my test', async ({ page, seeded, authCookie }) => { ... });
 */

import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  buildSeedPlan,
  seedTestWorkspace,
  teardownTestWorkspace,
  type SeedRunResult,
} from "../fixtures/seed-test-workspace";
import { buildSessionPayload, mintSession } from "../fixtures/mint-session";
import { sealSessionToken } from "@/lib/auth/session";
import { env } from "@/lib/env";

export { expect };

export interface SeededContext extends SeedRunResult {
  /** The sealed iron-session cookie value — set on the browser context. */
  sessionToken: string;
}

type E2EFixtures = {
  /** Unique per-test seed key, guarantees DB isolation across parallel CI workers. */
  seedKey: string;
  /** Seeded workspace + user + approvals in the test DB. */
  seeded: SeededContext;
  /**
   * Page with the session cookie pre-set. Navigating to any authenticated
   * route works without going through the sign-in flow.
   */
  authedPage: Page;
};

/**
 * Whether the DB seeding rails are available. When not, tests that need
 * seeded data will skip rather than fail — this keeps CI green without a DB.
 */
function canSeed(): boolean {
  return (
    !!process.env.DATABASE_URL &&
    process.env.ALLOW_E2E_SEED === "yes"
  );
}

export const test = base.extend<E2EFixtures>({
  // Each test worker gets a unique key derived from the test title hash.
  seedKey: async ({}, use, testInfo) => {
    // Short stable key from the test index so teardown targets the right rows.
    const key = `pw-${testInfo.workerIndex}-${testInfo.testId.slice(0, 8)}`;
    await use(key);
  },

  seeded: async ({ seedKey }, use) => {
    if (!canSeed()) {
      // Provide a stub so test bodies can check seeded.workspaceId without crashing;
      // tests that need the DB will skip() themselves.
      const plan = buildSeedPlan({ key: seedKey });
      const stub: SeededContext = {
        plan,
        workspaceId: plan.workspace.id,
        userId: plan.user.id,
        slug: plan.workspace.slug,
        sessionToken: "",
      };
      await use(stub);
      return;
    }

    const prisma = new PrismaClient();
    try {
      const result = await seedTestWorkspace({
        client: prisma as never,
        key: seedKey,
      });
      const minted = await mintSession({
        userId: result.userId,
        email: result.plan.markers.ownerEmail,
        activeWorkspaceId: result.workspaceId,
      });
      await use({ ...result, sessionToken: minted.token });
    } finally {
      // Teardown regardless of test pass/fail.
      await teardownTestWorkspace(prisma as never, { key: seedKey });
      await prisma.$disconnect();
    }
  },

  authedPage: async ({ page, seeded }, use) => {
    if (seeded.sessionToken) {
      const cookieName = env.sessionCookieName();
      await page.context().addCookies([
        {
          name: cookieName,
          value: seeded.sessionToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    }
    await use(page);
  },
});

/**
 * Mint a session token without the fixture (for use in global setup or
 * one-off calls where the fixture isn't available).
 */
export async function mintTestSession(input: {
  userId: string;
  email: string;
  workspaceId: string | null;
}): Promise<string> {
  const payload = buildSessionPayload({
    userId: input.userId,
    email: input.email,
    activeWorkspaceId: input.workspaceId,
    isOperator: false,
  });
  return sealSessionToken(payload, { remember: true });
}

/**
 * Skip the test if DB seeding is not available. Call at the top of any
 * test that needs seeded data. `testInfo` is the second arg to the Playwright
 * test callback: `test('...', async (fixtures, testInfo) => { skipIfNoDb(testInfo); })`.
 */
export function skipIfNoDb(testInfo: import("@playwright/test").TestInfo): void {
  if (!canSeed()) {
    testInfo.skip(true, "DATABASE_URL / ALLOW_E2E_SEED not configured — skip DB-dependent test");
  }
}
