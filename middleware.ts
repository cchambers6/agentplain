// Edge middleware for /app and /operator gates.
//
// We do TWO things here, both fast:
//   1. Force HTTPS on production hosts (defense in depth on cookie security).
//   2. Pre-gate /app/* (except /app/sign-in, /app/sign-up, /app/verify) and
//      /operator/* so unauthenticated browsers get redirected to /app/sign-in
//      WITHOUT hitting a server component.
//
// Deeper auth — full session payload, role-in-workspace assertion, isOperator
// check — happens in route handlers and page loaders via lib/auth/server.
// Middleware only sniffs cookie *presence* (cheap, no decryption); the route
// does the real authorization. This split keeps RLS the LAST line of
// defense, the app-layer assertions the primary gate, and middleware a
// low-cost reject for "not signed in at all" cases.

import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_APP_PATHS = ["/app/sign-in", "/app/sign-up", "/app/verify"];

const isPublicAppPath = (pathname: string): boolean =>
  PUBLIC_APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "agentplain_session";

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/app") && !pathname.startsWith("/operator")) {
    return NextResponse.next();
  }

  if (isPublicAppPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = !!req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/app/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Match /app and /operator routes. Leave /api/* unguarded here — webhooks
// need raw access; route handlers do their own auth. Operator-role
// assertion happens in app/(operator)/layout.tsx via requireUser +
// session.isOperator.
export const config = {
  matcher: ["/app/:path*", "/operator/:path*"],
};
