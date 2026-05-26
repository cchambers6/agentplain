/**
 * lib/integrations/teams-mcp/test-server.ts
 *
 * Deterministic, in-memory implementation of `TeamsMcpServer`. Symmetric
 * peer of `./server.ts` per `feedback_runner_portability.md`. Used by:
 *   * `scripts/test-teams-mcp.ts` smoke test — proves wiring without an
 *     OAuth grant
 *   * Local dev when Teams isn't OAuth-connected for a workspace yet
 *     (`TEST_M365_MCP=true` routes the factory here)
 *
 * Per `project_no_outbound_architecture.md` exception (see types.ts): the
 * test impl exposes `sendChatMessage` and `postToChannel` because Teams
 * surfaces are internal customer-system messaging, not cold outbound.
 * Records to in-memory log; never hits a network.
 *
 * The fixture STILL enforces the approval gate on `sendChatMessage` /
 * `postToChannel` (returns APPROVAL_REQUIRED without a non-empty
 * approvalToken) so the smoke test can assert the gate without a Graph
 * round-trip. Mirrors the Slack test-server (slack-mcp/test-server.ts).
 */

import { mcpError, mcpOk, type McpResult } from '@/lib/integrations/microsoft/mcp-common';

const APPROVAL_REQUIRED_MSG =
  'Posting to Teams requires human approval; pass approvalToken from the approval queue. This action acts as the customer and never auto-fires.';

import {
  type ChannelSummary,
  type ChatMessage,
  type ChatSummary,
  type GetChatMessagesInput,
  type GetChatMessagesOutput,
  type GetMeetingRecordingTranscriptInput,
  type GetMeetingRecordingTranscriptOutput,
  type ListChannelsInput,
  type ListChannelsOutput,
  type ListChatsInput,
  type ListChatsOutput,
  type ListMeetingsInput,
  type ListMeetingsOutput,
  type MeetingSummary,
  type MeetingTranscript,
  type PostToChannelInput,
  type PostToChannelOutput,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SendChatMessageInput,
  type SendChatMessageOutput,
  type TeamsMcpServer,
} from './types';

export interface TestTeamsSeed {
  chats?: ChatSummary[];
  chatMessages?: Record<string, ChatMessage[]>;
  channels?: Record<string, ChannelSummary[]>;
  meetings?: MeetingSummary[];
  transcripts?: Record<string, MeetingTranscript[]>;
}

interface SentMessage {
  messageId: string;
  chatId?: string;
  teamId?: string;
  channelId?: string;
  body: string;
  subject?: string;
  createdAt: string;
}

export class TestTeamsMcpServer implements TeamsMcpServer {
  readonly name = 'teams-test' as const;
  readonly workspaceId: string;
  private readonly chats: ChatSummary[];
  private readonly chatMessages: Map<string, ChatMessage[]>;
  private readonly channels: Map<string, ChannelSummary[]>;
  private readonly meetings: MeetingSummary[];
  private readonly transcripts: Map<string, MeetingTranscript[]>;
  private readonly sentMessages: SentMessage[] = [];
  private msgCounter = 0;

  readonly calls: Array<{ method: string; args: unknown }> = [];

