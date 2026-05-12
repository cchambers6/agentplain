/**
 * tests/fixtures/webhook-events/_loader.ts
 *
 * Re-exports the WebhookEventFixture corpus. The corpus lives in
 * `_corpus.ts` as a single TS file so it benefits from the same type
 * checking the rest of the codebase enjoys — no risk of a fixture
 * silently drifting from the `WebhookEventFixture` shape and only
 * blowing up at runtime.
 *
 * Per the PR brief: "30+ realistic Gmail webhook events covering" —
 * verticals + noise + edge cases. The corpus exports exactly that;
 * see `_corpus.ts` for the manifest count and per-fixture grounding
 * (`expectedCategoryReason`).
 */

import { CORPUS } from './_corpus';
import type { WebhookEventFixture } from '@/lib/skills/fixture-fetcher';

export async function loadAllFixtures(): Promise<WebhookEventFixture[]> {
  // Stable order by id for deterministic test reporting.
  return [...CORPUS].sort((a, b) => a.id.localeCompare(b.id));
}
