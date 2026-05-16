/**
 * lib/integrations/outlook-mcp/types.ts
 *
 * Phase B of the MCP-first integration architecture. Mirrors the Gmail
 * MCP server's shape (Phase A at `lib/integrations/gmail-mcp/types.ts`)
 * so the marketplace can register multiple email providers behind the
 * same interface family. Adding a 3rd email provider (e.g. Fastmail) =
 * another `lib/integrations/<provider>-mcp/` folder + the same tool
 * surface; no skill-side rewrites.
 *
 * Per `project_living_portable_architecture.md` + `feedback_runner_portability.md`:
 * the `OutlookMcpServer` interface is named FIRST. Two implementations
 * land alongside (`./server.ts` = prod Microsoft-Graph-backed,
 * `./test-server.ts` = deterministic fixture-backed). Skill code consumes
 * this surface only; direct `https://graph.microsoft.com/...` calls are
 * confined to `./server.ts`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: callers never see a Microsoft
 * Graph `Message` resource verbatim. Tool inputs + outputs are
 * provider-neutral shapes that mirror the Gmail MCP DTOs, so the email
 * skill chain can run against either provider without branching.
 *
 * Per `project_no_outbound_architecture.md`: the tool surface intentionally
 * has NO `send_message` / `send_draft` method. The `draft_message` tool
 * writes to the customer's Drafts folder (`POST /me/messages`) only.
 * `Mail.Send` is deliberately NOT in the requested OAuth scope set
 * (see `lib/integrations/marketplace.ts`) — `Mail.ReadWrite` alone is
 * sufficient for draft creation, so the consent never grants send rights
 * to agentplain in the first place.
 *
 * Outlook ↔ Gmail vocabulary mapping:
 *   - Gmail "thread"        → Outlook "conversation" (id field: `conversationId`)
 *   - Gmail "label"         → Outlook "category" (string array on Message)
 *   - Gmail "Message.id"    → Outlook "Message.id" (provider-specific opaque)
 *   - Gmail "drafts.create" → Outlook `POST /me/messages` (creates a draft)
 *   - Gmail "users.history" → Outlook `delta` query on /me/messages (Phase B+)
 *
 * The DTO field names use the Gmail-side wording (`threadId`, `labels`)
 * so a skill writing `msg.threadId` works against both providers. Adapter
 * code translates `conversationId` ↔ `threadId` at the Graph boundary.
 */

// ── Result shape — mirrors lib/integrations/types.ts.IntegrationResult ──

export type OutlookMcpErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'MALFORMED_RESPONSE'
  | 'INVALID_ARGUMENT'
  | 'UPSTREAM_ERROR'
  | 'TOKEN_EXPIRED'
  | 'GRANT_REVOKED'
  | 'CREDENTIAL_NOT_FOUND'
  | 'WORKSPACE_NOT_FOUND'
  | 'NOT_IMPLEMENTED';

export interface OutlookMcpError {
  code: OutlookMcpErrorCode;
  message: string;
  /** HTTP status from the upstream call when applicable. */
  status?: number;
  /** Vendor-specific reference id (Microsoft Graph `error.code`). */
  reference?: string;
}

export type OutlookMcpResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OutlookMcpError };

export function outlookOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function outlookError(
  code: OutlookMcpErrorCode,
  message: string,
  extra?: Omit<OutlookMcpError, 'code' | 'message'>,
): { ok: false; error: OutlookMcpError } {
  return { ok: false, error: { code, message, ...extra } };
}

// ── Tool input + output DTOs ────────────────────────────────────────────

export interface ListMessagesInput {
  /** Optional Microsoft Graph `$filter` / `$search` expression. When the
   *  expression starts with `$search=` or contains an operator (`eq`,
   *  `contains`, etc.) the prod server passes it through as `$filter`;
   *  bare strings route through `$search`. Defaults to inbox-only filter. */
  query?: string;
  /** Cap on results, 1..100. Defaults to 25. Microsoft Graph clamps at 1000
   *  but for parity with Gmail we cap at 100. */
  maxResults?: number;
  /** Optional opaque pagination token returned by a prior call. Maps to
   *  `$skiptoken` on Microsoft Graph. */
  pageToken?: string;
}

