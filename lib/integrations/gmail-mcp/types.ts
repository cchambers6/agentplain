/**
 * lib/integrations/gmail-mcp/types.ts
 *
 * Phase A of the MCP-first integration architecture. Every customer-facing
 * external system reaches the fleet through an MCP server scoped to a single
 * workspace. This file defines the Gmail server's tool surface, the
 * `GmailMcpServer` interface that every implementation honors, and the
 * JSON-RPC envelope types the HTTP route + smoke test share.
 *
 * Per `project_living_portable_architecture.md` + `feedback_runner_portability.md`:
 * the interface is named FIRST, two implementations land alongside
 * (`./server.ts` = prod Gmail-backed, `./test-server.ts` = deterministic
 * fixture-backed). Skill code (`lib/skills/`) consumes this surface only;
 * direct `googleapis` calls are confined to `lib/integrations/google/`.
 *
 * Per `feedback_no_silent_vendor_lock.md`: callers never see a
 * `gmail_v1.Schema$Message`. Tool inputs + outputs are provider-neutral
 * shapes that translate to the existing `ParsedMessage` / `Categorization`
 * shapes from `lib/skills/types.ts` at the migration seam.
 *
 * Per `project_no_outbound_architecture.md`: the tool surface intentionally
 * has NO `send_message` / `send_draft` method. The `draft_message` tool
 * writes to the customer's Gmail Drafts folder (`users.drafts.create`) only.
 *
 * Per `feedback_integration_acceptance_is_functional.md`: this surface is
 * the seam through which read → categorize → coordinate → schedule → draft
 * runs against Conner's real inbox in PR-C's acceptance test.
 */

// ── Result shape — mirrors lib/integrations/types.ts.IntegrationResult ──

export type GmailMcpErrorCode =
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

export interface GmailMcpError {
  code: GmailMcpErrorCode;
  message: string;
  /** HTTP status from the upstream call when applicable. */
  status?: number;
  /** Vendor-specific reference id (Google error.code). */
  reference?: string;
}

export type GmailMcpResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GmailMcpError };

export function gmailOk<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function gmailError(
  code: GmailMcpErrorCode,
  message: string,
  extra?: Omit<GmailMcpError, 'code' | 'message'>,
): { ok: false; error: GmailMcpError } {
  return { ok: false, error: { code, message, ...extra } };
}

// ── Tool input + output DTOs ────────────────────────────────────────────

export interface ListMessagesInput {
  /** Optional Gmail search query — same syntax as the Gmail UI search bar
   *  (e.g. `is:unread`, `from:foo@bar.com`, `newer_than:7d`). Defaults to
   *  `in:inbox` so the inbox view stays the default surface. */
  query?: string;
  /** Cap on results, 1..100. Defaults to 25. */
  maxResults?: number;
  /** Optional opaque pagination token returned by a prior call. */
  pageToken?: string;
}

export interface ListMessagesOutput {
  messages: MessageSummary[];
  nextPageToken: string | null;
  /** Best-effort estimate from the provider. NULL if unknown. */
  resultSizeEstimate: number | null;
}

