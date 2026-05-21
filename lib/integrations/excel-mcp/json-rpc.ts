/**
 * lib/integrations/excel-mcp/json-rpc.ts
 *
 * JSON-RPC dispatcher for the Excel MCP server. Mirrors the structure of
 * `lib/integrations/outlook-mcp/json-rpc.ts`. Shared envelopes + standard
 * JSON_RPC_ERROR codes come from `lib/integrations/microsoft/mcp-common.ts`.
 */

import { z, type ZodTypeAny } from 'zod';
import {
  JSON_RPC_ERROR,
  mcpErrorCodeToHttpStatus,
  mcpErrorToJsonRpc,
  type JsonRpcError,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
  type McpErrorCode,
  type McpResult,
} from '@/lib/integrations/microsoft/mcp-common';
import {
  type EXCEL_TOOL_NAMES,
  type ExcelMcpServer,
} from './types';

const cellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const cellArgSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.object({ address: z.string().min(1) }),
]);

const listSheetsArgsSchema = z.object({
  workbookId: z.string().min(1),
  driveId: z.string().optional(),
});

const readRangeArgsSchema = z.object({
  workbookId: z.string().min(1),
  driveId: z.string().optional(),
  sheet: z.string().min(1),
  address: z.string().min(1),
  formulas: z.boolean().optional(),
});

const writeRangeArgsSchema = z.object({
  workbookId: z.string().min(1),
  driveId: z.string().optional(),
  sheet: z.string().min(1),
  address: z.string().min(1),
  values: z.array(z.array(cellValueSchema)).min(1),
});

const readTableArgsSchema = z.object({
  workbookId: z.string().min(1),
  driveId: z.string().optional(),
  tableName: z.string().min(1),
  maxRows: z.number().int().positive().optional(),
});

const appendTableRowArgsSchema = z.object({
  workbookId: z.string().min(1),
  driveId: z.string().optional(),
  tableName: z.string().min(1),
  row: z.array(cellValueSchema).min(1),
});

const recalculateWorkbookArgsSchema = z.object({
  workbookId: z.string().min(1),
  driveId: z.string().optional(),
  calculationType: z.enum(['Full', 'FullRebuild', 'Recalculate']).optional(),
});

const runNamedFunctionArgsSchema = z.object({
  workbookId: z.string().min(1),
  driveId: z.string().optional(),
  functionName: z.string().min(1),
  args: z.array(cellArgSchema),
});

const readResourceArgsSchema = z.object({ uri: z.string().min(1) });

const toolsCallArgsSchema = z.object({
  name: z.string().min(1),
  arguments: z.unknown().optional(),
});

interface ToolRegistration {
  shortName: (typeof EXCEL_TOOL_NAMES)[number];
  description: string;
  schema: ZodTypeAny;
  invoke: (server: ExcelMcpServer, args: unknown) => Promise<McpResult<unknown>>;
}

const TOOLS: ToolRegistration[] = [
  {
    shortName: 'excel.list_sheets',
    description: 'List worksheets in an Excel workbook.',
    schema: listSheetsArgsSchema,
    invoke: (server, args) =>
      server.listSheets(listSheetsArgsSchema.parse(args)),
  },
  {
    shortName: 'excel.read_range',
    description:
      'Read a 2-D A1-notation range from a worksheet. Pass formulas=true to read formulas instead of computed values.',
    schema: readRangeArgsSchema,
    invoke: (server, args) =>
      server.readRange(readRangeArgsSchema.parse(args)),
  },
  {
    shortName: 'excel.write_range',
    description:
      'Write a 2-D values array to an A1-notation range. Dimensions must match the address.',
    schema: writeRangeArgsSchema,
    invoke: (server, args) =>
      server.writeRange(writeRangeArgsSchema.parse(args)),
  },
  {
    shortName: 'excel.read_table',
    description:
      'Read an Excel structured table by name. Returns headers + body rows.',
    schema: readTableArgsSchema,
    invoke: (server, args) =>
      server.readTable(readTableArgsSchema.parse(args)),
  },
  {
    shortName: 'excel.append_table_row',
    description:
      'Append a single row to an Excel structured table; row length must equal the table’s column count.',
    schema: appendTableRowArgsSchema,
    invoke: (server, args) =>
      server.appendTableRow(appendTableRowArgsSchema.parse(args)),
  },
  {
    shortName: 'excel.recalculate_workbook',
    description:
      'Trigger workbook recalculation via Graph’s application/calculate endpoint.',
    schema: recalculateWorkbookArgsSchema,
    invoke: (server, args) =>
      server.recalculateWorkbook(recalculateWorkbookArgsSchema.parse(args)),
  },
  {
    shortName: 'excel.run_named_function',
    description:
      'Invoke a Graph-supported workbook function with positional args (e.g. SUM, XLOOKUP).',
    schema: runNamedFunctionArgsSchema,
    invoke: (server, args) =>
      server.runNamedFunction(runNamedFunctionArgsSchema.parse(args)),
  },
];

