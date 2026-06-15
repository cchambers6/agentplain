// Session cookies via iron-session.
//
// Iron-session encrypts the session payload with SESSION_PASSWORD; the cookie
// is sealed (tamper-evident) so we can store user_id + active_workspace_id
// without a server-side session table. There is NO Prisma Session row — the
// sealed cookie IS the session record. That means the cookie maxAge and the
// iron-session ttl are the only two TTL knobs, and they must stay aligned so
// a still-valid cookie can never present a stale seal (or vice versa).

import { sealData, unsealData } from "iron-session";
import { cookies } from "next/headers";
import { env } from "../env";

export interface SessionPayload {
  userId: string;
  email: string;
  isOperator: boolean;
  /** Workspace the user is currently acting in. Null until they pick one. */
  activeWorkspaceId: string | null;
  /** Iso8601 timestamp; iron-session also enforces TTL via cookie maxAge. */
  issuedAt: string;
}

export interface WriteSessionOptions {
  /**
   * True (default) → 30-day persistent cookie + 30-day seal. Survives browser
   * restarts. Standard SaaS "remember this device" behavior.
   * False → session cookie (cleared when the browser closes) + 24-hour seal
   * cap as a server-side safety net.
   */
  remember?: boolean;
}

export const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_COOKIE_SEAL_TTL_SECONDS = 60 * 60 * 24; // 24h cap on session cookies

const cookieBase = (origin: string) => ({
  httpOnly: true,
  secure: origin.startsWith("https://"),
  sameSite: "lax" as const,
  path: "/",
});

const cookieOpts = (origin: string, remember: boolean) => {
  const base = cookieBase(origin);
  if (!remember) {
    // Omit maxAge → browser treats as a session cookie and clears on close.
    return base;
  }
  return { ...base, maxAge: REMEMBER_MAX_AGE_SECONDS };
};

/**
 * Returns cookie options suitable for direct use with response.cookies.set()
 * in a Route Handler. Use this when you need to set the cookie on a specific
 * NextResponse (e.g. a redirect), rather than mutating the global cookie jar
 * via cookies() from next/headers — the latter can drop Max-Age on redirects
 * in Next.js 14.
 */
export const buildSessionCookieOpts = (remember: boolean) => {
  const base = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
  };
  if (!remember) return base;
  return { ...base, maxAge: REMEMBER_MAX_AGE_SECONDS };
};

// Seal/unseal the raw session token, decoupled from the cookie jar. The web
// flow seals into an httpOnly cookie (writeSession); the mobile flow returns
// the SAME sealed string in a JSON body so a native client can store it in
// SecureStore and replay it as a bearer credential. There is exactly one
// iron-session boundary (this file) — both surfaces share it, so a future
// seal-format change is a one-file edit. See lib/auth/mobile-session.ts.
export async function sealSessionToken(
  payload: SessionPayload,
  options: WriteSessionOptions = {},
): Promise<string> {
  const remember = options.remember ?? true;
  const sealTtl = remember ? REMEMBER_MAX_AGE_SECONDS : SESSION_COOKIE_SEAL_TTL_SECONDS;
  return sealData(payload, {
    password: env.sessionPassword(),
    ttl: sealTtl,
  });
}

export async function unsealSessionToken(
  raw: string,
): Promise<SessionPayload | null> {
  if (!raw) return null;
  try {
    return await unsealData<SessionPayload>(raw, {
      password: env.sessionPassword(),
    });
  } catch {
    return null;
  }
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(env.sessionCookieName())?.value;
  return unsealSessionToken(raw ?? "");
}

export async function writeSession(
  payload: SessionPayload,
  options: WriteSessionOptions = {},
): Promise<void> {
  const remember = options.remember ?? true;
  const sealed = await sealSessionToken(payload, { remember });
  const jar = await cookies();
  jar.set(
    env.sessionCookieName(),
    sealed,
    cookieOpts(env.appPublicOrigin(), remember),
  );
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(env.sessionCookieName(), "", {
    ...cookieBase(env.appPublicOrigin()),
    maxAge: 0,
  });
}
