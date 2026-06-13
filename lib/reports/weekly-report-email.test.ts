/**
 * Tests for the weekly customer report email render. Pure — a fixed
 * WeeklyReportData in, asserted strings out.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderWeeklyReportEmail } from './weekly-report-email';
import type { WeeklyReportData } from './weekly-report-data';

function baseData(overrides: Partial<WeeklyReportData> = {}): WeeklyReportData {
  return {
    workspaceId: 'ws-1',
    workspaceName: 'Acme Realty',
    vertical: 'REAL_ESTATE',
    weekStart: '2026-06-01T00:00:00.000Z',
    weekEnd: '2026-06-08T00:00:00.000Z',
    forDate: '2026-06-07',
    weekLabel: 'Jun 1 – Jun 7',
    hoursSaved: 6.2,
    dollarsInfluenced: 340,
    hasRealDollars: true,
    tokenCostUsd: 1.23,
    netValueUsd: 338.77,
    draftsCreated: 42,
    draftsByDiscipline: [
      { discipline: 'operations', label: 'Operations', count: 30 },
      { discipline: 'other', label: 'Other', count: 12 },
    ],
    approvalsApproved: 38,
    medianTimeToApproveMinutes: 14,
    approvalsRejected: 2,
    rejectionReasons: [{ reason: 'Too formal', count: 2 }],
    actionsAutoExecuted: 3,
    workflowsFired: [
      { agentSlug: 'lead-triage-realestate', label: 'Lead triage', count: 20 },
      { agentSlug: 'inbox-triage-general', label: 'Inbox triage', count: 22 },
    ],
    verticalOutcomes: [
      { label: '20 new leads triaged', detail: 'A first-touch reply for each.' },
    ],
    lookAhead: {
      pendingReviewCount: 4,
      recurringPlan: 'Plaino will keep watching your inbox for new leads.',
      needsInput: ['4 drafts are waiting for your review in your approvals queue.'],
    },
    isEmpty: false,
    ...overrides,
  };
}

const RENDER_ARGS = {
  dashboardUrl: 'https://app.agentplain.com/app/workspace/ws-1/reports/weekly',
  unsubscribeUrl: 'https://app.agentplain.com/api/reports/weekly/unsubscribe?token=abc.def',
  managePreferencesUrl:
    'https://app.agentplain.com/app/workspace/ws-1/reports/weekly#email-preferences',
  markUrl: 'https://app.agentplain.com/brand/plaino-system/8bit.png',
  postalAddress: '123 Main St, Atlanta, GA 30301',
  partner: 'Plaino',
};

describe('renderWeeklyReportEmail', () => {
  it('builds a specific subject and ROI subhead', () => {
    const { subject, html, text } = renderWeeklyReportEmail({
      data: baseData(),
      ...RENDER_ARGS,
    });
    assert.match(subject, /What Plaino did for Acme Realty last week/);
    // The headline subhead — the "earned its keep" line.
    assert.match(html, /Plaino drafted 42 things and you approved 38/);
    assert.match(text, /Plaino drafted 42 things and you approved 38/);
    assert.match(html, /about 6\.2 hours/);
  });

  it('renders the per-vertical outcome line', () => {
    const { html, text } = renderWeeklyReportEmail({
      data: baseData(),
      ...RENDER_ARGS,
    });
    assert.match(html, /20 new leads triaged/);
    assert.match(text, /20 new leads triaged/);
  });

  it('includes the median time-to-approve and rejection note', () => {
    const { html } = renderWeeklyReportEmail({ data: baseData(), ...RENDER_ARGS });
    assert.match(html, /cleared your approvals in about 14 minutes/);
    assert.match(html, /sent 2 drafts back/);
    assert.match(html, /Too formal/);
  });

  it('includes the look-ahead and CTA + dashboard link', () => {
    const { html } = renderWeeklyReportEmail({ data: baseData(), ...RENDER_ARGS });
    assert.match(html, /look-ahead/i);
    assert.match(html, /4 drafts are waiting/);
    assert.match(html, /reports\/weekly/);
  });

  it('always includes CAN-SPAM footer: unsubscribe, manage prefs, postal address', () => {
    const { html, text } = renderWeeklyReportEmail({
      data: baseData(),
      ...RENDER_ARGS,
    });
    assert.match(html, /unsubscribe\?token=abc\.def/);
    assert.match(html, /Manage email preferences/);
    assert.match(html, /123 Main St, Atlanta, GA 30301/);
    assert.match(text, /Unsubscribe from weekly reports:/);
    assert.match(text, /123 Main St, Atlanta, GA 30301/);
  });

  it('omits the real-dollars stat when no real dollars were carried', () => {
    const { html } = renderWeeklyReportEmail({
      data: baseData({ hasRealDollars: false, dollarsInfluenced: 0 }),
      ...RENDER_ARGS,
    });
    assert.doesNotMatch(html, /in real dollars/);
  });

  it('renders the honest quiet-week state', () => {
    const { subject, html } = renderWeeklyReportEmail({
      data: baseData({
        isEmpty: true,
        draftsCreated: 0,
        approvalsApproved: 0,
        approvalsRejected: 0,
        actionsAutoExecuted: 0,
        verticalOutcomes: [],
        workflowsFired: [],
        hoursSaved: 0,
        dollarsInfluenced: 0,
        hasRealDollars: false,
      }),
      ...RENDER_ARGS,
    });
    assert.match(subject, /kept watch over Acme Realty/);
    assert.match(html, /still learning your business/);
  });

  it('escapes HTML in the workspace name', () => {
    const { html } = renderWeeklyReportEmail({
      data: baseData({ workspaceName: 'A & B <Realty>' }),
      ...RENDER_ARGS,
    });
    assert.match(html, /A &amp; B &lt;Realty&gt;/);
    assert.doesNotMatch(html, /<Realty>/);
  });
});
