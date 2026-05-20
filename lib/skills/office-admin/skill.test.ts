/**
 * lib/skills/office-admin/skill.test.ts
 *
 * Coverage for the office-admin skill:
 *
 *   1. Signal extraction — codes, URLs, expires-at, service name,
 *      amount. Deterministic regex-based extraction. Pure functions.
 *   2. Screen — empty signal list short-circuits the LLM call;
 *      non-empty signal list classifies via LLM.
 *   3. Category → approval-kind mapping — 9 categories collapse to 5
 *      approval kinds per the locked map.
 *   4. Classifier integration — synthetic fixtures (Stripe receipt,
 *      Microsoft trial-end, suspicious-login alert, etc.) land in the
 *      right category via the TestLlmProvider heuristic.
 *   5. Approval payload composer — drafts populated for categories
 *      that should have a draft (billing, trial); null for the rest.
 *   6. Confidence floor — sub-threshold classifications demote to
 *      `not-admin` so real leads never leak into the admin queue.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the test runs against the
 * TestLlmProvider heuristic — no Anthropic SDK call.
 *
 * Per `feedback_no_guesses_no_estimates.md`: each assertion cites the
 * fixture's `expectedReason` or the screen pattern that justifies it.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TestLlmProvider } from '../../llm/test-provider';
import { llmOk } from '../../llm/types';
import type { LlmProvider } from '../../llm/types';
import { classifyOfficeAdmin } from './classifier';
import { OFFICE_ADMIN_FIXTURES, getFixture } from './fixtures';
import { screenForAdminSignal } from './screen';
import {
  extractAdminSignals,
  extractAmount,
  extractExpiresAt,
  extractPrimaryUrl,
  extractServiceName,
  extractVerificationCode,
} from './signals';
import { buildAdminApprovalPayload, asActionableAdminClassification } from './actions';
import {
  OFFICE_ADMIN_CATEGORY_CONFIG,
  OFFICE_ADMIN_MIN_CONFIDENCE,
  categoryToApprovalKind,
  categoryToCardTitle,
  categoryToPriority,
  OFFICE_ADMIN_CATEGORIES,
} from './types';

// ── 1. Signal extraction ────────────────────────────────────────────────

describe('signals — extractVerificationCode', () => {
  it('pulls a labeled code with "your code is"', () => {
    assert.equal(
      extractVerificationCode('Your Google verification code is 482915. Do not share.'),
      '482915',
    );
  });

  it('pulls a labeled code with "code:"', () => {
    assert.equal(
      extractVerificationCode('Sign-in code: 7392'),
      '7392',
    );
  });

  it('pulls a standalone 6-digit code on its own line', () => {
    assert.equal(
      extractVerificationCode('Here is your code.\n\n482915\n\nIt expires in 10 min.'),
      '482915',
    );
  });

  it('ignores embedded digit runs (phone numbers, case ids)', () => {
    assert.equal(extractVerificationCode('Call us at 404-555-1234.'), null);
    assert.equal(extractVerificationCode('Case 2026-CV-1187 is on the docket.'), null);
  });
});

describe('signals — extractPrimaryUrl', () => {
  it('returns the first https URL', () => {
    assert.equal(
      extractPrimaryUrl('Reset link: https://github.com/password_reset/abc and ignore https://example.com'),
      'https://github.com/password_reset/abc',
    );
  });

  it('strips trailing punctuation', () => {
    assert.equal(
      extractPrimaryUrl('Visit https://stripe.com/verify.'),
      'https://stripe.com/verify',
    );
  });

  it('returns null when no URL is present', () => {
    assert.equal(extractPrimaryUrl('Just plain text here.'), null);
  });
});

describe('signals — extractExpiresAt', () => {
  it('resolves relative "in N days" against receivedAt', () => {
    const iso = extractExpiresAt(
      'Your trial ends in 3 days. Cancel before May 22.',
      new Date('2026-05-19T00:00:00.000Z'),
    );
    assert.equal(iso, '2026-05-22T00:00:00.000Z');
  });

  it('resolves ISO dates', () => {
    const iso = extractExpiresAt('Maintenance window 2026-05-25 02:00 UTC.', new Date('2026-05-19'));
    assert.ok(iso?.startsWith('2026-05-25'));
  });

  it('resolves "Month Day, Year"', () => {
    const iso = extractExpiresAt('Charge runs on May 22, 2026.', new Date('2026-05-19'));
    assert.equal(iso, '2026-05-22T00:00:00.000Z');
  });

  it('returns null when no date is present', () => {
    assert.equal(extractExpiresAt('No dates here.', new Date()), null);
  });
});

describe('signals — extractServiceName', () => {
  it('uses display name when present and non-generic', () => {
    const m = baseMessage({ fromName: 'Stripe', fromEmail: 'no-reply@stripe.com' });
    assert.equal(extractServiceName(m), 'Stripe');
  });

  it('falls back to domain root when display name is generic', () => {
    const m = baseMessage({ fromName: 'Notifications', fromEmail: 'no-reply@accounts.google.com' });
    const name = extractServiceName(m);
    assert.ok(name && /google/i.test(name), `expected Google-ish name, got ${name}`);
  });

  it('strips trailing role tokens (Support, Team, Notifications)', () => {
    const m = baseMessage({ fromName: 'Microsoft account team', fromEmail: 'a@microsoft.com' });
    assert.equal(extractServiceName(m), 'Microsoft account');
  });
});

describe('signals — extractAmount', () => {
  it('pulls a USD dollar amount', () => {
    assert.equal(extractAmount('Amount paid: $20.00 USD'), '$20.00');
  });

  it('pulls a comma-formatted amount', () => {
    assert.equal(extractAmount('Outstanding balance: $1,250.50'), '$1,250.50');
  });

  it('returns null when no amount present', () => {
    assert.equal(extractAmount('No money here'), null);
  });
});

describe('signals — extractAdminSignals (composition)', () => {
  it('extracts all relevant signals for a Stripe verification email', () => {
    const fx = getFixture('verify-email-signup');
    const sig = extractAdminSignals(fx.message);
    assert.ok(sig.primaryUrl?.startsWith('https://dashboard.stripe.com/verify/'));
    assert.equal(sig.serviceName, 'Stripe');
  });

  it('extracts a code from the Google verification fixture', () => {
    const fx = getFixture('verification-code-google');
    const sig = extractAdminSignals(fx.message);
    assert.equal(sig.verificationCode, '482915');
  });

  it('extracts an amount + expires date from the trial-expiration fixture', () => {
    const fx = getFixture('trial-expiration-microsoft');
    const sig = extractAdminSignals(fx.message);
    assert.equal(sig.amount, '$22.00');
    assert.ok(sig.expiresAt, 'expected an expiresAt iso for "in 3 days"');
  });
});

// ── 2. Screen ───────────────────────────────────────────────────────────

describe('screen — worthClassifying gate', () => {
  it('returns worthClassifying=false for a plain lead inquiry', () => {
    const fx = getFixture('not-admin-lead-inquiry');
    const res = screenForAdminSignal(fx.message);
    assert.equal(
      res.worthClassifying,
      false,
      `expected screen to skip plain lead inquiry, got signals=${res.signals.join(',')}`,
    );
  });

  it('returns worthClassifying=true for every admin fixture', () => {
    for (const fx of OFFICE_ADMIN_FIXTURES) {
      if (fx.expectedCategory === 'not-admin') continue;
      const res = screenForAdminSignal(fx.message);
      assert.equal(
        res.worthClassifying,
        true,
        `screen missed admin signal on fixture ${fx.id}`,
      );
    }
  });

  it('flags noreply-sender for system senders', () => {
    const m = baseMessage({ fromEmail: 'no-reply@stripe.com', subject: 'hi', bodyText: 'manage email preferences' });
    const res = screenForAdminSignal(m);
    assert.ok(res.signals.includes('noreply-sender'));
  });
});

// ── 3. Category → approval mapping ──────────────────────────────────────

describe('category mapping', () => {
  it('every admin category maps to exactly one approval kind', () => {
    for (const c of OFFICE_ADMIN_CATEGORIES) {
      assert.ok(categoryToApprovalKind(c), `no approval kind for ${c}`);
    }
  });

  it('matches the locked 9→5 map', () => {
    assert.equal(categoryToApprovalKind('email-verification'), 'ADMIN_VERIFICATION_CODE');
    assert.equal(categoryToApprovalKind('verification-code'), 'ADMIN_VERIFICATION_CODE');
    assert.equal(categoryToApprovalKind('password-reset'), 'ADMIN_PASSWORD_RESET');
    assert.equal(categoryToApprovalKind('trial-expiration'), 'ADMIN_TRIAL_ENDING');
    assert.equal(categoryToApprovalKind('billing-notice'), 'ADMIN_BILLING_NOTICE');
    assert.equal(categoryToApprovalKind('subscription-confirmation'), 'ADMIN_BILLING_NOTICE');
    assert.equal(categoryToApprovalKind('service-status'), 'ADMIN_BILLING_NOTICE');
    assert.equal(categoryToApprovalKind('email-preferences'), 'ADMIN_BILLING_NOTICE');
    assert.equal(categoryToApprovalKind('account-suspension'), 'ADMIN_SECURITY_ALERT');
  });

  it('account-suspension is critical priority; preferences are low', () => {
    assert.equal(categoryToPriority('account-suspension'), 'critical');
    assert.equal(categoryToPriority('email-preferences'), 'low');
    assert.equal(categoryToPriority('service-status'), 'low');
    assert.equal(categoryToPriority('subscription-confirmation'), 'low');
  });

  it('every category has a card title', () => {
    for (const c of OFFICE_ADMIN_CATEGORIES) {
      const title = categoryToCardTitle(c);
      assert.ok(title.length > 0, `empty card title for ${c}`);
    }
  });
});

// ── 4. Classifier integration ───────────────────────────────────────────

describe('classifyOfficeAdmin — synthetic fixtures', () => {
  for (const fx of OFFICE_ADMIN_FIXTURES) {
    it(`fixture ${fx.id} → category=${fx.expectedCategory}`, async () => {
      const llm = new TestLlmProvider();
      const res = await classifyOfficeAdmin({ message: fx.message, llm });
      assert.equal(res.ok, true, `classifyOfficeAdmin failed: ${!res.ok && res.error.message}`);
      if (!res.ok) return;
      assert.equal(
        res.value.category,
        fx.expectedCategory,
        `${fx.id}: expected ${fx.expectedCategory}, got ${res.value.category} — ${res.value.reason}`,
      );
      if (fx.expectsVerificationCode) {
        assert.equal(
          res.value.signals.verificationCode,
          fx.expectsVerificationCode,
          `${fx.id}: expected code ${fx.expectsVerificationCode}`,
        );
      }
      if (fx.expectsPrimaryUrl) {
        assert.ok(
          res.value.signals.primaryUrl,
          `${fx.id}: expected a primaryUrl in extracted signals`,
        );
      }
    });
  }
});

describe('classifyOfficeAdmin — short-circuit on empty screen', () => {
  it('returns not-admin WITHOUT calling the LLM when screen is empty', async () => {
    const fx = getFixture('not-admin-lead-inquiry');
    const llm = new TestLlmProvider();
    const res = await classifyOfficeAdmin({ message: fx.message, llm });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.category, 'not-admin');
    assert.equal(
      llm.calls.length,
      0,
      `expected zero LLM calls on screen short-circuit, got ${llm.calls.length}`,
    );
  });
});

describe('classifyOfficeAdmin — confidence floor demotes weak matches', () => {
  it('sub-threshold confidence demotes from admin to not-admin', async () => {
    // Synthetic LLM that returns billing-notice with confidence below the floor.
    const weakLlm: LlmProvider = {
      name: 'test',
      async complete() {
        return llmOk({
          text: JSON.stringify({
            category: 'billing-notice',
            confidence: 0.4,
            reason: 'weak signal',
          }),
          stopReason: 'end_turn',
          usage: null,
          model: 'weak-test',
        });
      },
    };
    const fx = getFixture('billing-notice-stripe-receipt');
    const res = await classifyOfficeAdmin({ message: fx.message, llm: weakLlm });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(
      res.value.category,
      'not-admin',
      `expected demote to not-admin, got ${res.value.category}`,
    );
    assert.ok(res.value.reason.includes('below'));
    assert.ok(OFFICE_ADMIN_MIN_CONFIDENCE > 0.4);
  });
});

// ── 5. Approval payload composer ────────────────────────────────────────

describe('buildAdminApprovalPayload', () => {
  it('builds a verification-code payload with code in body', async () => {
    const fx = getFixture('verification-code-google');
    const llm = new TestLlmProvider();
    const res = await classifyOfficeAdmin({ message: fx.message, llm });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const actionable = asActionableAdminClassification(res.value);
    assert.ok(actionable, 'classification should be actionable');
    if (!actionable) return;
    const payload = buildAdminApprovalPayload({ message: fx.message, classification: actionable });
    assert.equal(payload.category, 'verification-code');
    assert.equal(payload.signals.verificationCode, '482915');
    assert.equal(payload.priority, 'normal');
    assert.equal(payload.draftBody, null, 'verification-code MUST NOT propose a draft reply');
  });

  it('builds a password-reset payload with primary URL and no draft', async () => {
    const fx = getFixture('password-reset-github');
    const llm = new TestLlmProvider();
    const res = await classifyOfficeAdmin({ message: fx.message, llm });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const actionable = asActionableAdminClassification(res.value);
    assert.ok(actionable);
    if (!actionable) return;
    const payload = buildAdminApprovalPayload({ message: fx.message, classification: actionable });
    assert.equal(payload.category, 'password-reset');
    assert.ok(payload.signals.primaryUrl?.startsWith('https://'));
    assert.equal(payload.draftBody, null, 'password-reset must not draft a reply');
  });

  it('builds a billing-notice payload WITH a suggested draft acknowledgement', async () => {
    const fx = getFixture('billing-notice-stripe-receipt');
    const llm = new TestLlmProvider();
    const res = await classifyOfficeAdmin({ message: fx.message, llm });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const actionable = asActionableAdminClassification(res.value);
    assert.ok(actionable);
    if (!actionable) return;
    const payload = buildAdminApprovalPayload({ message: fx.message, classification: actionable });
    assert.equal(payload.category, 'billing-notice');
    assert.ok(payload.draftBody && payload.draftBody.length > 0, 'billing-notice should propose a draft');
    assert.ok(payload.draftSubject?.startsWith('Re:'));
    assert.match(payload.draftBody!, /Noting receipt/);
  });

  it('builds an account-suspension payload with critical priority', async () => {
    const fx = getFixture('account-suspension-chase');
    const llm = new TestLlmProvider();
    const res = await classifyOfficeAdmin({ message: fx.message, llm });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const actionable = asActionableAdminClassification(res.value);
    assert.ok(actionable);
    if (!actionable) return;
    const payload = buildAdminApprovalPayload({ message: fx.message, classification: actionable });
    assert.equal(payload.category, 'account-suspension');
    assert.equal(payload.priority, 'critical');
    assert.equal(payload.draftBody, null, 'security alerts must not draft a reply');
    assert.match(payload.body.join(' '), /flagged activity/);
  });

  it('does NOT include the verification code in the suggested draft (would leak)', async () => {
    const fx = getFixture('verification-code-google');
    const llm = new TestLlmProvider();
    const res = await classifyOfficeAdmin({ message: fx.message, llm });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const actionable = asActionableAdminClassification(res.value);
    if (!actionable) return;
    const payload = buildAdminApprovalPayload({ message: fx.message, classification: actionable });
    // Code lives in the signals + body display; draftBody MUST be null
    assert.equal(payload.draftBody, null);
    assert.equal(payload.draftSubject, null);
  });
});

// ── 6. Category config sanity ───────────────────────────────────────────

describe('OFFICE_ADMIN_CATEGORY_CONFIG', () => {
  it('contains exactly 9 categories', () => {
    assert.equal(Object.keys(OFFICE_ADMIN_CATEGORY_CONFIG).length, 9);
  });

  it('exposes the 5 distinct approval kinds the schema declares', () => {
    const kinds = new Set(
      Object.values(OFFICE_ADMIN_CATEGORY_CONFIG).map((c) => c.approvalKind),
    );
    assert.equal(kinds.size, 5);
    assert.ok(kinds.has('ADMIN_VERIFICATION_CODE'));
    assert.ok(kinds.has('ADMIN_PASSWORD_RESET'));
    assert.ok(kinds.has('ADMIN_TRIAL_ENDING'));
    assert.ok(kinds.has('ADMIN_BILLING_NOTICE'));
    assert.ok(kinds.has('ADMIN_SECURITY_ALERT'));
  });
});

// ── helpers ─────────────────────────────────────────────────────────────

function baseMessage(overrides: {
  fromEmail: string;
  fromName?: string;
  subject?: string;
  bodyText?: string;
}) {
  return {
    id: 'msg-test',
    threadId: 'thr-test',
    rfcMessageId: '<test@x>',
    fromEmail: overrides.fromEmail,
    fromName: overrides.fromName ?? null,
    toEmails: ['operator@example.com'],
    ccEmails: [],
    subject: overrides.subject ?? '(test)',
    bodyText: overrides.bodyText ?? '',
    snippet: '',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date('2026-05-19T00:00:00.000Z'),
    labels: [],
  };
}
