/**
 * lib/integrations/clio-mcp/index.ts
 *
 * Builder + barrel for the Clio MCP server. `buildClioMcpServer` returns the
 * prod server, or the fixture server when `INTEGRATIONS_PROVIDER=test`.
 *
 * The server itself is the approval seam: its mutating methods funnel through
 * `mcp-core/approval.ts` and cannot reach Clio without a recorded human
 * approval (`project_no_outbound_architecture.md`). The route is therefore
 * approval-gated by construction — there is no way to obtain an ungated Clio
 * server from this factory.
 */

import { CLIO_NAMESPACE, type ClioMcpServer } from './types';
import { ProdClioMcpServer } from './server';
import { TestClioMcpServer } from './test-server';
import { CLIO_TOOLS } from './tools';

export function buildClioMcpServer(args: { workspaceId: string }): ClioMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestClioMcpServer(args);
  }
  return new ProdClioMcpServer(args);
}

export { CLIO_TOOLS, CLIO_NAMESPACE };
export type {
  ClioMatterSummary,
  ClioMcpServer,
  CreateBillInput,
  CreateBillOutput,
  CreateMatterInput,
  CreateMatterOutput,
  ListMattersInput,
  ListMattersOutput,
  LogTimeInput,
  LogTimeOutput,
  SendSecureMessageInput,
  SendSecureMessageOutput,
} from './types';
export { ProdClioMcpServer } from './server';
export { TestClioMcpServer } from './test-server';
