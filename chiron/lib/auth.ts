import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Single-family POC auth: one parent account, configured by env, session held
// in an HMAC-signed cookie. Deliberately no auth provider (out of scope per
// the POC brief) — swap this module wholesale when multi-family lands.

const COOKIE_NAME = "chiron_session";
const SESSION_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function sessionCookieValue(email: string): string {
  const payload = `${email}|${Date.now() + SESSION_DAYS * 86_400_000}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifySessionValue(value: string | undefined): string | null {
  if (!value) return null;
  const [b64, sig] = value.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString();
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [email, expires] = payload.split("|");
  if (!email || Number(expires) < Date.now()) return null;
  if (email !== process.env.FAMILY_ADMIN_EMAIL) return null;
  return email;
}

export function currentParentEmail(): string | null {
  return verifySessionValue(cookies().get(COOKIE_NAME)?.value);
}

export const SESSION_COOKIE = {
  name: COOKIE_NAME,
  maxAgeSeconds: SESSION_DAYS * 86_400,
};
