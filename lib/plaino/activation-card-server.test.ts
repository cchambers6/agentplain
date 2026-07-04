/**
 * activation-card-server — the deterministic, no-LLM seam that turns durable
 * workspace state into the first-session activation card. These tests prove:
 *   - the card LEADS with the vertical's killer workflow in the first session
 *   - the lead branches correctly on connected vs unconnected providers
 *   - it is pure (same input → same output), with zero LLM/DB dependency
 *   - the additive setup-gap steps still follow the killer-workflow lead
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildActivationCardFromConnectedProviders,
  buildActivationCardFromState,
} from './activation-card-server';
import { buildCapabilitySnapshotSync } from './capabilities';
import { killerWorkflowFor } from './killer-workflow';
import type { MarketplaceProviderKey } from '../integrations/marketplace';
import type { NextStepsOnboardingState } from './next-steps';

const WS = 'ws_activation_test';

const FRESH_ONBOARDING: NextStepsOnboardingState = {
  verticalPicked: true,
  firstToolConnected: false,
  scheduleWindowSet: false,
  firstDraftReviewed: false,
};

describe('buildActivationCardFromConnectedProviders — first-session lead', () => {
  it('leads with the real-estate killer workflow as the single primary step', () => {
    const card = buildActivationCardFromConnectedProviders({
      workspaceId: WS,
      vertical: 'REAL_ESTATE',
      firstSession: true,
      connectedProviders: new Set<MarketplaceProviderKey>(),
      onboarding: FRESH_ONBOARDING,
    });

    assert.equal(card.type, 'next-steps');
    const primary = card.steps.filter((s) => s.weight === 'primary');
    assert.equal(primary.length, 1, 'exactly one primary step');
    const spec = killerWorkflowFor('REAL_ESTATE');
    // Unconnected → the named-gap connect CTA leading with the headline.
    assert.ok(
      card.steps[0]!.label.startsWith(spec.headline),
      'lead step leads with the locked headline promise',
    );
    assert.match(card.steps[0]!.label, /connect Follow Up Boss/);
    assert.equal(
      card.steps[0]!.href,
      `/app/workspace/${WS}/integrations/follow-up-boss`,
      'connect CTA deep-links into the workspace connect surface only',
    );
  });

  it('switches the lead to "see it run" once the unlocking provider is connected', () => {
    const card = buildActivationCardFromConnectedProviders({
      workspaceId: WS,
      vertical: 'REAL_ESTATE',
      firstSession: true,
      connectedProviders: new Set<MarketplaceProviderKey>(['FOLLOW_UP_BOSS']),
      onboarding: { ...FRESH_ONBOARDING, firstToolConnected: true },
    });
    assert.match(card.steps[0]!.label, /see it run$/);
    assert.equal(
      card.steps[0]!.href,
      `/app/workspace/${WS}/approvals`,
      'connected lead deep-links to where the workflow lands',
    );
  });

  it('falls back to the general workflow when the vertical is not picked', () => {
    const card = buildActivationCardFromConnectedProviders({
      workspaceId: WS,
      vertical: null,
      firstSession: true,
      connectedProviders: new Set<MarketplaceProviderKey>(),
      onboarding: { ...FRESH_ONBOARDING, verticalPicked: false },
    });
    const general = killerWorkflowFor(null);
    assert.ok(card.steps[0]!.label.startsWith(general.headline));
  });

  it('every step deep-links into the workspace (no outbound, no external href)', () => {
    const card = buildActivationCardFromConnectedProviders({
      workspaceId: WS,
      vertical: 'CPA',
      firstSession: true,
      connectedProviders: new Set<MarketplaceProviderKey>(),
      onboarding: FRESH_ONBOARDING,
    });
    for (const step of card.steps) {
      assert.ok(
        step.href.startsWith(`/app/workspace/${WS}/`),
        `step "${step.label}" stays inside the workspace`,
      );
    }
  });

  it('drops the killer-workflow lead once onboarding is complete (firstSession=false)', () => {
    const card = buildActivationCardFromConnectedProviders({
      workspaceId: WS,
      vertical: 'REAL_ESTATE',
      firstSession: false,
      connectedProviders: new Set<MarketplaceProviderKey>(),
      onboarding: {
        verticalPicked: true,
        firstToolConnected: true,
        scheduleWindowSet: true,
        firstDraftReviewed: true,
      },
    });
    const spec = killerWorkflowFor('REAL_ESTATE');
    assert.ok(
      !card.steps.some((s) => s.label.startsWith(spec.headline)),
      'no killer-workflow lead outside the first session',
    );
  });

  it('is pure — identical inputs produce identical cards', () => {
    const args = {
      workspaceId: WS,
      vertical: 'HOME_SERVICES' as const,
      firstSession: true,
      connectedProviders: new Set<MarketplaceProviderKey>(),
      onboarding: FRESH_ONBOARDING,
    };
    const a = buildActivationCardFromConnectedProviders(args);
    const b = buildActivationCardFromConnectedProviders(args);
    assert.deepEqual(a, b);
  });
});

describe('buildActivationCardFromState — snapshot pass-through', () => {
  it('accepts an already-built snapshot without re-reading the connected set', () => {
    // Fixture uses PM/QuickBooks (a customer-connectable unlock). The
    // previous fixture was CPA/TaxDome — retired 2026-07-03 when TaxDome
    // went `coming-soon` with providerKey null (audit-5 P0-1): a snapshot
    // can no longer represent a TAXDOME connection, which is the honest
    // state until its connect form ships.
    const snapshot = buildCapabilitySnapshotSync({
      connectedProviders: new Set<MarketplaceProviderKey>(['QUICKBOOKS']),
    });
    const card = buildActivationCardFromState({
      workspaceId: WS,
      vertical: 'PROPERTY_MANAGEMENT',
      snapshot,
      firstSession: true,
      onboarding: { ...FRESH_ONBOARDING, firstToolConnected: true },
    });
    // QuickBooks connected → PM workflow leads with "see it run".
    assert.match(card.steps[0]!.label, /see it run$/);
  });
});
