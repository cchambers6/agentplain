/**
 * lib/integrations/inbox/fixture-inbox-fetcher.ts
 *
 * Deterministic, in-memory `InboxSnapshotFetcher`. The contract-pinning
 * peer of `./mcp-inbox-fetcher.ts` (two-implementation rule,
 * `feedback_runner_portability.md`).
 *
 * Used by:
 *   - The wave-2 default path when `LIVE_INBOX_FETCH` is off — the
 *     scheduler + lead-triage run on these fixtures so the seam works in
 *     dev with no live OAuth.
 *   - Tests that exercise the scheduler-inbox arm + lead-triage draft
 *     persistence without standing up an MCP server.
 *
 * The default seed mirrors the Gmail MCP test-server fixtures: one hot
 * real-estate buyer lead, one vendor invoice, plus one urgent thread — so
 * the per-message classifier and lead scorer have a realistic spread.
 */

import {
  skillOk,
  skillError,
  type ParsedMessage,
  type SkillResult,
} from '@/lib/skills/types';
import type { InboxFetchArgs, InboxSnapshotFetcher } from './types';

export interface FixtureInboxFetcherConfig {
  workspaceId: string;
  /** Override the seed. When omitted the default spread is used. */
  messages?: ParsedMessage[];
}

export class FixtureInboxFetcher implements InboxSnapshotFetcher {
  readonly name = 'fixture-inbox' as const;
  private readonly workspaceId: string;
  private readonly messages: ParsedMessage[];

  constructor(config: FixtureInboxFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('FixtureInboxFetcher: workspaceId is required');
    }
    this.workspaceId = config.workspaceId;
    this.messages = config.messages ?? defaultInboxFixtures();
  }

  async fetchInbox(args: InboxFetchArgs): Promise<SkillResult<ParsedMessage[]>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `FixtureInboxFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    const max = args.maxResults ?? 25;
    return skillOk(this.messages.slice(0, max));
  }
}

/**
 * Default fixture spread. Three messages, one per classifier path:
 *   - hot real-estate buyer (lead-triage → hot, customer-active)
 *   - vendor invoice (vendor-pending)
 *   - urgent operational ask (urgent)
 */
export function defaultInboxFixtures(): ParsedMessage[] {
  const base = new Date('2026-06-07T09:00:00.000Z');
  return [
    {
      id: 'fixture-inbox-001',
      threadId: 'fixture-inbox-thread-001',
      rfcMessageId: '<lead-hot-001@example.com>',
      fromEmail: 'jane.buyer@example.com',
      fromName: 'Jane Buyer',
      toEmails: ['broker@example-realty.com'],
      ccEmails: [],
      subject: 'Ready to make an offer on 123 Peachtree St',
      bodyText:
        'Hi, we toured 123 Peachtree St and are ready to make an offer this week. ' +
        'We are pre-approved with our lender. Can you send next steps ASAP?',
      snippet: 'We toured 123 Peachtree St and are ready to make an offer this week.',
      references: [],
      inReplyTo: null,
      attachments: [],
      receivedAt: base,
      labels: ['INBOX', 'UNREAD'],
    },
    {
      id: 'fixture-inbox-002',
      threadId: 'fixture-inbox-thread-002',
      rfcMessageId: '<vendor-002@example.com>',
      fromEmail: 'invoice@titleco.example',
      fromName: 'Title Co',
      toEmails: ['broker@example-realty.com'],
      ccEmails: [],
      subject: 'Invoice #8821 — title services',
      bodyText: 'Attached is your invoice for title services. Amount due: $640. Net 30.',
      snippet: 'Attached is your invoice for title services. Amount due: $640.',
      references: [],
      inReplyTo: null,
      attachments: [],
      receivedAt: new Date(base.getTime() + 3600_000),
      labels: ['INBOX'],
    },
    {
      id: 'fixture-inbox-003',
      threadId: 'fixture-inbox-thread-003',
      rfcMessageId: '<urgent-003@example.com>',
      fromEmail: 'opsmanager@example-realty.com',
      fromName: 'Ops Manager',
      toEmails: ['broker@example-realty.com'],
      ccEmails: [],
      subject: 'URGENT: closing docs needed before EOD',
      bodyText:
        'We need the signed closing disclosure back before end of day or we lose the rate lock. Please review.',
      snippet: 'We need the signed closing disclosure back before end of day.',
      references: [],
      inReplyTo: null,
      attachments: [],
      receivedAt: new Date(base.getTime() + 7200_000),
      labels: ['INBOX', 'UNREAD'],
    },
  ];
}
