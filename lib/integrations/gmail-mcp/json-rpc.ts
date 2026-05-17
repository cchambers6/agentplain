/**
 * lib/integrations/gmail-mcp/json-rpc.ts
 *
 * Protocol dispatcher shared by:
 *   * `app/api/integrations/gmail-mcp/[workspaceId]/route.ts` — HTTP entry
 *   * `scripts/test-gmail-mcp.ts` — in-process smoke test
 *
 * The same dispatcher serves both so the test exercises the SAME code
 * path the HTTP route does, modulo the workspace-membership check (the
 * route enforces it before invoking dispatch). Per the substrate's MCP
 * route pattern at `app/api/knowledge/mcp/route.ts`, we follow JSON-RPC
 * 2.0: every request/response carries `jsonrpc: "2.0"` + matching `id`.
 *
 * MCP-style method namespacing:
 *   * `tools/list`                 — enumerate tools
 *   * `tools/call`                 — invoke one tool by name (params: { name, arguments })
 *   * `resources/list`             — enumerate resources
 *   * `resources/read`             — read a single resource by URI
 *   * `gmail.<tool>`               — direct legacy invocation (matches the
 *                                     PR brief's `mcp.call('gmail','list_messages',…)` form)
 *
 * The direct-invocation form keeps the substrate-style call site working:
 * skill code can call `mcpClient.call('gmail','list_messages', args)` and
 * the dispatcher routes to the matching `GmailMcpServer.listMessages`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this module is the seam
 * between the JSON-RPC envelope and the typed `GmailMcpServer` interface.
 * It never imports `googleapis`.
 */

import { z, type ZodTypeAny } from 'zod';
import {
  type GmailMcpError,
  type GmailMcpErrorCode,
  type GmailMcpResult,
  type GmailMcpServer,
  type GMAIL_TOOL_NAMES,
  type JsonRpcError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
  JSON_RPC_ERROR,
} from './types';

// ── Schemas ─────────────────────────────────────────────────────────────

const listMessagesArgsSchema = z.object({
  query: z.string().optional(),
  maxResults: z.number().int().positive().max(100).optional(),
  pageToken: z.string().optional(),
});

const getMessageArgsSchema = z.object({ messageId: z.string().min(1) });

const searchThreadsArgsSchema = z.object({
  query: z.string().min(1),
  maxResults: z.number().int().positive().max(100).optional(),
  pageToken: z.string().optional(),
});

const draftMessageArgsSchema = z.object({
  to: z.array(z.string().min(1)).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  threadId: z.string().optional(),
  inReplyToMessageId: z.string().optional(),
});

const labelMessageArgsSchema = z
  .object({
    messageId: z.string().min(1),
    addLabelIds: z.array(z.string()).optional(),
    removeLabelIds: z.array(z.string()).optional(),
  })
  .refine(
    (v) =>
      (v.addLabelIds && v.addLabelIds.length > 0) ||
      (v.removeLabelIds && v.removeLabelIds.length > 0),
    { message: 'labelMessage requires at least one of addLabelIds / removeLabelIds' },
  );

const readResourceArgsSchema = z.object({ uri: z.string().min(1) });

const toolsCallArgsSchema = z.object({
  name: z.string().min(1),
  arguments: z.unknown().optional(),
});

// ── Tool registry ───────────────────────────────────────────────────────

interface ToolRegistration {
  /** Short-form name as it appears in `tools/list`. */
  shortName: (typeof GMAIL_TOOL_NAMES)[number];
  description: string;
  schema: ZodTypeAny;
  invoke: (
    server: GmailMcpServer,
    args: unknown,
  ) => Promise<GmailMcpResult<unknown>>;
}