/** Just enough to render a Gmail-style list view; not the full body. */
export interface MessageSummary {
  id: string;
  threadId: string;
  /** Provider-truncated snippet (~200 chars). */
  snippet: string;
  /** Labels at fetch time. */
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
 * with one difference: `receivedAt` is an ISO string (JSON-friendly across
 * the JSON-RPC boundary). Callers hydrate to Date if they need to.
 */
export interface FullMessage {
  id: string;
  threadId: string;
  rfcMessageId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  bodyText: string;
  snippet: string;
  references: string[];
  inReplyTo: string | null;
  attachments: MessageAttachment[];
  /** ISO 8601 UTC. */
  receivedAt: string;
  labels: string[];
}

export interface MessageAttachment {
  filename: string;
  mimeType: string;
  sizeBytes: number;
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
  id: string;
  snippet: string;
  historyId: string | null;
  /** Number of messages in the thread when known. */
  messageCount: number | null;
}

export interface DraftMessageInput {
  /** RFC822 To. One or more addresses; will be joined with `,`. */
  to: string[];
  subject: string;
  body: string;
  /** Optional thread to graft the draft onto. When omitted, Gmail creates
   *  a standalone thread for the draft. */
  threadId?: string;
  /** Optional Message-ID to set as In-Reply-To / References. Pulled
   *  through to RFC822 headers so the customer's reply threads. */
  inReplyToMessageId?: string;
}

export interface DraftMessageOutput {
  /** Provider draft id from `users.drafts.create`. */
  draftId: string;
  /** Provider message id of the drafted message. */
  messageId: string;
  threadId: string;
}

export interface LabelMessageInput {
  messageId: string;
  /** Label ids to add (e.g. STARRED, IMPORTANT, custom Label_123). */
  addLabelIds?: string[];
  /** Label ids to remove. */
  removeLabelIds?: string[];
}

export interface LabelMessageOutput {
  messageId: string;
  labels: string[];
}

export interface ListLabelsOutput {
  labels: LabelDescriptor[];
}

export interface LabelDescriptor {
  id: string;
  name: string;
  /** `system` (Gmail built-ins) or `user` (customer-created). */
  type: 'system' | 'user';
  messagesTotal: number | null;
  messagesUnread: number | null;
}

// ── MCP resources ──────────────────────────────────────────────────────

export interface ResourceDescriptor {
  /** `gmail://workspace/{workspaceId}/...` URIs per the Phase A spec. */
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

export const GMAIL_TOOL_NAMES = [
  'gmail.list_messages',
  'gmail.get_message',
  'gmail.search_threads',
  'gmail.draft_message',
  'gmail.label_message',
  'gmail.list_labels',
] as const;

export type GmailToolName = (typeof GMAIL_TOOL_NAMES)[number];

// ── The interface every implementation honors ─────────────────────────

/**
 * The MCP server is the single seam through which fleet code touches a
 * customer's Gmail. Production wires `GmailMcpServer` (Gmail-backed); tests
 * + CI wire `TestGmailMcpServer` (fixture-backed). New providers (M365 next)
 * land as a peer `M365McpServer` implementing the same interface, swappable
 * at the marketplace layer.
 *
 * Cold-start safety per `feedback_cold_start_safe_agents.md`: each
 * implementation re-reads its durable state (encrypted credentials) on
 * every method call. No instance memoizes a decrypted token across calls.
 */
export interface GmailMcpServer {
  /** Implementation discriminator — `gmail-google` / `gmail-test`. */
  readonly name: string;
  /** Workspace this server instance is scoped to. */
  readonly workspaceId: string;

  // ── Tools ────────────────────────────────────────────────────────────

  listMessages(input: ListMessagesInput): Promise<GmailMcpResult<ListMessagesOutput>>;
  getMessage(input: GetMessageInput): Promise<GmailMcpResult<GetMessageOutput>>;
  searchThreads(input: SearchThreadsInput): Promise<GmailMcpResult<SearchThreadsOutput>>;
  draftMessage(input: DraftMessageInput): Promise<GmailMcpResult<DraftMessageOutput>>;
  labelMessage(input: LabelMessageInput): Promise<GmailMcpResult<LabelMessageOutput>>;
  listLabels(): Promise<GmailMcpResult<ListLabelsOutput>>;

  // ── Resources (MCP-protocol resource surface) ────────────────────────

  /** Enumerate the resources this server exposes. */
  listResources(): Promise<GmailMcpResult<ResourceDescriptor[]>>;

  /** Fetch one resource by URI. Returns the body as JSON-or-text. */
  readResource(input: ReadResourceInput): Promise<GmailMcpResult<ReadResourceOutput>>;
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

/** JSON-RPC error codes — spec-standard plus Gmail-MCP-specific. */
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
  /** Application-tier code: upstream Gmail returned an error after retries. */
  UPSTREAM_ERROR: -32003,
} as const;
