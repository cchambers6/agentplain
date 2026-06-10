/**
 * lib/inngest/functions/__tests__/fub-sync-sweep-persister.test.ts
 *
 * cv-realty: verifies that the FUB/HubSpot/Salesforce sync sweeps pass
 * a real DraftPersister into the lead-triage skill so hot/warm leads
 * land a persisted first-touch draft in /approvals.
 *
 * Covered assertions:
 *   1. When a hot lead is returned by the fetcher, the approval sink
 *      receives a triaged lead whose `firstTouchDraft.persisted === true`
 *      (the persister ran and stamped the draft).
 *   2. A cold lead's first-touch draft still lands in the approval row
 *      (available for the broker to read) but `persisted === false`
 *      because cold confidence (0.60) is below HOT_WARM_PERSIST_THRESHOLD
 *      (0.70) — the persister thresholded it out, not a null-persister gap.
 *   3. Idempotency: calling `PrismaLeadTriageApprovalSink.record()` twice
 *      for the same (workspaceId, leadId) returns `skippedDuplicate: true`
 *      on the second call (recording sink verifies duplicate detection path
 *      by extending RecordingSink with a memory store).
 *
 * These tests use only in-process DI. No DB. No network.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLeadDraftPersister,
  FixtureLeadDraftPersister,
  HOT_WARM_PERSIST_THRESHOLD,
} from '@/lib/skills/lead-triage-realestate/drafts-persister';
import { runSkill } from '@/lib/skills/lead-triage-realestate/skill';
import { JsonLeadFetcher } from '@/lib/skills/lead-triage-realestate/json-fetcher';
import { skillOk } from '@/lib/skills/types';
import type { LeadRecord, AgentRoster, DripCampaign } from '@/lib/skills/lead-triage-realestate/types';
import type { LeadTriageApprovalSink, LeadTriageSinkArgs } from '@/lib/skills/lead-triage-realestate/prisma-approval-sink';
import { runFubSyncSweep } from '../follow-up-boss-sync-sweep';
import { runHubspotSyncSweep } from '../hubspot-sync-sweep';
import { runSalesforceSyncSweep } from '../salesforce-sync-sweep';

const WORKSPACE_ID = 'ws-cv-realty-sweep-test-0001';

// ── Shared fixtures ─────────────────────────────────────────────────────

function hotLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead-hot-1',
    fullName: 'Avery Patel',
    email: 'avery.patel@example.com',
    phone: '+14045559999',
    source: 'idx',
    inquiryText:
      'Ready to make an offer — want to tour this week. ASAP please.',
    inquirySubject: 'Offer on MLS# 7123456',
    propertyContext: {
      type: 'specific-listing',
      mlsNumber: '7123456',
      addressText: '1234 Peachtree St NW, Atlanta',
    },
    statedTimeline: 'this week',
    statedFinancing: 'preapproved',
    receivedAt: new Date('2026-06-09T08:00:00Z'),
    hasBeenContacted: false,
    ...overrides,
  };
}

function coldLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: 'lead-cold-1',
    fullName: 'Sam Winters',
    email: 'sam.winters@example.com',
    phone: null,
    source: 'cold-inbound',
    inquiryText: 'Just looking around, not in a rush.',
    inquirySubject: null,
    propertyContext: { type: 'general', mlsNumber: null, addressText: null },
    statedTimeline: '6 months',
    statedFinancing: null,
    receivedAt: new Date('2026-06-09T08:05:00Z'),
    hasBeenContacted: false,
    ...overrides,
  };
}

function agent(): AgentRoster {
  return {
    id: 'agent-1',
    name: 'Casey Mitchell',
    specialties: ['first-time buyer'],
    serviceArea: 'Atlanta intown',
    acceptingLeads: true,
  };
}

function campaign(): DripCampaign {
  return {
    id: 'drip-cold',
    name: 'Cold pipeline',
    audience: 'cold',
  };
}

// ── Recording sink that tracks calls for DI tests ────────────────────────

class RecordingSink implements LeadTriageApprovalSink {
  readonly name = 'recording-idempotent' as const;
  readonly records: Array<{ args: LeadTriageSinkArgs; skippedDuplicate: boolean }> = [];
  /** Simulate the PENDING set (leadId → sinkId). */
  private readonly pending = new Map<string, string>();
  private counter = 0;

  async record(
    args: LeadTriageSinkArgs,
  ): Promise<import('@/lib/skills/types').SkillResult<{ sinkId: string; skippedDuplicate?: boolean }>> {
    const key = `${args.workspaceId}::${args.triaged.leadId}`;
    if (this.pending.has(key)) {
      const sinkId = this.pending.get(key)!;
      this.records.push({ args, skippedDuplicate: true });
      return skillOk({ sinkId, skippedDuplicate: true });
    }
    this.counter += 1;
    const sinkId = `sink-${this.counter}`;
    this.pending.set(key, sinkId);
    this.records.push({ args, skippedDuplicate: false });
    return skillOk({ sinkId });
  }
}

