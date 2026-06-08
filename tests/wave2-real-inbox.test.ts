/**
 * tests/wave2-real-inbox.test.ts
 *
 * Wave-2 "real inbox + per-message intelligence" end-to-end seam tests.
 * Proves the three audit items as wired:
 *
 *   1. Chief-of-staff scheduler reads the INBOX arm via the
 *      `InboxSnapshotFetcher` seam (fixtures when LIVE_INBOX_FETCH is off).
 *   2. Inbox-triage classifies PER MESSAGE via the LlmProvider seam, with
 *      the deterministic keyword classifier as the fallback.
 *   3. Lead-triage auto-pushes first-touch drafts to a Drafts persister
 *      for HOT/WARM leads (threshold 0.7), cold/nurture skip the push.
 *
 * Run: npx tsx --tsconfig ./tests/tsconfig.test.json --test tests/wave2-real-inbox.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { WebhookEvent } from '@prisma/client';
import type { LlmProvider } from '@/lib/llm/types';
import { skillOk, type ParsedMessage, type SkillResult } from '@/lib/skills/types';

// ── 1. Inbox seam ─────────────────────────────────────────────────────────
import {
  buildInboxFetcher,
  FixtureInboxFetcher,
  McpInboxFetcher,
} from '@/lib/integrations/inbox';
import { ChiefOfStaffMcpFetcher } from '@/lib/skills/scheduler/chief-of-staff-fetcher';
import type { CalendarFetcher } from '@/lib/skills/scheduler/types';
import type { CalendarEvent } from '@/lib/skills/chief-of-staff-scheduler/types';

// ── 2. Per-message LLM classification ──────────────────────────────────────
import { runSkill as runTriage } from '@/lib/skills/inbox-triage-general/skill';
import { JsonTriageFetcher } from '@/lib/skills/inbox-triage-general/json-fetcher';
import type { TriageSnapshot } from '@/lib/skills/inbox-triage-general/types';

// ── 3. Lead-triage draft auto-push ─────────────────────────────────────────
import { runLeadTriageForEvent } from '@/lib/skills/lead-triage-realestate/run-for-event';
import { FixtureLeadDraftPersister } from '@/lib/skills/lead-triage-realestate/drafts-persister';

const WS = 'ws-wave2-0001';

class HappyCalendarFetcher implements CalendarFetcher {
  readonly name = 'happy-stub' as const;
  readonly provider = 'google' as const;
  constructor(private readonly events: CalendarEvent[] = []) {}
  async fetchEvents(): Promise<SkillResult<CalendarEvent[]>> {
    return skillOk(this.events);
  }
}

function fakeEvent(): WebhookEvent {
  return {
    id: 'evt-wave2-1',
    subscriptionId: 'sub-1',
    rawPayload: { historyId: '12345' },
    receivedAt: new Date('2026-06-07T09:00:00.000Z'),
    processed: false,
    processedAt: null,
    error: null,
    attemptCount: 0,
    nextAttemptAt: null,
    deadlettered: false,
  } as unknown as WebhookEvent;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Chief-of-staff scheduler reads the inbox arm via the seam (flag off →
//    fixtures).
// ─────────────────────────────────────────────────────────────────────────

describe('wave-2 #3 — chief-of-staff scheduler inbox arm', () => {
  it('flag OFF: the inbox factory returns the fixture fetcher', () => {
    const prev = process.env.LIVE_INBOX_FETCH;
    delete process.env.LIVE_INBOX_FETCH;
    try {
      const fetcher = buildInboxFetcher({ workspaceId: WS, provider: 'GOOGLE' });
      assert.ok(fetcher instanceof FixtureInboxFetcher);
    } finally {
      if (prev !== undefined) process.env.LIVE_INBOX_FETCH = prev;
    }
  });

  it('flag ON: the inbox factory returns the live MCP-backed fetcher', () => {
    const prev = process.env.LIVE_INBOX_FETCH;
    const prevProvider = process.env.INTEGRATIONS_PROVIDER;
    process.env.LIVE_INBOX_FETCH = 'true';
    delete process.env.INTEGRATIONS_PROVIDER;
    try {
      const fetcher = buildInboxFetcher({ workspaceId: WS, provider: 'GOOGLE' });
      assert.ok(fetcher instanceof McpInboxFetcher);
    } finally {
      if (prev !== undefined) process.env.LIVE_INBOX_FETCH = prev;
      else delete process.env.LIVE_INBOX_FETCH;
      if (prevProvider !== undefined) process.env.INTEGRATIONS_PROVIDER = prevProvider;
    }
  });

  it('scheduler reads the fixture inbox into the snapshot (no longer empty)', async () => {
    const prev = process.env.LIVE_INBOX_FETCH;
    delete process.env.LIVE_INBOX_FETCH;
    const fetcher = new ChiefOfStaffMcpFetcher({
      workspaceId: WS,
      calendarFetcher: new HappyCalendarFetcher([]),
      // Default inbox arm = factory → FixtureInboxFetcher (flag off).
    });
    const res = await fetcher.fetchSnapshot({
      workspaceId: WS,
      asOf: new Date('2026-06-07T09:00:00.000Z'),
      lookaheadDays: 7,
    });
    if (prev !== undefined) process.env.LIVE_INBOX_FETCH = prev;
    assert.ok(res.ok);
    if (!res.ok) return;
    // The default fixture spread is 3 messages — the inbox arm is wired.
    assert.equal(res.value.inbox.length, 3);
    assert.equal(res.value.inbox[0].subject.length > 0, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Inbox-triage classifies PER MESSAGE via the LLM seam, keyword fallback
//    when the LLM is bypassed / errors.
// ─────────────────────────────────────────────────────────────────────────

function triageSnapshot(): TriageSnapshot {
  return {
    inbox: [
      {
        id: 'm-1',
        threadId: 't-1',
        fromEmail: 'buyer@example.com',
        fromName: 'A Buyer',
        // No keyword cue — the keyword classifier alone would call this noise.
        subject: 'Following up on our chat',
        bodyText: 'Wanted to circle back about the place we discussed.',
        receivedAt: new Date('2026-06-07T08:00:00.000Z'),
      },
    ],
  };
}

describe('wave-2 #6 — inbox-triage per-message LLM classification', () => {
  it('LLM classification drives the priority (keyword alone would be noise)', async () => {
    const stubLlm: LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: true,
        value: {
          text: JSON.stringify({
            classifications: [
              {
                messageId: 'm-1',
                priority: 'customer-active',
                confidence: 0.82,
                reason: 'Existing buyer following up about a property.',
              },
            ],
          }),
          stopReason: 'end_turn',
          usage: null,
          model: 'test-stub',
        },
      }),
    };
    const res = await runTriage({
      workspaceId: WS,
      fetcher: new JsonTriageFetcher({ workspaceId: WS, snapshot: triageSnapshot() }),
      llm: stubLlm,
      now: new Date('2026-06-07T09:00:00.000Z'),
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    const [p] = res.value.proposals;
    assert.equal(p.priority, 'customer-active');
    assert.match(p.reasoning, /LLM:/);
    assert.match(res.value.noOutboundNote, /classified per-message by LLM/);
  });

  it('no LLM provided → deterministic keyword fallback (no LLM call)', async () => {
    const res = await runTriage({
      workspaceId: WS,
      fetcher: new JsonTriageFetcher({ workspaceId: WS, snapshot: triageSnapshot() }),
      now: new Date('2026-06-07T09:00:00.000Z'),
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    const [p] = res.value.proposals;
    // No cue + below floor → noise. Reasoning is NOT prefixed with "LLM:".
    assert.equal(p.priority, 'noise');
    assert.equal(/LLM:/.test(p.reasoning), false);
  });

  it('LLM error → falls back to keyword classifier per message', async () => {
    const errLlm: LlmProvider = {
      name: 'test',
      complete: async () => ({
        ok: false,
        error: { code: 'UPSTREAM_ERROR', message: 'boom' },
      }),
    };
    const res = await runTriage({
      workspaceId: WS,
      fetcher: new JsonTriageFetcher({ workspaceId: WS, snapshot: triageSnapshot() }),
      llm: errLlm,
      now: new Date('2026-06-07T09:00:00.000Z'),
    });
    assert.ok(res.ok);
    if (!res.ok) return;
    const [p] = res.value.proposals;
    assert.equal(p.priority, 'noise'); // keyword fallback
    assert.match(res.value.noOutboundNote, /keyword classifier used/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Lead-triage auto-pushes first-touch drafts for HOT/WARM leads.
// ─────────────────────────────────────────────────────────────────────────

function hotLeadMessages(): ParsedMessage[] {
  const base = new Date('2026-06-07T09:00:00.000Z');
  const mk = (over: Partial<ParsedMessage>): ParsedMessage => ({
    id: 'lm',
    threadId: 'lt',
    rfcMessageId: '<l@example.com>',
    fromEmail: 'lead@example.com',
    fromName: 'Lead',
    toEmails: ['broker@example.com'],
    ccEmails: [],
    subject: 'Inquiry',
    bodyText: 'hello',
    snippet: 'hello',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: base,
    labels: ['INBOX'],
    ...over,
  });
  return [
    mk({
      id: 'lead-hot',
      fromEmail: 'serious.buyer@example.com',
      fromName: 'Serious Buyer',
      subject: 'Ready to make an offer',
      bodyText:
        'We are ready to buy and want to make an offer. We are pre-approved ' +
        'and want to tour this week. Serious buyers, ready to buy.',
    }),
    mk({
      id: 'lead-cold',
      fromEmail: 'browser@example.com',
      fromName: 'Casual Browser',
      subject: 'Just browsing',
      bodyText: 'Just browsing, not in a rush, no rush at all. Just exploring.',
    }),
  ];
}

class StubFetchAdapter {
  readonly name = 'stub-adapter' as const;
  constructor(private readonly messages: ParsedMessage[]) {}
  async fetchMessagesForEvent(): Promise<SkillResult<ParsedMessage[]>> {
    return skillOk(this.messages);
  }
  async fetchThreadMessages(): Promise<SkillResult<ParsedMessage[]>> {
    return skillOk([]);
  }
}

describe('wave-2 #10 — lead-triage first-touch draft auto-push', () => {
  it('hot lead → draft pushed to the persister; cold lead → not pushed', async () => {
    const persister = new FixtureLeadDraftPersister();
    const res = await runLeadTriageForEvent({
      workspaceId: WS,
      fetcher: new StubFetchAdapter(hotLeadMessages()) as never,
      event: fakeEvent(),
      // Heuristic-only — no Prisma / LLM in the test.
      memory: null,
      llm: null,
      // In-memory recording persister (asserts what would be pushed).
      persister,
      // Recording sink to skip Prisma.
      sink: {
        name: 'recording',
        record: async () => skillOk({ sinkId: 'rec-1' }),
      },
    });
    assert.ok(res.ok);
    if (!res.ok) return;

    const triaged = res.value.triage.triaged;
    const hot = triaged.find((t) => t.leadId === 'lead-hot');
    const cold = triaged.find((t) => t.leadId === 'lead-cold');
    assert.ok(hot, 'hot lead triaged');
    assert.ok(cold, 'cold lead triaged');

    // Hot/warm draft (confidence >= 0.7) was persisted.
    assert.equal(hot!.category === 'hot' || hot!.category === 'warm', true);
    assert.equal(hot!.firstTouchDraft?.persisted, true);
    assert.ok(hot!.firstTouchDraft?.providerDraftId);

    // Cold draft below 0.7 threshold — generated but NOT persisted.
    assert.equal(cold!.category === 'cold' || cold!.category === 'nurture', true);
    assert.equal(cold!.firstTouchDraft?.persisted, false);

    // Exactly one draft hit the persister (the hot one).
    assert.equal(persister.drafts.length, 1);
    assert.equal(persister.drafts[0].toEmails[0], 'serious.buyer@example.com');
  });

  it('flag-off default uses the FIXTURE persister (no live mailbox write)', async () => {
    const prev = process.env.LIVE_INBOX_FETCH;
    delete process.env.LIVE_INBOX_FETCH;
    try {
      const res = await runLeadTriageForEvent({
        workspaceId: WS,
        fetcher: new StubFetchAdapter(hotLeadMessages()) as never,
        event: fakeEvent(),
        memory: null,
        llm: null,
        // No persister override → run-for-event builds via the factory.
        // No draftAdapter + flag off → fixture persister. The draft still
        // gets a providerDraftId (fixture-issued), proving the seam ran
        // without touching a live mailbox.
        sink: {
          name: 'recording',
          record: async () => skillOk({ sinkId: 'rec-1' }),
        },
      });
      assert.ok(res.ok);
      if (!res.ok) return;
      const hot = res.value.triage.triaged.find((t) => t.leadId === 'lead-hot');
      assert.ok(hot);
      assert.equal(hot!.firstTouchDraft?.persisted, true);
      assert.match(hot!.firstTouchDraft?.providerDraftId ?? '', /^fixture-lead-draft-/);
    } finally {
      if (prev !== undefined) process.env.LIVE_INBOX_FETCH = prev;
    }
  });
});
