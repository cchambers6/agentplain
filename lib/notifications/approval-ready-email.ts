/**
 * lib/notifications/approval-ready-email.ts
 *
 * Approval-ready EMAIL — render + per-partner delivery decision.
 *
 * This is the email half of the "a reply is drafted and waiting" promise
 * from the Day-1 activation call. The mobile push channel exists but the
 * app has not shipped, so email is the channel a design partner actually
 * has (pilot dry-run 2026-07-11, P0-1). `lib/push/notify.ts` calls the
 * renderer + decision here; the weekday-morning digest sweep reuses the
 * same renderer in digest flavor so the two surfaces never drift.
 *
 * Delivery modes (WorkspacePreference.approvalEmailMode):
 *   - 'always' (default): send the moment the draft lands, day or night.
 *     The after-hours ping IS the premise — the owner chooses whether to
 *     glance at their phone at 10pm or read it over morning coffee.
 *   - 'business_hours': immediate send only 8am–6pm ET on weekdays.
 *     Anything held is covered by the weekday-morning digest sweep
 *     (lib/inngest/functions/approval-digest-sweep.ts), so a held ping is
 *     delayed, never lost.
 *   - 'digest': no immediate email; the morning digest is the only email.
 *
 * Rendering mirrors the existing transactional emails (dunning, weekly
 * report): deterministic inline-styled HTML string, brand palette from
 * `lib/brand/tokens`, no LLM, no React Email. Voice is Plaino partner
 * tone: calm, plain, no hype.
 *
 * Per `project_no_outbound_architecture.md`: this email goes to the
 * customer's OWN inbox about their own queue. Nothing is sent on the
 * customer's behalf.
 */

import { colorHex } from '@/lib/brand/tokens';

// ── Delivery decision ─────────────────────────────────────────────────────────

export type ApprovalEmailMode = 'always' | 'business_hours' | 'digest';

export const DEFAULT_APPROVAL_EMAIL_MODE: ApprovalEmailMode = 'always';

/** Narrow a stored preference string to a known mode; unknown values fall
 *  back to the default so a bad row can never silence notifications. */
export function asApprovalEmailMode(value: string | null | undefined): ApprovalEmailMode {
  if (value === 'business_hours' || value === 'digest' || value === 'always') {
    return value;
  }
  return DEFAULT_APPROVAL_EMAIL_MODE;
}

/** Business hours for the immediate-send window: 8am–6pm ET, Mon–Fri.
 *  ET because the pilot book of business is Georgia; a per-workspace
 *  timezone can layer on later without changing the seam. */
export function isWithinBusinessHoursEt(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  // `hour12: false` can render midnight as "24" in some ICU versions.
  const hour =
    Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return hour >= 8 && hour < 18;
}

export type ApprovalEmailDelivery = 'send' | 'hold_for_digest';

/** Decide whether an approval-ready email goes out NOW or waits for the
 *  weekday-morning digest, given the partner's preference. */
export function decideApprovalEmailDelivery(
  mode: ApprovalEmailMode,
  now: Date,
): ApprovalEmailDelivery {
  switch (mode) {
    case 'always':
      return 'send';
    case 'business_hours':
      return isWithinBusinessHoursEt(now) ? 'send' : 'hold_for_digest';
    case 'digest':
      return 'hold_for_digest';
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";

export interface RenderApprovalReadyEmailArgs {
  /** How many drafts are waiting. */
  count: number;
  workspaceName: string;
  /** Named service partner — "Plaino". */
  partner: string;
  /** Absolute URL to the workspace approvals queue. */
  approvalsUrl: string;
  /** 'immediate' = a draft just landed; 'digest' = the morning summary of
   *  everything waiting. Same renderer so the copy never drifts. */
  flavor: 'immediate' | 'digest';
}

export interface RenderedApprovalEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderApprovalReadyEmail(
  args: RenderApprovalReadyEmailArgs,
): RenderedApprovalEmail {
  const subject = buildSubject(args);
  const lede = buildLede(args);
  const cta =
    args.count === 1 ? 'Review the draft' : `Review ${args.count} drafts`;

  const text = [
    lede,
    '',
    `${cta}: ${args.approvalsUrl}`,
    '',
    `Nothing goes out until you say so. ${args.partner} drafts; you decide.`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0; padding:0; background:${colorHex['paper-deep']}; color:${colorHex.ink}; font-family:${SANS}; -webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colorHex['paper-deep']}; padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:${colorHex.paper}; border:1px solid ${colorHex.rule}; border-radius:12px; padding:28px;">
<tr><td style="font-family:${SERIF}; font-size:22px; line-height:1.3; color:${colorHex.ink}; padding-bottom:12px;">${esc(
    subject,
  )}</td></tr>
<tr><td style="font-size:15px; line-height:1.6; color:${colorHex['ink-soft']}; padding-bottom:20px;">${esc(
    lede,
  )}</td></tr>
<tr><td style="padding-bottom:20px;">
<a href="${args.approvalsUrl}" style="display:inline-block; background:${colorHex.clay}; color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:600; padding:12px 22px; border-radius:8px;">${esc(
    cta,
  )}</a>
</td></tr>
<tr><td style="font-size:13px; line-height:1.6; color:${colorHex.mute}; border-top:1px solid ${colorHex.rule}; padding-top:16px;">Nothing goes out until you say so. ${esc(
    args.partner,
  )} drafts; you decide.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

function buildSubject(args: RenderApprovalReadyEmailArgs): string {
  if (args.flavor === 'digest') {
    return args.count === 1
      ? `1 draft is waiting for your review at ${args.workspaceName}`
      : `${args.count} drafts are waiting for your review at ${args.workspaceName}`;
  }
  return args.count === 1
    ? `${args.partner} drafted a reply and it is waiting for you`
    : `${args.partner} drafted ${args.count} replies and they are waiting for you`;
}

function buildLede(args: RenderApprovalReadyEmailArgs): string {
  if (args.flavor === 'digest') {
    return `Good morning. ${args.partner} has ${
      args.count === 1 ? 'one draft' : `${args.count} drafts`
    } queued for ${args.workspaceName}. Each one is ready to review, edit, or send from your own system.`;
  }
  return args.count === 1
    ? `A new lead came in and ${args.partner} already wrote the first reply. It is sitting in your approvals queue, ready to review, edit, or send from your own system.`
    : `New leads came in and ${args.partner} already wrote the first replies. ${args.count} drafts are sitting in your approvals queue, ready to review, edit, or send from your own system.`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
