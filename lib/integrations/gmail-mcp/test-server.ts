/**
 * lib/integrations/gmail-mcp/test-server.ts
 *
 * Deterministic, in-memory implementation of `GmailMcpServer`. Used by:
 *
 *   * `scripts/test-gmail-mcp.ts` for the smoke test that proves the
 *     protocol wiring without requiring an OAuth connection.
 *   * Future contract tests that parameterize prod + test impls through
 *     the same assertions (mirrors `lib/integrations/__tests__/contract.test.ts`).
 *   * Local dev when Gmail isn't OAuth-connected for a workspace yet —
 *     `TEST_GMAIL_MCP=true` routes the marketplace factory here.
 *
 * Per `feedback_runner_portability.md` (two-implementation rule): this is
 * the contract-pinning peer of `./server.ts`. Drift here = false-pass
 * tests.
 *
 * Per `project_no_outbound_architecture.md`: the test impl also exposes
 * NO send method. The `draftMessage` tool records to an in-memory drafts
 * map; production callers see the same draft id back regardless of impl.
 */

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
  type MessageSummary,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SearchThreadsInput,
  type SearchThreadsOutput,
  type ThreadSummary,
  gmailError,
  gmailOk,
} from './types';

export interface TestGmailSeed {
  /** Messages keyed by id. Seeded by the test setup. */
  messages?: FullMessage[];
  /** Labels surfaced from listLabels. Defaults to the standard system set. */
  labels?: LabelDescriptor[];
}

const DEFAULT_LABELS: LabelDescriptor[] = [
  { id: 'INBOX', name: 'INBOX', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'UNREAD', name: 'UNREAD', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'IMPORTANT', name: 'IMPORTANT', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'STARRED', name: 'STARRED', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'TRASH', name: 'TRASH', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'SENT', name: 'SENT', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'DRAFT', name: 'DRAFT', type: 'system', messagesTotal: null, messagesUnread: null },
];

interface DraftEntry {
  draftId: string;
  messageId: string;
  threadId: string;
  to: string[];
  subject: string;
  body: string;
  inReplyToMessageId?: string;
}

export class TestGmailMcpServer implements GmailMcpServer {
  readonly name = 'gmail-test' as const;
  readonly workspaceId: string;
  private readonly messages: Map<string, FullMessage>;
  private readonly drafts: Map<string, DraftEntry> = new Map();
  private readonly labels: Map<string, LabelDescriptor>;
  private draftCounter = 0;

  /** Public for assertions in the smoke test. */
  readonly calls: Array<{ method: string; args: unknown }> = [];

  constructor(args: { workspaceId: string; seed?: TestGmailSeed }) {
    if (!args.workspaceId) {
      throw new Error('TestGmailMcpServer: workspaceId is required');
    }
    this.workspaceId = args.workspaceId;
    this.messages = new Map();
    for (const m of args.seed?.messages ?? defaultFixtures()) {
      this.messages.set(m.id, m);
    }
    this.labels = new Map();
    for (const l of args.seed?.labels ?? DEFAULT_LABELS) {
      this.labels.set(l.id, l);
    }
  }

  async listMessages(
    input: ListMessagesInput,
  ): Promise<GmailMcpResult<ListMessagesOutput>> {
    this.calls.push({ method: 'listMessages', args: input });
    const max = input.maxResults ?? 25;
    if (max <= 0 || max > 100) {
      return gmailError('INVALID_ARGUMENT', `maxResults must be 1..100, got ${max}`);
    }
    const all = Array.from(this.messages.values());
    const filtered = applyTestQueryFilter(all, input.query);
    const summaries: MessageSummary[] = filtered.slice(0, max).map((m) => ({
      id: m.id,
      threadId: m.threadId,
      snippet: m.snippet,
      labels: m.labels,
    }));
    return gmailOk({
      messages: summaries,
      nextPageToken: filtered.length > max ? `test-page-${max}` : null,
      resultSizeEstimate: filtered.length,
    });
  }

  async getMessage(input: GetMessageInput): Promise<GmailMcpResult<GetMessageOutput>> {
    this.calls.push({ method: 'getMessage', args: input });
    if (!input.messageId) {
      return gmailError('INVALID_ARGUMENT', 'getMessage requires messageId');
    }
    const m = this.messages.get(input.messageId);
    if (!m) {
      return gmailError('NOT_FOUND', `No fixture message with id ${input.messageId}`);
    }
    return gmailOk({ message: m });
  }

