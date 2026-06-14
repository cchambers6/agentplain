"use server";

// Server actions for the auth flow. Lives at the route layer (not in lib/)
// because they read FormData and call redirect() — both Next.js-specific.
// Domain logic stays in lib/auth/flows.ts.

import { redirect } from "next/navigation";
import {
  requestMagicLink,
  signUpBrokerOwner,
  clearSession,
} from "@/lib/auth";
import { verticalEnumFromSlug } from "@/lib/auth/vertical-enum";
import { getVerticalContent } from "@/lib/verticals";
import {
  isVerticalSupportedSafe,
  resolveVerticalReadiness,
} from "@/lib/verticals/readiness";
import { submitLeadCapture } from "@/lib/leads";
import { createTrialCheckoutForSignup } from "@/lib/billing/checkout";
import { provisionTrialSubscriptionSafe } from "@/lib/billing/provisioning";
import { env } from "@/lib/env";
import {
  isSelfServeTier,
  SELF_SERVE_TIERS,
  trialPeriodDaysForVertical,
  verticalTierFromTier,
  type TierName,
} from "@/lib/pricing/tiers";
import { getLogger } from "@/lib/observability";

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
  /** Wave-2 CC-at-trial: when set, the SignUpForm redirects the browser
   *  to Stripe Checkout. The form already issued the magic link before
   *  redirecting, so the customer can sign in from the email even if
   *  they cancel out of Checkout. */
  checkoutUrl?: string;
  /** pfd-4 vertical-gating: when the customer picks a vertical whose
   *  killer workflow does not fire yet, the form switches to the honest
   *  waitlist screen instead of proceeding to signup + Stripe. No charge,
   *  no workspace. The slug + name let the form render Plaino-brand copy
   *  naming the vertical. */
  waitlist?: {
    verticalSlug: string;
    verticalName: string;
  };
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
  const verticalContent = getVerticalContent(verticalSlug);
  if (!verticalContent) {
    return { ok: false, error: "Pick a vertical to continue" };
  }
  const verticalEnum = verticalEnumFromSlug(verticalSlug);
  if (!verticalEnum) {
    return { ok: false, error: "Pick a vertical to continue" };
  }

  // pfd-4 UNSUPPORTED-VERTICAL GATE. Nobody pays for a vertical we cannot
  // serve. If the killer workflow for this vertical does not fire today
  // (registry truth: catalog `runtime: 'live'` + a live production caller),
  // we DO NOT proceed to signup + Stripe Checkout. Instead we return the
  // honest waitlist branch — the form swaps to "we don't have a killer
  // workflow ready for <vertical> yet" + a notify-me capture. This runs
  // BEFORE `signUpBrokerOwner`, so no workspace is created and no Stripe
  // customer is provisioned.
  //
  // `isVerticalSupportedSafe` is fail-closed: if the registry can't be read
  // it returns false (→ waitlist), NEVER true (→ take the money). The
  // `general` on-ramp + `real-estate` are the supported slugs today; the
  // other eight verticals route here until their killer-workflow caller
  // lands. `general` is not in the readiness map but is always serveable
  // (the horizontal fleet fires for it), so we let it through explicitly.
  const isOnRampGeneral = verticalSlug === "general";
  if (
    !isOnRampGeneral &&
    !isVerticalSupportedSafe(verticalSlug, (err) =>
      getLogger()
        .child({ boundary: "signup", vertical: verticalSlug })
        .error("vertical-readiness resolver threw — failing closed to waitlist", err),
    )
  ) {
    return {
      ok: true,
      waitlist: {
        verticalSlug,
        verticalName: verticalContent.name,
      },
    };
  }

  // Tier selection comes from the picker (Regular / Partner). Max is
  // quote-based and never reaches this action — the SignUpForm renders a
  // /custom CTA instead of submitting. We defense-in-depth reject it here
  // so a hand-crafted POST can't smuggle a Max workspace through the
  // self-serve path (which would skip the operator-triage gate).
  const rawTier = formString(form, "tier").toLowerCase();
  if (rawTier && !(SELF_SERVE_TIERS as readonly string[]).includes(rawTier)) {
    return {
      ok: false,
      error:
        "Max engagements are scoped per customer. Tell us what you need at /custom?type=max.",
    };
  }
  const selectedTier: TierName = (rawTier as TierName) || "regular";
  if (!isSelfServeTier(selectedTier)) {
    return {
      ok: false,
      error:
        "Pick Regular or Partner to begin. Max is quote-based — start at /custom?type=max.",
    };
  }

  let signUpResult: Awaited<ReturnType<typeof signUpBrokerOwner>>;
  try {
    signUpResult = await signUpBrokerOwner({
      email,
      brokerageName,
      ownerName,
      vertical: verticalEnum,
      verticalTier: verticalTierFromTier(selectedTier),
      // Pass skipBillingProvisioning so the workspace tx commits WITHOUT
      // creating the legacy no-card Stripe Customer + trialing
      // Subscription. The CC-at-trial flow below provisions the customer
      // + Checkout session itself; the legacy fallback (Checkout off)
      // does the manual provisioning post-hoc.
      skipBillingProvisioning: true,
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  // Issue a magic link immediately so they can verify and land in their
  // workspace. We do this BEFORE the Checkout redirect on purpose — if
  // the customer abandons Checkout, the magic-link email still arrives
  // and they can sign in to finish billing setup from /settings/billing.
  try {
    await requestMagicLink({ email, purpose: "sign_up" });
  } catch (err) {
    return {
      ok: false,
      error: `Account created, but we couldn't send the verification email: ${errorMessage(err)}`,
    };
  }

  // ── Master billing gate ──────────────────────────────────────────────
  // Default OFF (STRIPE_BILLING_ENABLED unset/false): signup is COMPLETE
  // here. We make ZERO Stripe calls — no customer, no subscription, no
  // charge — and the workspace sits in the "trial, no card" state
  // indefinitely. That is exactly right pre-launch. The magic link is
  // already on its way (above), so the customer signs in and works
  // immediately. Flip STRIPE_BILLING_ENABLED=true (with the Stripe keys
  // populated) to activate billing the moment the go-live decisions land
  // — no code change required.
  if (!env.stripeBillingEnabled()) {
    return {
      ok: true,
      notice: `Check ${email}. The sign-in link is valid for 15 minutes.`,
    };
  }

  // Billing is ON. Block-F default = trial-first, NO card at signup:
  // `provisionTrialSubscriptionSafe` creates a Stripe Customer + a
  // `trialing` Subscription with no payment method (see the else-branch
  // below). The card-at-signup variant — Stripe Checkout up front — is
  // opt-in via STRIPE_CHECKOUT_ENABLED=true. When enabled, Stripe creates
  // the subscription on Checkout completion and our existing
  // `customer.subscription.created` webhook upserts the Subscription row
  // by stripeCustomerId (set on the workspace by
  // `createTrialCheckoutForSignup`). On Checkout failure we degrade to the
  // trial-first path so a Stripe hiccup never blocks signup.
  if (env.stripeCheckoutEnabled()) {
    try {
      const checkout = await createTrialCheckoutForSignup({
        workspaceId: signUpResult.workspace.id,
        workspaceName: signUpResult.workspace.name,
        email,
        tier: selectedTier,
        appOrigin: env.appPublicOrigin(),
        trialPeriodDays: trialPeriodDaysForVertical(verticalSlug),
      });
      return {
        ok: true,
        notice: `Check ${email} for the sign-in link. Redirecting to secure card capture…`,
        checkoutUrl: checkout.checkoutUrl,
      };
    } catch (err) {
      // Honesty: log the failure (operator must triage why Checkout
      // failed) and degrade to the legacy provisioning path so the
      // customer is not blocked. Their card capture moves to the
      // post-signup /settings/billing page.
      getLogger()
        .child({ boundary: "signup", workspace_id: signUpResult.workspace.id })
        .error(
          "stripe checkout-at-signup failed — degrading to legacy provisioning",
          err,
        );
      await provisionTrialSubscriptionSafe(
        {
          workspaceId: signUpResult.workspace.id,
          workspaceName: signUpResult.workspace.name,
          email,
          verticalTier: verticalTierFromTier(selectedTier),
        },
        { id: signUpResult.workspace.id },
      );
      return {
        ok: true,
        notice: `Check ${email}. Your trial started — add your card from billing once you sign in. The sign-in link is valid for 15 minutes.`,
      };
    }
  }

  // Trial-first default (STRIPE_CHECKOUT_ENABLED unset/false): provision a
  // Stripe Customer + a `trialing` Subscription with NO card. The customer
  // adds a card before trial end from /settings/billing; the trial-warning
  // cron nudges them as day-14 approaches. This is also the dev/preview +
  // `BILLING_PROVIDER=test` path.
  await provisionTrialSubscriptionSafe(
    {
      workspaceId: signUpResult.workspace.id,
      workspaceName: signUpResult.workspace.name,
      email,
      verticalTier: verticalTierFromTier(selectedTier),
    },
    { id: signUpResult.workspace.id },
  );

  return {
    ok: true,
    notice: `Check ${email}. Your ${env.stripeTrialPeriodDays()}-day trial just started — no card needed yet. The sign-in link is valid for 15 minutes.`,
  };
}

export async function requestSignInAction(
  _prev: ActionResult | undefined,
  form: FormData,
): Promise<ActionResult> {
  const email = formString(form, "email");
  // Checkbox `name="remember"` is present in the form data only when checked,
  // matching standard HTML <input type="checkbox"> semantics. The default in
  // the SignInForm is checked, so omitting it = user unchecked = session cookie.
  const remember = form.get("remember") != null;
  try {
    await requestMagicLink({ email, purpose: "sign_in", remember });
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

/**
 * pfd-4 — capture an email to the vertical waitlist when a customer picks a
 * vertical we don't serve yet. Reuses the existing LeadCapture table (the
 * Plaino-chatbot lead store) via `submitLeadCapture`, persisted under
 * withSystemContext exactly like the marketing widget's leads. NO charge,
 * NO workspace — the durable artifact is the waitlist row + the operator
 * sees it on /operator/leads.
 *
 * Defensively re-checks readiness: if a hand-crafted POST sends a SUPPORTED
 * vertical here, we still just capture interest (harmless) — but a
 * non-existent slug is rejected so the queue stays clean.
 */
export async function joinVerticalWaitlistAction(
  _prev: ActionResult | undefined,
  form: FormData,
): Promise<ActionResult> {
  const email = formString(form, "email");
  const verticalSlug = formString(form, "vertical").toLowerCase();
  const businessName = formString(form, "brokerageName") || null;
  const ownerName = formString(form, "ownerName") || null;

  const content = getVerticalContent(verticalSlug);
  if (!content) {
    return { ok: false, error: "Pick a vertical to continue" };
  }
  if (!email) {
    return { ok: false, error: "Add an email so we can let you know." };
  }

  // The readiness reason is captured into the lead intent so the operator
  // can see WHY this vertical is on the waitlist (not-live vs no-caller vs
  // no-flagship) without re-deriving it.
  const readiness = resolveVerticalReadiness(verticalSlug);

  const result = await submitLeadCapture({
    email,
    name: ownerName ?? undefined,
    business: businessName ?? undefined,
    vertical: verticalSlug,
    intent: `vertical-waitlist: ${content.name} (${readiness.reason})`,
    sourcePage: "/app/sign-up",
  });

  if (!result.ok) {
    return {
      ok: false,
      error:
        result.formError ??
        "We couldn't add you to the list. Try again, or email hello@agentplain.com.",
    };
  }

  return {
    ok: true,
    notice: `You're on the list. We'll email ${email} the moment Plaino is ready for ${content.name.toLowerCase()}.`,
  };
}

// Magic-link verification lives in app/(product)/app/verify/route.ts — it must
// be a Route Handler because the success path writes the session cookie, and
// Next.js forbids cookie mutation from Server Components. The previous
// server-action approach crashed in production (digest 2234350772) when called
// from the verify page's render. See docs/incident-log.md (2026-05-17).

export async function signOutAction(): Promise<void> {
  await clearSession();
  redirect("/app/sign-in");
}

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "We hit a snag on our side.";
