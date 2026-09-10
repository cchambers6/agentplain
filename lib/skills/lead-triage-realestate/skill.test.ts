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
    // The body must NOT carry the operator-only routing marker. It used
    // to (see the REMOVED-routingMention block in skill.ts); this file
    // previously asserted its PRESENCE, which is how the leak stayed
    // green. The sweep below pins the general case.
    assert.doesNotMatch(draft.body, /operator-only/);
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

/**
 * Containment pin for the first-touch body.
 *
 * `renderFirstTouchDraft` used to be handed the `routing` object and
 * spliced `{{operator-only - internal: routed to <agent> (<rationale>)}}`
 * into every category's body. That body is not an internal artifact: it
 * goes to `DraftPersister.persistDraft`, which writes it into the
 * broker's own Gmail / M365 Drafts folder. A broker who did not spot and
 * delete the marker sent the lead the assigned agent's name and the
 * brokerage's internal reason for picking them.
 *
 * This suite sweeps every routing outcome x every category and asserts
 * the internal rationale CANNOT appear in the outbound body. It checks
 * both the returned `draft.body` and the string actually handed to the
 * persister, because the persister argument is the real outbound
 * artifact and nothing guarantees the two stay identical.
 *
 * Per the "examined N, not found nothing" rule: the suite asserts its
 * own coverage at the end. An empty or partial matrix fails rather than
 * passing green on having looked at nothing.
 */

const SENTINEL_AGENT = 'Zephyrine Quillfeather-Okonkwo';
const SENTINEL_CAMPAIGN = 'Vermillion Ptarmigan Sequence';

/** Distinctive fragments of every rationale `pickRouting` can emit. */
const RATIONALE_FRAGMENTS = [
  'Specialty match',
  'round-robin',
  'drip campaign',
  'broker-owner triage',
  'operator should configure',
  'operator-only',
  'internal:',
];

const CATEGORY_FIXTURES: Array<{ label: string; base: Partial<LeadRecord> }> = [
  {
    label: 'hot',
    base: {
      id: 'lead-cat-hot',
      inquiryText: 'Ready to buy - want to tour ASAP and make an offer if I like it.',
      statedTimeline: 'this week',
      statedFinancing: 'preapproved with a lender',
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: '7128341',
        addressText: '4421 Magnolia Dr',
      },
      inquirySubject: null,
    },
  },
  {
    label: 'warm',
    base: {
      id: 'lead-cat-warm',
      inquiryText: 'Curious about this listing - could we set up a tour next week?',
      statedTimeline: '30 days',
      statedFinancing: 'preapproved with a lender',
      propertyContext: {
        type: 'specific-listing',
        mlsNumber: '7128341',
        addressText: '4421 Magnolia Dr',
      },
      inquirySubject: null,
    },
  },
  {
    label: 'cold',
    base: {
      id: 'lead-cat-cold',
      inquiryText: 'Interested in learning more, and looking at a few neighborhoods.',
      statedTimeline: 'this quarter',
      statedFinancing: null,
      propertyContext: { type: 'general', mlsNumber: null, addressText: null },
      inquirySubject: null,
    },
  },
  {
    label: 'nurture',
    base: {
      id: 'lead-cat-nurture',
      inquiryText: 'No rush, maybe someday.',
      statedTimeline: 'someday',
      statedFinancing: null,
      propertyContext: { type: 'general', mlsNumber: null, addressText: null },
      inquirySubject: null,
    },
  },
];

function sentinelCampaigns(): DripCampaign[] {
  return [
    campaign({ id: 'drip-cold', name: `${SENTINEL_CAMPAIGN} (cold)`, audience: 'cold' }),
    campaign({ id: 'drip-nurture', name: `${SENTINEL_CAMPAIGN} (nurture)`, audience: 'nurture' }),
  ];
}

const ROUTING_SCENARIOS: Array<{
  label: string;
  extraText: string;
  agents: AgentRoster[];
  campaigns: DripCampaign[];
}> = [
  {
    label: 'agent via round-robin',
    extraText: '',
    agents: [
      agent({ id: 'agent-z', name: SENTINEL_AGENT, specialties: ['luxury'], acceptingLeads: true }),
    ],
    campaigns: sentinelCampaigns(),
  },
  {
    label: 'agent via specialty match',
    extraText: ' We are shopping for our first home.',
    agents: [
      agent({
        id: 'agent-z',
        name: SENTINEL_AGENT,
        specialties: ['first-time buyer'],
        acceptingLeads: true,
      }),
    ],
    campaigns: sentinelCampaigns(),
  },
  {
    label: 'manual - no accepting agent, no campaign',
    extraText: '',
    agents: [
      agent({ id: 'agent-z', name: SENTINEL_AGENT, specialties: ['luxury'], acceptingLeads: false }),
    ],
    campaigns: [],
  },
  {
    label: 'drip - empty roster',
    extraText: '',
    agents: [],
    campaigns: sentinelCampaigns(),
  },
];

