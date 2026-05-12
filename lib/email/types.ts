// Generic transactional email seam.
//
// `lib/auth/resend-provider.ts` already speaks Resend directly for
// magic-link delivery — that file is its own purpose-specific
// abstraction (subject lines + HTML rendering tied to the auth
// vocabulary). Billing emails (trial-end warnings, dunning notices)
// don't share that vocabulary and shouldn't borrow magic-link
// scaffolding, so they get their own provider seam here.
//
// Both eventually want to consolidate behind one EmailProvider, but
// that's a cross-cutting refactor outside this PR's scope. The two
// adapters share Resend underneath; the swap point per
// feedback_no_silent_vendor_lock is enforced separately for each.

export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Optional reply-to override; defaults to the provider's fromEmail. */
  replyTo?: string;
  /** Free-form tags Resend stores against the message for filtering. */
  tags?: Record<string, string>;
}

export interface SendEmailResult {
  /** Provider-side message id (Resend re_*). Nullable if the provider
   *  did not surface one (test provider returns a synthetic id). */
  messageId: string | null;
}

export interface EmailProvider {
  readonly providerName: string;
  send(req: SendEmailRequest): Promise<SendEmailResult>;
}
