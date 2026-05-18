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
import { verifyMagicLink, writeSession, type SessionPayload } from "@/lib/auth";

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
  await writeSession(session);

  const destination = result.defaultWorkspaceId
    ? `/app/workspace/${result.defaultWorkspaceId}`
    : "/app";
  return NextResponse.redirect(new URL(destination, origin), { status: 303 });
}
