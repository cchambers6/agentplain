/**
 * lib/integrations/teams-mcp/json-rpc.ts
 *
 * JSON-RPC dispatcher for the Teams MCP server. Mirrors the structure of
 * `lib/integrations/outlook-mcp/json-rpc.ts`. Shared envelope types +
 * standard JSON_RPC_ERROR codes come from
 * `lib/integrations/microsoft/mcp-common.ts`; the tool registry here is
 * Teams-specific.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this module never imports
 * Microsoft Graph SDKs. It's the protocol seam between JSON-RPC and the
 * typed `TeamsMcpServer` interface.
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
  type TEAMS_TOOL_NAMES,
  type TeamsMcpServer,
} from './types';

// ── Schemas ─────────────────────────────────────────────────────────────

const listChatsArgsSchema = z.object({
  maxResults: z.number().int().positive().max(50).optional(),
  pageToken: z.string().optional(),
});

const getChatMessagesArgsSchema = z.object({
  chatId: z.string().min(1),
  maxResults: z.number().int().positive().max(50).optional(),
  pageToken: z.string().optional(),
});

const sendChatMessageArgsSchema = z.object({
  chatId: z.string().min(1),
  body: z.string().min(1),
  approvalToken: z.string().optional(),
});

const listChannelsArgsSchema = z.object({
  teamId: z.string().min(1),
});

const postToChannelArgsSchema = z.object({
  teamId: z.string().min(1),
  channelId: z.string().min(1),
  body: z.string().min(1),
  subject: z.string().optional(),
  approvalToken: z.string().optional(),
});

const listMeetingsArgsSchema = z.object({
  startFromIso: z.string().optional(),
  endByIso: z.string().optional(),
  maxResults: z.number().int().positive().max(50).optional(),
});

const getMeetingRecordingTranscriptArgsSchema = z.object({
  meetingId: z.string().min(1),
});

const readResourceArgsSchema = z.object({ uri: z.string().min(1) });

const toolsCallArgsSchema = z.object({
  name: z.string().min(1),
  arguments: z.unknown().optional(),
});

// ── Tool registry ───────────────────────────────────────────────────────

interface ToolRegistration {
  shortName: (typeof TEAMS_TOOL_NAMES)[number];
  description: string;
  schema: ZodTypeAny;
  invoke: (server: TeamsMcpServer, args: unknown) => Promise<McpResult<unknown>>;
}

const TOOLS: ToolRegistration[] = [
  {
    shortName: 'teams.list_chats',
    description:
      'List the connected Microsoft account’s Teams chats (1:1, group, meeting), most recent first.',
    schema: listChatsArgsSchema,
    invoke: (server, args) => server.listChats(listChatsArgsSchema.parse(args ?? {})),
  },
  {
    shortName: 'teams.get_chat_messages',
    description:
      'List messages in a Teams chat by chatId. HTML bodies are stripped to plain text.',
    schema: getChatMessagesArgsSchema,
    invoke: (server, args) =>
      server.getChatMessages(getChatMessagesArgsSchema.parse(args)),
  },
  {
    shortName: 'teams.send_chat_message',
    description:
      'Send a plain-text message into an existing Teams chat the connected account is a member of. APPROVAL-GATED: requires a non-empty approvalToken from the approval queue — never auto-fires.',
    schema: sendChatMessageArgsSchema,
    invoke: (server, args) =>
      server.sendChatMessage(sendChatMessageArgsSchema.parse(args)),
  },
  {
    shortName: 'teams.list_channels',
    description:
      'List channels inside a Microsoft Teams team (requires teamId).',
    schema: listChannelsArgsSchema,
    invoke: (server, args) =>
      server.listChannels(listChannelsArgsSchema.parse(args)),
  },
  {
    shortName: 'teams.post_to_channel',
    description:
      'Post a new message into a Teams channel the connected account participates in. APPROVAL-GATED: requires a non-empty approvalToken from the approval queue — never auto-fires.',
    schema: postToChannelArgsSchema,
    invoke: (server, args) =>
      server.postToChannel(postToChannelArgsSchema.parse(args)),
  },
  {
    shortName: 'teams.list_meetings',
    description:
      'List online meetings within a date window (default: last 7 days through next 7 days).',
    schema: listMeetingsArgsSchema,
    invoke: (server, args) =>
      server.listMeetings(listMeetingsArgsSchema.parse(args ?? {})),
  },
  {
    shortName: 'teams.get_meeting_recording_transcript',
    description:
      'Fetch the WebVTT transcript(s) for a Teams meeting recording. Empty when tenant policy blocks transcript export.',
    schema: getMeetingRecordingTranscriptArgsSchema,
    invoke: (server, args) =>
      server.getMeetingRecordingTranscript(
        getMeetingRecordingTranscriptArgsSchema.parse(args),
      ),
  },
];

const TOOL_BY_SHORTNAME = new Map(TOOLS.map((t) => [t.shortName, t]));
const TOOL_BY_BARE_NAME = new Map(
  TOOLS.map((t) => [t.shortName.replace(/^teams\./, ''), t]),
);

// ── Dispatcher ──────────────────────────────────────────────────────────

export interface DispatchOptions {
  server: TeamsMcpServer;
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
    const res = await options.server.listResources();
    return resultToRpc(id, res);
  }
  if (req.method === 'resources/read') {
    const parsed = parseParams(readResourceArgsSchema, req.params);
    if (!parsed.ok) {
      return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, parsed.message);
    }
    const res = await options.server.readResource(parsed.value);
    return resultToRpc(id, res);
  }
  if (req.method === 'tools/call') {
    const parsed = parseParams(toolsCallArgsSchema, req.params);
    if (!parsed.ok) {
      return rpcError(id, JSON_RPC_ERROR.INVALID_PARAMS, parsed.message);
    }
    const reg = TOOL_BY_SHORTNAME.get(
      parsed.value.name as (typeof TEAMS_TOOL_NAMES)[number],
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
    req.method as (typeof TEAMS_TOOL_NAMES)[number],
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
  server: TeamsMcpServer,
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

// ── HTTP status helper re-exported for route handlers ──────────────────

export function teamsErrorCodeToHttpStatus(code: McpErrorCode): number {
  return mcpErrorCodeToHttpStatus(code);
}

// ── In-process client for the smoke test ──────────────────────────────

export class InProcessTeamsMcpClient {
  private nextId = 1;
  constructor(private readonly server: TeamsMcpServer) {}

  async call(
    namespace: 'teams',
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
      throw new TeamsMcpClientError(
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
      throw new TeamsMcpClientError(response.error.message, response.error.code);
    }
    return (response.result as { tools: { name: string; description: string }[] }).tools;
  }
}

export class TeamsMcpClientError extends Error {
  constructor(
    message: string,
    readonly jsonRpcCode: number,
    readonly teamsErrorCode?: string,
  ) {
    super(message);
    this.name = 'TeamsMcpClientError';
  }
}
