import { NextResponse } from "next/server";
import { sessionCookieValue, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  const expected = process.env.FAMILY_ADMIN_EMAIL;

  if (!expected || typeof email !== "string" || email.trim().toLowerCase() !== expected.toLowerCase()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  // Cookie set on the response that completes the sign-in (the PR #270
  // lesson: set cookies on the response the browser actually follows).
  res.cookies.set(SESSION_COOKIE.name, sessionCookieValue(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_COOKIE.maxAgeSeconds,
    path: "/",
  });
  return res;
}
