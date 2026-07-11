// Integrator execution flow.
//
//   integrate(familyId)              → IntegrationMap row (heavy tier, or mock)
//   generateWeeklyPlan(familyId, d)  → WeeklyPlan + DayPlan rows for d's week
//
// Both paths — live and CHIRON_AI_MODE=mock — go through the same Zod parse
// and content gate, so the canned output is held to the product invariants,
// not grandfathered past them. Live calls run on the heavy tier via the
// model router (prompt-cached stable prefix, usage metered to
// DailyCostRecord). Mock mode exists so the preview deploy renders /plan
// with zero provider keys configured.
import { prisma } from "@/lib/db";
import { aiCall } from "@/lib/ai/route";
import { catalog, type CatalogEntry } from "@/lib/catalog";
import { getPhilosophyPack, type PhilosophyPack } from "@/lib/philosophies";
import {
  buildIntegrateRequest,
  buildStableSystem,
  buildWeeklyPlanRequest,
  type IntegratorFamilyInput,
} from "./prompt";
import {
  extractJson,
  integrationMapSchema,
  weeklyPlanSchema,
  type CurriculumRef,
  type IntegrationMap,
  type WeeklyPlanOutput,
} from "./schema";
import { contentGate } from "./content-gate";
import { mockIntegrationMap, mockWeeklyPlan, type MockRefs } from "./mock";
import {
  ageOn,
  enforceLessonCaps,
  mondayOf,
  schoolDatesFor,
  toDateOnlyIso,
} from "./weekly-plan";

const WEEKS_TO_PLAN = 6; // half a CM term; the Headmaster re-plans within this

export function isMockMode(): boolean {
  return process.env.CHIRON_AI_MODE === "mock";
}

interface FamilyContext {
  family: { id: string; philosophy: string; schoolDays: number[]; state: string; timezone: string; goals: string | null };
  child: { id: string; name: string; birthdate: Date; stage: string; model: unknown };
  curricula: { id: string; name: string; publisher: string | null; subjects: string[]; scopeSequence: unknown; pace: string | null; parentNotes: string | null; catalogId: string | null }[];
  pack: PhilosophyPack;
  catalogEntries: CatalogEntry[];
  input: IntegratorFamilyInput;
}

async function loadFamilyContext(familyId: string): Promise<FamilyContext> {
  const family = await prisma.family.findUniqueOrThrow({
    where: { id: familyId },
    include: { children: true, curricula: true },
  });
  const child = family.children[0];
  if (!child) throw new Error("Family has no child on record");
  if (family.curricula.length === 0) throw new Error("Family has no curricula on record");

  const pack = getPhilosophyPack(family.philosophy);
  if (!pack) throw new Error(`No philosophy pack for "${family.philosophy}"`);

  const catalogEntries = family.curricula
    .map((c) => catalog.find((e) => e.id === c.catalogId))
    .filter((e): e is CatalogEntry => Boolean(e));

  const input: IntegratorFamilyInput = {
    family: {
      state: family.state,
      timezone: family.timezone,
      philosophy: family.philosophy,
      school_days: family.schoolDays,
      goals: family.goals,
    },
    child: {
      id: child.id,
      name: child.name,
      age: ageOn(child.birthdate, new Date()),
      stage: child.stage,
      model: child.model,
    },
    curricula: family.curricula.map((c) => ({
      id: c.id,
      name: c.name,
      publisher: c.publisher,
      subjects: c.subjects,
      scope_sequence: c.scopeSequence,
      pace: c.pace,
      parent_notes: c.parentNotes,
    })),
  };

  return { family, child, curricula: family.curricula, pack, catalogEntries, input };
}

/** Curriculum refs for the canned Hartfield output, resolved from live rows. */
function resolveMockRefs(ctx: FamilyContext): MockRefs {
  const byCatalogOrSubject = (catalogId: string, subject: string): CurriculumRef => {
    const row =
      ctx.curricula.find((c) => c.catalogId === catalogId) ??
      ctx.curricula.find((c) => c.subjects.includes(subject)) ??
      ctx.curricula[0];
    return { id: row.id, name: row.name };
  };
  return {
    history: byCatalogOrSubject("story-of-the-world", "history"),
    math: byCatalogOrSubject("math-u-see", "math"),
    phonics: byCatalogOrSubject("explode-the-code", "phonics"),
  };
}

/**
 * Heavy-tier call → JSON → Zod → content gate. A gate violation re-requests
 * once with the violations named; a second violation fails the run — we never
 * persist output that carries curriculum-shaped text.
 */
