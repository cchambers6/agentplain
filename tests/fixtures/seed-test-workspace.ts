/**
 * tests/fixtures/seed-test-workspace.ts
 *
 * Designated test-workspace seed for the marketplace MCP smoke suite
 * (`lib/integrations/__tests__/marketplace-smoke.test.ts`), Stream B.1.1.
 *
 * Two distinct things live here, kept apart on purpose:
 *
 *   1. A stable workspace id + fixture seeds that the *test-impl* MCP
 *      servers consume. These need NO database and NO network — the
 *      `Test*McpServer` classes are pure in-memory (verified in each
 *      connector's `test-server.ts`). This is what makes the smoke suite
 *      run green in CI without provisioning anything.
 *
 *   2. `hasProvisionedCredential()` — the gate for the *prod-impl* path.
 *      Per `feedback_integration_acceptance_is_functional.md`, the real
 *      bar is the value loop running against a connected workspace's
 *      stored credential. We do NOT fake that: if no IntegrationCredential
 *      row exists (or there is no reachable database at all), the prod
 *      real-data test SKIPS with a clear message instead of passing on a
 *      fixture and pretending it proved the loop.
 *
 * Honesty note (see the wave-1 PR description): provisioning a real
 * encrypted IntegrationCredential row for CI is a *follow-up*. It needs a
 * test database + the ENCRYPTION_KEY rail + a verified User/Workspace
 * seed against the live Prisma schema — none of which this environment
 * has. Rather than write a seeder against schema fields we have not
 * verified (which would violate `feedback_no_guesses_no_estimates.md`),
 * we expose the probe and leave the DB seeder as an explicit TODO.
 */

import type { MarketplaceProviderKey } from '@/lib/integrations/marketplace';

/**
 * Stable workspace id used across the smoke suite. Standard UUID v4 shape
 * so it passes the `UUID_RE` the MCP route handlers enforce, in case a
 * future test drives the HTTP route instead of the in-process client.
 */
export const TEST_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/** A second workspace id, used to assert cross-workspace scoping rejects. */
export const OTHER_WORKSPACE_ID = '00000000-0000-4000-8000-0000000000ff';

/**
 * Does a real, provisioned IntegrationCredential row exist for this
 * provider in the test workspace?
 *
 * Returns `false` — never throws — when:
 *   - there is no reachable database (no DATABASE_URL in this env),
 *   - the Prisma client cannot be loaded,
 *   - or no matching row exists.
 *
 * The smoke suite treats `false` as "skip the prod real-data leg" rather
 * than a failure. The Prisma client is imported lazily so that merely
 * loading this fixture never drags in database/env validation at module
 * load time (the suite must import cleanly with no env configured).
 */
export async function hasProvisionedCredential(
  providerKey: MarketplaceProviderKey,
  workspaceId: string = TEST_WORKSPACE_ID,
): Promise<boolean> {
  if (!providerKey) return false;
  if (!process.env.DATABASE_URL) return false;
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const row = await prisma.integrationCredential.findFirst({
        where: { workspaceId, provider: providerKey, status: 'ACTIVE' },
        select: { id: true },
      });
      return row != null;
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  } catch {
    // No DB, no client, or query failed — the honest answer for a smoke
    // gate is "not provisioned", which routes the caller to SKIP.
    return false;
  }
}

// ── Test-impl fixture seeds ────────────────────────────────────────────────
//
// Each connector's `Test*McpServer` ships sensible default fixtures, so the
// smoke suite mostly relies on those. We export a couple of explicit seeds
// where the suite needs a *known* id to round-trip (Excel needs a workbook
// id; the default workbook id is internal to the test server).

/**
 * A known Excel workbook the smoke test reads against. Shapes match
 * `TestExcelSeed` (verified in `excel-mcp/test-server.ts`).
 */
export const EXCEL_TEST_WORKBOOK_ID = 'wb-smoke-001';

export function excelSmokeSeed() {
  return {
    workbooks: [
      {
        id: EXCEL_TEST_WORKBOOK_ID,
        sheets: [
          {
            id: 'sheet-pnl',
            name: 'P&L',
            cells: [
              ['Month', 'Revenue', 'Cost'],
              ['Apr', 12000, 4000],
              ['May', 14500, 4200],
            ] as Array<Array<string | number | boolean | null>>,
          },
        ],
      },
    ],
  };
}
