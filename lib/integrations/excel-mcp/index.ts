/**
 * lib/integrations/excel-mcp/index.ts
 *
 * Public entrypoint for the workspace-scoped Excel MCP server.
 */

import { ProdExcelMcpServer } from './server';
import { TestExcelMcpServer, type TestExcelSeed } from './test-server';
import type { ExcelMcpServer } from './types';

export interface ExcelMcpFactoryArgs {
  workspaceId: string;
  preferTestImpl?: boolean;
  testSeed?: TestExcelSeed;
  fetchImpl?: typeof fetch;
}

export function buildExcelMcpServer(args: ExcelMcpFactoryArgs): ExcelMcpServer {
  const useTest =
    args.preferTestImpl === true ||
    process.env.TEST_M365_MCP === 'true' ||
    process.env.TEST_EXCEL_MCP === 'true' ||
    process.env.INTEGRATIONS_PROVIDER === 'test';
  if (useTest) {
    return new TestExcelMcpServer({
      workspaceId: args.workspaceId,
      seed: args.testSeed,
    });
  }
  return new ProdExcelMcpServer({
    workspaceId: args.workspaceId,
    fetchImpl: args.fetchImpl,
  });
}

export type { ExcelMcpServer } from './types';
export { ProdExcelMcpServer } from './server';
export { TestExcelMcpServer, type TestExcelSeed } from './test-server';
export {
  dispatch,
  InProcessExcelMcpClient,
  ExcelMcpClientError,
  excelErrorCodeToHttpStatus,
} from './json-rpc';
export { resolveCredential } from './auth';
export {
  EXCEL_TOOL_NAMES,
  type AppendTableRowInput,
  type AppendTableRowOutput,
  type ExcelToolName,
  type ListSheetsInput,
  type ListSheetsOutput,
  type ReadRangeInput,
  type ReadRangeOutput,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ReadTableInput,
  type ReadTableOutput,
  type RecalculateWorkbookInput,
  type RecalculateWorkbookOutput,
  type ResourceDescriptor,
  type RunNamedFunctionInput,
  type RunNamedFunctionOutput,
  type SheetDescriptor,
  type WriteRangeInput,
  type WriteRangeOutput,
} from './types';
export {
  JSON_RPC_ERROR,
  mcpError,
  mcpOk,
  type McpError,
  type McpErrorCode,
  type McpResult,
  type JsonRpcError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
} from '@/lib/integrations/microsoft/mcp-common';
