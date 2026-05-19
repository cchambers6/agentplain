/**
 * lib/integrations/teams-mcp/types.ts
 *
 * Provider-neutral tool surface for Microsoft Teams. Mirrors the layout
 * of `lib/integrations/outlook-mcp/types.ts` — the result-discriminated
 * union, JSON-RPC envelopes, and error codes live in
 * `lib/integrations/microsoft/mcp-common.ts` and are re-exported from
 * `./index.ts`; this file holds the Teams-only DTOs.
 *
 * Two-implementation rule per `feedback_runner_portability.md`:
 *   * `./server.ts`        — production, Microsoft Graph backed
 *   * `./test-server.ts`   — deterministic fixture impl
 * Both honour the `TeamsMcpServer` interface declared at the bottom of
 * this file.
 *
 * Per `feedback_no_silent_vendor_lock.md`: skill code that consumes a
 * Teams chat never sees a Microsoft Graph `chatMessage` resource verbatim.
 * Tool inputs + outputs are the provider-neutral shapes below; the
 * Graph → DTO mapping lives in `./server.ts`.
 *
 * Per `project_no_outbound_architecture.md`: this file DOES surface a
 * `send_chat_message` and `post_to_channel` tool. That's a deliberate
 * exception specific to Teams — Teams chats are not "outbound" in the
 * sense the no-outbound rule guards against (cold-prospect outreach via
 * SendGrid / Twilio / dialers from agentplain's surface). They are
 * internal customer-system messages between people who already work
 * together; the customer's Teams client is the system of record and we
 * are writing into a channel/chat the customer themselves participate in.
 * The same exception holds for SOLO drafts in Outlook (we use the Drafts
 * folder, which is internal to the customer's mailbox). For acquisition
 * outreach, the customer's own system sends — agentplain does not.
 */

import type { McpResult } from '@/lib/integrations/microsoft/mcp-common';

// ── Chats ──────────────────────────────────────────────────────────────

export interface ListChatsInput {
  /** Page size, 1..50. Defaults to 25. Microsoft Graph caps at 50. */
  maxResults?: number;
  /** Opaque `$skiptoken` from a previous call. */
  pageToken?: string;
}

export interface ListChatsOutput {
  chats: ChatSummary[];
  nextPageToken: string | null;
}

export interface ChatSummary {
  id: string;
  /** `oneOnOne` | `group` | `meeting`. Pass through from Graph. */
  chatType: string;
  /** `topic` field — group chats only; null for 1:1. */
  topic: string | null;
  /** ISO 8601 last activity timestamp from Graph. */
  lastUpdatedAt: string | null;
  /** Members' display names (Microsoft Graph populates 8 most-recent). */
  memberNames: string[];
}

export interface GetChatMessagesInput {
  chatId: string;
  /** Page size, 1..50. */
  maxResults?: number;
  pageToken?: string;
}

export interface GetChatMessagesOutput {
  messages: ChatMessage[];
  nextPageToken: string | null;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  /** `message` | `system` | `chatEvent`. */
  messageType: string;
  /** Provider-truncated plain-text body. HTML is stripped server-side. */
  bodyText: string;
  /** Original content type (`text` | `html`). */
  bodyContentType: 'text' | 'html';
  /** Sender display name. `null` when the message is a system event. */
  fromName: string | null;
  /** Sender email when known. `null` for system events. */
  fromEmail: string | null;
  createdAt: string;
  /** ISO 8601 — `null` when the message hasn't been edited. */
  lastModifiedAt: string | null;
}

export interface SendChatMessageInput {
  chatId: string;
  /** Plain-text body. Server wraps to Microsoft Graph `body.contentType=text`. */
  body: string;
}

export interface SendChatMessageOutput {
  messageId: string;
  chatId: string;
  createdAt: string;
}

// ── Channels ───────────────────────────────────────────────────────────

export interface ListChannelsInput {
  /** Microsoft Graph team id. Required — Teams Graph has no `me/joinedTeams`-
   *  scoped channel list aggregator; we need a team to scope to. Callers
   *  enumerate teams via the operator UI's team picker. */
  teamId: string;
}

