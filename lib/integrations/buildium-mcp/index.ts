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

import {
  buildConnectorApprovalDeps,
  type ConnectorApprovalDeps,
} from '@/lib/integrations/approval';
import { ProdBuildiumMcpServer } from './server';
import { TestBuildiumMcpServer } from './test-server';
import { withBuildiumApproval } from './with-approval';
import type { BuildiumMcpServer } from './types';

/** True when live Buildium calls are explicitly enabled. Default: false. */
export function isBuildiumLive(): boolean {
  return process.env.BUILDIUM_ADAPTER_LIVE === 'on';
}

/**
 * Build the Buildium MCP server. Every mutating method is approval-gated at
 * this seam — an ungated server can't be obtained. The fixture server backs
 * `INTEGRATIONS_PROVIDER=test` and the flag-off default; the live REST server
 * runs only when `BUILDIUM_ADAPTER_LIVE=on`. Tests inject `deps` carrying an
 * in-memory gate + audit sink so they can seed grants deterministically.
 */
export function buildBuildiumMcpServer(args: {
  workspaceId: string;
  deps?: ConnectorApprovalDeps;
}): BuildiumMcpServer {
  const deps = args.deps ?? buildConnectorApprovalDeps();
  const inner: BuildiumMcpServer =
    process.env.INTEGRATIONS_PROVIDER !== 'test' && isBuildiumLive()
      ? new ProdBuildiumMcpServer(args)
      : new TestBuildiumMcpServer(args);
  return withBuildiumApproval(inner, deps);
}

export { BUILDIUM_TOOLS, BUILDIUM_NAMESPACE } from './tools';
export { ProdBuildiumMcpServer } from './server';
export { TestBuildiumMcpServer, type RecordedBuildiumCall } from './test-server';
export { withBuildiumApproval } from './with-approval';
export {
  BUILDIUM_CONNECTOR,
  buildiumAction,
  CREATE_WORK_ORDER,
  CHARGE_LATE_FEE,
  POST_NOTICE,
  SEND_TENANT_MSG,
  type WriteActionDescriptor,
  type CreateWorkOrderInput,
  type CreateWorkOrderOutput,
  type ChargeLateFeeInput,
  type ChargeLateFeeOutput,
  type PostNoticeInput,
  type PostNoticeOutput,
  type SendTenantMsgInput,
  type SendTenantMsgOutput,
} from './actions';
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
