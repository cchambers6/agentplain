/**
 * lib/skills/gmail-fetcher.ts
 *
 * MCP-backed implementation of `MessageFetcher` + `DraftPersister`. Per
 * the MCP-first integration architecture (Phase A), all reading and
 * drafting goes through `lib/integrations/gmail-mcp/`. This file used to
 * import `googleapis` directly; that import is now confined to
 * `lib/integrations/google/` + `lib/integrations/gmail-mcp/server.ts` and
 * this adapter speaks ONLY the `GmailMcpServer` interface.
 *
 * Per `feedback_no_silent_vendor_lock.md`: with this change, the count
 * of scattered `googleapis` import sites monotonically decreases — this
 * file moves from one of them to none.
 *
 * Per `project_no_outbound_architecture.md`: the MCP server's tool surface
 * exposes draft creation only; no send tool exists, so this adapter can't
 * accidentally send.
 *
 * Per `feedback_cold_start_safe_agents.md`: each call resolves the
 * workspace credential via the MCP server's internal auth, which itself
 * reads durable state on every call. No in-memory token cache.
 *
 * The fetcher reads the historyId off the WebhookEvent payload, calls
 * `gmail.search_threads`-equivalent via a search by `rfc822msgid:` style
 * isn't expressive enough — Gmail's history list requires
 * `users.history.list`, which the MCP server doesn't currently expose
 * (the MCP surface is the customer-facing operations, not the internal
 * cursor mechanic). We thread the cursor through via the production MCP
 * server's underlying credential by listing messages after the cursor —
 * the search query `is:inbox newer:<historyId>` is not valid Gmail
 * syntax, so PR-B's prior `users.history.list` path lives behind a
 * dedicated MCP tool. For Phase A we list inbox and let the runner pull
 * full messages by id; cursor-precise history walking lands in Phase B
 * along with M365's equivalent ChangeNotificationCollection.
 */

import type { WebhookEvent } from '@prisma/client';
import {
  type GmailMcpServer,
  type FullMessage,
} from '@/lib/integrations/gmail-mcp';
import { buildGmailMcpServer } from '@/lib/integrations/gmail-mcp';
import {
  type Attachment,
  type DraftPersister,
  type MessageFetcher,
  type ParsedMessage,
  type SkillResult,
  skillError,
  skillOk,
} from './types';

export interface GmailFetcherConfig {
  /** Workspace the fetcher serves. Determines which credential the inner
   *  MCP server resolves. */
  workspaceId: string;
  /** Pre-built server instance — tests inject the deterministic test impl. */
  server?: GmailMcpServer;
}

/**
 * One adapter, both ports. Reads + drafts share the same MCP server, so
 * a single instance fills the `MessageFetcher` and `DraftPersister`
 * roles in `runSkillChain`.
 */
export class GmailMessageAdapter implements MessageFetcher, DraftPersister {
  readonly name = 'gmail-mcp' as const;
  private readonly server: GmailMcpServer;

  constructor(config: GmailFetcherConfig) {
    this.server = config.server ?? buildGmailMcpServer({ workspaceId: config.workspaceId });
  }

  async fetchMessagesForEvent(
    event: WebhookEvent,
  ): Promise<SkillResult<ParsedMessage[]>> {
    const cursor = readHistoryCursor(event);
    if (!cursor) {
      return skillError('INVALID_INPUT', 'WebhookEvent.rawPayload missing historyId cursor');
    }
    // For Phase A, fetch the current inbox tip. The runner consumes the
    // most-recent N messages; the cursor is preserved for ordering /
    // dedupe on the consumer side. Phase B will add a dedicated
    // `gmail.list_history` tool that uses users.history.list under the
    // hood for cursor-precise replay.
    const list = await this.server.listMessages({
      query: 'in:inbox',
      maxResults: 10,
    });
    if (!list.ok) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `gmail mcp list_messages failed: ${list.error.message}`,
        list.error.code,
      );
    }
    const messages: ParsedMessage[] = [];
    for (const summary of list.value.messages) {
      const got = await this.server.getMessage({ messageId: summary.id });
      if (!got.ok) {
        return skillError(
          'UPSTREAM_GMAIL_ERROR',
          `gmail mcp get_message failed for ${summary.id}: ${got.error.message}`,
          got.error.code,
        );
      }
      messages.push(toParsedMessage(got.value.message));
    }
    return skillOk(messages);
  }

  async fetchThreadMessages(threadId: string): Promise<SkillResult<ParsedMessage[]>> {
    const resource = await this.server.readResource({
      uri: `gmail://workspace/${this.server.workspaceId}/threads/${threadId}`,
    });
    if (!resource.ok) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `gmail mcp readResource failed: ${resource.error.message}`,
        resource.error.code,
      );
    }
    try {
      const body = JSON.parse(resource.value.text) as { messages?: FullMessage[] };
      const msgs = (body.messages ?? []).map(toParsedMessage);
      return skillOk(msgs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError('PARSE_ERROR', `gmail mcp thread payload parse failed: ${message}`);
    }
  }

  async persistDraft(args: {
    workspaceId: string;
    threadId: string;
    inReplyToMessageId: string | null;
    toEmails: string[];
    subject: string;
    body: string;
  }): Promise<SkillResult<{ providerDraftId: string }>> {
    if (args.workspaceId !== this.server.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `persistDraft workspaceId ${args.workspaceId} does not match server workspace ${this.server.workspaceId}`,
      );
    }
    const drafted = await this.server.draftMessage({
      to: args.toEmails,
      subject: args.subject,
      body: args.body,
      threadId: args.threadId,
      inReplyToMessageId: args.inReplyToMessageId ?? undefined,
    });
    if (!drafted.ok) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `gmail mcp draft_message failed: ${drafted.error.message}`,
        drafted.error.code,
      );
    }
    return skillOk({ providerDraftId: drafted.value.draftId });
  }
}

function readHistoryCursor(event: WebhookEvent): string | null {
  const payload = event.rawPayload as { historyId?: unknown; message?: { data?: unknown } } | null;
  if (!payload) return null;
  if (typeof payload.historyId === 'string' && payload.historyId.length > 0) {
    return payload.historyId;
  }
  if (payload.message && typeof payload.message.data === 'string') {
    try {
      const decoded = JSON.parse(
        Buffer.from(payload.message.data, 'base64').toString('utf8'),
      ) as { historyId?: unknown };
      if (typeof decoded.historyId === 'string') return decoded.historyId;
      if (typeof decoded.historyId === 'number') return String(decoded.historyId);
    } catch {
      return null;
    }
  }
  return null;
}

function toParsedMessage(m: FullMessage): ParsedMessage {
  return {
    id: m.id,
    threadId: m.threadId,
    rfcMessageId: m.rfcMessageId,
    fromEmail: m.fromEmail,
    fromName: m.fromName,
    toEmails: m.toEmails,
    ccEmails: m.ccEmails,
    subject: m.subject,
    bodyText: m.bodyText,
    snippet: m.snippet,
    references: m.references,
    inReplyTo: m.inReplyTo,
    attachments: m.attachments.map(toAttachment),
    receivedAt: new Date(m.receivedAt),
    labels: m.labels,
  };
}

function toAttachment(a: FullMessage['attachments'][number]): Attachment {
  return {
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    attachmentId: a.attachmentId,
  };
}
