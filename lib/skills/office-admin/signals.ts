/**
 * lib/skills/office-admin/signals.ts
 *
 * Deterministic signal extraction. These functions pull the literal
 * artifacts an operator needs to see — the verification code, the reset
 * URL, the expiration date, the amount — from the message body.
 *
 * Per `feedback_no_quick_fixes.md`: these are NOT the categorization
 * decision. The LLM classifier in `./classifier.ts` decides which
 * category an email belongs to. The extractors here just hydrate
 * `signals` so the rendered approval card has something to show. A
 * verification-code regex matching does not by itself classify the
 * email as `verification-code` — only the classifier does that.
 *
 * Per `prohibited_actions`: we never resolve or fetch any URL we
 * extract. The `primaryUrl` field is for display only; the operator
 * opens it from their own browser.
 *
 * Per `project_no_outbound_architecture.md`: pure functions, no I/O.
 */

import type { ParsedMessage } from '../types';
import type { OfficeAdminSignals } from './types';

// ── Public API ──────────────────────────────────────────────────────────

export function extractAdminSignals(message: ParsedMessage): OfficeAdminSignals {
  const body = `${message.subject}\n${message.bodyText}`;
  return {
    verificationCode: extractVerificationCode(body) ?? undefined,
    primaryUrl: extractPrimaryUrl(body) ?? undefined,
    expiresAt: extractExpiresAt(body, message.receivedAt) ?? undefined,
    serviceName: extractServiceName(message) ?? undefined,
    amount: extractAmount(body) ?? undefined,
  };
}

// ── Verification code ───────────────────────────────────────────────────

/**
 * Finds the first standalone 4–8 digit numeric code. Skips digit runs
 * that are part of a longer token (so a phone number `404-555-1234`
 * doesn't get mistaken for a 2FA code).
 */
export function extractVerificationCode(text: string): string | null {
  // Strong markers near a code — "code is", "code: ", "your code", "verification code"
  const labeled = /\b(?:code|verification code|security code|otp|pin)\s*(?:is\s+|:\s*)?(\d{4,8})\b/i.exec(text);
  if (labeled) return labeled[1];
  // Standalone 6-digit code on its own line — very common 2FA pattern
  const standalone = /(?:^|\n)\s*(\d{6})\s*(?:$|\n)/.exec(text);
  if (standalone) return standalone[1];
  return null;
}

// ── Primary URL ─────────────────────────────────────────────────────────

/**
 * First https:// URL in the body — preferred for password-reset /
 * verify-email categories. Discards tracking-only domains (we still
 * extract the URL; the consumer decides whether to render it).
 */
export function extractPrimaryUrl(text: string): string | null {
  const match = /https:\/\/[^\s<>"')]+/.exec(text);
  if (!match) return null;
  // Trim trailing punctuation that often clings to URLs in email bodies.
  return match[0].replace(/[.,;:)\]]+$/, '');
}

// ── Expiration date ─────────────────────────────────────────────────────

/**
 * Best-effort expires-at extraction. Recognizes:
 *   - "expires on April 30"
 *   - "trial ends in 3 days"
 *   - "due by 2026-05-25"
 *   - "renews on May 1, 2026"
 * Falls back to NULL when the body doesn't name a date.
 *
 * `receivedAt` anchors relative phrases ("in 3 days" → today + 3).
 */
export function extractExpiresAt(text: string, receivedAt: Date): string | null {
  // Relative: "in N day(s)"
  const relMatch = /\bin\s+(\d{1,3})\s+(day|days|hour|hours)\b/i.exec(text);
  if (relMatch) {
    const n = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    const date = new Date(receivedAt);
    if (unit.startsWith('day')) {
      date.setUTCDate(date.getUTCDate() + n);
    } else {
      date.setUTCHours(date.getUTCHours() + n);
    }
    return date.toISOString();
  }
  // ISO date: 2026-05-25
  const isoMatch = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/.exec(text);
  if (isoMatch) {
    const [_full, y, mo, d] = isoMatch;
    return new Date(`${y}-${mo}-${d}T00:00:00.000Z`).toISOString();
  }
  // "Month Day, Year" — "April 30, 2026"
  const longMatch = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s+(20\d{2}))?\b/i.exec(text);
  if (longMatch) {
    const month = MONTH_INDEX[longMatch[1].toLowerCase()];
    const day = parseInt(longMatch[2], 10);
    const year = longMatch[3] ? parseInt(longMatch[3], 10) : receivedAt.getUTCFullYear();
    const date = new Date(Date.UTC(year, month, day));
    return date.toISOString();
  }
  return null;
}

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

// ── Service name ────────────────────────────────────────────────────────

/**
 * Best-effort service name. Uses the sender's domain root (stripe.com
 * → "Stripe"). Falls back to display name when domain is generic.
 */
export function extractServiceName(message: ParsedMessage): string | null {
  if (message.fromName && !isGenericName(message.fromName)) {
    const trimmed = message.fromName.replace(/\s+(?:Team|Support|Notifications|Billing|Security|Help)$/i, '').trim();
    if (trimmed.length > 0) return trimmed;
  }
  const domain = message.fromEmail.split('@')[1];
  if (!domain) return null;
  // Strip transactional-mail subdomains.
  const root = domain
    .replace(/^(?:mail|email|mailer|smtp|notifications|notify|noreply|no-reply|alerts|hello|info|support|billing|security|accounts|account|auth|login|m|t|e|em)\./i, '')
    .replace(/\.(?:com|net|org|io|co|us|app|dev|ai)$/i, '');
  if (!root) return null;
  return root
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isGenericName(name: string): boolean {
  return /^(?:notifications?|no[\s-]?reply|do[\s-]?not[\s-]?reply|support|help|team)$/i.test(name.trim());
}

// ── Money amount ────────────────────────────────────────────────────────

export function extractAmount(text: string): string | null {
  const match = /(?:\$|€|£)\s?\d{1,3}(?:[,\.]\d{3})*(?:\.\d{2})?\b/.exec(text);
  return match ? match[0] : null;
}