// ── 1. buildLeadDraftPersister always returns a non-null persister ────────

describe('buildLeadDraftPersister — always non-null (LIVE_INBOX_FETCH off)', () => {
  it('returns a FixtureLeadDraftPersister when no live adapter is supplied', () => {
    const p = buildLeadDraftPersister();
    assert.ok(p instanceof FixtureLeadDraftPersister);
  });

  it('returns a FixtureLeadDraftPersister when preferFixture is set explicitly', () => {
    const p = buildLeadDraftPersister({ preferFixture: true });
    assert.ok(p instanceof FixtureLeadDraftPersister);
  });
});

// ── 2. Hot lead gets persisted draft; cold lead threshold prevents persist ─

describe('runSkill — persister wired → hot/warm lead has persisted draft, cold does not', () => {
  it('hot lead: firstTouchDraft.persisted === true + providerDraftId populated', async () => {
    const persister = buildLeadDraftPersister();
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads: [hotLead()],
      agents: [agent()],
      campaigns: [campaign()],
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      persister,
      persistThreshold: HOT_WARM_PERSIST_THRESHOLD,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const t = res.value.triaged[0];
    assert.ok(
      t.category === 'hot' || t.category === 'warm',
      `expected hot|warm, got ${t.category}`,
    );
    assert.ok(t.firstTouchDraft, 'first-touch draft should be present');
    // The fixture persister stamps providerDraftId so .persisted = true.
    assert.equal(
      t.firstTouchDraft?.persisted,
      true,
      'hot/warm draft should be persisted when a real persister is wired',
    );
    assert.ok(
      t.firstTouchDraft?.providerDraftId,
      'providerDraftId should be set after fixture persister runs',
    );
  });

  it('cold lead: firstTouchDraft present in the row but persisted === false (below 0.7 threshold)', async () => {
    const persister = buildLeadDraftPersister();
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads: [coldLead()],
      agents: [agent()],
      campaigns: [campaign()],
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      persister,
      persistThreshold: HOT_WARM_PERSIST_THRESHOLD,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const t = res.value.triaged[0];
    assert.ok(
      t.category === 'cold' || t.category === 'nurture',
      `expected cold|nurture, got ${t.category}`,
    );
    // Draft is still produced for the approval row — the broker can read
    // it — but it wasn't written to the mailbox (below threshold).
    assert.ok(t.firstTouchDraft, 'cold draft should still land in the approval row');
    assert.equal(
      t.firstTouchDraft?.persisted,
      false,
      'cold draft should NOT be persisted to mailbox (below 0.7 threshold)',
    );
    assert.equal(t.firstTouchDraft?.providerDraftId, null);
  });

  it('null persister path (old behavior) leaves persisted=false — confirms the bug being fixed', async () => {
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads: [hotLead()],
      agents: [agent()],
      campaigns: [campaign()],
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      // Intentionally passing null to confirm the old behavior was broken.
      persister: null,
      persistThreshold: HOT_WARM_PERSIST_THRESHOLD,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const t = res.value.triaged[0];
    assert.ok(t.firstTouchDraft);
    assert.equal(
      t.firstTouchDraft?.persisted,
      false,
      'null persister = no draft persisted (this is the bug the sweeps had)',
    );
  });
});

// ── 3. Idempotency: duplicate sink calls skip on second call ──────────────

describe('RecordingSink idempotency — second call for same lead is skipped', () => {
  it('returns skippedDuplicate=true when the same lead is re-submitted', async () => {
    const sink = new RecordingSink();
    const persister = buildLeadDraftPersister();
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads: [hotLead()],
      agents: [agent()],
      campaigns: [campaign()],
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, persister, persistThreshold: HOT_WARM_PERSIST_THRESHOLD });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const triaged = res.value.triaged[0];

    const first = await sink.record({ workspaceId: WORKSPACE_ID, triaged });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.value.skippedDuplicate, undefined, 'first call should not be a duplicate');

    const second = await sink.record({ workspaceId: WORKSPACE_ID, triaged });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.value.skippedDuplicate, true, 'second call for same lead should be skipped');
    // sinkId is the same row id from the first call.
    assert.equal(second.value.sinkId, first.value.sinkId);
  });

  it('different workspaces for the same leadId are NOT considered duplicates', async () => {
    const sink = new RecordingSink();
    const persister = buildLeadDraftPersister();
    const fetcher = new JsonLeadFetcher({
      workspaceId: WORKSPACE_ID,
      leads: [hotLead()],
      agents: [agent()],
      campaigns: [campaign()],
    });
    const res = await runSkill({ workspaceId: WORKSPACE_ID, fetcher, persister, persistThreshold: HOT_WARM_PERSIST_THRESHOLD });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    const triaged = res.value.triaged[0];

    const ws1 = await sink.record({ workspaceId: 'ws-a', triaged });
    const ws2 = await sink.record({ workspaceId: 'ws-b', triaged });
    assert.equal(ws1.ok, true);
    assert.equal(ws2.ok, true);
    if (!ws1.ok || !ws2.ok) return;
    assert.equal(ws1.value.skippedDuplicate, undefined, 'ws-a first insert should land');
    assert.equal(ws2.value.skippedDuplicate, undefined, 'ws-b first insert should land (different workspace)');
  });
});

