import { currentParentEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { aiCall, tierConfigured } from "@/lib/ai/route";

export const dynamic = "force-dynamic";

// Daily-loop chat endpoint (SSE). M1 scope: persist every turn to today's
// DailyLog.debriefTranscript and stream a reply. When the conversational
// tier is configured it answers as Chiron (M3 replaces this with the full
// Tutor-Advisor debrief pipeline); when unconfigured it acknowledges
// honestly rather than pretending.
export async function POST(req: Request) {
  if (!currentParentEmail()) {
    return new Response("Not signed in", { status: 401 });
  }

  const { message } = await req.json().catch(() => ({ message: "" }));
  if (typeof message !== "string" || !message.trim()) {
    return new Response("Empty message", { status: 400 });
  }

  const family = await prisma.family.findFirst({ include: { children: true } });
  const child = family?.children[0];
  if (!family || !child) {
    return new Response("Onboarding incomplete", { status: 409 });
  }

  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);

  const parentTurn = { role: "parent", text: message, at: new Date().toISOString() };
  const existing = await prisma.dailyLog.findUnique({
    where: { childId_date: { childId: child.id, date: day } },
  });
  const log = existing
    ? await prisma.dailyLog.update({
        where: { id: existing.id },
        data: {
          debriefTranscript: [
            ...(existing.debriefTranscript as object[]),
            parentTurn,
          ],
        },
      })
    : await prisma.dailyLog.create({
        data: {
          workspaceId: family.id,
          familyId: family.id,
          childId: child.id,
          date: day,
          debriefTranscript: [parentTurn],
        },
      });

  let reply: string;
  if (tierConfigured("conversational")) {
    const result = await aiCall({
      tier: "conversational",
      agent: "tutor",
      familyId: family.id,
      system: [
        {
          text:
            `You are Chiron, a calm, wise tutor-advisor speaking with a homeschool parent-teacher about ${child.name}. ` +
            `You serve the parent, never the child. Never reproduce curriculum content — refer to lessons by number/label only. ` +
            `Never mention AI models, providers, or technology vendors. Reply in 2-4 warm, concrete sentences.`,
          stable: true,
        },
      ],
      messages: [{ role: "user", content: message }],
    });
    reply = result.text;
  } else {
    reply =
      `Noted — I've saved that to today's log for ${child.name}. ` +
      `My full daily debrief arrives in the next milestone; nothing you tell me here is lost.`;
  }

  await prisma.dailyLog.update({
    where: { id: log.id },
    data: {
      debriefTranscript: [
        ...(log.debriefTranscript as object[]),
        { role: "chiron", text: reply, at: new Date().toISOString() },
      ],
    },
  });

  // Stream the reply as SSE word-chunks.
  const encoder = new TextEncoder();
  const words = reply.split(/(\s+)/);
  const stream = new ReadableStream({
    async start(controller) {
      for (const w of words) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ delta: w })}\n\n`),
        );
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
