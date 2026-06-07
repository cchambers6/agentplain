// POST /api/auth/magic-link
//
// Sends a sign-in magic link. This is the JSON twin of the web sign-in
// server action (app/(product)/app/actions.ts) — the native app can't invoke
// a Next server action, so it POSTs here instead. Both paths funnel into the
// same domain function, requestMagicLink() (lib/auth/flows.ts); this route
// adds NO new backend, it just exposes the existing flow over JSON.
//
// Anti-enumeration: ALWAYS returns 200 { ok: true } whether or not an account
// matched, mirroring requestMagicLink's delivered:false branch. The body never
// reveals whether the email is registered.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requestMagicLink } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  email: z.string().email(),
  remember: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "a valid email is required" },
      { status: 400 },
    );
  }

  try {
    await requestMagicLink({
      email: parsed.data.email,
      purpose: "sign_in",
      remember: parsed.data.remember,
    });
  } catch {
    // Swallow: requestMagicLink only throws on a malformed address (already
    // rejected by zod) or a transient provider error. Surfacing either would
    // leak signal / internal state — the anti-enumeration contract is a
    // uniform 200 regardless.
  }

  return NextResponse.json({ ok: true });
}
