/**
 * app/api/integrations/gmail-mcp/[workspaceId]/route.ts
 *
 * Workspace-scoped HTTP entry to the Gmail MCP server. The route is the
 * outer protocol seam — auth + envelope handling — and delegates every
 * tool invocation to `lib/integrations/gmail-mcp/json-rpc.ts:dispatch`.
 * The handler does NOT speak Gmail; only the inner server does.
 *
 * Auth layering:
 *   1. `MCP_API_KEY` shared secret (header `x-agentplain-mcp-key`) when
 *      the caller is fleet code (skill runner, smoke test, cron). This is
 *      the same secret the substrate's knowledge MCP route checks at
 *      `app/api/knowledge/mcp/route.ts:91`.
 *   2. Optional session-based fall-through: if no API key header is
 *      present, fall back to `requireUser` + workspace-membership check.
 *      An operator or workspace-member browser can invoke tools via this
 *      route in a dev console without minting a service key.
 *
 * Workspace boundary: the `[workspaceId]` path param is the SOURCE OF
 * TRUTH. The route asserts the caller has authority over THAT workspace
 * specifically — either by API-key (operator/system context) or by
 * verified active membership. The server constructed in this handler is
 * bound to that workspace and no other; cross-workspace queries are
 * impossible from a single request.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this route imports the MCP
 * surface only. Direct `googleapis` calls don't appear here.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/lib/auth/session';
import { withSystemContext } from '@/lib/db/rls';
import {
  buildGmailMcpServer,
  dispatch,
  gmailErrorCodeToHttpStatus,
  JSON_RPC_ERROR,
  type GmailMcpErrorCode,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from '@/lib/integrations/gmail-mcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MCP_AUTH_HEADER = 'x-agentplain-mcp-key';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ workspaceId: string }>;
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { workspaceId } = await ctx.params;
  if (!UUID_RE.test(workspaceId)) {
    return jsonRpc(null, {
      code: JSON_RPC_ERROR.INVALID_PARAMS,
      message: `Invalid workspaceId: ${workspaceId}`,
    }, 400);
  }

  const authResult = await authorize(req, workspaceId);
  if (!authResult.ok) {
    return jsonRpc(null, {
      code: JSON_RPC_ERROR.WORKSPACE_FORBIDDEN,
      message: authResult.error,
    }, authResult.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonRpc(null, {
      code: JSON_RPC_ERROR.PARSE_ERROR,
      message: 'Parse error',
    }, 400);
  }

  if (!isJsonRpcRequest(body)) {
    return jsonRpc(extractId(body), {
      code: JSON_RPC_ERROR.INVALID_REQUEST,
      message: 'Invalid JSON-RPC 2.0 request',
    }, 400);
  }

  const server = buildGmailMcpServer({ workspaceId });
  const response = await dispatch(body, { server });
  const status = responseHttpStatus(response);
  return NextResponse.json(response, { status });
}

/**
 * GET surfaces the server's MCP metadata: tool list + resource list. This
 * is the discovery shape MCP clients use to learn what a server offers.
 * The body still flows through `dispatch` so the wire format is identical
 * to a `tools/list` JSON-RPC call.
 */
export async function GET(
  req: NextRequest,
  ctx: RouteContext,
): Promise<NextResponse> {
  const { workspaceId } = await ctx.params;
  if (!UUID_RE.test(workspaceId)) {
    return NextResponse.json({ error: 'invalid_workspace_id' }, { status: 400 });
  }
  const authResult = await authorize(req, workspaceId);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const server = buildGmailMcpServer({ workspaceId });
  const tools = await dispatch(
    { jsonrpc: '2.0', id: 'discovery-tools', method: 'tools/list' },
    { server },
  );
  const resources = await dispatch(
    { jsonrpc: '2.0', id: 'discovery-resources', method: 'resources/list' },
    { server },
  );
  return NextResponse.json({
    workspaceId,
    server: { name: server.name, version: '1.0.0', protocol: 'jsonrpc-2.0' },
    tools: extractResult(tools),
    resources: extractResult(resources),
  });
}

// ── auth + helpers ─────────────────────────────────────────────────────

type AuthOk = { ok: true };
type AuthErr = { ok: false; error: string; status: number };

async function authorize(req: NextRequest, workspaceId: string): Promise<AuthOk | AuthErr> {
  const apiKeyHeader = req.headers.get(MCP_AUTH_HEADER);
  const expected = process.env.MCP_API_KEY;
  if (apiKeyHeader) {
    if (!expected) {
      return { ok: false, error: 'Server not configured: MCP_API_KEY unset', status: 503 };
    }
    if (apiKeyHeader !== expected) {
      return { ok: false, error: 'Invalid MCP API key', status: 401 };
    }
    return { ok: true };
  }
  // Fall back to session-based auth. Read the session cookie directly so
  // we don't redirect on miss (route handlers should 401, not redirect).
  const session = await readSession();
  if (!session) {
    return { ok: false, error: 'Authentication required', status: 401 };
  }
  if (session.isOperator) {
    return { ok: true };
  }
  const membership = await withSystemContext((tx) =>
    tx.membership.findFirst({
      where: {
        userId: session.userId,
        workspaceId,
        status: 'ACTIVE',
      },
      select: { id: true },
    }),
  );
  if (!membership) {
    return {
      ok: false,
      error: 'Forbidden — user is not an active member of this workspace',
      status: 403,
    };
  }
  return { ok: true };
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
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
  return NextResponse.json(
    { jsonrpc: '2.0', id, error },
    { status },
  );
}

function responseHttpStatus(response: JsonRpcResponse<unknown>): number {
  if ('result' in response) return 200;
  const code = response.error.code;
  const data = response.error.data as { code?: GmailMcpErrorCode } | undefined;
  if (data?.code) return gmailErrorCodeToHttpStatus(data.code);
  switch (code) {
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
    case JSON_RPC_ERROR.UPSTREAM_ERROR:
      return 502;
    case JSON_RPC_ERROR.INTERNAL_ERROR:
    default:
      return 500;
  }
}

function extractResult(response: JsonRpcResponse<unknown>): unknown {
  if ('result' in response) return response.result;
  return { error: response.error };
}
