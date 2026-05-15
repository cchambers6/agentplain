/**
 * lib/integrations/gmail-mcp/server.ts
 *
 * Production Gmail MCP server. Wraps the Gmail REST API behind the
 * `GmailMcpServer` interface defined in `./types.ts`. One instance is
 * constructed per `{workspaceId}` on each incoming request — never reused
 * across workspaces — so the workspace boundary is hard-coded at the
 * server's identity, not enforced on every call.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file is one of three
 * locations allowed to import `googleapis` (alongside the existing
 * `lib/integrations/google/gmail-provider.ts` and `lib/skills/gmail-fetcher.ts`).
 * Skill code, route handlers, and cron functions speak the MCP interface
 * only, not the Gmail SDK.
 *
 * Per `project_no_outbound_architecture.md`: this file exposes
 * `users.drafts.create` (the customer's system later sends from Drafts)
 * but never `users.messages.send` or `users.drafts.send`. Code that
 * deviates fails contract tests.
 *
 * Per `feedback_cold_start_safe_agents.md`: every public method
 * re-resolves the credential via `./auth.ts:resolveCredential`. No
 * decrypted credential lives on the instance.
 */

import { google, type gmail_v1 } from 'googleapis';
import { resolveCredential } from './auth';
import type { DecryptedCredential } from '@/lib/integrations/types';
import {
  type DraftMessageInput,
  type DraftMessageOutput,
  type FullMessage,
  type GetMessageInput,
  type GetMessageOutput,
  type GmailMcpResult,
  type GmailMcpServer,
  type LabelDescriptor,
  type LabelMessageInput,
  type LabelMessageOutput,
  type ListLabelsOutput,
  type ListMessagesInput,
  type ListMessagesOutput,
  type MessageAttachment,
  type MessageSummary,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SearchThreadsInput,
  type SearchThreadsOutput,
  gmailError,
  gmailOk,
} from './types';

const DEFAULT_MAX_RESULTS = 25;
const MAX_PAGE_SIZE = 100;
const RESOURCE_URI_INBOX_RE =
  /^gmail:\/\/workspace\/([0-9a-f-]+)\/inbox(?:\?pageToken=([^&]+))?$/i;
const RESOURCE_URI_THREAD_RE =
  /^gmail:\/\/workspace\/([0-9a-f-]+)\/threads\/(.+)$/i;

export class ProdGmailMcpServer implements GmailMcpServer {
  readonly name = 'gmail-google' as const;
  readonly workspaceId: string;

