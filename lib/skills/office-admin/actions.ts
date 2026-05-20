/**
 * lib/skills/office-admin/actions.ts
 *
 * Turns an `OfficeAdminClassification` into the durable approval payload
 * `lib/skills/persist-artifacts.ts` writes to `WorkApprovalQueueItem`.
 * One function per category surface (the renderer reads from the
 * payload, not the category, so the shape stays stable across UI
 * iterations).
 *
 * Per `project_service_partnership_positioning.md`: copy reads "we
 * noticed" / "this looks like" — partnership voice. No "I will configure
 * your account" — that crosses into the prohibited auto-execute lane.
 *
 * Per `feedback_brand_is_plain_not_plane.md`: copy is rooted /
 * grounded. No "I'll take care of that!" enthusiasm.
 *
 * Per `prohibited_actions`: drafts NEVER include credentials, NEVER
 * suggest clicking the link from the agent's surface, NEVER auto-fill
 * forms. Only the human opens links and acts.
 *
 * Per `project_no_outbound_architecture.md`: this module produces
 * structured payloads. Persistence is delegated to persist-artifacts.
 */

import type { ParsedMessage } from '../types';
import {
  OFFICE_ADMIN_CATEGORY_CONFIG,
  categoryToCardTitle,
  categoryToPriority,
  type OfficeAdminApprovalPayload,
  type OfficeAdminCategory,
  type OfficeAdminClassification,
} from './types';

export interface BuildAdminPayloadArgs {
  message: ParsedMessage;
  classification: OfficeAdminClassification;
  /** Optional fixed clock for deterministic tests. */
  now?: Date;
}

/**
 * Build the approval payload for an admin classification. Caller is
 * responsible for not calling this when `classification.category` is
 * `'not-admin'` — TypeScript enforces that via the parameter narrowing.
 */
export function buildAdminApprovalPayload(
  args: BuildAdminPayloadArgs & {
    classification: OfficeAdminClassification & {
      category: Exclude<OfficeAdminCategory, 'not-admin'>;
    };
  },
): OfficeAdminApprovalPayload {
  const { message, classification } = args;
  const category = classification.category;
  const now = args.now ?? new Date();
  return {
    category,
    title: categoryToCardTitle(category),
    body: renderBody(category, message, classification),
    priority: categoryToPriority(category),
    signals: classification.signals,
    fromDisplay: formatFromDisplay(message),
    subject: message.subject,
    confidence: classification.confidence,
    draftBody: renderDraftBody(category, classification, message),
    draftSubject: renderDraftSubject(category, message),
    classifiedAtIso: now.toISOString(),
  };
}

/**
 * Convenience guard so the runner can treat "non-admin or low-confidence"
 * uniformly. Returns null when the classification should not produce an
 * approval; otherwise narrows the type for `buildAdminApprovalPayload`.
 */
export function asActionableAdminClassification(
  c: OfficeAdminClassification,
): (OfficeAdminClassification & {
  category: Exclude<OfficeAdminCategory, 'not-admin'>;
}) | null {
  if (c.category === 'not-admin') return null;
  return c as OfficeAdminClassification & {
    category: Exclude<OfficeAdminCategory, 'not-admin'>;
  };
}

// ── Body composition ────────────────────────────────────────────────────

