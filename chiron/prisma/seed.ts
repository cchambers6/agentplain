// Seeds the synthetic Hartfield family (demo — no real-family PII).
// Anna, 6, grammar stage, Charlotte Mason, Mon–Thu, Georgia.
// Curricula are the three picked for the demo (Conner decision #2 default):
// Story of the World Vol. 1 + Math-U-See Primer + Explode the Code Book 1.
// Metadata only — unit labels/counts, never lesson content.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.family.findFirst();
  if (existing) {
    console.log("Family already seeded — run a reset first if you want a fresh one.");
    return;
  }

  const family = await prisma.family.create({
    data: {
      workspaceId: "pending",
      parentName: "Sarah Hartfield (Demo)",
      state: "GA",
      timezone: "America/New_York",
      philosophy: "charlotte_mason",
      schoolDays: [1, 2, 3, 4],
      goals:
        "I want Anna to love books, spend real time outdoors every day, and grow up believing math is something she is good at.",
    },
  });
  await prisma.family.update({
    where: { id: family.id },
    data: { workspaceId: family.id },
  });

  await prisma.child.create({
    data: {
      workspaceId: family.id,
      familyId: family.id,
      name: "Anna",
      birthdate: new Date("2020-03-14"),
      stage: "grammar",
      model: {
        modalities: { strong: "read-aloud and narration" },
        strengths: ["retells stories in vivid detail"],
        struggles: [{ area: "number bonds past 10", since: "2026-06" }],
        pacing_notes: { math: "gently behind", reading: "ahead" },
        interests: ["birds", "baking"],
        last_updated: new Date().toISOString(),
      },
    },
  });

  // Scope/sequence below is table-of-contents shape only (ordinals, labels,
  // counts) drawn from the publishers' public materials — the schema has no
  // place for lesson content, by design.
  await prisma.curriculum.createMany({
    data: [
      {
        workspaceId: family.id,
        familyId: family.id,
        name: "The Story of the World, Vol. 1: Ancient Times",
        publisher: "Well-Trained Mind Press",
        subjects: ["history"],
        scopeSequence: {
          source_url:
            "https://welltrainedmind.com/p/story-of-the-world-volume-1-ancient-times-revised-edition/",
          units: [{ ordinal: 1, label: "42 chapters, ancients to Rome", lessonCount: 42 }],
          format: ["living-book"],
        },
        pace: "1-2 chapters/week over a 36-week year",
        parentNotes: "We read aloud on the sofa and she narrates back; activity book on Thursdays.",
        catalogId: "story-of-the-world",
      },
      {
        workspaceId: family.id,
        familyId: family.id,
        name: "Math-U-See Primer",
        publisher: "Demme Learning",
        subjects: ["math"],
        scopeSequence: {
          source_url: "https://mathusee.com/curriculum/primer/",
          units: [{ ordinal: 1, label: "30 lessons, gentle intro with manipulative blocks", lessonCount: 30 }],
          format: ["mastery", "manipulative-heavy", "video"],
        },
        pace: "1 lesson/week, 4 short sessions",
        parentNotes: "The blocks are the whole game for her — we keep sessions to 15 minutes.",
        catalogId: "math-u-see",
      },
      {
        workspaceId: family.id,
        familyId: family.id,
        name: "Explode the Code Book 1",
        publisher: "EPS Learning",
        subjects: ["phonics", "reading"],
        scopeSequence: {
          source_url: "https://www.epslearning.com/explode-the-code",
          units: [{ ordinal: 1, label: "Short vowels, consonant sounds", lessonCount: 14 }],
          format: ["workbook"],
        },
        pace: "3-4 pages/day, 3 days/week",
        parentNotes: "Quick morning warm-up before read-aloud time.",
        catalogId: "explode-the-code",
      },
    ],
  });

  console.log(`Seeded the Hartfield demo family (${family.id}): Anna (6, grammar) + 3 curricula.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
