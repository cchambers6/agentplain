/**
 * lib/skills/read.ts
 *
 * Step 1 of the value loop. Resolves a `WebhookEvent` row's Pub/Sub
 * envelope (emailAddress + historyId) into one or more `ParsedMessage`s
 * via a provider-neutral `MessageFetcher` port.
 *
 * Why a port: per `feedback_no_silent_vendor_lock.md`, googleapis lives
 * in `lib/integrations/google/`. The Read skill speaks the
 * `MessageFetcher` interface only — production wiring instantiates the
 * Gmail-API fetcher, test wiring instantiates `FixtureMessageFetcher`
 * with mock data.
 *
 * Why an entire skill for "fetch + parse": the WebhookEvent.rawPayload
 * only carries the historyId. Hydrating that to a parsed message is
 * non-trivial — it involves a `users.history.list` + `users.messages.get`
 * round trip + MIME parsing — and a downstream skill (categorize,
 * draft) should not know that. Keeping it behind the `ISkill` interface
 * gives the runner one place to retry, log, and time-box.
 */

import type { WebhookEvent } from '@prisma/client';
import {
  ISkill,
  MessageFetcher,
  ParsedMessage,
  SkillResult,
  skillError,
  skillOk,
} from './types';

export interface ReadSkillInput {
  event: WebhookEvent;
}

export interface ReadSkillOutput {
  /** The new message(s) introduced by this WebhookEvent. May be empty if
   *  the history range had no inbound messages (e.g. only label changes). */
  messages: ParsedMessage[];
  /** Sender + count summary for the runner log line. */
  summary: string;
}

export class ReadSkill implements ISkill<ReadSkillInput, ReadSkillOutput> {
  readonly name = 'read' as const;
  constructor(private readonly fetcher: MessageFetcher) {}

  async run(input: ReadSkillInput): Promise<SkillResult<ReadSkillOutput>> {
    if (!input.event) {
      return skillError('INVALID_INPUT', 'ReadSkill received no WebhookEvent');
    }
    const fetched = await this.fetcher.fetchMessagesForEvent(input.event);
    if (!fetched.ok) {
      return skillError(
        'UPSTREAM_GMAIL_ERROR',
        `MessageFetcher(${this.fetcher.name}) failed: ${fetched.error.message}`,
        fetched.error.code,
      );
    }
    const messages = fetched.value;
    return skillOk({
      messages,
      summary: summarize(messages),
    });
  }
}

function summarize(messages: ParsedMessage[]): string {
  if (messages.length === 0) return '0 messages';
  if (messages.length === 1) {
    const m = messages[0];
    return `1 message — from=${m.fromEmail} subject="${truncate(m.subject, 60)}"`;
  }
  return `${messages.length} messages — first from=${messages[0].fromEmail}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}
