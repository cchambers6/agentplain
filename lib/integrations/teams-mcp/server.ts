/**
 * lib/integrations/teams-mcp/server.ts
 *
 * Production Teams MCP server. Wraps Microsoft Graph behind the
 * `TeamsMcpServer` interface declared in `./types.ts`. One instance per
 * `{workspaceId}` per request — the workspace boundary is the server's
 * identity, not enforced on every call.
 *
 * Per `feedback_no_silent_vendor_lock.md`: every Graph hit goes through
 * `lib/integrations/microsoft/graph-client.ts:MicrosoftGraphClient`, so
 * the count of files in this folder that touch `graph.microsoft.com` is
 * exactly zero. Skill code consumes the MCP interface only.
 *
 * Per `feedback_cold_start_safe_agents.md`: every public method
 * re-resolves the credential via `./auth.ts:resolveCredential`. No
 * decrypted credential lives on the instance.
 *
 * Microsoft Graph endpoints used (read 2026-05-19):
 *   * `/me/chats`                                          — list chats
 *   * `/chats/{id}/messages`                               — list chat messages
 *   * `/chats/{id}/messages`  (POST)                        — send chat message
 *   * `/teams/{teamId}/channels`                            — list channels
 *   * `/teams/{teamId}/channels/{channelId}/messages` POST — post to channel
 *   * `/me/onlineMeetings`                                  — list meetings
 *   * `/me/onlineMeetings/{id}/transcripts`                 — transcript list
 *   * `/me/onlineMeetings/{id}/transcripts/{tid}/content`   — transcript body
 */

import { resolveCredential } from './auth';
import { MicrosoftGraphClient } from '@/lib/integrations/microsoft/graph-client';
import {
  extractSkipToken,
  mcpError,
  mcpOk,
  type McpResult,
} from '@/lib/integrations/microsoft/mcp-common';
import type { DecryptedCredential } from '@/lib/integrations/types';
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

const DEFAULT_MAX_RESULTS = 25;
const MAX_PAGE_SIZE = 50;
const RESOURCE_URI_CHATS_RE =
  /^teams:\/\/workspace\/([0-9a-f-]+)\/chats(?:\?pageToken=([^&]+))?$/i;
const RESOURCE_URI_MEETINGS_RE =
  /^teams:\/\/workspace\/([0-9a-f-]+)\/meetings$/i;

/** Microsoft Graph Teams resource shapes — strictly what this server reads. */
interface GraphIdentity {
  user?: { id?: string; displayName?: string; userIdentityType?: string };
  application?: { id?: string; displayName?: string };
}

interface GraphConversationMember {
  id?: string;
  displayName?: string;
  email?: string | null;
}

interface GraphChat {
  id?: string;
  chatType?: string;
  topic?: string | null;
  createdDateTime?: string;
  lastUpdatedDateTime?: string;
  members?: GraphConversationMember[];
}

interface GraphChatMessage {
  id?: string;
  chatId?: string;
  channelIdentity?: { teamId?: string; channelId?: string };
  messageType?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string | null;
  body?: { contentType?: string; content?: string };
  from?: { user?: { displayName?: string; id?: string }; application?: { displayName?: string } };
  webUrl?: string | null;
}

interface GraphChannel {
  id?: string;
  displayName?: string;
  description?: string | null;
  membershipType?: string;
  webUrl?: string | null;
}

interface GraphMeetingAttendee {
  upn?: string | null;
  emailAddress?: { address?: string };
  identity?: GraphIdentity;
}

interface GraphOnlineMeeting {
  id?: string;
  subject?: string | null;
  joinWebUrl?: string | null;
  startDateTime?: string;
  endDateTime?: string;
  participants?: {
    organizer?: { upn?: string | null; identity?: GraphIdentity };
    attendees?: GraphMeetingAttendee[];
  };
}

interface GraphMeetingTranscript {
  id?: string;
  createdDateTime?: string;
  meetingId?: string;
  transcriptContentUrl?: string | null;
}

interface GraphListResponse<T> {
  value?: T[];
  '@odata.nextLink'?: string;
}

export class ProdTeamsMcpServer implements TeamsMcpServer {
  readonly name = 'teams-graph' as const;
  readonly workspaceId: string;
  private readonly graph: MicrosoftGraphClient;

