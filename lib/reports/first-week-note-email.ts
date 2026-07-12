/**
 * lib/reports/first-week-note-email.ts
 *
 * First-week note — the email a NEW partner gets on their first Friday
 * instead of a weekly report (pilot dry-run 2026-07-11, P0-2).
 *
 * The weekly report covers the prior completed Mon–Sun week. A partner
 * activated on Monday would therefore get a "quiet week" email about the
 * week BEFORE they existed — the product's first-ever email contradicting
 * their lived week. When the workspace has had fewer than 5 business days
 * before the reporting Friday, `sendWeeklyReportForWorkspace` sends this
 * note instead (WorkspacePreference.firstReportMode = 'note', the
 * default) or nothing at all ('delay'). The quiet-week body never renders
 * against a pre-activation week.
 *
 * Modeled on Conner's manual week-1 note (docs/sales/weekly-report-
 * 2026-07-11/03-golden-examples.md): what has been running, what the
 * first full report will show, and when it lands. Deterministic string
 * render like every transactional email here — no LLM.
 */

import { colorHex } from '@/lib/brand/tokens';

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";

export interface RenderFirstWeekNoteArgs {
  workspaceName: string;
  /** Named service partner — "Plaino". */
  partner: string;
  /** Absolute URL to the live weekly report dashboard. */
  dashboardUrl: string;
  /** Absolute one-click unsubscribe URL (signed token). */
  unsubscribeUrl: string;
  /** Absolute URL to the email-preferences toggle. */
  managePreferencesUrl: string;
  /** CAN-SPAM physical postal address line. */
  postalAddress: string;
}

export interface RenderedFirstWeekNote {
  subject: string;
  html: string;
  text: string;
}

export function renderFirstWeekNoteEmail(
  args: RenderFirstWeekNoteArgs,
): RenderedFirstWeekNote {
  const subject = `${args.partner} is set up at ${args.workspaceName} — your first full report lands next Friday`;

  const paragraphs = [
    `You are early in your first week, so there is no full week to report on yet. Rather than send you a report about days before ${args.partner} started, here is what to expect.`,
    `${args.partner} is already on the job: watching your leads and your inbox, drafting first-touch replies, and queueing every draft for your review. You may have seen some of that work land already.`,
    `Next Friday morning you will get the real thing: every draft ${args.partner} wrote, what you approved, the time it saved you, and what needs your input. One email, every Friday, built from your first full week.`,
    `Until then, your live view is always current.`,
  ];

  const text = [
    subject,
    '',
    ...paragraphs,
    '',
    `See what ${args.partner} is doing now: ${args.dashboardUrl}`,
    '',
    `Unsubscribe: ${args.unsubscribeUrl}`,
    `Email preferences: ${args.managePreferencesUrl}`,
    args.postalAddress,
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
<tr><td style="font-family:${SERIF}; font-size:22px; line-height:1.3; color:${colorHex.ink}; padding-bottom:16px;">Your first week with ${esc(
    args.partner,
  )}</td></tr>
${paragraphs
  .map(
    (p) =>
      `<tr><td style="font-size:15px; line-height:1.65; color:${colorHex['ink-soft']}; padding-bottom:14px;">${esc(p)}</td></tr>`,
  )
  .join('\n')}
<tr><td style="padding:6px 0 22px;">
<a href="${args.dashboardUrl}" style="display:inline-block; background:${colorHex.clay}; color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:600; padding:12px 22px; border-radius:8px;">See what ${esc(
    args.partner,
  )} is doing now</a>
</td></tr>
<tr><td style="font-size:12px; line-height:1.6; color:${colorHex.mute}; border-top:1px solid ${colorHex.rule}; padding-top:16px;">
<a href="${args.unsubscribeUrl}" style="color:${colorHex.mute};">Unsubscribe</a> &nbsp;·&nbsp; <a href="${args.managePreferencesUrl}" style="color:${colorHex.mute};">Email preferences</a><br>
${esc(args.postalAddress)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, html, text };
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
