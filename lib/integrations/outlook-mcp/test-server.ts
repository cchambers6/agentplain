/**
 * lib/integrations/outlook-mcp/test-server.ts
 *
 * Deterministic, in-memory implementation of `OutlookMcpServer`. Mirrors
 * `lib/integrations/gmail-mcp/test-server.ts` one-for-one so contract
 * tests can parameterize the two implementations through identical
 * assertions. Used by:
 *
 *   * `scripts/test-outlook-mcp.ts` for the Phase B smoke test that
 *     proves protocol wiring without requiring a Microsoft OAuth grant.
 *   * Future contract tests that exercise prod + test impls through
 *     the same assertions (mirrors `lib/integrations/__tests__/contract.test.ts`).
 *   * Local dev when Outlook isn't OAuth-connected for a workspace yet —
 *     `TEST_OUTLOOK_MCP=true` routes the factory here.
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
  type LabelDescriptor,
  type LabelMessageInput,
  type LabelMessageOutput,
  type ListLabelsOutput,
  type ListMessagesInput,
  type ListMessagesOutput,
  type MessageSummary,
  type OutlookMcpResult,
  type OutlookMcpServer,
  type ReadResourceInput,
  type ReadResourceOutput,
  type ResourceDescriptor,
  type SearchThreadsInput,
  type SearchThreadsOutput,
  type ThreadSummary,
  outlookError,
  outlookOk,
} from './types';

export interface TestOutlookSeed {
  /** Messages keyed by id. Seeded by the test setup. */
  messages?: FullMessage[];
  /** Labels surfaced from listLabels. Defaults to the standard system + a
   *  small tenant-defined set. */
  labels?: LabelDescriptor[];
}

const DEFAULT_LABELS: LabelDescriptor[] = [
  { id: 'Inbox', name: 'Inbox', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'Drafts', name: 'Drafts', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'Sent Items', name: 'Sent Items', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'Deleted Items', name: 'Deleted Items', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'Junk Email', name: 'Junk Email', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'Archive', name: 'Archive', type: 'system', messagesTotal: null, messagesUnread: null },
  { id: 'cat-red', name: 'Red category', type: 'user', messagesTotal: null, messagesUnread: null },
  { id: 'cat-blue', name: 'Blue category', type: 'user', messagesTotal: null, messagesUnread: null },
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

export class TestOutlookMcpServer implements OutlookMcpServer {
  readonly name = 'outlook-test' as const;
  readonly workspaceId: string;
  private readonly messages: Map<string, FullMessage>;
  private readonly drafts: Map<string, DraftEntry> = new Map();
  private readonly labels: Map<string, LabelDescriptor>;
  private draftCounter = 0;

  /** Public for assertions in the smoke test. */
  readonly calls: Array<{ method: string; args: unknown }> = [];

  constructor(args: { workspaceId: string; seed?: TestOutlookSeed }) {
    if (!args.workspaceId) {
      throw new Error('TestOutlookMcpServer: workspaceId is required');
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
  ): Promise<OutlookMcpResult<ListMessagesOutput>> {
    this.calls.push({ method: 'listMessages', args: input });
    const max = input.maxResults ?? 25;
    if (max <= 0 || max > 100) {
      return outlookError('INVALID_ARGUMENT', `maxResults must be 1..100, got ${max}`);
    }
    const all = Array.from(this.messages.values());
    const filtered = applyTestQueryFilter(all, input.query);
    const summaries: MessageSummary[] = filtered.slice(0, max).map((m) => ({
      id: m.id,
      threadId: m.threadId,
      snippet: m.snippet,
      labels: m.labels,
    }));
    return outlookOk({
      messages: summaries,
      nextPageToken: filtered.length > max ? `test-page-${max}` : null,
      resultSizeEstimate: filtered.length,
    });
  }

  async getMessage(input: GetMessageInput): Promise<OutlookMcpResult<GetMessageOutput>> {
    this.calls.push({ method: 'getMessage', args: input });
    if (!input.messageId) {
      return outlookError('INVALID_ARGUMENT', 'getMessage requires messageId');
    }
    const m = this.messages.get(input.messageId);
    if (!m) {
      return outlookError('NOT_FOUND', `No fixture message with id ${input.messageId}`);
    }
    return outlookOk({ message: m });
  }

  async searchThreads(
    input: SearchThreadsInput,
  ): Promise<OutlookMcpResult<SearchThreadsOutput>> {
    this.calls.push({ method: 'searchThreads', args: input });
    if (!input.query) {
      return outlookError('INVALID_ARGUMENT', 'searchThreads requires query');
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
        historyId: null,
        messageCount: msgs.length,
      });
    }
    return outlookOk({
      threads: filtered.slice(0, max),
      nextPageToken: filtered.length > max ? `test-thread-page-${max}` : null,
    });
  }

  async draftMessage(
    input: DraftMessageInput,
  ): Promise<OutlookMcpResult<DraftMessageOutput>> {
    this.calls.push({ method: 'draftMessage', args: input });
    if (!input.to || input.to.length === 0) {
      return outlookError('INVALID_ARGUMENT', 'draftMessage requires at least one recipient');
    }
    if (!input.subject) {
      return outlookError('INVALID_ARGUMENT', 'draftMessage requires subject');
    }
    if (!input.body) {
      return outlookError('INVALID_ARGUMENT', 'draftMessage requires body');
    }
    this.draftCounter += 1;
    // Microsoft does not separate draft id from message id; mirror that
    // by using the same value for both. The test ID looks distinctively
    // Outlook-flavored ("AAMkA...") so a smoke test can assert no
    // accidental cross-provider id leakage.
    const messageId = `AAMkAtest-${this.draftCounter}`;
    const draftId = messageId;
    const threadId = input.threadId ?? `AAQkAconv-${this.draftCounter}`;
    this.drafts.set(draftId, {
      draftId,
      messageId,
      threadId,
      to: [...input.to],
      subject: input.subject,
      body: input.body,
      inReplyToMessageId: input.inReplyToMessageId,
    });
    return outlookOk({ draftId, messageId, threadId });
  }

  async labelMessage(
    input: LabelMessageInput,
  ): Promise<OutlookMcpResult<LabelMessageOutput>> {
    this.calls.push({ method: 'labelMessage', args: input });
    const m = this.messages.get(input.messageId);
    if (!m) {
      return outlookError('NOT_FOUND', `No fixture message ${input.messageId}`);
    }
    const next = new Set(m.labels);
    for (const id of input.addLabelIds ?? []) next.add(id);
    for (const id of input.removeLabelIds ?? []) next.delete(id);
    const updated = { ...m, labels: Array.from(next) };
    this.messages.set(m.id, updated);
    return outlookOk({ messageId: m.id, labels: updated.labels });
  }

  async listLabels(): Promise<OutlookMcpResult<ListLabelsOutput>> {
    this.calls.push({ method: 'listLabels', args: null });
    return outlookOk({ labels: Array.from(this.labels.values()) });
  }

  async listResources(): Promise<OutlookMcpResult<ResourceDescriptor[]>> {
    return outlookOk([
      {
        uri: `outlook://workspace/${this.workspaceId}/inbox`,
        name: 'Inbox (test)',
        description: 'Fixture-backed inbox view for the test Outlook MCP server.',
        mimeType: 'application/json',
      },
    ]);
  }

  async readResource(
    input: ReadResourceInput,
  ): Promise<OutlookMcpResult<ReadResourceOutput>> {
    const inboxMatch = /^outlook:\/\/workspace\/([0-9a-f-]+)\/inbox/i.exec(input.uri);
    if (inboxMatch) {
      if (inboxMatch[1] !== this.workspaceId) {
        return outlookError(
          'FORBIDDEN',
          `Resource workspace ${inboxMatch[1]} does not match server workspace ${this.workspaceId}`,
        );
      }
      const list = await this.listMessages({});
      if (!list.ok) return list;
      return outlookOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify(list.value),
      });
    }
    const threadMatch = /^outlook:\/\/workspace\/([0-9a-f-]+)\/threads\/(.+)$/i.exec(input.uri);
    if (threadMatch) {
      if (threadMatch[1] !== this.workspaceId) {
        return outlookError(
          'FORBIDDEN',
          `Resource workspace ${threadMatch[1]} does not match server workspace ${this.workspaceId}`,
        );
      }
      const threadId = threadMatch[2];
      const msgs = Array.from(this.messages.values()).filter((m) => m.threadId === threadId);
      if (msgs.length === 0) {
        return outlookError('NOT_FOUND', `No fixture thread ${threadId}`);
      }
      return outlookOk({
        uri: input.uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          id: threadId,
          historyId: null,
          messages: msgs,
        }),
      });
    }
    return outlookError('INVALID_ARGUMENT', `Unknown resource URI: ${input.uri}`);
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