  constructor(args: { workspaceId: string; fetchImpl?: typeof fetch }) {
    if (!args.workspaceId) {
      throw new Error('ProdTeamsMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.graph = new MicrosoftGraphClient({ fetchImpl: args.fetchImpl });
  }

  // ── Tools: Chats ─────────────────────────────────────────────────────

  async listChats(input: ListChatsInput): Promise<McpResult<ListChatsOutput>> {
    const max = clampMax(input.maxResults);
    return this.withCredential(async (cred) => {
      // `$expand=members` populates the `members` array with display names
      // — useful for the operator UI's chat picker without a second hop.
      const params = new URLSearchParams({
        $top: String(max),
        $expand: 'members',
        $orderby: 'lastUpdatedDateTime desc',
      });
      if (input.pageToken) params.set('$skiptoken', input.pageToken);
      const url = this.graph.url(`/me/chats?${params.toString()}`);
      const res = await this.graph.get<GraphListResponse<GraphChat>>(cred, url);
      if (!res.ok) return res;
      const chats: ChatSummary[] = (res.value.value ?? []).map(parseChat);
      return mcpOk({
        chats,
        nextPageToken: extractSkipToken(res.value['@odata.nextLink'] ?? null),
      });
    });
  }

  async getChatMessages(
    input: GetChatMessagesInput,
  ): Promise<McpResult<GetChatMessagesOutput>> {
    if (!input.chatId) {
      return mcpError('INVALID_ARGUMENT', 'getChatMessages requires chatId');
    }
    const max = clampMax(input.maxResults);
    return this.withCredential(async (cred) => {
      const params = new URLSearchParams({ $top: String(max) });
      if (input.pageToken) params.set('$skiptoken', input.pageToken);
      const url = this.graph.url(
        `/chats/${encodeURIComponent(input.chatId)}/messages?${params.toString()}`,
      );
      const res = await this.graph.get<GraphListResponse<GraphChatMessage>>(cred, url);
      if (!res.ok) return res;
      const messages = (res.value.value ?? []).map(parseChatMessage);
      return mcpOk({
        messages,
        nextPageToken: extractSkipToken(res.value['@odata.nextLink'] ?? null),
      });
    });
  }

  async sendChatMessage(
    input: SendChatMessageInput,
  ): Promise<McpResult<SendChatMessageOutput>> {
    if (!input.chatId) {
      return mcpError('INVALID_ARGUMENT', 'sendChatMessage requires chatId');
    }
    if (!input.body) {
      return mcpError('INVALID_ARGUMENT', 'sendChatMessage requires body');
    }
    return this.withCredential(async (cred) => {
      // POST /chats/{id}/messages — Microsoft Graph creates the message
      // and broadcasts it to the chat. `body.contentType=text` keeps us
      // out of the HTML-sanitisation rabbit hole; skills that want
      // formatting can switch to `html` in a future tool variant.
      const url = this.graph.url(
        `/chats/${encodeURIComponent(input.chatId)}/messages`,
      );
      const res = await this.graph.request<GraphChatMessage>(cred, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: { contentType: 'text', content: input.body },
        }),
      });
      if (!res.ok) return res;
      const msg = res.value;
      if (!msg.id) {
        return mcpError('MALFORMED_RESPONSE', 'POST chat message returned no id');
      }
      return mcpOk({
        messageId: msg.id,
        chatId: msg.chatId ?? input.chatId,
        createdAt: msg.createdDateTime ?? new Date().toISOString(),
      });
    });
  }

  // ── Tools: Channels ──────────────────────────────────────────────────

  async listChannels(
    input: ListChannelsInput,
  ): Promise<McpResult<ListChannelsOutput>> {
    if (!input.teamId) {
      return mcpError('INVALID_ARGUMENT', 'listChannels requires teamId');
    }
    return this.withCredential(async (cred) => {
      const url = this.graph.url(
        `/teams/${encodeURIComponent(input.teamId)}/channels`,
      );
      const res = await this.graph.get<GraphListResponse<GraphChannel>>(cred, url);
      if (!res.ok) return res;
      const channels: ChannelSummary[] = (res.value.value ?? []).map((c) => ({
        id: c.id ?? '',
        teamId: input.teamId,
        displayName: c.displayName ?? '',
        description: c.description ?? null,
        membershipType: c.membershipType ?? 'standard',
        webUrl: c.webUrl ?? null,
      }));
      return mcpOk({ channels });
    });
  }

  async postToChannel(
    input: PostToChannelInput,
  ): Promise<McpResult<PostToChannelOutput>> {
    if (!input.teamId) {
      return mcpError('INVALID_ARGUMENT', 'postToChannel requires teamId');
    }
    if (!input.channelId) {
      return mcpError('INVALID_ARGUMENT', 'postToChannel requires channelId');
    }
    if (!input.body) {
      return mcpError('INVALID_ARGUMENT', 'postToChannel requires body');
    }
    return this.withCredential(async (cred) => {
      const url = this.graph.url(
        `/teams/${encodeURIComponent(input.teamId)}/channels/${encodeURIComponent(input.channelId)}/messages`,
      );
      const requestBody: Record<string, unknown> = {
        body: { contentType: 'text', content: input.body },
      };
      if (input.subject) requestBody.subject = input.subject;
      const res = await this.graph.request<GraphChatMessage>(cred, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) return res;
      const msg = res.value;
      if (!msg.id) {
        return mcpError(
          'MALFORMED_RESPONSE',
          'POST channel message returned no id',
        );
      }
      return mcpOk({
        messageId: msg.id,
        teamId: input.teamId,
        channelId: input.channelId,
        createdAt: msg.createdDateTime ?? new Date().toISOString(),
        webUrl: msg.webUrl ?? null,
      });
    });
  }

  // ── Tools: Meetings ──────────────────────────────────────────────────

  async listMeetings(
    input: ListMeetingsInput,
  ): Promise<McpResult<ListMeetingsOutput>> {
    const now = Date.now();
    const startFrom = input.startFromIso ?? new Date(now - 7 * 24 * 3600_000).toISOString();
    const endBy = input.endByIso ?? new Date(now + 7 * 24 * 3600_000).toISOString();
    const max = clampMax(input.maxResults);
    return this.withCredential(async (cred) => {
      // Per Microsoft Graph 1.0 docs (read 2026-05-19), `/me/onlineMeetings`
      // requires a $filter on startDateTime + endDateTime for list
      // operations — un-scoped listing returns 400.
      const filter = `startDateTime ge ${startFrom} and endDateTime le ${endBy}`;
      const params = new URLSearchParams({
        $filter: filter,
        $top: String(max),
        $orderby: 'startDateTime desc',
      });
      const url = this.graph.url(`/me/onlineMeetings?${params.toString()}`);
      const res = await this.graph.get<GraphListResponse<GraphOnlineMeeting>>(cred, url);
      if (!res.ok) return res;
      const meetings: MeetingSummary[] = (res.value.value ?? []).map(parseMeeting);
      return mcpOk({ meetings });
    });
  }

  async getMeetingRecordingTranscript(
    input: GetMeetingRecordingTranscriptInput,
  ): Promise<McpResult<GetMeetingRecordingTranscriptOutput>> {
    if (!input.meetingId) {
      return mcpError(
        'INVALID_ARGUMENT',
        'getMeetingRecordingTranscript requires meetingId',
      );
    }
    return this.withCredential(async (cred) => {
      const url = this.graph.url(
        `/me/onlineMeetings/${encodeURIComponent(input.meetingId)}/transcripts`,
      );
      const listRes = await this.graph.get<GraphListResponse<GraphMeetingTranscript>>(cred, url);
      if (!listRes.ok) return listRes;
      const list = listRes.value.value ?? [];
      const out: MeetingTranscript[] = [];
      for (const t of list) {
        const id = t.id;
        if (!id) continue;
        // Pull the VTT body. Microsoft serves it at `/content` with
        // text/vtt media type; we ask for text/vtt explicitly.
        const contentUrl = this.graph.url(
          `/me/onlineMeetings/${encodeURIComponent(input.meetingId)}/transcripts/${encodeURIComponent(id)}/content`,
        );
        const raw = await this.graph.fetchRaw(cred, contentUrl, {
          method: 'GET',
          headers: { Accept: 'text/vtt' },
        });
        let vtt = '';
        if (raw.ok) {
          try {
            vtt = await raw.value.text();
          } catch {
            vtt = '';
          }
        }
        out.push({
          id,
          meetingId: input.meetingId,
          createdAt: t.createdDateTime ?? new Date().toISOString(),
          contentVtt: vtt,
          contentUrl: t.transcriptContentUrl ?? null,
        });
      }
      return mcpOk({ transcripts: out });
    });
  }

  // ── Resources ────────────────────────────────────────────────────────

  async listResources(): Promise<McpResult<ResourceDescriptor[]>> {
    return mcpOk([
      {
        uri: `teams://workspace/${this.workspaceId}/chats`,
        name: 'Chats',
        description:
          "Paginated view of the workspace's connected Microsoft Teams chats. Pass `?pageToken=…` to paginate.",
        mimeType: 'application/json',
      },
      {
        uri: `teams://workspace/${this.workspaceId}/meetings`,
        name: 'Online meetings',
        description:
          'Online meetings the connected account organized or attends in the next 7 days.',
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<McpResult<ReadResourceOutput>> {
    const chatsMatch = RESOURCE_URI_CHATS_RE.exec(input.uri);
    if (chatsMatch) {
      if (chatsMatch[1] !== this.workspaceId) {
        return mcpError(
          'FORBIDDEN',
          `Resource workspace ${chatsMatch[1]} does not match server workspace ${this.workspaceId}`,
        );
      }
      const list = await this.listChats({
        maxResults: DEFAULT_MAX_RESULTS,
        pageToken: chatsMatch[2],
      });
      if (!list.ok) return list;
      return mcpOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    const meetingsMatch = RESOURCE_URI_MEETINGS_RE.exec(input.uri);
    if (meetingsMatch) {
      if (meetingsMatch[1] !== this.workspaceId) {
        return mcpError(
          'FORBIDDEN',
          `Resource workspace ${meetingsMatch[1]} does not match server workspace ${this.workspaceId}`,
        );
      }
      const list = await this.listMeetings({});
      if (!list.ok) return list;
      return mcpOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    return mcpError(
      'INVALID_ARGUMENT',
      `Unknown resource URI: ${input.uri}. Expected teams://workspace/{workspaceId}/{chats|meetings}.`,
    );
  }

  // ── internals ────────────────────────────────────────────────────────

  private async withCredential<T>(
    fn: (credential: DecryptedCredential) => Promise<McpResult<T>>,
  ): Promise<McpResult<T>> {
    const resolved = await resolveCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(resolved.value);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function clampMax(value: number | undefined): number {
  if (value === undefined) return DEFAULT_MAX_RESULTS;
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_RESULTS;
  return Math.min(MAX_PAGE_SIZE, Math.floor(value));
}

function parseChat(c: GraphChat): ChatSummary {
  const memberNames = (c.members ?? [])
    .map((m) => (m.displayName ?? '').trim())
    .filter((n) => n.length > 0);
  return {
    id: c.id ?? '',
    chatType: c.chatType ?? 'group',
    topic: c.topic ?? null,
    lastUpdatedAt: c.lastUpdatedDateTime ?? null,
    memberNames,
  };
}

export function parseChatMessage(m: GraphChatMessage): ChatMessage {
  const contentType =
    (m.body?.contentType ?? 'text').toLowerCase() === 'html' ? 'html' : 'text';
  const rawBody = m.body?.content ?? '';
  const bodyText = contentType === 'html' ? stripHtml(rawBody) : rawBody;
  const fromName = m.from?.user?.displayName ?? m.from?.application?.displayName ?? null;
  return {
    id: m.id ?? '',
    chatId: m.chatId ?? m.channelIdentity?.channelId ?? '',
    messageType: m.messageType ?? 'message',
    bodyText,
    bodyContentType: contentType,
    fromName,
    fromEmail: null,
    createdAt: m.createdDateTime ?? new Date().toISOString(),
    lastModifiedAt: m.lastModifiedDateTime ?? null,
  };
}

function parseMeeting(m: GraphOnlineMeeting): MeetingSummary {
  const attendees = (m.participants?.attendees ?? [])
    .map((a) => (a.emailAddress?.address ?? a.upn ?? '').toLowerCase())
    .filter((e) => e.length > 0);
  return {
    id: m.id ?? '',
    subject: m.subject ?? '',
    joinWebUrl: m.joinWebUrl ?? null,
    startsAt: m.startDateTime ?? new Date().toISOString(),
    endsAt: m.endDateTime ?? new Date().toISOString(),
    organizerEmail: (m.participants?.organizer?.upn ?? '').toLowerCase() || null,
    attendeeEmails: attendees,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
