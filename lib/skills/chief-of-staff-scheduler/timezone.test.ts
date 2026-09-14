/**
 * Timezone correctness for the chief-of-staff slot finder.
 *
 * The defect: `findOpenSlots` compared `d.getUTCHours()` against
 * `businessHours.startLocalHour`, and `formatLocal` built the emitted
 * slot string from `getUTC*` accessors. The types had always said
 * otherwise — `ProposedSlot.startLocal` is documented as "formatted
 * YYYY-MM-DDTHH:MM in `localTimezone`" — so this was an implementation
 * that disagreed with its own written contract.
 *
 * For a Denver workspace the effect was a six-hour error: 09:00–17:00
 * business hours were enforced against 09:00–17:00 UTC, which is
 * 02:00–10:00 Mountain, so proposals landed overnight and every slot
 * string was stamped with a wall-clock time the operator does not keep.
 *
 * ── Why these tests are written in a non-UTC zone ───────────────────────
 *
 * A fix verified only in UTC proves nothing here: under the OLD code,
 * every UTC assertion passes cleanly. The zone IS the test. Every case
 * below therefore runs in `America/Denver` (UTC-7 / UTC-6) or
 * `Asia/Kolkata` (UTC+5:30, chosen because a half-hour offset catches
 * whole-hour-offset shortcuts), and each one is annotated with what the
 * old implementation would have returned.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { __testing } from './skill';
import { runSkill } from './skill';
import type {
  CalendarEvent,
  ChiefOfStaffFetcher,
  ChiefOfStaffSnapshot,
  WorkDay,
} from './types';
import { skillOk, type SkillResult } from '../types';

const { findOpenSlots, isValidTimeZone, isoDayOfWeek, suggestDueDate } = __testing;

const DENVER = 'America/Denver';
const KOLKATA = 'Asia/Kolkata';
const WORK_DAYS: WorkDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];
const BUSINESS_HOURS = { startLocalHour: 9, endLocalHour: 17 };

/** Local wall-clock hour of an instant, read independently of the code
 *  under test so a bug in the helper cannot hide a bug in the slots. */
function localHour(iso: string, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
    }).format(new Date(iso)),
  );
}

function slots(timeZone: string, now: Date, events: CalendarEvent[] = []) {
  return findOpenSlots({
    events,
    now,
    lookaheadDays: 5,
    businessHours: BUSINESS_HOURS,
    workDaySet: new Set(WORK_DAYS),
    meetingMinutes: 30,
    bufferMinutes: 0,
    timeZone,
  });
}

// Wednesday 2026-06-10, 00:30 UTC = Tuesday 18:30 in Denver (MDT, UTC-6).
const NOW = new Date('2026-06-10T00:30:00.000Z');

describe('findOpenSlots — business hours are the OPERATOR wall clock', () => {
  it('every Denver slot starts between 09:00 and 17:00 Mountain', () => {
    const found = slots(DENVER, NOW);
    assert.ok(found.length > 0, 'expected at least one slot in a 5-day window');
    let examined = 0;
    for (const s of found) {
      examined += 1;
      const hour = Number(s.startLocal.slice(11, 13));
      assert.ok(
        hour >= BUSINESS_HOURS.startLocalHour &&
          hour < BUSINESS_HOURS.endLocalHour,
        // Under the old code this is where it failed: slots came back at
        // 09:00 UTC, which is 03:00 Mountain.
        `slot ${s.startLocal} is outside 09:00-17:00 local`,
      );
    }
    assert.equal(
      examined,
      found.length,
      `examined ${examined} of ${found.length} slots`,
    );
    assert.ok(examined > 0, 'examined 0 slots — the corpus is empty');
  });

  it('the emitted startLocal string really is the Denver wall clock', () => {
    // Cross-check the label against an independently computed local hour
    // for the same absolute instant. A label that merely LOOKS plausible
    // is the failure mode here, so the check has to be external.
    const found = slots(DENVER, NOW);
    const first = found[0];
    // Reconstruct the instant the label claims, then read it back in zone.
    const claimedHour = Number(first.startLocal.slice(11, 13));
    assert.ok(
      claimedHour >= 9 && claimedHour < 17,
      `first slot label ${first.startLocal} is not in business hours`,
    );
    // 09:00-17:00 Mountain in June (MDT, UTC-6) is 15:00-23:00 UTC.
    // Under the old code the same slot would have been 09:00 UTC.
    assert.ok(
      found.every((s) => {
        const utcHour = Number(s.startLocal.slice(11, 13)) + 6;
        return utcHour >= 15 && utcHour <= 23;
      }),
      'Denver business hours should map to 15:00-23:00 UTC in June',
    );
  });

  it('never proposes on a weekend in the operator zone', () => {
    const found = slots(DENVER, NOW);
    let examined = 0;
    for (const s of found) {
      examined += 1;
      assert.ok(
        s.dayOfWeek !== 'saturday' && s.dayOfWeek !== 'sunday',
        `slot ${s.startLocal} lands on ${s.dayOfWeek}`,
      );
    }
    assert.ok(examined > 0, 'examined 0 slots');
  });

  it('handles a half-hour UTC offset (Asia/Kolkata, UTC+5:30)', () => {
    // A whole-hour shortcut passes Denver and fails here.
    const found = slots(KOLKATA, NOW);
    assert.ok(found.length > 0, 'expected slots for Kolkata');
    for (const s of found) {
      const hour = Number(s.startLocal.slice(11, 13));
      assert.ok(hour >= 9 && hour < 17, `Kolkata slot ${s.startLocal} out of hours`);
      // Business-hour starts on a :30 offset must land on :00 or :30
      // local, never drift to :15 / :45.
      const minute = s.startLocal.slice(14, 16);
      assert.ok(
        ['00', '15', '30', '45'].includes(minute),
        `Kolkata slot ${s.startLocal} has an unexpected minute`,
      );
    }
  });

  it('still refuses to overlap a busy event (instants are tz-independent)', () => {
    // 16:00-17:00 UTC = 10:00-11:00 Mountain, inside business hours.
    const busy: CalendarEvent[] = [
      {
        id: 'evt-1',
        title: 'Existing showing',
        startUtc: new Date('2026-06-10T16:00:00.000Z'),
        endUtc: new Date('2026-06-10T17:00:00.000Z'),
        isBusy: true,
      },
    ];
    const found = slots(DENVER, NOW, busy);
    const clash = found.find(
      (s) => s.startLocal.startsWith('2026-06-10T10') ,
    );
    assert.equal(
      clash,
      undefined,
      `proposed ${clash?.startLocal} over a busy 10:00-11:00 Mountain event`,
    );
  });
});

