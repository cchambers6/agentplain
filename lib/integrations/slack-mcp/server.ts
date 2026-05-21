/**
 * lib/integrations/slack-mcp/server.ts
 *
 * Production Slack MCP server. Wraps the Slack Web API behind the
 * `SlackMcpServer` interface. One instance per `{workspaceId}` per request.
 * This file is the ONLY place that calls the Slack Web API; route handlers +
 * skills speak the MCP interface (per `feedback_no_silent_vendor_lock.md`).
 *
 * Slack quirk: the Web API returns HTTP 200 even on logical errors. EVERY call
 * checks the JSON `ok` field and maps `ok:false` to the right McpError code.
 *
 * Cold-start safe: every method re-resolves the credential via
 * `resolveSlackCredential`; no token is cached on the instance.
 *
 * APPROVAL GATE (per `project_no_outbound_architecture.md`): `postMessage` and
 * `sendDm` post AS the customer via their token, but must NEVER auto-fire. They
 * return APPROVAL_REQUIRED — before any network call — unless the caller passes
 * a non-empty `approvalToken` (supplied only by a human approval step).
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import { resolveSlackCredential } from './auth';
import {
  type ChannelSummary,
  type ListChannelsInput,
  type ListChannelsOutput,
  type MessageSummary,
  type PostMessageInput,
  type PostMessageOutput,
  type ReadChannelHistoryInput,
  type ReadChannelHistoryOutput,
  type SearchMatch,
  type SearchMessagesInput,
  type SearchMessagesOutput,
  type SendDmInput,
  type SendDmOutput,
  type SlackMcpServer,
} from './types';

const DEFAULT_CHANNEL_LIMIT = 100;
const MAX_CHANNEL_LIMIT = 1000;
const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 1000;
const DEFAULT_SEARCH_COUNT = 20;
const MAX_SEARCH_COUNT = 100;

const APPROVAL_REQUIRED_MSG =
  'Posting to Slack requires human approval; pass approvalToken from the approval queue. This action acts as the customer and never auto-fires.';

export class ProdSlackMcpServer implements SlackMcpServer {
  readonly name = 'slack-web' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) throw new Error('ProdSlackMcpServer: workspaceId is required');
    this.workspaceId = args.workspaceId;
  }

  async listChannels(input: ListChannelsInput): Promise<McpResult<ListChannelsOutput>> {
    const limit = clamp(input.limit, DEFAULT_CHANNEL_LIMIT, MAX_CHANNEL_LIMIT);
    if (!limit.ok) return limit;
    return this.withApi(async (api) => {
      const params = new URLSearchParams({
        types: 'public_channel,private_channel',
        limit: String(limit.value),
      });
      const res = await api<{ channels?: RawChannel[] }>('GET', `conversations.list?${params.toString()}`);
      if (!res.ok) return res;
      return mcpOk({ channels: (res.value.channels ?? []).map(toChannelSummary) });
    });
  }

  async readChannelHistory(input: ReadChannelHistoryInput): Promise<McpResult<ReadChannelHistoryOutput>> {
    if (!input.channel) return mcpError('INVALID_ARGUMENT', 'readChannelHistory requires channel');
    const limit = clamp(input.limit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);
    if (!limit.ok) return limit;
    return this.withApi(async (api) => {
      const params = new URLSearchParams({
        channel: input.channel,
        limit: String(limit.value),
      });
      const res = await api<{ messages?: RawMessage[] }>('GET', `conversations.history?${params.toString()}`);
      if (!res.ok) return res;
      return mcpOk({
        channel: input.channel,
        messages: (res.value.messages ?? []).map(toMessageSummary),
      });
    });
  }

  async searchMessages(input: SearchMessagesInput): Promise<McpResult<SearchMessagesOutput>> {
    if (!input.query) return mcpError('INVALID_ARGUMENT', 'searchMessages requires query');
    const count = clamp(input.count, DEFAULT_SEARCH_COUNT, MAX_SEARCH_COUNT);
    if (!count.ok) return count;
    return this.withApi(async (api) => {
      // search.messages is user-token only — that's why we hold a user token.
      const params = new URLSearchParams({ query: input.query, count: String(count.value) });
      const res = await api<{
        messages?: { total?: number; matches?: RawSearchMatch[] };
      }>('GET', `search.messages?${params.toString()}`);
      if (!res.ok) return res;
      const matches = res.value.messages?.matches ?? [];
      return mcpOk({
        query: input.query,
        matches: matches.map(toSearchMatch),
        total: res.value.messages?.total ?? null,
      });
    });
  }

  async postMessage(input: PostMessageInput): Promise<McpResult<PostMessageOutput>> {
    if (!input.channel) return mcpError('INVALID_ARGUMENT', 'postMessage requires channel');
    if (!input.text) return mcpError('INVALID_ARGUMENT', 'postMessage requires text');
    // APPROVAL GATE — short-circuit before any network call.
    if (!input.approvalToken || input.approvalToken.trim().length === 0) return mcpError('APPROVAL_REQUIRED', APPROVAL_REQUIRED_MSG);
    return this.withApi(async (api) => {
      const res = await api<{ channel?: string; ts?: string }>('POST', 'chat.postMessage', {
        channel: input.channel,
        text: input.text,
      });
      if (!res.ok) return res;
      if (!res.value.ts) return mcpError('MALFORMED_RESPONSE', 'chat.postMessage returned no ts');
      return mcpOk({ channel: res.value.channel ?? input.channel, ts: res.value.ts });
    });
  }

  async sendDm(input: SendDmInput): Promise<McpResult<SendDmOutput>> {
    if (!input.userId) return mcpError('INVALID_ARGUMENT', 'sendDm requires userId');
    if (!input.text) return mcpError('INVALID_ARGUMENT', 'sendDm requires text');
    // APPROVAL GATE — short-circuit before any network call.
    if (!input.approvalToken || input.approvalToken.trim().length === 0) return mcpError('APPROVAL_REQUIRED', APPROVAL_REQUIRED_MSG);
    return this.withApi(async (api) => {
      const opened = await api<{ channel?: { id?: string } }>('POST', 'conversations.open', {
        users: input.userId,
      });
      if (!opened.ok) return opened;
      const dmChannel = opened.value.channel?.id;
      if (!dmChannel) return mcpError('MALFORMED_RESPONSE', 'conversations.open returned no channel id');
      const res = await api<{ channel?: string; ts?: string }>('POST', 'chat.postMessage', {
        channel: dmChannel,
        text: input.text,
      });
      if (!res.ok) return res;
      if (!res.value.ts) return mcpError('MALFORMED_RESPONSE', 'chat.postMessage returned no ts');
      return mcpOk({ channel: res.value.channel ?? dmChannel, userId: input.userId, ts: res.value.ts });
    });
  }

  // ── internals ─────────────────────────────────────────────────────────

  private async withApi<T>(fn: (api: ApiFn) => Promise<McpResult<T>>): Promise<McpResult<T>> {
    const resolved = await resolveSlackCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(makeApi(resolved.value.credential.accessToken));
  }
}

// ── Slack Web API helper ─────────────────────────────────────────────────

type ApiFn = <T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>) => Promise<McpResult<T>>;

function makeApi(accessToken: string): ApiFn {
  const authHeader = `Bearer ${accessToken}`;
  return async <T>(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>) => {
    let res: Response;
    try {
      res = await fetch(`https://slack.com/api/${path}`, {
        method,
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          ...(method === 'POST' ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
        },
        body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      });
    } catch (err) {
      return mcpError('NETWORK', `Slack network error: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    if (!res.ok) {
      // Slack rarely returns non-200, but map it if it does.
      if (res.status === 429) return mcpError('RATE_LIMITED', `HTTP 429 from Slack`, { status: 429 });
      return mcpError('UPSTREAM_ERROR', `HTTP ${res.status} from Slack: ${text.slice(0, 240)}`, { status: res.status });
    }
    let parsed: { ok?: boolean; error?: string } & Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return mcpError('MALFORMED_RESPONSE', `Slack JSON parse failed: ${err instanceof Error ? err.message : String(err)}`, { status: res.status });
    }
    // Slack returns HTTP 200 even on logical errors — `ok` is the real signal.
    if (parsed.ok !== true) {
      return mapSlackLogicalError(parsed.error);
    }
    return mcpOk(parsed as unknown as T);
  };
}

function mapSlackLogicalError(error: string | undefined): { ok: false; error: import('@/lib/integrations/mcp-core').McpError } {
  const reference = error ?? 'unknown_error';
  switch (error) {
    case 'not_in_channel':
    case 'is_archived':
    case 'restricted_action':
    case 'no_permission':
      return mcpError('FORBIDDEN', `Slack error: ${reference}`, { reference });
    case 'channel_not_found':
    case 'user_not_found':
    case 'users_not_found':
      return mcpError('NOT_FOUND', `Slack error: ${reference}`, { reference });
    case 'not_authed':
    case 'invalid_auth':
    case 'token_revoked':
    case 'token_expired':
      return mcpError('UNAUTHORIZED', `Slack error: ${reference}`, { reference });
    case 'ratelimited':
    case 'rate_limited':
      return mcpError('RATE_LIMITED', `Slack error: ${reference}`, { reference });
    default:
      return mcpError('UPSTREAM_ERROR', `Slack error: ${reference}`, { reference });
  }
}

// ── Raw → DTO mappers ────────────────────────────────────────────────────

interface RawChannel {
  id?: string;
  name?: string;
  is_private?: boolean;
  is_member?: boolean;
  topic?: { value?: string };
}

interface RawMessage {
  ts?: string;
  user?: string;
  text?: string;
}

interface RawSearchMatch {
  ts?: string;
  user?: string;
  text?: string;
  permalink?: string;
  channel?: { id?: string; name?: string };
}

function toChannelSummary(c: RawChannel): ChannelSummary {
  return {
    id: c.id ?? '',
    name: c.name ?? '',
    isPrivate: c.is_private ?? false,
    isMember: c.is_member ?? false,
    topic: c.topic?.value ? c.topic.value : null,
  };
}

function toMessageSummary(m: RawMessage): MessageSummary {
  return { ts: m.ts ?? '', user: m.user ?? null, text: m.text ?? '' };
}

function toSearchMatch(m: RawSearchMatch): SearchMatch {
  return {
    ts: m.ts ?? '',
    channelId: m.channel?.id ?? null,
    channelName: m.channel?.name ?? null,
    user: m.user ?? null,
    text: m.text ?? '',
    permalink: m.permalink ?? null,
  };
}

function clamp(value: number | undefined, fallback: number, max: number): McpResult<number> {
  if (value === undefined) return mcpOk(fallback);
  if (!Number.isInteger(value) || value <= 0) return mcpError('INVALID_ARGUMENT', `limit must be a positive integer, got ${value}`);
  if (value > max) return mcpError('INVALID_ARGUMENT', `limit must be <= ${max}, got ${value}`);
  return mcpOk(value);
}
