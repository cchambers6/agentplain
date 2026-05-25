/**
 * lib/skills/chief-of-staff-scheduler/skill.test.ts
 *
 * Pins the chief-of-staff behavior:
 *   - PROPOSES meetings against open calendar slots (never overbooks busy ones)
 *   - PROPOSES reply drafts for stale inbound (defers content to merge fields)
 *   - PROPOSES to-dos for explicit ask cues (dedupes against existing todos)
 *   - NEVER executes — no booking, no sending, no third-party task writes
 *   - Every proposal lands in the approval sink with status=PENDING
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSkill } from './skill';
import { JsonChiefOfStaffFetcher } from './json-fetcher';
import { RecordingApprovalSink } from './approval-sink';
import type {
  CalendarEvent,
  ChiefOfStaffSnapshot,
  InboxMessage,
  TodoItem,
} from './types';

const WORKSPACE_ID = 'ws-cos-0001';
// Monday May 18 2026, 08:00 UTC (well before business hours start at 09:00).
const NOW = new Date('2026-05-18T08:00:00.000Z');

function snapshot(overrides: Partial<ChiefOfStaffSnapshot> = {}): ChiefOfStaffSnapshot {
  return {
    localTimezone: 'America/New_York',
    events: [],
    inbox: [],
    todos: [],
    ...overrides,
  };
}

function inboxMsg(overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    fromEmail: 'jane@example.com',
    fromName: 'Jane Doe',
    subject: 'Hello',
    bodyText: 'Just checking in.',
    receivedAt: new Date(NOW.getTime() - 8 * 60 * 60 * 1000), // 8h ago
    ...overrides,
  };
}

function busyEvent(start: string, end: string, title = 'Existing meeting'): CalendarEvent {
  return {
    id: `evt-${start}`,
    title,
    startUtc: new Date(start),
    endUtc: new Date(end),
    isBusy: true,
  };
}

function todo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 'todo-1',
    title: 'Some open task',
    contextText: 'context',
    status: 'open',
    ...overrides,
  };
}

function fetcher(snap: ChiefOfStaffSnapshot): JsonChiefOfStaffFetcher {
  return new JsonChiefOfStaffFetcher({ workspaceId: WORKSPACE_ID, snapshot: snap });
}

describe('chief-of-staff-scheduler — no-outbound contract', () => {
  it('every proposal lands with status=PENDING — none are auto-executed', async () => {
    const sink = new RecordingApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'meet-req',
              subject: 'Can we meet next week?',
              bodyText: 'Would love to find a time to talk about the proposal.',
              needsMeeting: true,
            }),
            inboxMsg({
              id: 'stale',
              threadId: 'stale-thread',
              subject: 'Quick question',
              bodyText: 'When you have a moment — just had a question about pricing.',
              receivedAt: new Date(NOW.getTime() - 30 * 60 * 60 * 1000), // 30h ago
            }),
            inboxMsg({
              id: 'ask',
              threadId: 'ask-thread',
              subject: 'Action required: send the deck',
              bodyText:
                'Please send the deck from yesterday so I can review before Friday.',
            }),
          ],
        }),
      ),
      sink,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Every proposal recorded with PENDING — no other status escapes.
    assert.ok(sink.calls.length > 0, 'sink should have recorded at least one proposal');
    for (const call of sink.calls) {
      assert.equal(call.proposal.status, 'PENDING');
    }
    // The honest no-outbound note is on the output, surfacing the contract
    // to operators / audit logs.
    assert.match(res.value.noOutboundNote, /No meetings booked/);
    assert.match(res.value.noOutboundNote, /no emails sent/);
  });

  it('does not propose a meeting slot that overlaps a busy event', async () => {
    const sink = new RecordingApprovalSink();
    // Calendar entirely busy 09:00-17:00 UTC on Mon 18 + Tue 19 + Wed 20.
    const events: CalendarEvent[] = [];
    for (const day of ['2026-05-18', '2026-05-19', '2026-05-20']) {
      events.push(
        busyEvent(`${day}T09:00:00.000Z`, `${day}T17:00:00.000Z`, 'Solid block'),
      );
    }
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      lookaheadDays: 3,
      fetcher: fetcher(
        snapshot({
          events,
          inbox: [
            inboxMsg({
              id: 'busy-week',
              needsMeeting: true,
              subject: 'Time to chat?',
              bodyText: 'Hoping to find 30 minutes.',
            }),
          ],
        }),
      ),
      sink,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Either zero candidate slots or all candidate slots fall OUTSIDE the
    // 09:00-17:00 UTC block on those three days.
    for (const m of res.value.meetingProposals) {
      for (const slot of m.candidateSlots) {
        // Slot strings are local-tz-as-UTC; the block is the same.
        const blockDays = ['2026-05-18', '2026-05-19', '2026-05-20'];
        if (blockDays.some((d) => slot.startLocal.startsWith(d))) {
          assert.fail(
            `slot ${slot.startLocal} falls inside a known-busy block day`,
          );
        }
      }
    }
  });

  it('never proposes a slot on a non-workday', async () => {
    const sink = new RecordingApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      lookaheadDays: 14,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'weekend-ask',
              needsMeeting: true,
              subject: 'Quick sync',
              bodyText: 'Find a time?',
            }),
          ],
        }),
      ),
      sink,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    for (const m of res.value.meetingProposals) {
      for (const slot of m.candidateSlots) {
        assert.notEqual(slot.dayOfWeek, 'saturday');
        assert.notEqual(slot.dayOfWeek, 'sunday');
      }
    }
  });
});

describe('chief-of-staff-scheduler — meeting proposals', () => {
  it('proposes meeting slots when an inbox message is flagged needsMeeting', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'explicit',
              needsMeeting: true,
              subject: 'Can we connect',
              bodyText: 'Would love to chat.',
            }),
          ],
        }),
      ),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.meetingProposals.length, 1);
    const m = res.value.meetingProposals[0];
    assert.equal(m.kind, 'meeting');
    assert.equal(m.status, 'PENDING');
    assert.ok(m.candidateSlots.length >= 1, 'should propose at least one slot');
    assert.ok(m.candidateSlots.length <= 3, 'should propose no more than 3 slots');
    assert.match(m.inviteBody, /\{\{operator: confirm slot before sending/);
    assert.match(
      m.inviteBody,
      /chief-of-staff has NOT booked/,
      'invite must explicitly state nothing was booked',
    );
  });

  it('detects implicit scheduling cues when no flag is set', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'implicit',
              subject: 'Catching up',
              bodyText: 'Can we meet sometime this week to discuss next steps?',
            }),
          ],
        }),
      ),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.meetingProposals.length, 1);
    assert.ok(
      res.value.meetingProposals[0].confidence <
        0.7 /* implicit cues land lower than explicit */,
    );
  });
});

