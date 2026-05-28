/**
 * lib/skills/follow-up-chaser-general/gmail-fetcher.ts
 *
 * Gmail-backed implementation of `FollowUpFetcher`. Walks the OPERATOR's
 * sent threads from the last `lookbackDays` window and emits
 * `OutboundThread` records the skill clusters on stale-window logic.
 *
 * The skill needs three slices per thread:
 *   1. When the OPERATOR last sent (`operatorLastSentAt` — the "since"
 *      we measure stale-window against).
 *   2. When the COUNTERPARTY last replied (`counterpartyLastRepliedAt` —
 *      newer-than-operator-send means we skip; null means we nudge).
 *   3. A snippet of what the operator wrote, so the nudge draft can
 *      quote enough context for the recipient to remember the thread.
 *
 * Resolution path — uses the EXISTING Gmail MCP tool surface (no new
 * tools on the server; the searchThreads + readResource pair already
 * exposes everything the skill needs):
 *
 *   - `searchThreads({ query: 'in:sent newer_than:Nd' })` returns the
 *     thread ids the operator has touched in the lookback window. Gmail
 *     scopes `in:sent` to the operator's mailbox, so by construction
 *     every thread returned has at least one operator send.
 *   - For each thread, `readResource({ uri: 'gmail://workspace/{ws}/
 *     threads/{id}' })` returns the parsed messages. The adapter walks
 *     them to pick the last operator-sent message and the last
 *     counterparty-sent message, derived from `fromEmail` ↔ the
 *     operator's own address(es).
 *
 * Per `feedback_no_silent_vendor_lock.md`: this file imports the Gmail
 * MCP interface only. Direct `googleapis` calls live in `lib/
 * integrations/google/` + `lib/integrations/gmail-mcp/server.ts`.
 *
 * Per `feedback_cold_start_safe_agents.md`: re-resolves the MCP server
 * on every call; the server itself re-resolves the credential. No
 * in-memory cache.
 *
 * Per `project_no_outbound_architecture.md`: read-only. The fetcher
 * never sends. The skill writes drafts; the customer's mailbox sends.
 *
 * Per `feedback_no_guesses_no_estimates.md`: when the operator's own
 * address isn't resolvable (`Mail.Read` returns no `me` profile or the
 * adapter can't infer it), the fetcher returns `INVALID_INPUT` rather
 * than guessing — the cron treats that as a skip, not a silent miss.
 */

import {
  buildGmailMcpServer,
  type FullMessage,
  type GmailMcpServer,
} from '@/lib/integrations/gmail-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import type { FollowUpFetcher, FollowUpSnapshot, OutboundThread } from './types';

export interface GmailFollowUpFetcherConfig {
  workspaceId: string;
  /** Set of email addresses recognized as "the operator's own mailbox".
   *  Lowercased. Required — we don't guess. Typical resolution path:
   *  the cron looks up the workspace's connected Google credential's
   *  account email and passes it here. */
  operatorEmails: ReadonlyArray<string>;
  /** Pre-built MCP server — tests inject the deterministic test impl. */
  server?: GmailMcpServer;
  /** Maximum number of threads pulled from `searchThreads`. Defaults to
   *  100 — Gmail caps per-call results at 100 anyway. */
  maxThreads?: number;
}

const DEFAULT_MAX_THREADS = 100;

export class GmailFollowUpFetcher implements FollowUpFetcher {
  readonly name = 'gmail-follow-up' as const;
  readonly provider = 'google' as const;
  private readonly workspaceId: string;
  private readonly server: GmailMcpServer;
  private readonly operatorEmails: ReadonlySet<string>;
  private readonly maxThreads: number;

