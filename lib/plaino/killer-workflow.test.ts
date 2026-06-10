/**
 * lib/plaino/killer-workflow.test.ts
 *
 * Pins the killer-workflow ACTIVATION step + its lead into the next-steps
 * card. The step is the activation outcome: a brand-new workspace sees its
 * vertical's killer workflow within the first 10 minutes — connected → "see
 * it run", not-connected → the named gap + the one connect CTA that unlocks
 * it.
 *
 * Pure builders, no DB, no LLM (the key is paused — these are deterministic).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { Vertical } from '@prisma/client';
import type { MarketplaceProviderKey } from '../integrations/marketplace';
import {
  buildKillerWorkflowStep,
  connectedProvidersFromSnapshot,
  killerWorkflowFor,
} from './killer-workflow';
import {
  buildActivationCard,
  buildNextSteps,
  buildNextStepsCard,
} from './next-steps';
import { buildCapabilitySnapshotSync } from './capabilities';
import { parsePlainoCard } from './visual-card';
import type { PlainoCapabilitySnapshot } from './types';

const WORKSPACE_ID = 'ws-killer-0001';

function noProviders(): ReadonlySet<MarketplaceProviderKey> {
  return new Set<MarketplaceProviderKey>();
}

function withProviders(
  ...keys: MarketplaceProviderKey[]
): ReadonlySet<MarketplaceProviderKey> {
  return new Set(keys);
}

const EMPTY_SNAPSHOT: PlainoCapabilitySnapshot = {
  disciplines: [],
  connectedIntegrations: [],
  availableButUnconnected: [],
  comingSoon: [],
};

// ── the canonical promises, locked ──────────────────────────────────────

describe('killerWorkflowFor — canonical promises', () => {
  const cases: Array<[Vertical | null, string]> = [
    [null, 'Wake up to chased invoices'],
    ['REAL_ESTATE', 'Every lead gets a first touch in 5 minutes'],
    ['CPA', 'Month-end close assembles itself'],
    ['HOME_SERVICES', 'No estimate dies unanswered'],
    ['LAW', 'Never take a conflicted client'],
    ['INSURANCE', 'COI in 4 minutes'],
    ['MORTGAGE', 'The file chases itself'],
    ['PROPERTY_MANAGEMENT', 'Rent collects itself politely'],
    ['TITLE_ESCROW', 'No closing slips on a missing doc'],
    ['RIA', 'Quarterly client letters in one tap'],
  ];

  for (const [vertical, headline] of cases) {
    it(`${vertical ?? 'general'} → "${headline}"`, () => {
      assert.equal(killerWorkflowFor(vertical).headline, headline);
    });
  }

  it('an unknown vertical falls back to the general workflow', () => {
    // RECRUITING has no mandate workflow — it should still resolve to a
    // concrete promise, never throw or return undefined.
    assert.equal(
      killerWorkflowFor('RECRUITING').headline,
      'Wake up to chased invoices',
    );
  });
});

// ── connected vs not-connected branches ─────────────────────────────────

describe('buildKillerWorkflowStep — generative connect CTA', () => {
  it('not-connected realty → connect CTA into Follow Up Boss', () => {
    const step = buildKillerWorkflowStep({
      workspaceId: WORKSPACE_ID,
      vertical: 'REAL_ESTATE',
      connectedProviders: noProviders(),
    });
    assert.equal(step.weight, 'primary');
    assert.ok(
      step.label.startsWith('Every lead gets a first touch in 5 minutes'),
      'leads with the headline promise',
    );
    assert.match(step.label, /connect Follow Up Boss/);
    assert.equal(
      step.href,
      `/app/workspace/${WORKSPACE_ID}/integrations/follow-up-boss`,
      'deep-links to exactly the integration that unlocks it',
    );
    assert.ok(step.why && step.why.length > 0, 'names the gap');
  });

  it('connected realty → "see it run" into the workspace', () => {
    const step = buildKillerWorkflowStep({
      workspaceId: WORKSPACE_ID,
      vertical: 'REAL_ESTATE',
      connectedProviders: withProviders('FOLLOW_UP_BOSS'),
    });
    assert.equal(step.weight, 'primary');
    assert.match(step.label, /see it run/);
    assert.equal(
      step.href,
      `/app/workspace/${WORKSPACE_ID}/approvals`,
      'lands where the workflow drafts land',
    );
  });

  it('home-services unlocks on QuickBooks', () => {
    const off = buildKillerWorkflowStep({
      workspaceId: WORKSPACE_ID,
      vertical: 'HOME_SERVICES',
      connectedProviders: noProviders(),
    });
    assert.match(off.label, /No estimate dies unanswered — connect QuickBooks/);
    const on = buildKillerWorkflowStep({
      workspaceId: WORKSPACE_ID,
      vertical: 'HOME_SERVICES',
      connectedProviders: withProviders('QUICKBOOKS'),
    });
    assert.match(on.label, /see it run/);
  });

  it('law needs no integration — but still routes the CTA somewhere real', () => {
    // LAW.unlockedBy is null; the step must still produce a real deep-link
    // (never a dead tile) and lead with the promise.
    const step = buildKillerWorkflowStep({
      workspaceId: WORKSPACE_ID,
      vertical: 'LAW',
      connectedProviders: noProviders(),
    });
    assert.ok(step.label.startsWith('Never take a conflicted client'));
    assert.ok(step.href.startsWith(`/app/workspace/${WORKSPACE_ID}/integrations/`));
  });

  it('null vertical (not yet picked) leads with the general workflow', () => {
    const step = buildKillerWorkflowStep({
      workspaceId: WORKSPACE_ID,
      vertical: null,
      connectedProviders: noProviders(),
    });
    assert.ok(step.label.startsWith('Wake up to chased invoices'));
  });

  it('never uses the banned "SMB" term in customer-facing copy', () => {
    const verticals: Array<Vertical | null> = [
      null,
      'REAL_ESTATE',
      'CPA',
      'HOME_SERVICES',
      'LAW',
      'INSURANCE',
      'MORTGAGE',
      'PROPERTY_MANAGEMENT',
      'TITLE_ESCROW',
      'RIA',
    ];
    for (const v of verticals) {
      for (const connected of [noProviders(), withProviders('QUICKBOOKS', 'FOLLOW_UP_BOSS', 'TAXDOME', 'GOOGLE')]) {
        const step = buildKillerWorkflowStep({
          workspaceId: WORKSPACE_ID,
          vertical: v,
          connectedProviders: connected,
        });
        const text = `${step.label} ${step.why ?? ''}`;
        assert.doesNotMatch(text, /\bSMB\b/, `"${text}" must not say SMB`);
      }
    }
  });
});

// ── the lead into the next-steps card ───────────────────────────────────

describe('buildNextSteps — killer-workflow lead', () => {
  const onboarding = {
    verticalPicked: true,
    firstToolConnected: false,
    scheduleWindowSet: false,
    firstDraftReviewed: false,
  };

  it('leads the card with the killer workflow during the first session', () => {
    const steps = buildNextSteps({
      workspaceId: WORKSPACE_ID,
      snapshot: EMPTY_SNAPSHOT,
      onboarding,
      approvals: { draftsWaiting: 0, oldestAgeHrs: 0 },
      compliance: { openFlags: 0 },
      activation: {
        lead: true,
        vertical: 'REAL_ESTATE',
        connectedProviders: noProviders(),
      },
    });
    assert.ok(steps.length >= 1);
    assert.equal(steps[0].weight, 'primary', 'exactly the killer step is primary');
    assert.ok(
      steps[0].label.startsWith('Every lead gets a first touch in 5 minutes'),
      'the killer workflow leads, not a generic checklist',
    );
    // Exactly one primary across the whole card.
    assert.equal(steps.filter((s) => s.weight === 'primary').length, 1);
  });

  it('omitting activation keeps the legacy setup-gaps-first behaviour', () => {
    const steps = buildNextSteps({
      workspaceId: WORKSPACE_ID,
      snapshot: EMPTY_SNAPSHOT,
      onboarding,
      approvals: { draftsWaiting: 0, oldestAgeHrs: 0 },
      compliance: { openFlags: 0 },
    });
    // No killer headline — the first step is the legacy setup gap.
    assert.doesNotMatch(steps[0].label, /first touch in 5 minutes/);
  });

  it('the card with a killer lead round-trips through parsePlainoCard', () => {
    const card = buildNextStepsCard({
      workspaceId: WORKSPACE_ID,
      snapshot: EMPTY_SNAPSHOT,
      onboarding,
      approvals: { draftsWaiting: 2, oldestAgeHrs: 26 },
      compliance: { openFlags: 0 },
      activation: {
        lead: true,
        vertical: 'CPA',
        connectedProviders: noProviders(),
      },
    });
    // The persisted metadata path validates the card on the way out.
    const parsed = parsePlainoCard(card);
    assert.ok(parsed, 'card validates as a PlainoCard');
    assert.equal(parsed?.type, 'next-steps');
    assert.ok(card.steps[0].label.startsWith('Month-end close assembles itself'));
    // The queue glance still attaches when there are drafts waiting.
    assert.ok(card.queue, 'queue glance attached alongside the killer lead');
  });
});

// ── provider derivation + the production assembler ──────────────────────

describe('connectedProvidersFromSnapshot', () => {
  it('maps connected tile ids back to provider keys', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: withProviders('FOLLOW_UP_BOSS', 'QUICKBOOKS'),
    });
    const derived = connectedProvidersFromSnapshot(snapshot);
    assert.ok(derived.has('FOLLOW_UP_BOSS'));
    assert.ok(derived.has('QUICKBOOKS'));
    assert.ok(!derived.has('TAXDOME'));
  });
});

describe('buildActivationCard — production seam', () => {
  const onboarding = {
    verticalPicked: true,
    firstToolConnected: true,
    scheduleWindowSet: true,
    firstDraftReviewed: false,
  };

  it('first session + connected unlocker → live "see it run" lead', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: withProviders('FOLLOW_UP_BOSS'),
    });
    const card = buildActivationCard({
      workspaceId: WORKSPACE_ID,
      vertical: 'REAL_ESTATE',
      snapshot,
      onboarding,
      approvals: { draftsWaiting: 0, oldestAgeHrs: 0 },
      compliance: { openFlags: 0 },
      firstSession: true,
    });
    assert.match(card.steps[0].label, /Every lead gets a first touch in 5 minutes — see it run/);
    assert.equal(card.steps[0].weight, 'primary');
  });

  it('first session + not connected → generative connect CTA lead', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: noProviders(),
    });
    const card = buildActivationCard({
      workspaceId: WORKSPACE_ID,
      vertical: 'REAL_ESTATE',
      snapshot,
      onboarding,
      approvals: { draftsWaiting: 0, oldestAgeHrs: 0 },
      compliance: { openFlags: 0 },
      firstSession: true,
    });
    assert.match(card.steps[0].label, /connect Follow Up Boss/);
    assert.equal(
      card.steps[0].href,
      `/app/workspace/${WORKSPACE_ID}/integrations/follow-up-boss`,
    );
  });

  it('past the first session → no killer lead', () => {
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: noProviders(),
    });
    const card = buildActivationCard({
      workspaceId: WORKSPACE_ID,
      vertical: 'REAL_ESTATE',
      snapshot,
      onboarding,
      approvals: { draftsWaiting: 0, oldestAgeHrs: 0 },
      compliance: { openFlags: 0 },
      firstSession: false,
    });
    assert.doesNotMatch(card.steps[0].label, /first touch in 5 minutes/);
  });
});
