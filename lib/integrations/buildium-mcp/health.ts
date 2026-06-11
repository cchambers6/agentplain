/**
 * lib/integrations/buildium-mcp/health.ts
 *
 * Public Buildium connection health probe + fleet-health registration.
 *
 * `buildiumHealthCheck({ workspaceId })` builds the flagged MCP server
 * (live REST when BUILDIUM_ADAPTER_LIVE=on, fixtures otherwise) and runs its
 * cheap `healthCheck()`. Returns the provider-neutral `BuildiumHealth`
 * status — `{ ok, latencyMs, lastChecked, errorCode? }` — and never throws.
 *
 * Pillar 6 (PR #220 fleet-health cron, now merged) already surfaces a broken
 * Buildium connection automatically: its heartbeat counts per-workspace
 * IntegrationCredential rows in a non-ACTIVE state (EXPIRED / REVOKED /
 * ERROR), so a Buildium credential that goes bad is caught by the generic
 * breakage count with no per-provider wiring. `BUILDIUM_HEALTH_CHECK` below is
 * the DEEPER signal — an active /leases?limit=1 round-trip — which the
 * customer "Test connection" button calls today via the health route, and
 * which a future per-provider active-probe pass in the fleet-health cron can
 * iterate. No-op clean: importing this module has no side effects.
 *
 * Per `feedback_cold_start_safe_agents.md`: builds the server fresh per call
 * (re-reads flag + re-resolves credential). Stateless.
 */

import { buildBuildiumMcpServer } from './index';
import type { BuildiumHealth } from './types';

export async function buildiumHealthCheck(args: {
  workspaceId: string;
}): Promise<BuildiumHealth> {
  try {
    const server = buildBuildiumMcpServer({ workspaceId: args.workspaceId });
    return await server.healthCheck();
  } catch (err) {
    return {
      ok: false,
      latencyMs: 0,
      lastChecked: new Date().toISOString(),
      errorCode: 'NETWORK',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Active-probe descriptor for a future per-provider deep-health pass. The
 * merged #220 cron does status-based breakage counting (cheap, no API call);
 * a deep pass would iterate descriptors like this and run `check(workspaceId)`
 * for each connected provider, alerting L1 (Pillar 3) on repeated failures.
 * Kept here so adding that pass is a one-line import, not a rewrite.
 */
export interface ProviderHealthCheck {
  provider: 'BUILDIUM';
  /** Marketplace entry id used to resolve the connected-workspace set. */
  integrationId: string;
  check: (workspaceId: string) => Promise<BuildiumHealth>;
}

export const BUILDIUM_HEALTH_CHECK: ProviderHealthCheck = {
  provider: 'BUILDIUM',
  integrationId: 'buildium',
  check: (workspaceId: string) => buildiumHealthCheck({ workspaceId }),
};