  constructor(config: GmailFollowUpFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('GmailFollowUpFetcher: workspaceId is required');
    }
    if (!config.operatorEmails || config.operatorEmails.length === 0) {
      throw new Error(
        'GmailFollowUpFetcher: operatorEmails is required (we do not guess the operator address)',
      );
    }
    this.workspaceId = config.workspaceId;
    this.server =
      config.server ?? buildGmailMcpServer({ workspaceId: config.workspaceId });
    this.operatorEmails = new Set(
      config.operatorEmails.map((e) => e.trim().toLowerCase()),
    );
    this.maxThreads = config.maxThreads ?? DEFAULT_MAX_THREADS;
  }

  async fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
    lookbackDays: number;
  }): Promise<SkillResult<FollowUpSnapshot>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `GmailFollowUpFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    if (args.lookbackDays <= 0) {
      return skillError(
        'INVALID_INPUT',
        `lookbackDays must be > 0; got ${args.lookbackDays}`,
      );
    }
    // `in:sent` scopes to the operator's mailbox; `newer_than:Nd` bounds
    // the window. Gmail's query grammar accepts both literally.
    const query = `in:sent newer_than:${args.lookbackDays}d`;
    const threads = await this.server.searchThreads({
      query,
      maxResults: this.maxThreads,
    });
    if (!threads.ok) {
      if (threads.error.code === 'CREDENTIAL_NOT_FOUND') {
        return skillError(
          'NOT_CONFIGURED',
          `Gmail credential not connected for workspace ${this.workspaceId}.`,
          threads.error.code,
        );
      }
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `Gmail searchThreads failed: ${threads.error.message}`,
        threads.error.code,
      );
    }

    const outbound: OutboundThread[] = [];
    for (const t of threads.value.threads) {
      if (!t.id) continue;
      const uri = `gmail://workspace/${this.workspaceId}/threads/${t.id}`;
      const resource = await this.server.readResource({ uri });
      if (!resource.ok) {
        // One missing thread should not crater the sweep — skip it.
        if (resource.error.code === 'NOT_FOUND') continue;
        return skillError(
          'UPSTREAM_GMAIL_ERROR',
          `Gmail readResource (thread ${t.id}) failed: ${resource.error.message}`,
          resource.error.code,
        );
      }
      const parsed = parseThreadResource(resource.value.text);
      if (!parsed) {
        // Parse error on one thread is non-fatal — skip rather than
        // halt the run; future fetches will re-encounter it cleanly.
        continue;
      }
      const thread = buildOutboundThreadFromMessages({
        threadId: parsed.id ?? t.id,
        messages: parsed.messages,
        operatorEmails: this.operatorEmails,
      });
      if (thread) outbound.push(thread);
    }
    return skillOk({ outbound });
  }
}

interface ParsedThreadResource {
  id: string | null;
  messages: FullMessage[];
}

export function parseThreadResource(text: string): ParsedThreadResource | null {
  try {
    const body = JSON.parse(text) as {
      id?: unknown;
      messages?: unknown;
    };
    const id = typeof body.id === 'string' ? body.id : null;
    if (!Array.isArray(body.messages)) return null;
    return { id, messages: body.messages as FullMessage[] };
  } catch {
    return null;
  }
}

interface BuildArgs {
  threadId: string;
  messages: FullMessage[];
  operatorEmails: ReadonlySet<string>;
}

export function buildOutboundThreadFromMessages(
  args: BuildArgs,
): OutboundThread | null {
  const { threadId, messages, operatorEmails } = args;
  if (messages.length === 0) return null;

  // Walk once: bucket by who sent. Latest of each bucket is what we need.
  let lastOperator: FullMessage | null = null;
  let lastCounterparty: FullMessage | null = null;
  const counterpartySet = new Set<string>();
  let counterpartyName: string | null = null;
  for (const m of messages) {
    if (!m.fromEmail) continue;
    const isOperator = operatorEmails.has(m.fromEmail.toLowerCase());
    if (isOperator) {
      if (
        !lastOperator ||
        new Date(m.receivedAt).getTime() >
          new Date(lastOperator.receivedAt).getTime()
      ) {
        lastOperator = m;
      }
      // Operator's `toEmails` are the counterparty side of the thread.
      for (const to of m.toEmails ?? []) {
        const lowered = to.toLowerCase();
        if (!operatorEmails.has(lowered)) counterpartySet.add(lowered);
      }
    } else {
      if (
        !lastCounterparty ||
        new Date(m.receivedAt).getTime() >
          new Date(lastCounterparty.receivedAt).getTime()
      ) {
        lastCounterparty = m;
      }
      if (!counterpartyName) counterpartyName = m.fromName ?? null;
      counterpartySet.add(m.fromEmail.toLowerCase());
    }
  }
  if (!lastOperator) return null;

  // Subject — prefer the operator-most-recent subject so the nudge label
  // matches what the recipient saw last.
  const subject = lastOperator.subject ?? '(no subject)';
  const operatorLastBodySnippet = (lastOperator.bodyText ?? lastOperator.snippet ?? '')
    .slice(0, 400);

  return {
    threadId,
    subject,
    counterpartyEmails: Array.from(counterpartySet),
    counterpartyName,
    operatorLastSentAt: new Date(lastOperator.receivedAt),
    counterpartyLastRepliedAt: lastCounterparty
      ? new Date(lastCounterparty.receivedAt)
      : null,
    operatorLastBodySnippet,
  };
}

export const __testing = {
  buildOutboundThreadFromMessages,
  parseThreadResource,
};
