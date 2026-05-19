/**
 * lib/skills/outlook-fetcher.ts
 *
 * MCP-backed `MessageFetcher` + `DraftPersister` for Outlook. Symmetric
 * peer of `lib/skills/gmail-fetcher.ts`. The skill chain consumes ONLY the
 * `MessageFetcher` / `DraftPersister` ports — branching by provider lives
 * in the runner caller (`lib/inngest/functions/process-webhook-event.ts`),
 * so this adapter looks like any other implementation from the skill's
 * point of view.
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file imports the Outlook
 * MCP server interface only. Direct Microsoft Graph calls live in
 * `lib/integrations/outlook-mcp/server.ts` + `lib/integrations/microsoft/`.
 *
 * Per `project_no_outbound_architecture.md`: the MCP surface exposes
 * `draft_message` (POST /me/messages → Drafts folder). No send tool
 * exists; this adapter cannot send.
 *
 * Per `feedback_cold_start_safe_agents.md`: each call re-resolves the
 * workspace credential through the MCP server's internal auth. No
 * in-memory token cache.
 *
 * Cursor handling:
 *   - Microsoft Graph notifications carry `resourceData.id` (the new
 *     message id) verbatim, unlike Gmail which carries a historyId we
 *     have to resolve into messages via users.history.list. Outlook's
 *     simpler shape means `fetchMessagesForEvent` can hit `get_message`
 *     directly on the id without an intermediate list+resolve pass.
 *   - When the notification carries multiple items (Graph batches some
 *     deliveries), we hit `get_message` for each in order.
 */

import type { WebhookEvent } from '@prisma/client';
import {
  buildOutlookMcpServer,
  type FullMessage,
  type OutlookMcpServer,
} from '@/lib/integrations/outlook-mcp';
import {
  type Attachment,
  type DraftPersister,
  type MessageFetcher,
  type ParsedMessage,
  type SkillResult,
  skillError,
  skillOk,
} from './types';

export interface OutlookFetcherConfig {
  /** Workspace the fetcher serves. Determines which credential the inner
   *  MCP server resolves. */
  workspaceId: string;
  /** Pre-built server instance — tests inject the deterministic test impl. */
  server?: OutlookMcpServer;
}

interface GraphNotificationEnvelope {
  value?: Array<{
    subscriptionId?: string;
    resource?: string;
    resourceData?: { id?: string };
    lifecycleEvent?: string;
  }>;
}

/**
 * One adapter, both ports. Reads + drafts share the same Outlook MCP
 * server, so a single instance fills the `MessageFetcher` and
 * `DraftPersister` roles in `runSkillChain`.
 */
export class OutlookMessageAdapter implements MessageFetcher, DraftPersister {
  readonly name = 'outlook-mcp' as const;
  private readonly server: OutlookMcpServer;

  constructor(config: OutlookFetcherConfig) {
    this.server = config.server ?? buildOutlookMcpServer({ workspaceId: config.workspaceId });
  }

  async fetchMessagesForEvent(
    event: WebhookEvent,
  ): Promise<SkillResult<ParsedMessage[]>> {
    const ids = readMessageIdsFromNotification(event);
    if (ids.length === 0) {
      // No resourceData.id on the envelope — likely a lifecycle event
      // (subscriptionRemoved, missed, reauthorizationRequired). Fall back
      // to listing the inbox tip the same way Gmail does, so the runner
      // never starves on lifecycle-only WebhookEvent rows.
      const list = await this.server.listMessages({
        maxResults: 10,
      });
      if (!list.ok) {
        return skillError(
          'UPSTREAM_GMAIL_ERROR',
          `outlook mcp list_messages failed: ${list.error.message}`,
          list.error.code,
        );
      }
      const messages: ParsedMessage[] = [];
      for (const summary of list.value.messages) {
        const got = await this.server.getMessage({ messageId: summary.id });
        if (!got.ok) {
          return skillError(
            'UPSTREAM_GMAIL_ERROR',
            `outlook mcp get_message failed for ${summary.id}: ${got.error.message}`,
            got.error.code,
          );
        }
        messages.push(toParsedMessage(got.value.message));
      }
      return skillOk(messages);
    }
    const messages: ParsedMessage[] = [];
    for (const id of ids) {
      const got = await this.server.getMessage({ messageId: id });
      if (!got.ok) {
        // Single missing message inside a batch shouldn't crater the run;
        // continue with the remainder so the skill chain sees what it can.
        if (got.error.code === 'NOT_FOUND') continue;
        return skillError(
          'UPSTREAM_GMAIL_ERROR',
          `outlook mcp get_message failed for ${id}: ${got.error.message}`,
          got.error.code,
        );
      }
      messages.push(toParsedMessage(got.value.message));
    }
    return skillOk(messages);
  }

  async fetchThreadMessages(threadId: string): Promise<SkillResult<ParsedMessage[]>> {
    const resource = await this.server.readResource({
      uri: `outlook://workspace/${this.server.workspaceId}/threads/${threadId}`,
    });
    if (!resource.ok) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `outlook mcp readResource failed: ${resource.error.message}`,
        resource.error.code,
      );
    }
    try {
      const body = JSON.parse(resource.value.text) as { messages?: FullMessage[] };
      const msgs = (body.messages ?? []).map(toParsedMessage);
      return skillOk(msgs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return skillError('PARSE_ERROR', `outlook mcp thread payload parse failed: ${message}`);
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
        `outlook mcp draft_message failed: ${drafted.error.message}`,
        drafted.error.code,
      );
    }
    return skillOk({ providerDraftId: drafted.value.draftId });
  }
}

function readMessageIdsFromNotification(event: WebhookEvent): string[] {
  const payload = event.rawPayload as GraphNotificationEnvelope | null;
  if (!payload || !Array.isArray(payload.value)) return [];
  const ids: string[] = [];
  for (const item of payload.value) {
    // Skip lifecycle-only entries — no resourceData.id to fetch.
    if (item.lifecycleEvent && !item.resourceData?.id) continue;
    const id = item.resourceData?.id;
    if (typeof id === 'string' && id.length > 0) {
      ids.push(id);
    }
  }
  return ids;
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
