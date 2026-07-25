/**
 * lib/integrations/scheduling/propose-times.ts
 *
 * Pure slot-proposal arithmetic behind the `propose_times` calendar tool —
 * VENDOR-NEUTRAL. Both calendar connectors (google-calendar-mcp,
 * outlook-calendar-mcp) run their own free/busy read first, then hand the
 * busy intervals HERE — so a proposal computed against a Google calendar and
 * one computed against an Outlook calendar follow the exact same rules, and
 * the fixture servers propose exactly like production does.
 *
 * No vendor imports; input is the provider-neutral busy-interval list the
 * free/busy tools already return. Result envelope is mcp-core's `McpResult`;
 * each connector's `propose-times.ts` adapter bridges it to the connector's
 * own structurally-identical result union (the same identity-cast convention
 * the with-approval decorators use).
 */

import {
  type McpResult,
  mcpError,
  mcpOk,
} from '@/lib/integrations/mcp-core';

const DEFAULT_MAX_PROPOSALS = 5;
const MAX_PROPOSALS_CAP = 20;
const DEFAULT_WORKING_HOURS = { startHour: 9, endHour: 17 };
/** Proposal starts snap to this grid so slots read like a human picked them. */
const SLOT_GRID_MINUTES = 30;

/** Provider-neutral `propose_times` request — mirrored by each connector's
 *  `ProposeTimesInput` (structurally identical; connectors re-declare it so
 *  their action surface stays self-describing). */
export interface ProposeTimesRequest {
  /** ISO 8601 lower bound of the search window. */
  timeMin: string;
  /** ISO 8601 upper bound of the search window. */
  timeMax: string;
  /** Meeting length in minutes. */
  durationMinutes: number;
  /** Max slots to return, 1..20. Defaults to 5. */
  maxProposals?: number;
  /** Only propose slots inside these local working hours (0..23, end
   *  exclusive). Interpreted against `timezone`. Defaults to 9–17. */
  workingHours?: { startHour: number; endHour: number };
  /** IANA timezone the working-hours window is evaluated in — defaults UTC. */
  timezone?: string;
}

export interface ValidatedProposeTimes {
  timeMin: Date;
  timeMax: Date;
  durationMs: number;
  maxProposals: number;
  workingHours: { startHour: number; endHour: number };
  timezone: string;
}

export function validateProposeTimesInput(
  input: ProposeTimesRequest,
): McpResult<ValidatedProposeTimes> {
  const timeMin = new Date(input.timeMin);
  const timeMax = new Date(input.timeMax);
  if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime())) {
    return mcpError(
      'INVALID_ARGUMENT',
      'proposeTimes requires ISO 8601 timeMin + timeMax',
    );
  }
  if (timeMax.getTime() <= timeMin.getTime()) {
    return mcpError(
      'INVALID_ARGUMENT',
      'proposeTimes requires timeMax strictly after timeMin',
    );
  }
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes <= 0 ||
    input.durationMinutes > 24 * 60
  ) {
    return mcpError(
      'INVALID_ARGUMENT',
      `durationMinutes must be an integer between 1 and ${24 * 60}, got ${input.durationMinutes}`,
    );
  }
  const maxProposals = input.maxProposals ?? DEFAULT_MAX_PROPOSALS;
  if (
    !Number.isInteger(maxProposals) ||
    maxProposals <= 0 ||
    maxProposals > MAX_PROPOSALS_CAP
  ) {
    return mcpError(
      'INVALID_ARGUMENT',
      `maxProposals must be an integer between 1 and ${MAX_PROPOSALS_CAP}, got ${maxProposals}`,
    );
  }
  const workingHours = input.workingHours ?? DEFAULT_WORKING_HOURS;
  if (
    !Number.isInteger(workingHours.startHour) ||
    !Number.isInteger(workingHours.endHour) ||
    workingHours.startHour < 0 ||
    workingHours.endHour > 24 ||
    workingHours.endHour <= workingHours.startHour
  ) {
    return mcpError(
      'INVALID_ARGUMENT',
      'workingHours requires 0 <= startHour < endHour <= 24',
    );
  }
  const timezone = input.timezone ?? 'UTC';
  try {
    // Throws RangeError on an unknown IANA name — fail fast with a typed
    // error instead of proposing slots in the wrong timezone.
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    return mcpError('INVALID_ARGUMENT', `Unknown timezone: ${timezone}`);
  }
  return mcpOk({
    timeMin,
    timeMax,
    durationMs: input.durationMinutes * 60_000,
    maxProposals,
    workingHours,
    timezone,
  });
}

/**
 * Compute up to `maxProposals` open slots of exactly `durationMs` inside
 * `[timeMin, timeMax)`, avoiding every busy interval and staying inside the
 * local working-hours window. Earliest-first; starts snap to a 30-minute grid.
 */
export function computeProposals(
  v: ValidatedProposeTimes,
  busy: { start: string; end: string }[],
): { start: string; end: string }[] {
  const busyMs = busy
    .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }))
    .filter((b) => !Number.isNaN(b.start) && !Number.isNaN(b.end) && b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const gridMs = SLOT_GRID_MINUTES * 60_000;
  const proposals: { start: string; end: string }[] = [];
  let cursor = Math.ceil(v.timeMin.getTime() / gridMs) * gridMs;

  while (cursor + v.durationMs <= v.timeMax.getTime() && proposals.length < v.maxProposals) {
    const slotStart = cursor;
    const slotEnd = cursor + v.durationMs;

    if (!withinWorkingHours(slotStart, slotEnd, v)) {
      cursor += gridMs;
      continue;
    }
    const clash = busyMs.find((b) => b.start < slotEnd && b.end > slotStart);
    if (clash) {
      // Jump past the clashing interval instead of crawling the grid
      // through it — keeps the scan linear in busy-block count.
      cursor = Math.max(cursor + gridMs, Math.ceil(clash.end / gridMs) * gridMs);
      continue;
    }
    proposals.push({
      start: new Date(slotStart).toISOString(),
      end: new Date(slotEnd).toISOString(),
    });
    cursor += gridMs;
  }
  return proposals;
}

/**
 * True when the whole slot falls inside the working-hours window on ONE local
 * day, evaluated in the requested IANA timezone. The check uses the slot's
 * last occupied minute (end − 1min) so a slot ending exactly at endHour:00 —
 * including a 24:00/midnight window end — is allowed without day-rollover
 * special cases.
 */
function withinWorkingHours(
  slotStartMs: number,
  slotEndMs: number,
  v: ValidatedProposeTimes,
): boolean {
  const start = localParts(slotStartMs, v.timezone);
  const last = localParts(slotEndMs - 60_000, v.timezone);
  if (start.day !== last.day) return false;
  const startMinutes = start.hour * 60 + start.minute;
  const lastMinutes = last.hour * 60 + last.minute;
  return (
    startMinutes >= v.workingHours.startHour * 60 &&
    lastMinutes < v.workingHours.endHour * 60
  );
}

function localParts(
  ms: number,
  timeZone: string,
): { day: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  // Intl reports midnight as hour "24" in some ICU versions under hour12:false.
  const hour = get('hour') === '24' ? 0 : Number(get('hour'));
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute: Number(get('minute')),
  };
}