/**
 * Outlook-flavored fixtures. IDs use the AAMkA / AAQkA prefixes Microsoft
 * Graph emits in production so contract tests can assert the test impl
 * round-trips "Outlook-shaped" ids rather than Gmail-shaped ones.
 * `internetMessageId` follows the RFC2822 angle-bracket convention.
 */
function defaultFixtures(): FullMessage[] {
  const baseDate = new Date('2026-05-12T09:00:00.000Z');
  return [
    {
      id: 'AAMkAfixture-msg-001',
      threadId: 'AAQkAfixture-thread-001',
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
      labels: ['Inbox', 'cat-blue'],
    },
    {
      id: 'AAMkAfixture-msg-002',
      threadId: 'AAQkAfixture-thread-002',
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
          attachmentId: 'AAMkAfixture-att-001',
        },
      ],
      receivedAt: new Date(baseDate.getTime() + 3600_000).toISOString(),
      labels: ['Inbox'],
    },
    {
      id: 'AAMkAfixture-msg-003',
      threadId: 'AAQkAfixture-thread-001',
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
      labels: ['Sent Items'],
    },
  ];
}

// ── Test query parser ──────────────────────────────────────────────────

/**
 * Best-effort approximation of Microsoft Graph $search / $filter syntax
 * for the test server:
 *   * `inbox` / `sent` / `archive` → folder filter via labels
 *   * `from:foo@bar.com` → sender filter
 *   * `subject:"hello"` → subject substring
 *   * `<bare word>` → substring across subject + body
 *
 * Symmetric with the Gmail test server's filter — both interpret the
 * same plaintext query shapes so cross-provider tests can share inputs.
 */
function applyTestQueryFilter(messages: FullMessage[], query?: string): FullMessage[] {
  if (!query || query.trim().length === 0) return messages;
  const q = query.trim();
  const tokens = q.match(/("[^"]+"|\S+)/g) ?? [];
  return messages.filter((m) => {
    for (const t of tokens) {
      const trimmed = t.replace(/^"|"$/g, '');
      if (/^inbox$/i.test(trimmed)) {
        if (!m.labels.includes('Inbox')) return false;
      } else if (/^sent$/i.test(trimmed)) {
        if (!m.labels.includes('Sent Items')) return false;
      } else if (/^archive$/i.test(trimmed)) {
        if (!m.labels.includes('Archive')) return false;
      } else if (trimmed.toLowerCase().startsWith('from:')) {
        const want = trimmed.slice(5).toLowerCase();
        if (!m.fromEmail.includes(want)) return false;
      } else if (trimmed.toLowerCase().startsWith('subject:')) {
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
