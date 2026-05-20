/**
 * lib/integrations/slack-mcp/types.ts
 *
 * Slack MCP server tool surface. One instance per `{workspaceId}` per request
 * (never reused across workspaces). Built on `lib/integrations/mcp-core` — the
 * vendor-neutral JSON-RPC envelope + result shapes — so the wire format matches
 * the shipped Gmail/Outlook/DocuSign servers.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: the bar is a real
 * read+act surface — list channels, read history, search messages, draft+post —
 * not just OAuth plumbing.
 *
 * Per `project_no_outbound_architecture.md`: `post_message` and `send_dm` act
 * through the CUSTOMER's own Slack (via their user token), and BOTH are gated
 * behind an explicit human approval step — they never auto-fire. The gate is
 * enforced by requiring a non-empty `approvalToken` before any network call.
 */

import type { McpResult, McpServerBase } from '@/lib/integrations/mcp-core';

export type SlackMcpResult<T> = McpResult<T>;

// ── DTOs ─────────────────────────────────────────────────────────────────

export interface ChannelSummary {
  id: string;
  name: string;
  isPrivate: boolean;
  isMember: boolean;
  /** Channel topic text, if any. */
  topic: string | null;
}

export interface ListChannelsInput {
  /** 1..1000, default 100. */
  limit?: number;
}

export interface ListChannelsOutput {
  channels: ChannelSummary[];
}

export interface MessageSummary {
  /** Message timestamp id (`ts`) — also the in-channel message key. */
  ts: string;
  /** Slack user id of the author, when present. */
  user: string | null;
  text: string;
}

export interface ReadChannelHistoryInput {
  channel: string;
  /** 1..1000, default 50. */
  limit?: number;
}

export interface ReadChannelHistoryOutput {
  channel: string;
  messages: MessageSummary[];
}

export interface SearchMatch {
  ts: string;
  channelId: string | null;
  channelName: string | null;
  user: string | null;
  text: string;
  permalink: string | null;
}

export interface SearchMessagesInput {
  query: string;
  /** 1..100, default 20. */
  count?: number;
}

export interface SearchMessagesOutput {
  query: string;
  matches: SearchMatch[];
  total: number | null;
}

export interface PostMessageInput {
  channel: string;
  text: string;
  /**
   * Approval-queue token. REQUIRED and non-empty — posting routes through the
   * approval queue and never auto-fires. Supplied only by a human approval
   * step; absence yields APPROVAL_REQUIRED before any network call.
   */
  approvalToken?: string;
}

export interface PostMessageOutput {
  channel: string;
  ts: string;
}

export interface SendDmInput {
  /** Slack user id to DM. */
  userId: string;
  text: string;
  /** Approval-queue token — same gate as `post_message`. */
  approvalToken?: string;
}

export interface SendDmOutput {
  channel: string;
  userId: string;
  ts: string;
}

// ── Interface every implementation honors ──────────────────────────────────

export interface SlackMcpServer extends McpServerBase {
  listChannels(input: ListChannelsInput): Promise<SlackMcpResult<ListChannelsOutput>>;
  readChannelHistory(input: ReadChannelHistoryInput): Promise<SlackMcpResult<ReadChannelHistoryOutput>>;
  searchMessages(input: SearchMessagesInput): Promise<SlackMcpResult<SearchMessagesOutput>>;
  postMessage(input: PostMessageInput): Promise<SlackMcpResult<PostMessageOutput>>;
  sendDm(input: SendDmInput): Promise<SlackMcpResult<SendDmOutput>>;
}

export const SLACK_NAMESPACE = 'slack';
