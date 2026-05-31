/**
 * lib/integrations/karbon-mcp/index.ts
 *
 * Builder + barrel for the Karbon MCP server. `buildKarbonMcpServer`
 * returns the prod server, or the fixture server when
 * `INTEGRATIONS_PROVIDER=test`.
 */

import { KARBON_NAMESPACE, type KarbonMcpServer } from './types';
import { ProdKarbonMcpServer } from './server';
import { TestKarbonMcpServer } from './test-server';
import { KARBON_TOOLS } from './tools';

export function buildKarbonMcpServer(args: { workspaceId: string }): KarbonMcpServer {
  if (process.env.INTEGRATIONS_PROVIDER === 'test') {
    return new TestKarbonMcpServer(args);
  }
  return new ProdKarbonMcpServer(args);
}

export { KARBON_TOOLS, KARBON_NAMESPACE };
export type {
  GetClientInput,
  GetClientOutput,
  GetWorkflowInput,
  GetWorkflowOutput,
  KarbonClientSummary,
  KarbonJobSummary,
  KarbonMcpServer,
  KarbonRecurringTaskSummary,
  KarbonWorkflowSummary,
  ListClientsInput,
  ListClientsOutput,
  ListJobsInput,
  ListJobsOutput,
  ListRecurringTasksInput,
  ListRecurringTasksOutput,
  ListWorkflowsInput,
  ListWorkflowsOutput,
} from './types';
export { ProdKarbonMcpServer } from './server';
export { TestKarbonMcpServer } from './test-server';