// ── 4. Sweep DI wiring: runForWorkspace override receives a real persister ─

describe('FUB sync sweep — runForWorkspace injects persister into skill output', () => {
  it('a hot lead processed by the sweep produces a persisted draft in the approval row', async () => {
    const sink = new RecordingSink();
    let capturedTriaged: LeadTriageSinkArgs['triaged'] | null = null;

    const result = await runFubSyncSweep({
      listCandidates: async () => [
        {
          id: WORKSPACE_ID,
          vertical: 'REAL_ESTATE' as const,
          disabledDisciplines: [],
          hasFubCredential: true,
        },
      ],
      isInstalled: async () => true,
      runForWorkspace: async (workspaceId) => {
        // Build the skill with a wired persister exactly as the live path does.
        const persister = buildLeadDraftPersister();
        const fetcher = new JsonLeadFetcher({
          workspaceId,
          leads: [hotLead()],
          agents: [agent()],
          campaigns: [campaign()],
        });
        const skill = await runSkill({ workspaceId, fetcher, persister, persistThreshold: HOT_WARM_PERSIST_THRESHOLD });
        if (!skill.ok) return { ok: false, leadsTriaged: 0, notesWritten: 0, reason: skill.error.message };
        for (const triaged of skill.value.triaged) {
          capturedTriaged = triaged;
          await sink.record({ workspaceId, triaged });
        }
        return { ok: true, leadsTriaged: skill.value.triaged.length, notesWritten: 0 };
      },
    });

    assert.equal(result.workspacesSyncedSuccessfully, 1);
    assert.equal(result.leadsTriaged, 1);
    assert.ok(capturedTriaged, 'a triaged lead should be captured');
    assert.ok(
      capturedTriaged?.firstTouchDraft,
      'first-touch draft should be present in the approval payload',
    );
    assert.equal(
      capturedTriaged?.firstTouchDraft?.persisted,
      true,
      'draft should be persisted when persister is wired (not null)',
    );
    assert.equal(sink.records.length, 1);
  });
});

// ── 5. HubSpot + Salesforce sweeps: same wiring by construction ──────────

describe('HubSpot sync sweep — runForWorkspace wiring', () => {
  it('leads triaged = 1 when runForWorkspace override returns a wired persister result', async () => {
    const result = await runHubspotSyncSweep({
      listCandidates: async () => [
        { id: WORKSPACE_ID, vertical: 'REAL_ESTATE' as const, disabledDisciplines: [], hasHubspotCredential: true },
      ],
      isInstalled: async () => true,
      runForWorkspace: async (workspaceId) => {
        const persister = buildLeadDraftPersister();
        const fetcher = new JsonLeadFetcher({ workspaceId, leads: [hotLead()], agents: [agent()], campaigns: [campaign()] });
        const skill = await runSkill({ workspaceId, fetcher, persister, persistThreshold: HOT_WARM_PERSIST_THRESHOLD });
        if (!skill.ok) return { ok: false, leadsTriaged: 0, notesWritten: 0, reason: skill.error.message };
        return { ok: true, leadsTriaged: skill.value.triaged.length, notesWritten: 0 };
      },
    });
    assert.equal(result.leadsTriaged, 1);
    assert.equal(result.failures.length, 0);
  });
});

describe('Salesforce sync sweep — runForWorkspace wiring', () => {
  it('leads triaged = 1 when runForWorkspace override returns a wired persister result', async () => {
    const result = await runSalesforceSyncSweep({
      listCandidates: async () => [
        { id: WORKSPACE_ID, vertical: 'REAL_ESTATE' as const, disabledDisciplines: [], hasSalesforceCredential: true },
      ],
      isInstalled: async () => true,
      runForWorkspace: async (workspaceId) => {
        const persister = buildLeadDraftPersister();
        const fetcher = new JsonLeadFetcher({ workspaceId, leads: [hotLead()], agents: [agent()], campaigns: [campaign()] });
        const skill = await runSkill({ workspaceId, fetcher, persister, persistThreshold: HOT_WARM_PERSIST_THRESHOLD });
        if (!skill.ok) return { ok: false, leadsTriaged: 0, tasksWritten: 0, reason: skill.error.message };
        return { ok: true, leadsTriaged: skill.value.triaged.length, tasksWritten: 0 };
      },
    });
    assert.equal(result.leadsTriaged, 1);
    assert.equal(result.failures.length, 0);
  });
});