export interface ListMessagesOutput {
  messages: MessageSummary[];
  nextPageToken: string | null;
  /** Best-effort estimate from the provider. NULL if unknown. Microsoft
   *  Graph does not return a count without `$count=true`; the prod server
   *  passes that through when available. */
  resultSizeEstimate: number | null;
}

/** Just enough to render a Gmail-style list view; not the full body. */
export interface MessageSummary {
  id: string;
  /** Outlook `conversationId`. Field name is `threadId` for cross-provider
   *  uniformity with the Gmail MCP DTOs. */
  threadId: string;
  /** Provider-truncated snippet (~200 chars). Sourced from
   *  Microsoft Graph `Message.bodyPreview`. */
  snippet: string;
  /** Categories at fetch time. Provider-neutral name is `labels` for
   *  cross-provider uniformity with the Gmail MCP DTOs. */
  labels: string[];
}

export interface GetMessageInput {
  messageId: string;
}

export interface GetMessageOutput {
  message: FullMessage;
}

/**
 * Provider-neutral full message. Mirrors `lib/skills/types.ts.ParsedMessage`
 * one-for-one with `lib/integrations/gmail-mcp/types.ts.FullMessage` so a
 * skill written against one runs against the other unchanged.
 *
 * `receivedAt` is an ISO string (JSON-friendly across the JSON-RPC
 * boundary). Callers hydrate to Date if they need to.
 */
export interface FullMessage {
  id: string;
  threadId: string;
  /** RFC822 `Internet-Message-Id` from Microsoft Graph's
   *  `internetMessageId`. */
  rfcMessageId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  /** Plain-text body. Microsoft Graph returns HTML by default; the prod
   *  server strips to text when `body.contentType === 'html'`. */
  bodyText: string;
  snippet: string;
  references: string[];
  inReplyTo: string | null;
  attachments: MessageAttachment[];
  /** ISO 8601 UTC. Sourced from Microsoft Graph `receivedDateTime`. */
  receivedAt: string;
  /** Categories on the message (`Message.categories: string[]`). Field
   *  name is `labels` for cross-provider uniformity. */
  labels: string[];
}

export interface MessageAttachment {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Microsoft Graph attachment id from
   *  `/me/messages/{id}/attachments`. NULL when the attachment is
   *  inline-only and lacks an addressable id. */
  attachmentId: string | null;
}

export interface SearchThreadsInput {
  query: string;
  maxResults?: number;
  pageToken?: string;
}

export interface SearchThreadsOutput {
  threads: ThreadSummary[];
  nextPageToken: string | null;
}

export interface ThreadSummary {
  /** Outlook `conversationId` — field name `id` is uniform with Gmail. */
  id: string;
  snippet: string;
  /** Microsoft Graph does not surface a Gmail-style `historyId` at the
   *  conversation level. Set to NULL when unknown. */
  historyId: string | null;
  /** Number of messages in the thread when known. */
  messageCount: number | null;
}

export interface DraftMessageInput {
  /** RFC822 To. One or more addresses; Microsoft Graph expects an array
   *  of `Recipient` objects, which the server constructs. */
  to: string[];
  subject: string;
  body: string;
  /** Optional Outlook `conversationId` to graft the draft onto. When
   *  omitted, Microsoft Graph creates a standalone thread for the draft. */
  threadId?: string;
  /** Optional `internetMessageId` to set as `In-Reply-To` / `References`.
   *  Pulled through to RFC822 headers so the customer's reply threads. */
  inReplyToMessageId?: string;
}

export interface DraftMessageOutput {
  /** Microsoft Graph `Message.id` of the created draft. Microsoft does
   *  not separate "draft id" from "message id" the way Gmail does; both
   *  fields below return the same value, preserving the Gmail-side
   *  output shape for caller portability. */
  draftId: string;
  /** Provider message id of the drafted message. */
  messageId: string;
  threadId: string;
}

export interface LabelMessageInput {
  messageId: string;
  /** Categories to add. Microsoft Graph uses a single `categories: string[]`
   *  field on Message; this server merges adds + removes server-side. */
  addLabelIds?: string[];
  /** Categories to remove. */
  removeLabelIds?: string[];
}

export interface LabelMessageOutput {
  messageId: string;
  /** Final category set after add/remove merge. */
  labels: string[];
}

export interface ListLabelsOutput {
  labels: LabelDescriptor[];
}

