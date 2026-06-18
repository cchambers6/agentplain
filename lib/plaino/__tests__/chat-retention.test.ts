/**
 * Behavior tests for the chat-retention policy (pure functions, no DB).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  TIER_MAX_RETENTION_DAYS,
  isThreadExpired,
  maxRetentionDaysForTier,
  resolveChatRetentionDays,
  validateRetentionChoice,
} from '../chat-retention';

describe('resolveChatRetentionDays', () => {
  it('falls back to the session-scoped default when nothing is set', () => {
    assert.equal(resolveChatRetentionDays({ tier: 'regular' }), DEFAULT_RETENTION_DAYS);
  });

  it('honors a workspace opt-in override within the tier ceiling', () => {
    assert.equal(
      resolveChatRetentionDays({ tier: 'plus', workspaceOverrideDays: 45 }),
      45,
    );
  });

  it('clamps an override above the tier ceiling', () => {
    assert.equal(
      resolveChatRetentionDays({ tier: 'regular', workspaceOverrideDays: 9999 }),
      TIER_MAX_RETENTION_DAYS.regular,
    );
  });

  it('lets a per-thread override win over the workspace setting', () => {
    assert.equal(
      resolveChatRetentionDays({
        tier: 'max',
        workspaceOverrideDays: 30,
        threadOverrideDays: 200,
      }),
      200,
    );
  });

  it('never drops below the floor', () => {
    assert.equal(
      resolveChatRetentionDays({ tier: 'regular', workspaceOverrideDays: 0 }),
      MIN_RETENTION_DAYS,
    );
  });

  it('treats an unknown/null tier as the most conservative ceiling', () => {
    assert.equal(maxRetentionDaysForTier(null), TIER_MAX_RETENTION_DAYS.regular);
    assert.equal(maxRetentionDaysForTier('garbage'), TIER_MAX_RETENTION_DAYS.regular);
  });
});

describe('isThreadExpired', () => {
  const now = new Date('2026-06-18T00:00:00Z');
  it('is expired when last activity is older than the window', () => {
    const updatedAt = new Date('2026-06-10T00:00:00Z'); // 8 days ago
    assert.equal(isThreadExpired({ updatedAt, effectiveRetentionDays: 2, now }), true);
  });
  it('is not expired inside the window', () => {
    const updatedAt = new Date('2026-06-17T12:00:00Z'); // 12h ago
    assert.equal(isThreadExpired({ updatedAt, effectiveRetentionDays: 2, now }), false);
  });
});

describe('validateRetentionChoice', () => {
  it('clamps a too-large request and flags it', () => {
    const r = validateRetentionChoice({ requestedDays: 1000, tier: 'regular' });
    assert.equal(r.days, TIER_MAX_RETENTION_DAYS.regular);
    assert.equal(r.clamped, true);
  });
  it('accepts an in-range request', () => {
    const r = validateRetentionChoice({ requestedDays: 14, tier: 'plus' });
    assert.equal(r.days, 14);
    assert.equal(r.clamped, false);
  });
});
