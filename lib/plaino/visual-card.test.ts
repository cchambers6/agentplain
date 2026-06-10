/**
 * lib/plaino/visual-card.test.ts
 *
 * Unit tests for parsePlainoCard — the total (never-throws) parser that
 * defends the renderer from malformed / legacy message-metadata blobs.
 *
 * No DB, no network, no API keys required.
 *
 * Key invariants:
 *   - null/undefined/primitive inputs → null (degrade gracefully)
 *   - Unknown or missing type → null
 *   - Valid cards of each type are accepted and round-trip through the parser
 *   - Invalid sub-fields → null (card-level rejection)
 *   - Optional fields (queue, namedGap, connect, context) are preserved when valid
 *   - The pct field of onboarding-progress is clamped to 0–100
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parsePlainoCard } from './visual-card';
import type {
  NextStepsCard,
  CapabilityCard,
  WorkStatusCard,
  NavCard,
  BeforeAfterCard,
  DecisionTreeCard,
  CompliancePostureCard,
  OnboardingProgressCard,
} from './visual-card';

// ── Null / primitive guard ────────────────────────────────────────────────────

describe('parsePlainoCard — null/primitive guard', () => {
  it('returns null for null', () => {
    assert.equal(parsePlainoCard(null), null);
  });

  it('returns null for undefined', () => {
    assert.equal(parsePlainoCard(undefined), null);
  });

  it('returns null for a string', () => {
    assert.equal(parsePlainoCard('next-steps'), null);
  });

  it('returns null for a number', () => {
    assert.equal(parsePlainoCard(42), null);
  });

  it('returns null for an empty object (no type)', () => {
    assert.equal(parsePlainoCard({}), null);
  });

  it('returns null for an object with an unknown type', () => {
    assert.equal(parsePlainoCard({ type: 'unknown-card-v99' }), null);
  });

  it('returns null for an object with a numeric type', () => {
    assert.equal(parsePlainoCard({ type: 42 }), null);
  });
});

// ── next-steps ────────────────────────────────────────────────────────────────

describe('parsePlainoCard — next-steps', () => {
  const validStep = { label: 'Review drafts', href: '/approvals', weight: 'primary' };

  it('accepts a minimal valid next-steps card', () => {
    const card = parsePlainoCard({ type: 'next-steps', steps: [validStep] }) as NextStepsCard | null;
    assert.ok(card !== null);
    assert.equal(card.type, 'next-steps');
    assert.equal(card.steps.length, 1);
    assert.equal(card.steps[0].label, 'Review drafts');
    assert.equal(card.steps[0].weight, 'primary');
  });

  it('returns null when steps is absent', () => {
    assert.equal(parsePlainoCard({ type: 'next-steps' }), null);
  });

  it('returns null when steps is not an array', () => {
    assert.equal(parsePlainoCard({ type: 'next-steps', steps: 'not-an-array' }), null);
  });

  it('returns null when steps array is empty', () => {
    assert.equal(parsePlainoCard({ type: 'next-steps', steps: [] }), null);
  });

  it('filters out invalid steps (missing weight)', () => {
    const badStep = { label: 'bad', href: '/x' }; // missing weight
    const goodStep = validStep;
    const card = parsePlainoCard({ type: 'next-steps', steps: [badStep, goodStep] }) as NextStepsCard | null;
    assert.ok(card !== null);
    assert.equal(card.steps.length, 1, 'invalid step was filtered out');
  });

  it('returns null when all steps are invalid', () => {
    assert.equal(
      parsePlainoCard({ type: 'next-steps', steps: [{ label: 'bad' }] }),
      null,
    );
  });

  it('includes optional queue when valid', () => {
    const queue = { drafts: 3, flags: 1, oldestAgeHrs: 48 };
    const card = parsePlainoCard({
      type: 'next-steps',
      steps: [validStep],
      queue,
    }) as NextStepsCard | null;
    assert.ok(card !== null);
    assert.deepEqual(card.queue, queue);
  });

  it('omits queue when queue has wrong types', () => {
    const card = parsePlainoCard({
      type: 'next-steps',
      steps: [validStep],
      queue: { drafts: 'three', flags: 1, oldestAgeHrs: 48 }, // drafts is string
    }) as NextStepsCard | null;
    assert.ok(card !== null);
    assert.equal(card.queue, undefined);
  });
});

// ── capability ────────────────────────────────────────────────────────────────

describe('parsePlainoCard — capability', () => {
  it('accepts a "yes" verdict', () => {
    const card = parsePlainoCard({
      type: 'capability',
      verdict: 'yes',
      detail: 'Yes, I can do that.',
    }) as CapabilityCard | null;
    assert.ok(card !== null);
    assert.equal(card.verdict, 'yes');
    assert.equal(card.detail, 'Yes, I can do that.');
  });

  it('accepts "not-yet" and "roadmap" verdicts', () => {
    for (const verdict of ['not-yet', 'roadmap'] as const) {
      const card = parsePlainoCard({ type: 'capability', verdict, detail: 'detail' }) as CapabilityCard | null;
      assert.ok(card !== null, `verdict ${verdict} should be accepted`);
      assert.equal(card.verdict, verdict);
    }
  });

  it('returns null for an invalid verdict', () => {
    assert.equal(
      parsePlainoCard({ type: 'capability', verdict: 'maybe', detail: 'detail' }),
      null,
    );
  });

  it('returns null when detail is missing', () => {
    assert.equal(
      parsePlainoCard({ type: 'capability', verdict: 'yes' }),
      null,
    );
  });

  it('includes optional namedGap when it is a string', () => {
    const card = parsePlainoCard({
      type: 'capability',
      verdict: 'not-yet',
      detail: 'We need QuickBooks connected.',
      namedGap: 'quickbooks-integration',
    }) as CapabilityCard | null;
    assert.ok(card !== null);
    assert.equal(card.namedGap, 'quickbooks-integration');
  });

  it('includes optional connect CTA when valid', () => {
    const connect = { integrationId: 'gmail', label: 'Gmail', href: '/marketplace/gmail' };
    const card = parsePlainoCard({
      type: 'capability',
      verdict: 'not-yet',
      detail: 'Connect Gmail first.',
      connect,
    }) as CapabilityCard | null;
    assert.ok(card !== null);
    assert.deepEqual(card.connect, connect);
  });

  it('omits connect CTA when it is missing a required field', () => {
    const card = parsePlainoCard({
      type: 'capability',
      verdict: 'yes',
      detail: 'detail',
      connect: { integrationId: 'slack', label: 'Slack' }, // missing href
    }) as CapabilityCard | null;
    assert.ok(card !== null);
    assert.equal(card.connect, undefined);
  });
});

// ── work-status ───────────────────────────────────────────────────────────────

describe('parsePlainoCard — work-status', () => {
  it('accepts a valid work-status card', () => {
    const card = parsePlainoCard({
      type: 'work-status',
      state: 'drafting',
      approvalId: 'approval-abc',
      discipline: 'legal',
    }) as WorkStatusCard | null;
    assert.ok(card !== null);
    assert.equal(card.state, 'drafting');
    assert.equal(card.approvalId, 'approval-abc');
    assert.equal(card.discipline, 'legal');
  });

  it('accepts all three valid states', () => {
    for (const state of ['drafting', 'awaiting-review', 'approved'] as const) {
      const card = parsePlainoCard({
        type: 'work-status',
        state,
        approvalId: 'id-1',
      }) as WorkStatusCard | null;
      assert.ok(card !== null, `state ${state} should be accepted`);
    }
  });

  it('returns null for an invalid state', () => {
    assert.equal(
      parsePlainoCard({ type: 'work-status', state: 'pending', approvalId: 'id-1' }),
      null,
    );
  });

  it('returns null when approvalId is missing', () => {
    assert.equal(
      parsePlainoCard({ type: 'work-status', state: 'drafting' }),
      null,
    );
  });

  it('sets discipline to null when absent', () => {
    const card = parsePlainoCard({
      type: 'work-status',
      state: 'approved',
      approvalId: 'id-2',
    }) as WorkStatusCard | null;
    assert.ok(card !== null);
    assert.equal(card.discipline, null);
  });
});

// ── nav ───────────────────────────────────────────────────────────────────────

describe('parsePlainoCard — nav', () => {
  it('accepts a valid nav card', () => {
    const card = parsePlainoCard({
      type: 'nav',
      destinations: [
        { label: 'Approvals', href: '/approvals' },
        { label: 'Marketplace', href: '/marketplace' },
      ],
    }) as NavCard | null;
    assert.ok(card !== null);
    assert.equal(card.destinations.length, 2);
  });

  it('returns null when destinations is empty', () => {
    assert.equal(parsePlainoCard({ type: 'nav', destinations: [] }), null);
  });

  it('returns null when destinations is not an array', () => {
    assert.equal(parsePlainoCard({ type: 'nav', destinations: 'string' }), null);
  });

  it('filters out destinations missing href or label', () => {
    const card = parsePlainoCard({
      type: 'nav',
      destinations: [
        { label: 'Good', href: '/good' },
        { label: 'Bad' }, // missing href
      ],
    }) as NavCard | null;
    assert.ok(card !== null);
    assert.equal(card.destinations.length, 1);
  });
});

// ── before-after ──────────────────────────────────────────────────────────────

describe('parsePlainoCard — before-after', () => {
  const validRow = { task: 'Invoice chasing', before: 'Manual, 2h/week', after: 'Auto-drafted' };

  it('accepts a valid before-after card', () => {
    const card = parsePlainoCard({
      type: 'before-after',
      rows: [validRow],
    }) as BeforeAfterCard | null;
    assert.ok(card !== null);
    assert.equal(card.rows.length, 1);
    assert.equal(card.rows[0].task, 'Invoice chasing');
  });

  it('includes optional context when a string', () => {
    const card = parsePlainoCard({
      type: 'before-after',
      rows: [validRow],
      context: 'for a property manager',
    }) as BeforeAfterCard | null;
    assert.ok(card !== null);
    assert.equal(card.context, 'for a property manager');
  });

  it('returns null when rows is empty', () => {
    assert.equal(parsePlainoCard({ type: 'before-after', rows: [] }), null);
  });

  it('filters out rows missing any required field', () => {
    const incompleteRow = { task: 'X', before: 'old' }; // missing after
    const card = parsePlainoCard({
      type: 'before-after',
      rows: [incompleteRow, validRow],
    }) as BeforeAfterCard | null;
    assert.ok(card !== null);
    assert.equal(card.rows.length, 1);
  });
});

// ── decision-tree ─────────────────────────────────────────────────────────────

describe('parsePlainoCard — decision-tree', () => {
  const validBranch = { condition: 'I have a team', outcome: 'Scheduling', href: '/schedule' };

  it('accepts a valid decision-tree card', () => {
    const card = parsePlainoCard({
      type: 'decision-tree',
      question: 'What is most urgent?',
      branches: [validBranch],
    }) as DecisionTreeCard | null;
    assert.ok(card !== null);
    assert.equal(card.question, 'What is most urgent?');
    assert.equal(card.branches.length, 1);
  });

  it('returns null when question is missing', () => {
    assert.equal(
      parsePlainoCard({ type: 'decision-tree', branches: [validBranch] }),
      null,
    );
  });

  it('returns null when branches is empty', () => {
    assert.equal(
      parsePlainoCard({ type: 'decision-tree', question: 'Q?', branches: [] }),
      null,
    );
  });
});

// ── compliance-posture ────────────────────────────────────────────────────────

describe('parsePlainoCard — compliance-posture', () => {
  const validCard = {
    type: 'compliance-posture',
    vertical: 'real-estate',
    coverageAreas: [{ label: 'Fair Housing', covered: true }],
    recentFlags: 2,
    openFlags: 1,
    complianceHref: '/compliance',
  };

  it('accepts a valid compliance-posture card', () => {
    const card = parsePlainoCard(validCard) as CompliancePostureCard | null;
    assert.ok(card !== null);
    assert.equal(card.vertical, 'real-estate');
    assert.equal(card.recentFlags, 2);
    assert.equal(card.coverageAreas.length, 1);
  });

  it('returns null when recentFlags is a string', () => {
    assert.equal(
      parsePlainoCard({ ...validCard, recentFlags: 'two' }),
      null,
    );
  });

  it('returns null when vertical is absent', () => {
    const { vertical: _, ...rest } = validCard;
    assert.equal(parsePlainoCard(rest), null);
  });

  it('filters out coverage areas with missing fields', () => {
    const card = parsePlainoCard({
      ...validCard,
      coverageAreas: [
        { label: 'Good', covered: true },
        { label: 'Bad' }, // missing covered
      ],
    }) as CompliancePostureCard | null;
    assert.ok(card !== null);
    assert.equal(card.coverageAreas.length, 1);
  });
});

// ── onboarding-progress ───────────────────────────────────────────────────────

describe('parsePlainoCard — onboarding-progress', () => {
  const milestone = { label: 'Pick vertical', done: true, href: '/onboarding/vertical' };

  it('accepts a valid onboarding-progress card', () => {
    const card = parsePlainoCard({
      type: 'onboarding-progress',
      pct: 50,
      milestones: [milestone],
    }) as OnboardingProgressCard | null;
    assert.ok(card !== null);
    assert.equal(card.pct, 50);
    assert.equal(card.milestones.length, 1);
  });

  it('clamps pct above 100 to 100', () => {
    const card = parsePlainoCard({
      type: 'onboarding-progress',
      pct: 150,
      milestones: [],
    }) as OnboardingProgressCard | null;
    assert.ok(card !== null);
    assert.equal(card.pct, 100);
  });

  it('clamps pct below 0 to 0', () => {
    const card = parsePlainoCard({
      type: 'onboarding-progress',
      pct: -10,
      milestones: [],
    }) as OnboardingProgressCard | null;
    assert.ok(card !== null);
    assert.equal(card.pct, 0);
  });

  it('rounds fractional pct', () => {
    const card = parsePlainoCard({
      type: 'onboarding-progress',
      pct: 33.7,
      milestones: [],
    }) as OnboardingProgressCard | null;
    assert.ok(card !== null);
    assert.equal(card.pct, 34);
  });

  it('returns null when pct is not a number', () => {
    assert.equal(
      parsePlainoCard({ type: 'onboarding-progress', pct: '50', milestones: [] }),
      null,
    );
  });

  it('accepts empty milestones array', () => {
    const card = parsePlainoCard({
      type: 'onboarding-progress',
      pct: 0,
      milestones: [],
    }) as OnboardingProgressCard | null;
    assert.ok(card !== null);
    assert.equal(card.milestones.length, 0);
  });

  it('filters out milestones missing required fields', () => {
    const badMilestone = { label: 'Oops', done: true }; // missing href
    const card = parsePlainoCard({
      type: 'onboarding-progress',
      pct: 25,
      milestones: [badMilestone, milestone],
    }) as OnboardingProgressCard | null;
    assert.ok(card !== null);
    assert.equal(card.milestones.length, 1);
  });
});
