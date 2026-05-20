/**
 * lib/skills/office-admin/screen.ts
 *
 * Cheap pre-screen that decides whether a message is worth running
 * through the LLM classifier. Returns a list of *signals detected* — a
 * non-empty list means "this email mentions admin-vocabulary; ask the
 * LLM to classify it." An empty list means "no admin marker at all;
 * skip the LLM call entirely."
 *
 * Per `feedback_no_quick_fixes.md`: the screen is NOT the categorization
 * decision. It exists to skip an LLM call when there is zero admin
 * signal — which saves cost on the majority of inbound traffic without
 * making category assignment via keyword. The actual category is
 * decided by `./classifier.ts` (LLM-driven, vertical-aware).
 *
 * Per `feedback_no_silent_vendor_lock.md`: no SDK imports here. Pure
 * function over text.
 *
 * Per `project_no_outbound_architecture.md`: read-only.
 */

import type { ParsedMessage } from '../types';

/** A coarse signal the screen detected. The classifier consumes these
 *  as hints in the system prompt but is not bound to them — the model
 *  can still decide `not-admin` if the broader context makes that the
 *  right call (e.g. an "invoice for your client" lead-shaped message
 *  that incidentally contains the word "invoice"). */
export type AdminScreenSignal =
  | 'verification-language'
  | 'password-language'
  | 'code-pattern'
  | 'trial-language'
  | 'billing-language'
  | 'subscription-language'
  | 'security-language'
  | 'service-status-language'
  | 'preferences-language'
  | 'noreply-sender'
  | 'system-domain';

export interface AdminScreenResult {
  /** When false, the screen found zero admin signal — skip the LLM. */
  worthClassifying: boolean;
  /** Signals detected — non-exhaustive, classifier-consumed hints. */
  signals: AdminScreenSignal[];
}

const PATTERNS: Array<{ signal: AdminScreenSignal; rx: RegExp }> = [
  { signal: 'verification-language', rx: /\b(?:verify(?:\s+your)?\s+(?:email|address)|confirm\s+(?:your\s+)?(?:email|address|sign-?up)|email\s+verification|please\s+verify)\b/i },
  { signal: 'password-language', rx: /\b(?:password\s+reset|reset\s+(?:your\s+)?password|change\s+your\s+password|forgot\s+your\s+password|set\s+a\s+new\s+password)\b/i },
  { signal: 'code-pattern', rx: /\b(?:verification\s+code|security\s+code|one-?time\s+(?:code|password|pin)|otp|2fa|two[-\s]factor|sign-?in\s+code)\b|\b\d{6}\b/i },
  { signal: 'trial-language', rx: /\b(?:trial\s+(?:ends?|expir(?:es?|ing))|free\s+trial|subscription\s+(?:ends?|expir(?:es?|ing)|will\s+renew)|renews?\s+on|cancel\s+before|will\s+be\s+charged)\b/i },
  { signal: 'billing-language', rx: /\b(?:invoice\s+(?:attached|number|#|due|total)|your\s+invoice|payment\s+failed|payment\s+declined|card\s+(?:expir|declined|charge)|billing\s+(?:notice|update)|past[-\s]due\s+(?:amount|balance|invoice)|amount\s+due|receipt\s+for\s+your\s+(?:purchase|payment|subscription)|payment\s+receipt)\b/i },
  { signal: 'subscription-language', rx: /\b(?:welcome\s+to\s+|thanks?\s+for\s+(?:signing\s+up|subscrib)|your\s+subscription\s+is\s+(?:active|live|confirmed))\b/i },
  { signal: 'security-language', rx: /\b(?:suspicious\s+(?:activity|sign[-\s]?in)|unusual\s+(?:activity|sign[-\s]?in)|account\s+(?:locked|suspended|disabled)|new\s+sign[-\s]?in|new\s+device|sign[-\s]?in\s+from|security\s+alert)\b/i },
  { signal: 'service-status-language', rx: /\b(?:scheduled\s+maintenance|service\s+disruption|service\s+(?:status|incident)|incident\s+report|partial\s+outage|degraded\s+performance)\b/i },
  { signal: 'preferences-language', rx: /\b(?:email\s+preferences|notification\s+preferences|manage\s+(?:your\s+)?(?:email|notification)\s+preferences|update\s+your\s+preferences|unsubscribe)\b/i },
];

const NOREPLY_RX = /(?:^|<)\s*(?:no[-_]?reply|noreply|donotreply|do-not-reply|notifications?|alerts?|accounts?|billing|security|support|verify|verification)\s*@/i;
// Domains that ONLY send automated system mail. Consumer-mail providers
// (gmail.com, outlook.com, hotmail.com, yahoo.com, aol.com, icloud.com,
// proton.me, apple.com, microsoft.com root) deliberately omitted —
// real humans send mail from those, so we should not auto-flag.
const SYSTEM_DOMAIN_RX = /@(?:[a-z0-9.-]*\.)?(?:stripe|github|aws|amazonaws|atlassian|notion|slack|figma|vercel|cloudflare|netlify|render|heroku|datadog|sentry|hubspot|salesforce|intercom|mailchimp|sendgrid|twilio|okta|auth0|1password|lastpass|dropbox|asana|monday|linear|airtable|loom|calendly|docusign|paypal|squareup|quickbooks|xero|gusto|rippling|adp|digitalocean|fastly|chase\.com|amex\.com|capitalone\.com|wellsfargo\.com|bankofamerica\.com|citi\.com)\./i;

export function screenForAdminSignal(message: ParsedMessage): AdminScreenResult {
  const haystack = `${message.subject}\n${message.bodyText}`;
  const signals: AdminScreenSignal[] = [];
  for (const { signal, rx } of PATTERNS) {
    if (rx.test(haystack)) signals.push(signal);
  }
  const fromField = `${message.fromName ?? ''} <${message.fromEmail}>`;
  if (NOREPLY_RX.test(fromField)) signals.push('noreply-sender');
  if (SYSTEM_DOMAIN_RX.test(message.fromEmail)) signals.push('system-domain');
  return {
    worthClassifying: signals.length > 0,
    signals: dedupe(signals),
  };
}

function dedupe(items: AdminScreenSignal[]): AdminScreenSignal[] {
  return Array.from(new Set(items));
}
