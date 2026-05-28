/**
 * lib/skills/process-doc-drafter-general/gmail-fetcher.ts
 *
 * Gmail-backed implementation of `ProcessDocFetcher`. Builds the
 * "past-actions" snapshot the skill clusters on by treating each
 * operator-sent message in the lookback window as one `PastAction`.
 *
 * Why each operator-sent message is a `PastAction`:
 *   - The skill's clustering key is `(kind, triggerHint)`. We derive
 *     `kind` from the subject's leading verb (`send-`, `book-`, etc.)
 *     and `triggerHint` from the subject's noun phrase. Recurring
 *     patterns surface naturally when the operator's outbound subjects
 *     repeat ("Deposit receipt — Jane", "Deposit receipt — Mark", …
 *     all cluster on `send::deposit-receipt`).
 *   - The skill's dedupe layer reads existing process-doc titles from
 *     `existingProcessDocs`. Today we have no published-SOP store on
 *     the customer side (the architecture says the operator copies
 *     drafts into THEIR docs), so this fetcher returns an empty list
 *     for `existingProcessDocs`. The skill's substring dedupe still
 *     suppresses near-duplicates from prior runs because the proposal
 *     title hashes the same pattern key.
 *
 * Adapter path (existing tools — no new MCP tools added):
 *   - `searchThreads({ query: 'in:sent newer_than:Nd' })` returns thread
 *     ids the operator has touched.
 *   - For each, `readResource({ uri: gmail://workspace/{ws}/threads/{id} })`
 *     returns the parsed messages.
 *   - The operator-authored messages are turned into `PastAction` rows;
 *     counterparty replies are ignored.
 *
 * Per `feedback_no_silent_vendor_lock.md`: imports the Gmail MCP
 * interface only.
 *
 * Per `feedback_cold_start_safe_agents.md`: no cache. Each call
 * re-resolves MCP server + credentials.
 *
 * Per `project_no_outbound_architecture.md`: read-only.
 *
 * Per `feedback_no_guesses_no_estimates.md`: when `operatorEmails` is
 * empty, the fetcher refuses to run rather than guess.
 */

import {
  buildGmailMcpServer,
  type FullMessage,
  type GmailMcpServer,
} from '@/lib/integrations/gmail-mcp';
import { skillError, skillOk, type SkillResult } from '../types';
import { parseThreadResource } from '../follow-up-chaser-general/gmail-fetcher';
import type {
  PastAction,
  ProcessDocFetcher,
  ProcessDocSnapshot,
} from './types';

export interface GmailProcessDocFetcherConfig {
  workspaceId: string;
  operatorEmails: ReadonlyArray<string>;
  server?: GmailMcpServer;
  maxThreads?: number;
}

const DEFAULT_MAX_THREADS = 100;

export class GmailProcessDocFetcher implements ProcessDocFetcher {
  readonly name = 'gmail-process-doc' as const;
  readonly provider = 'google' as const;
  private readonly workspaceId: string;
  private readonly server: GmailMcpServer;
  private readonly operatorEmails: ReadonlySet<string>;
  private readonly maxThreads: number;

