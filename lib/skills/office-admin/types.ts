/**
 * lib/skills/office-admin/types.ts
 *
 * Provider-neutral types for the office-admin skill — the categorization
 * layer that recognizes admin / IT / account-hygiene email (verification
 * codes, password resets, trial expirations, billing notices, security
 * alerts) and routes them through the approval queue.
 *
 * Per `project_no_outbound_architecture.md`: this skill DRAFTS / TRIAGES.
 * It does not click links, fill forms, or hold credentials. The customer
 * (a human operator) executes any action by opening the linked surface
 * from the approval card.
 *
 * Per `project_office_manager_skill.md` (memory): this is the *cheap*
 * version of office-management. It runs on email signal only — no
 * account inventory, no auto-execute. The "real version" gate criteria
 * live in the memory file.
 *
 * Per `feedback_no_silent_vendor_lock.md`: the LLM call goes through the
 * `LlmProvider` interface. No vendor SDK imports in this directory.
 */

import type { WorkApprovalKind } from '@prisma/client';

// ── Category taxonomy ───────────────────────────────────────────────────

/**
 * The 9 admin-email categories the classifier recognizes. `not-admin`
 * is the off-ramp — when present the runner skips emitting an admin
 * approval and lets the vertical-categorize chain run normally.
 */
export type OfficeAdminCategory =
  | 'email-verification'
  | 'password-reset'
  | 'verification-code'
  | 'trial-expiration'
  | 'billing-notice'
  | 'subscription-confirmation'
  | 'account-suspension'
  | 'service-status'
  | 'email-preferences'
  | 'not-admin';

export const OFFICE_ADMIN_CATEGORIES: ReadonlyArray<Exclude<OfficeAdminCategory, 'not-admin'>> = [
  'email-verification',
  'password-reset',
  'verification-code',
  'trial-expiration',
  'billing-notice',
  'subscription-confirmation',
  'account-suspension',
  'service-status',
  'email-preferences',
];

/**
 * Subset of `WorkApprovalKind` the office-admin skill emits. Maps 1-to-1
 * from category at `categoryToApprovalKind()` below.
 */
export type OfficeAdminApprovalKind = Extract<
  WorkApprovalKind,
  | 'ADMIN_VERIFICATION_CODE'
  | 'ADMIN_PASSWORD_RESET'
  | 'ADMIN_TRIAL_ENDING'
  | 'ADMIN_BILLING_NOTICE'
  | 'ADMIN_SECURITY_ALERT'
>;

/**
 * Priority drives how the approval card is rendered (red border for
 * `critical`, normal for `normal`, muted for `low`). Per the task brief:
 *   - account suspension → critical
 *   - verification code + password reset → normal
 *   - trial / billing / subscription / service status → normal
 *   - email-preferences (spam-but-need-to-confirm) → low
 */
export type OfficeAdminPriority = 'critical' | 'normal' | 'low';

// ── Signal extraction ───────────────────────────────────────────────────

/**
 * Strongly-typed extraction of admin-specific fields from the message.
 * The classifier produces these alongside the category so the approval
 * card renders the right affordance without re-parsing the body.
 */
export interface OfficeAdminSignals {
  /** 4–8 digit numeric verification / 2FA code, when present. */
  verificationCode?: string;
  /** First https-scheme URL discovered in the body — used for reset /
   *  verify / unsubscribe links. The render layer presents this as an
   *  "Open" button; the customer opens it in their own browser. We DO
   *  NOT fetch this URL ourselves (per `prohibited_actions` — no
   *  auto-click). */
  primaryUrl?: string;
  /** ISO-8601 date when the trial / subscription expires (best-effort
   *  parsed from the body — "in 3 days", "April 30", etc.). NULL when
   *  the body did not name a date. */
  expiresAt?: string;
  /** The service that sent the email (Stripe, Microsoft, AWS, etc.).
   *  Derived from the From: domain. */
  serviceName?: string;
  /** Money amount with currency symbol when present in a billing
   *  notice ("$12.99", "€4.50"). */
  amount?: string;
}

// ── Classifier result ───────────────────────────────────────────────────

export interface OfficeAdminClassification {
  /** Assigned category. `not-admin` means the runner should NOT emit
   *  an admin approval and the vertical chain should proceed. */
  category: OfficeAdminCategory;
  /** 0–1. Below `OFFICE_ADMIN_MIN_CONFIDENCE` the runner treats the
   *  classification as `not-admin` to avoid false-positives. */
  confidence: number;
  /** Human-readable rationale — surfaces in the operator audit log. */
  reason: string;
  /** Extracted signals — populated for categories that need them
   *  (verification-code → code, password-reset → primaryUrl, etc.). */
  signals: OfficeAdminSignals;
}

