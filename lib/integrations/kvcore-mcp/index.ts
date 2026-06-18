/**
 * lib/integrations/kvcore-mcp/index.ts
 *
 * Builder + barrel for the kvCORE MCP server. `buildKvcoreMcpServer` returns the
 * prod server, or the fixture server when `INTEGRATIONS_PROVIDER=test`.
 *
 * The server itself is the approval seam: its mutating methods funnel through
 * `mcp-core/approval.ts` and cannot reach kvCORE without a recorded human
 * approval (`project_no_outbound_architecture.md`). The route is therefore
 * approval-gated by construction — there is no way to obtain an ungated kvCORE
 * server from this factory.
 */

import { KVCORE_NAMESPACE, type KvcoreMcpServer } from './types';
import { ProdKvcoreMcpServer } from './server';
import { TestKvcoreMcpServer } from './test-server';
import { KVCORE_TOOLS } from './tools';

export function buildKvcoreMcpServer(args: { workspaceId: string }): KvcoreMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestKvcoreMcpServer(args);
  }
  return new ProdKvcoreMcpServer(args);
}

export { KVCORE_TOOLS, KVCORE_NAMESPACE };
export type {
  CreateLeadInput,
  CreateLeadOutput,
  KvcoreLeadSummary,
  KvcoreMcpServer,
  ListLeadsInput,
  ListLeadsOutput,
  LogActivityInput,
  LogActivityOutput,
  SendMassMessageInput,
  SendMassMessageOutput,
} from './types';
export { ProdKvcoreMcpServer } from './server';
export { TestKvcoreMcpServer } from './test-server';
