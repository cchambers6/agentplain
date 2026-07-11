// Philosophy packs — generated from docs/research/philosophies/*.md by
// scripts/build-philosophies.mjs (`npm run philosophies:build`). The markdown
// is the full pack (fed to the Integrator's cached prompt prefix); the spec is
// the parsed machine-usable YAML block (enforced in code, e.g. lesson caps).
import packsJson from "./packs.json";

export interface PhilosophyPackSpec {
  key: string;
  version: number;
  formal_lessons_start_age?: number;
  max_block_minutes_by_age?: Record<string, number>;
  variety_rule?: string;
  prefer?: string[];
  avoid?: string[];
  daily_question_style?: string;
  good_day_definition?: string;
  weekly_rhythms?: string[];
  scheduling_notes?: string;
}

export interface PhilosophyPack {
  spec: PhilosophyPackSpec;
  markdown: string;
}

const packs = packsJson as Record<string, PhilosophyPack>;

/** Family.philosophy stores keys like "charlotte_mason"; packs use hyphens. */
export function getPhilosophyPack(key: string): PhilosophyPack | undefined {
  return packs[key] ?? packs[key.replace(/_/g, "-")];
}

/**
 * Hard cap for a formal lesson block at the given age, from the pack spec.
 * Enforced in code, not just prompted — see weekly-plan.ts.
 */
export function maxLessonMinutes(pack: PhilosophyPack, age: number): number | undefined {
  const table = pack.spec.max_block_minutes_by_age;
  if (!table) return undefined;
  const ages = Object.keys(table)
    .map(Number)
    .filter((a) => !Number.isNaN(a))
    .sort((a, b) => a - b);
  if (ages.length === 0) return undefined;
  // Exact age if present, else nearest lower band, else the youngest band.
  let cap = table[String(ages[0])];
  for (const a of ages) {
    if (a <= age) cap = table[String(a)];
  }
  return cap;
}
