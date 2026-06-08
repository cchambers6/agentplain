/**
 * lib/integrations/inbox/mcp-inbox-fetcher.ts
 *
 * Production `InboxSnapshotFetcher` backed by the Gmail / Outlook MCP
 * servers — the SAME servers `GmailMessageAdapter` / `OutlookMessageAdapter`
 * wrap. This file does NOT call googleapis / Microsoft Graph directly; it
 * speaks the `GmailMcpServer` / `OutlookMcpServer` tool surface only
 * (`feedback_no_silent_vendor_lock.md`).
 *
 * It lists the inbox tip (`listMessages`) then hydrates each summary to a
 * full `ParsedMessage` via `getMessage`. This is the cron-friendly read
 * path (no WebhookEvent cursor required) the chief-of-staff scheduler +
 * the lead-triage cron need.
 *
 * Per `feedback_cold_start_safe_agents.md`: each `fetchInbox` re-resolves
 * the workspace credential through the MCP server's internal auth. No
 * in-memory token cache.
 */

import { buildGmailMcpServer, type GmailMcpServer, type FullMessage as GmailFullMessage } from '@/lib/integrations/gmail-mcp';
import { buildOutlookMcpServer, type OutlookMcpServer, type FullMessage as OutlookFullMessage } from '@/lib/integrations/outlook-mcp';
import {
  skillError,
  skillOk,
  type Attachment,
  type ParsedMessage,
  type SkillResult,
} from '@/lib/skills/types';
import type { InboxFetchArgs, InboxSnapshotFetcher } from './types';

export type InboxProvider = 'GOOGLE' | 'M365';

export interface McpInboxFetcherConfig {
  workspaceId: string;
  provider: InboxProvider;
  /** Override the Gmail server (tests). Prod builds it lazily. */
  gmailServer?: GmailMcpServer;
  /** Override the Outlook server (tests). Prod builds it lazily. */
  outlookServer?: OutlookMcpServer;
}

const DEFAULT_QUERY = 'in:inbox';
const DEFAULT_MAX = 25;

export class McpInboxFetcher implements InboxSnapshotFetcher {
  readonly name = 'mcp-inbox' as const;
  private readonly workspaceId: string;
  private readonly provider: InboxProvider;
  private readonly gmailServer?: GmailMcpServer;
  private readonly outlookServer?: OutlookMcpServer;

  constructor(config: McpInboxFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('McpInboxFetcher: workspaceId is required');
    }
    this.workspaceId = config.workspaceId;
    this.provider = config.provider;
    this.gmailServer = config.gmailServer;
    this.outlookServer = config.outlookServer;
  }

  async fetchInbox(args: InboxFetchArgs): Promise<SkillResult<ParsedMessage[]>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `McpInboxFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    const max = clampMax(args.maxResults);
    return this.provider === 'GOOGLE'
      ? this.fetchGmail(max, args.query)
      : this.fetchOutlook(max, args.query);
  }

  private async fetchGmail(
    max: number,
    query?: string,
  ): Promise<SkillResult<ParsedMessage[]>> {
    const server =
      this.gmailServer ?? buildGmailMcpServer({ workspaceId: this.workspaceId });
    const list = await server.listMessages({
      query: query ?? DEFAULT_QUERY,
      maxResults: max,
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
      const got = await server.getMessage({ messageId: summary.id });
      if (!got.ok) {
        return skillError(
          'UPSTREAM_GMAIL_ERROR',
          `gmail mcp get_message failed for ${summary.id}: ${got.error.message}`,
          got.error.code,
        );
      }
      messages.push(gmailToParsedMessage(got.value.message));
    }
    return skillOk(messages);
  }

  private async fetchOutlook(
    max: number,
    query?: string,
  ): Promise<SkillResult<ParsedMessage[]>> {
    const server =
      this.outlookServer ??
      buildOutlookMcpServer({ workspaceId: this.workspaceId });
    const list = await server.listMessages({
      maxResults: max,
      ...(query ? { query } : {}),
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
      const got = await server.getMessage({ messageId: summary.id });
      if (!got.ok) {
        return skillError(
          'UPSTREAM_GMAIL_ERROR',
          `outlook mcp get_message failed for ${summary.id}: ${got.error.message}`,
          got.error.code,
        );
      }
      messages.push(outlookToParsedMessage(got.value.message));
    }
    return skillOk(messages);
  }
}

function clampMax(v: number | undefined): number {
  if (!v || v <= 0) return DEFAULT_MAX;
  return Math.min(100, v);
}

function gmailToParsedMessage(m: GmailFullMessage): ParsedMessage {
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

function outlookToParsedMessage(m: OutlookFullMessage): ParsedMessage {
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

function toAttachment(a: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  attachmentId: string | null;
}): Attachment {
  return {
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    attachmentId: a.attachmentId,
  };
}