const TOOLS: ToolRegistration[] = [
  {
    shortName: 'gmail.list_messages',
    description:
      'List Gmail messages matching an optional search query. Defaults to in:inbox.',
    schema: listMessagesArgsSchema,
    invoke: (server, args) => server.listMessages(listMessagesArgsSchema.parse(args ?? {})),
  },
  {
    shortName: 'gmail.get_message',
    description: 'Fetch a single Gmail message by id, including full body + headers.',
    schema: getMessageArgsSchema,
    invoke: (server, args) => server.getMessage(getMessageArgsSchema.parse(args)),
  },
  {
    shortName: 'gmail.search_threads',
    description: 'Search Gmail threads matching a query (Gmail search syntax).',
    schema: searchThreadsArgsSchema,
    invoke: (server, args) => server.searchThreads(searchThreadsArgsSchema.parse(args)),
  },
  {
    shortName: 'gmail.draft_message',
    description:
      'Create a Gmail draft. Per the no-outbound architecture, this NEVER sends; the customer system sends from Drafts.',
    schema: draftMessageArgsSchema,
    invoke: (server, args) => server.draftMessage(draftMessageArgsSchema.parse(args)),
  },
  {
    shortName: 'gmail.label_message',
    description: 'Add/remove labels on a Gmail message (users.messages.modify).',
    schema: labelMessageArgsSchema,
    invoke: (server, args) => server.labelMessage(labelMessageArgsSchema.parse(args)),
  },
  {
    shortName: 'gmail.list_labels',
    description: 'Enumerate Gmail labels (system + user-defined).',
    schema: z.object({}).optional(),
    invoke: (server) => server.listLabels(),
  },
];

const TOOL_BY_SHORTNAME = new Map(TOOLS.map((t) => [t.shortName, t]));
const TOOL_BY_BARE_NAME = new Map(
  TOOLS.map((t) => [t.shortName.replace(/^gmail\./, ''), t]),
);

// ── Dispatcher ──────────────────────────────────────────────────────────

export interface DispatchOptions {
  /** Pre-resolved server bound to the request's workspaceId. */
  server: GmailMcpServer;
}

/**
 * Apply one JSON-RPC request against the bound server. Pure function:
 * given an envelope + a server, returns the response envelope. Both the
 * HTTP route and the smoke test call this — the HTTP route adds the
 * workspace-membership wrapper, the smoke test does not.
 */
export async function dispatch(
  req: JsonRpcRequest,
  options: DispatchOptions,
): Promise<JsonRpcResponse<unknown>> {
  const id = req.id ?? null;
  if (req.jsonrpc !== '2.0' || !req.method) {
    return rpcError(id, JSON_RPC_ERROR.INVALID_REQUEST, 'Invalid Request');
  }

  // tools/list
  if (req.method === 'tools/list') {
    return rpcOk(id, {
      tools: TOOLS.map((t) => ({
        name: t.shortName,
        description: t.description,
      })),
    });
  }

  // resources/list
  if (req.method === 'resources/list') {
    const res = await options.server.listResources();
    return resultToRpc(id, res);
  }

  // resources/read
  if (req.method === 'resources/read') {
    const parsed = parseParams(readResourceArgsSchema, req.params);
    if (!parsed.ok) {
      return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, parsed.message);
    }
    const res = await options.server.readResource(parsed.value);
    return resultToRpc(id, res);
  }

  // tools/call (substrate-style)
  if (req.method === 'tools/call') {
    const parsed = parseParams(toolsCallArgsSchema, req.params);
    if (!parsed.ok) {
      return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, parsed.message);
    }
    const reg = TOOL_BY_SHORTNAME.get(parsed.value.name as (typeof GMAIL_TOOL_NAMES)[number]);
    if (!reg) {
      return rpcError(
        id,
        JSON_RPC_ERROR.METHOD_NOT_FOUND,
        `Tool not found: ${parsed.value.name}`,
      );
    }
    return invokeTool(reg, options.server, parsed.value.arguments, id);
  }

  // gmail.<tool> direct invocation
  const reg = TOOL_BY_SHORTNAME.get(req.method as (typeof GMAIL_TOOL_NAMES)[number]);
  if (reg) {
    return invokeTool(reg, options.server, req.params, id);
  }
  // Bare-name fallback so `mcp.call('gmail','list_messages',…)` clients
  // can route by short name without the `gmail.` prefix.
  const bare = TOOL_BY_BARE_NAME.get(req.method);
  if (bare) {
    return invokeTool(bare, options.server, req.params, id);
  }

  return rpcError(
    id,
    JSON_RPC_ERROR.METHOD_NOT_FOUND,
    `Method not found: ${req.method}`,
  );
}

