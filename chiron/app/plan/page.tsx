import Link from "next/link";
import { redirect } from "next/navigation";
import { currentParentEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMockMode } from "@/lib/agents/integrator/run";
import {
  integrationMapSchema,
  planBlockSchema,
  type PlanBlock,
} from "@/lib/agents/integrator/schema";
import { z } from "zod";
import {
  DraftWeekButton,
  PlanChoices,
  ResetSeededWeekButton,
  type ChoiceItem,
} from "./plan-actions";

export const dynamic = "force-dynamic";

// The integration view: the first thing a parent sees after onboarding.
// Chiron speaks in first person; nothing on this page names a model, tier,
// or vendor.

function fmtDay(iso: Date | string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const decisionRowSchema = z.object({ item: z.string(), decision: z.string() });

export default async function PlanPage() {
  if (!currentParentEmail()) redirect("/login");

  const family = await prisma.family.findFirst({ include: { children: true } });
  if (!family) redirect("/onboard");
  const child = family.children[0];

  const mapRow = await prisma.integrationMap.findFirst({
    where: { familyId: family.id },
    orderBy: { revision: "desc" },
  });
  const planRow = await prisma.weeklyPlan.findFirst({
    where: { familyId: family.id },
    orderBy: { weekStart: "desc" },
    include: { dayPlans: { orderBy: { date: "asc" } } },
  });

  if (!mapRow || !planRow) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-3xl">
          {child ? `Let me draft ${child.name}'s week` : "Let me draft your week"}
        </h1>
        <p className="mt-4 max-w-lg leading-relaxed text-walnut">
          I&rsquo;ll read through everything you told me — your materials, your
          days, how you want school to feel — and lay out one coherent week.
          You&rsquo;ll get the final say on anything I wasn&rsquo;t sure about.
        </p>
        <div className="mt-8">
          <DraftWeekButton label="Draft our week" />
        </div>
      </main>
    );
  }

  const map = integrationMapSchema.parse(mapRow.content);
  const decisions = z.array(decisionRowSchema).catch([]).parse(mapRow.parentDecisions);
  const decidedFor = (item: string) =>
    [...decisions].reverse().find((d) => d.item === item)?.decision;

  // Which map week does the shown plan realize?
  const priorPlans = await prisma.weeklyPlan.count({
    where: { familyId: family.id, weekStart: { lt: planRow.weekStart } },
  });
  const weekNumber = Math.min(priorPlans + 1, map.weeks.length);
  const mapWeek = map.weeks.find((w) => w.week_number === weekNumber) ?? map.weeks[0];

  const alignmentNotes = mapWeek.subjects
    .map((s) => s.alignment_note)
    .filter((n): n is string => Boolean(n))
    .slice(0, 3);
  const setAside = mapWeek.subjects.flatMap((s) => s.dropped).slice(0, 2);

  const choices: ChoiceItem[] = [
    ...mapWeek.conflicts_surfaced.map((c) => {
      const item = `week${weekNumber}:conflict:${c.subject}`;
      return {
        item,
        prompt: `A choice for you in ${c.subject} this week`,
        optionA: c.choice_a,
        optionB: c.choice_b,
        recommendation: c.recommendation,
        rationale: c.rationale,
        decided: decidedFor(item),
      };
    }),
    ...map.parent_review_required.map((text) => ({
      item: text,
      prompt: text,
      optionA: "Keep it as planned",
      optionB: "I'd like it changed",
      decided: decidedFor(text),
    })),
  ];
  const openChoices = choices.filter((c) => !c.decided);
  const settledChoices = choices.filter((c) => c.decided);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-walnut/20 pb-6">
        <div>
          <p className="text-sm uppercase tracking-wide text-walnut/70">
            Week of {fmtDay(planRow.weekStart)}
          </p>
          <h1 className="mt-1 font-serif text-3xl">
            {child ? `${child.name}'s week` : "Your week"}
          </h1>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/today" className="text-walnut underline-offset-4 hover:underline">
            Today
          </Link>
          {isMockMode() && <ResetSeededWeekButton />}
        </nav>
      </header>

      <section className="mt-8 rounded-lg bg-white/50 p-6">
        <p className="font-serif text-xl leading-relaxed">{planRow.vision}</p>
        <p className="mt-3 text-sm italic text-walnut">{mapWeek.theme}</p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {planRow.dayPlans.map((day) => {
          const blocks = z.array(planBlockSchema).catch([]).parse(day.blocks);
          return (
            <div key={day.id} className="rounded-lg border border-walnut/25 bg-white/40 p-4">
              <h2 className="font-serif text-lg">{fmtDay(day.date)}</h2>
              <ul className="mt-3 space-y-4">
                {blocks.map((b: PlanBlock, i) => (
                  <li
                    key={i}
                    className={`border-l-2 pl-3 ${
                      b.kind === "rhythm" ? "border-sage" : "border-ochre"
                    }`}
                  >
                    <p className="text-sm font-medium">
                      {b.subject}
                      <span className="ml-2 font-normal text-walnut/70">
                        {b.duration_est} min
                      </span>
                    </p>
                    {(b.curriculum_ref || b.lesson_ref) && (
                      <p className="mt-0.5 text-xs text-walnut">
                        {[b.curriculum_ref?.name, b.lesson_ref]
                          .filter(Boolean)
                          .join(" — ")}
                      </p>
                    )}
                    <p className="mt-1 text-sm leading-snug">{b.activity}</p>
                    {b.philosophy_note && (
                      <p className="mt-1 text-xs italic text-walnut">
                        {b.philosophy_note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {alignmentNotes.length > 0 && (
        <section className="mt-8 rounded-lg border border-sage/50 bg-sage/10 p-6">
          <h2 className="font-serif text-xl">Why this week looks this way</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
            {alignmentNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          {setAside.length > 0 && (
            <p className="mt-4 text-xs text-walnut">
              Set aside for now: {setAside.join(" · ")}
            </p>
          )}
        </section>
      )}

      {openChoices.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-xl">Choices for you</h2>
          <p className="mt-1 text-sm text-walnut">
            I&rsquo;ve made the small calls myself — these ones are yours.
          </p>
          <div className="mt-4">
            <PlanChoices choices={openChoices} />
          </div>
        </section>
      )}

      {settledChoices.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-lg text-walnut">Settled</h2>
          <ul className="mt-2 space-y-1 text-sm text-walnut/80">
            {settledChoices.map((c) => (
              <li key={c.item}>
                {c.prompt} —{" "}
                <span className="text-sage">
                  {c.decided === "a"
                    ? c.optionA
                    : c.decided === "b"
                      ? c.optionB
                      : c.decided}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
