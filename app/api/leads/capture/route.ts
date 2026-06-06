// POST /api/leads/capture — the marketing Plaino widget's lead hand-off.
//
// When an anonymous conversation produces qualified intent (demo / trial /
// "what would this cost for my team"), the widget posts an email + light
// context here. The row lands in LeadCapture and surfaces on /operator/leads.
//
// Same no-outbound posture as /api/custom-inquiry (project_no_outbound_
// architecture): persist the durable artifact; a real human follows up from
// the leads queue. No drip, no auto-reply.

import { NextResponse } from "next/server";
import { submitLeadCapture } from "@/lib/leads";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, formError: "Invalid request body." },
      { status: 400 },
    );
  }

  const result = await submitLeadCapture(body);
  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }
  // Field-level errors → 400 so the widget surfaces them; persistence
  // failures → 500 so the visitor knows to retry.
  const status = result.fieldErrors ? 400 : 500;
  return NextResponse.json(result, { status });
}
