/**
 * lib/skills/gmail-fetcher.ts
 *
 * Production implementation of `MessageFetcher` + `DraftPersister`.
 * Uses the existing `lib/integrations/google/` adapter for the Gmail
 * API surface; per `feedback_no_silent_vendor_lock.md`, this is the
 * one and only place in `lib/skills/` that needs to know Gmail's
 * payload-parts shape.
 *
 * This file does NOT activate at runtime in this PR — Gmail isn't
 * connected to Conner's account yet (waiting on GCP setup). The class
 * is wired so that the moment the OAuth callback completes, the
 * runner finds a configured fetcher and the loop closes on real data.
 *
 * Per `project_no_outbound_architecture.md`: this file uses
 * `gmail.users.history.list`, `gmail.users.messages.get`, and
 * `gmail.users.drafts.create` only. It explicitly never calls
 * `gmail.users.messages.send`, `gmail.users.drafts.send`, or
 * `gmail.users.messages.modify` with the SENT label.
 */

import { google, type gmail_v1 } from 'googleapis';
import type { IntegrationCredential, WebhookEvent } from '@prisma/client';
import { decryptCredential } from '../integrations';
import {
  Attachment,
  DraftPersister,
  MessageFetcher,
  ParsedMessage,
  SkillResult,
  skillError,
  skillOk,
} from './types';

export interface GmailFetcherConfig {
  credential: IntegrationCredential;
}

/**
 * One class implements BOTH `MessageFetcher` and `DraftPersister`. Reading
 * and drafting share the same Gmail client + credential, so a single
 * adapter is the right size. The interfaces stay separate (each skill
 * declares the surface it actually uses), but the implementation is one
 * object — `GmailMessageAdapter` — that callers can pass to either slot.
 */
export class GmailMessageAdapter implements MessageFetcher, DraftPersister {
  readonly name = 'gmail' as const;
  private readonly client: gmail_v1.Gmail;
  private readonly credential: IntegrationCredential;

  constructor(config: GmailFetcherConfig) {
    this.credential = config.credential;
    const decrypted = decryptCredential(config.credential);
    const auth = new google.auth.OAuth2();
    auth.setCredentials({
      access_token: decrypted.accessToken,
      refresh_token: decrypted.refreshToken ?? undefined,
    });
    this.client = google.gmail({ version: 'v1', auth });
  }

  async fetchMessagesForEvent(
    event: WebhookEvent,
  ): Promise<SkillResult<ParsedMessage[]>> {
    const cursor = readHistoryCursor(event);
    if (!cursor) {
      return skillError('INVALID_INPUT', 'WebhookEvent.rawPayload missing historyId cursor');
    }
    try {
      const history = await this.client.users.history.list({
        userId: 'me',
        startHistoryId: cursor,
        historyTypes: ['messageAdded'],
      });
      const records = history.data.history ?? [];
      const messageIds = new Set<string>();
      for (const h of records) {
        for (const m of h.messagesAdded ?? []) {
          if (m.message?.id) messageIds.add(m.message.id);
        }
      }
      const messages: ParsedMessage[] = [];
      for (const id of messageIds) {
        const got = await this.client.users.messages.get({
          userId: 'me',
          id,
          format: 'full',
        });
        if (got.data) {
          messages.push(parseGmailMessage(got.data));
        }
      }
      return skillOk(messages);
    } catch (err) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `gmail history.list/messages.get failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async fetchThreadMessages(threadId: string): Promise<SkillResult<ParsedMessage[]>> {
    try {
      const thread = await this.client.users.threads.get({
        userId: 'me',
        id: threadId,
        format: 'full',
      });
      const msgs = thread.data.messages ?? [];
      return skillOk(msgs.map(parseGmailMessage));
    } catch (err) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `gmail threads.get failed: ${err instanceof Error ? err.message : String(err)}`,
      );
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
    // RFC822 message construction — minimum viable headers + body. Real
    // production extends this with proper References / In-Reply-To
    // chains so the draft threads on the customer side.
    const headers: string[] = [
      `To: ${args.toEmails.join(', ')}`,
      `Subject: ${args.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
    ];
    if (args.inReplyToMessageId) {
      headers.push(`In-Reply-To: ${args.inReplyToMessageId}`);
      headers.push(`References: ${args.inReplyToMessageId}`);
    }
    const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + args.body, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    try {
      const res = await this.client.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            threadId: args.threadId,
            raw,
          },
        },
      });
      const id = res.data.id;
      if (!id) {
        return skillError('UPSTREAM_GMAIL_ERROR', 'drafts.create returned no id');
      }
      return skillOk({ providerDraftId: id });
    } catch (err) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `gmail drafts.create failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

function readHistoryCursor(event: WebhookEvent): string | null {
  const payload = event.rawPayload as { historyId?: unknown; message?: { data?: unknown } } | null;
  if (!payload) return null;
  if (typeof payload.historyId === 'string' && payload.historyId.length > 0) {
    return payload.historyId;
  }
  // The receiver may have written the raw Pub/Sub envelope. Decode it.
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

export function parseGmailMessage(msg: gmail_v1.Schema$Message): ParsedMessage {
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
    receivedAt: new Date(internalDate),
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
  // Prefer text/plain.
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
): Attachment[] {
  if (!payload) return [];
  const out: Attachment[] = [];
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
