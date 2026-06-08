/**
 * lib/integrations/qualia-mcp/index.ts
 *
 * Builder + barrel for the Qualia MCP server.
 *
 * `buildQualiaMcpServer` returns the LIVE REST server when
 * `QUALIA_ADAPTER_LIVE=on`, otherwise the fixture server (the keystone
 * "fixtures by default, flag to go live" decision). It ALSO returns the
 * fixture server whenever `INTEGRATIONS_PROVIDER=test` — parity with the
 * registry switch used by the other MCP servers.
 *
 * Cold-start safe: the flag is read at build time on every fire (the builder
 * is called per-fetch by the consuming adapter, never memoized), so flipping
 * the flag takes effect on the next run with no restart.
 */

import { ProdQualiaMcpServer } from './server';
import { TestQualiaMcpServer } from './test-server';
import type { QualiaMcpServer } from './types';

/** True when live Qualia calls are explicitly enabled. Default: false. */
export function isQualiaLive(): boolean {
  return process.env.QUALIA_ADAPTER_LIVE === 'on';
}

export function buildQualiaMcpServer(args: { workspaceId: string }): QualiaMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestQualiaMcpServer(args);
  }
  if (isQualiaLive()) return new ProdQualiaMcpServer(args);
  return new TestQualiaMcpServer(args);
}

export { ProdQualiaMcpServer, qualiaApiBase } from './server';
export { TestQualiaMcpServer, QUALIA_FIXTURE_ORDER_ID } from './test-server';
export { resolveQualiaCredential, type ResolvedQualia } from './auth';
export type {
  GetClosingOrderInput,
  GetClosingOrderOutput,
  QualiaChecklistItem,
  QualiaMcpServer,
  QualiaOrderSummary,
  QualiaParty,
  QualiaPartyRole,
  QualiaReceivedDoc,
} from './types';
