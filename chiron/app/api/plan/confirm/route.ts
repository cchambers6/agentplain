import { NextResponse } from "next/server";
import { z } from "zod";
import { currentParentEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  /// The exact conflict/review item text the parent is answering.
  item: z.string().min(1).max(500),
  decision: z.string().min(1).max(200), // "a" | "b" | "yes" | "no" | freetext
});

// Writes a parent decision back onto the latest IntegrationMap — the
// "Choices for you" section on /plan. Append-only; re-deciding an item adds
// a newer entry (latest wins on read).
export async function POST(req: Request) {
  if (!currentParentEmail()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const parsed = confirmSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const map = await prisma.integrationMap.findFirst({
    orderBy: { revision: "desc" },
    select: { id: true, parentDecisions: true },
  });
  if (!map) {
    return NextResponse.json({ error: "No plan to confirm yet" }, { status: 404 });
  }

  const decisions = Array.isArray(map.parentDecisions) ? map.parentDecisions : [];
  decisions.push({
    item: parsed.data.item,
    decision: parsed.data.decision,
    decidedAt: new Date().toISOString(),
  });
  await prisma.integrationMap.update({
    where: { id: map.id },
    data: { parentDecisions: decisions },
  });

  return NextResponse.json({ ok: true });
}
