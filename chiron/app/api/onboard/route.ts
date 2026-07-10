import { NextResponse } from "next/server";
import { currentParentEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { onboardingSchema } from "@/app/onboard/schema";
import { stageForBirthdate } from "@/lib/stages";
import { catalog } from "@/lib/catalog";

export async function POST(req: Request) {
  if (!currentParentEmail()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const parsed = onboardingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // One family per install (POC).
  const existing = await prisma.family.findFirst({ select: { id: true } });
  if (existing) {
    return NextResponse.json(
      { error: "This install already has a family set up." },
      { status: 409 },
    );
  }

  const family = await prisma.$transaction(async (tx) => {
    const family = await tx.family.create({
      data: {
        workspaceId: "pending", // patched to own id below (workspaceId = familyId in POC)
        parentName: data.parentName,
        state: data.state,
        timezone: data.timezone,
        philosophy: data.philosophy,
        schoolDays: data.schoolDays,
        goals: data.goals,
      },
    });
    await tx.family.update({
      where: { id: family.id },
      data: { workspaceId: family.id },
    });

    const birthdate = new Date(data.birthdate);
    await tx.child.create({
      data: {
        workspaceId: family.id,
        familyId: family.id,
        name: data.name,
        birthdate,
        stage: stageForBirthdate(birthdate),
        model: {
          modalities: {},
          strengths: [],
          struggles: [],
          pacing_notes: {},
          interests: [],
          last_updated: new Date().toISOString(),
        },
      },
    });

    for (const c of data.curricula) {
      const entry = c.catalogId
        ? catalog.find((e) => e.id === c.catalogId)
        : undefined;
      await tx.curriculum.create({
        data: {
          workspaceId: family.id,
          familyId: family.id,
          name: c.name,
          publisher: c.publisher || entry?.publisher || null,
          subjects: c.subjects
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
          // Autofill from the research catalog when we know the material:
          // still metadata only (pace, stages, scope/sequence URL — no content).
          scopeSequence: entry
            ? {
                source_url: entry.scopeSequenceUrl,
                stages: entry.stages,
                format: entry.format,
                philosophy_affinity: entry.philosophyAffinity,
              }
            : undefined,
          pace: entry?.pace ?? null,
          parentNotes: c.parentNotes || null,
          catalogId: entry?.id ?? null,
        },
      });
    }

    return family;
  });

  return NextResponse.json({ ok: true, familyId: family.id });
}
