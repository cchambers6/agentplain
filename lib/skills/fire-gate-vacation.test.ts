/**
 * lib/skills/fire-gate-vacation.test.ts
 *
 * Settings-behavior audit (feat/settings-behavior-audit-fix): unit-pins
 * `resolveVacationPause`, the pure classifier the webhook processor uses
 * to turn active WorkspacePauseConfig rows into a fire decision for the
 * multi-skill incoming-mail path. A full pause must skip the whole event
 * (the /settings/pause emergency stop); a narrowed pause must surface the
 * exact disciplines to silence.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveVacationPause, type ActivePauseRow } from './fire-gate';

const until = (iso: string): Date => new Date(iso);

describe('resolveVacationPause', () => {
  it('no active pauses → not paused, nothing disabled', () => {
    const r = resolveVacationPause([]);
    assert.equal(r.fullPause, false);
    assert.equal(r.pausedUntil, null);
    assert.deepEqual(r.pausedDisciplineIds, []);
  });

  it('a workspace-wide pause (empty disciplines) → fullPause with latest pausedUntil', () => {
    const rows: ActivePauseRow[] = [
      { pausedDisciplineIds: [], pausedUntil: until('2026-06-10T00:00:00Z') },
      { pausedDisciplineIds: [], pausedUntil: until('2026-06-20T00:00:00Z') },
    ];
    const r = resolveVacationPause(rows);
    assert.equal(r.fullPause, true);
    assert.equal(r.pausedUntil?.toISOString(), '2026-06-20T00:00:00.000Z');
  });

  it('a narrowed pause → not fullPause, disciplines surfaced (deduped)', () => {
    const rows: ActivePauseRow[] = [
      { pausedDisciplineIds: ['sales-enablement'], pausedUntil: until('2026-06-10T00:00:00Z') },
      { pausedDisciplineIds: ['sales-enablement', 'operations'], pausedUntil: until('2026-06-12T00:00:00Z') },
    ];
    const r = resolveVacationPause(rows);
    assert.equal(r.fullPause, false);
    assert.equal(r.pausedUntil, null);
    assert.deepEqual([...r.pausedDisciplineIds].sort(), ['operations', 'sales-enablement']);
  });

  it('a full pause alongside a narrowed one → fullPause wins (whole-event skip)', () => {
    const rows: ActivePauseRow[] = [
      { pausedDisciplineIds: ['operations'], pausedUntil: until('2026-06-10T00:00:00Z') },
      { pausedDisciplineIds: [], pausedUntil: until('2026-06-15T00:00:00Z') },
    ];
    const r = resolveVacationPause(rows);
    assert.equal(r.fullPause, true);
    assert.equal(r.pausedUntil?.toISOString(), '2026-06-15T00:00:00.000Z');
  });
});
