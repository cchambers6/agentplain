/**
 * app/api/knowledge/mcp/route.ts
 *
 * MCP-style JSON-RPC 2.0 endpoint exposing the knowledge substrate.
 * Fleet agents call this route to query (`knowledge.search`), seed
 * (`knowledge.upsert`), and prune (`knowledge.delete`) the substrate
 * defined in `lib/knowledge/`.
 *
 * Per `project_knowledge_substrate.md`:
 *   * Workspace_id RLS enforced — customer queries can only return their
 *     own + non-customer-scoped rows. The route resolves the caller's
 *     RLS context from request headers and builds the store with it.
 *   * The methods are `knowledge.search`, `knowledge.upsert`,
 *     `knowledge.delete` — names match the substrate spec.
 *
 * Auth (V1, intentionally simple):
 *   * Header `x-agentplain-mcp-key` MUST match `MCP_API_KEY` env var.
 *     This is a shared secret the fleet's outer wrapper carries; it
 *     gates operator-grade access to the substrate.
 *   * Optional header `x-agentplain-workspace-id` scopes the call to a
 *     specific customer workspace. When set, RLS context is
 *     `{ userId: null, workspaceId, isOperator: false }`; when unset,
 *     calls run as operator/system.
 *
 * JSON-RPC error codes follow the spec: -32700 parse error, -32600
 * invalid request, -32601 method not found, -32602 invalid params,
 * -32603 internal error. Substrate-specific errors map to -32603 with
 * the substrate error code surfaced in `data.code`.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SYSTEM_OPERATOR_CONTEXT } from '@/lib/db/rls';
import { getKnowledgeStore } from '@/lib/knowledge';
import type { KnowledgeError, KnowledgeResult } from '@/lib/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MCP_AUTH_HEADER = 'x-agentplain-mcp-key';
const MCP_WORKSPACE_HEADER = 'x-agentplain-workspace-id';

// ── JSON-RPC schemas ─────────────────────────────────────────────────────

const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.unknown().optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
});

const contextKindSchema = z.enum([
  'SKILL',
  'CUSTOMER',
  'VERTICAL',
  'CROSS_CUSTOMER',
  'COMPLIANCE',
]);

const searchParamsSchema = z.object({
  query: z.string().min(1),
  k: z.number().int().positive().max(100).optional(),
  contextKinds: z.array(contextKindSchema).optional(),
  verticalSlug: z.string().min(1).nullable().optional(),
});

const upsertParamsSchema = z.object({
  contextKind: contextKindSchema,
  workspaceId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceUrl: z.string().url().nullable().optional(),
  verticalSlug: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sourceType: z.string().min(1).optional(),
  sourceId: z.string().min(1).optional(),
});

const deleteParamsSchema = z
  .object({
    embeddingId: z.string().uuid().optional(),
    documentId: z.string().uuid().optional(),
  })
  .refine((v) => Boolean(v.embeddingId || v.documentId), {
    message: 'must provide embeddingId or documentId',
  });

// ── Route handlers ──────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get(MCP_AUTH_HEADER);
  const expected = process.env.MCP_API_KEY;
  if (!expected) {
    return NextResponse.json(
      jsonRpcError(null, -32603, 'Server not configured: MCP_API_KEY unset'),
      { status: 503 },
    );
  }
  if (!auth || auth !== expected) {
    return NextResponse.json(jsonRpcError(null, -32603, 'Unauthorized'), { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(jsonRpcError(null, -32700, 'Parse error'), { status: 400 });
  }

  const parsedReq = jsonRpcRequestSchema.safeParse(body);
  if (!parsedReq.success) {
    return NextResponse.json(
      jsonRpcError(extractId(body), -32600, 'Invalid Request', { issues: parsedReq.error.issues }),
      { status: 400 },
    );
  }
  const { method, params, id } = parsedReq.data;
  const requestId = id ?? null;
  const workspaceHeader = req.headers.get(MCP_WORKSPACE_HEADER);
  const rlsContext = workspaceHeader
    ? { userId: null, workspaceId: workspaceHeader, isOperator: false }
    : { userId: null, workspaceId: null, isOperator: true };

  try {
    switch (method) {
      case 'knowledge.search': {
        const sp = searchParamsSchema.safeParse(params);
        if (!sp.success) {
          return NextResponse.json(
            jsonRpcError(requestId, -32602, 'Invalid params', { issues: sp.error.issues }),
            { status: 400 },
          );
        }
        const store = getKnowledgeStore(rlsContext);
        const result = await store.search(sp.data);
        return respond(requestId, result, (hits) => ({
          hits: hits.map((h) => ({
            embeddingId: h.embeddingId,
            documentId: h.documentId,
            contextKind: h.contextKind,
            workspaceId: h.workspaceId,
            title: h.title,
            body: h.body,
            sourceUrl: h.sourceUrl,
            verticalSlug: h.verticalSlug,
            metadata: h.metadata,
            distance: h.distance,
            similarity: h.similarity,
          })),
        }));
      }
      case 'knowledge.upsert': {
        const up = upsertParamsSchema.safeParse(params);
        if (!up.success) {
          return NextResponse.json(
            jsonRpcError(requestId, -32602, 'Invalid params', { issues: up.error.issues }),
            { status: 400 },
          );
        }
        // Upserts are operator-grade (RLS write policy is is_operator=true).
        // When the caller is workspace-scoped, force the workspace id from
        // the header so the body cannot bypass scoping.
        if (up.data.contextKind === 'CUSTOMER') {
          if (!workspaceHeader) {
            return NextResponse.json(
              jsonRpcError(requestId, -32602, 'CUSTOMER upserts require x-agentplain-workspace-id'),
              { status: 400 },
            );
          }
          up.data.workspaceId = workspaceHeader;
        }
        const writeStore = getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);
        const result = await writeStore.upsert(up.data);
        return respond(requestId, result, (out) => out);
      }
      case 'knowledge.delete': {
        const dp = deleteParamsSchema.safeParse(params);
        if (!dp.success) {
          return NextResponse.json(
            jsonRpcError(requestId, -32602, 'Invalid params', { issues: dp.error.issues }),
            { status: 400 },
          );
        }
        const writeStore = getKnowledgeStore(SYSTEM_OPERATOR_CONTEXT);
        const result = await writeStore.delete(dp.data);
        return respond(requestId, result, (out) => out);
      }
      default:
        return NextResponse.json(
          jsonRpcError(requestId, -32601, `Method not found: ${method}`),
          { status: 404 },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('knowledge.mcp uncaught', err);
    return NextResponse.json(jsonRpcError(requestId, -32603, message), { status: 500 });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function respond<T, U>(
  id: string | number | null,
  result: KnowledgeResult<T>,
  shape: (value: T) => U,
): NextResponse {
  if (!result.ok) {
    return NextResponse.json(
      jsonRpcError(id, -32603, result.error.message, { code: result.error.code, status: result.error.status }),
      { status: errorToHttpStatus(result.error) },
    );
  }
  return NextResponse.json({
    jsonrpc: '2.0',
    id,
    result: shape(result.value),
  });
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string; data?: unknown } } {
  const err: { code: number; message: string; data?: unknown } = { code, message };
  if (data !== undefined) err.data = data;
  return { jsonrpc: '2.0', id, error: err };
}

function extractId(body: unknown): string | number | null {
  if (body && typeof body === 'object' && 'id' in body) {
    const id = (body as { id?: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number') return id;
  }
  return null;
}

function errorToHttpStatus(err: KnowledgeError): number {
  switch (err.code) {
    case 'INVALID_ARGUMENT':
    case 'CUSTOMER_REQUIRES_WORKSPACE':
    case 'NON_CUSTOMER_HAS_WORKSPACE':
    case 'DIMENSION_MISMATCH':
      return 400;
    case 'AUTHENTICATION':
      return 401;
    case 'NOT_FOUND':
      return 404;
    case 'RATE_LIMITED':
      return 429;
    case 'NOT_CONFIGURED':
    case 'NOT_IMPLEMENTED':
      return 503;
    default:
      return 500;
  }
}
