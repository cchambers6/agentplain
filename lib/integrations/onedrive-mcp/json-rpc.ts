/**
 * lib/integrations/onedrive-mcp/json-rpc.ts
 *
 * JSON-RPC dispatcher for the OneDrive / SharePoint MCP server. Mirrors
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
  type ONEDRIVE_TOOL_NAMES,
  type OneDriveMcpServer,
} from './types';

const listFilesArgsSchema = z.object({
  driveId: z.string().optional(),
  folderPath: z.string().optional(),
  maxResults: z.number().int().positive().max(100).optional(),
  pageToken: z.string().optional(),
});

const getFileMetadataArgsSchema = z.object({
  itemId: z.string().min(1),
  driveId: z.string().optional(),
});

const downloadFileArgsSchema = z.object({
  itemId: z.string().min(1),
  driveId: z.string().optional(),
  maxBytes: z.number().int().positive().optional(),
});

const uploadFileArgsSchema = z.object({
  driveId: z.string().optional(),
  folderPath: z.string(),
  filename: z.string().min(1),
  contentBase64: z.string().min(1),
  mimeType: z.string().optional(),
  conflictBehavior: z.enum(['replace', 'rename', 'fail']).optional(),
});

const createFolderArgsSchema = z.object({
  driveId: z.string().optional(),
  parentPath: z.string(),
  folderName: z.string().min(1),
  conflictBehavior: z.enum(['rename', 'fail']).optional(),
});

const shareFileArgsSchema = z.object({
  itemId: z.string().min(1),
  driveId: z.string().optional(),
  type: z.enum(['view', 'edit']).optional(),
  scope: z.enum(['anonymous', 'organization', 'users']).optional(),
  expiresAt: z.string().optional(),
});

const searchFilesArgsSchema = z.object({
  query: z.string().min(1),
  driveId: z.string().optional(),
  maxResults: z.number().int().positive().max(100).optional(),
});

const getRecentFilesArgsSchema = z.object({
  maxResults: z.number().int().positive().max(100).optional(),
});

const readResourceArgsSchema = z.object({ uri: z.string().min(1) });

const toolsCallArgsSchema = z.object({
  name: z.string().min(1),
  arguments: z.unknown().optional(),
});

interface ToolRegistration {
  shortName: (typeof ONEDRIVE_TOOL_NAMES)[number];
  description: string;
  schema: ZodTypeAny;
  invoke: (server: OneDriveMcpServer, args: unknown) => Promise<McpResult<unknown>>;
}

const TOOLS: ToolRegistration[] = [
  {
    shortName: 'onedrive.list_files',
    description:
      'List files and folders in the connected OneDrive / SharePoint drive. Pass folderPath to scope.',
    schema: listFilesArgsSchema,
    invoke: (server, args) =>
      server.listFiles(listFilesArgsSchema.parse(args ?? {})),
  },
  {
    shortName: 'onedrive.get_file_metadata',
    description:
      'Fetch metadata for a single driveItem plus any existing sharing links.',
    schema: getFileMetadataArgsSchema,
    invoke: (server, args) =>
      server.getFileMetadata(getFileMetadataArgsSchema.parse(args)),
  },
  {
    shortName: 'onedrive.download_file',
    description:
      'Download a file as base64. Caller specifies maxBytes (default 10 MiB); larger files fail upstream.',
    schema: downloadFileArgsSchema,
    invoke: (server, args) =>
      server.downloadFile(downloadFileArgsSchema.parse(args)),
  },
  {
    shortName: 'onedrive.upload_file',
    description:
      'Upload a base64-encoded file to a OneDrive / SharePoint folder. ≤4 MiB per call (simple PUT).',
    schema: uploadFileArgsSchema,
    invoke: (server, args) =>
      server.uploadFile(uploadFileArgsSchema.parse(args)),
  },
  {
    shortName: 'onedrive.create_folder',
    description:
      'Create a new folder under parentPath. Defaults conflictBehavior to `fail`.',
    schema: createFolderArgsSchema,
    invoke: (server, args) =>
      server.createFolder(createFolderArgsSchema.parse(args)),
  },
  {
    shortName: 'onedrive.share_file',
    description:
      'Produce a sharing link for a file. Defaults to view + organization scope; caller hands the link off.',
    schema: shareFileArgsSchema,
    invoke: (server, args) =>
      server.shareFile(shareFileArgsSchema.parse(args)),
  },
  {
    shortName: 'onedrive.search_files',
    description:
      'Full-text search across OneDrive / SharePoint via Graph search(q).',
    schema: searchFilesArgsSchema,
    invoke: (server, args) =>
      server.searchFiles(searchFilesArgsSchema.parse(args)),
  },
  {
    shortName: 'onedrive.get_recent_files',
    description:
      'List recently touched files across the connected account’s drives.',
    schema: getRecentFilesArgsSchema,
    invoke: (server, args) =>
      server.getRecentFiles(getRecentFilesArgsSchema.parse(args ?? {})),
  },
];

const TOOL_BY_SHORTNAME = new Map(TOOLS.map((t) => [t.shortName, t]));
const TOOL_BY_BARE_NAME = new Map(
  TOOLS.map((t) => [t.shortName.replace(/^onedrive\./, ''), t]),
);

export interface DispatchOptions {
  server: OneDriveMcpServer;
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
      parsed.value.name as (typeof ONEDRIVE_TOOL_NAMES)[number],
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
    req.method as (typeof ONEDRIVE_TOOL_NAMES)[number],
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
  server: OneDriveMcpServer,
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

export function onedriveErrorCodeToHttpStatus(code: McpErrorCode): number {
  return mcpErrorCodeToHttpStatus(code);
}

export class InProcessOneDriveMcpClient {
  private nextId = 1;
  constructor(private readonly server: OneDriveMcpServer) {}

  async call(
    namespace: 'onedrive',
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
      throw new OneDriveMcpClientError(
        response.error.message,
        response.error.code,
        data?.code,
      );
    }
    return response.result;
  }
}

export class OneDriveMcpClientError extends Error {
  constructor(
    message: string,
    readonly jsonRpcCode: number,
    readonly onedriveErrorCode?: string,
  ) {
    super(message);
    this.name = 'OneDriveMcpClientError';
  }
}
