/**
 * lib/integrations/onedrive-mcp/index.ts
 *
 * Public entrypoint for the workspace-scoped OneDrive / SharePoint MCP
 * server. Mirrors `lib/integrations/outlook-mcp/index.ts`.
 */

import { ProdOneDriveMcpServer } from './server';
import { TestOneDriveMcpServer, type TestOneDriveSeed } from './test-server';
import type { OneDriveMcpServer } from './types';

export interface OneDriveMcpFactoryArgs {
  workspaceId: string;
  preferTestImpl?: boolean;
  testSeed?: TestOneDriveSeed;
  fetchImpl?: typeof fetch;
}

export function buildOneDriveMcpServer(
  args: OneDriveMcpFactoryArgs,
): OneDriveMcpServer {
  const useTest =
    args.preferTestImpl === true ||
    process.env.TEST_M365_MCP === 'true' ||
    process.env.TEST_ONEDRIVE_MCP === 'true' ||
    process.env.INTEGRATIONS_PROVIDER === 'test';
  if (useTest) {
    return new TestOneDriveMcpServer({
      workspaceId: args.workspaceId,
      seed: args.testSeed,
    });
  }
  return new ProdOneDriveMcpServer({
    workspaceId: args.workspaceId,
    fetchImpl: args.fetchImpl,
  });
}

export type { OneDriveMcpServer } from './types';
export { ProdOneDriveMcpServer } from './server';
export { TestOneDriveMcpServer, type TestOneDriveSeed } from './test-server';
export {
  dispatch,
  InProcessOneDriveMcpClient,
  OneDriveMcpClientError,
  onedriveErrorCodeToHttpStatus,
} from './json-rpc';
export { resolveCredential } from './auth';
export {
  ONEDRIVE_TOOL_NAMES,
  type CreateFolderInput,
  type CreateFolderOutput,
  type DownloadFileInput,
  type DownloadFileOutput,
  type FileItem,
  type GetFileMetadataInput,
  type GetFileMetadataOutput,
  type GetRecentFilesInput,
  type GetRecentFilesOutput,
  type ListFilesInput,
  type ListFilesOutput,
  type OneDriveToolName,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SearchFilesInput,
  type SearchFilesOutput,
  type ShareFileInput,
  type ShareFileOutput,
  type SharingLinkSummary,
  type UploadFileInput,
  type UploadFileOutput,
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
