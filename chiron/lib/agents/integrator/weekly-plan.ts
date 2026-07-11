// WeeklyPlan helpers: week/date math for the family's school days, and the
// philosophy pack's lesson cap enforced in code — the prompt asks for it,
// this guarantees it. All date math is UTC day-level (plan dates are
// calendar days, not instants).
import type { PhilosophyPack } from "@/lib/philosophies";
import { maxLessonMinutes } from "@/lib/philosophies";
import type { WeeklyPlanOutput } from "./schema";

export function toDateOnlyIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday (UTC) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const isoWeekday = day.getUTCDay() === 0 ? 7 : day.getUTCDay();
  day.setUTCDate(day.getUTCDate() - (isoWeekday - 1));
  return day;
}

/** Concrete dates for the family's school days within the week of `monday`. */
export function schoolDatesFor(monday: Date, schoolDays: number[]): string[] {
  return [...schoolDays]
    .sort((a, b) => a - b)
    .map((isoDay) => {
      const d = new Date(monday);
      d.setUTCDate(d.getUTCDate() + (isoDay - 1));
      return toDateOnlyIso(d);
    });
}

export function ageOn(birthdate: Date, on: Date): number {
  return Math.floor(
    (on.getTime() - birthdate.getTime()) / (365.25 * 24 * 3600 * 1000),
  );
}

/**
 * Clamp every "lesson" block to the pack's age cap. "rhythm" blocks (nature
 * walk, picture study) are exempt by design — a 60-minute walk is canonical.
 * Returns the paths clamped so callers can log/inspect.
 */
export function enforceLessonCaps(
  plan: WeeklyPlanOutput,
  pack: PhilosophyPack,
  childAge: number,
): string[] {
  const cap = maxLessonMinutes(pack, childAge);
  if (!cap) return [];
  const clamped: string[] = [];
  for (const day of plan.days) {
    for (const block of day.blocks) {
      if (block.kind === "lesson" && block.duration_est > cap) {
        clamped.push(`${day.date}/${block.subject}: ${block.duration_est}→${cap}min`);
        block.duration_est = cap;
      }
    }
  }
  return clamped;
}