/**
 * Below this confidence the runner treats the classification as
 * `not-admin` to avoid false-positives leaking admin approvals onto
 * real lead / scheduling traffic. Matches the categorize-skill
 * confidence floor in `lib/skills/runner.ts`.
 */
export const OFFICE_ADMIN_MIN_CONFIDENCE = 0.6;

// ── Category → approval mapping ─────────────────────────────────────────

interface CategoryConfig {
  approvalKind: OfficeAdminApprovalKind;
  priority: OfficeAdminPriority;
  /** Customer-facing card title. Short, present-tense. */
  cardTitle: string;
}

/**
 * The 9-category × 5-approval-kind mapping. Encoded as a const map so a
 * downstream consumer (UI render layer, tests) reads from one source of
 * truth.
 */
export const OFFICE_ADMIN_CATEGORY_CONFIG: Record<
  Exclude<OfficeAdminCategory, 'not-admin'>,
  CategoryConfig
> = {
  'email-verification': {
    approvalKind: 'ADMIN_VERIFICATION_CODE',
    priority: 'normal',
    cardTitle: 'Email verification waiting on you.',
  },
  'verification-code': {
    approvalKind: 'ADMIN_VERIFICATION_CODE',
    priority: 'normal',
    cardTitle: 'A verification code arrived.',
  },
  'password-reset': {
    approvalKind: 'ADMIN_PASSWORD_RESET',
    priority: 'normal',
    cardTitle: 'Password reset link arrived.',
  },
  'trial-expiration': {
    approvalKind: 'ADMIN_TRIAL_ENDING',
    priority: 'normal',
    cardTitle: 'A trial or subscription is ending.',
  },
  'billing-notice': {
    approvalKind: 'ADMIN_BILLING_NOTICE',
    priority: 'normal',
    cardTitle: 'A billing notice landed.',
  },
  'subscription-confirmation': {
    approvalKind: 'ADMIN_BILLING_NOTICE',
    priority: 'low',
    cardTitle: 'New subscription confirmed.',
  },
  'service-status': {
    approvalKind: 'ADMIN_BILLING_NOTICE',
    priority: 'low',
    cardTitle: 'Service status update.',
  },
  'email-preferences': {
    approvalKind: 'ADMIN_BILLING_NOTICE',
    priority: 'low',
    cardTitle: 'Account / preferences housekeeping.',
  },
  'account-suspension': {
    approvalKind: 'ADMIN_SECURITY_ALERT',
    priority: 'critical',
    cardTitle: 'Security alert — please confirm this was you.',
  },
};

export function categoryToApprovalKind(
  category: Exclude<OfficeAdminCategory, 'not-admin'>,
): OfficeAdminApprovalKind {
  return OFFICE_ADMIN_CATEGORY_CONFIG[category].approvalKind;
}

export function categoryToPriority(
  category: Exclude<OfficeAdminCategory, 'not-admin'>,
): OfficeAdminPriority {
  return OFFICE_ADMIN_CATEGORY_CONFIG[category].priority;
}

export function categoryToCardTitle(
  category: Exclude<OfficeAdminCategory, 'not-admin'>,
): string {
  return OFFICE_ADMIN_CATEGORY_CONFIG[category].cardTitle;
}

// ── Approval payload shape ──────────────────────────────────────────────

/**
 * The Json shape `lib/skills/persist-artifacts.ts` writes into
 * `WorkApprovalQueueItem.payload` for an office-admin item. Stable
 * contract — `renderApprovalPayload.ts` reads against this shape.
 *
 * Per `project_no_outbound_architecture.md`: the payload is INFORMATIONAL.
 * It tells the operator what happened and what URL to open. The skill
 * does NOT include credentials, session tokens, or anything that would
 * enable auto-execution.
 */
export interface OfficeAdminApprovalPayload {
  /** Echoes the category for filtering / analytics. */
  category: Exclude<OfficeAdminCategory, 'not-admin'>;
  /** Card title (e.g. "A verification code arrived."). */
  title: string;
  /** Body lines — what the operator needs to see. Plain text only. */
  body: string[];
  /** Priority — drives the card-border treatment. */
  priority: OfficeAdminPriority;
  /** Extracted signals — code, URL, expires-at, service name, amount. */
  signals: OfficeAdminSignals;
  /** Sender display name + email, for the "From: ..." line. */
  fromDisplay: string;
  /** Original subject — for the meta line. */
  subject: string;
  /** Confidence the classifier reported. Surfaced in the audit footer. */
  confidence: number;
  /** Suggested draft body — only populated for categories where a
   *  drafted acknowledgement makes sense (billing notices, trial
   *  reminders). For verification codes / password resets the draft
   *  field is null — there is no recipient to reply to. */
  draftBody: string | null;
  /** Subject for the suggested draft, when `draftBody` is non-null. */
  draftSubject: string | null;
  /** ISO timestamp at which the runner classified the email. */
  classifiedAtIso: string;
}
