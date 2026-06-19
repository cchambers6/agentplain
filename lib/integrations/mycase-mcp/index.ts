/**
 * lib/integrations/mycase-mcp/index.ts
 *
 * Builder + barrel for the MyCase MCP server. `buildMyCaseMcpServer` returns
 * the prod server, or the fixture server when `INTEGRATIONS_PROVIDER=test`.
 *
 * The server itself is the approval seam: its mutating methods funnel through
 * `mcp-core/approval.ts` and cannot reach MyCase without a recorded human
 * approval (`project_no_outbound_architecture.md`). The route is therefore
 * approval-gated by construction — there is no way to obtain an ungated MyCase
 * server from this factory.
 */

import { MYCASE_NAMESPACE, type MyCaseMcpServer } from './types';
import { ProdMyCaseMcpServer } from './server';
import { TestMyCaseMcpServer } from './test-server';
import { MYCASE_TOOLS } from './tools';

export function buildMyCaseMcpServer(args: { workspaceId: string }): MyCaseMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestMyCaseMcpServer(args);
  }
  return new ProdMyCaseMcpServer(args);
}

export { MYCASE_TOOLS, MYCASE_NAMESPACE };
export type {
  CreateCaseInput,
  CreateCaseOutput,
  ListCasesInput,
  ListCasesOutput,
  MyCaseCaseSummary,
  MyCaseMcpServer,
  SendInvoiceInput,
  SendInvoiceOutput,
  UpdateStatusInput,
  UpdateStatusOutput,
} from './types';
export { ProdMyCaseMcpServer } from './server';
export { TestMyCaseMcpServer } from './test-server';