  constructor(config: GmailProcessDocFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('GmailProcessDocFetcher: workspaceId is required');
    }
    if (!config.operatorEmails || config.operatorEmails.length === 0) {
      throw new Error(
        'GmailProcessDocFetcher: operatorEmails is required (we do not guess the operator address)',
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
  }): Promise<SkillResult<ProcessDocSnapshot>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `GmailProcessDocFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    if (args.lookbackDays <= 0) {
      return skillError(
        'INVALID_INPUT',
        `lookbackDays must be > 0; got ${args.lookbackDays}`,
      );
    }
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

    const pastActions: PastAction[] = [];
    for (const t of threads.value.threads) {
      if (!t.id) continue;
      const uri = `gmail://workspace/${this.workspaceId}/threads/${t.id}`;
      const resource = await this.server.readResource({ uri });
      if (!resource.ok) {
        if (resource.error.code === 'NOT_FOUND') continue;
        return skillError(
          'UPSTREAM_GMAIL_ERROR',
          `Gmail readResource (thread ${t.id}) failed: ${resource.error.message}`,
          resource.error.code,
        );
      }
      const parsed = parseThreadResource(resource.value.text);
      if (!parsed) continue;
      for (const msg of parsed.messages) {
        const action = buildPastActionFromMessage({
          message: msg,
          operatorEmails: this.operatorEmails,
        });
        if (action) pastActions.push(action);
      }
    }

    // existingProcessDocs is intentionally empty — see file-header
    // rationale. The skill's substring dedupe + per-run cap keep
    // re-emission noise bounded.
    return skillOk({ pastActions, existingProcessDocs: [] });
  }
}

interface BuildArgs {
  message: FullMessage;
  operatorEmails: ReadonlySet<string>;
}

/**
 * Turn one operator-authored message into a `PastAction`. Returns null
 * when the message was sent by the counterparty (skill clusters only
 * operator-driven patterns).
 *
 * `kind` derivation: take the first lowercase word of the subject,
 * stripping common reply prefixes. Maps "Deposit receipt — Jane" to
 * `send-deposit` (we hint `send-` because the message landed in
 * `in:sent`). The trigger hint is the remainder.
 *
 * Exposed for unit testing without an MCP server.
 */
export function buildPastActionFromMessage(args: BuildArgs): PastAction | null {
  const { message, operatorEmails } = args;
  if (!message.fromEmail) return null;
  if (!operatorEmails.has(message.fromEmail.toLowerCase())) return null;
  const cleanedSubject = (message.subject ?? '')
    .replace(/^(re|fwd):\s*/i, '')
    .trim();
  if (cleanedSubject.length === 0) return null;
  const { kind, triggerHint } = classifySubject(cleanedSubject);
  const bodySnippet = (message.bodyText ?? message.snippet ?? '').slice(0, 400);
  return {
    id: message.id,
    occurredAt: new Date(message.receivedAt),
    kind,
    triggerHint,
    subject: cleanedSubject,
    bodySnippet,
  };
}

/**
 * Pull a cluster key out of the subject. The skill clusters on
 * `(kind, triggerHint)`; the goal here is JUST enough determinism that
 * recurring subjects collapse to the same key.
 *
 * Heuristic:
 *   - kind is always `send` (the message lives in `in:sent`).
 *   - triggerHint is the first noun phrase in the subject — the first
 *     two words after any leading verb / preposition, lowercased, dash-
 *     joined.
 *
 * Examples:
 *   "Deposit receipt — Jane Smith" → kind=send, trigger=deposit-receipt
 *   "Welcome — onboarding for Acme" → kind=send, trigger=welcome
 *   "Quote for kitchen remodel" → kind=send, trigger=quote-kitchen
 */
function classifySubject(subject: string): {
  kind: string;
  triggerHint: string;
} {
  // Strip everything after an em-dash / colon / pipe — those split
  // "topic — recipient" subjects.
  const head = subject.split(/[—–|:]/)[0].trim();
  const words = head
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return { kind: 'send', triggerHint: 'misc' };
  // Skip leading prepositions / articles so "Quote for kitchen remodel"
  // hints `quote-kitchen` instead of `quote-for`.
  const SKIP = new Set(['for', 'about', 'on', 'the', 'a', 'an', 'to', 'with', 'of']);
  const significant: string[] = [];
  for (const w of words) {
    if (significant.length === 0) {
      significant.push(w);
      continue;
    }
    if (SKIP.has(w)) continue;
    significant.push(w);
    if (significant.length === 2) break;
  }
  return { kind: 'send', triggerHint: significant.join('-') };
}

export const __testing = {
  buildPastActionFromMessage,
  classifySubject,
};
