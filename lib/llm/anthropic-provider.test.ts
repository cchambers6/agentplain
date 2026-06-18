/**
 * lib/llm/anthropic-provider.test.ts
 *
 * Pins the no-training commitment at the model seam: the only identifier we
 * attach to an Anthropic request is a PRIVACY-PRESERVING, one-way hash of the
 * workspace id — never the raw id, never customer PII, and absent entirely when
 * there's no workspace context.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { privacyPreservingUserId } from './anthropic-provider';

describe('privacyPreservingUserId', () => {
  it('is stable for the same workspace (so abuse can be correlated upstream)', () => {
    assert.equal(
      privacyPreservingUserId('ws-abc'),
      privacyPreservingUserId('ws-abc'),
    );
  });

  it('never returns the raw workspace id', () => {
    const id = privacyPreservingUserId('ws-abc');
    assert.notEqual(id, 'ws-abc');
    assert.equal(id?.includes('ws-abc'), false);
  });

  it('is a 64-char hex SHA-256 digest', () => {
    const id = privacyPreservingUserId('ws-abc');
    assert.match(id ?? '', /^[0-9a-f]{64}$/);
  });

  it('maps different workspaces to different hashes', () => {
    assert.notEqual(
      privacyPreservingUserId('ws-1'),
      privacyPreservingUserId('ws-2'),
    );
  });

  it('returns null when there is no workspace context', () => {
    assert.equal(privacyPreservingUserId(undefined), null);
    assert.equal(privacyPreservingUserId(null), null);
    assert.equal(privacyPreservingUserId(''), null);
  });
});
