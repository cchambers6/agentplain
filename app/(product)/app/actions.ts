"use server";

// Server actions for the auth flow. Lives at the route layer (not in lib/)
// because they read FormData and call redirect() — both Next.js-specific.
// Domain logic stays in lib/auth/flows.ts.

import { redirect } from "next/navigation";
import {
  requestMagicLink,
  signUpBrokerOwner,
  verifyMagicLink,
  writeSession,
  clearSession,
  type SessionPayload,
} from "@/lib/auth";
import { verticalEnumFromSlug } from "@/lib/auth/vertical-enum";
import { getVerticalContent } from "@/lib/verticals";

const formString = (form: FormData, key: string): string => {
  const v = form.get(key);
  if (typeof v !== "string") return "";
  return v.trim();
};

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Optional follow-up message rendered by the page. */
  notice?: string;
}

export async function signUpAction(
  _prev: ActionResult | undefined,
  form: FormData,
): Promise<ActionResult> {
  const email = formString(form, "email");
  const brokerageName = formString(form, "brokerageName");
  const ownerName = formString(form, "ownerName") || null;
  const verticalSlug = formString(form, "vertical").toLowerCase();
  // Validate via main's content registry — the slug must exist there for the
  // marketing/[vertical] page, the JTBD tables, the ROI anchor, etc. Slug →
  // Prisma enum mapping happens at this single boundary (lib/auth/vertical-enum).
  if (!getVerticalContent(verticalSlug)) {
    return { ok: false, error: "Pick a vertical to continue" };
  }
  const verticalEnum = verticalEnumFromSlug(verticalSlug);
  if (!verticalEnum) {
    return { ok: false, error: "Pick a vertical to continue" };
  }

  try {
    await signUpBrokerOwner({
      email,
      brokerageName,
      ownerName,
      vertical: verticalEnum,
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  // Issue a magic link immediately so they can verify and land in their workspace.
  try {
    await requestMagicLink({ email, purpose: "sign_up" });
  } catch (err) {
    return {
      ok: false,
      error: `Account created, but we couldn't send the verification email: ${errorMessage(err)}`,
    };
  }

  return {
    ok: true,
    notice: `Check ${email}. The sign-in link is valid for 15 minutes.`,
  };
}

export async function requestSignInAction(
  _prev: ActionResult | undefined,
  form: FormData,
): Promise<ActionResult> {
  const email = formString(form, "email");
  try {
    await requestMagicLink({ email, purpose: "sign_in" });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  // Always tell the user the same thing regardless of whether the email exists,
  // to avoid email enumeration.
  return {
    ok: true,
    notice: `If that email is registered, a sign-in link is on its way. It's valid for 15 minutes.`,
  };
}

export async function verifyAction(rawToken: string): Promise<{
  ok: true;
  destination: string;
} | { ok: false; error: string }> {
  if (!rawToken || rawToken.length < 32) {
    return { ok: false, error: "Invalid sign-in link" };
  }
  let result: Awaited<ReturnType<typeof verifyMagicLink>>;
  try {
    result = await verifyMagicLink({ rawToken });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
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
  return { ok: true, destination };
}

export async function signOutAction(): Promise<void> {
  await clearSession();
  redirect("/app/sign-in");
}

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";
