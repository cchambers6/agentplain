// High-level auth flows: signup (creates workspace + broker-owner membership),
// sign-in request (issues magic link), and verify (consumes the token, writes session).
//
// The flow OWNS token generation, hashing, persistence, and verifyUrl construction.
// The AuthProvider is a thin email-delivery seam.
//
// All DB access wrapped in withSystemContext — magic-link issuance happens
// before a user has a session, so the operator/system identity is the only
// caller that can read/write User and MagicLinkToken.

import type {
  Prisma,
  User,
  Vertical,
  Workspace,
  WorkspaceVerticalTier,
} from "@prisma/client";
import { provisionTrialSubscriptionSafe } from "../billing/provisioning";
import { withSystemContext } from "../db/rls";
import { env } from "../env";
import { getVerticalContent } from "../verticals";
import { getAuthProvider } from "./index";
import { generateRawToken, hashToken, tokenExpiresAt } from "./token";
import type { MagicLinkPurpose } from "./types";
import {
  verticalSlugFromEnum,
  verticalTierFromContentTier,
} from "./vertical-enum";

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "workspace";

const buildVerifyUrl = (rawToken: string, remember?: boolean): string => {
  const origin = env.appPublicOrigin().replace(/\/$/, "");
  const params = new URLSearchParams({ token: rawToken });
  // Encode only when the user explicitly opted OUT of remember-me. Absence of
  // the param at the verify route defaults to remember=true (persistent), so
  // existing magic links and the sign-up flow keep working unchanged.
  if (remember === false) params.set("remember", "0");
  return `${origin}/app/verify?${params.toString()}`;
};

const isOperatorEmail = (email: string): boolean =>
  env.operatorEmailAllowlist().includes(email.toLowerCase());

export interface SignUpInput {
  email: string;
  brokerageName: string;
  ownerName?: string | null;
  /** One of the canonical 9 verticals (product_spec.md §13.2). */
  vertical: Vertical;
  /** Customer-selected tier (per 2026-05-15 three-tier amendment to
   *  `project_stripe_both_surfaces.md`). When omitted, fall back to the
   *  vertical's default tier from the content registry — preserves the
   *  earlier behavior for callers that haven't been updated yet. */
  verticalTier?: WorkspaceVerticalTier;
  /** Wave-2 CC-at-trial: when true, signUpBrokerOwner returns AFTER the
   *  workspace transaction commits WITHOUT calling the legacy
   *  `provisionTrialSubscriptionSafe`. The signup server action then
   *  drives Stripe Checkout for card capture and the
   *  `customer.subscription.created` webhook creates the Subscription
   *  row. When false/omitted, the legacy in-flow provisioning runs and
   *  the API contract matches every existing caller. */
  skipBillingProvisioning?: boolean;
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
  // Validate the vertical against main's content registry (lib/verticals).
  // Translate enum → slug → content → tier so the persistence and marketing
  // layers stay aligned without a duplicated tier mapping.
  const verticalSlug = verticalSlugFromEnum(input.vertical);
  const verticalContent = verticalSlug
    ? getVerticalContent(verticalSlug)
    : null;
  if (!verticalContent) {
    throw new Error("Pick a vertical to continue");
  }
  // Caller-supplied tier wins (sign-up picker per 2026-05-15). When absent,
  // fall back to the content registry's default tier — keeps the older API
  // working until every caller migrates.
  const verticalTier =
    input.verticalTier ?? verticalTierFromContentTier(verticalContent.tier);

  const created = await withSystemContext(async (tx) => {
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
        // Phase 1 legacy tier kept on the row; verticalTier drives product
        // surfaces. Slug→content→tier mapping translates lowercase content
        // tier to the uppercase Prisma enum.
        tier: "HIGH_TOUCH",
        verticalTier,
        vertical: input.vertical,
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

    await tx.onboardingState.create({
      data: {
        workspaceId: workspace.id,
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
          vertical: input.vertical,
          verticalTier,
        } satisfies Prisma.InputJsonValue,
      },
    });

    return { user, workspace };
  });

  // Provision Stripe Customer + trialing Subscription AFTER the DB
  // commits. Network IO doesn't belong inside the workspace tx, and
  // per feedback_max_friction_reduction_for_trials signup must not
  // block on a Stripe outage — the helper swallows failures into an
  // audit row that the trial-expiration cron / billing page surface.
  //
  // Wave-2 CC-at-trial: when the caller opts in to `skipBillingProvisioning`,
  // it owns the Stripe Customer + Checkout creation downstream (via
  // `lib/billing/checkout.ts#createTrialCheckoutForSignup`). The pre-
  // pivot callers (CLI scripts, tests that don't exercise Checkout)
  // keep the legacy behavior.
  if (!input.skipBillingProvisioning) {
    await provisionTrialSubscriptionSafe(
      {
        workspaceId: created.workspace.id,
        workspaceName: created.workspace.name,
        email,
        verticalTier,
      },
      { id: created.workspace.id },
    );
  }

  return created;
}

export interface RequestMagicLinkInput {
  email: string;
  purpose: MagicLinkPurpose;
  /**
   * Whether the eventual session should persist across browser restarts.
   * Omit (or true) → standard 30-day persistent cookie. False → session
   * cookie cleared on browser close. Round-trips to the verify route via
   * the magic link URL.
   */
  remember?: boolean;
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
    const verifyUrl = buildVerifyUrl(rawToken, input.remember);

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