async function callHeavyValidated<T>(args: {
  ctx: FamilyContext;
  request: string;
  parse: (json: unknown) => T;
}): Promise<T> {
  const system = buildStableSystem(args.ctx.pack.markdown, args.ctx.catalogEntries);
  const messages: { role: "user" | "assistant"; content: string }[] = [
    { role: "user", content: args.request },
  ];

  for (let attempt = 1; ; attempt++) {
    const result = await aiCall({
      tier: "heavy",
      agent: "integrator",
      familyId: args.ctx.family.id,
      system,
      messages,
    });
    const parsed = args.parse(extractJson(result.text));
    const violations = contentGate(parsed);
    if (violations.length === 0) return parsed;
    if (attempt >= 2) {
      throw new Error(
        `Integrator output failed the content gate twice: ${violations
          .map((v) => `${v.path} (${v.reason})`)
          .join("; ")}`,
      );
    }
    messages.push(
      { role: "assistant", content: result.text },
      {
        role: "user",
        content:
          `Your output violated the no-curriculum-content rule at: ` +
          violations.map((v) => `${v.path} — ${v.reason}`).join("; ") +
          `. Regenerate the full JSON with those fields rewritten as short ` +
          `identifiers and one-line neutral descriptions only.`,
      },
    );
  }
}

function assertGateClean(value: unknown, label: string): void {
  const violations = contentGate(value);
  if (violations.length > 0) {
    throw new Error(
      `${label} failed the content gate: ${violations
        .map((v) => `${v.path} (${v.reason})`)
        .join("; ")}`,
    );
  }
}

/**
 * Run the Integrator for a family and persist the IntegrationMap.
 * Fires at onboarding completion and on curriculum/philosophy changes.
 */
export async function integrate(familyId: string): Promise<IntegrationMap> {
  const ctx = await loadFamilyContext(familyId);
  const nowIso = new Date().toISOString();

  let map: IntegrationMap;
  if (isMockMode()) {
    // Mock output passes the SAME schema + gate as live output.
    map = integrationMapSchema.parse(mockIntegrationMap(resolveMockRefs(ctx), nowIso));
    assertGateClean(map, "Mock IntegrationMap");
  } else {
    map = await callHeavyValidated({
      ctx,
      request: buildIntegrateRequest(ctx.input, WEEKS_TO_PLAN, nowIso),
      parse: (json) => integrationMapSchema.parse(json),
    });
  }

  const prev = await prisma.integrationMap.findFirst({
    where: { familyId },
    orderBy: { revision: "desc" },
    select: { revision: true },
  });
  map.revision = (prev?.revision ?? 0) + 1;

  await prisma.integrationMap.create({
    data: {
      workspaceId: familyId,
      familyId,
      content: map as object,
      philosophyPackRef: `${ctx.pack.spec.key}@v${ctx.pack.spec.version}`,
      curriculaRefs: ctx.curricula.map((c) => ({ id: c.id, name: c.name })),
      generatedBy: map.generated_by,
      revision: map.revision,
    },
  });

  return map;
}

/**
 * Produce the WeeklyPlan for the week containing `weekOf` from the latest
 * IntegrationMap, and persist WeeklyPlan + DayPlan rows.
 */
export async function generateWeeklyPlan(
  familyId: string,
  weekOf: Date,
): Promise<WeeklyPlanOutput> {
  const ctx = await loadFamilyContext(familyId);
  const mapRow = await prisma.integrationMap.findFirst({
    where: { familyId },
    orderBy: { revision: "desc" },
  });
  if (!mapRow) throw new Error("No IntegrationMap yet — run integrate() first");
  const map = integrationMapSchema.parse(mapRow.content);

  const monday = mondayOf(weekOf);
  const weekOfIso = toDateOnlyIso(monday);
  const schoolDates = schoolDatesFor(monday, ctx.family.schoolDays);

  // Week number within the map = how many plan weeks this family already has.
  const priorPlans = await prisma.weeklyPlan.count({
    where: { familyId, weekStart: { lt: monday } },
  });
  const weekNumber = Math.min(priorPlans + 1, map.weeks.length);

  let plan: WeeklyPlanOutput;
  if (isMockMode()) {
    plan = weeklyPlanSchema.parse(
      mockWeeklyPlan(ctx.child.id, weekOfIso, schoolDates, resolveMockRefs(ctx)),
    );
    assertGateClean(plan, "Mock WeeklyPlan");
  } else {
    plan = await callHeavyValidated({
      ctx,
      request: buildWeeklyPlanRequest(ctx.input, map, weekNumber, weekOfIso, schoolDates),
      parse: (json) => weeklyPlanSchema.parse(json),
    });
  }

  // Pack cap is enforced in code, not just prompted.
  enforceLessonCaps(plan, ctx.pack, ageOn(ctx.child.birthdate, monday));

  await prisma.$transaction(async (tx) => {
    const weeklyPlan = await tx.weeklyPlan.upsert({
      where: { familyId_weekStart: { familyId, weekStart: monday } },
      create: {
        workspaceId: familyId,
        familyId,
        weekStart: monday,
        vision: plan.vision,
        status: "planned",
      },
      update: { vision: plan.vision, status: "planned" },
    });
    await tx.dayPlan.deleteMany({ where: { weeklyPlanId: weeklyPlan.id } });
    for (const day of plan.days) {
      await tx.dayPlan.create({
        data: {
          workspaceId: familyId,
          weeklyPlanId: weeklyPlan.id,
          date: new Date(`${day.date}T00:00:00.000Z`),
          blocks: day.blocks as object[],
          status: "planned",
        },
      });
    }
  });

  return plan;
}
