/**
 * lib/integrations/mcp-core/types.ts
 *
 * Vendor-neutral MCP protocol core. The shipped Gmail + Outlook MCP servers
 * each carry their own copy of this envelope machinery (they predate this
 * module). The DocuSign / QuickBooks / Google Drive / Slack servers built on
 * the same MCP-first integration pattern share THIS core instead of
 * duplicating it — same JSON-RPC 2.0 shape, same result discriminated union,
 * same error→status mapping — so the pattern lives in one place.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this module is provider-agnostic.
 * It never imports a vendor SDK. Each server keeps its vendor calls behind
 * its own `<vendor>-mcp/server.ts` adapter and only speaks this envelope.
 *
 * Per `feedback_runner_portability.md`: the result + error shapes mirror
 * `lib/integrations/types.ts` so a tool result translates cleanly across the
 * integration boundary.
 */

// ── Result shape ──────────────────────────────────────────────────────────

export type McpErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'MALFORMED_RESPONSE'
  | 'INVALID_ARGUMENT'
  | 'UPSTREAM_ERROR'
  | 'TOKEN_EXPIRED'
  | 'GRANT_REVOKED'
  | 'CREDENTIAL_NOT_FOUND'
  | 'WORKSPACE_NOT_FOUND'
  | 'APPROVAL_REQUIRED'
  | 'NOT_IMPLEMENTED';

export interface McpError {
  code: McpErrorCode;
  message: string;
  /** HTTP status from the upstream vendor call when applicable. */
  status?: number;
  /** Vendor-specific reference id / error code. */
  reference?: string;
}

export type McpResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: McpError };

export function mcpOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function mcpError(
  code: McpErrorCode,
  message: string,
  extra?: Omit<McpError, 'code' | 'message'>,
): { ok: false; error: McpError } {
  return { ok: false, error: { code, message, ...extra } };
}

// ── MCP resources ──────────────────────────────────────────────────────────

export interface ResourceDescriptor {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ReadResourceOutput {
  uri: string;
  mimeType: string;
  /** JSON-encoded body for `application/json`; UTF-8 text otherwise. */
  text: string;
}

// ── A workspace-scoped MCP server ───────────────────────────────────────────

/**
 * Every MCP server built on this core is bound to ONE workspace at
 * construction and exposes a discriminator name + an optional resource
 * surface. Tool methods are described by the server's own `ToolRegistration`
 * list (see `dispatch.ts`), not by this interface — that keeps the tool set
 * open while the protocol envelope stays fixed.
 */
export interface McpServerBase {
  readonly name: string;
  readonly workspaceId: string;
  listResources?(): Promise<McpResult<ResourceDescriptor[]>>;
  readResource?(input: { uri: string }): Promise<McpResult<ReadResourceOutput>>;
}

// ── JSON-RPC envelopes (MCP-style) ──────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number | null;
}

export interface JsonRpcSuccess<T> {
  jsonrpc: '2.0';
  id: string | number | null;
  result: T;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

/** JSON-RPC error codes — spec-standard plus application-tier codes. */
export const JSON_RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  /** Caller is not a member of the workspace. */
  WORKSPACE_FORBIDDEN: -32001,
  /** The integration is not connected for this workspace. */
  CREDENTIAL_NOT_FOUND: -32002,
  /** Upstream vendor returned an error after retries. */
  UPSTREAM_ERROR: -32003,
  /** Tool needs explicit human approval before it can run. */
  APPROVAL_REQUIRED: -32004,
} as const;

// ── Mappers ─────────────────────────────────────────────────────────────────

export function mcpErrorToJsonRpc(err: McpError): number {
  switch (err.code) {
    case 'INVALID_ARGUMENT':
      return JSON_RPC_ERROR.INVALID_PARAMS;
    case 'NOT_FOUND':
      return JSON_RPC_ERROR.METHOD_NOT_FOUND;
    case 'UNAUTHORIZED':
    case 'FORBIDDEN':
    case 'GRANT_REVOKED':
      return JSON_RPC_ERROR.WORKSPACE_FORBIDDEN;
    case 'CREDENTIAL_NOT_FOUND':
    case 'WORKSPACE_NOT_FOUND':
      return JSON_RPC_ERROR.CREDENTIAL_NOT_FOUND;
    case 'APPROVAL_REQUIRED':
      return JSON_RPC_ERROR.APPROVAL_REQUIRED;
    case 'NOT_IMPLEMENTED':
      return JSON_RPC_ERROR.METHOD_NOT_FOUND;
    case 'RATE_LIMITED':
    case 'NETWORK':
    case 'MALFORMED_RESPONSE':
    case 'TOKEN_EXPIRED':
    case 'UPSTREAM_ERROR':
    default:
      return JSON_RPC_ERROR.UPSTREAM_ERROR;
  }
}

export function mcpErrorCodeToHttpStatus(code: McpErrorCode): number {
  switch (code) {
    case 'INVALID_ARGUMENT':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
    case 'GRANT_REVOKED':
      return 403;
    case 'APPROVAL_REQUIRED':
      return 409;
    case 'NOT_FOUND':
    case 'CREDENTIAL_NOT_FOUND':
    case 'WORKSPACE_NOT_FOUND':
      return 404;
    case 'RATE_LIMITED':
      return 429;
    case 'NOT_IMPLEMENTED':
      return 501;
    case 'TOKEN_EXPIRED':
    case 'UPSTREAM_ERROR':
    case 'NETWORK':
    case 'MALFORMED_RESPONSE':
    default:
      return 502;
  }
}