  async searchThreads(
    input: SearchThreadsInput,
  ): Promise<GmailMcpResult<SearchThreadsOutput>> {
    this.calls.push({ method: 'searchThreads', args: input });
    if (!input.query) {
      return gmailError('INVALID_ARGUMENT', 'searchThreads requires query');
    }
    const max = input.maxResults ?? 25;
    const byThread = new Map<string, FullMessage[]>();
    for (const m of this.messages.values()) {
      const list = byThread.get(m.threadId) ?? [];
      list.push(m);
      byThread.set(m.threadId, list);
    }
    const filtered: ThreadSummary[] = [];
    for (const [threadId, msgs] of byThread) {
      const matches = applyTestQueryFilter(msgs, input.query);
      if (matches.length === 0) continue;
      filtered.push({
        id: threadId,
        snippet: matches[0].snippet,
        historyId: '1',
        messageCount: msgs.length,
      });
    }
    return gmailOk({
      threads: filtered.slice(0, max),
      nextPageToken: filtered.length > max ? `test-thread-page-${max}` : null,
    });
  }

  async draftMessage(
    input: DraftMessageInput,
  ): Promise<GmailMcpResult<DraftMessageOutput>> {
    this.calls.push({ method: 'draftMessage', args: input });
    if (!input.to || input.to.length === 0) {
      return gmailError('INVALID_ARGUMENT', 'draftMessage requires at least one recipient');
    }
    if (!input.subject) {
      return gmailError('INVALID_ARGUMENT', 'draftMessage requires subject');
    }
    if (!input.body) {
      return gmailError('INVALID_ARGUMENT', 'draftMessage requires body');
    }
    this.draftCounter += 1;
    const draftId = `test-draft-${this.draftCounter}`;
    const messageId = `test-msg-${this.draftCounter}`;
    const threadId = input.threadId ?? `test-thread-${this.draftCounter}`;
    this.drafts.set(draftId, {
      draftId,
      messageId,
      threadId,
      to: [...input.to],
      subject: input.subject,
      body: input.body,
      inReplyToMessageId: input.inReplyToMessageId,
    });
    return gmailOk({ draftId, messageId, threadId });
  }

  async labelMessage(
    input: LabelMessageInput,
  ): Promise<GmailMcpResult<LabelMessageOutput>> {
    this.calls.push({ method: 'labelMessage', args: input });
    const m = this.messages.get(input.messageId);
    if (!m) {
      return gmailError('NOT_FOUND', `No fixture message ${input.messageId}`);
    }
    const next = new Set(m.labels);
    for (const id of input.addLabelIds ?? []) next.add(id);
    for (const id of input.removeLabelIds ?? []) next.delete(id);
    const updated = { ...m, labels: Array.from(next) };
    this.messages.set(m.id, updated);
    return gmailOk({ messageId: m.id, labels: updated.labels });
  }

  async listLabels(): Promise<GmailMcpResult<ListLabelsOutput>> {
    this.calls.push({ method: 'listLabels', args: null });
    return gmailOk({ labels: Array.from(this.labels.values()) });
  }