export interface ListChannelsOutput {
  channels: ChannelSummary[];
}

export interface ChannelSummary {
  id: string;
  teamId: string;
  displayName: string;
  description: string | null;
  /** `standard` | `private` | `shared`. */
  membershipType: string;
  webUrl: string | null;
}

export interface PostToChannelInput {
  teamId: string;
  channelId: string;
  /** Plain-text body. */
  body: string;
  /** Optional subject — Graph requires it on the FIRST message of a
   *  thread (channel root); replies set `replyToMessageId` instead. */
  subject?: string;
}

export interface PostToChannelOutput {
  messageId: string;
  teamId: string;
  channelId: string;
  createdAt: string;
  webUrl: string | null;
}

// ── Meetings ───────────────────────────────────────────────────────────

export interface ListMeetingsInput {
  /** ISO 8601 UTC. Optional — defaults to "starting in the last 7 days". */
  startFromIso?: string;
  /** ISO 8601 UTC. Optional — defaults to "ending in the next 7 days". */
  endByIso?: string;
  maxResults?: number;
}

export interface ListMeetingsOutput {
  meetings: MeetingSummary[];
}

export interface MeetingSummary {
  id: string;
  subject: string;
  /** Microsoft Graph `joinWebUrl` — the customer's Teams link. */
  joinWebUrl: string | null;
  /** ISO 8601 UTC. */
  startsAt: string;
  endsAt: string;
  /** Organizer email when present. */
  organizerEmail: string | null;
  /** Attendee emails the meeting was sent to. */
  attendeeEmails: string[];
}

export interface GetMeetingRecordingTranscriptInput {
  meetingId: string;
}

export interface GetMeetingRecordingTranscriptOutput {
  /** Microsoft Graph transcript metadata — array because a single meeting
   *  can have multiple transcript artifacts (e.g. one per recording slice). */
  transcripts: MeetingTranscript[];
}

export interface MeetingTranscript {
  id: string;
  meetingId: string;
  /** ISO 8601 UTC. */
  createdAt: string;
  /** Plain-text WebVTT body. Empty string when the transcript content was
   *  not granted by tenant policy (Graph returns 403 in that case). */
  contentVtt: string;
  contentUrl: string | null;
}

// ── MCP resources ──────────────────────────────────────────────────────

export interface ResourceDescriptor {
  /** `teams://workspace/{workspaceId}/...` URIs. */
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ReadResourceInput {
  uri: string;
}

export interface ReadResourceOutput {
  uri: string;
  mimeType: string;
  text: string;
}

// ── Tool name discriminant ─────────────────────────────────────────────

export const TEAMS_TOOL_NAMES = [
  'teams.list_chats',
  'teams.get_chat_messages',
  'teams.send_chat_message',
  'teams.list_channels',
  'teams.post_to_channel',
  'teams.list_meetings',
  'teams.get_meeting_recording_transcript',
] as const;

export type TeamsToolName = (typeof TEAMS_TOOL_NAMES)[number];

// ── The interface every implementation honors ──────────────────────────

export interface TeamsMcpServer {
  readonly name: string;
  readonly workspaceId: string;

  listChats(input: ListChatsInput): Promise<McpResult<ListChatsOutput>>;
  getChatMessages(
    input: GetChatMessagesInput,
  ): Promise<McpResult<GetChatMessagesOutput>>;
  sendChatMessage(
    input: SendChatMessageInput,
  ): Promise<McpResult<SendChatMessageOutput>>;
  listChannels(
    input: ListChannelsInput,
  ): Promise<McpResult<ListChannelsOutput>>;
  postToChannel(
    input: PostToChannelInput,
  ): Promise<McpResult<PostToChannelOutput>>;
  listMeetings(
    input: ListMeetingsInput,
  ): Promise<McpResult<ListMeetingsOutput>>;
  getMeetingRecordingTranscript(
    input: GetMeetingRecordingTranscriptInput,
  ): Promise<McpResult<GetMeetingRecordingTranscriptOutput>>;

  listResources(): Promise<McpResult<ResourceDescriptor[]>>;
  readResource(input: ReadResourceInput): Promise<McpResult<ReadResourceOutput>>;
}
