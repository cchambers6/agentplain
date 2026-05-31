/**
 * lib/integrations/mcp-core/index.ts
 *
 * Barrel for the vendor-neutral MCP server core. New connectors import from
 * here; the shipped Gmail/Outlook servers keep their own copies and are not
 * migrated (no need to churn working code).
 */

export {
  type McpError,
  type McpErrorCode,
  type McpResult,
  type McpServerBase,
  type ResourceDescriptor,
  type ReadResourceOutput,
  type JsonRpcRequest,
  type JsonRpcResponse,
  JSON_RPC_ERROR,
  mcpOk,
  mcpError,
  mcpErrorToJsonRpc,
  mcpErrorCodeToHttpStatus,
} from './types';

export {
  dispatch,
  InProcessMcpClient,
  McpClientError,
  type ToolRegistration,
  type DispatchConfig,
} from './dispatch';

export {
  handleMcpPost,
  handleMcpGet,
  type McpRouteSpec,
} from './route';

export {
  resolveWorkspaceCredential,
  __resetCredentialCoalescerForTests,
  type RefreshFn,
  type ResolveArgs,
} from './credential';

export {
  resolveApiKeyCredential,
  type ResolveApiKeyArgs,
} from './api-key-credential';
