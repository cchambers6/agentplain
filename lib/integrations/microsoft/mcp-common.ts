/**
 * lib/integrations/microsoft/mcp-common.ts
 *
 * Shared protocol scaffolding for the Microsoft-Graph-backed MCP servers
 * that landed after Outlook Phase B: Teams, OneDrive, Excel. Each of those
 * three integrations sits behind its own `*-mcp/` folder mirroring the
 * Outlook layout, but the boilerplate that does NOT depend on the tool
 * surface lives here so we don't triplicate it:
 *
 *   * Result discriminated union (`McpResult<T>`) + `mcpOk` / `mcpError`.
 *   * Error code enum (`McpErrorCode`) — universal across Teams / OneDrive
 *     / Excel because the surface-level failure modes (auth, rate limit,
 *     network, malformed) don't change between Graph endpoints.
 *   * JSON-RPC envelope types + standard JSON_RPC_ERROR codes — identical
 *     to the values Outlook + Gmail MCP use, so MCP clients can speak to
 *     all four servers with one error-mapping table.
 *   * Microsoft Graph HTTP-status → `McpErrorCode` mapper. Every Graph
 *     server reuses the same status interpretation; centralising it here
 *     avoids drift across the four implementations.
 *   * Small string-helpers (skiptoken extraction, OData heuristic).
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file imports nothing from
 * `@microsoft/microsoft-graph-client` or any Microsoft SDK. It only knows
 * the SHAPE of Graph errors — the actual fetch lives in
 * `lib/integrations/microsoft/graph-client.ts`.
 *
 * Per `feedback_runner_portability.md`: every integration's `server.ts`
 * and `test-server.ts` consume these types only. Two-implementation rule
 * is honoured at the per-integration level (prod + test), not here.
 *
 * Why NOT also use this from `lib/integrations/outlook-mcp/types.ts`:
 * outlook-mcp shipped first with its own typed surface and we deliberately
 * avoid retrofitting working code (see CLAUDE: "don't refactor beyond the
 * task"). The Outlook types are a structural superset of these — a future
 * cleanup can collapse them once we're sure Graph-side error semantics
 * stay stable across the four integrations.
 */

// ── Result shape ────────────────────────────────────────────────────────

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
  | 'NOT_IMPLEMENTED';

export interface McpError {
  code: McpErrorCode;
  message: string;
  /** HTTP status from the upstream Graph call when applicable. */
  status?: number;
  /** Vendor-specific reference id (Microsoft Graph `error.code`). */
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

// ── Microsoft Graph error mapping ───────────────────────────────────────

interface GraphErrorBody {
  error?: {
    code?: string;
    message?: string;
    innerError?: { code?: string; message?: string; 'request-id'?: string };
  };
}

/**
 * Translate a Microsoft Graph HTTP error response to an `McpResult` failure
 * with a typed `McpErrorCode`. Centralised so the four MCP servers cannot
 * drift on what an HTTP 429 means (it always means RATE_LIMITED; the
 * Outlook server doing something subtly different here would be a bug).
 */
export function mapGraphError(
  status: number,
  body: unknown,
): { ok: false; error: McpError } {
  const errBody = (body as GraphErrorBody | null)?.error;
  const reference = errBody?.code ?? `http_${status}`;
  const message = errBody?.message ?? `Microsoft Graph returned HTTP ${status}`;
  if (status === 401) return mcpError('TOKEN_EXPIRED', message, { status, reference });
  if (status === 403) return mcpError('FORBIDDEN', message, { status, reference });
  if (status === 404) return mcpError('NOT_FOUND', message, { status, reference });
  if (status === 429) return mcpError('RATE_LIMITED', message, { status, reference });
  if (status >= 500) return mcpError('UPSTREAM_ERROR', message, { status, reference });
  if (status === 400) return mcpError('INVALID_ARGUMENT', message, { status, reference });
  return mcpError('UPSTREAM_ERROR', message, { status, reference });
}

// ── Small OData helpers ─────────────────────────────────────────────────

/**
 * Heuristic: an OData $filter expression contains a known operator token
 * (`eq`, `ne`, `contains`, `startswith`, `lt`, `gt`, etc.) with word
 * boundaries around it. Bare keyword searches don't, so we route those
 * through `$search` instead. Mirrors the Outlook server's parser exactly.
 */
export function looksLikeODataFilter(s: string): boolean {
  return /\b(eq|ne|contains|startswith|endswith|lt|gt|le|ge|and|or)\b/i.test(s);
}

/**
 * Microsoft Graph returns paging cursors as a full `@odata.nextLink` URL
 * with a `$skiptoken` query param. We persist just the token across calls
 * so the wire shape (`pageToken` string) matches Gmail's.
 */
export function extractSkipToken(nextLink: string | null): string | null {
  if (!nextLink) return null;
  try {
    const url = new URL(nextLink);
    return url.searchParams.get('$skiptoken') ?? url.searchParams.get('$skipToken');
  } catch {
    return null;
  }
}

// ── HTTP status mapping for route handlers ──────────────────────────────

export function mcpErrorCodeToHttpStatus(code: McpErrorCode): number {
  switch (code) {
    case 'INVALID_ARGUMENT':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
    case 'GRANT_REVOKED':
      return 403;
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

// ── JSON-RPC envelopes (MCP-style) ──────────────────────────────────────

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

/**
 * Standard JSON-RPC error codes plus the application-tier additions we
 * share across Microsoft-Graph-backed MCP servers. Numeric values match
 * `lib/integrations/outlook-mcp/types.ts:JSON_RPC_ERROR` so a single client
 * error-mapping table works for outlook, teams, onedrive, excel.
 */
export const JSON_RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  WORKSPACE_FORBIDDEN: -32001,
  CREDENTIAL_NOT_FOUND: -32002,
  UPSTREAM_ERROR: -32003,
} as const;

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