describe('lead-triage-realestate - internal routing rationale never reaches the outbound body', () => {
  it('holds for every routing outcome x every category', async () => {
    const seenCategories = new Set<string>();
    const seenRoutingTypes = new Set<string>();
    let examined = 0;

    for (const fixture of CATEGORY_FIXTURES) {
      for (const scenario of ROUTING_SCENARIOS) {
        const base = fixture.base as Partial<LeadRecord>;
        const subject = `${fixture.label}/${scenario.label}`;
        const fetcher = new JsonLeadFetcher({
          workspaceId: WORKSPACE_ID,
          leads: [
            lead({
              ...base,
              inquiryText: `${base.inquiryText ?? ''}${scenario.extraText}`,
            }),
          ],
          agents: scenario.agents,
          campaigns: scenario.campaigns,
        });
        const persister = new RecordingDraftPersister();
        const res = await runSkill({
          workspaceId: WORKSPACE_ID,
          fetcher,
          persister,
          // Force the Gmail-draft push for every category so the real
          // outbound artifact is produced and inspected, not just the
          // in-memory draft.
          persistThreshold: 0,
          now: NOW,
        });
        assert.equal(res.ok, true, `${subject}: runSkill failed`);
        if (!res.ok) return;

        const triaged = res.value.triaged[0];
        const draft = triaged.firstTouchDraft;
        assert.ok(draft, `${subject}: expected a first-touch draft`);
        assert.equal(triaged.category, fixture.label, `${subject}: category drifted`);

        // Positive control. If the rationale were empty, every
        // "does not contain" assertion below would pass vacuously and
        // this suite would be worthless.
        assert.ok(
          triaged.routing.rationale.length > 10,
          `${subject}: routing.rationale is empty - the assertions below would be vacuous`,
        );

        assert.equal(
          persister.calls.length,
          1,
          `${subject}: expected exactly one persisted draft`,
        );
        const outbound = [draft.body, persister.calls[0].body];
        assert.equal(
          persister.calls[0].body,
          draft.body,
          `${subject}: persisted body diverged from the returned draft body`,
        );

        for (const body of outbound) {
          assert.ok(
            !body.includes(triaged.routing.rationale),
            `${subject}: outbound body contains the internal routing rationale verbatim`,
          );
          for (const fragment of RATIONALE_FRAGMENTS) {
            assert.ok(
              !body.toLowerCase().includes(fragment.toLowerCase()),
              `${subject}: outbound body contains internal routing fragment "${fragment}"`,
            );
          }
          assert.ok(
            !body.includes(SENTINEL_AGENT),
            `${subject}: outbound body names the routed agent`,
          );
          assert.ok(
            !body.includes(SENTINEL_CAMPAIGN),
            `${subject}: outbound body names the drip campaign`,
          );
          if (triaged.routing.type === 'agent') {
            assert.ok(
              !body.includes(triaged.routing.agentId),
              `${subject}: outbound body contains the routed agent id`,
            );
          }
        }

        seenCategories.add(triaged.category);
        seenRoutingTypes.add(triaged.routing.type);
        examined += 1;
      }
    }

    // Coverage, asserted. "Found nothing" and "examined nothing" must
    // not be indistinguishable.
    assert.equal(
      examined,
      CATEGORY_FIXTURES.length * ROUTING_SCENARIOS.length,
      'matrix did not run to completion',
    );
    assert.deepEqual(
      [...seenCategories].sort(),
      ['cold', 'hot', 'nurture', 'warm'],
      'matrix did not exercise all four categories',
    );
    assert.deepEqual(
      [...seenRoutingTypes].sort(),
      ['agent', 'drip', 'manual'],
      'matrix did not exercise all three routing outcomes',
    );
  });

  it('the operator still gets the routing decision - it moves, it is not dropped', async () => {
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads: [lead({ ...(CATEGORY_FIXTURES[0].base as Partial<LeadRecord>) })],
      agents: [
        agent({ id: 'agent-z', name: SENTINEL_AGENT, specialties: ['luxury'], acceptingLeads: true }),
      ],
      campaigns: sentinelCampaigns(),
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, now: NOW });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const routing = res.value.triaged[0].routing;
    assert.equal(routing.type, 'agent');
    if (routing.type !== 'agent') return;
    // The structured field the approval payload carries and the
    // approvals card renders (see `renderApprovalPayload#renderLeadTriage`,
    // pinned in `tests/approvals-renderer.test.ts`).
    assert.equal(routing.agentName, SENTINEL_AGENT);
    assert.match(routing.rationale, /round-robin/);
  });
});