export interface LabelDescriptor {
  /** Microsoft Graph `OutlookCategory.id`. */
  id: string;
  /** Display name (`OutlookCategory.displayName`). */
  name: string;
  /** Outlook does not distinguish system vs. user categories the way Gmail
   *  separates `LABEL_SYSTEM` from `LABEL_USER`. The `Inbox`, `Drafts`,
   *  `Sent Items`, etc. are folders, not categories. The prod server
   *  surfaces well-known folder names as `system` entries and tenant-
   *  defined categories as `user`. */
  type: 'system' | 'user';
  messagesTotal: number | null;
  messagesUnread: number | null;
}

// ── MCP resources ──────────────────────────────────────────────────────

export interface ResourceDescriptor {
  /** `outlook://workspace/{workspaceId}/...` URIs. Mirrors the Gmail
   *  Phase A `gmail://...` scheme; the path shape is identical so MCP
   *  clients can switch providers by swapping the URI scheme. */
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
  /** JSON-encoded body for `application/json` mime; UTF-8 text otherwise. */
  text: string;
}

// ── Tool name discriminant ─────────────────────────────────────────────

export const OUTLOOK_TOOL_NAMES = [
  'outlook.list_messages',
  'outlook.get_message',
  'outlook.search_threads',
  'outlook.draft_message',
  'outlook.label_message',
  'outlook.list_categories',
] as const;

export type OutlookToolName = (typeof OUTLOOK_TOOL_NAMES)[number];

// ── The interface every implementation honors ─────────────────────────

/**
 * The MCP server is the single seam through which fleet code touches a
 * customer's Outlook. Production wires `ProdOutlookMcpServer` (Microsoft
 * Graph backed); tests + CI wire `TestOutlookMcpServer` (fixture-backed).
 * Future Microsoft-Graph-adjacent providers (Exchange on-prem, Outlook
 * for Business with restricted scopes) land as peer implementations of
 * this same interface.
 *
 * Cold-start safety per `feedback_cold_start_safe_agents.md`: each
 * implementation re-reads its durable state (encrypted credentials) on
 * every method call. No instance memoizes a decrypted token across calls.
 */
export interface OutlookMcpServer {
  /** Implementation discriminator — `outlook-graph` / `outlook-test`. */
  readonly name: string;
  /** Workspace this server instance is scoped to. */
  readonly workspaceId: string;

  // ── Tools ────────────────────────────────────────────────────────────

  listMessages(input: ListMessagesInput): Promise<OutlookMcpResult<ListMessagesOutput>>;
  getMessage(input: GetMessageInput): Promise<OutlookMcpResult<GetMessageOutput>>;
  searchThreads(input: SearchThreadsInput): Promise<OutlookMcpResult<SearchThreadsOutput>>;
  draftMessage(input: DraftMessageInput): Promise<OutlookMcpResult<DraftMessageOutput>>;
  labelMessage(input: LabelMessageInput): Promise<OutlookMcpResult<LabelMessageOutput>>;
  /** Outlook's equivalent of Gmail labels. The tool name is
   *  `outlook.list_categories` on the wire; the method name keeps
   *  `listLabels` for cross-provider uniformity. */
  listLabels(): Promise<OutlookMcpResult<ListLabelsOutput>>;

  // ── Resources (MCP-protocol resource surface) ────────────────────────

  /** Enumerate the resources this server exposes. */
  listResources(): Promise<OutlookMcpResult<ResourceDescriptor[]>>;

  /** Fetch one resource by URI. Returns the body as JSON-or-text. */
  readResource(input: ReadResourceInput): Promise<OutlookMcpResult<ReadResourceOutput>>;
}

// ── JSON-RPC envelopes (MCP-style) ────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number | null;
}

export interface JsonRpcSuccess<T> {
  jsonrpc: '2.0';
  id: string | number | null;
  result: T;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcError;

/** JSON-RPC error codes — spec-standard plus Outlook-MCP-specific. The
 *  numeric codes match the Gmail MCP server's so cross-provider clients
 *  can share error-mapping logic. */
export const JSON_RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  /** Application-tier code: caller is not a member of the workspace. */
  WORKSPACE_FORBIDDEN: -32001,
  /** Application-tier code: the integration is not connected for this workspace. */
  CREDENTIAL_NOT_FOUND: -32002,
  /** Application-tier code: upstream Microsoft Graph returned an error after retries. */
  UPSTREAM_ERROR: -32003,
} as const;
