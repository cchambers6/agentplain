/**
 * lib/integrations/ezlynx-mcp/index.ts
 *
 * Builder + barrel for the EZLynx MCP server.
 *
 * `buildEzlynxMcpServer` returns the LIVE REST server when
 * `EZLYNX_ADAPTER_LIVE=on`, otherwise the fixture server (the keystone
 * "fixtures by default, flag to go live" decision). It ALSO returns the
 * fixture server whenever `INTEGRATIONS_PROVIDER=test`.
 *
 * Cold-start safe: the flag is read at build time on every fire.
 */

import { ProdEzlynxMcpServer } from './server';
import { TestEzlynxMcpServer } from './test-server';
import type { EzlynxMcpServer } from './types';

/** True when live EZLynx calls are explicitly enabled. Default: false. */
export function isEzlynxLive(): boolean {
  return process.env.EZLYNX_ADAPTER_LIVE === 'on';
}

export function buildEzlynxMcpServer(args: { workspaceId: string }): EzlynxMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestEzlynxMcpServer(args);
  }
  if (isEzlynxLive()) return new ProdEzlynxMcpServer(args);
  return new TestEzlynxMcpServer(args);
}

export { ProdEzlynxMcpServer } from './server';
export { TestEzlynxMcpServer, EZLYNX_FIXTURE_INSURED } from './test-server';
export { resolveEzlynxCredential, type ResolvedEzlynx } from './auth';
export {
  EZLYNX_API_BASE,
  type EzlynxCoverageLine,
  type EzlynxMcpServer,
  type EzlynxPolicy,
  type ListPoliciesInput,
  type ListPoliciesOutput,
} from './types';
