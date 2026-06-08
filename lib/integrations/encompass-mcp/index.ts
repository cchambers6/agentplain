/**
 * lib/integrations/encompass-mcp/index.ts
 *
 * Builder + barrel for the Encompass MCP server.
 *
 * `buildEncompassMcpServer` returns the LIVE REST server when
 * `ENCOMPASS_ADAPTER_LIVE=on`, otherwise the fixture server (the keystone
 * "fixtures by default, flag to go live" decision). It ALSO returns the
 * fixture server whenever `INTEGRATIONS_PROVIDER=test`.
 *
 * Cold-start safe: the flag is read at build time on every fire.
 */

import { ProdEncompassMcpServer } from './server';
import { TestEncompassMcpServer } from './test-server';
import type { EncompassMcpServer } from './types';

/** True when live Encompass calls are explicitly enabled. Default: false. */
export function isEncompassLive(): boolean {
  return process.env.ENCOMPASS_ADAPTER_LIVE === 'on';
}

export function buildEncompassMcpServer(args: { workspaceId: string }): EncompassMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestEncompassMcpServer(args);
  }
  if (isEncompassLive()) return new ProdEncompassMcpServer(args);
  return new TestEncompassMcpServer(args);
}

export { ProdEncompassMcpServer } from './server';
export { TestEncompassMcpServer, ENCOMPASS_FIXTURE_LOAN_ID } from './test-server';
export { resolveEncompassCredential, type ResolvedEncompass } from './auth';
export {
  ENCOMPASS_API_BASE,
  type EncompassContact,
  type EncompassDocCategory,
  type EncompassLoanSummary,
  type EncompassMcpServer,
  type EncompassOutstandingDoc,
  type GetLoanFileInput,
  type GetLoanFileOutput,
  type ListOutstandingDocsInput,
  type ListOutstandingDocsOutput,
} from './types';
