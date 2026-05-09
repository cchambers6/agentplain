// Session cookies via iron-session.
//
// Iron-session encrypts the session payload with SESSION_PASSWORD; the cookie
// is sealed (tamper-evident) so we can store user_id + active_workspace_id
// without a server-side session table.

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

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

const cookieOpts = (origin: string) => ({
  httpOnly: true,
  secure: origin.startsWith("https://"),
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS,
});

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(env.sessionCookieName())?.value;
  if (!raw) return null;
  try {
    return await unsealData<SessionPayload>(raw, {
      password: env.sessionPassword(),
    });
  } catch {
    return null;
  }
}

export async function writeSession(payload: SessionPayload): Promise<void> {
  const sealed = await sealData(payload, {
    password: env.sessionPassword(),
    ttl: COOKIE_MAX_AGE_SECONDS,
  });
  const jar = await cookies();
  jar.set(env.sessionCookieName(), sealed, cookieOpts(env.appPublicOrigin()));
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(env.sessionCookieName(), "", {
    ...cookieOpts(env.appPublicOrigin()),
    maxAge: 0,
  });
}
