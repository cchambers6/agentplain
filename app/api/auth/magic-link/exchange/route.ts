// POST /api/auth/magic-link/exchange
//
// Native counterpart of the web verify route (app/(product)/app/verify/route.ts).
// The web route consumes the raw magic-link token and writes an httpOnly
// session COOKIE, then 303-redirects into the dashboard. A native client can't
// use either a cookie or a redirect, so this route consumes the same token via
// verifyMagicLink() and returns the sealed session in the JSON body. The app
// stores `token` in Expo SecureStore and replays it as a bearer credential
// (see lib/auth/mobile-session.ts).
//
// POST (not GET) so the raw token travels in the request body, never in a URL
// that proxies / access logs would capture.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  verifyMagicLink,
  sealSessionToken,
  type SessionPayload,
} from "@/lib/auth";
import { withSystemContext } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  token: z.string().min(16),
  remember: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "a token is required" }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof verifyMagicLink>>;
  try {
    result = await verifyMagicLink({ rawToken: parsed.data.token });
  } catch (err) {
    // verifyMagicLink throws "Invalid or expired link" / "already been used" /
    // "has expired" — all 401 to the client.
    const message =
      err instanceof Error ? err.message : "Invalid or expired link";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const session: SessionPayload = {
    userId: result.userId,
    email: result.email,
    isOperator: result.isOperator,
    activeWorkspaceId: result.defaultWorkspaceId,
    issuedAt: new Date().toISOString(),
  };
  const token = await sealSessionToken(session, {
    remember: parsed.data.remember ?? true,
  });

  // Mirror the web verify route's onboarding landing decision so the app can
  // route a not-yet-onboarded customer straight to the wizard.
  let onboardingDone = false;
  if (result.defaultWorkspaceId) {
    const ob = await withSystemContext((tx) =>
      tx.onboardingState.findUnique({
        where: { workspaceId: result.defaultWorkspaceId! },
        select: { completedAt: true },
      }),
    ).catch(() => null);
    onboardingDone = ob?.completedAt != null;
  }

  return NextResponse.json({
    token,
    userId: result.userId,
    email: result.email,
    isOperator: result.isOperator,
    activeWorkspaceId: result.defaultWorkspaceId,
    onboardingDone,
  });
}
