import { NextResponse } from "next/server";
import { currentParentEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateWeeklyPlan, isMockMode } from "@/lib/agents/integrator/run";

export const dynamic = "force-dynamic";

// Dev-only (mock mode): regenerate the current week from the cached
// IntegrationMap — the "Reset seeded week" button on /plan. Disabled outside
// CHIRON_AI_MODE=mock so it can never burn a live heavy-tier call by
// accident.
export async function POST() {
  if (!currentParentEmail()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isMockMode()) {
    return NextResponse.json({ error: "Reset is a mock-mode tool" }, { status: 403 });
  }
  const family = await prisma.family.findFirst({ select: { id: true } });
  if (!family) {
    return NextResponse.json({ error: "No family set up yet" }, { status: 404 });
  }
  const plan = await generateWeeklyPlan(family.id, new Date());
  return NextResponse.json({ ok: true, week_of: plan.week_of });
}
