/**
 * lib/skills/fire-gate.ts
 *
 * Customer-controlled skill-fire gate. Two surfaces compose into one
 * "should this fire run RIGHT NOW?" check:
 *
 *   1. WorkspacePauseConfig — vacation / PTO / cutover window. When
 *      `pausedFrom <= now < pausedUntil`, the workspace is paused; the
 *      gate denies unless `pausedDisciplineIds` narrows scope and the
 *      skill's discipline is NOT in that list.
 *
 *   2. SkillScheduleWindow — per-skill TZ-aware fire schedule. When a
 *      window exists for `(workspaceId, skillSlug)`, the gate
 *      rejects fires whose local hour/day fall outside the window.
 *
 * Per `feedback_cold_start_safe_agents.md`: every call reads both
 * tables fresh. There is no in-memory cache of paused state — a
 * customer who edits their vacation dates expects the next fire to
 * honor the change.
 *
 * Per `project_no_outbound_architecture.md`: the gate is a SKIP — when
 * it denies, the skill produces no draft, no approval row, no LLM
 * call. The caller logs the gate decision so the per-discipline
 * scorecard can render an honest "skipped — paused" / "skipped — off-
 * window" reason.
 *
 * TZ handling: `Intl.DateTimeFormat` with `timeZone:
 * workspaceTimezone` is the only correct way to project a UTC `now`
 * into a workspace's local hour/day across DST transitions. We do NOT
 * cache the formatter — Date stays UTC; formatter stays per-call.
 */

import type { PrismaClient } from '@prisma/client';

export type FireGateOutcome =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | 'workspace-paused'
        | 'workspace-paused-discipline'
        | 'off-window';
      /** Human-renderable detail for the operator surface. */
      detail: string;
    };

export interface FireGateArgs {
  /** Prisma-shaped tx — pass an RLS-bound tx so reads respect
   *  workspace isolation. */
  tx: Pick<
    PrismaClient,
    'workspacePauseConfig' | 'skillScheduleWindow'
  >;
  workspaceId: string;
  skillSlug: string;
  /** Discipline id the skill belongs to (one of `lib/disciplines`
   *  ids). Required so the gate can honor a discipline-narrowed
   *  pause. */
  disciplineId: string;
  now?: Date;
}

export async function gateSkillFire(args: FireGateArgs): Promise<FireGateOutcome> {
  const now = args.now ?? new Date();

  const [activePauses, window] = await Promise.all([
    args.tx.workspacePauseConfig.findMany({
      where: {
        workspaceId: args.workspaceId,
        pausedFrom: { lte: now },
        pausedUntil: { gt: now },
      },
      select: {
        pausedDisciplineIds: true,
        pausedUntil: true,
      },
    }),
    args.tx.skillScheduleWindow.findUnique({
      where: {
        workspaceId_skillSlug: {
          workspaceId: args.workspaceId,
          skillSlug: args.skillSlug,
        },
      },
      select: {
        daysOfWeek: true,
        startHourLocal: true,
        endHourLocal: true,
        workspaceTimezone: true,
      },
    }),
  ]);

  // 1. Pause check — first match wins. An all-disciplines pause
  // (empty array) always denies; a discipline-narrowed pause denies
  // only if this skill's discipline is in the list.
  for (const pause of activePauses) {
    const allDisciplines = pause.pausedDisciplineIds.length === 0;
    const inNarrowed = pause.pausedDisciplineIds.includes(args.disciplineId);
    if (allDisciplines) {
      return {
        allowed: false,
        reason: 'workspace-paused',
        detail: `Workspace paused through ${pause.pausedUntil.toISOString()}.`,
      };
    }
    if (inNarrowed) {
      return {
        allowed: false,
        reason: 'workspace-paused-discipline',
        detail: `Discipline '${args.disciplineId}' paused through ${pause.pausedUntil.toISOString()}.`,
      };
    }
  }

  // 2. Schedule window check — no row = no window = fires anytime.
  if (window) {
    const local = localHourAndDay(now, window.workspaceTimezone);
    if (window.daysOfWeek.length > 0 && !window.daysOfWeek.includes(local.day)) {
      return {
        allowed: false,
        reason: 'off-window',
        detail: `Skill '${args.skillSlug}' window does not include day ${local.day} (workspace TZ ${window.workspaceTimezone}).`,
      };
    }
    if (!isHourInWindow(local.hour, window.startHourLocal, window.endHourLocal)) {
      return {
        allowed: false,
        reason: 'off-window',
        detail: `Skill '${args.skillSlug}' window ${window.startHourLocal}..${window.endHourLocal} (TZ ${window.workspaceTimezone}) excludes hour ${local.hour}.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Project UTC `now` into the given IANA timezone and return the local
 * hour (0..23) + day-of-week (0..6, Sunday=0). Uses
 * Intl.DateTimeFormat so DST transitions are correct.
 */
export function localHourAndDay(
  now: Date,
  timezone: string,
): { hour: number; day: number } {
  // Use formatToParts so we read the components without parsing
  // locale-dependent strings.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  let hour = 0;
  let weekdayShort = 'Sun';
  for (const p of parts) {
    if (p.type === 'hour') hour = Number.parseInt(p.value, 10);
    if (p.type === 'weekday') weekdayShort = p.value;
  }
  // Intl quirk: in some runtimes hour: '2-digit' + hour12:false returns
  // '24' rather than '00' at midnight. Normalize.
  if (hour === 24) hour = 0;
  return { hour, day: weekdayShortToIndex(weekdayShort) };
}

function weekdayShortToIndex(weekday: string): number {
  switch (weekday) {
    case 'Sun':
      return 0;
    case 'Mon':
      return 1;
    case 'Tue':
      return 2;
    case 'Wed':
      return 3;
    case 'Thu':
      return 4;
    case 'Fri':
      return 5;
    case 'Sat':
      return 6;
    default:
      return 0;
  }
}

/**
 * Hour-in-window check. Supports overnight windows where `end <=
 * start` (e.g. 22..6 = "10pm through 6am"). `end` is exclusive — a
 * window 9..17 covers hours 9, 10, ..., 16.
 */
export function isHourInWindow(
  hour: number,
  startHourLocal: number,
  endHourLocal: number,
): boolean {
  if (startHourLocal === endHourLocal) {
    // Degenerate window — never matches. Treat as "off-window" so the
    // customer cannot accidentally lock the fleet open or shut.
    return false;
  }
  if (endHourLocal > startHourLocal) {
    return hour >= startHourLocal && hour < endHourLocal;
  }
  // Overnight: hour belongs to [start, 24) ∪ [0, end)
  return hour >= startHourLocal || hour < endHourLocal;
}