function renderBody(
  category: Exclude<OfficeAdminCategory, 'not-admin'>,
  message: ParsedMessage,
  c: OfficeAdminClassification,
): string[] {
  const service = c.signals.serviceName ?? 'a service you use';
  const lines: string[] = [];
  switch (category) {
    case 'verification-code': {
      const code = c.signals.verificationCode;
      lines.push(`We noticed a one-time code from ${service}.`);
      if (code) {
        lines.push(`The code is ${code}.`);
      } else {
        lines.push(
          'The body mentioned a verification code but we could not isolate it cleanly — open the email to copy it.',
        );
      }
      lines.push(
        'Use it in the surface that asked for it. We do not type the code anywhere; this card just surfaces it for you.',
      );
      break;
    }
    case 'email-verification': {
      lines.push(`${service} is asking you to verify the email address on this account.`);
      if (c.signals.primaryUrl) {
        lines.push('The verification link is in the card below. You decide whether to open it.');
      } else {
        lines.push('We did not find a verification link in the body — open the email if you want to confirm.');
      }
      break;
    }
    case 'password-reset': {
      lines.push(`${service} sent a password-reset link.`);
      lines.push(
        'If you requested this, open the link below in your browser to set a new password. If you did NOT, reject this card and we will surface a security note instead.',
      );
      break;
    }
    case 'trial-expiration': {
      lines.push(`A trial or subscription from ${service} is ending.`);
      if (c.signals.expiresAt) {
        lines.push(`Heads-up: it ends on ${formatDate(c.signals.expiresAt)}.`);
      } else {
        lines.push('The body did not name a clean end date — open the email if you need the specifics.');
      }
      if (c.signals.amount) {
        lines.push(`The renewal charge is ${c.signals.amount}.`);
      }
      break;
    }
    case 'billing-notice': {
      lines.push(`We noticed a billing notice from ${service}.`);
      if (c.signals.amount) {
        lines.push(`Amount: ${c.signals.amount}.`);
      }
      lines.push('Routing this to you to confirm — open the email for the full invoice.');
      break;
    }
    case 'subscription-confirmation': {
      lines.push(`${service} confirmed a new subscription.`);
      lines.push(
        'Nothing requires action right now. Filed here so you can audit subscriptions later. Approve to dismiss.',
      );
      break;
    }
    case 'account-suspension': {
      lines.push(`${service} flagged activity on your account.`);
      lines.push(
        'If this was you, approve to acknowledge. If it was not — reject the card and we will note the incident in your activity log.',
      );
      break;
    }
    case 'service-status': {
      lines.push(`${service} sent a service-status update.`);
      lines.push('Informational. Approve to file it; reject to dismiss.');
      break;
    }
    case 'email-preferences': {
      lines.push(`${service} is asking you to update email or notification preferences.`);
      lines.push(
        'Low priority. If you do not action this within 7 days, we file it automatically and stop surfacing it.',
      );
      break;
    }
  }
  return lines;
}

// ── Suggested draft ─────────────────────────────────────────────────────

/**
 * Some categories pair well with a brief draft acknowledgement (a
 * "noting receipt" reply for a billing notice, a reminder thread for a
 * trial). Categories that pair badly with a draft (verification codes,
 * password resets, security alerts) return null — there is no human
 * counterparty on the other end of those emails.
 */
function renderDraftBody(
  category: Exclude<OfficeAdminCategory, 'not-admin'>,
  c: OfficeAdminClassification,
  message: ParsedMessage,
): string | null {
  const service = c.signals.serviceName ?? 'your team';
  switch (category) {
    case 'billing-notice': {
      return [
        'Hi,',
        '',
        `Noting receipt of the billing notice from ${service}. We will reconcile against the matching subscription on our side and reply if anything looks off.`,
        '',
        'Thanks,',
        '{{operator: signature}}',
      ].join('\n');
    }
    case 'trial-expiration': {
      const when = c.signals.expiresAt ? `on ${formatDate(c.signals.expiresAt)}` : 'soon';
      return [
        '(Internal note for your records — not for sending.)',
        '',
        `The ${service} trial/subscription ends ${when}. Decide before that whether to keep, cancel, or downgrade.`,
        '',
        'If you want a calendar reminder, approve this card with the "Remind me" option.',
      ].join('\n');
    }
    case 'subscription-confirmation': {
      return null;
    }
    case 'service-status': {
      return null;
    }
    case 'email-preferences': {
      return null;
    }
    case 'email-verification':
    case 'password-reset':
    case 'verification-code':
    case 'account-suspension':
    default:
      return null;
  }
  void message; // referenced only by some branches
}

function renderDraftSubject(
  category: Exclude<OfficeAdminCategory, 'not-admin'>,
  message: ParsedMessage,
): string | null {
  if (!hasDraft(category)) return null;
  const stripped = message.subject.replace(/^(re|fwd):\s*/i, '');
  return `Re: ${stripped}`;
}

function hasDraft(category: Exclude<OfficeAdminCategory, 'not-admin'>): boolean {
  return category === 'billing-notice' || category === 'trial-expiration';
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatFromDisplay(message: ParsedMessage): string {
  if (message.fromName) return `${message.fromName} <${message.fromEmail}>`;
  return message.fromEmail;
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

// ── Re-export for callers that don't want to import the const map ──────

export { OFFICE_ADMIN_CATEGORY_CONFIG };
