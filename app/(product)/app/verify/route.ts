// Magic-link verification endpoint.
//
// Implemented as a Route Handler — not a Server Component page — because the
// happy path writes the session cookie via writeSession(). Next.js forbids
// cookie mutation from a Server Component render; only Server Actions and
// Route Handlers may set cookies. (Previously a page.tsx, which crashed in
// production with digest 2234350772: "Cookies can only be modified in a
// Server Action or Route Handler" — see docs/incident-log.md.)
//
// Failure cases redirect back to /app/sign-in?reason=<code>, which the
// sign-in page renders as a flash above the form.

import { NextResponse, type NextRequest } from "next/server";
import {
  verifyMagicLink,
  sealSessionToken,
  buildSessionCookieOpts,
  REMEMBER_MAX_AGE_SECONDS,
  type SessionPayload,
} from "@/lib/auth";
import { env } from "@/lib/env";
import { withSystemContext } from "@/lib/db";

type FailureReason = "missing" | "invalid" | "expired" | "used";

const signInUrlWithReason = (origin: string, reason: FailureReason): string => {
  const url = new URL("/app/sign-in", origin);
  url.searchParams.set("reason", reason);
  return url.toString();
};

// Map the three specific error strings thrown by verifyMagicLink onto the
// reason codes the sign-in page renders. Order matters: "Invalid or expired
// link" (token not found, the most common failure) must NOT match the
// "has expired" branch.
const classifyError = (message: string): FailureReason => {
  const m = message.toLowerCase();
  if (m.includes("already been used")) return "used";
  if (m.includes("has expired")) return "expired";
  return "invalid";
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const origin = req.nextUrl.origin;
  // Absent or any non-"0" value → persistent 30-day cookie. Only an explicit
  // remember=0 (set by the sign-in form when the user unchecks the box)
  // downgrades to a session cookie.
  const remember = req.nextUrl.searchParams.get("remember") !== "0";

  if (!token || token.length < 32) {
    return NextResponse.redirect(signInUrlWithReason(origin, "missing"), { status: 303 });
  }

  let result: Awaited<ReturnType<typeof verifyMagicLink>>;
  try {
    result = await verifyMagicLink({ rawToken: token });
  } catch (err) {
    const reason = classifyError(err instanceof Error ? err.message : "");
    return NextResponse.redirect(signInUrlWithReason(origin, reason), { status: 303 });
  }

  const session: SessionPayload = {
    userId: result.userId,
    email: result.email,
    isOperator: result.isOperator,
    activeWorkspaceId: result.defaultWorkspaceId,
    issuedAt: new Date().toISOString(),
  };

  // Seal the session token. Then set it directly on the redirect response via
  // response.cookies.set() rather than the cookies() jar from next/headers.
  // In Next.js 14, mutations to the next/headers cookie jar may not propagate
  // Max-Age into a subsequent NextResponse.redirect() — the cookie value lands
  // but the Max-Age attribute is dropped, silently converting a 30-day
  // persistent cookie into a session cookie cleared on browser close.
  const sealed = await sealSessionToken(session, { remember });
  console.log(
    `[auth] session created — rememberMe=${remember}, maxAge=${remember ? `${REMEMBER_MAX_AGE_SECONDS}s` : "session"}`,
  );

  // Wave-9 — land non-onboarded customers directly on the onboarding
  // wizard so the self-serve flow is the first thing they see. Once
  // OnboardingState.completedAt is set the magic link returns the
  // customer to the dashboard as before.
  let destination: string;
  if (result.defaultWorkspaceId) {
    const onboardingDone = await withSystemContext((tx) =>
      tx.onboardingState.findUnique({
        where: { workspaceId: result.defaultWorkspaceId! },
        select: { completedAt: true },
      }),
    ).catch(() => null);
    destination = onboardingDone?.completedAt
      ? `/app/workspace/${result.defaultWorkspaceId}`
      : `/app/workspace/${result.defaultWorkspaceId}/onboarding`;
  } else {
    destination = "/app";
  }
  const response = NextResponse.redirect(new URL(destination, origin), { status: 303 });
  response.cookies.set(env.sessionCookieName(), sealed, buildSessionCookieOpts(remember));
  return response;
}
