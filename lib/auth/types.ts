// AuthProvider abstraction.
//
// Per feedback_no_silent_vendor_lock: every vendor SDK call lives behind
// a lib/<domain>/ interface. The auth boundary is one file's worth of
// surface area — Clerk / WorkOS swap is one impl change, not a rewrite.
//
// Engineering plan §3 originally specced Clerk; Conner overrode to Resend
// magic-link for Phase 1 (no Clerk dependency). Both shapes satisfy this
// interface; the impl swap is a one-line change to lib/auth/index.ts.
//
// Token responsibility: the FLOW generates the raw token + verify URL and
// hands them to the provider. The provider is a thin email-delivery seam —
// it never touches token entropy or persistence. This keeps token discipline
// in one place (lib/auth/flows.ts) regardless of who delivers the email.

export type MagicLinkPurpose = "sign_in" | "sign_up" | "invite_accept";

export interface MagicLinkDeliveryRequest {
  email: string;
  purpose: MagicLinkPurpose;
  /** Absolute URL the user clicks to verify. Already contains the raw token. */
  verifyUrl: string;
  /** Friendly display name when the recipient already has a User row. */
  displayName?: string | null;
}

export interface MagicLinkDeliveryResult {
  /** Provider-specific message id (Resend message id, etc.). */
  messageId: string | null;
}

export interface AuthProvider {
  /** Deliver a pre-built magic link via this provider's email channel. */
  sendMagicLink(
    req: MagicLinkDeliveryRequest,
  ): Promise<MagicLinkDeliveryResult>;

  /** For diagnostics + audit logs. */
  readonly providerName: string;
}
