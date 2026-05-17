/**
 * lib/integrations/outlook-mcp/server.ts
 *
 * Production Outlook MCP server. Wraps the Microsoft Graph REST API
 * behind the `OutlookMcpServer` interface defined in `./types.ts`. One
 * instance is constructed per `{workspaceId}` on each incoming request —
 * never reused across workspaces — so the workspace boundary is
 * hard-coded at the server's identity, not enforced on every call.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is the SOLE seam in
 * the outlook-mcp folder that hits `https://graph.microsoft.com/`. Skill
 * code, route handlers, and cron functions speak the MCP interface only.
 * The OAuth refresh endpoint (`login.microsoftonline.com`) lives in
 * `./auth.ts` — different host, different concern.
 *
 * Per `feedback_runner_portability.md`: this server uses raw `fetch`
 * against the documented Microsoft Graph v1.0 endpoints rather than the
 * `@microsoft/microsoft-graph-client` SDK, both to avoid adding a new
 * runtime dependency in Phase B and to keep the vendor seam narrow (one
 * file, one transport). The SDK can be swapped in later behind this same
 * server class without touching any caller.
 *
 * Per `project_no_outbound_architecture.md`: this file exposes draft
 * creation only — `POST /me/messages` writes to the Drafts folder and
 * does NOT send. No code path here calls `/me/sendMail` or
 * `/me/messages/{id}/send`. Adding either fails the smoke test's
 * no-outbound check.
 *
 * Per `feedback_cold_start_safe_agents.md`: every public method
 * re-resolves the credential via `./auth.ts:resolveCredential`. No
 * decrypted credential lives on the instance.
 */

import { resolveCredential } from './auth';
import type { DecryptedCredential } from '@/lib/integrations/types';
import {
  type DraftMessageInput,
  type DraftMessageOutput,
  type FullMessage,
  type GetMessageInput,
  type GetMessageOutput,
  type LabelDescriptor,
  type LabelMessageInput,
  type LabelMessageOutput,
  type ListLabelsOutput,
  type ListMessagesInput,
  type ListMessagesOutput,
  type MessageAttachment,
  type MessageSummary,
  type OutlookMcpError,
  type OutlookMcpResult,
  type OutlookMcpServer,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SearchThreadsInput,
  type SearchThreadsOutput,
  outlookError,
  outlookOk,
} from './types';

const DEFAULT_MAX_RESULTS = 25;
const MAX_PAGE_SIZE = 100;
const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const RESOURCE_URI_INBOX_RE =
  /^outlook:\/\/workspace\/([0-9a-f-]+)\/inbox(?:\?pageToken=([^&]+))?$/i;
const RESOURCE_URI_THREAD_RE =
  /^outlook:\/\/workspace\/([0-9a-f-]+)\/threads\/(.+)$/i;

/**
 * Microsoft Graph `Message` resource shape — strictly the subset this
 * server reads. Full schema at
 * https://learn.microsoft.com/en-us/graph/api/resources/message (read
 * 2026-05-16). Field names use Graph's camelCase verbatim so the parser
 * below maps Graph → provider-neutral DTO in one place.
 */
interface GraphRecipient {
  emailAddress?: { name?: string; address?: string };
}

interface GraphAttachment {
  '@odata.type'?: string;
  id?: string;
  name?: string;
  contentType?: string;
  size?: number;
  isInline?: boolean;
}

interface GraphMessage {
  id?: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: GraphRecipient;
  sender?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  internetMessageHeaders?: Array<{ name?: string; value?: string }>;
  categories?: string[];
  hasAttachments?: boolean;
}

interface GraphListResponse<T> {
  value?: T[];
  '@odata.nextLink'?: string;
  '@odata.count'?: number;
}

interface GraphOutlookCategory {
  id?: string;
  displayName?: string;
  color?: string;
}

interface GraphMailFolder {
  id?: string;
  displayName?: string;
  totalItemCount?: number;
  unreadItemCount?: number;
}

interface GraphErrorBody {
  error?: {
    code?: string;
    message?: string;
    innerError?: { code?: string; message?: string; 'request-id'?: string };
  };
}

