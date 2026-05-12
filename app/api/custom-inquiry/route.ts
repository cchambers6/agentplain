// POST /api/custom-inquiry — server-side intake for the /custom contact
// form. Stays inside `project_no_outbound_architecture.md`: the form posts
// here, this route hands off to `submitCustomInquiry` which sends ONE
// email to Conner's inbox and renders an ack. No drip, no follow-up.

import { NextResponse } from "next/server";
import { submitCustomInquiry } from "@/lib/custom-inquiry";

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

  const result = await submitCustomInquiry(body);
  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }
  // Field-level errors → 400 so the form surfaces them. Mail-send errors
  // → 500 so the customer knows to retry.
  const status = result.fieldErrors ? 400 : 500;
  return NextResponse.json(result, { status });
}
