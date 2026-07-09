import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSkill } from '../skills/lead-triage-realestate';
import { JsonLeadFetcher } from '../skills/lead-triage-realestate/json-fetcher';
import type { LeadTriageOutput } from '../skills/lead-triage-realestate/types';
import {
  isDemoCredentialMetadata,
  PEACHTREE_AGENTS,
  PEACHTREE_CAMPAIGNS,
  PEACHTREE_DEMO_NAME,
  peachtreeLeads,
} from './peachtree-dataset';

const ANCHOR = new Date('2026-07-08T09:00:00-04:00');

async function triage(): Promise<LeadTriageOutput> {
  const workspaceId = 'ws-test';
  const leads = peachtreeLeads(ANCHOR);
  const res = await runSkill({
    workspaceId,
    fetcher: new JsonLeadFetcher({
      workspaceId,
      leads: leads.all,
      agents: PEACHTREE_AGENTS,
      campaigns: PEACHTREE_CAMPAIGNS,
    }),
    persister: null,
  });
  assert.ok(res.ok, res.ok ? '' : res.error.message);
  return res.value;
}

describe('peachtree-dataset · obviously fake (Truth-Wave gate)', () => {
  const { all, overnight, historical } = peachtreeLeads(ANCHOR);

  it('the brokerage name says Demo', () => {
    assert.match(PEACHTREE_DEMO_NAME, /Demo/);
  });

  it('20 leads, 3 overnight + 17 historical, unique ids', () => {
    assert.equal(all.length, 20);
    assert.equal(overnight.length, 3);
    assert.equal(historical.length, 17);
    assert.equal(new Set(all.map((l) => l.id)).size, 20);
  });

  it('every email is @example.com (RFC 2606) or absent', () => {
    for (const lead of all) {
      if (lead.email !== null) {
        assert.match(lead.email, /@example\.com$/, lead.id);
      }
    }
  });

  it('every phone is in the (555) 555-01XX fictional range', () => {
    for (const lead of all) {
      assert.match(lead.phone ?? '', /^\(555\) 555-01\d\d$/, lead.id);
    }
  });

  it('every street number is 999 (flatsbo test-seed convention)', () => {
    for (const lead of all) {
      // Zips are 5 digits and excluded; street numbers are 2–4 digits
      // followed by a capitalized street name.
      for (const field of [lead.propertyContext.addressText ?? '', lead.inquiryText]) {
        for (const streetNumber of field.matchAll(/(?<!\$|[\d,.])(\d{2,4})\s+[A-Z][a-z]/g)) {
          assert.equal(streetNumber[1], '999', `${lead.id}: ${streetNumber[0]}`);
        }
      }
    }
  });

  it('every zip is metro Atlanta (30xxx)', () => {
    for (const lead of all) {
      const zips = (lead.propertyContext.addressText ?? '').match(/\b\d{5}\b/g) ?? [];
      for (const zip of zips) assert.match(zip, /^30\d{3}$/, lead.id);
    }
  });

  it('every price is inside the $250K–$1.2M band', () => {
    for (const lead of all) {
      const text = `${lead.propertyContext.addressText ?? ''} ${lead.inquiryText} ${lead.statedFinancing ?? ''}`;
      const amounts = [...text.matchAll(/\$([\d,]+)(k?)/gi)].map(([, num, k]) => {
        const n = Number(num.replace(/,/g, ''));
        return k ? n * 1000 : n;
      });
      for (const amount of amounts) {
        assert.ok(
          amount >= 250_000 && amount <= 1_200_000,
          `${lead.id}: $${amount} outside the demo band`,
        );
      }
    }
  });

  it('lead sources are mixed (5+ distinct)', () => {
    assert.ok(new Set(all.map((l) => l.source)).size >= 5);
  });

  it('is deterministic for a fixed anchor', () => {
    assert.deepEqual(peachtreeLeads(ANCHOR), peachtreeLeads(ANCHOR));
  });
});

describe('peachtree-dataset · triage pins (the demo beats)', () => {
  it('the overnight hot lead scores hot and routes to the relocation specialist', async () => {
    const out = await triage();
    const jordan = out.triaged.find((t) => t.leadId === 'lead-jordan-ellis');
    assert.ok(jordan);
    assert.equal(jordan.category, 'hot');
    assert.equal(jordan.routing.type, 'agent');
    if (jordan.routing.type === 'agent') {
      assert.equal(jordan.routing.agentName, 'Alicia Grant');
    }
    // The first-touch draft exists and carries the operator slot for two
    // concrete showing windows — the demo's "it never invents your
    // calendar" beat.
    assert.ok(jordan.firstTouchDraft);
    assert.match(jordan.firstTouchDraft.body, /propose two/i);
  });

  it('the overnight browser lands nurture and routes to a drip campaign', async () => {
    const out = await triage();
    const shah = out.triaged.find((t) => t.leadId === 'lead-shah-family');
    assert.ok(shah);
    assert.equal(shah.category, 'nurture');
    assert.equal(shah.routing.type, 'drip');
  });

  it('the missing-email walk-in is triaged but honestly skips the draft', async () => {
    const out = await triage();
    const walkin = out.triaged.find((t) => t.leadId === 'lead-walkin-woodstock');
    assert.ok(walkin);
    assert.equal(walkin.firstTouchDraft, null);
    assert.equal(walkin.draftSkippedReason, 'missing-email');
  });

  it('all 20 leads triage without error and every category appears', async () => {
    const out = await triage();
    assert.equal(out.processed, 20);
    for (const category of ['hot', 'warm', 'cold', 'nurture'] as const) {
      assert.ok(out.categoryCounts[category] >= 1, `no ${category} lead in the demo`);
    }
  });
});

describe('peachtree-dataset · demo-credential guard', () => {
  it('recognizes the seeded credential metadata and nothing else', () => {
    assert.equal(isDemoCredentialMetadata({ isDemo: true }), true);
    assert.equal(isDemoCredentialMetadata({ isDemo: false }), false);
    assert.equal(isDemoCredentialMetadata({}), false);
    assert.equal(isDemoCredentialMetadata(null), false);
    assert.equal(isDemoCredentialMetadata(undefined), false);
    assert.equal(isDemoCredentialMetadata('isDemo'), false);
  });
});