/**
 * Well-known Microsoft Outlook system folders. Surfaced through
 * `listLabels` alongside tenant-defined categories so the operator UI
 * sees a unified "labels" list across providers.
 */
const SYSTEM_FOLDER_NAMES = [
  'Inbox',
  'Drafts',
  'Sent Items',
  'Deleted Items',
  'Junk Email',
  'Archive',
  'Outbox',
] as const;

export class ProdOutlookMcpServer implements OutlookMcpServer {
  readonly name = 'outlook-graph' as const;
  readonly workspaceId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(args: { workspaceId: string; fetchImpl?: typeof fetch }) {
    if (!args.workspaceId) {
      throw new Error('ProdOutlookMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.fetchImpl = args.fetchImpl ?? fetch;
  }

  // ── Tools ────────────────────────────────────────────────────────────

  async listMessages(input: ListMessagesInput): Promise<OutlookMcpResult<ListMessagesOutput>> {
    const validation = validateMaxResults(input.maxResults);
    if (!validation.ok) return validation;
    const max = validation.value;

    return this.withCredential(async (cred) => {
      // Microsoft Graph: list messages in Inbox folder. `$select` keeps
      // the response small; `$top` paginates. `$filter` is preferred
      // over `$search` for predictable pagination — Graph disallows
      // ordering when $search is used.
      const params = new URLSearchParams({
        $top: String(max),
        $select: 'id,conversationId,subject,bodyPreview,categories,from,receivedDateTime,internetMessageId',
      });
      const trimmedQuery = input.query?.trim();
      if (trimmedQuery) {
        // Tolerate either a bare keyword string (route to $search) or a
        // full $filter expression (passed through verbatim).
        if (looksLikeODataFilter(trimmedQuery)) {
          params.set('$filter', trimmedQuery);
        } else {
          params.set('$search', `"${trimmedQuery.replace(/"/g, '\\"')}"`);
        }
      }
      if (input.pageToken) {
        params.set('$skiptoken', input.pageToken);
      }
      const url = `${GRAPH_BASE_URL}/me/mailFolders/Inbox/messages?${params.toString()}`;
      const res = await this.graphGet<GraphListResponse<GraphMessage>>(cred, url);
      if (!res.ok) return res;
      const messages: MessageSummary[] = (res.value.value ?? []).map((m) => ({
        id: m.id ?? '',
        threadId: m.conversationId ?? '',
        snippet: (m.bodyPreview ?? '').slice(0, 200),
        labels: m.categories ?? [],
      }));
      return outlookOk({
        messages,
        nextPageToken: extractSkipToken(res.value['@odata.nextLink'] ?? null),
        resultSizeEstimate:
          typeof res.value['@odata.count'] === 'number' ? res.value['@odata.count'] : null,
      });
    });
  }

  async getMessage(input: GetMessageInput): Promise<OutlookMcpResult<GetMessageOutput>> {
    if (!input.messageId) {
      return outlookError('INVALID_ARGUMENT', 'getMessage requires messageId');
    }
    return this.withCredential(async (cred) => {
      // `$expand=attachments` pulls attachment metadata in the same
      // round-trip. We deliberately ask for plain-text body via the
      // `Prefer: outlook.body-content-type="text"` header so we don't
      // have to strip HTML client-side.
      const url = `${GRAPH_BASE_URL}/me/messages/${encodeURIComponent(input.messageId)}?$expand=attachments($select=id,name,contentType,size,isInline)`;
      const res = await this.graphGet<GraphMessage & { attachments?: GraphAttachment[] }>(
        cred,
        url,
        { 'Prefer': 'outlook.body-content-type="text"' },
      );
      if (!res.ok) return res;
      return outlookOk({ message: parseGraphMessage(res.value) });
    });
  }

  async searchThreads(
    input: SearchThreadsInput,
  ): Promise<OutlookMcpResult<SearchThreadsOutput>> {
    if (!input.query || input.query.trim().length === 0) {
      return outlookError('INVALID_ARGUMENT', 'searchThreads requires query');
    }
    const validation = validateMaxResults(input.maxResults);
    if (!validation.ok) return validation;
    return this.withCredential(async (cred) => {
      // Microsoft Graph has no first-class "thread" endpoint. We
      // approximate by searching messages and bucketing them by
      // conversationId — the same UI Outlook builds locally.
      const params = new URLSearchParams({
        $top: String(validation.value * 5),
        $select: 'id,conversationId,subject,bodyPreview,receivedDateTime',
      });
      if (looksLikeODataFilter(input.query)) {
        params.set('$filter', input.query);
      } else {
        params.set('$search', `"${input.query.replace(/"/g, '\\"')}"`);
      }
      if (input.pageToken) {
        params.set('$skiptoken', input.pageToken);
      }
      const url = `${GRAPH_BASE_URL}/me/messages?${params.toString()}`;
      const res = await this.graphGet<GraphListResponse<GraphMessage>>(cred, url);
      if (!res.ok) return res;
      const byConv = new Map<string, GraphMessage[]>();
      for (const m of res.value.value ?? []) {
        const key = m.conversationId ?? m.id ?? '';
        if (!key) continue;
        const list = byConv.get(key) ?? [];
        list.push(m);
        byConv.set(key, list);
      }
      const threads = Array.from(byConv.entries()).slice(0, validation.value).map(
        ([id, msgs]) => ({
          id,
          snippet: (msgs[0]?.bodyPreview ?? '').slice(0, 200),
          historyId: null,
          messageCount: msgs.length,
        }),
      );
      return outlookOk({
        threads,
        nextPageToken: extractSkipToken(res.value['@odata.nextLink'] ?? null),
      });
    });
  }

  async draftMessage(
    input: DraftMessageInput,
  ): Promise<OutlookMcpResult<DraftMessageOutput>> {
    if (!input.to || input.to.length === 0) {
      return outlookError('INVALID_ARGUMENT', 'draftMessage requires at least one recipient');
    }
    if (!input.subject) {
      return outlookError('INVALID_ARGUMENT', 'draftMessage requires subject');
    }
    if (!input.body) {
      return outlookError('INVALID_ARGUMENT', 'draftMessage requires body');
    }
    return this.withCredential(async (cred) => {
      // `POST /me/messages` with a Message body creates a DRAFT saved
      // to the Drafts folder. Microsoft Graph does NOT send it — sending
      // requires a separate POST to /send. This server never makes that
      // call. Per https://learn.microsoft.com/en-us/graph/api/user-post-messages
      // (read 2026-05-16): "When you create a message using this API,
      // the message is saved in your Drafts folder."
      const requestBody: Record<string, unknown> = {
        subject: input.subject,
        body: {
          contentType: 'text',
          content: input.body,
        },
        toRecipients: input.to.map((addr) => ({
          emailAddress: { address: addr },
        })),
      };
      if (input.threadId) {
        // Setting `conversationId` grafts the draft onto an existing
        // thread so the customer's reply lands in the conversation.
        requestBody.conversationId = input.threadId;
      }
      if (input.inReplyToMessageId) {
        // Microsoft Graph exposes `internetMessageHeaders` as a
        // writable array on draft creation only. Adding `In-Reply-To`
        // and `References` here means the customer's reply, when
        // ultimately sent, threads correctly on the recipient's side.
        requestBody.internetMessageHeaders = [
          { name: 'In-Reply-To', value: input.inReplyToMessageId },
          { name: 'References', value: input.inReplyToMessageId },
        ];
      }
      const url = `${GRAPH_BASE_URL}/me/messages`;
      const res = await this.graphFetch<GraphMessage>(cred, url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) return res;
      const messageId = res.value.id;
      const threadId = res.value.conversationId ?? input.threadId ?? '';
      if (!messageId) {
        return outlookError('MALFORMED_RESPONSE', 'POST /me/messages returned no id');
      }
      return outlookOk({
        // Microsoft has no distinct "draft id"; the message id IS the
        // draft id until the message is sent. Mirror the Gmail surface
        // by returning the same value in both fields.
        draftId: messageId,
        messageId,
        threadId,
      });
    });
  }

  async labelMessage(
    input: LabelMessageInput,
  ): Promise<OutlookMcpResult<LabelMessageOutput>> {
    if (!input.messageId) {
      return outlookError('INVALID_ARGUMENT', 'labelMessage requires messageId');
    }
    if (
      (!input.addLabelIds || input.addLabelIds.length === 0) &&
      (!input.removeLabelIds || input.removeLabelIds.length === 0)
    ) {
      return outlookError(
        'INVALID_ARGUMENT',
        'labelMessage requires at least one of addLabelIds or removeLabelIds',
      );
    }
    return this.withCredential(async (cred) => {
      // Microsoft Graph categories live as `categories: string[]` on the
      // Message resource. There's no add/remove granular endpoint —
      // GET → merge → PATCH is the documented pattern.
      const getUrl = `${GRAPH_BASE_URL}/me/messages/${encodeURIComponent(input.messageId)}?$select=id,categories`;
      const current = await this.graphGet<GraphMessage>(cred, getUrl);
      if (!current.ok) return current;
      const next = new Set(current.value.categories ?? []);
      for (const id of input.addLabelIds ?? []) next.add(id);
      for (const id of input.removeLabelIds ?? []) next.delete(id);
      const patchUrl = `${GRAPH_BASE_URL}/me/messages/${encodeURIComponent(input.messageId)}`;
      const patched = await this.graphFetch<GraphMessage>(cred, patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: Array.from(next) }),
      });
      if (!patched.ok) return patched;
      return outlookOk({
        messageId: patched.value.id ?? input.messageId,
        labels: patched.value.categories ?? Array.from(next),
      });
    });
  }

  async listLabels(): Promise<OutlookMcpResult<ListLabelsOutput>> {
    return this.withCredential(async (cred) => {
      // Outlook surfaces two related concepts:
      //   * "Master categories" — the tenant-defined color/name palette
      //     at /me/outlook/masterCategories. These are Gmail's "user"
      //     labels.
      //   * Well-known folders (Inbox, Sent Items, etc.) — Gmail's
      //     "system" labels. We hit /me/mailFolders for these so the
      //     operator UI sees totals + unread counts.
      const [cats, folders] = await Promise.all([
        this.graphGet<GraphListResponse<GraphOutlookCategory>>(
          cred,
          `${GRAPH_BASE_URL}/me/outlook/masterCategories`,
        ),
        this.graphGet<GraphListResponse<GraphMailFolder>>(
          cred,
          `${GRAPH_BASE_URL}/me/mailFolders?$top=20&$select=id,displayName,totalItemCount,unreadItemCount`,
        ),
      ]);
      const labels: LabelDescriptor[] = [];
      if (folders.ok) {
        for (const f of folders.value.value ?? []) {
          const name = f.displayName ?? '';
          if (!name) continue;
          const isSystem = (SYSTEM_FOLDER_NAMES as readonly string[]).includes(name);
          labels.push({
            id: f.id ?? name,
            name,
            type: isSystem ? 'system' : 'user',
            messagesTotal:
              typeof f.totalItemCount === 'number' ? f.totalItemCount : null,
            messagesUnread:
              typeof f.unreadItemCount === 'number' ? f.unreadItemCount : null,
          });
        }
      }
      if (cats.ok) {
        for (const c of cats.value.value ?? []) {
          const name = c.displayName ?? '';
          if (!name) continue;
          labels.push({
            id: c.id ?? name,
            name,
            type: 'user',
            messagesTotal: null,
            messagesUnread: null,
          });
        }
      }
      if (!folders.ok && !cats.ok) {
        // Both upstream calls failed — surface the first error so the
        // caller has something actionable, rather than returning an
        // empty list that looks like a connected-but-empty mailbox.
        return folders;
      }
      return outlookOk({ labels });
    });
  }

  // ── Resources ────────────────────────────────────────────────────────

  async listResources(): Promise<OutlookMcpResult<ResourceDescriptor[]>> {
    return outlookOk([
      {
        uri: `outlook://workspace/${this.workspaceId}/inbox`,
        name: 'Inbox',
        description:
          "Paginated view of the workspace's connected Outlook inbox. Pass `?pageToken=…` to paginate.",
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<OutlookMcpResult<ReadResourceOutput>> {
    const inboxMatch = RESOURCE_URI_INBOX_RE.exec(input.uri);
    if (inboxMatch) {
      const workspaceId = inboxMatch[1];
      if (workspaceId !== this.workspaceId) {
        return outlookError(
          'FORBIDDEN',
          `Resource workspace ${workspaceId} does not match server workspace ${this.workspaceId}`,
        );
      }
      const pageToken = inboxMatch[2];
      const list = await this.listMessages({
        maxResults: DEFAULT_MAX_RESULTS,
        pageToken,
      });
      if (!list.ok) return list;
      return outlookOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    const threadMatch = RESOURCE_URI_THREAD_RE.exec(input.uri);
    if (threadMatch) {
      const workspaceId = threadMatch[1];
      const threadId = threadMatch[2];
      if (workspaceId !== this.workspaceId) {
        return outlookError(
          'FORBIDDEN',
          `Resource workspace ${workspaceId} does not match server workspace ${this.workspaceId}`,
        );
      }
      return this.withCredential(async (cred) => {
        // Filter messages by conversationId. Microsoft Graph does not
        // expose conversationId in $search, so we use $filter.
        const params = new URLSearchParams({
          $filter: `conversationId eq '${threadId.replace(/'/g, "''")}'`,
          $top: '50',
          $select: 'id,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,internetMessageId,categories',
        });
        const url = `${GRAPH_BASE_URL}/me/messages?${params.toString()}`;
        const res = await this.graphGet<GraphListResponse<GraphMessage>>(cred, url, {
          'Prefer': 'outlook.body-content-type="text"',
        });
        if (!res.ok) return res;
        const messages = (res.value.value ?? []).map(parseGraphMessage);
        if (messages.length === 0) {
          return outlookError('NOT_FOUND', `No messages found for thread ${threadId}`);
        }
        return outlookOk({
          uri: input.uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            id: threadId,
            historyId: null,
            messages,
          }),
        });
      });
    }
    return outlookError(
      'INVALID_ARGUMENT',
      `Unknown resource URI: ${input.uri}. Expected outlook://workspace/{workspaceId}/inbox or .../threads/{threadId}.`,
    );
  }

  // ── internals ────────────────────────────────────────────────────────

  /**
   * Re-resolves the credential on every call. We deliberately do NOT
   * cache the access token on the instance — caching plaintext tokens
   * across calls breaks `feedback_cold_start_safe_agents.md`.
   */
  private async withCredential<T>(
    fn: (credential: DecryptedCredential) => Promise<OutlookMcpResult<T>>,
  ): Promise<OutlookMcpResult<T>> {
    const resolved = await resolveCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    return fn(resolved.value);
  }

  private async graphGet<T>(
    cred: DecryptedCredential,
    url: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<OutlookMcpResult<T>> {
    return this.graphFetch<T>(cred, url, { method: 'GET', headers: extraHeaders });
  }

  private async graphFetch<T>(
    cred: DecryptedCredential,
    url: string,
    init: RequestInit,
  ): Promise<OutlookMcpResult<T>> {
    const headers = new Headers(init.headers ?? {});
    headers.set('Authorization', `Bearer ${cred.accessToken}`);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    // ConsistencyLevel: eventual is required by Graph when $search is
    // present in the URL. Adding it unconditionally is documented as
    // safe for non-$search endpoints. See
    // https://learn.microsoft.com/en-us/graph/aad-advanced-queries
    if (!headers.has('ConsistencyLevel')) {
      headers.set('ConsistencyLevel', 'eventual');
    }
    let res: Response;
    try {
      res = await this.fetchImpl(url, { ...init, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return outlookError('NETWORK', `Microsoft Graph network error: ${message}`);
    }
    if (res.status === 204) {
      return outlookOk(undefined as T);
    }
    let parsed: unknown = null;
    const text = await res.text();
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    if (!res.ok) {
      return mapGraphError(res.status, parsed);
    }
    return outlookOk(parsed as T);
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

function validateMaxResults(value: number | undefined): OutlookMcpResult<number> {
  if (value === undefined) return outlookOk(DEFAULT_MAX_RESULTS);
  if (!Number.isInteger(value) || value <= 0) {
    return outlookError('INVALID_ARGUMENT', `maxResults must be a positive integer, got ${value}`);
  }
  if (value > MAX_PAGE_SIZE) {
    return outlookError(
      'INVALID_ARGUMENT',
      `maxResults must be <= ${MAX_PAGE_SIZE}, got ${value}`,
    );
  }
  return outlookOk(value);
}

function mapGraphError(
  status: number,
  body: unknown,
): { ok: false; error: OutlookMcpError } {
  const errBody = (body as GraphErrorBody | null)?.error;
  const reference = errBody?.code ?? `http_${status}`;
  const message = errBody?.message ?? `Microsoft Graph returned HTTP ${status}`;
  if (status === 401) return outlookError('TOKEN_EXPIRED', message, { status, reference });
  if (status === 403) return outlookError('FORBIDDEN', message, { status, reference });
  if (status === 404) return outlookError('NOT_FOUND', message, { status, reference });
  if (status === 429) return outlookError('RATE_LIMITED', message, { status, reference });
  if (status >= 500) return outlookError('UPSTREAM_ERROR', message, { status, reference });
  if (status === 400) return outlookError('INVALID_ARGUMENT', message, { status, reference });
  return outlookError('UPSTREAM_ERROR', message, { status, reference });
}

function looksLikeODataFilter(s: string): boolean {
  // Heuristic: an OData $filter expression contains a known operator
  // token (`eq`, `ne`, `contains`, `startswith`, `lt`, `gt`, etc.) with
  // word boundaries around it. Bare keyword searches don't, so we route
  // those through $search instead.
  return /\b(eq|ne|contains|startswith|endswith|lt|gt|le|ge|and|or)\b/i.test(s);
}

function extractSkipToken(nextLink: string | null): string | null {
  if (!nextLink) return null;
  try {
    const url = new URL(nextLink);
    return url.searchParams.get('$skiptoken');
  } catch {
    return null;
  }
}

// ── Message parser — Graph → provider-neutral FullMessage ──────────────

export function parseGraphMessage(msg: GraphMessage & { attachments?: GraphAttachment[] }): FullMessage {
  const from = msg.from?.emailAddress ?? msg.sender?.emailAddress ?? {};
  const fromEmail = (from.address ?? '').toLowerCase();
  const fromName = from.name?.trim() || null;
  const toEmails = (msg.toRecipients ?? [])
    .map((r) => (r.emailAddress?.address ?? '').toLowerCase())
    .filter((e) => e.length > 0);
  const ccEmails = (msg.ccRecipients ?? [])
    .map((r) => (r.emailAddress?.address ?? '').toLowerCase())
    .filter((e) => e.length > 0);
  const subject = msg.subject ?? '';
  const bodyText = extractBodyText(msg.body);
  const snippet = (msg.bodyPreview ?? bodyText).slice(0, 200);
  const headerLookup = (name: string): string | null => {
    const h = (msg.internetMessageHeaders ?? []).find(
      (x) => (x.name ?? '').toLowerCase() === name.toLowerCase(),
    );
    return h?.value ?? null;
  };
  const inReplyTo = headerLookup('In-Reply-To');
  const referencesHeader = headerLookup('References') ?? '';
  const references = referencesHeader
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const attachments: MessageAttachment[] = (msg.attachments ?? [])
    .filter((a) => !a.isInline && (a.name?.length ?? 0) > 0)
    .map((a) => ({
      filename: a.name ?? '',
      mimeType: a.contentType ?? 'application/octet-stream',
      sizeBytes: typeof a.size === 'number' ? a.size : 0,
      attachmentId: a.id ?? null,
    }));
  return {
    id: msg.id ?? '',
    threadId: msg.conversationId ?? '',
    rfcMessageId: msg.internetMessageId ?? null,
    fromEmail,
    fromName,
    toEmails,
    ccEmails,
    subject,
    bodyText,
    snippet,
    references,
    inReplyTo,
    attachments,
    receivedAt: msg.receivedDateTime ?? new Date().toISOString(),
    labels: msg.categories ?? [],
  };
}

function extractBodyText(
  body: { contentType?: string; content?: string } | undefined,
): string {
  if (!body || !body.content) return '';
  if ((body.contentType ?? '').toLowerCase() === 'text') {
    return body.content;
  }
  // Body came back as HTML despite the Prefer header; strip tags.
  return stripHtml(body.content);
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
