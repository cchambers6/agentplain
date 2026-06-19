/**
 * lib/integrations/byo/byo.test.ts
 *
 * Customer-Brought framework: scope grants, rotation reminders, auth-state
 * derivation, and revocation planning. Pure-function tests, node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getMarketplaceEntry } from '../marketplace';
import {
  defaultScopeLevel,
  effectiveScopeLevel,
  naturalCeiling,
  offerableScopeLevels,
  requiresApproval,
  scopeLevelAllows,
} from './scope-grants';
import {
  ROTATION_INTERVAL_DAYS,
  rotationReminderFor,
  rotationRemindersDue,
  needsRotationReminder,
} from './rotation';
import { connectionStateFor, needsAttention } from './auth-state';
import { planRevocation } from './revocation';
import type { ByoCredentialView, ByoScopeGrant } from './types';

const NOW = new Date('2026-06-17T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function credView(over: Partial<ByoCredentialView> = {}): ByoCredentialView {
  return {
    provider: 'FOLLOW_UP_BOSS',
    accountEmail: 'agent@brokerage.com',
    status: 'ACTIVE',
    expiresAt: new Date('2099-12-31T00:00:00.000Z'),
    createdAt: NOW,
    lastRefreshedAt: null,
    ...over,
  };
}

describe('scope grants — capability lattice', () => {
  it('read-only permits read, denies write + outbound', () => {
    assert.equal(scopeLevelAllows('read-only', 'read'), true);
    assert.equal(scopeLevelAllows('read-only', 'write'), false);
    assert.equal(scopeLevelAllows('read-only', 'outbound'), false);
  });

  it('read-write and write-with-approval permit all action classes', () => {
    for (const level of ['read-write', 'write-with-approval'] as const) {
      assert.equal(scopeLevelAllows(level, 'read'), true);
      assert.equal(scopeLevelAllows(level, 'write'), true);
      assert.equal(scopeLevelAllows(level, 'outbound'), true);
    }
  });

  it('only write-with-approval forces the approval queue', () => {
    assert.equal(requiresApproval('write-with-approval'), true);
    assert.equal(requiresApproval('read-write'), false);
    assert.equal(requiresApproval('read-only'), false);
  });

  it('a non-critical connector (Slack) DEFAULTS to read-only but may be granted up to its write ceiling', () => {
    const slack = getMarketplaceEntry('slack');
    assert.ok(slack);
    // Non-critical → safe low default…
    assert.equal(defaultScopeLevel(slack), 'read-only');
    // …but Slack declares chat:write, so the customer CAN raise it.
    assert.equal(naturalCeiling(slack), 'write-with-approval');
  });

  it('a read-only-scoped connector (PayPal: openid + transactions.read) ceilings to read-only', () => {
    const paypal = getMarketplaceEntry('paypal');
    assert.ok(paypal);
    assert.equal(defaultScopeLevel(paypal), 'read-only');
    assert.equal(naturalCeiling(paypal), 'read-only');
  });

  it('a mutating connector (HubSpot) defaults to the safe write-with-approval ceiling', () => {
    const hubspot = getMarketplaceEntry('hubspot');
    assert.ok(hubspot);
    assert.equal(defaultScopeLevel(hubspot), 'write-with-approval');
    assert.equal(naturalCeiling(hubspot), 'write-with-approval');
  });

  it('a grant cannot exceed the connector natural ceiling', () => {
    // PayPal is read-only by scopes — a stale write grant clamps down to read.
    const paypal = getMarketplaceEntry('paypal');
    assert.ok(paypal);
    const paypalOverreach: ByoScopeGrant = {
      integrationId: 'paypal',
      level: 'write-with-approval',
      grantedByUserId: 'u1',
      grantedAt: NOW,
    };
    assert.equal(effectiveScopeLevel(paypal, paypalOverreach), 'read-only');

    // Notion declares page:write, so the same grant is honored up to the ceiling.
    const notion = getMarketplaceEntry('notion');
    assert.ok(notion);
    const notionGrant: ByoScopeGrant = { ...paypalOverreach, integrationId: 'notion' };
    assert.equal(effectiveScopeLevel(notion, notionGrant), 'write-with-approval');
  });

  it('offerableScopeLevels excludes levels above the ceiling', () => {
    const paypal = getMarketplaceEntry('paypal');
    assert.ok(paypal);
    assert.deepEqual(offerableScopeLevels(paypal), ['read-only']);
    const hubspot = getMarketplaceEntry('hubspot');
    assert.ok(hubspot);
    assert.deepEqual(offerableScopeLevels(hubspot), [
      'read-only',
      'read-write',
      'write-with-approval',
    ]);
  });
});

describe('rotation reminders — API keys only, 90-day cadence', () => {
  it('OAuth connectors never need rotation reminders', () => {
    assert.equal(needsRotationReminder('gmail'), false);
    assert.equal(needsRotationReminder('hubspot'), false);
  });

  it('API-key connectors do need rotation reminders', () => {
    assert.equal(needsRotationReminder('follow-up-boss'), true);
    assert.equal(needsRotationReminder('sierra'), true);
    assert.equal(needsRotationReminder('buildium'), true);
  });

  it('a fresh API key is ok, not due', () => {
    const r = rotationReminderFor('follow-up-boss', credView({ createdAt: NOW }), NOW);
    assert.ok(r);
    assert.equal(r.status, 'ok');
    assert.equal(r.dueInDays, ROTATION_INTERVAL_DAYS);
  });

  it('a key 80 days old is due-soon (inside the 14-day warn window)', () => {
    const created = new Date(NOW.getTime() - 80 * DAY);
    const r = rotationReminderFor('follow-up-boss', credView({ createdAt: created }), NOW);
    assert.ok(r);
    assert.equal(r.ageDays, 80);
    assert.equal(r.dueInDays, 10);
    assert.equal(r.status, 'due-soon');
  });

  it('a key 100 days old is overdue', () => {
    const created = new Date(NOW.getTime() - 100 * DAY);
    const r = rotationReminderFor('sierra', credView({ provider: 'SIERRA_INTERACTIVE', createdAt: created }), NOW);
    assert.ok(r);
    assert.equal(r.status, 'overdue');
    assert.equal(r.dueInDays, -10);
  });

  it('lastRefreshedAt resets the rotation clock', () => {
    const created = new Date(NOW.getTime() - 200 * DAY);
    const refreshed = new Date(NOW.getTime() - 5 * DAY);
    const r = rotationReminderFor(
      'follow-up-boss',
      credView({ createdAt: created, lastRefreshedAt: refreshed }),
      NOW,
    );
    assert.ok(r);
    assert.equal(r.ageDays, 5);
    assert.equal(r.status, 'ok');
  });

  it('rotationRemindersDue returns only due/overdue ACTIVE keys, most-overdue first', () => {
    const due = rotationRemindersDue(
      [
        { integrationId: 'gmail', cred: credView({ provider: 'GOOGLE' }) }, // OAuth → skip
        { integrationId: 'follow-up-boss', cred: credView({ createdAt: new Date(NOW.getTime() - 85 * DAY) }) }, // due-soon
        { integrationId: 'sierra', cred: credView({ provider: 'SIERRA_INTERACTIVE', createdAt: new Date(NOW.getTime() - 120 * DAY) }) }, // overdue
        { integrationId: 'buildium', cred: credView({ provider: 'BUILDIUM', status: 'REVOKED', createdAt: new Date(NOW.getTime() - 300 * DAY) }) }, // revoked → skip
      ],
      NOW,
    );
    assert.equal(due.length, 2);
    assert.equal(due[0].integrationId, 'sierra'); // most overdue first
    assert.equal(due[1].integrationId, 'follow-up-boss');
  });
});

describe('auth-state — health derived from status + clock', () => {
  it('no credential → not-connected', () => {
    assert.equal(connectionStateFor(null, NOW), 'not-connected');
  });

  it('explicit terminal statuses map straight through', () => {
    assert.equal(connectionStateFor(credView({ status: 'REVOKED' }), NOW), 'revoked');
    assert.equal(connectionStateFor(credView({ status: 'ERROR' }), NOW), 'error');
    assert.equal(connectionStateFor(credView({ status: 'EXPIRED' }), NOW), 'expired');
  });

  it('ACTIVE but token already past expiry → expired (row lags the token)', () => {
    const cred = credView({ expiresAt: new Date(NOW.getTime() - DAY) });
    assert.equal(connectionStateFor(cred, NOW), 'expired');
  });

  it('ACTIVE with token expiring inside 24h → expiring', () => {
    const cred = credView({ expiresAt: new Date(NOW.getTime() + 3 * 60 * 60 * 1000) });
    assert.equal(connectionStateFor(cred, NOW), 'expiring');
  });

  it('ACTIVE healthy → connected', () => {
    assert.equal(connectionStateFor(credView(), NOW), 'connected');
  });

  it('needsAttention flags only the actionable states', () => {
    assert.equal(needsAttention('expired'), true);
    assert.equal(needsAttention('revoked'), true);
    assert.equal(needsAttention('error'), true);
    assert.equal(needsAttention('connected'), false);
    assert.equal(needsAttention('expiring'), false);
  });
});

describe('revocation plan', () => {
  it('a critical connector pauses its workflow; the plan keeps the audit trail', () => {
    const plan = planRevocation('hubspot');
    assert.ok(plan);
    assert.equal(plan.provider, 'HUBSPOT');
    assert.ok(plan.removes.some((r) => r.includes('access grant')));
    assert.ok(plan.removes.some((r) => r.includes('workflow')));
    assert.ok(plan.retains.some((r) => r.includes('audit trail')));
  });

  it('a non-critical connector only stops notifications', () => {
    const plan = planRevocation('slack');
    assert.ok(plan);
    assert.ok(plan.removes.some((r) => r.toLowerCase().includes('notification')));
  });

  it('unknown / coming-soon connectors have no plan', () => {
    assert.equal(planRevocation('does-not-exist'), null);
    assert.equal(planRevocation('kvcore'), null); // coming-soon, providerKey null
  });
});
