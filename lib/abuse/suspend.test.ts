/**
 * lib/abuse/suspend.test.ts
 *
 * Contract pins for the suspend/appeal state machine. The whole decision core
 * is pure (state in, `now` in, decision out), so these run deterministically
 * with no clock and no I/O. Key invariants:
 *   - a SOFT_SUSPEND signal soft-suspends + opens a 24h window + emails owner;
 *   - an appeal upheld FULLY restores; an appeal rejected HARD-suspends;
 *   - HARD suspend never happens silently from "more signals" alone;
 *   - the review window can expire (input to escalation) but does not
 *     auto-escalate by itself.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decideOnAbuse,
  submitAppeal,
  resolveAppeal,
  confirmAbuse,
  reviewWindowExpired,
  emptySuspension,
  isReadOnly,
  isHardSuspended,
  InMemorySuspensionStore,
  type SuspensionRecord,
} from './suspend';
import type { AbuseSignal } from './detector';

const T0 = new Date('2026-06-17T00:00:00.000Z');
const hoursLater = (h: number) => new Date(T0.getTime() + h * 3600_000);

function signal(action: AbuseSignal['recommendedAction'], severity: AbuseSignal['severity'] = 'HIGH'): AbuseSignal {
  return {
    category: 'SCRAPING',
    severity,
    rule: 'fetch-rate',
    reason: 'high fetch rate',
    recommendedAction: action,
  };
}

describe('decideOnAbuse', () => {
  it('soft-suspends on a SOFT_SUSPEND signal and opens a 24h window', () => {
    const d = decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('SOFT_SUSPEND')],
      now: T0,
    });
    assert.equal(d.changed, true);
    assert.equal(d.record.state, 'SOFT');
    assert.equal(d.record.softSuspendedAt, T0.toISOString());
    assert.equal(d.record.reviewWindowEndsAt, hoursLater(24).toISOString());
    assert.equal(isReadOnly(d.record), true);
    // emits an owner email + Conner notice
    assert.equal(d.effects.some((e) => e.type === 'EMAIL_OWNER'), true);
    assert.equal(d.effects.some((e) => e.type === 'NOTIFY_CONNER'), true);
  });

  it('does not suspend on a first-time FLAG (left to operator review)', () => {
    const d = decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('FLAG')],
      now: T0,
    });
    assert.equal(d.changed, false);
    assert.equal(d.record.state, 'NONE');
  });

  it('soft-suspends on a FLAG when the workspace is a repeat offender', () => {
    const existing: SuspensionRecord = {
      ...emptySuspension('ws-1'),
      priorSoftSuspensions: 1,
    };
    const d = decideOnAbuse({ existing, signals: [signal('FLAG')], now: T0 });
    assert.equal(d.record.state, 'SOFT');
    assert.equal(d.record.priorSoftSuspensions, 2);
  });

  it('no signals → no change', () => {
    const d = decideOnAbuse({ existing: emptySuspension('ws-1'), signals: [], now: T0 });
    assert.equal(d.changed, false);
    assert.equal(d.record.state, 'NONE');
  });

  it('accumulates evidence while already SOFT without re-emailing', () => {
    const soft = decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('SOFT_SUSPEND')],
      now: T0,
    }).record;
    const again = decideOnAbuse({
      existing: soft,
      signals: [{ ...signal('SOFT_SUSPEND'), rule: 'automation-user-agent' }],
      now: hoursLater(1),
    });
    assert.equal(again.record.state, 'SOFT');
    assert.equal(again.effects.length, 0); // no second email
    assert.equal(again.record.rules.includes('automation-user-agent'), true);
  });

  it('honors a custom review-window length', () => {
    const d = decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('SOFT_SUSPEND')],
      now: T0,
      reviewWindowHours: 48,
    });
    assert.equal(d.record.reviewWindowEndsAt, hoursLater(48).toISOString());
  });
});

describe('appeals', () => {
  function softRecord(): SuspensionRecord {
    return decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('SOFT_SUSPEND')],
      now: T0,
    }).record;
  }

  it('an upheld appeal fully restores access', () => {
    const appealed = submitAppeal(softRecord(), 'This was our QA bot — fixed.', hoursLater(2));
    assert.equal(appealed.record.appeal?.outcome, 'PENDING');

    const resolved = resolveAppeal(appealed.record, 'UPHELD', hoursLater(3), 'Verified benign.');
    assert.equal(resolved.record.state, 'NONE');
    assert.equal(isReadOnly(resolved.record), false);
    assert.equal(resolved.record.appeal?.outcome, 'UPHELD');
    assert.equal(resolved.effects.some((e) => e.type === 'EMAIL_OWNER'), true);
    // prior-suspension counter is retained for repeat-offender tracking
    assert.equal(resolved.record.priorSoftSuspensions, 1);
  });

  it('a rejected appeal hard-suspends with data preserved + Conner notice', () => {
    const appealed = submitAppeal(softRecord(), 'no comment', hoursLater(2));
    const resolved = resolveAppeal(appealed.record, 'REJECTED', hoursLater(3));
    assert.equal(resolved.record.state, 'HARD');
    assert.equal(isHardSuspended(resolved.record), true);
    assert.equal(resolved.record.hardSuspendedAt, hoursLater(3).toISOString());
    assert.equal(
      resolved.effects.some((e) => e.type === 'NOTIFY_CONNER' && e.severity === 'HIGH'),
      true,
    );
  });

  it('appeals only apply while SOFT', () => {
    const none = submitAppeal(emptySuspension('ws-1'), 'hi', T0);
    assert.equal(none.changed, false);
  });
});

describe('hard suspend never happens silently', () => {
  it('more signals against a SOFT record do not escalate to HARD on their own', () => {
    const soft = decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('SOFT_SUSPEND')],
      now: T0,
    }).record;
    const more = decideOnAbuse({
      existing: soft,
      signals: [signal('SOFT_SUSPEND'), signal('SOFT_SUSPEND')],
      now: hoursLater(5),
    });
    assert.equal(more.record.state, 'SOFT'); // still soft — needs explicit confirm
  });

  it('confirmAbuse is the explicit operator path to HARD', () => {
    const soft = decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('SOFT_SUSPEND')],
      now: T0,
    }).record;
    const hard = confirmAbuse(soft, hoursLater(6), 'Confirmed scraping.');
    assert.equal(hard.record.state, 'HARD');
  });
});

describe('reviewWindowExpired', () => {
  it('is false before the window ends', () => {
    const soft = decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('SOFT_SUSPEND')],
      now: T0,
    }).record;
    assert.equal(reviewWindowExpired(soft, hoursLater(23)), false);
  });

  it('is true after the window ends with no upheld appeal', () => {
    const soft = decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('SOFT_SUSPEND')],
      now: T0,
    }).record;
    assert.equal(reviewWindowExpired(soft, hoursLater(25)), true);
  });

  it('is paused while a pending appeal is open', () => {
    const soft = decideOnAbuse({
      existing: emptySuspension('ws-1'),
      signals: [signal('SOFT_SUSPEND')],
      now: T0,
    }).record;
    const appealed = submitAppeal(soft, 'pending', hoursLater(2)).record;
    assert.equal(reviewWindowExpired(appealed, hoursLater(25)), false);
  });
});

describe('InMemorySuspensionStore', () => {
  it('round-trips a record and defaults to empty', async () => {
    const store = new InMemorySuspensionStore();
    assert.equal((await store.read('ws-new')).state, 'NONE');
    const rec = { ...emptySuspension('ws-1'), state: 'SOFT' as const };
    await store.write(rec);
    assert.equal((await store.read('ws-1')).state, 'SOFT');
  });
});
