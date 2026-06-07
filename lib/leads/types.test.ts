/**
 * lib/leads/types.test.ts
 *
 * Pins the lead-capture validation: email required + normalized, intent
 * required, optional fields optional, conversationId must be a uuid.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { leadCaptureSchema } from './types';

describe('leadCaptureSchema', () => {
  it('accepts a minimal valid lead (email + intent)', () => {
    const parsed = leadCaptureSchema.safeParse({
      email: 'Owner@Business.com',
      intent: 'wants a demo',
    });
    assert.ok(parsed.success);
    // email is lowercased + trimmed.
    assert.equal(parsed.data.email, 'owner@business.com');
  });

  it('accepts the full optional set', () => {
    const parsed = leadCaptureSchema.safeParse({
      email: 'a@b.com',
      name: 'Dana',
      business: 'Dana Realty',
      vertical: 'real-estate',
      intent: 'trial for 5 agents',
      sourcePage: '/pricing',
      conversationId: '11111111-1111-4111-8111-111111111111',
    });
    assert.ok(parsed.success);
  });

  it('rejects a bad email', () => {
    const parsed = leadCaptureSchema.safeParse({
      email: 'not-an-email',
      intent: 'x',
    });
    assert.ok(!parsed.success);
  });

  it('rejects a missing intent', () => {
    const parsed = leadCaptureSchema.safeParse({ email: 'a@b.com', intent: '' });
    assert.ok(!parsed.success);
  });

  it('rejects a non-uuid conversationId', () => {
    const parsed = leadCaptureSchema.safeParse({
      email: 'a@b.com',
      intent: 'x',
      conversationId: 'nope',
    });
    assert.ok(!parsed.success);
  });
});
