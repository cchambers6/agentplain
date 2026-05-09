// High-level auth flows: signup (creates workspace + broker-owner membership),
// sign-in request (issues magic link), and verify (consumes the token, writes session).
//
// The flow OWNS token generation, hashing, persistence, and verifyUrl construction.
// The AuthProvider is a thin email-delivery seam.
//
// All DB access wrapped in withSystemContext — magic-link issuance happens
// before a user has a session, so the operator/system identity is the only
// caller that can read/write User and MagicLinkToken.

import type { Prisma, User, Workspace } from "@prisma/client";
import { withSystemContext } from "../db/rls";
import { env } from "../env";
import { getAuthProvider } from "./index";
import { generateRawToken, hashToken, tokenExpiresAt } from "./token";
import type { MagicLinkPurpose } from "./types";

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";

const buildVerifyUrl = (rawToken: string): string => {
  const origin = env.appPublicOrigin().replace(/\/$/, "");
  const params = new URLSearchParams({ token: rawToken });
  return `${origin}/app/verify?${params.toString()}`;
};

const isOperatorEmail = (email: string): boolean =>
  env.operatorEmailAllowlist().includes(email.toLowerCase());

export interface SignUpInput {
  email: string;
  brokerageName: string;
  ownerName?: string | null;
}

export interface SignUpResult {
  user: User;
  workspace: Workspace;
}

export async function signUpBrokerOwner(input: SignUpInput): Promise<SignUpResult> {
  const email = input.email.toLowerCase().trim();
  if (!/.+@.+\..+/.test(email)) {
    throw new Error("Invalid email address");
  }
  const brokerageName = input.brokerageName.trim();
  if (brokerageName.length < 2) {
    throw new Error("Brokerage name must be at least 2 characters");
  }

  return withSystemContext(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingBrokerOwnerMembership = await tx.membership.findFirst({
        where: { userId: existingUser.id, role: "BROKER_OWNER" },
      });
      if (existingBrokerOwnerMembership) {
        throw new Error(
          "An account with this email already exists. Sign in instead.",
        );
      }
    }

    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email,
          name: input.ownerName?.trim() || null,
          isOperator: isOperatorEmail(email),
        },
      }));

    const baseSlug = slugify(brokerageName);
    let slug = baseSlug;
    for (let i = 0; i < 5; i++) {
      const collision = await tx.workspace.findUnique({ where: { slug } });
      if (!collision) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const workspace = await tx.workspace.create({
      data: {
        name: brokerageName,
        slug,
        tier: "HIGH_TOUCH",
        billingMode: "MANUAL_INVOICE",
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "BROKER_OWNER",
        status: "ACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        workspaceId: workspace.id,
        action: "workspace.created",
        targetTable: "Workspace",
        targetId: workspace.id,
        payload: {
          via: "self_signup",
          tier: "HIGH_TOUCH",
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { user, workspace };
  });
}

export interface RequestMagicLinkInput {
  email: string;
  purpose: MagicLinkPurpose;
}

export interface RequestMagicLinkResult {
  /** True if a user exists and a link was sent. False = no user matched (we never reveal). */
  delivered: boolean;
  /** Provider message id, if delivered. */
  messageId: string | null;
}

export async function requestMagicLink(
  input: RequestMagicLinkInput,
): Promise<RequestMagicLinkResult> {
  const email = input.email.toLowerCase().trim();
  if (!/.+@.+\..+/.test(email)) {
    throw new Error("Invalid email address");
  }

  return withSystemContext(async (tx) => {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user) {
      // Avoid leaking whether an email is registered.
      return { delivered: false, messageId: null };
    }

    const rawToken = generateRawToken();
    const verifyUrl = buildVerifyUrl(rawToken);

    await tx.magicLinkToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        purpose: input.purpose,
        expiresAt: tokenExpiresAt(),
      },
    });

    const provider = getAuthProvider();
    const { messageId } = await provider.sendMagicLink({
      email,
      purpose: input.purpose,
      verifyUrl,
      displayName: user.name,
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "magic_link.issued",
        payload: {
          purpose: input.purpose,
          provider: provider.providerName,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { delivered: true, messageId };
  });
}

export interface VerifyMagicLinkInput {
  rawToken: string;
}

export interface VerifyMagicLinkResult {
  userId: string;
  email: string;
  isOperator: boolean;
  /** Most-recent active workspace this user is broker-owner of, or null. */
  defaultWorkspaceId: string | null;
}

export async function verifyMagicLink(
  input: VerifyMagicLinkInput,
): Promise<VerifyMagicLinkResult> {
  const tokenHash = hashToken(input.rawToken);
  return withSystemContext(async (tx) => {
    const token = await tx.magicLinkToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!token) throw new Error("Invalid or expired link");
    if (token.consumedAt) throw new Error("This link has already been used");
    if (token.expiresAt < new Date()) throw new Error("This link has expired");

    await tx.magicLinkToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });

    const membership = await tx.membership.findFirst({
      where: { userId: token.userId, role: "BROKER_OWNER", status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: token.userId,
        workspaceId: membership?.workspaceId ?? null,
        action: "session.signed_in",
        payload: { purpose: token.purpose, via: "magic_link" },
      },
    });

    return {
      userId: token.user.id,
      email: token.user.email,
      isOperator: token.user.isOperator,
      defaultWorkspaceId: membership?.workspaceId ?? null,
    };
  });
}

export const __test_only = {
  buildVerifyUrl,
  slugify,
};
