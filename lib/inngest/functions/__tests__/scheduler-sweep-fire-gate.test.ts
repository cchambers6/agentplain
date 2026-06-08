/**
 * lib/inngest/functions/__tests__/scheduler-sweep-fire-gate.test.ts
 *
 * Settings-behavior audit (feat/settings-behavior-audit-fix): proves the
 * chief-of-staff scheduler sweep now honors /settings/pause +
 * /settings/schedule via `gateSkillFire`. Before this wave the scheduler
 * sweep only checked the BILLING pause; a vacation pause or an off-hours
 * schedule window left it firing. The follow-up-chaser sweep already had
 * this gate — this pins parity for the scheduler.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { runSchedulerSweep } from '../scheduler-sweep';
import type { FireGateOutcome } from '@/lib/skills/fire-gate';
import type { CalendarFetcher } from '@/lib/skills/scheduler/types';
import type { CalendarEvent } from '@/lib/skills/chief-of-staff-scheduler/types';
import { skillOk, type SkillResult } from '@/lib/skills/types';
import type { ParsedMessage } from '@/lib/skills/types';
import type { InboxSnapshotFetcher } from '@/lib/integrations/inbox';

const WORKSPACE = '55555555-5555-5555-5555-555555555555';

class HappyCalendarFetcher implements CalendarFetcher {
  readonly name = 'happy-stub' as const;
  readonly provider = 'google' as const;
  async fetchEvents(): Promise<SkillResult<CalendarEvent[]>> {
    return skillOk([]);
  }
}

/** Wave-2: an empty inbox arm — keeps these gate tests focused on the
 *  gate, not on inbox-derived proposals (which would otherwise hit the
 *  Prisma sink outside a DB context). */
class EmptyInboxFetcher implements InboxSnapshotFetcher {
  readonly name = 'empty-inbox' as const;
  async fetchInbox(): Promise<SkillResult<ParsedMessage[]>> {
    return skillOk([]);
  }
}

function candidate() {
  return {
    id: WORKSPACE,
    vertical: 'REAL_ESTATE' as const,
    hasGoogle: true,
    hasM365: false,
    disabledDisciplines: [],
  };
}

describe('runSchedulerSweep — fire gate (pause / schedule window)', () => {
  it('a denied gate (paused or off-window) skips the workspace and is counted', async () => {
    const result = await runSchedulerSweep({
      listCandidates: async () => [candidate()],
      buildCalendarFetcher: () => new HappyCalendarFetcher(),
      buildInboxFetcher: () => new EmptyInboxFetcher(),
      gateFire: async (): Promise<FireGateOutcome> => ({
        allowed: false,
        reason: 'workspace-paused',
        detail: 'Workspace paused through 2026-06-20T00:00:00.000Z.',
      }),
    });
    assert.equal(result.workspacesConsidered, 1);
    assert.equal(result.workspacesSkippedFireGate, 1);
    assert.equal(result.workspacesWithProposals, 0);
    assert.equal(result.proposalsWritten, 0);
    assert.equal(result.failures.length, 0);
  });

  it('an allowed gate lets the sweep proceed (no fire-gate skip)', async () => {
    const result = await runSchedulerSweep({
      listCandidates: async () => [candidate()],
      buildCalendarFetcher: () => new HappyCalendarFetcher(),
      buildInboxFetcher: () => new EmptyInboxFetcher(),
      gateFire: async (): Promise<FireGateOutcome> => ({ allowed: true }),
    });
    assert.equal(result.workspacesSkippedFireGate, 0);
    // Empty calendar → zero proposals, but it did NOT skip on the gate.
    assert.equal(result.failures.length, 0);
  });
});