  constructor(args: { workspaceId: string }) {
    if (!args.workspaceId) {
      throw new Error('ProdGmailMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
  }

  // ── Tools ────────────────────────────────────────────────────────────

  async listMessages(input: ListMessagesInput): Promise<GmailMcpResult<ListMessagesOutput>> {
    const validation = validateMaxResults(input.maxResults);
    if (!validation.ok) return validation;
    const max = validation.value;
    const query = input.query?.trim() || 'in:inbox';

    return this.withClient(async (client) => {
      try {
        const res = await client.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: max,
          pageToken: input.pageToken,
        });
        const ids = (res.data.messages ?? []).map((m) => ({
          id: m.id ?? '',
          threadId: m.threadId ?? '',
        }));
        // Hydrate snippet + labels for each id via batch metadata fetches.
        // Gmail's list endpoint returns id+threadId only.
        const summaries: MessageSummary[] = [];
        for (const ref of ids) {
          if (!ref.id) continue;
          try {
            const got = await client.users.messages.get({
              userId: 'me',
              id: ref.id,
              format: 'metadata',
              metadataHeaders: [],
            });
            summaries.push({
              id: ref.id,
              threadId: ref.threadId,
              snippet: (got.data.snippet ?? '').slice(0, 200),
              labels: got.data.labelIds ?? [],
            });
          } catch (err) {
            // One bad message id should not bring down the whole list.
            // Surface a synthetic summary so the operator sees the gap.
            summaries.push({
              id: ref.id,
              threadId: ref.threadId,
              snippet: `[unavailable: ${errMessage(err)}]`,
              labels: [],
            });
          }
        }
        return gmailOk({
          messages: summaries,
          nextPageToken: res.data.nextPageToken ?? null,
          resultSizeEstimate:
            typeof res.data.resultSizeEstimate === 'number'
              ? res.data.resultSizeEstimate
              : null,
        });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async getMessage(input: GetMessageInput): Promise<GmailMcpResult<GetMessageOutput>> {
    if (!input.messageId) {
      return gmailError('INVALID_ARGUMENT', 'getMessage requires messageId');
    }
    return this.withClient(async (client) => {
      try {
        const got = await client.users.messages.get({
          userId: 'me',
          id: input.messageId,
          format: 'full',
        });
        return gmailOk({ message: parseGmailMessage(got.data) });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async searchThreads(
    input: SearchThreadsInput,
  ): Promise<GmailMcpResult<SearchThreadsOutput>> {
    if (!input.query || input.query.trim().length === 0) {
      return gmailError('INVALID_ARGUMENT', 'searchThreads requires query');
    }
    const validation = validateMaxResults(input.maxResults);
    if (!validation.ok) return validation;
    return this.withClient(async (client) => {
      try {
        const res = await client.users.threads.list({
          userId: 'me',
          q: input.query,
          maxResults: validation.value,
          pageToken: input.pageToken,
        });
        const threads = (res.data.threads ?? []).map((t) => ({
          id: t.id ?? '',
          snippet: (t.snippet ?? '').slice(0, 200),
          historyId: t.historyId ?? null,
          messageCount: null,
        }));
        return gmailOk({
          threads,
          nextPageToken: res.data.nextPageToken ?? null,
        });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async draftMessage(
    input: DraftMessageInput,
  ): Promise<GmailMcpResult<DraftMessageOutput>> {
    if (!input.to || input.to.length === 0) {
      return gmailError('INVALID_ARGUMENT', 'draftMessage requires at least one recipient');
    }
    if (!input.subject) {
      return gmailError('INVALID_ARGUMENT', 'draftMessage requires subject');
    }
    if (!input.body) {
      return gmailError('INVALID_ARGUMENT', 'draftMessage requires body');
    }
    return this.withClient(async (client) => {
      const headers: string[] = [
        `To: ${input.to.join(', ')}`,
        `Subject: ${input.subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'MIME-Version: 1.0',
      ];
      if (input.inReplyToMessageId) {
        headers.push(`In-Reply-To: ${input.inReplyToMessageId}`);
        headers.push(`References: ${input.inReplyToMessageId}`);
      }
      const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + input.body, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      try {
        const res = await client.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: input.threadId
              ? { threadId: input.threadId, raw }
              : { raw },
          },
        });
        const draftId = res.data.id;
        const messageId = res.data.message?.id;
        const threadId = res.data.message?.threadId ?? input.threadId ?? '';
        if (!draftId || !messageId) {
          return gmailError('MALFORMED_RESPONSE', 'drafts.create returned no id');
        }
        return gmailOk({ draftId, messageId, threadId });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async labelMessage(
    input: LabelMessageInput,
  ): Promise<GmailMcpResult<LabelMessageOutput>> {
    if (!input.messageId) {
      return gmailError('INVALID_ARGUMENT', 'labelMessage requires messageId');
    }
    if (
      (!input.addLabelIds || input.addLabelIds.length === 0) &&
      (!input.removeLabelIds || input.removeLabelIds.length === 0)
    ) {
      return gmailError(
        'INVALID_ARGUMENT',
        'labelMessage requires at least one of addLabelIds or removeLabelIds',
      );
    }
    return this.withClient(async (client) => {
      try {
        const res = await client.users.messages.modify({
          userId: 'me',
          id: input.messageId,
          requestBody: {
            addLabelIds: input.addLabelIds,
            removeLabelIds: input.removeLabelIds,
          },
        });
        return gmailOk({
          messageId: res.data.id ?? input.messageId,
          labels: res.data.labelIds ?? [],
        });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  async listLabels(): Promise<GmailMcpResult<ListLabelsOutput>> {
    return this.withClient(async (client) => {
      try {
        const res = await client.users.labels.list({ userId: 'me' });
        const labels: LabelDescriptor[] = (res.data.labels ?? []).map((l) => ({
          id: l.id ?? '',
          name: l.name ?? '',
          type: l.type === 'system' ? 'system' : 'user',
          messagesTotal:
            typeof l.messagesTotal === 'number' ? l.messagesTotal : null,
          messagesUnread:
            typeof l.messagesUnread === 'number' ? l.messagesUnread : null,
        }));
        return gmailOk({ labels });
      } catch (err) {
        return mapGoogleApiError(err);
      }
    });
  }

  // ── Resources ────────────────────────────────────────────────────────

  async listResources(): Promise<GmailMcpResult<ResourceDescriptor[]>> {
    return gmailOk([
      {
        uri: `gmail://workspace/${this.workspaceId}/inbox`,
        name: 'Inbox',
        description:
          "Paginated view of the workspace's connected Gmail inbox. Pass `?pageToken=…` to paginate.",
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<GmailMcpResult<ReadResourceOutput>> {
    const inboxMatch = RESOURCE_URI_INBOX_RE.exec(input.uri);
    if (inboxMatch) {
      const workspaceId = inboxMatch[1];
      if (workspaceId !== this.workspaceId) {
        return gmailError(
          'FORBIDDEN',
          `Resource workspace ${workspaceId} does not match server workspace ${this.workspaceId}`,
        );
      }
      const pageToken = inboxMatch[2];
      const list = await this.listMessages({
        query: 'in:inbox',
        maxResults: DEFAULT_MAX_RESULTS,
        pageToken,
      });
      if (!list.ok) return list;
      return gmailOk({
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
        return gmailError(
          'FORBIDDEN',
          `Resource workspace ${workspaceId} does not match server workspace ${this.workspaceId}`,
        );
      }
      return this.withClient(async (client) => {
        try {
          const thread = await client.users.threads.get({
            userId: 'me',
            id: threadId,
            format: 'full',
          });
          const messages = (thread.data.messages ?? []).map(parseGmailMessage);
          return gmailOk({
            uri: input.uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              id: thread.data.id ?? threadId,
              historyId: thread.data.historyId ?? null,
              messages,
            }),
          });
        } catch (err) {
          return mapGoogleApiError(err);
        }
      });
    }
    return gmailError(
      'INVALID_ARGUMENT',
      `Unknown resource URI: ${input.uri}. Expected gmail://workspace/{workspaceId}/inbox or .../threads/{threadId}.`,
    );
  }

  // ── internals ────────────────────────────────────────────────────────

  /**
   * Re-resolves the credential on every call. We deliberately do NOT
   * cache the gmail_v1.Gmail client on the instance — caching plaintext
   * tokens across calls breaks `feedback_cold_start_safe_agents.md`.
   */
  private async withClient<T>(
    fn: (client: gmail_v1.Gmail) => Promise<GmailMcpResult<T>>,
  ): Promise<GmailMcpResult<T>> {
    const resolved = await resolveCredential({ workspaceId: this.workspaceId });
    if (!resolved.ok) return resolved;
    const client = makeGmailClient(resolved.value);
    return fn(client);
  }
}

// ── helpers ─────────────────────────────────────────────────────────────

function makeGmailClient(credential: DecryptedCredential): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken ?? undefined,
  });
  return google.gmail({ version: 'v1', auth });
}

function validateMaxResults(value: number | undefined): GmailMcpResult<number> {
  if (value === undefined) return gmailOk(DEFAULT_MAX_RESULTS);
  if (!Number.isInteger(value) || value <= 0) {
    return gmailError('INVALID_ARGUMENT', `maxResults must be a positive integer, got ${value}`);
  }
  if (value > MAX_PAGE_SIZE) {
    return gmailError(
      'INVALID_ARGUMENT',
      `maxResults must be <= ${MAX_PAGE_SIZE}, got ${value}`,
    );
  }
  return gmailOk(value);
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function mapGoogleApiError(err: unknown): { ok: false; error: import('./types').GmailMcpError } {
  if (!err || typeof err !== 'object') {
    return gmailError('UPSTREAM_ERROR', String(err));
  }
  const rec = err as {
    code?: number | string;
    message?: string;
    response?: { status?: number; data?: unknown };
  };
  const message = typeof rec.message === 'string' ? rec.message : 'unknown Google API error';
  const status =
    typeof rec.response?.status === 'number'
      ? rec.response.status
      : typeof rec.code === 'number'
      ? rec.code
      : undefined;
  if (status === 401) return gmailError('TOKEN_EXPIRED', message, { status });
  if (status === 403) return gmailError('FORBIDDEN', message, { status });
  if (status === 404) return gmailError('NOT_FOUND', message, { status });
  if (status === 429) return gmailError('RATE_LIMITED', message, { status });
  if (status && status >= 500) return gmailError('UPSTREAM_ERROR', message, { status });
  return gmailError('UPSTREAM_ERROR', message, status ? { status } : undefined);
}

// ── Message parser — mirrors lib/skills/gmail-fetcher.ts.parseGmailMessage ──
//
// We deliberately duplicate the parser instead of importing — moving the
// parser HERE makes the MCP server the source of truth for "what Gmail
// payload shape looks like outside this module." `lib/skills/gmail-fetcher.ts`
// migrates to consume this shape via the MCP server in this same PR.

export function parseGmailMessage(msg: gmail_v1.Schema$Message): FullMessage {
  const headers = msg.payload?.headers ?? [];
  const header = (name: string): string | null => {
    const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
    return h?.value ?? null;
  };
  const fromHeader = header('From') ?? '';
  const { name: fromName, email: fromEmail } = parseAddress(fromHeader);
  const toEmails = parseAddressList(header('To'));
  const ccEmails = parseAddressList(header('Cc'));
  const subject = header('Subject') ?? '';
  const references = (header('References') ?? '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const inReplyTo = header('In-Reply-To');
  const rfcMessageId = header('Message-ID');
  const bodyText = extractBodyText(msg.payload);
  const attachments = extractAttachments(msg.payload);
  const internalDate = msg.internalDate ? Number(msg.internalDate) : Date.now();
  return {
    id: msg.id ?? '',
    threadId: msg.threadId ?? '',
    rfcMessageId,
    fromEmail: fromEmail.toLowerCase(),
    fromName,
    toEmails: toEmails.map((e) => e.toLowerCase()),
    ccEmails: ccEmails.map((e) => e.toLowerCase()),
    subject,
    bodyText,
    snippet: (msg.snippet ?? '').slice(0, 200),
    references,
    inReplyTo,
    attachments,
    receivedAt: new Date(internalDate).toISOString(),
    labels: msg.labelIds ?? [],
  };
}

function parseAddress(s: string): { name: string | null; email: string } {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(s);
  if (m) return { name: (m[1] ?? '').trim() || null, email: m[2].trim() };
  return { name: null, email: s.trim() };
}

function parseAddressList(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(',')
    .map((part) => parseAddress(part).email)
    .filter((e) => e.length > 0);
}

function extractBodyText(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  const textPart = findPart(payload, 'text/plain');
  if (textPart && textPart.body?.data) return decodeBody(textPart.body.data);
  const htmlPart = findPart(payload, 'text/html');
  if (htmlPart && htmlPart.body?.data) return stripHtml(decodeBody(htmlPart.body.data));
  if (payload.body?.data) return decodeBody(payload.body.data);
  return '';
}

function findPart(
  part: gmail_v1.Schema$MessagePart,
  mimeType: string,
): gmail_v1.Schema$MessagePart | null {
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const sub of part.parts ?? []) {
    const found = findPart(sub, mimeType);
    if (found) return found;
  }
  return null;
}

function decodeBody(data: string): string {
  return Buffer.from(data, 'base64').toString('utf8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
): MessageAttachment[] {
  if (!payload) return [];
  const out: MessageAttachment[] = [];
  const walk = (part: gmail_v1.Schema$MessagePart): void => {
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      out.push({
        filename: part.filename,
        mimeType: part.mimeType ?? 'application/octet-stream',
        sizeBytes: part.body.size ?? 0,
        attachmentId: part.body.attachmentId,
      });
    }
    for (const sub of part.parts ?? []) walk(sub);
  };
  walk(payload);
  return out;
}
