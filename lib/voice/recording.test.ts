import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TWO_PARTY_CONSENT_STATES,
  defaultRecordingPolicy,
  recordingConsentFingerprint,
  recordingExpiresAt,
  requiresTwoPartyPrompt,
  evaluateRecordingConsent,
  DEFAULT_RECORDING_RETENTION_DAYS,
  type VoiceRecordingConsentGate,
} from './recording';
import { mcpOk, mcpError } from '@/lib/integrations/mcp-core';

describe('recording consent policy', () => {
  it('flags two-party-consent states from either leg of the call', () => {
    assert.equal(requiresTwoPartyPrompt('CA', 'GA'), true); // caller in CA
    assert.equal(requiresTwoPartyPrompt('GA', 'fl'), true); // called in FL (case-insensitive)
    assert.equal(requiresTwoPartyPrompt('GA', 'TX'), false); // both one-party
    assert.equal(requiresTwoPartyPrompt(null, null), false);
  });

  it('includes the documented two-party states', () => {
    for (const s of ['CA', 'FL', 'IL', 'MD', 'MA', 'MT', 'NV', 'NH', 'PA', 'WA']) {
      assert.ok(TWO_PARTY_CONSENT_STATES.has(s), `${s} should be two-party`);
    }
  });

  it('computes retention expiry from the policy window', () => {
    const policy = defaultRecordingPolicy();
    assert.equal(policy.retentionDays, DEFAULT_RECORDING_RETENTION_DAYS);
    const base = 1_000_000_000_000;
    const exp = recordingExpiresAt(base, policy);
    assert.equal(exp.getTime(), base + DEFAULT_RECORDING_RETENTION_DAYS * 86_400_000);
  });

  it('fingerprint changes when the policy changes', () => {
    const fpA = recordingConsentFingerprint('ws1', { retentionDays: 90, requireTwoPartyConsentPrompt: true });
    const fpB = recordingConsentFingerprint('ws1', { retentionDays: 30, requireTwoPartyConsentPrompt: true });
    const fpC = recordingConsentFingerprint('ws2', { retentionDays: 90, requireTwoPartyConsentPrompt: true });
    assert.notEqual(fpA, fpB);
    assert.notEqual(fpA, fpC);
    // Stable for the same inputs.
    assert.equal(fpA, recordingConsentFingerprint('ws1', { retentionDays: 90, requireTwoPartyConsentPrompt: true }));
  });
});

describe('evaluateRecordingConsent (fail-safe)', () => {
  it('records when the gate returns an approved grant', async () => {
    const gate: VoiceRecordingConsentGate = {
      async check() {
        return mcpOk({
          pendingApprovalId: 'appr1',
          approvedByUserId: 'u1',
          approvedAt: '2026-06-17T00:00:00.000Z',
          expiresAt: '2027-06-17T00:00:00.000Z',
          policy: defaultRecordingPolicy(),
        });
      },
    };
    const r = await evaluateRecordingConsent({ workspaceId: 'ws1', policy: defaultRecordingPolicy(), gate });
    assert.equal(r.record, true);
    assert.equal(r.pendingApprovalId, 'appr1');
  });

  it('does NOT record when consent is pending (APPROVAL_REQUIRED)', async () => {
    const gate: VoiceRecordingConsentGate = {
      async check() {
        return mcpError('APPROVAL_REQUIRED', 'opt in first', { reference: 'pending1' });
      },
    };
    const r = await evaluateRecordingConsent({ workspaceId: 'ws1', policy: defaultRecordingPolicy(), gate });
    assert.equal(r.record, false);
    assert.equal(r.pendingApprovalId, 'pending1');
  });

  it('does NOT record when the gate throws (fail-safe)', async () => {
    const gate: VoiceRecordingConsentGate = {
      async check() {
        throw new Error('db down');
      },
    };
    const r = await evaluateRecordingConsent({ workspaceId: 'ws1', policy: defaultRecordingPolicy(), gate });
    assert.equal(r.record, false);
  });
});
