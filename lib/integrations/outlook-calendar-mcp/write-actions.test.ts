/**
 * lib/integrations/outlook-calendar-mcp/write-actions.test.ts
 *
 * Smoke test for the Outlook Calendar write-action depth + approval gate.
 * Builds the server through the real factory (`buildOutlookCalendarMcpServer`)
 * with an injected in-memory gate + audit sink — exactly how production wires
 * it, minus the DB — so it proves the factory seam gates every mutation, that
 * an approved grant lets the (recording) call run, and that every fire is
 * audit-logged. The reads (`find_availability`, `propose_times`, `listEvents`,
 * `getEvent`, `listCalendars`) pass through ungated. No external API is
 * touched.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Build the in-memory recording server (canned success) rather than the prod
// REST server — the gate seam is identical, and no external API is hit.
process.env.INTEGRATIONS_PROVIDER = 'test';

import {
  InMemoryConnectorApprovalGate,
  InMemoryConnectorActionAuditSink,
} from '@/lib/integrations/approval';
import { buildOutlookCalendarMcpServer } from './index';
import {
  BOOK_MEETING,
  UPDATE_EVENT,
  CANCEL_EVENT,
  calendarAction,
  type BookMeetingInput,
  type UpdateEventInput,
  type CancelEventInput,
} from './actions';
import type { TestOutlookCalendarSeed } from './test-server';

function setup(testSeed?: TestOutlookCalendarSeed) {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  const server = buildOutlookCalendarMcpServer({
    workspaceId: 'ws-1',
    deps: { gate, audit },
    testSeed,
  });
  return { gate, audit, server };
}

const T0 = '2026-07-01T15:00:00.000Z';
const T1 = '2026-07-01T15:30:00.000Z';

test('book_meeting is blocked without an approval — Graph never called', async () => {
  const { server, audit } = setup();
  const res = await server.bookMeeting({
    summary: 'Listing walkthrough',
    start: T0,
    end: T1,
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('book_meeting runs once approved, and is audit-logged', async () => {
  const { server, gate, audit } = setup();
  const input: BookMeetingInput = {
    summary: 'Listing walkthrough',
    start: T0,
    end: T1,
    attendees: ['buyer@example.com'],
    pendingApprovalId: 'ap-1',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: calendarAction(BOOK_MEETING, input),
    approvedByUserId: 'user-9',
  });
  const res = await server.bookMeeting(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && typeof res.value.eventId, 'string');
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].connector, 'outlook_calendar');
  assert.equal(audit.entries[0].action, 'book_meeting');
  assert.equal(audit.entries[0].outcome, 'ok');
  assert.equal(audit.entries[0].approvedByUserId, 'user-9');
});

test('a grant approved for one meeting cannot book a different one', async () => {
  const { server, gate } = setup();
  gate.seedApproved({
    pendingApprovalId: 'ap-1',
    workspaceId: 'ws-1',
    action: calendarAction(BOOK_MEETING, {
      summary: 'Listing walkthrough',
      start: T0,
      end: T1,
    }),
  });
  // Same token, different summary → fingerprint mismatch → blocked.
  const res = await server.bookMeeting({
    summary: 'Closing dinner',
    start: T0,
    end: T1,
    pendingApprovalId: 'ap-1',
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
});

test('reschedule_meeting is gated', async () => {
  const { server, audit } = setup();
  const res = await server.rescheduleMeeting({
    eventId: 'evt-7',
    start: T0,
    end: T1,
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'APPROVAL_REQUIRED');
  assert.equal(audit.entries.length, 0);
});

test('update_event is gated, and runs once approved', async () => {
  const { server, gate, audit } = setup();
  const input: UpdateEventInput = {
    eventId: 'evt-7',
    summary: 'Walkthrough (moved to lobby)',
    location: 'Lobby',
    pendingApprovalId: 'ap-2',
  };
  const blocked = await server.updateEvent({ eventId: 'evt-7', summary: 'x' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok === false && blocked.error.code, 'APPROVAL_REQUIRED');

  gate.seedApproved({
    pendingApprovalId: 'ap-2',
    workspaceId: 'ws-1',
    action: calendarAction(UPDATE_EVENT, input),
  });
  const res = await server.updateEvent(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && res.value.eventId, 'evt-7');
  assert.equal(audit.entries.at(-1)?.action, 'update_event');
});

test('update_event with start but no end fails INVALID_ARGUMENT (post-grant)', async () => {
  const { server, gate } = setup();
  const input: UpdateEventInput = {
    eventId: 'evt-7',
    start: T0,
    pendingApprovalId: 'ap-3',
  };
  gate.seedApproved({
    pendingApprovalId: 'ap-3',
    workspaceId: 'ws-1',
    action: calendarAction(UPDATE_EVENT, input),
  });
  const res = await server.updateEvent(input);
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'INVALID_ARGUMENT');
});

test('cancel_event is gated, and runs once approved', async () => {
  const { server, gate, audit } = setup();
  const input: CancelEventInput = { eventId: 'evt-9', pendingApprovalId: 'ap-4' };
  const blocked = await server.cancelEvent({ eventId: 'evt-9' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok === false && blocked.error.code, 'APPROVAL_REQUIRED');

  gate.seedApproved({
    pendingApprovalId: 'ap-4',
    workspaceId: 'ws-1',
    action: calendarAction(CANCEL_EVENT, input),
  });
  const res = await server.cancelEvent(input);
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && res.value.cancelled, true);
  assert.equal(audit.entries.at(-1)?.action, 'cancel_event');
});

test('find_availability (free/busy READ) passes through ungated', async () => {
  const { server, audit } = setup();
  const res = await server.findAvailability({
    timeMin: T0,
    timeMax: T1,
  });
  assert.equal(res.ok, true);
  assert.equal(res.ok === true && Array.isArray(res.value.busy), true);
  // A read must never produce an audit row.
  assert.equal(audit.entries.length, 0);
});

test('propose_times proposes around seeded busy blocks, ungated', async () => {
  const { server, audit } = setup({
    busy: [{ start: '2026-07-01T15:00:00.000Z', end: '2026-07-01T16:00:00.000Z' }],
  });
  const res = await server.proposeTimes({
    timeMin: '2026-07-01T15:00:00.000Z',
    timeMax: '2026-07-01T17:00:00.000Z',
    durationMinutes: 30,
    maxProposals: 2,
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.deepEqual(res.value.proposals, [
      { start: '2026-07-01T16:00:00.000Z', end: '2026-07-01T16:30:00.000Z' },
      { start: '2026-07-01T16:30:00.000Z', end: '2026-07-01T17:00:00.000Z' },
    ]);
  }
  assert.equal(audit.entries.length, 0);
});

test('propose_times rejects a non-integer duration with INVALID_ARGUMENT', async () => {
  const { server } = setup();
  const res = await server.proposeTimes({
    timeMin: T0,
    timeMax: '2026-07-01T17:00:00.000Z',
    durationMinutes: 12.5,
  });
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.error.code, 'INVALID_ARGUMENT');
});

test('getEvent reads a seeded event; unknown id is NOT_FOUND', async () => {
  const { server } = setup({
    events: [
      {
        id: 'evt-1',
        title: 'Inspection',
        startUtc: T0,
        endUtc: T1,
        isBusy: true,
      },
    ],
  });
  const hit = await server.getEvent({ eventId: 'evt-1' });
  assert.equal(hit.ok, true);
  assert.equal(hit.ok === true && hit.value.event.title, 'Inspection');
  const miss = await server.getEvent({ eventId: 'evt-404' });
  assert.equal(miss.ok, false);
  assert.equal(miss.ok === false && miss.error.code, 'NOT_FOUND');
});

test('listEvents + listCalendars pass through the gate untouched', async () => {
  const { server } = setup();
  const events = await server.listEvents({
    from: new Date(T0),
    to: new Date(T1),
  });
  assert.equal(events.ok, true);
  const calendars = await server.listCalendars();
  assert.equal(calendars.ok, true);
  assert.equal(
    calendars.ok === true && calendars.value.calendars[0]?.isPrimary,
    true,
  );
});