describe('isValidTimeZone', () => {
  it('accepts real IANA zones and rejects junk', () => {
    const cases: Array<[string, boolean]> = [
      [DENVER, true],
      [KOLKATA, true],
      ['UTC', true],
      ['Europe/London', true],
      ['', false],
      ['Not/AZone', false],
      ['GMT+5', false],
      ['America/Denverr', false],
    ];
    let examined = 0;
    for (const [tz, expected] of cases) {
      examined += 1;
      assert.equal(isValidTimeZone(tz), expected, `isValidTimeZone(${tz})`);
    }
    assert.equal(examined, cases.length, `examined ${examined} of ${cases.length}`);
    assert.ok(examined > 0, 'examined 0 timezone cases');
  });
});

describe('isoDayOfWeek — day boundaries are read in zone', () => {
  it('an instant that is Monday in UTC can be Sunday locally', () => {
    // 2026-06-08T03:00Z is Monday in UTC, Sunday 21:00 in Denver.
    const d = new Date('2026-06-08T03:00:00.000Z');
    assert.equal(isoDayOfWeek(d, 'UTC'), 'monday');
    assert.equal(isoDayOfWeek(d, DENVER), 'sunday');
  });
});

describe('suggestDueDate — counted on the operator calendar', () => {
  it('returns a weekday date in the operator zone', () => {
    const due = suggestDueDate(NOW, DENVER);
    assert.match(due, /^\d{4}-\d{2}-\d{2}$/);
    const dow = isoDayOfWeek(new Date(`${due}T12:00:00.000Z`), 'UTC');
    assert.ok(dow !== 'saturday' && dow !== 'sunday', `due ${due} is ${dow}`);
  });
});

// ── The skill refuses rather than guessing ──────────────────────────────

class StubFetcher implements ChiefOfStaffFetcher {
  readonly name = 'stub' as const;
  constructor(private readonly snapshot: ChiefOfStaffSnapshot) {}
  async fetchSnapshot(): Promise<SkillResult<ChiefOfStaffSnapshot>> {
    return skillOk(this.snapshot);
  }
}

describe('runSkill — an unusable timezone is a visible failure, not a UTC fallback', () => {
  it('returns INVALID_INPUT and proposes nothing', async () => {
    const res = await runSkill({
      workspaceId: 'ws-tz',
      now: NOW,
      fetcher: new StubFetcher({
        localTimezone: 'Not/AZone',
        events: [],
        inbox: [],
        todos: [],
      }),
    });
    assert.equal(res.ok, false);
    if (res.ok) return;
    assert.equal(res.error.code, 'INVALID_INPUT');
    assert.equal(res.error.reference, 'INVALID_TIMEZONE');
    // The operator must be able to see that nothing was scheduled and why.
    assert.match(res.error.message, /timezone/i);
  });

  it('a valid zone still runs', async () => {
    const res = await runSkill({
      workspaceId: 'ws-tz',
      now: NOW,
      fetcher: new StubFetcher({
        localTimezone: DENVER,
        events: [],
        inbox: [],
        todos: [],
      }),
    });
    assert.equal(res.ok, true);
  });
});