describe('chief-of-staff-scheduler — reply drafts', () => {
  it('drafts replies for stale (> 4h) inbound that does not need a meeting', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'stale-1',
              receivedAt: new Date(NOW.getTime() - 10 * 60 * 60 * 1000),
              subject: 'Pricing question',
              bodyText: 'What are your rates for a 6-week engagement?',
            }),
          ],
        }),
      ),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.replyDraftProposals.length, 1);
    const draft = res.value.replyDraftProposals[0];
    // Substantive answer ALWAYS deferred to an {{operator: ...}} merge field.
    assert.match(draft.body, /\{\{operator: substantive response/);
    assert.match(draft.body, /\{\{operator: signature\}\}/);
    // Subject prefixed Re: when not already.
    assert.match(draft.subject, /^Re: /);
  });

  it('does NOT draft a reply when the message also triggered a meeting', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'both',
              receivedAt: new Date(NOW.getTime() - 10 * 60 * 60 * 1000),
              subject: 'Want to chat',
              bodyText: 'Can we set up a meeting to talk about Q3?',
              needsMeeting: true,
            }),
          ],
        }),
      ),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Meeting proposal yes, reply draft no — the invite IS the reply.
    assert.equal(res.value.meetingProposals.length, 1);
    assert.equal(res.value.replyDraftProposals.length, 0);
  });

  it('does NOT redraft when an open draft already exists', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'has-draft',
              receivedAt: new Date(NOW.getTime() - 20 * 60 * 60 * 1000),
              subject: 'Status update',
              bodyText: 'Where are we on the deck?',
              hasOpenReplyDraft: true,
            }),
          ],
        }),
      ),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.replyDraftProposals.length, 0);
  });

  it('lowers confidence on very-stale (> 72h) threads', async () => {
    const freshRes = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'fresh-stale',
              receivedAt: new Date(NOW.getTime() - 6 * 60 * 60 * 1000),
              subject: 'Q',
              bodyText: 'Quick question.',
            }),
          ],
        }),
      ),
    });
    const veryStaleRes = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'very-stale',
              receivedAt: new Date(NOW.getTime() - 80 * 60 * 60 * 1000),
              subject: 'Q',
              bodyText: 'Quick question.',
            }),
          ],
        }),
      ),
    });
    assert.ok(freshRes.ok && veryStaleRes.ok);
    if (!freshRes.ok || !veryStaleRes.ok) return;
    assert.ok(
      veryStaleRes.value.replyDraftProposals[0].confidence <
        freshRes.value.replyDraftProposals[0].confidence,
      'very-stale draft must carry lower confidence than fresh-stale draft',
    );
  });
});

