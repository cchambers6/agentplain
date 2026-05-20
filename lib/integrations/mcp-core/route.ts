/**
 * lib/integrations/mcp-core/route.ts
 *
 * Shared HTTP handlers for workspace-scoped MCP routes. Every
 * `app/api/integrations/<slug>-mcp/[workspaceId]/route.ts` is a thin wrapper
 * that hands these helpers a server factory + tool registry; the auth seam,
 * envelope validation, and status mapping live here so they don't drift
 * across connectors.
 *
 * Auth layering mirrors the shipped Gmail route exactly:
 *   1. `MCP_API_KEY` shared secret (header `x-agentplain-mcp-key`) for fleet
 *      callers (skill runner, smoke test, cron).
 *   2. Session fall-through: operator, or an ACTIVE member of the workspace.
 *
 * The `[workspaceId]` path param is the source of truth — the server built
 * here is bound to THAT workspace, so cross-workspace access is impossible
 * from a single request.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/session';
import { withSystemContext } from '@/lib/db/rls';
import { dispatch, type DispatchConfig } from './dispatch';
import {
  type JsonRpcResponse,
  type McpErrorCode,
  type McpServerBase,
  JSON_RPC_ERROR,
  mcpErrorCodeToHttpStatus,
} from './types';

const MCP_AUTH_HEADER = 'x-agentplain-mcp-key';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface McpRouteSpec<TServer extends McpServerBase> {
  /** Construct the workspace-bound server. */
  buildServer: (args: { workspaceId: string }) => TServer;
  /** Tool registry passed straight to `dispatch`. */
  tools: DispatchConfig<TServer>['tools'];
  /** Namespace prefix (e.g. `docusign`). */
  namespace: string;
  /** Semantic version surfaced in GET discovery. */
  version?: string;
}

export async function handleMcpPost<TServer extends McpServerBase>(
  req: NextRequest,
  workspaceId: string,
  spec: McpRouteSpec<TServer>,
): Promise<NextResponse> {
  if (!UUID_RE.test(workspaceId)) {
    return jsonRpc(null, { code: JSON_RPC_ERROR.INVALID_PARAMS, message: `Invalid workspaceId: ${workspaceId}` }, 400);
  }
  const auth = await authorize(req, workspaceId);
  if (!auth.ok) {
    return jsonRpc(null, { code: JSON_RPC_ERROR.WORKSPACE_FORBIDDEN, message: auth.error }, auth.status);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpc(null, { code: JSON_RPC_ERROR.PARSE_ERROR, message: 'Parse error' }, 400);
  }
  if (!isJsonRpcRequest(body)) {
    return jsonRpc(extractId(body), { code: JSON_RPC_ERROR.INVALID_REQUEST, message: 'Invalid JSON-RPC 2.0 request' }, 400);
  }
  const server = spec.buildServer({ workspaceId });
  const response = await dispatch(body, { server, tools: spec.tools, namespace: spec.namespace });
  return NextResponse.json(response, { status: responseHttpStatus(response) });
}

export async function handleMcpGet<TServer extends McpServerBase>(
  req: NextRequest,
  workspaceId: string,
  spec: McpRouteSpec<TServer>,
): Promise<NextResponse> {
  if (!UUID_RE.test(workspaceId)) {
    return NextResponse.json({ error: 'invalid_workspace_id' }, { status: 400 });
  }
  const auth = await authorize(req, workspaceId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const server = spec.buildServer({ workspaceId });
  const config = { server, tools: spec.tools, namespace: spec.namespace };
  const tools = await dispatch({ jsonrpc: '2.0', id: 'discovery-tools', method: 'tools/list' }, config);
  const resources = await dispatch({ jsonrpc: '2.0', id: 'discovery-resources', method: 'resources/list' }, config);
  return NextResponse.json({
    workspaceId,
    server: { name: server.name, version: spec.version ?? '1.0.0', protocol: 'jsonrpc-2.0' },
    tools: extractResult(tools),
    resources: extractResult(resources),
  });
}

// ── auth + helpers ───────────────────────────────────────────────────────

type AuthOk = { ok: true };
type AuthErr = { ok: false; error: string; status: number };

async function authorize(req: NextRequest, workspaceId: string): Promise<AuthOk | AuthErr> {
  const apiKeyHeader = req.headers.get(MCP_AUTH_HEADER);
  const expected = process.env.MCP_API_KEY;
  if (apiKeyHeader) {
    if (!expected) return { ok: false, error: 'Server not configured: MCP_API_KEY unset', status: 503 };
    if (apiKeyHeader !== expected) return { ok: false, error: 'Invalid MCP API key', status: 401 };
    return { ok: true };
  }
  const session = await readSession();
  if (!session) return { ok: false, error: 'Authentication required', status: 401 };
  if (session.isOperator) return { ok: true };
  const membership = await withSystemContext((tx) =>
    tx.membership.findFirst({
      where: { userId: session.userId, workspaceId, status: 'ACTIVE' },
      select: { id: true },
    }),
  );
  if (!membership) {
    return { ok: false, error: 'Forbidden — user is not an active member of this workspace', status: 403 };
  }
  return { ok: true };
}

function isJsonRpcRequest(value: unknown): value is { jsonrpc: '2.0'; method: string } {
  if (!value || typeof value !== 'object') return false;
  const v = value as { jsonrpc?: unknown; method?: unknown };
  return v.jsonrpc === '2.0' && typeof v.method === 'string';
}

function extractId(value: unknown): string | number | null {
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number') return id;
  }
  return null;
}

function jsonRpc(
  id: string | number | null,
  error: { code: number; message: string; data?: unknown },
  status: number,
): NextResponse {
  return NextResponse.json({ jsonrpc: '2.0', id, error }, { status });
}

function responseHttpStatus(response: JsonRpcResponse<unknown>): number {
  if ('result' in response) return 200;
  const data = response.error.data as { code?: McpErrorCode } | undefined;
  if (data?.code) return mcpErrorCodeToHttpStatus(data.code);
  switch (response.error.code) {
    case JSON_RPC_ERROR.PARSE_ERROR:
    case JSON_RPC_ERROR.INVALID_REQUEST:
    case JSON_RPC_ERROR.INVALID_PARAMS:
      return 400;
    case JSON_RPC_ERROR.METHOD_NOT_FOUND:
      return 404;
    case JSON_RPC_ERROR.WORKSPACE_FORBIDDEN:
      return 403;
    case JSON_RPC_ERROR.CREDENTIAL_NOT_FOUND:
      return 404;
    case JSON_RPC_ERROR.APPROVAL_REQUIRED:
      return 409;
    case JSON_RPC_ERROR.UPSTREAM_ERROR:
      return 502;
    default:
      return 500;
  }
}

function extractResult(response: JsonRpcResponse<unknown>): unknown {
  if ('result' in response) return response.result;
  return { error: response.error };
}
