/**
 * lib/integrations/mcp-core/dispatch.ts
 *
 * Generic JSON-RPC 2.0 dispatcher shared by every MCP server built on the
 * core. A server hands `dispatch` its bound instance plus a tool registry;
 * the dispatcher handles `tools/list`, `tools/call`, `resources/list`,
 * `resources/read`, and direct `<namespace>.<tool>` / bare-name invocation —
 * exactly the method surface the shipped Gmail/Outlook routes expose.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this dispatcher never imports a
 * vendor SDK. It is the seam between the JSON-RPC envelope and the typed
 * tool methods on a server.
 */

import { z, type ZodTypeAny } from 'zod';
import {
  type JsonRpcError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
  type McpError,
  type McpResult,
  type McpServerBase,
  JSON_RPC_ERROR,
  mcpErrorToJsonRpc,
} from './types';

/**
 * One tool the server exposes. `name` is the fully-qualified short name as it
 * appears in `tools/list` (e.g. `docusign.list_envelopes`). `schema` validates
 * arguments before `invoke` runs; on a ZodError the dispatcher returns
 * INVALID_PARAMS.
 */
export interface ToolRegistration<TServer extends McpServerBase> {
  name: string;
  description: string;
  schema: ZodTypeAny;
  invoke: (server: TServer, args: unknown) => Promise<McpResult<unknown>>;
}

export interface DispatchConfig<TServer extends McpServerBase> {
  server: TServer;
  tools: ReadonlyArray<ToolRegistration<TServer>>;
  /** Namespace prefix for bare-name routing (e.g. `docusign`). */
  namespace: string;
}

const toolsCallArgsSchema = z.object({
  name: z.string().min(1),
  arguments: z.unknown().optional(),
});
const readResourceArgsSchema = z.object({ uri: z.string().min(1) });

export async function dispatch<TServer extends McpServerBase>(
  req: JsonRpcRequest,
  config: DispatchConfig<TServer>,
): Promise<JsonRpcResponse<unknown>> {
  const id = req.id ?? null;
  if (req.jsonrpc !== '2.0' || !req.method) {
    return rpcError(id, JSON_RPC_ERROR.INVALID_REQUEST, 'Invalid Request');
  }

  const byName = new Map(config.tools.map((t) => [t.name, t]));
  const byBareName = new Map(
    config.tools.map((t) => [t.name.replace(new RegExp(`^${config.namespace}\\.`), ''), t]),
  );

  if (req.method === 'tools/list') {
    return rpcOk(id, {
      tools: config.tools.map((t) => ({ name: t.name, description: t.description })),
    });
  }

  if (req.method === 'resources/list') {
    if (!config.server.listResources) return rpcOk(id, []);
    return resultToRpc(id, await config.server.listResources());
  }

  if (req.method === 'resources/read') {
    if (!config.server.readResource) {
      return rpcError(id, JSON_RPC_ERROR.METHOD_NOT_FOUND, 'Server exposes no resources');
    }
    const parsed = parseParams(readResourceArgsSchema, req.params);
    if (!parsed.ok) return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, parsed.message);
    return resultToRpc(id, await config.server.readResource(parsed.value));
  }

  if (req.method === 'tools/call') {
    const parsed = parseParams(toolsCallArgsSchema, req.params);
    if (!parsed.ok) return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, parsed.message);
    const reg = byName.get(parsed.value.name) ?? byBareName.get(parsed.value.name);
    if (!reg) {
      return rpcError(id, JSON_RPC_ERROR.METHOD_NOT_FOUND, `Tool not found: ${parsed.value.name}`);
    }
    return invokeTool(reg, config.server, parsed.value.arguments, id);
  }

  const direct = byName.get(req.method) ?? byBareName.get(req.method);
  if (direct) return invokeTool(direct, config.server, req.params, id);

  return rpcError(id, JSON_RPC_ERROR.METHOD_NOT_FOUND, `Method not found: ${req.method}`);
}

async function invokeTool<TServer extends McpServerBase>(
  reg: ToolRegistration<TServer>,
  server: TServer,
  args: unknown,
  id: string | number | null,
): Promise<JsonRpcResponse<unknown>> {
  try {
    const parsedArgs = reg.schema.parse(args ?? {});
    const result = await reg.invoke(server, parsedArgs);
    return resultToRpc(id, result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, 'Invalid params', { issues: err.issues });
    }
    const message = err instanceof Error ? err.message : String(err);
    return rpcError(id, JSON_RPC_ERROR.INTERNAL_ERROR, message);
  }
}

function resultToRpc<T>(
  id: string | number | null,
  result: McpResult<T>,
): JsonRpcResponse<T> {
  if (result.ok) return rpcOk(id, result.value);
  return rpcError(id, mcpErrorToJsonRpc(result.error), result.error.message, {
    code: result.error.code,
    status: result.error.status,
    reference: result.error.reference,
  });
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
    message: result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; '),
  };
}

// ── In-process client for smoke tests ───────────────────────────────────────

/**
 * Minimal MCP client that calls `dispatch` directly — the smoke-test
 * conduit, exercising the exact dispatcher the HTTP route runs without an
 * HTTP round-trip.
 */
export class InProcessMcpClient<TServer extends McpServerBase> {
  private nextId = 1;
  constructor(private readonly config: DispatchConfig<TServer>) {}

  async call(method: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const fq = method.includes('.') ? method : `${this.config.namespace}.${method}`;
    const response = await dispatch(
      { jsonrpc: '2.0', id: this.nextId++, method: fq, params: args },
      this.config,
    );
    if ('error' in response) {
      const data = response.error.data as { code?: string } | undefined;
      throw new McpClientError(response.error.message, response.error.code, data?.code);
    }
    return response.result;
  }

  async listTools(): Promise<{ name: string; description: string }[]> {
    const response = await dispatch(
      { jsonrpc: '2.0', id: this.nextId++, method: 'tools/list' },
      this.config,
    );
    if ('error' in response) throw new McpClientError(response.error.message, response.error.code);
    return (response.result as { tools: { name: string; description: string }[] }).tools;
  }
}

export class McpClientError extends Error {
  constructor(
    message: string,
    readonly jsonRpcCode: number,
    readonly mcpErrorCode?: string,
  ) {
    super(message);
    this.name = 'McpClientError';
  }
}

export type { McpError };
