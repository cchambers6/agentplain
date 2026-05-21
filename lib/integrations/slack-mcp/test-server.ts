/**
 * lib/integrations/slack-mcp/test-server.ts
 *
 * Fixture-backed Slack MCP server — the second implementation that satisfies
 * the two-implementation rule (`feedback_runner_portability.md`). Deterministic,
 * no network, no credential resolution. Used by the smoke test + by
 * `INTEGRATIONS_PROVIDER=test` previews.
 *
 * The fixture STILL enforces the approval gate on `postMessage`/`sendDm` (returns
 * APPROVAL_REQUIRED without a non-empty approvalToken) so the smoke test can
 * assert the gate without a network round-trip.
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/mcp-core';
import {
  type ChannelSummary,
  type ListChannelsInput,
  type ListChannelsOutput,
  type MessageSummary,
  type PostMessageInput,
  type PostMessageOutput,
  type ReadChannelHistoryInput,
  type ReadChannelHistoryOutput,
  type SearchMessagesInput,
  type SearchMessagesOutput,
  type SendDmInput,
  type SendDmOutput,
  type SlackMcpServer,
} from './types';

const APPROVAL_REQUIRED_MSG =
  'Posting to Slack requires human approval; pass approvalToken from the approval queue. This action acts as the customer and never auto-fires.';

const FIXTURE_CHANNELS: ChannelSummary[] = [
  { id: 'C1001', name: 'general', isPrivate: false, isMember: true, topic: 'Company-wide announcements' },
  { id: 'C1002', name: 'listings', isPrivate: false, isMember: true, topic: 'New listings coordination' },
  { id: 'G2001', name: 'broker-private', isPrivate: true, isMember: true, topic: null },
];

const FIXTURE_HISTORY: Record<string, MessageSummary[]> = {
  C1001: [
    { ts: '1715000000.000100', user: 'U500', text: 'Welcome to the workspace!' },
    { ts: '1715000100.000200', user: 'U501', text: 'New listing at 123 Peachtree just went live.' },
  ],
};

export class TestSlackMcpServer implements SlackMcpServer {
  readonly name = 'slack-test' as const;
  readonly workspaceId: string;
  constructor(args: { workspaceId: string }) {
    this.workspaceId = args.workspaceId;
  }

  async listChannels(_input: ListChannelsInput): Promise<McpResult<ListChannelsOutput>> {
    return mcpOk({ channels: FIXTURE_CHANNELS });
  }

  async readChannelHistory(input: ReadChannelHistoryInput): Promise<McpResult<ReadChannelHistoryOutput>> {
    if (!FIXTURE_CHANNELS.some((c) => c.id === input.channel)) {
      return mcpError('NOT_FOUND', `No channel ${input.channel}`);
    }
    return mcpOk({ channel: input.channel, messages: FIXTURE_HISTORY[input.channel] ?? [] });
  }

  async searchMessages(input: SearchMessagesInput): Promise<McpResult<SearchMessagesOutput>> {
    const matches = Object.entries(FIXTURE_HISTORY)
      .flatMap(([channelId, msgs]) => msgs.map((m) => ({ channelId, ...m })))
      .filter((m) => m.text.toLowerCase().includes(input.query.toLowerCase()))
      .map((m) => ({
        ts: m.ts,
        channelId: m.channelId,
        channelName: FIXTURE_CHANNELS.find((c) => c.id === m.channelId)?.name ?? null,
        user: m.user,
        text: m.text,
        permalink: `https://example.slack.com/archives/${m.channelId}/p${m.ts.replace('.', '')}`,
      }));
    return mcpOk({ query: input.query, matches, total: matches.length });
  }

  async postMessage(input: PostMessageInput): Promise<McpResult<PostMessageOutput>> {
    if (!input.channel) return mcpError('INVALID_ARGUMENT', 'postMessage requires channel');
    if (!input.text) return mcpError('INVALID_ARGUMENT', 'postMessage requires text');
    // APPROVAL GATE — mirrors the prod server so the smoke test can assert it.
    if (!input.approvalToken || input.approvalToken.trim().length === 0) return mcpError('APPROVAL_REQUIRED', APPROVAL_REQUIRED_MSG);
    return mcpOk({ channel: input.channel, ts: '1715009999.000001' });
  }

  async sendDm(input: SendDmInput): Promise<McpResult<SendDmOutput>> {
    if (!input.userId) return mcpError('INVALID_ARGUMENT', 'sendDm requires userId');
    if (!input.text) return mcpError('INVALID_ARGUMENT', 'sendDm requires text');
    // APPROVAL GATE — mirrors the prod server so the smoke test can assert it.
    if (!input.approvalToken || input.approvalToken.trim().length === 0) return mcpError('APPROVAL_REQUIRED', APPROVAL_REQUIRED_MSG);
    return mcpOk({ channel: 'D3001', userId: input.userId, ts: '1715009999.000002' });
  }
}
