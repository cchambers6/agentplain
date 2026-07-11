import { NextResponse } from "next/server";
import { currentParentEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateWeeklyPlan, integrate } from "@/lib/agents/integrator/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // heavy-tier integrate + first weekly plan

// On-demand Integrator run: fires at onboarding completion and on curriculum
// changes. Produces the IntegrationMap, then the first WeeklyPlan from it.
export async function POST() {
  if (!currentParentEmail()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const family = await prisma.family.findFirst({ select: { id: true } });
  if (!family) {
    return NextResponse.json({ error: "No family set up yet" }, { status: 404 });
  }

  try {
    const map = await integrate(family.id);
    const plan = await generateWeeklyPlan(family.id, new Date());
    return NextResponse.json({
      ok: true,
      revision: map.revision,
      week_of: plan.week_of,
    });
  } catch (err) {
    console.error("integrator run failed", err);
    return NextResponse.json(
      { error: "I couldn't finish drafting the week — please try again." },
      { status: 502 },
    );
  }
}
