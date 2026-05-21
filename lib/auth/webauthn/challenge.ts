// Short-lived WebAuthn challenge store.
//
// WebAuthn is a two-step handshake: /options issues a random challenge, then
// /verify must confirm the assertion signed THAT challenge. We hold the
// challenge in a sealed (iron-session) httpOnly cookie rather than a DB table:
//   - The authenticate flow has no session yet, so a server-side per-user row
//     would need its own lookup key anyway; the cookie already rides the
//     request.
//   - Sealing with SESSION_PASSWORD makes it tamper-evident, and a 5-minute
//     TTL bounds replay.
//
// Cookie mutation is only legal from a Route Handler / Server Action — every
// caller here is a passkey Route Handler, matching the magic-link verify route.

import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { env } from "../../env";

const CHALLENGE_COOKIE = "agentplain_webauthn_chal";
const CHALLENGE_TTL_SECONDS = 60 * 5; // 5 minutes

export type ChallengeKind = "register" | "authenticate";

interface ChallengePayload {
  challenge: string;
  kind: ChallengeKind;
  /** Bound to the session user for registration; absent for authentication. */
  userId?: string;
}

export async function writeChallenge(payload: ChallengePayload): Promise<void> {
  const sealed = await sealData(payload, {
    password: env.sessionPassword(),
    ttl: CHALLENGE_TTL_SECONDS,
  });
  const origin = env.appPublicOrigin();
  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, sealed, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

export async function readChallenge(
  kind: ChallengeKind,
): Promise<ChallengePayload | null> {
  const jar = await cookies();
  const raw = jar.get(CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const payload = await unsealData<ChallengePayload>(raw, {
      password: env.sessionPassword(),
    });
    if (payload.kind !== kind) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function clearChallenge(): Promise<void> {
  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
