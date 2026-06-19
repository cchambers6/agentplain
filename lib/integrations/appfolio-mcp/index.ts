/**
 * lib/integrations/appfolio-mcp/index.ts
 *
 * Builder + barrel for the AppFolio MCP server. `buildAppfolioMcpServer`
 * returns the prod server, or the fixture server when
 * `INTEGRATIONS_PROVIDER=test`.
 *
 * The server itself is the approval seam: its mutating methods funnel through
 * `mcp-core/approval.ts` and cannot reach AppFolio without a recorded human
 * approval (`project_no_outbound_architecture.md`). The route is therefore
 * approval-gated by construction — there is no way to obtain an ungated
 * AppFolio server from this factory.
 */

import { APPFOLIO_NAMESPACE, type AppfolioMcpServer } from './types';
import { ProdAppfolioMcpServer } from './server';
import { TestAppfolioMcpServer } from './test-server';
import { APPFOLIO_TOOLS } from './tools';

export function buildAppfolioMcpServer(args: { workspaceId: string }): AppfolioMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestAppfolioMcpServer(args);
  }
  return new ProdAppfolioMcpServer(args);
}

export { APPFOLIO_TOOLS, APPFOLIO_NAMESPACE };
export type {
  AppFolioUnitSummary,
  AppfolioMcpServer,
  ChargeTenantInput,
  ChargeTenantOutput,
  CreateWorkOrderInput,
  CreateWorkOrderOutput,
  ListUnitsInput,
  ListUnitsOutput,
  SendNoticeInput,
  SendNoticeOutput,
} from './types';
export { ProdAppfolioMcpServer } from './server';
export { TestAppfolioMcpServer } from './test-server';
