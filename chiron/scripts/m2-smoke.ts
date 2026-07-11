// M2 smoke check (no DB, no provider): runs the canned mock output through
// the SAME Zod schema + content gate + lesson-cap enforcement the live path
// uses, then assembles the real Integrator prompts for the seeded Hartfield
// shape and reports token/cost estimates for a live heavy-tier run.
// Run from chiron/: npx tsx scripts/m2-smoke.ts
import { mockIntegrationMap, mockWeeklyPlan } from "../lib/agents/integrator/mock";
import {
  integrationMapSchema,
  weeklyPlanSchema,
} from "../lib/agents/integrator/schema";
import { contentGate } from "../lib/agents/integrator/content-gate";
import {
  enforceLessonCaps,
  mondayOf,
  schoolDatesFor,
  toDateOnlyIso,
} from "../lib/agents/integrator/weekly-plan";
import {
  buildIntegrateRequest,
  buildStableSystem,
  buildWeeklyPlanRequest,
  type IntegratorFamilyInput,
} from "../lib/agents/integrator/prompt";
import { getPhilosophyPack } from "../lib/philosophies";
import { catalog } from "../lib/catalog";

const refs = {
  history: { id: "cur_sotw", name: "The Story of the World, Vol. 1: Ancient Times" },
  math: { id: "cur_mus", name: "Math-U-See Primer" },
  phonics: { id: "cur_etc", name: "Explode the Code Book 1" },
};

const nowIso = new Date().toISOString();
const monday = mondayOf(new Date());
const weekOfIso = toDateOnlyIso(monday);
const schoolDates = schoolDatesFor(monday, [1, 2, 3, 4]);

// 1) Mock output must pass schema + gate + caps — same bar as live output.
const map = integrationMapSchema.parse(mockIntegrationMap(refs, nowIso));
const plan = weeklyPlanSchema.parse(mockWeeklyPlan("child_anna", weekOfIso, schoolDates, refs));

const pack = getPhilosophyPack("charlotte_mason");
if (!pack) throw new Error("CM pack missing from packs.json");

const mapViolations = contentGate(map);
const planViolations = contentGate(plan);
if (mapViolations.length || planViolations.length) {
  console.error("CONTENT GATE VIOLATIONS", { mapViolations, planViolations });
  process.exit(1);
}
const clamped = enforceLessonCaps(plan, pack, 6);
console.log("mock IntegrationMap: valid, gate-clean,", map.weeks.length, "weeks");
console.log("mock WeeklyPlan: valid, gate-clean,", plan.days.length, "days");
console.log("lesson-cap clamps needed on mock plan:", clamped.length === 0 ? "none (already compliant)" : clamped);

// 2) Assemble the real prompts for the Hartfield shape and size them.
const input: IntegratorFamilyInput = {
  family: {
    state: "GA",
    timezone: "America/New_York",
    philosophy: "charlotte_mason",
    school_days: [1, 2, 3, 4],
    goals:
      "I want Anna to love books, spend real time outdoors every day, and grow up believing math is something she is good at.",
  },
  child: {
    id: "child_anna",
    name: "Anna",
    age: 6,
    stage: "grammar",
    model: {
      modalities: { strong: "read-aloud and narration" },
      strengths: ["retells stories in vivid detail"],
      struggles: [{ area: "number bonds past 10", since: "2026-06" }],
      pacing_notes: { math: "gently behind", reading: "ahead" },
      interests: ["birds", "baking"],
    },
  },
  curricula: [
    {
      id: "cur_sotw",
      name: refs.history.name,
      publisher: "Well-Trained Mind Press",
      subjects: ["history"],
      scope_sequence: { units: [{ ordinal: 1, label: "42 chapters, ancients to Rome", lessonCount: 42 }] },
      pace: "1-2 chapters/week over a 36-week year",
      parent_notes: "We read aloud on the sofa and she narrates back; activity book on Thursdays.",
    },
    {
      id: "cur_mus",
      name: refs.math.name,
      publisher: "Demme Learning",
      subjects: ["math"],
      scope_sequence: { units: [{ ordinal: 1, label: "30 lessons, gentle intro with manipulative blocks", lessonCount: 30 }] },
      pace: "1 lesson/week, 4 short sessions",
      parent_notes: "The blocks are the whole game for her — we keep sessions to 15 minutes.",
    },
    {
      id: "cur_etc",
      name: refs.phonics.name,
      publisher: "EPS Learning",
      subjects: ["phonics", "reading"],
      scope_sequence: { units: [{ ordinal: 1, label: "Short vowels, consonant sounds", lessonCount: 14 }] },
      pace: "3-4 pages/day, 3 days/week",
      parent_notes: "Quick morning warm-up before read-aloud time.",
    },
  ],
};

const catalogEntries = ["story-of-the-world", "math-u-see", "explode-the-code"]
  .map((id) => catalog.find((e) => e.id === id)!)
  .filter(Boolean);

const system = buildStableSystem(pack.markdown, catalogEntries);
const stableChars = system.reduce((n, b) => n + b.text.length, 0);
const integrateReq = buildIntegrateRequest(input, 6, nowIso);
const weeklyReq = buildWeeklyPlanRequest(input, map, 1, weekOfIso, schoolDates);

const tok = (chars: number) => Math.round(chars / 4); // ~4 chars/token English+JSON
const stableTok = tok(stableChars);
const integrateInTok = tok(integrateReq.length);
const weeklyInTok = tok(weeklyReq.length);
const mapOutTok = tok(JSON.stringify(map).length);
const planOutTok = tok(JSON.stringify(plan).length);

// Heavy-tier sticker prices (lib/ai/meter.ts): $5 in / $25 out per MTok;
// cache write 1.25x in, cache read 0.1x in.
const IN = 5 / 1e6, OUT = 25 / 1e6;
const integrateCost = stableTok * IN * 1.25 + integrateInTok * IN + mapOutTok * OUT;
const weeklyCost = stableTok * IN * 0.1 + weeklyInTok * IN + planOutTok * OUT;

console.log("\n--- prompt sizes (est. tokens @ ~4 chars/tok) ---");
console.log(`stable cached prefix (role + CM pack + 3 catalog entries): ${stableTok} tok (${stableChars} chars)`);
console.log(`integrate request suffix: ${integrateInTok} tok; expected output (6-week map): ~${mapOutTok} tok`);
console.log(`weekly-plan request suffix: ${weeklyInTok} tok; expected output (4-day plan): ~${planOutTok} tok`);
console.log("\n--- cost per live run (heavy tier) ---");
console.log(`integrate (cache WRITE on prefix): ~$${integrateCost.toFixed(3)}`);
console.log(`weekly plan (cache READ on prefix): ~$${weeklyCost.toFixed(3)}`);
console.log(`full first run (integrate + week 1): ~$${(integrateCost + weeklyCost).toFixed(3)}`);
console.log("\n--- cache hit rate on input, calls after the first ---");
console.log(
  `integrate re-run: ${(100 * stableTok / (stableTok + integrateInTok)).toFixed(1)}% | weekly plan: ${(100 * stableTok / (stableTok + weeklyInTok)).toFixed(1)}%`,
);