describe('chief-of-staff-scheduler — to-do proposals', () => {
  it('proposes to-dos for explicit ask cues', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'ask',
              subject: 'Could you share the report',
              bodyText: 'Please share the latest deck from last week so I can review.',
            }),
          ],
        }),
      ),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.todoProposals.length, 1);
    const t = res.value.todoProposals[0];
    assert.match(t.title, /^Follow up:/);
    assert.equal(t.status, 'PENDING');
    assert.equal(t.sourceMessageId, 'ask');
  });

  it('dedupes a to-do that matches an existing open todo', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'ask-dup',
              subject: 'Follow up: Please send the deck',
              bodyText: 'Please send the deck.',
            }),
          ],
          todos: [todo({ title: 'Follow up: Please send the deck' })],
        }),
      ),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.todoProposals.length, 0);
  });

  it('does NOT propose a to-do when no ask cue is present', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'chatty',
              subject: 'Catching up',
              bodyText: 'Just wanted to say hello — no need to respond.',
            }),
          ],
        }),
      ),
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.todoProposals.length, 0);
  });
});

describe('chief-of-staff-scheduler — sink behavior', () => {
  it('sinkThreshold suppresses low-confidence proposals from the sink', async () => {
    const sink = new RecordingApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      sinkThreshold: 0.65, // above the implicit-meeting confidence (0.58)
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'implicit',
              subject: 'Quick chat',
              bodyText: 'Could we find a time to chat next week?',
            }),
          ],
        }),
      ),
      sink,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // Proposal still appears in the typed output…
    assert.equal(res.value.meetingProposals.length, 1);
    // …but the sink shows nothing (below threshold).
    assert.equal(sink.calls.length, 0);
    assert.equal(res.value.sunk, 0);
  });

  it('omitting the sink still produces typed proposals (no persistence required)', async () => {
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      fetcher: fetcher(
        snapshot({
          inbox: [
            inboxMsg({
              id: 'no-sink',
              receivedAt: new Date(NOW.getTime() - 10 * 60 * 60 * 1000),
              subject: 'Ping',
              bodyText: 'Just a ping.',
            }),
          ],
        }),
      ),
      // sink omitted
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.value.sunk, 0);
    assert.equal(res.value.replyDraftProposals.length, 1);
  });
});

describe('chief-of-staff-scheduler — end-to-end on demo seed', () => {
  it('produces meeting + reply + todo proposals together against a realistic seed', async () => {
    const sink = new RecordingApprovalSink();
    const res = await runSkill({
      workspaceId: WORKSPACE_ID,
      now: NOW,
      lookaheadDays: 5,
      fetcher: fetcher(
        snapshot({
          localTimezone: 'America/New_York',
          events: [
            busyEvent('2026-05-19T13:00:00.000Z', '2026-05-19T14:00:00.000Z', 'Standup'),
            busyEvent('2026-05-20T15:00:00.000Z', '2026-05-20T16:00:00.000Z', 'Client call'),
          ],
          inbox: [
            inboxMsg({
              id: 'meet-1',
              threadId: 't-meet-1',
              fromEmail: 'partner@example.com',
              fromName: 'Sam Partner',
              subject: 'Q3 planning',
              bodyText: 'Can we set up a meeting to talk about Q3 priorities?',
              needsMeeting: true,
            }),
            inboxMsg({
              id: 'stale-1',
              threadId: 't-stale-1',
              fromEmail: 'vendor@example.com',
              fromName: 'Vendor Co',
              subject: 'Invoice question',
              bodyText: 'When you have a moment — wanted to confirm the invoice number.',
              receivedAt: new Date(NOW.getTime() - 28 * 60 * 60 * 1000),
            }),
            inboxMsg({
              id: 'ask-1',
              threadId: 't-ask-1',
              fromEmail: 'team@example.com',
              fromName: 'Teammate',
              subject: 'Action required',
              bodyText: 'Could you share the contract draft from last week?',
              // Fresh inbound — within the 4h reply-draft floor so it
              // ONLY triggers a todo (the more durable action), not a
              // reply ack at the same time.
              receivedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
            }),
          ],
          todos: [todo({ title: 'Send weekly summary', id: 'todo-existing' })],
        }),
      ),
      sink,
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    // One meeting, one reply, one todo — the three classes the chief-of-
    // staff is supposed to surface.
    assert.equal(res.value.meetingProposals.length, 1);
    assert.equal(res.value.replyDraftProposals.length, 1);
    assert.equal(res.value.todoProposals.length, 1);
    // Sink captured all three.
    assert.equal(sink.calls.length, 3);
    assert.equal(res.value.sunk, 3);
    assert.equal(sink.byKind('meeting').length, 1);
    assert.equal(sink.byKind('reply-draft').length, 1);
    assert.equal(sink.byKind('todo').length, 1);
    // Counters honest about what was scanned.
    assert.equal(res.value.inboxScanned, 3);
    assert.equal(res.value.eventsScanned, 2);
    assert.equal(res.value.todosScanned, 1);
  });
});
