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

/**
 * The canonical UUID text form, as Postgres accepts it for a `uuid` cast:
 * 32 hex digits in 8-4-4-4-12 groups, case-insensitive.
 *
 * Deliberately NOT `z.string().uuid()`. Zod additionally enforces the RFC
 * 9562 version (`[1-5]`) and variant (`[89ab]`) nibbles, which Postgres
 * does not: `00000000-0000-0000-0000-00000000000a` is a perfectly
 * storable `@db.Uuid` value that `z.string().uuid()` rejects. Measured on
 * `origin/main` (zod 4.4.3): of 54 distinct UUID literals in the tree, 33
 * (61%) are of exactly that shape.
 *
 * The header gate below exists for one reason -- to stop a value Postgres
 * cannot cast from reaching `$6::uuid` and raising 22P02 -- so its
 * accepted set must be the set Postgres accepts, and no narrower. A
 * narrower gate does not fail safe: it 400s a legitimate tenant.
 */
const UUID_TEXT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One definition, shared by the upsert params, the delete params and the
 * workspace header. A SECOND definition is how this file came to hold two
 * different notions of a UUID in the first place; keep it that way.
 * Pinned end-to-end by `tests/knowledge-mcp-uuid.test.ts`.
 */
const workspaceUuidSchema = z.string().regex(UUID_TEXT_RE, 'expected a UUID');

const upsertParamsSchema = z.object({
  contextKind: contextKindSchema,
  workspaceId: workspaceUuidSchema.nullable().optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceUrl: z.string().url().nullable().optional(),
  verticalSlug: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sourceType: z.string().min(1).optional(),
  sourceId: z.string().min(1).optional(),
});

/**
 * Delete params.
 *
 * `embeddingId` / `documentId` reuse `workspaceUuidSchema` for exactly the
 * reason spelled out above it. They previously used `z.string().uuid()`,
 * which is the SAME defect already fixed for the workspace header in this
 * file: zod's `.uuid()` enforces the RFC 9562 version and variant nibbles,
 * Postgres's `uuid` type does not.
 *
 * Measured on `origin/main` (zod 4.4.3, whole tree at the ref): 169
 * occurrences, 54 distinct UUID literals, of which 33 (61%) fail
 * `z.string().uuid()` while being perfectly storable `@db.Uuid` values --
 * so the narrow gate never protected anything, it just 400'd legitimate
 * deletes of rows the substrate had happily stored.
 *
 * A validator narrower than the thing it guards does not fail safe.
 *
 * NOTE for anyone re-testing this: on zod 4 the nil UUID and a v1-shaped
 * id are the WRONG probes -- `.uuid()` special-cases nil/max and permits
 * version nibbles 1-8, so both pass under the narrow validator too. The
 * values that actually discriminate carry a version nibble of 0 (other
 * than nil) or 9-f (other than max), or a variant nibble outside [89ab].
 * See `tests/knowledge-mcp-uuid.test.ts`.
 */
const deleteParamsSchema = z
  .object({
    embeddingId: workspaceUuidSchema.optional(),
    documentId: workspaceUuidSchema.optional(),
  })
  .refine((v) => Boolean(v.embeddingId || v.documentId), {
    message: 'must provide embeddingId or documentId',
  });

/**
 * Is this string a workspace id Postgres will accept as `uuid`?
 *
 * Delegates to the SAME `workspaceUuidSchema` that `upsertParamsSchema`
 * uses for `workspaceId`, rather than introducing a second hand-rolled
 * regex. A divergent definition is how a value passes one gate and fails
 * the next, which is precisely the shape of the bug being fixed here.
 *
 * Note the empty-string case: `headers.get()` yields `''` for a header
 * that is present but empty, and `''` is falsy, so the old ternary below
 * treated it as ABSENT and escalated the call to operator context --
 * cross-tenant read visibility from a blank header. `''` has no hex
 * groups, so it is rejected here.
 */
function isUuid(value: string): boolean {
  return workspaceUuidSchema.safeParse(value).success;
}

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
  // Validate the header BEFORE it reaches any query. It is the only
  // caller-controlled value that flows into SQL as a typed parameter:
  // `PgvectorKnowledgeStore.search` binds it to `$6::uuid`, and the
  // upsert branch below assigns it straight onto `up.data.workspaceId`,
  // overwriting the value `upsertParamsSchema` already checked with
  // `workspaceUuidSchema` -- so the schema's guarantee does not survive
  // that assignment.
  //
  // Before the tenant predicate existed, a garbage header was inert: it
  // reached no cast, matched nothing, and returned an empty result. Now
  // Postgres raises 22P02 (invalid_text_representation) on the cast and
  // the route answers 500 with a generic internal error. The route is
  // operator-key gated so this is not a DoS, but it turns a silent empty
  // result into an error, and a 500 is the least diagnosable way to tell
  // a caller its header is malformed. Answer -32602 instead, which is
  // what every other bad-input branch in this switch returns.
  if (workspaceHeader !== null && !isUuid(workspaceHeader)) {
    return NextResponse.json(
      jsonRpcError(
        requestId,
        -32602,
        `Invalid ${MCP_WORKSPACE_HEADER} header: expected a UUID`,
      ),
      { status: 400 },
    );
  }
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
        // Tenant scope comes from the HEADER, never from the JSON-RPC
        // params (searchParamsSchema has no workspaceId, so zod strips
        // any the caller tries to inject) -- same rule the upsert branch
        // below applies. Header absent = operator context = no tenant
        // predicate, which matches `rlsContext` exactly.
        const result = await store.search({
          ...sp.data,
          workspaceId: rlsContext.workspaceId,
        });
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
    // Log identifiers + error class only — never the raw `err` object.
    // Substrate writes carry document `body` text; a thrown error mid-
    // upsert (e.g. a Zod refinement throw, a Prisma constraint violation)
    // can surface that body via err.message or err.cause. Operators
    // correlate via method + requestId. (Data-privacy audit PR #91 must-
    // close #3.)
    const errName = err instanceof Error ? err.name : 'NonError';
    const message = err instanceof Error ? err.message : 'unknown error';
    console.error(
      `knowledge.mcp uncaught: method=${method} requestId=${String(requestId)} error=${errName}`,
    );
    return NextResponse.json(
      // The JSON-RPC error message we return to the CALLER is still the
      // error message (callers need actionable info), but the SERVER-SIDE
      // log line above is scrubbed. The Sentry beforeSend scrubber adds
      // a second defense layer for anything that reaches the reporter.
      jsonRpcError(requestId, -32603, message),
      { status: 500 },
    );
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