  async listResources(): Promise<GmailMcpResult<ResourceDescriptor[]>> {
    return gmailOk([
      {
        uri: `gmail://workspace/${this.workspaceId}/inbox`,
        name: 'Inbox (test)',
        description: 'Fixture-backed inbox view for the test MCP server.',
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<GmailMcpResult<ReadResourceOutput>> {
    const inboxMatch = /^gmail:\/\/workspace\/([0-9a-f-]+)\/inbox/i.exec(input.uri);
    if (inboxMatch) {
      if (inboxMatch[1] !== this.workspaceId) {
        return gmailError(
          'FORBIDDEN',
          `Resource workspace ${inboxMatch[1]} does not match server workspace ${this.workspaceId}`,
        );
      }
      const list = await this.listMessages({ query: 'in:inbox' });
      if (!list.ok) return list;
      return gmailOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    const threadMatch = /^gmail:\/\/workspace\/([0-9a-f-]+)\/threads\/(.+)$/i.exec(input.uri);
    if (threadMatch) {
      if (threadMatch[1] !== this.workspaceId) {
        return gmailError(
          'FORBIDDEN',
          `Resource workspace ${threadMatch[1]} does not match server workspace ${this.workspaceId}`,
        );
      }
      const threadId = threadMatch[2];
      const msgs = Array.from(this.messages.values()).filter((m) => m.threadId === threadId);
      if (msgs.length === 0) {
        return gmailError('NOT_FOUND', `No fixture thread ${threadId}`);
      }
      return gmailOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          id: threadId,
          historyId: '1',
          messages: msgs,
        }),
      });
    }
    return gmailError('INVALID_ARGUMENT', `Unknown resource URI: ${input.uri}`);
  }

  // ── Test affordances ─────────────────────────────────────────────────

  /** Public for smoke-test assertions. */
  getDraft(draftId: string): DraftEntry | undefined {
    return this.drafts.get(draftId);
  }

  getDraftCount(): number {
    return this.drafts.size;
  }
}

// ── Default fixtures ────────────────────────────────────────────────────

function defaultFixtures(): FullMessage[] {
  const baseDate = new Date('2026-05-12T09:00:00.000Z');
  return [
    {
      id: 'fixture-msg-001',
      threadId: 'fixture-thread-001',
      rfcMessageId: '<lead-001@example.com>',
      fromEmail: 'jane.buyer@example.com',
      fromName: 'Jane Buyer',
      toEmails: ['broker@example-realty.com'],
      ccEmails: [],
      subject: 'Interested in 123 Peachtree St',
      bodyText:
        'Hi, I saw the listing for 123 Peachtree St on Zillow. Could we set up a tour this week? My number is 555-0100.',
      snippet: 'Hi, I saw the listing for 123 Peachtree St on Zillow. Could we set up a tour this week?',
      references: [],
      inReplyTo: null,
      attachments: [],
      receivedAt: baseDate.toISOString(),
      labels: ['INBOX', 'UNREAD'],
    },
    {
      id: 'fixture-msg-002',
      threadId: 'fixture-thread-002',
      rfcMessageId: '<vendor-001@example.com>',
      fromEmail: 'invoice@vendor.example',
      fromName: 'Vendor Co',
      toEmails: ['broker@example-realty.com'],
      ccEmails: [],
      subject: 'Invoice #4451 — escrow services',
      bodyText: 'Attached is your invoice for escrow services rendered in April. Net 30.',
      snippet: 'Attached is your invoice for escrow services rendered in April.',
      references: [],
      inReplyTo: null,
      attachments: [
        {
          filename: 'invoice-4451.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 84231,
          attachmentId: 'fixture-att-001',
        },
      ],
      receivedAt: new Date(baseDate.getTime() + 3600_000).toISOString(),
      labels: ['INBOX'],
    },
    {
      id: 'fixture-msg-003',
      threadId: 'fixture-thread-001',
      rfcMessageId: '<lead-001-reply@example.com>',
      fromEmail: 'broker@example-realty.com',
      fromName: 'Broker',
      toEmails: ['jane.buyer@example.com'],
      ccEmails: [],
      subject: 'Re: Interested in 123 Peachtree St',
      bodyText: 'Hi Jane, happy to show you the home. How about Wednesday at 2pm?',
      snippet: 'Hi Jane, happy to show you the home. How about Wednesday at 2pm?',
      references: ['<lead-001@example.com>'],
      inReplyTo: '<lead-001@example.com>',
      attachments: [],
      receivedAt: new Date(baseDate.getTime() + 1800_000).toISOString(),
      labels: ['SENT'],
    },
  ];
}

// ── Test query parser ──────────────────────────────────────────────────

/**
 * Best-effort approximation of Gmail's search syntax for the test server:
 *   * `in:inbox` / `in:sent` / `in:trash` → label filter
 *   * `is:unread` → label filter
 *   * `from:foo@bar.com` → sender filter
 *   * `subject:"hello"` → subject substring
 *   * `<bare word>` → substring across subject + body
 *
 * Sufficient to drive the smoke test + contract tests without modeling
 * Gmail's full grammar.
 */
function applyTestQueryFilter(messages: FullMessage[], query?: string): FullMessage[] {
  if (!query || query.trim().length === 0) return messages;
  const q = query.trim();
  const tokens = q.match(/("[^"]+"|\S+)/g) ?? [];
  return messages.filter((m) => {
    for (const t of tokens) {
      const trimmed = t.replace(/^"|"$/g, '');
      if (trimmed.startsWith('in:')) {
        const want = trimmed.slice(3).toUpperCase();
        if (!m.labels.includes(want)) return false;
      } else if (trimmed.startsWith('is:')) {
        const want = trimmed.slice(3).toUpperCase();
        if (!m.labels.includes(want)) return false;
      } else if (trimmed.startsWith('from:')) {
        const want = trimmed.slice(5).toLowerCase();
        if (!m.fromEmail.includes(want)) return false;
      } else if (trimmed.startsWith('subject:')) {
        const want = trimmed.slice(8).toLowerCase();
        if (!m.subject.toLowerCase().includes(want)) return false;
      } else {
        const want = trimmed.toLowerCase();
        if (
          !m.subject.toLowerCase().includes(want) &&
          !m.bodyText.toLowerCase().includes(want)
        ) {
          return false;
        }
      }
    }
    return true;
  });
}
