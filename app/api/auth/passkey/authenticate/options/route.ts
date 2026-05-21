// POST /api/auth/passkey/authenticate/options
//
// Step 1 of signing in with a passkey. Public (no session yet). We request a
// discoverable credential — empty allowCredentials — so the authenticator
// offers whatever passkey it holds for this RP and the user never types an
// email. The challenge is held in a sealed cookie for the verify step.

import { NextResponse } from "next/server";
import {
  getWebAuthnProvider,
  writeChallenge,
} from "@/lib/auth/webauthn";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const { optionsJSON, challenge } =
    await getWebAuthnProvider().generateAuthenticationOptions({});
  await writeChallenge({ challenge, kind: "authenticate" });
  return NextResponse.json(optionsJSON);
}
