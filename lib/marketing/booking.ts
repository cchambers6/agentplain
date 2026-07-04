/**
 * lib/marketing/booking.ts
 *
 * Single source of truth for the intro-call booking CTA on customer-facing
 * surfaces. The design-partner outreach packets
 * (docs/marketing/design-partner-outreach/) all dead-ended at a
 * `{{CALENDLY_LINK}}` placeholder — sales deep-dive 2026-07-02 (doc 03)
 * called replacing it "the single cheapest conversion-path fix in the plan".
 *
 * Env contract:
 *   NEXT_PUBLIC_BOOKING_URL — the real scheduling link (Calendly/Cal.com/
 *   Microsoft Bookings; provider-agnostic). Set it in Vercel once Conner
 *   provisions the account; every surface that renders the CTA picks it up
 *   on the next deploy.
 *
 * Honesty rules, enforced here rather than trusted at each call site:
 *   - unset  → the CTA still works: it routes to /contact, where email
 *     contact always stands. No dead button, no fake link.
 *   - a leftover template token (`{{ANYTHING}}`) or a non-https value is
 *     treated as unset — a placeholder must never ship to a customer.
 *
 * PURE — reads process.env only. Rendered by server components, so the
 * value is resolved per-request/per-build, not frozen into a client bundle.
 */

/** Matches unresolved template tokens like `{{CALENDLY_LINK}}`. */
const TEMPLATE_TOKEN = /\{\{.*\}\}/;

/** Label is fixed so every surface asks for the same thing in the same
 *  words — the outreach packets say "book an intro call" verbatim. */
export const BOOKING_CTA_LABEL = "Book an intro call";

/**
 * The configured booking link, or `null` when nothing safe is configured.
 * Callers that need a link that always resolves should use `bookingCta()`.
 */
export function bookingUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_BOOKING_URL?.trim();
  if (!raw) return null;
  if (TEMPLATE_TOKEN.test(raw)) return null;
  if (!raw.startsWith("https://")) return null;
  return raw;
}

/**
 * The booking CTA target. Always resolves:
 *   configured → the external scheduling link (render with target="_blank")
 *   not configured → /contact (email contact, never a dead end)
 */
export function bookingCta(): { href: string; external: boolean } {
  const url = bookingUrl();
  return url ? { href: url, external: true } : { href: "/contact", external: false };
}
