/**
 * Tests for `ChiefOfStaffMcpFetcher` — the production-shape
 * implementation of `ChiefOfStaffFetcher`. Composes the calendar
 * multiplexer with empty inbox/todo arms (Wave 1 scope) and surfaces
 * NOT_CONFIGURED from the multiplexer cleanly so the skill's caller
 * can treat it as "needs connector" instead of a failure.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ChiefOfStaffMcpFetcher } from '../chief-of-staff-fetcher';
import type { CalendarFetcher } from '../types';
import type { CalendarEvent } from '../../chief-of-staff-scheduler/types';
import { runSkill } from '../../chief-of-staff-scheduler/skill';
import { skillError, skillOk, type SkillResult } from '../../types';

const WORKSPACE_ID = 'ws-cos-0001';
const NOW = new Date('2026-05-28T12:00:00.000Z');

class HappyCalendarFetcher implements CalendarFetcher {
  readonly name = 'happy-stub' as const;
  readonly provider = 'google' as const;
  constructor(private readonly events: CalendarEvent[]) {}
  async fetchEvents(): Promise<SkillResult<CalendarEvent[]>> {
    return skillOk(this.events);
  }
}

class NeedsConnectorFetcher implements CalendarFetcher {
  readonly name = 'needs-connector-stub' as const;
  readonly provider = null;
  async fetchEvents(): Promise<SkillResult<CalendarEvent[]>> {
    return skillError(
      'NOT_CONFIGURED',
      'No active GOOGLE or M365 IntegrationCredential for workspace.',
    );
  }
}

describe('ChiefOfStaffMcpFetcher — composes calendar events with empty inbox/todos', () => {
  it('returns a snapshot with the calendar events surfaced', async () => {
    const events: CalendarEvent[] = [
      {
        id: 'evt-1',
        title: 'Standup',
        startUtc: new Date('2026-05-29T13:00:00.000Z'),
        endUtc: new Date('2026-05-29T13:30:00.000Z'),
        isBusy: true,
      },
    ];
    const fetcher = new ChiefOfStaffMcpFetcher({
      workspaceId: WORKSPACE_ID,
      calendarFetcher: new HappyCalendarFetcher(events),
    });
    const res = await fetcher.fetchSnapshot({
      workspaceId: WORKSPACE_ID,
      asOf: NOW,
      lookaheadDays: 7,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.events.length, 1);
    assert.equal(res.value.events[0].id, 'evt-1');
    // Inbox + todos are explicit empty in Wave 1 — never fake.
    assert.equal(res.value.inbox.length, 0);
    assert.equal(res.value.todos.length, 0);
  });
});

describe('ChiefOfStaffMcpFetcher — needs-connector bubbles up cleanly', () => {
  it('forwards NOT_CONFIGURED so the skill can degrade without faking events', async () => {
    const fetcher = new ChiefOfStaffMcpFetcher({
      workspaceId: WORKSPACE_ID,
      calendarFetcher: new NeedsConnectorFetcher(),
    });
    const res = await fetcher.fetchSnapshot({
      workspaceId: WORKSPACE_ID,
      asOf: NOW,
      lookaheadDays: 7,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'NOT_CONFIGURED');
  });
});

describe('runSkill — NOT_CONFIGURED from fetcher preserves the error code', () => {
  it('does not re-map NOT_CONFIGURED to UPSTREAM_GMAIL_ERROR', async () => {
    const fetcher = new ChiefOfStaffMcpFetcher({
      workspaceId: WORKSPACE_ID,
      calendarFetcher: new NeedsConnectorFetcher(),
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    // The cron sweep keys off this exact code to count the workspace as
    // a clean skip. If this drifts, the cron starts mis-reporting and
    // the dashboards lie about how many workspaces are connected.
    assert.equal(res.error.code, 'NOT_CONFIGURED');
  });
});

describe('runSkill — happy path emits meeting proposal against real events', () => {
  it('proposes slots that do not overlap the calendar busy window', async () => {
    // Busy 13:00-14:00 on Wednesday (a Wed in May 2026 to ensure a
    // weekday slot is reachable in the lookahead).
    const events: CalendarEvent[] = [
      {
        id: 'busy-1',
        title: 'Conflicting meeting',
        startUtc: new Date('2026-05-29T13:00:00.000Z'),
        endUtc: new Date('2026-05-29T14:00:00.000Z'),
        isBusy: true,
      },
    ];
    const fetcher = new ChiefOfStaffMcpFetcher({
      workspaceId: WORKSPACE_ID,
      calendarFetcher: new HappyCalendarFetcher(events),
      // Seed an inbox message that explicitly wants a meeting so the
      // skill emits a proposal. Without it the test would assert zero
      // proposals, which is correct but less informative.
      inbox: [
        {
          id: 'msg-1',
          threadId: 'thread-1',
          fromEmail: 'jane@example.com',
          fromName: 'Jane',
          subject: 'Quick chat?',
          bodyText: 'Want to find a time to meet next week?',
          receivedAt: new Date(NOW.getTime() - 8 * 60 * 60 * 1000),
          needsMeeting: true,
        },
      ],
    });
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      fetcher,
      now: NOW,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.eventsScanned, 1);
    assert.equal(res.value.meetingProposals.length >= 1, true);
    // Critical no-overbook check: no proposed slot starts inside the
    // 13:00-14:00 UTC busy window.
    for (const p of res.value.meetingProposals) {
      for (const slot of p.candidateSlots) {
        const start = new Date(`${slot.startLocal}:00.000Z`);
        const overlaps =
          start.getTime() >= new Date('2026-05-29T13:00:00.000Z').getTime() &&
          start.getTime() < new Date('2026-05-29T14:00:00.000Z').getTime();
        assert.equal(overlaps, false, `proposed slot ${slot.startLocal} overlaps busy event`);
      }
    }
  });
});
