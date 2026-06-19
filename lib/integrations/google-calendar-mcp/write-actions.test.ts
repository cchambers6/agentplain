/**
 * lib/integrations/google-calendar-mcp/write-actions.test.ts
 *
 * Smoke test for the Google Calendar write-action depth + approval gate. Builds
 * the server through the real factory (`buildGoogleCalendarMcpServer`) with an
 * injected in-memory gate + audit sink — exactly how production wires it, minus
 * the DB — so it proves the factory seam gates every mutation, that an approved
 * grant lets the (recording) call run, and that every fire is audit-logged.
 * `find_availability` (a free/busy READ) passes through ungated. No external API
 * is touched.
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
import { buildGoogleCalendarMcpServer } from './index';
import {
  BOOK_MEETING,
  calendarAction,
  type BookMeetingInput,
} from './actions';

function setup() {
  const gate = new InMemoryConnectorApprovalGate();
  const audit = new InMemoryConnectorActionAuditSink();
  const server = buildGoogleCalendarMcpServer({
    workspaceId: 'ws-1',
    deps: { gate, audit },
  });
  return { gate, audit, server };
}

const T0 = '2026-07-01T15:00:00.000Z';
const T1 = '2026-07-01T15:30:00.000Z';

test('book_meeting is blocked without an approval — Google never called', async () => {
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
  assert.equal(audit.entries[0].connector, 'google_calendar');
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

test('listEvents passes through the gate untouched', async () => {
  const { server } = setup();
  const res = await server.listEvents({
    from: new Date(T0),
    to: new Date(T1),
  });
  assert.equal(res.ok, true);
});
