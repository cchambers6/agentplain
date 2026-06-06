/**
 * lib/skills/chief-of-staff-scheduler/buffer-minutes.test.ts
 *
 * Settings-behavior audit (feat/settings-behavior-audit-fix): proves the
 * /settings/skills → chief-of-staff `bufferMinutes` knob is now
 * LOAD-BEARING in slot search. Before this wave the field was badged
 * "saved" and `findOpenSlots` proposed back-to-back slots. Now a busy
 * event is padded by `bufferMinutes` on each side, so adjacent slots are
 * excluded.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { __testing } from './skill';
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_WORK_DAYS,
  type CalendarEvent,
} from './types';

const { findOpenSlots } = __testing;

// 2026-05-18 is a Monday (matches the sibling skill.test.ts fixtures).
const NOW = new Date('2026-05-18T08:00:00.000Z');

function busyEvent(start: string, end: string): CalendarEvent {
  return {
    id: `evt-${start}`,
    title: 'Existing meeting',
    startUtc: new Date(start),
    endUtc: new Date(end),
    isBusy: true,
  };
}

function slotsWithBuffer(bufferMinutes: number) {
  return findOpenSlots({
    events: [busyEvent('2026-05-18T10:00:00.000Z', '2026-05-18T10:30:00.000Z')],
    now: NOW,
    lookaheadDays: 1,
    businessHours: DEFAULT_BUSINESS_HOURS,
    workDaySet: new Set(DEFAULT_WORK_DAYS),
    meetingMinutes: 30,
    bufferMinutes,
  }).map((s) => s.startLocal);
}

describe('chief-of-staff — bufferMinutes pads busy events in slot search', () => {
  it('buffer 0 allows slots immediately adjacent to a busy event', () => {
    const starts = slotsWithBuffer(0);
    // A 30-min meeting fits right up against the 10:00-10:30 event.
    assert.ok(starts.includes('2026-05-18T09:30'), 'expected adjacent-before slot');
    assert.ok(starts.includes('2026-05-18T10:30'), 'expected adjacent-after slot');
  });

  it('buffer 15 excludes slots within 15 minutes of the busy event', () => {
    const starts = slotsWithBuffer(15);
    assert.ok(
      !starts.includes('2026-05-18T09:30'),
      'adjacent-before slot must be excluded by the buffer',
    );
    assert.ok(
      !starts.includes('2026-05-18T10:30'),
      'adjacent-after slot must be excluded by the buffer',
    );
    // A far-enough slot (09:00) is still offered.
    assert.ok(starts.includes('2026-05-18T09:00'), 'non-adjacent slot still offered');
  });

  it('a larger buffer never yields MORE slots than a smaller one', () => {
    assert.ok(slotsWithBuffer(30).length <= slotsWithBuffer(0).length);
  });
});
