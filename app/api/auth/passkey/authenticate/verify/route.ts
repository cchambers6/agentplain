// POST /api/auth/passkey/authenticate/verify
//
// Step 2 of signing in with a passkey. Public (no session yet). Verify the
// assertion against the issued challenge + the stored credential, then issue
// the SAME 30-day session cookie the magic-link verify route produces by
// reusing writeSession() (per the brief — passkey login is a peer of magic
// link, not a separate session shape).

import { NextResponse } from "next/server";
import { writeSession, type SessionPayload } from "@/lib/auth/session";
import { verifyAuthentication } from "@/lib/auth/passkey";
import { clearChallenge, readChallenge } from "@/lib/auth/webauthn";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | { response?: unknown }
    | null;
  if (!body || !body.response) {
    return NextResponse.json({ error: "Missing response" }, { status: 400 });
  }

  const challenge = await readChallenge("authenticate");
  if (!challenge) {
    return NextResponse.json(
      { error: "That sign-in request expired. Try again." },
      { status: 400 },
    );
  }

  const resolution = await verifyAuthentication({
    responseJSON: body.response,
    expectedChallenge: challenge.challenge,
  });
  await clearChallenge();

  if (!resolution) {
    return NextResponse.json(
      { error: "We couldn't verify that passkey. Use your email instead." },
      { status: 401 },
    );
  }

  const session: SessionPayload = {
    userId: resolution.userId,
    email: resolution.email,
    isOperator: resolution.isOperator,
    activeWorkspaceId: resolution.defaultWorkspaceId,
    issuedAt: new Date().toISOString(),
  };
  await writeSession(session, { remember: true });

  const redirect = resolution.defaultWorkspaceId
    ? `/app/workspace/${resolution.defaultWorkspaceId}`
    : "/app";
  return NextResponse.json({ ok: true, redirect });
}
