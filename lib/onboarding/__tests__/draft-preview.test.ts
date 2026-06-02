/**
 * Behavior tests for the wave-10 phase-3b draft-preview extractor.
 *
 * Covers the customer-pickable skill payloads:
 *   - ANALYTICS_PULSE / FINANCE_PULSE — `body` + `recommendations` + week-of
 *   - CONTENT_CALENDAR — `preamble` + `days[]` rollup
 *   - COMPLIANCE_DIGEST / COMPLIANCE_FLAG — `body` + match count
 *   - FOLLOW_UP_NUDGE — email-shaped (To / Subject / body / stage)
 *   - CHIEF_OF_STAFF_REPLY_DRAFT / BUYER_INQUIRY_REPLY_DRAFT — email-shaped
 *   - CHIEF_OF_STAFF_MEETING — proposed slots
 *   - CHIEF_OF_STAFF_TODO — summary + detail
 *   - PROCESS_DOC_DRAFT — SOP body
 *   - INBOX_TRIAGE — summary + bucket + from
 *   - ADMIN_* — pretty kind label + body
 *
 * Plus malformed-input defense: array, null, missing fields → null.
 *
 * Plus length-cap guarantee — a 10kb body is clipped, never returned in
 * full to the wizard.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractDraftPreview } from '../draft-preview';

describe('extractDraftPreview — picker-skill payloads', () => {
  it('ANALYTICS_PULSE returns title + body + week-of + recs meta', () => {
    const out = extractDraftPreview('ANALYTICS_PULSE', {
      body: 'Workspace was active this week — 12 drafts produced.',
      forWeekStarting: '2026-05-25',
      recommendations: ['lean into compliance', 'enable the calendar drafter'],
      counts: { drafts: 12 },
    });
    assert.ok(out);
    assert.match(out!.title, /pulse/i);
    assert.ok(out!.body.includes('12 drafts'));
    const meta = out!.meta ?? [];
    assert.ok(meta.some((m) => m.label === 'For week of'));
    assert.ok(meta.some((m) => m.label === 'Recommendations'));
  });

  it('FINANCE_PULSE renders body even without QuickBooks', () => {
    const out = extractDraftPreview('FINANCE_PULSE', {
      body: 'Connect QuickBooks for AR aging. This week: 0 invoice-chase drafts.',
      forWeekStarting: '2026-05-25',
    });
    assert.ok(out);
    assert.ok(out!.body.includes('QuickBooks'));
  });

  it('COMPLIANCE_DIGEST surfaces match count', () => {
    const out = extractDraftPreview('COMPLIANCE_DIGEST', {
      body: 'Reviewed 24 drafts. Two soft flags surfaced.',
      matches: [{ approvalId: 'a' }, { approvalId: 'b' }],
      forDate: '2026-05-31',
    });
    assert.ok(out);
    const items = out!.meta?.find((m) => m.label === 'Items flagged');
    assert.equal(items?.value, '2');
  });

  it('CONTENT_CALENDAR rolls up days into the body', () => {
    const out = extractDraftPreview('CONTENT_CALENDAR', {
      preamble: 'Here are five hooks for the week.',
      forWeekStarting: '2026-06-01',
      days: [
        { dayLabel: 'Mon', hook: 'Quote from a recent close', channel: 'IG' },
        { dayLabel: 'Tue', hook: 'Behind-the-scenes of staging', channel: 'TikTok' },
      ],
    });
    assert.ok(out);
    assert.ok(out!.body.includes('Mon'));
    assert.ok(out!.body.includes('Tue'));
    assert.ok(out!.body.includes('IG'));
  });

  it('FOLLOW_UP_NUDGE renders email-shaped meta', () => {
    const out = extractDraftPreview('FOLLOW_UP_NUDGE', {
      subject: 'Following up on Tuesday',
      body: 'Hey — circling back on the proposal I sent Tuesday.',
      toEmails: ['jane@example.com'],
      stage: 'soft-nudge',
    });
    assert.ok(out);
    assert.match(out!.title, /follow-up nudge/i);
    const subj = out!.meta?.find((m) => m.label === 'Subject');
    assert.equal(subj?.value, 'Following up on Tuesday');
    const to = out!.meta?.find((m) => m.label === 'To');
    assert.equal(to?.value, 'jane@example.com');
  });

  it('CHIEF_OF_STAFF_REPLY_DRAFT uses the same email shape', () => {
    const out = extractDraftPreview('CHIEF_OF_STAFF_REPLY_DRAFT', {
      subject: 'Re: contract',
      body: 'Thanks — sending the redline tomorrow morning.',
      toEmails: ['ops@partner.com', 'legal@partner.com'],
    });
    assert.ok(out);
    const to = out!.meta?.find((m) => m.label === 'To');
    assert.equal(to?.value, 'ops@partner.com, legal@partner.com');
  });

  it('CHIEF_OF_STAFF_MEETING lists proposed slots', () => {
    const out = extractDraftPreview('CHIEF_OF_STAFF_MEETING', {
      proposedSlots: [
        { label: 'Mon Jun 2, 10:00 AM' },
        { label: 'Mon Jun 2, 2:30 PM' },
      ],
      counterpartName: 'Jordan Lee',
    });
    assert.ok(out);
    assert.ok(out!.body.includes('Mon Jun 2'));
    const with_ = out!.meta?.find((m) => m.label === 'With');
    assert.equal(with_?.value, 'Jordan Lee');
  });

  it('CHIEF_OF_STAFF_TODO uses summary + detail', () => {
    const out = extractDraftPreview('CHIEF_OF_STAFF_TODO', {
      summary: 'Send revised contract to ABC Corp',
      detail: 'They asked for clause 4.2 to be updated.',
    });
    assert.ok(out);
    assert.ok(out!.body.includes('ABC Corp'));
    assert.ok(out!.body.includes('clause 4.2'));
  });

  it('PROCESS_DOC_DRAFT surfaces SOP body + process name', () => {
    const out = extractDraftPreview('PROCESS_DOC_DRAFT', {
      processName: 'New-listing intake',
      body: '## Steps\n1. Confirm seller details\n2. Collect photos…',
    });
    assert.ok(out);
    assert.match(out!.title, /SOP/i);
    const proc = out!.meta?.find((m) => m.label === 'Process');
    assert.equal(proc?.value, 'New-listing intake');
  });

  it('INBOX_TRIAGE returns summary + bucket + from', () => {
    const out = extractDraftPreview('INBOX_TRIAGE', {
      summary: 'Urgent reply needed — counter-offer expires Friday.',
      bucket: 'urgent',
      from: 'broker@partner.com',
    });
    assert.ok(out);
    assert.equal(out!.meta?.find((m) => m.label === 'Bucket')?.value, 'urgent');
  });

  it('ADMIN_VERIFICATION_CODE labels the kind in plain English', () => {
    const out = extractDraftPreview('ADMIN_VERIFICATION_CODE', {
      body: 'Your verification code is 123456.',
      from: 'noreply@vendor.com',
    });
    assert.ok(out);
    assert.match(out!.title, /admin verification code/i);
    assert.ok(out!.body.includes('123456'));
  });
});

describe('extractDraftPreview — malformed input', () => {
  it('returns null for non-object payload', () => {
    assert.equal(extractDraftPreview('ANALYTICS_PULSE', null), null);
    assert.equal(extractDraftPreview('ANALYTICS_PULSE', 'a string'), null);
    assert.equal(extractDraftPreview('ANALYTICS_PULSE', [1, 2, 3]), null);
  });

  it('returns null when the required body field is missing', () => {
    assert.equal(
      extractDraftPreview('ANALYTICS_PULSE', { forWeekStarting: '2026-05-25' }),
      null,
    );
  });

  it('returns null for empty-string body', () => {
    assert.equal(
      extractDraftPreview('FINANCE_PULSE', { body: '   ' }),
      null,
    );
  });

  it('falls back to generic preview on an unknown kind with body', () => {
    const out = extractDraftPreview('SOMETHING_NEW', {
      body: 'Plaino made a thing.',
    });
    assert.ok(out);
    assert.match(out!.title, /draft/i);
  });

  it('clips a runaway body to a bounded length', () => {
    const huge = 'x'.repeat(20_000);
    const out = extractDraftPreview('ANALYTICS_PULSE', { body: huge });
    assert.ok(out);
    assert.ok(out!.body.length < 2_000, 'body should be clipped under 2k');
  });
});