  constructor(args: { workspaceId: string; seed?: TestTeamsSeed }) {
    if (!args.workspaceId) {
      throw new Error('TestTeamsMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.chats = args.seed?.chats ?? defaultChats();
    this.chatMessages = new Map(Object.entries(args.seed?.chatMessages ?? defaultChatMessages()));
    this.channels = new Map(Object.entries(args.seed?.channels ?? defaultChannels()));
    this.meetings = args.seed?.meetings ?? defaultMeetings();
    this.transcripts = new Map(Object.entries(args.seed?.transcripts ?? defaultTranscripts()));
  }

  async listChats(input: ListChatsInput): Promise<McpResult<ListChatsOutput>> {
    this.calls.push({ method: 'listChats', args: input });
    const max = input.maxResults ?? 25;
    const slice = this.chats.slice(0, max);
    return mcpOk({
      chats: slice,
      nextPageToken: this.chats.length > max ? `test-chat-page-${max}` : null,
    });
  }

  async getChatMessages(
    input: GetChatMessagesInput,
  ): Promise<McpResult<GetChatMessagesOutput>> {
    this.calls.push({ method: 'getChatMessages', args: input });
    if (!input.chatId) {
      return mcpError('INVALID_ARGUMENT', 'getChatMessages requires chatId');
    }
    const list = this.chatMessages.get(input.chatId) ?? [];
    const max = input.maxResults ?? 25;
    return mcpOk({
      messages: list.slice(0, max),
      nextPageToken: list.length > max ? `test-msg-page-${max}` : null,
    });
  }

  async sendChatMessage(
    input: SendChatMessageInput,
  ): Promise<McpResult<SendChatMessageOutput>> {
    this.calls.push({ method: 'sendChatMessage', args: input });
    if (!input.chatId) {
      return mcpError('INVALID_ARGUMENT', 'sendChatMessage requires chatId');
    }
    if (!input.body) {
      return mcpError('INVALID_ARGUMENT', 'sendChatMessage requires body');
    }
    // APPROVAL GATE — mirrors the prod server so the smoke test can assert it.
    if (!input.approvalToken || input.approvalToken.trim().length === 0) {
      return mcpError('APPROVAL_REQUIRED', APPROVAL_REQUIRED_MSG);
    }
    this.msgCounter += 1;
    const messageId = `19:test-msg-${this.msgCounter}`;
    const createdAt = new Date().toISOString();
    this.sentMessages.push({
      messageId,
      chatId: input.chatId,
      body: input.body,
      createdAt,
    });
    return mcpOk({ messageId, chatId: input.chatId, createdAt });
  }

  async listChannels(
    input: ListChannelsInput,
  ): Promise<McpResult<ListChannelsOutput>> {
    this.calls.push({ method: 'listChannels', args: input });
    if (!input.teamId) {
      return mcpError('INVALID_ARGUMENT', 'listChannels requires teamId');
    }
    return mcpOk({ channels: this.channels.get(input.teamId) ?? [] });
  }

  async postToChannel(
    input: PostToChannelInput,
  ): Promise<McpResult<PostToChannelOutput>> {
    this.calls.push({ method: 'postToChannel', args: input });
    if (!input.teamId || !input.channelId) {
      return mcpError(
        'INVALID_ARGUMENT',
        'postToChannel requires teamId and channelId',
      );
    }
    if (!input.body) {
      return mcpError('INVALID_ARGUMENT', 'postToChannel requires body');
    }
    // APPROVAL GATE — mirrors the prod server so the smoke test can assert it.
    if (!input.approvalToken || input.approvalToken.trim().length === 0) {
      return mcpError('APPROVAL_REQUIRED', APPROVAL_REQUIRED_MSG);
    }
    this.msgCounter += 1;
    const messageId = `19:test-channel-msg-${this.msgCounter}`;
    const createdAt = new Date().toISOString();
    this.sentMessages.push({
      messageId,
      teamId: input.teamId,
      channelId: input.channelId,
      body: input.body,
      subject: input.subject,
      createdAt,
    });
    return mcpOk({
      messageId,
      teamId: input.teamId,
      channelId: input.channelId,
      createdAt,
      webUrl: `https://teams.microsoft.com/l/message/${encodeURIComponent(input.channelId)}/${this.msgCounter}`,
    });
  }

  async listMeetings(input: ListMeetingsInput): Promise<McpResult<ListMeetingsOutput>> {
    this.calls.push({ method: 'listMeetings', args: input });
    const max = input.maxResults ?? 25;
    return mcpOk({ meetings: this.meetings.slice(0, max) });
  }

  async getMeetingRecordingTranscript(
    input: GetMeetingRecordingTranscriptInput,
  ): Promise<McpResult<GetMeetingRecordingTranscriptOutput>> {
    this.calls.push({ method: 'getMeetingRecordingTranscript', args: input });
    if (!input.meetingId) {
      return mcpError(
        'INVALID_ARGUMENT',
        'getMeetingRecordingTranscript requires meetingId',
      );
    }
    return mcpOk({ transcripts: this.transcripts.get(input.meetingId) ?? [] });
  }

  async listResources(): Promise<McpResult<ResourceDescriptor[]>> {
    return mcpOk([
      {
        uri: `teams://workspace/${this.workspaceId}/chats`,
        name: 'Chats (test)',
        description: 'Fixture-backed chats view for the test Teams MCP server.',
        mimeType: 'application/json',
      },
      {
        uri: `teams://workspace/${this.workspaceId}/meetings`,
        name: 'Meetings (test)',
        description: 'Fixture-backed meeting list.',
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<McpResult<ReadResourceOutput>> {
    if (/^teams:\/\/workspace\/[0-9a-f-]+\/chats/i.test(input.uri)) {
      const list = await this.listChats({});
      if (!list.ok) return list;
      return mcpOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    if (/^teams:\/\/workspace\/[0-9a-f-]+\/meetings$/i.test(input.uri)) {
      const list = await this.listMeetings({});
      if (!list.ok) return list;
      return mcpOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    return mcpError('INVALID_ARGUMENT', `Unknown resource URI: ${input.uri}`);
  }

  // ── Test affordances ─────────────────────────────────────────────────

  getSentMessages(): readonly SentMessage[] {
    return this.sentMessages;
  }
}

// ── Default fixtures ────────────────────────────────────────────────────

function defaultChats(): ChatSummary[] {
  const now = new Date('2026-05-18T10:00:00Z');
  return [
    {
      id: '19:chat-fixture-001@thread.v2',
      chatType: 'oneOnOne',
      topic: null,
      lastUpdatedAt: now.toISOString(),
      memberNames: ['Jane Buyer', 'Broker'],
    },
    {
      id: '19:chat-fixture-002@thread.v2',
      chatType: 'group',
      topic: '123 Peachtree St — closing thread',
      lastUpdatedAt: new Date(now.getTime() - 3600_000).toISOString(),
      memberNames: ['Jane Buyer', 'Title escrow', 'Broker'],
    },
  ];
}

function defaultChatMessages(): Record<string, ChatMessage[]> {
  const base = new Date('2026-05-18T10:00:00Z');
  return {
    '19:chat-fixture-001@thread.v2': [
      {
        id: 'msg-fixture-001',
        chatId: '19:chat-fixture-001@thread.v2',
        messageType: 'message',
        bodyText: 'Hey, are we still on for the showing Wednesday?',
        bodyContentType: 'text',
        fromName: 'Jane Buyer',
        fromEmail: null,
        createdAt: base.toISOString(),
        lastModifiedAt: null,
      },
      {
        id: 'msg-fixture-002',
        chatId: '19:chat-fixture-001@thread.v2',
        messageType: 'message',
        bodyText: 'Yes! 2pm at 123 Peachtree.',
        bodyContentType: 'text',
        fromName: 'Broker',
        fromEmail: null,
        createdAt: new Date(base.getTime() + 60_000).toISOString(),
        lastModifiedAt: null,
      },
    ],
  };
}

function defaultChannels(): Record<string, ChannelSummary[]> {
  return {
    'team-fixture-001': [
      {
        id: '19:channel-general@thread.tacv2',
        teamId: 'team-fixture-001',
        displayName: 'General',
        description: 'The team’s default channel.',
        membershipType: 'standard',
        webUrl: 'https://teams.microsoft.com/l/channel/test-general',
      },
      {
        id: '19:channel-listings@thread.tacv2',
        teamId: 'team-fixture-001',
        displayName: 'Active listings',
        description: 'Where the listing team coordinates per-property work.',
        membershipType: 'standard',
        webUrl: 'https://teams.microsoft.com/l/channel/test-listings',
      },
    ],
  };
}

function defaultMeetings(): MeetingSummary[] {
  const start = new Date('2026-05-20T14:00:00Z');
  return [
    {
      id: 'meeting-fixture-001',
      subject: 'Listing review — 123 Peachtree St',
      joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/test-meeting-001',
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
      organizerEmail: 'broker@example-realty.com',
      attendeeEmails: ['jane.buyer@example.com'],
    },
  ];
}

function defaultTranscripts(): Record<string, MeetingTranscript[]> {
  return {
    'meeting-fixture-001': [
      {
        id: 'transcript-fixture-001',
        meetingId: 'meeting-fixture-001',
        createdAt: '2026-05-20T14:30:00Z',
        contentVtt:
          'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nJane: Thanks for jumping on.\n\n00:00:05.000 --> 00:00:10.000\nBroker: Of course — let’s walk through the offer.\n',
        contentUrl: null,
      },
    ],
  };
}
