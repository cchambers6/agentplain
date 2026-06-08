/**
 * Tests for `ChiefOfStaffMcpFetcher` — the production-shape
 * implementation of `ChiefOfStaffFetcher`. Composes the calendar
 * multiplexer with the wave-2 INBOX arm (real mailbox read behind the
 * `InboxSnapshotFetcher` seam) + an empty to-do arm, and surfaces
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
import type { ParsedMessage } from '../../types';
import type {
  InboxFetchArgs,
  InboxSnapshotFetcher,
} from '@/lib/integrations/inbox';

class StubInboxFetcher implements InboxSnapshotFetcher {
  readonly name = 'stub-inbox' as const;
  constructor(private readonly messages: ParsedMessage[]) {}
  async fetchInbox(_args: InboxFetchArgs): Promise<SkillResult<ParsedMessage[]>> {
    return skillOk(this.messages);
  }
}

function parsedMsg(overrides: Partial<ParsedMessage> = {}): ParsedMessage {
  return {
    id: 'pm-1',
    threadId: 'pt-1',
    rfcMessageId: '<pm-1@example.com>',
    fromEmail: 'lead@example.com',
    fromName: 'Lead Person',
    toEmails: ['owner@example.com'],
    ccEmails: [],
    subject: 'Can we find a time to meet?',
    bodyText: 'Want to schedule a call next week to discuss the proposal.',
    snippet: 'Want to schedule a call next week.',
    references: [],
    inReplyTo: null,
    attachments: [],
    receivedAt: new Date('2026-05-28T08:00:00.000Z'),
    labels: ['INBOX'],
    ...overrides,
  };
}

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

describe('ChiefOfStaffMcpFetcher — composes calendar events with inbox arm', () => {
  it('returns a snapshot with the calendar events surfaced; static inbox override stays empty', async () => {
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
      // Static `inbox: []` override = the explicit "no inbox" test pattern;
      // the inbox snapshot fetcher is NOT consulted.
      inbox: [],
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
    assert.equal(res.value.inbox.length, 0);
    assert.equal(res.value.todos.length, 0);
  });

  it('wave-2: reads the inbox arm via the injected InboxSnapshotFetcher', async () => {
    const fetcher = new ChiefOfStaffMcpFetcher({
      workspaceId: WORKSPACE_ID,
      calendarFetcher: new HappyCalendarFetcher([]),
      inboxFetcher: new StubInboxFetcher([
        parsedMsg({ id: 'pm-1' }),
        parsedMsg({ id: 'pm-2', subject: 'Invoice #99' }),
      ]),
    });
    const res = await fetcher.fetchSnapshot({
      workspaceId: WORKSPACE_ID,
      asOf: NOW,
      lookaheadDays: 7,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // The inbox arm surfaced both messages, mapped to InboxMessage shape.
    assert.equal(res.value.inbox.length, 2);
    assert.equal(res.value.inbox[0].id, 'pm-1');
    assert.equal(res.value.inbox[0].subject, 'Can we find a time to meet?');
  });

  it('wave-2: a failing inbox arm degrades to empty inbox, not a sweep failure', async () => {
    const failingInbox: InboxSnapshotFetcher = {
      name: 'failing-inbox',
      fetchInbox: async () =>
        skillError('UPSTREAM_GMAIL_ERROR', 'mailbox unreachable'),
    };
    const fetcher = new ChiefOfStaffMcpFetcher({
      workspaceId: WORKSPACE_ID,
      calendarFetcher: new HappyCalendarFetcher([
        {
          id: 'evt-keep',
          title: 'Keep me',
          startUtc: new Date('2026-05-29T15:00:00.000Z'),
          endUtc: new Date('2026-05-29T15:30:00.000Z'),
          isBusy: true,
        },
      ]),
      inboxFetcher: failingInbox,
    });
    const res = await fetcher.fetchSnapshot({
      workspaceId: WORKSPACE_ID,
      asOf: NOW,
      lookaheadDays: 7,
    });
    // Snapshot still OK — calendar proposals still ship; inbox is empty.
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.events.length, 1);
    assert.equal(res.value.inbox.length, 0);
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
