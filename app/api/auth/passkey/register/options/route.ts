// POST /api/auth/passkey/register/options
//
// Step 1 of adding a passkey: a signed-in user asks for registration options.
// We persist the challenge in a sealed cookie and return the options JSON for
// @simplewebauthn/browser's startRegistration().

import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";
import { buildRegistrationOptions } from "@/lib/auth/passkey";
import {
  getWebAuthnProviderForRequest,
  requestOriginInfo,
  writeChallenge,
} from "@/lib/auth/webauthn";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Register against the rpID for THIS host so the credential authenticates
  // on the same host later (apex+app collapse to the same registrable parent).
  const provider = getWebAuthnProviderForRequest(await requestOriginInfo());
  const { optionsJSON, challenge } = await buildRegistrationOptions(
    session.userId,
    session.email,
    session.email,
    provider,
  );
  await writeChallenge({ challenge, kind: "register", userId: session.userId });

  return NextResponse.json(optionsJSON);
}
