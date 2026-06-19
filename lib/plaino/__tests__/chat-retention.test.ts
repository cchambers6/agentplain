/**
 * Behavior tests for the chat-retention policy (pure functions, no DB).
 *
 * Default is the LIFETIME of the account (null window). Finite windows are an
 * opt-in auto-purge the customer chooses.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_RETENTION_DAYS,
  isThreadExpired,
  resolveChatRetentionDays,
  validateRetentionChoice,
} from '../chat-retention';

describe('resolveChatRetentionDays', () => {
  it('defaults to lifetime (null) when the customer set nothing', () => {
    assert.equal(resolveChatRetentionDays({}), null);
  });

  it('uses a workspace-wide opt-in window when set', () => {
    assert.equal(resolveChatRetentionDays({ workspaceOverrideDays: 90 }), 90);
  });

  it('lets a per-thread window win over the workspace window', () => {
    assert.equal(
      resolveChatRetentionDays({ workspaceOverrideDays: 90, threadOverrideDays: 30 }),
      30,
    );
  });

  it('floors a finite window at the minimum', () => {
    assert.equal(resolveChatRetentionDays({ workspaceOverrideDays: 0 }), MIN_RETENTION_DAYS);
  });
});

describe('isThreadExpired', () => {
  const now = new Date('2026-06-18T00:00:00Z');

  it('never expires under the default lifetime (null) window', () => {
    const updatedAt = new Date('2020-01-01T00:00:00Z'); // years old
    assert.equal(
      isThreadExpired({ updatedAt, effectiveRetentionDays: null, now }),
      false,
    );
  });

  it('expires when an opt-in window has elapsed', () => {
    const updatedAt = new Date('2026-03-01T00:00:00Z'); // >90d ago
    assert.equal(
      isThreadExpired({ updatedAt, effectiveRetentionDays: 90, now }),
      true,
    );
  });

  it('does not expire inside an opt-in window', () => {
    const updatedAt = new Date('2026-06-17T00:00:00Z'); // 1d ago
    assert.equal(
      isThreadExpired({ updatedAt, effectiveRetentionDays: 30, now }),
      false,
    );
  });
});

describe('validateRetentionChoice', () => {
  it('keeps null as lifetime', () => {
    assert.deepEqual(validateRetentionChoice({ requestedDays: null }), { days: null });
  });
  it('floors a finite request at the minimum', () => {
    assert.deepEqual(validateRetentionChoice({ requestedDays: 0 }), {
      days: MIN_RETENTION_DAYS,
    });
  });
  it('accepts a normal finite window', () => {
    assert.deepEqual(validateRetentionChoice({ requestedDays: 90 }), { days: 90 });
  });
});
