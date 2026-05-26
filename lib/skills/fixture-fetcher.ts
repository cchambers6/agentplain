/**
 * lib/skills/fixture-fetcher.ts
 *
 * Second implementation of `MessageFetcher` — reads Gmail messages from
 * a fixture object instead of from the Gmail API. Used by:
 *
 *   - `tests/skills-loop-e2e.test.ts` to exercise the full chain
 *     against the mock corpus in `tests/fixtures/webhook-events/`.
 *   - The dev console + future operator tools that want to replay a
 *     captured WebhookEvent without round-tripping Gmail.
 *
 * Per `feedback_runner_portability.md`: this is the second
 * implementation behind the `MessageFetcher` interface. The first is
 * the Gmail-API fetcher in `lib/skills/gmail-fetcher.ts`. Two-impl rule
 * satisfied.
 *
 * Per `project_no_outbound_architecture.md`: this fetcher is read-only.
 */

import type { WebhookEvent } from '@prisma/client';
import {
  MessageFetcher,
  ParsedMessage,
  SkillResult,
  skillError,
  skillOk,
} from './types';

/**
 * One mock WebhookEvent + the Gmail state needed to drive the skill
 * chain. Persisted as JSON in `tests/fixtures/webhook-events/*.json`.
 * The fixture loader rebuilds a `WebhookEvent` row in memory + this
 * fetcher serves the messages on demand.
 */
export interface WebhookEventFixture {
  /** Fixture id — also the filename without the `.json` suffix. */
  id: string;
  /** Vertical the workspace is configured to. Drives the prompt selection. */
  verticalSlug: string;
  /** Description of the scenario the fixture exercises. */
  description: string;
  /** Citation for *why* this is the expected category — points at the
   *  vertical-prompt rule that justifies it (per `feedback_no_guesses_no_estimates`). */
  expectedCategoryReason: string;
  /** Expected category — asserted by `tests/skills-loop-e2e.test.ts`. */
  expectedCategory:
    | 'transactional'
    | 'vendor'
    | 'lead'
    | 'scheduling-needed'
    | 'draft-needed'
    | 'noise';
  /** Optional: when the message should ALSO categorize differently for
   *  another vertical, the test cross-checks this divergence. */
  divergentFor?: Array<{ verticalSlug: string; expectedCategory: WebhookEventFixture['expectedCategory'] }>;
  /** WebhookEvent envelope — what the receiver wrote. */
  webhookEvent: {
    id: string;
    subscriptionId: string;
    rawPayload: {
      emailAddress: string;
      historyId: string;
    };
    receivedAt: string; // ISO
  };
  /** The new message(s) the historyId would map to in Gmail. The Read
   *  skill consumes these as if Gmail returned them. */
  messages: ParsedMessageFixture[];
  /** Other messages already in the same thread(s). Coordinate skill
   *  pulls these. Keyed by threadId. */
  thread?: Record<string, ParsedMessageFixture[]>;
}

/**
 * JSON-friendly variant of `ParsedMessage` — `receivedAt` is an ISO
 * string instead of a Date so the fixture survives `JSON.stringify`
 * cleanly. The fixture loader hydrates Date objects.
 */
export interface ParsedMessageFixture extends Omit<ParsedMessage, 'receivedAt'> {
  receivedAt: string;
}

export class FixtureMessageFetcher implements MessageFetcher {
  readonly name = 'fixture' as const;
  constructor(private readonly fixture: WebhookEventFixture) {}

  async fetchMessagesForEvent(
    event: WebhookEvent,
  ): Promise<SkillResult<ParsedMessage[]>> {
    if (event.id !== this.fixture.webhookEvent.id) {
      return skillError(
        'INVALID_INPUT',
        `FixtureMessageFetcher seeded with event ${this.fixture.webhookEvent.id}, received ${event.id}`,
      );
    }
    return skillOk(this.fixture.messages.map(hydrateMessage));
  }

  async fetchThreadMessages(
    threadId: string,
  ): Promise<SkillResult<ParsedMessage[]>> {
    const prior = this.fixture.thread?.[threadId] ?? [];
    return skillOk(prior.map(hydrateMessage));
  }
}

export function hydrateMessage(m: ParsedMessageFixture): ParsedMessage {
  return {
    ...m,
    receivedAt: new Date(m.receivedAt),
  };
}

export function buildWebhookEventFromFixture(fixture: WebhookEventFixture): WebhookEvent {
  // Fabricate a Prisma-shaped row in memory. The runner never writes
  // back to a fixture-backed event so we don't need stable behaviour
  // beyond what the read/categorize/etc. skills inspect.
  return {
    id: fixture.webhookEvent.id,
    subscriptionId: fixture.webhookEvent.subscriptionId,
    // Denormalized workspaceId on WebhookEvent (added in
    // 20260526000000_add_integration_rls). Fixture-backed events never hit
    // the real RLS policy, so a synthetic placeholder satisfies the row
    // shape without needing a fixture-managed workspace.
    workspaceId: `wkspace-${fixture.id}`,
    rawPayload: fixture.webhookEvent.rawPayload,
    receivedAt: new Date(fixture.webhookEvent.receivedAt),
    processed: false,
    processedAt: null,
    error: null,
    // Idempotency + retry columns (added in WebhookEvent migration
    // 20260524000000). Fixture-backed events bypass the real drain
    // consumer, so these defaults are inert — they exist only so the
    // Prisma row shape matches.
    dedupeKey: null,
    attemptCount: 0,
    nextAttemptAt: null,
    deadlettered: false,
  } as WebhookEvent;
}
