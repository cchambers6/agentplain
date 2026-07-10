import { NextResponse } from "next/server";

// Weekly Headmaster cycle (Vercel Cron; see vercel.json).
// M1 ships the guarded endpoint; M4 wires the actual weekly-plan and
// Friday-report runs behind it. Returning 501 (not a fake 200) keeps the
// truthful-state discipline: the cron is scheduled, the brain isn't in yet.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const run = new URL(req.url).searchParams.get("run");
  return NextResponse.json(
    { error: `headmaster ${run ?? "run"} not implemented until M4` },
    { status: 501 },
  );
}
