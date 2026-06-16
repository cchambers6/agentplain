/**
 * lib/integrations/buildium-mcp/index.ts
 *
 * Builder + barrel for the Buildium MCP server.
 *
 * `buildBuildiumMcpServer` returns the LIVE REST server when
 * `BUILDIUM_ADAPTER_LIVE=on`, otherwise the fixture server (the keystone
 * "fixtures by default, flag to go live" decision). It ALSO returns the
 * fixture server whenever `INTEGRATIONS_PROVIDER=test` — parity with the
 * registry switch used by the other MCP servers.
 *
 * Cold-start safe: the flag is read at build time on every fire (the
 * builder is called per-fetch by the consuming adapter, never memoized), so
 * flipping the flag takes effect on the next run with no restart.
 */

import { ProdBuildiumMcpServer } from './server';
import { TestBuildiumMcpServer } from './test-server';
import type { BuildiumMcpServer } from './types';

/** True when live Buildium calls are explicitly enabled. Default: false. */
export function isBuildiumLive(): boolean {
  return process.env.BUILDIUM_ADAPTER_LIVE === 'on';
}

export function buildBuildiumMcpServer(args: { workspaceId: string }): BuildiumMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestBuildiumMcpServer(args);
  }
  if (isBuildiumLive()) return new ProdBuildiumMcpServer(args);
  return new TestBuildiumMcpServer(args);
}

export { BUILDIUM_TOOLS, BUILDIUM_NAMESPACE } from './tools';
export { ProdBuildiumMcpServer } from './server';
export { TestBuildiumMcpServer } from './test-server';
export { resolveBuildiumCredential, type ResolvedBuildium } from './auth';
export {
  buildiumHealthCheck,
  BUILDIUM_HEALTH_CHECK,
  type ProviderHealthCheck,
} from './health';
export {
  BUILDIUM_API_BASE,
  type BuildiumHealth,
  type BuildiumLeaseSummary,
  type BuildiumMcpServer,
  type BuildiumTenant,
  type ListDelinquentLeasesInput,
  type ListDelinquentLeasesOutput,
} from './types';
