/**
 * lib/integrations/boldtrail-mcp/index.ts
 *
 * Builder + barrel for the BoldTrail MCP server. `buildBoldtrailMcpServer`
 * returns the prod server, or the fixture server when
 * `INTEGRATIONS_PROVIDER=test`.
 *
 * The server itself is the approval seam: its mutating methods funnel through
 * `mcp-core/approval.ts` and cannot reach BoldTrail without a recorded human
 * approval (`project_no_outbound_architecture.md`). The route is therefore
 * approval-gated by construction — there is no way to obtain an ungated
 * BoldTrail server from this factory.
 */

import { BOLDTRAIL_NAMESPACE, type BoldtrailMcpServer } from './types';
import { ProdBoldtrailMcpServer } from './server';
import { TestBoldtrailMcpServer } from './test-server';
import { BOLDTRAIL_TOOLS } from './tools';

export function buildBoldtrailMcpServer(args: { workspaceId: string }): BoldtrailMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestBoldtrailMcpServer(args);
  }
  return new ProdBoldtrailMcpServer(args);
}

export { BOLDTRAIL_TOOLS, BOLDTRAIL_NAMESPACE };
export type {
  BoldTrailLeadSummary,
  BoldtrailMcpServer,
  ListLeadsInput,
  ListLeadsOutput,
  SendTemplateInput,
  SendTemplateOutput,
  UpdatePipelineInput,
  UpdatePipelineOutput,
} from './types';
export { ProdBoldtrailMcpServer } from './server';
export { TestBoldtrailMcpServer } from './test-server';
