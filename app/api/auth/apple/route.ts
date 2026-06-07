// POST /api/auth/apple
//
// Sign in with Apple — required by App Review §4.8 for an app that offers a
// third-party/email sign-in (our magic link). The native app runs the Apple
// auth flow (expo-apple-authentication), gets a signed identity token, and
// POSTs it here. We verify it (lib/auth/apple), match or create the User by
// the Apple `sub`, and return the SAME sealed session the magic-link exchange
// returns — so Apple is just another door into one identity (no new session
// primitive). Magic link stays the default; this is the additional method.
//
// POST (token in the body, never a URL) + nodejs runtime (crypto verify).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sealSessionToken, type SessionPayload } from "@/lib/auth";
import { verifyAppleIdentityToken, AppleAuthError } from "@/lib/auth/apple";
import { withSystemContext } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  identityToken: z.string().min(16),
  remember: z.boolean().optional(),
  nonce: z.string().min(1).max(256).optional(),
  // Apple returns the name only on first authorization; the client forwards
  // it so we can seed User.name on account creation.
  fullName: z
    .object({
      givenName: z.string().trim().max(120).optional().nullable(),
      familyName: z.string().trim().max(120).optional().nullable(),
    })
    .optional(),
});

function composeName(full?: {
  givenName?: string | null;
  familyName?: string | null;
}): string | null {
  if (!full) return null;
  const parts = [full.givenName, full.familyName].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  return parts.length > 0 ? parts.join(" ") : null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "an Apple identity token is required" },
      { status: 400 },
    );
  }

  let identity;
  try {
    identity = await verifyAppleIdentityToken(parsed.data.identityToken, {
      expectedNonce: parsed.data.nonce,
    });
  } catch (err) {
    const message =
      err instanceof AppleAuthError ? err.message : "Apple sign-in failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const proposedName = composeName(parsed.data.fullName);

  // Match/create the user by Apple sub, then email, then create. All in one
  // transaction so a concurrent first-login can't create two rows.
  let resolved: {
    userId: string;
    email: string;
    isOperator: boolean;
    defaultWorkspaceId: string | null;
  } | null = null;
  try {
    resolved = await withSystemContext(async (tx) => {
      let user = await tx.user.findUnique({ where: { appleSub: identity.sub } });

      if (!user && identity.email) {
        // A returning magic-link user authorizing Apple for the first time —
        // link Apple to the existing identity rather than forking an account.
        const byEmail = await tx.user.findUnique({
          where: { email: identity.email },
        });
        if (byEmail) {
          user = await tx.user.update({
            where: { id: byEmail.id },
            data: { appleSub: identity.sub },
          });
        }
      }

      if (!user) {
        if (!identity.email) {
          // Apple withheld the email (not first authorization) and we have no
          // prior link — we can't safely create an account. The client should
          // fall back to the magic link to establish the identity once.
          return null;
        }
        user = await tx.user.create({
          data: {
            email: identity.email,
            appleSub: identity.sub,
            name: proposedName,
          },
        });
      } else if (proposedName && !user.name) {
        // Backfill the name if we just learned it and didn't have one.
        await tx.user.update({
          where: { id: user.id },
          data: { name: proposedName },
        });
      }

      const membership = await tx.membership.findFirst({
        where: { userId: user.id, role: "BROKER_OWNER", status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          workspaceId: membership?.workspaceId ?? null,
          action: "session.signed_in",
          payload: { via: "apple" },
        },
      });

      return {
        userId: user.id,
        email: user.email,
        isOperator: user.isOperator,
        defaultWorkspaceId: membership?.workspaceId ?? null,
      };
    });
  } catch {
    return NextResponse.json(
      { error: "Could not complete Apple sign-in" },
      { status: 500 },
    );
  }

  if (!resolved) {
    return NextResponse.json(
      {
        error:
          "Apple didn't share an email and we have no existing account to match. Sign in once with a magic link, then Apple will work.",
      },
      { status: 409 },
    );
  }

  const session: SessionPayload = {
    userId: resolved.userId,
    email: resolved.email,
    isOperator: resolved.isOperator,
    activeWorkspaceId: resolved.defaultWorkspaceId,
    issuedAt: new Date().toISOString(),
  };
  const token = await sealSessionToken(session, {
    remember: parsed.data.remember ?? true,
  });

  let onboardingDone = false;
  if (resolved.defaultWorkspaceId) {
    const ob = await withSystemContext((tx) =>
      tx.onboardingState.findUnique({
        where: { workspaceId: resolved.defaultWorkspaceId! },
        select: { completedAt: true },
      }),
    ).catch(() => null);
    onboardingDone = ob?.completedAt != null;
  }

  return NextResponse.json({
    token,
    userId: resolved.userId,
    email: resolved.email,
    isOperator: resolved.isOperator,
    activeWorkspaceId: resolved.defaultWorkspaceId,
    onboardingDone,
  });
}
