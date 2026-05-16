/**
 * lib/skills/lead-triage-realestate/skill.test.ts
 *
 * Pinning tests for the real-estate lead-triage skill. Covers the
 * deterministic scoring rules, the category bucketing thresholds,
 * routing (specialty match → round-robin → drip campaign → manual),
 * the persistence guard (no Gmail draft write when no persister is given),
 * and the missing-email + workspace-mismatch edge cases.
 *
 * Per `feedback_runner_portability.md`: tests bind `JsonLeadFetcher`
 * + `RecordingDraftPersister`. The skill code itself does not import a
 * vendor SDK.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill, scoreLead } from './skill';
import { JsonLeadFetcher } from './json-fetcher';
import { RecordingDraftPersister } from '../draft';
import type {
  AgentRoster,
  DripCampaign,
  LeadRecord,
} from './types';

const WORKSPACE_ID = 'ws-realestate-leads-0001';
const NOW = new Date('2026-05-15T15:00:00Z');

function lead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead-1',
    fullName: 'Jordan Reyes',
    email: 'jordan.reyes@example.com',
    phone: '+14045551234',
    source: 'idx',
    inquiryText: 'Curious about this listing — could we set up a tour next week?',
    inquirySubject: 'Question about your listing',
    propertyContext: {
      type: 'specific-listing',
      mlsNumber: '7128341',
      addressText: '4421 Magnolia Dr, Atlanta',
    },
    statedTimeline: '30 days',
    statedFinancing: 'preapproved with a lender',
    receivedAt: new Date('2026-05-14T18:00:00Z'),
    hasBeenContacted: false,
    ...overrides,
  };
}

function agent(overrides: Partial<AgentRoster> = {}): AgentRoster {
  return {
    id: 'agent-a',
    name: 'Casey Mitchell',
    specialties: ['first-time buyer', 'relocation'],
    serviceArea: 'Atlanta intown',
    acceptingLeads: true,
    ...overrides,
  };
}

function campaign(overrides: Partial<DripCampaign> = {}): DripCampaign {
  return {
    id: 'drip-nurture',
    name: '12-month nurture',
    audience: 'nurture',
    ...overrides,
  };
}

describe('lead-triage-realestate — scoring rules are deterministic', () => {
  it('hot lead: specific listing + tight timeline + preapproval → composite ≥ 0.7', () => {
    const scores = scoreLead(
      lead({
        inquiryText: 'I want to make an offer on this property — can we tour ASAP?',
        statedTimeline: 'this week',
        statedFinancing: 'preapproved',
      }),
    );
    assert.ok(
      scores.composite >= 0.7,
      `expected composite ≥ 0.7 for a hot lead; got ${scores.composite}`,
    );
    assert.ok(scores.motivation >= 0.5);
    assert.ok(scores.timeline >= 0.5);
    assert.ok(scores.preapproval >= 0.8);
  });

  it('nurture lead: vague text + long timeline + no preapproval → composite < 0.20', () => {
    const scores = scoreLead(
      lead({
        inquiryText: 'Just browsing — no rush, maybe someday.',
        statedTimeline: 'someday',
        statedFinancing: null,
        propertyContext: { type: 'general', mlsNumber: null, addressText: null },
        source: 'cold-inbound',
        inquirySubject: null,
      }),
    );
    assert.ok(
      scores.composite < 0.2,
      `expected composite < 0.2 for nurture lead; got ${scores.composite}`,
    );
  });

  it('cash buyer with no urgency stays warm-or-cold (preapproval alone is not enough)', () => {
    const scores = scoreLead(
      lead({
        inquiryText: 'Looking at homes in the area, no rush.',
        statedTimeline: '6 months',
        statedFinancing: 'all cash',
      }),
    );
    // motivation = 0.2 (looking at) + 0.15 (specific) + 0.1 (mls) − 0.3 (no rush) ≈ 0.15
    // timeline = 0.1 (6 months) − 0.3 (no rush) → clamped 0
    // preapproval = 1.0 (cash) → 0.2 weight = 0.2
    // composite ≈ 0.06 + 0 + 0.2 = 0.26 — cold tier, not hot.
    assert.ok(scores.composite < 0.45, `cash-no-urgency should not be warm/hot; got ${scores.composite}`);
    assert.equal(scores.preapproval, 1);
  });
});

describe('lead-triage-realestate — bucketing + routing', () => {
  it('hot lead with specialty match routes to that agent', async () => {
    const leads = [
      lead({
        id: 'lead-hot',
        inquiryText:
          'First home for me — ready to buy. Want to tour and make an offer this week. ASAP.',
        statedTimeline: 'this week',
        statedFinancing: 'preapproved',
      }),
    ];
    const agents = [
      agent({ id: 'agent-luxury', name: 'Luxury Lin', specialties: ['luxury'] }),
      agent({ id: 'agent-firstime', name: 'First-Time Felicia', specialties: ['first-time buyer'] }),
    ];
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads,
      agents,
      campaigns: [campaign()],
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.processed, 1);
    const t = res.value.triaged[0];
    assert.equal(t.category, 'hot');
    assert.equal(t.routing.type, 'agent');
    if (t.routing.type !== 'agent') return;
    assert.equal(t.routing.agentId, 'agent-firstime');
    assert.match(t.routing.rationale, /Specialty match/);
  });

  it('hot/warm lead with no accepting agent escalates to manual', async () => {
    const leads = [
      lead({
        id: 'lead-hot',
        inquiryText: 'Ready to buy — want to make an offer this week. ASAP, please.',
        statedTimeline: 'this week',
        statedFinancing: 'preapproved',
      }),
    ];
    const agents = [agent({ acceptingLeads: false })];
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads,
      agents,
      campaigns: [campaign({ audience: 'cold' })],
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const t = res.value.triaged[0];
    assert.equal(t.category, 'hot');
    assert.equal(t.routing.type, 'manual');
    if (t.routing.type !== 'manual') return;
    assert.match(t.routing.rationale, /broker-owner triage/);
  });

  it('nurture lead routes to nurture drip campaign when one exists', async () => {
    const leads = [
      lead({
        id: 'lead-nurture',
        inquiryText: 'No rush, just browsing — maybe in a year.',
        statedTimeline: 'someday',
        statedFinancing: null,
        propertyContext: { type: 'general', mlsNumber: null, addressText: null },
      }),
    ];
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads,
      agents: [agent()],
      campaigns: [
        campaign({ id: 'drip-cold', audience: 'cold', name: 'Cold drip' }),
        campaign({ id: 'drip-nurture', audience: 'nurture', name: '12-month nurture' }),
      ],
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const t = res.value.triaged[0];
    assert.equal(t.category, 'nurture');
    assert.equal(t.routing.type, 'drip');
    if (t.routing.type !== 'drip') return;
    assert.equal(t.routing.campaignId, 'drip-nurture');
  });
});

describe('lead-triage-realestate — vertical-aware first-touch draft', () => {
  it('hot draft cites property anchor + asks for preapproval when missing', async () => {
    const leads = [
      lead({
        id: 'lead-hot',
        fullName: 'Avery Patel',
        inquiryText: 'Ready to buy — want to tour ASAP and make an offer if I like it.',
        statedTimeline: 'this week',
        statedFinancing: null, // missing — draft should ask
        propertyContext: {
          type: 'specific-listing',
          mlsNumber: '7128341',
          addressText: '4421 Magnolia Dr',
        },
        inquirySubject: null,
      }),
    ];
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads,
      agents: [agent()],
      campaigns: [campaign()],
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const draft = res.value.triaged[0].firstTouchDraft;
    assert.ok(draft, 'expected a draft for the hot lead');
    assert.match(draft.body, /4421 Magnolia Dr.*MLS 7128341/, 'should cite address + MLS#');
    assert.match(draft.body, /preapproved|financing/i, 'should ask about preapproval');
    assert.match(draft.body, /\{\{operator: signature\}\}/);
    assert.match(draft.body, /\{\{operator-only — internal:/);
    assert.equal(draft.tone, 'casual');
    assert.ok(draft.confidence >= 0.7, 'hot draft confidence should be ≥ 0.7');
  });

  it('nurture draft is low-pressure + does not ask for preapproval aggressively', async () => {
    const leads = [
      lead({
        id: 'lead-nurture',
        inquiryText: 'No rush, maybe in a year.',
        statedTimeline: 'someday',
        statedFinancing: null,
        propertyContext: { type: 'general', mlsNumber: null, addressText: null },
        inquirySubject: null,
      }),
    ];
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads,
      agents: [agent()],
      campaigns: [campaign()],
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const draft = res.value.triaged[0].firstTouchDraft;
    assert.ok(draft);
    assert.match(draft.body, /low-volume|neighborhood market/i);
    assert.doesNotMatch(draft.body, /make an offer|tour this week/i);
  });
});

describe('lead-triage-realestate — persistence guard + edge cases', () => {
  it('persister is called for above-threshold drafts and providerDraftId comes back', async () => {
    const leads = [
      lead({
        id: 'lead-warm',
        inquiryText: 'Interested in seeing this home — we are preapproved.',
        statedTimeline: '60 days',
        statedFinancing: 'preapproved',
      }),
    ];
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads,
      agents: [agent()],
      campaigns: [campaign()],
    });
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      persister,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const t = res.value.triaged[0];
    assert.ok(t.firstTouchDraft);
    assert.equal(persister.calls.length, 1);
    assert.equal(persister.calls[0].toEmails[0], 'jordan.reyes@example.com');
    assert.equal(t.firstTouchDraft.persisted, true);
    assert.ok(t.firstTouchDraft.providerDraftId);
  });

  it('no persister → drafts are returned in-memory only and persisted=false', async () => {
    const leads = [lead({ id: 'lead-warm' })];
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads,
      agents: [agent()],
      campaigns: [campaign()],
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const draft = res.value.triaged[0].firstTouchDraft;
    assert.ok(draft);
    assert.equal(draft.persisted, false);
    assert.equal(draft.providerDraftId, null);
  });

  it('lead with no email → triaged + scored, but draft is skipped with reason', async () => {
    const leads = [
      lead({ id: 'lead-noemail', email: null }),
    ];
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads,
      agents: [agent()],
      campaigns: [campaign()],
    });
    const persister = new RecordingDraftPersister();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      persister,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const t = res.value.triaged[0];
    assert.equal(t.firstTouchDraft, null);
    assert.equal(t.draftSkippedReason, 'missing-email');
    assert.equal(persister.calls.length, 0);
  });

  it('workspace mismatch on the fetcher returns UPSTREAM_GMAIL_ERROR with INVALID_INPUT reference', async () => {
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads: [lead()],
      agents: [agent()],
      campaigns: [campaign()],
    });
    const res = await runSkill({
      workspaceId: 'ws-some-other',
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'UPSTREAM_GMAIL_ERROR');
    assert.equal(res.error.reference, 'INVALID_INPUT');
  });

  it('empty input — processed=0, no triaged, all category counts zero', async () => {
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads: [],
      agents: [],
      campaigns: [],
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.processed, 0);
    assert.equal(res.value.triaged.length, 0);
    assert.deepEqual(res.value.categoryCounts, { hot: 0, warm: 0, cold: 0, nurture: 0 });
  });
});
