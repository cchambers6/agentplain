/**
 * lib/plaino/reply-card.test.ts
 *
 * Pins the card-attach rule + card-build seam:
 *   - shouldAttachCard: frequency rule (pure, no I/O)
 *   - messageHasCardIntent: intent detector (pure, no I/O)
 *   - buildReplyCard: assembles a valid NextStepsCard from the snapshot
 *     without any LLM or DB call
 *
 * All tests are deterministic — same input, same output, every time.
 * They exercise the three "when does the card attach" branches and the
 * marketing-mode guarantee (the function is not called in marketing mode;
 * we verify no card is produced when the snapshot + vertical are general).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldAttachCard,
  messageHasCardIntent,
  buildReplyCard,
} from './reply-card';
import { buildCapabilitySnapshotSync } from './capabilities';
import { parsePlainoCard } from './visual-card';
import type { MarketplaceProviderKey } from '../integrations/marketplace';

// ── shouldAttachCard ─────────────────────────────────────────────────────────

describe('shouldAttachCard — frequency rule', () => {
  it('attaches on the first reply (history empty)', () => {
    assert.equal(
      shouldAttachCard({ isFirstReply: true, hasCardIntent: false, isDegradedPlaceholder: false }),
      true,
    );
  });

  it('attaches when the customer message matches an onboarding/what-next intent', () => {
    assert.equal(
      shouldAttachCard({ isFirstReply: false, hasCardIntent: true, isDegradedPlaceholder: false }),
      true,
    );
  });

  it('attaches on a degraded placeholder (LLM offline) regardless of history', () => {
    assert.equal(
      shouldAttachCard({ isFirstReply: false, hasCardIntent: false, isDegradedPlaceholder: true }),
      true,
    );
  });

  it('does NOT attach on a regular ANSWER/REGISTER/INSTRUCT turn after the first', () => {
    assert.equal(
      shouldAttachCard({ isFirstReply: false, hasCardIntent: false, isDegradedPlaceholder: false }),
      false,
    );
  });

  it('attaches when both first-reply AND intent fire (belt + braces)', () => {
    assert.equal(
      shouldAttachCard({ isFirstReply: true, hasCardIntent: true, isDegradedPlaceholder: false }),
      true,
    );
  });
});

// ── messageHasCardIntent ─────────────────────────────────────────────────────

describe('messageHasCardIntent — intent detector', () => {
  // Positive cases
  const SHOULD_MATCH = [
    'what can you do?',
    'What do you do for a real estate brokerage?',
    "what can you help me with?",
    "what's next for me?",
    "What is next?",
    "what should I do next",
    "what do I do next after setting this up?",
    'how do I get started?',
    'help me get started',
    'getting started — where do I begin?',
    "I'm trying to onboard",
    "onboarding question",
    'set me up',
    'help me set up my workspace',
    'walk me through the setup',
    'show me what you can do',
    'killer workflow for realtors',
  ];

  for (const m of SHOULD_MATCH) {
    it(`matches "${m}"`, () => {
      assert.equal(messageHasCardIntent(m), true, `expected intent match for: ${m}`);
    });
  }

  // Negative cases — these are regular messages that should NOT trigger the card
  const SHOULD_NOT_MATCH = [
    'hello',
    'hi Plaino',
    'can you draft an email to Sandra?',
    'how do I disconnect Gmail?',
    'summarize the Atlanta listing',
    'thanks',
    'got it',
  ];

  for (const m of SHOULD_NOT_MATCH) {
    it(`does NOT match "${m}"`, () => {
      assert.equal(messageHasCardIntent(m), false, `expected no intent match for: ${m}`);
    });
  }
});

// ── buildReplyCard ───────────────────────────────────────────────────────────

describe('buildReplyCard — deterministic card assembly', () => {
  const WS = 'ws_reply_card_test';

  it('returns a valid NextStepsCard that passes parsePlainoCard', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set<MarketplaceProviderKey>(),
    });
    const card = buildReplyCard({
      workspaceId: WS,
      snapshot,
      vertical: 'REAL_ESTATE',
    });
    assert.equal(card.type, 'next-steps');
    assert.ok(Array.isArray(card.steps));
    assert.ok(card.steps.length > 0);

    // The card must pass parsePlainoCard (the same guard talk-view uses).
    const parsed = parsePlainoCard(card);
    assert.ok(parsed !== null, 'parsePlainoCard must accept the card');
    assert.equal(parsed!.type, 'next-steps');
  });

  it('leads with the killer workflow step in firstSession=true mode', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set<MarketplaceProviderKey>(),
    });
    const card = buildReplyCard({
      workspaceId: WS,
      snapshot,
      vertical: 'REAL_ESTATE',
      firstSession: true,
    });
    // The real-estate killer workflow is "Every lead gets a first touch
    // in 5 minutes" — leads the card.
    assert.ok(
      card.steps[0]!.label.startsWith('Every lead gets a first touch in 5 minutes'),
      `lead step should be the killer workflow; got: "${card.steps[0]!.label}"`,
    );
  });

  it('is pure — identical inputs produce identical cards', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set<MarketplaceProviderKey>(['FOLLOW_UP_BOSS']),
    });
    const args = { workspaceId: WS, snapshot, vertical: 'REAL_ESTATE' as const, firstSession: true };
    const a = buildReplyCard(args);
    const b = buildReplyCard(args);
    assert.deepEqual(a, b);
  });

  it('falls back to general workflow when vertical is null', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set<MarketplaceProviderKey>(),
    });
    const card = buildReplyCard({ workspaceId: WS, snapshot, vertical: null });
    // Should have at least one step with a real href inside the workspace.
    assert.ok(card.steps.length > 0);
    for (const step of card.steps) {
      assert.ok(
        step.href.startsWith(`/app/workspace/${WS}/`),
        `step href must stay in workspace: ${step.href}`,
      );
    }
  });

  it('every step deep-links inside the workspace (no outbound)', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set<MarketplaceProviderKey>(),
    });
    const card = buildReplyCard({
      workspaceId: WS,
      snapshot,
      vertical: 'CPA',
      firstSession: true,
    });
    for (const step of card.steps) {
      assert.ok(
        step.href.startsWith(`/app/workspace/${WS}/`),
        `step "${step.label}" must stay inside workspace; got href=${step.href}`,
      );
    }
  });
});
