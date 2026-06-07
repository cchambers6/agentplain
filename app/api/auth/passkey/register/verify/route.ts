// POST /api/auth/passkey/register/verify
//
// Step 2 of adding a passkey: verify the attestation the authenticator
// produced against the challenge we issued, then persist the credential.
// The challenge cookie is bound to the session user — a mismatch is rejected.

import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { verifyAndPersistRegistration } from "@/lib/auth/passkey";
import {
  clearChallenge,
  getWebAuthnProviderForRequest,
  readChallenge,
  requestOriginInfo,
} from "@/lib/auth/webauthn";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { response?: unknown; label?: string }
    | null;
  if (!body || !body.response) {
    return NextResponse.json({ error: "Missing response" }, { status: 400 });
  }

  const challenge = await readChallenge("register");
  if (!challenge || challenge.userId !== session.userId) {
    return NextResponse.json(
      { error: "That passkey request expired. Try adding it again." },
      { status: 400 },
    );
  }

  const provider = getWebAuthnProviderForRequest(await requestOriginInfo());
  const result = await verifyAndPersistRegistration({
    userId: session.userId,
    responseJSON: body.response,
    expectedChallenge: challenge.challenge,
    label: body.label ?? null,
    provider,
  });
  await clearChallenge();

  if (!result.ok) {
    const message =
      result.reason === "duplicate"
        ? "That passkey is already registered."
        : "We couldn't verify that passkey. Try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