const TOOL_BY_SHORTNAME = new Map(TOOLS.map((t) => [t.shortName, t]));
const TOOL_BY_BARE_NAME = new Map(
  TOOLS.map((t) => [t.shortName.replace(/^excel\./, ''), t]),
);

export interface DispatchOptions {
  server: ExcelMcpServer;
}

export async function dispatch(
  req: JsonRpcRequest,
  options: DispatchOptions,
): Promise<JsonRpcResponse<unknown>> {
  const id = req.id ?? null;
  if (req.jsonrpc !== '2.0' || !req.method) {
    return rpcError(id, JSON_RPC_ERROR.INVALID_REQUEST, 'Invalid Request');
  }
  if (req.method === 'tools/list') {
    return rpcOk(id, {
      tools: TOOLS.map((t) => ({ name: t.shortName, description: t.description })),
    });
  }
  if (req.method === 'resources/list') {
    return resultToRpc(id, await options.server.listResources());
  }
  if (req.method === 'resources/read') {
    const parsed = parseParams(readResourceArgsSchema, req.params);
    if (!parsed.ok) return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, parsed.message);
    return resultToRpc(id, await options.server.readResource(parsed.value));
  }
  if (req.method === 'tools/call') {
    const parsed = parseParams(toolsCallArgsSchema, req.params);
    if (!parsed.ok) return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, parsed.message);
    const reg = TOOL_BY_SHORTNAME.get(
      parsed.value.name as (typeof EXCEL_TOOL_NAMES)[number],
    );
    if (!reg) {
      return rpcError(
        id,
        JSON_RPC_ERROR.METHOD_NOT_FOUND,
        `Tool not found: ${parsed.value.name}`,
      );
    }
    return invokeTool(reg, options.server, parsed.value.arguments, id);
  }
  const reg = TOOL_BY_SHORTNAME.get(
    req.method as (typeof EXCEL_TOOL_NAMES)[number],
  );
  if (reg) return invokeTool(reg, options.server, req.params, id);
  const bare = TOOL_BY_BARE_NAME.get(req.method);
  if (bare) return invokeTool(bare, options.server, req.params, id);
  return rpcError(
    id,
    JSON_RPC_ERROR.METHOD_NOT_FOUND,
    `Method not found: ${req.method}`,
  );
}

async function invokeTool(
  reg: ToolRegistration,
  server: ExcelMcpServer,
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
  result: McpResult<T>,
): JsonRpcResponse<T> {
  if (result.ok) return rpcOk(id, result.value);
  return rpcError(
    id,
    mcpErrorToJsonRpc(result.error),
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
    message: result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; '),
  };
}

export function excelErrorCodeToHttpStatus(code: McpErrorCode): number {
  return mcpErrorCodeToHttpStatus(code);
}

export class InProcessExcelMcpClient {
  private nextId = 1;
  constructor(private readonly server: ExcelMcpServer) {}

  async call(
    namespace: 'excel',
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
      throw new ExcelMcpClientError(
        response.error.message,
        response.error.code,
        data?.code,
      );
    }
    return response.result;
  }
}

export class ExcelMcpClientError extends Error {
  constructor(
    message: string,
    readonly jsonRpcCode: number,
    readonly excelErrorCode?: string,
  ) {
    super(message);
    this.name = 'ExcelMcpClientError';
  }
}