async function invokeTool(
  reg: ToolRegistration,
  server: GmailMcpServer,
  args: unknown,
  id: string | number | null,
): Promise<JsonRpcResponse<unknown>> {
  try {
    const result = await reg.invoke(server, args ?? {});
    return resultToRpc(id, result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, 'Invalid params', {
        issues: err.issues,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return rpcError(id, JSON_RPC_ERROR.INTERNAL_ERROR, message);
  }
}

function resultToRpc<T>(
  id: string | number | null,
  result: GmailMcpResult<T>,
): JsonRpcResponse<T> {
  if (result.ok) return rpcOk(id, result.value);
  return rpcError(
    id,
    gmailErrorToJsonRpc(result.error),
    result.error.message,
    { code: result.error.code, status: result.error.status, reference: result.error.reference },
  );
}

function rpcOk<T>(id: string | number | null, result: T): JsonRpcSuccess<T> {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  const err: JsonRpcError['error'] = { code, message };
  if (data !== undefined) err.data = data;
  return { jsonrpc: '2.0', id, error: err };
}

function parseParams<T extends ZodTypeAny>(
  schema: T,
  params: unknown,
): { ok: true; value: z.infer<T> } | { ok: false; message: string } {
  const result = schema.safeParse(params ?? {});
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    message: result.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; '),
  };
}

function gmailErrorToJsonRpc(err: GmailMcpError): number {
  switch (err.code) {
    case 'INVALID_ARGUMENT':
      return JSON_RPC_ERROR.INVALID_PARAMS;
    case 'NOT_FOUND':
      return JSON_RPC_ERROR.METHOD_NOT_FOUND; // surface NOT_FOUND with -32601
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

// ── HTTP status mapping for the route handler ──────────────────────────

export function gmailErrorCodeToHttpStatus(code: GmailMcpErrorCode): number {
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

// ── In-process client for the smoke test ──────────────────────────────

/**
 * Minimal MCP client that calls `dispatch` directly. The smoke test uses
 * this to exercise the exact dispatcher the HTTP route runs, without an
 * HTTP round-trip. New transports (stdio, SSE) can plug in by writing
 * the same shape against a different conduit.
 */
export class InProcessMcpClient {
  private nextId = 1;
  constructor(private readonly server: GmailMcpServer) {}

  async call(
    namespace: 'gmail',
    method: string,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.nextId++,
      method: `${namespace}.${method}`,
      params: args,
    };
    const response = await dispatch(request, { server: this.server });
    if ('error' in response) {
      const data = response.error.data as { code?: string } | undefined;
      throw new McpClientError(
        response.error.message,
        response.error.code,
        data?.code,
      );
    }
    return response.result;
  }

  async listTools(): Promise<{ name: string; description: string }[]> {
    const response = await dispatch(
      { jsonrpc: '2.0', id: this.nextId++, method: 'tools/list' },
      { server: this.server },
    );
    if ('error' in response) {
      throw new McpClientError(response.error.message, response.error.code);
    }
    return (response.result as { tools: { name: string; description: string }[] }).tools;
  }

  async listResources(): Promise<{ uri: string; name: string; description: string; mimeType: string }[]> {
    const response = await dispatch(
      { jsonrpc: '2.0', id: this.nextId++, method: 'resources/list' },
      { server: this.server },
    );
    if ('error' in response) {
      throw new McpClientError(response.error.message, response.error.code);
    }
    return response.result as { uri: string; name: string; description: string; mimeType: string }[];
  }

  async readResource(uri: string): Promise<{ uri: string; mimeType: string; text: string }> {
    const response = await dispatch(
      {
        jsonrpc: '2.0',
        id: this.nextId++,
        method: 'resources/read',
        params: { uri },
      },
      { server: this.server },
    );
    if ('error' in response) {
      throw new McpClientError(response.error.message, response.error.code);
    }
    return response.result as { uri: string; mimeType: string; text: string };
  }
}

export class McpClientError extends Error {
  constructor(
    message: string,
    readonly jsonRpcCode: number,
    readonly gmailErrorCode?: string,
  ) {
    super(message);
    this.name = 'McpClientError';
  }
}
