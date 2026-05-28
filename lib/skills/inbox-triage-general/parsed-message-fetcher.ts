/**
 * lib/skills/inbox-triage-general/parsed-message-fetcher.ts
 *
 * Implementation of `TriageFetcher` that wraps the existing
 * `ParsedMessage[]` already loaded by the email skill chain
 * (`lib/skills/runner.ts → ReadSkill`). The webhook event sweep
 * (`process-webhook-event`) hands the messages it just resolved
 * (Gmail/Outlook-agnostic) to this fetcher, which adapts them to the
 * narrower `TriageMessage` shape the triage skill consumes.
 *
 * Why a separate fetcher class even though we already have the messages
 * in hand: per `feedback_runner_portability.md`'s two-implementation
 * rule + the skill's port-style design, the inbox-triage skill expects
 * a `TriageFetcher`. Wrapping the messages keeps the skill's
 * provider-neutral surface intact and gives tests a deterministic seam.
 *
 * Per `project_no_outbound_architecture.md`: no outbound — just a
 * shape adapter. The wrapped messages were ALREADY read by the chain;
 * triage doesn't re-fetch them.
 *
 * Per `feedback_cold_start_safe_agents.md`: the fetcher carries no
 * cross-call state — the messages are passed in at construction and
 * surfaced verbatim each call. Caller is responsible for fresh reads.
 */

import { skillError, skillOk, type SkillResult } from '../types';
import type { ParsedMessage } from '../types';
import type {
  TriageFetcher,
  TriageMessage,
  TriageSnapshot,
} from './types';

export interface ParsedMessageTriageFetcherConfig {
  workspaceId: string;
  messages: ParsedMessage[];
}

export class ParsedMessageTriageFetcher implements TriageFetcher {
  readonly name = 'parsed-messages' as const;
  private readonly workspaceId: string;
  private readonly messages: ParsedMessage[];

  constructor(config: ParsedMessageTriageFetcherConfig) {
    if (!config.workspaceId) {
      throw new Error('ParsedMessageTriageFetcher: workspaceId is required');
    }
    this.workspaceId = config.workspaceId;
    this.messages = config.messages;
  }

  async fetchSnapshot(args: {
    workspaceId: string;
    asOf: Date;
  }): Promise<SkillResult<TriageSnapshot>> {
    if (args.workspaceId !== this.workspaceId) {
      return skillError(
        'INVALID_INPUT',
        `ParsedMessageTriageFetcher workspaceId mismatch: bound=${this.workspaceId}, asked=${args.workspaceId}`,
      );
    }
    const inbox: TriageMessage[] = this.messages.map(toTriageMessage);
    return skillOk({ inbox });
  }
}

export function toTriageMessage(m: ParsedMessage): TriageMessage {
  return {
    id: m.id,
    threadId: m.threadId,
    fromEmail: m.fromEmail,
    fromName: m.fromName,
    subject: m.subject,
    bodyText: m.bodyText,
    receivedAt: m.receivedAt,
  };
}
