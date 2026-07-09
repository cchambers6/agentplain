/**
 * lib/reports/weekly-report-email.ts
 *
 * Weekly customer report email — RENDER (HTML + plain text + subject).
 *
 * Deterministic template, no LLM: a proof-of-ROI surface must render the
 * same words from the same numbers every time. Voice is Plaino heritage —
 * calm, grounded, the tone of a long-time partner reporting in, not a SaaS
 * dashboard and not a hype email. See `feedback_brand_is_plain_not_plane`
 * and `feedback_everything_tells_a_story`: every stat earns its place, and
 * a section with no activity simply does not render.
 *
 * Rendering approach mirrors the one existing transactional email in the
 * codebase (`lib/billing/dunning.ts`): inline-styled HTML built as a string,
 * table-based layout for email-client compatibility, brand palette from
 * `app/globals.css`. No React Email dependency is added — the repo renders
 * transactional mail as strings, and a string render is also safe under the
 * bare-node test harness.
 *
 * Honesty: agentplain drafts/chases; the customer's own system sends/books
 * (`project_no_outbound_architecture.md`). Copy never says "sent" where it
 * means "drafted". A dollar figure is flagged as a real amount only when the
 * underlying data carried one.
 */

import { colorHex } from '@/lib/brand/tokens';
import type { WeeklyReportData } from './weekly-report-data';
import type { VerticalOutcome } from './vertical-outcomes';

// ── Brand palette (mirrors app/globals.css :root tokens) ──────────────────────
// Read from the canonical token source so this email can never strand on an
// old palette again (the hand-kept copy here missed the 2026-06-22 Heritage
// Plains move; kaizen 2026-07-02 friction 1).
const C = {
  paper: colorHex.paper,
  paperDeep: colorHex['paper-deep'],
  ink: colorHex.ink,
  inkSoft: colorHex['ink-soft'],
  clay: colorHex.clay,
  clayDeep: colorHex['clay-deep'],
  moss: colorHex.moss,
  mute: colorHex.mute,
  rule: colorHex.rule,
  white: '#FFFFFF',
} as const;

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";

export interface RenderWeeklyReportArgs {
  data: WeeklyReportData;
  /** Absolute URL to the customer's live weekly report dashboard. */
  dashboardUrl: string;
  /** Absolute one-click unsubscribe URL (carries the signed token). */
  unsubscribeUrl: string;
  /** Absolute URL to the email-preferences toggle. */
  managePreferencesUrl: string;
  /** Absolute URL to the Plaino 8-bit brand mark PNG. */
  markUrl: string;
  /** CAN-SPAM physical postal address line. */
  postalAddress: string;
  /** Named service partner — "Plaino". */
  partner: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// ── Public entry ──────────────────────────────────────────────────────────────

export function renderWeeklyReportEmail(
  args: RenderWeeklyReportArgs,
): RenderedEmail {
  const { data } = args;
  const subject = buildSubject(data, args.partner);
  return {
    subject,
    html: renderHtml(args),
    text: renderText(args),
  };
}

// ── Subject + subhead ─────────────────────────────────────────────────────────

function buildSubject(data: WeeklyReportData, partner: string): string {
  if (data.isEmpty) {
    return `${partner} kept watch over ${data.workspaceName} last week`;
  }
  return `What ${partner} did for ${data.workspaceName} last week`;
}

/** "Plaino drafted 42 things and you approved 38, saving you ~6 hours." */
function buildSubhead(data: WeeklyReportData, partner: string): string {
  if (data.isEmpty) {
    return `Last week (${data.weekLabel}) was quiet — ${partner} is still learning your business, watching your inbox and your systems so it knows what's worth bringing to you.`;
  }
  const drafted = `${partner} drafted ${count(data.draftsCreated, 'thing')}`;
  const approved =
    data.approvalsApproved > 0
      ? ` and you approved ${data.approvalsApproved}`
      : '';
  const auto =
    data.actionsAutoExecuted > 0
      ? `, ${count(data.actionsAutoExecuted, 'item')} handled on its own under your limits`
      : '';
  const saved =
    data.hoursSaved > 0 ? `, saving you about ${formatHours(data.hoursSaved)}` : '';
  return `${drafted}${approved}${auto}${saved}.`;
}

// ── HTML render ────────────────────────────────────────────────────────────────

function renderHtml(args: RenderWeeklyReportArgs): string {
  const { data, partner } = args;
  const sections: string[] = [];

  sections.push(headerBlock(args));
  sections.push(headlineBlock(args));

  if (!data.isEmpty) {
    if (data.verticalOutcomes.length > 0) {
      sections.push(outcomesBlock(data.verticalOutcomes));
    }
    sections.push(statsBlock(data));
    if (data.workflowsFired.length > 0) {
      sections.push(workflowsBlock(data));
    }
  }

  sections.push(lookAheadBlock(args));
  sections.push(ctaBlock(args));
  sections.push(footerBlock(args));

  const inner = sections.join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(buildSubject(data, partner))}</title>
</head>
<body style="margin:0; padding:0; background:${C.paperDeep}; color:${C.ink}; font-family:${SANS}; -webkit-font-smoothing:antialiased;">
<span style="display:none; max-height:0; overflow:hidden; opacity:0;">${esc(
    buildSubhead(data, partner),
  )}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paperDeep}; padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background:${C.paper}; border:1px solid ${C.rule};">
${inner}
</table>
</td></tr>
</table>
</body>
</html>`;
}

function headerBlock(args: RenderWeeklyReportArgs): string {
  return `<tr><td style="padding:28px 36px 8px 36px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle;"><img src="${esc(
      args.markUrl,
    )}" width="36" height="36" alt="Plaino" style="display:block; width:36px; height:36px; image-rendering:pixelated;"></td>
    <td style="vertical-align:middle; padding-left:12px; font-family:${SERIF}; font-size:18px; color:${C.ink}; letter-spacing:0.2px;">agentplain</td>
  </tr></table>
</td></tr>`;
}

function headlineBlock(args: RenderWeeklyReportArgs): string {
  const { data, partner } = args;
  return `<tr><td style="padding:12px 36px 0 36px;">
  <p style="margin:0 0 6px 0; font-family:${SANS}; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:${C.mute};">Your week with ${esc(
    partner,
  )} · ${esc(data.weekLabel)}</p>
  <h1 style="margin:0 0 14px 0; font-family:${SERIF}; font-weight:500; font-size:26px; line-height:1.25; color:${C.ink};">Here's what ${esc(
    partner,
  )} did for you this week</h1>
  <p style="margin:0 0 8px 0; font-family:${SANS}; font-size:16px; line-height:1.55; color:${C.inkSoft};">${esc(
    buildSubhead(data, partner),
  )}</p>
</td></tr>`;
}

function outcomesBlock(outcomes: VerticalOutcome[]): string {
  const rows = outcomes
    .map(
      (o) => `  <tr><td style="padding:10px 0; border-bottom:1px solid ${C.rule};">
    <p style="margin:0; font-family:${SERIF}; font-size:17px; color:${C.ink};">${esc(
      o.label,
    )}</p>${
        o.detail
          ? `\n    <p style="margin:4px 0 0 0; font-family:${SANS}; font-size:13px; line-height:1.5; color:${C.mute};">${esc(
              o.detail,
            )}</p>`
          : ''
      }
  </td></tr>`,
    )
    .join('\n');
  return `<tr><td style="padding:24px 36px 4px 36px;">
  ${eyebrow('What that looked like')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows}
  </table>
</td></tr>`;
}

function statsBlock(data: WeeklyReportData): string {
  const cells: string[] = [];
  cells.push(statCell(String(data.draftsCreated), 'drafted for you'));
  if (data.approvalsApproved > 0) {
    cells.push(statCell(String(data.approvalsApproved), 'you approved'));
  }
  if (data.hoursSaved > 0) {
    cells.push(statCell(formatHoursShort(data.hoursSaved), 'time saved'));
  }
  if (data.hasRealDollars && data.dollarsInfluenced > 0) {
    cells.push(statCell(usdShort(data.dollarsInfluenced), 'in real dollars'));
  }

  // Up to 3 stat cells per row for readable mobile stacking.
  const row = cells
    .slice(0, 4)
    .map(
      (c) =>
        `<td width="${Math.floor(
          100 / Math.min(cells.length, 4),
        )}%" style="vertical-align:top; padding:0 8px;">${c}</td>`,
    )
    .join('');

  const extras: string[] = [];
  if (data.medianTimeToApproveMinutes !== null) {
    extras.push(
      `You cleared your approvals in about ${formatMinutes(
        data.medianTimeToApproveMinutes,
      )} on average.`,
    );
  }
  if (data.approvalsRejected > 0) {
    const reason =
      data.rejectionReasons[0] && data.rejectionReasons[0].reason !== 'No reason given'
        ? ` — most often: "${truncate(data.rejectionReasons[0].reason, 80)}"`
        : '';
    extras.push(
      `You sent ${count(
        data.approvalsRejected,
        'draft',
      )} back for a change${reason}. Plaino folds each correction into the next draft.`,
    );
  }

  return `<tr><td style="padding:24px 28px 4px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${row}</tr></table>
  ${
    extras.length > 0
      ? `<p style="margin:16px 8px 0 8px; font-family:${SANS}; font-size:13px; line-height:1.55; color:${C.mute};">${extras
          .map(esc)
          .join(' ')}</p>`
      : ''
  }
</td></tr>`;
}

function statCell(value: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.white}; border:1px solid ${C.rule};"><tr><td style="padding:14px 12px; text-align:center;">
    <div style="font-family:${SERIF}; font-size:24px; line-height:1; color:${C.clay};">${esc(
      value,
    )}</div>
    <div style="margin-top:6px; font-family:${SANS}; font-size:11px; letter-spacing:0.4px; text-transform:uppercase; color:${C.mute};">${esc(
      label,
    )}</div>
  </td></tr></table>`;
}

function workflowsBlock(data: WeeklyReportData): string {
  const rows = data.workflowsFired
    .slice(0, 6)
    .map(
      (w) =>
        `  <tr><td style="padding:6px 0; font-family:${SANS}; font-size:14px; color:${C.inkSoft};">${esc(
          w.label,
        )}</td><td style="padding:6px 0; text-align:right; font-family:${SANS}; font-size:14px; color:${C.mute};">${count(
          w.count,
          'draft',
        )}</td></tr>`,
    )
    .join('\n');
  return `<tr><td style="padding:20px 36px 4px 36px;">
  ${eyebrow('The work behind it')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows}
  </table>
</td></tr>`;
}

function lookAheadBlock(args: RenderWeeklyReportArgs): string {
  const { data, partner } = args;
  const la = data.lookAhead;
  const needs =
    la.needsInput.length > 0
      ? `<ul style="margin:10px 0 0 0; padding-left:20px; font-family:${SANS}; font-size:14px; line-height:1.6; color:${C.inkSoft};">${la.needsInput
          .map((n) => `<li style="margin:0 0 4px 0;">${esc(n)}</li>`)
          .join('')}</ul>`
      : '';
  return `<tr><td style="padding:24px 36px 4px 36px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paperDeep}; border:1px solid ${C.rule};"><tr><td style="padding:18px 20px;">
    ${eyebrow(`${partner}'s look-ahead`)}
    <p style="margin:0; font-family:${SANS}; font-size:14px; line-height:1.6; color:${C.inkSoft};">${esc(
      la.recurringPlan,
    )}</p>
    ${needs}
  </td></tr></table>
</td></tr>`;
}

function ctaBlock(args: RenderWeeklyReportArgs): string {
  return `<tr><td style="padding:28px 36px 8px 36px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${C.clay};">
    <a href="${esc(
      args.dashboardUrl,
    )}" style="display:inline-block; padding:13px 26px; font-family:${SANS}; font-size:14px; font-weight:500; color:${C.paper}; text-decoration:none;">See it live in your dashboard</a>
  </td></tr></table>
  <p style="margin:14px 0 0 0; font-family:${SANS}; font-size:13px; line-height:1.5; color:${C.mute};">Every number above is pulled straight from your workspace — open the dashboard to see this week as it builds, and the weeks before it.</p>
</td></tr>`;
}

function footerBlock(args: RenderWeeklyReportArgs): string {
  const { data, partner } = args;
  return `<tr><td style="padding:24px 36px 32px 36px; border-top:1px solid ${C.rule};">
  <p style="margin:0 0 4px 0; font-family:${SERIF}; font-size:14px; color:${C.ink};">— ${esc(
    partner,
  )}, your service partner at agentplain</p>
  <p style="margin:0 0 16px 0; font-family:${SANS}; font-size:12px; line-height:1.5; color:${C.mute};">You're getting this weekly summary because ${esc(
    data.workspaceName,
  )} has an agentplain workspace.</p>
  <p style="margin:0 0 4px 0; font-family:${SANS}; font-size:12px; line-height:1.6; color:${C.mute};">
    <a href="${esc(
      args.managePreferencesUrl,
    )}" style="color:${C.mute}; text-decoration:underline;">Manage email preferences</a>
    &nbsp;·&nbsp;
    <a href="${esc(
      args.unsubscribeUrl,
    )}" style="color:${C.mute}; text-decoration:underline;">Unsubscribe from weekly reports</a>
  </p>
  <p style="margin:8px 0 0 0; font-family:${SANS}; font-size:11px; line-height:1.5; color:${C.mute};">${esc(
    args.postalAddress,
  )}</p>
</td></tr>`;
}

// ── Plain-text render ──────────────────────────────────────────────────────────

function renderText(args: RenderWeeklyReportArgs): string {
  const { data, partner } = args;
  const lines: string[] = [];
  lines.push(`HERE'S WHAT ${partner.toUpperCase()} DID FOR YOU THIS WEEK`);
  lines.push(`Your week with ${partner} · ${data.weekLabel}`);
  lines.push('');
  lines.push(buildSubhead(data, partner));
  lines.push('');

  if (!data.isEmpty) {
    if (data.verticalOutcomes.length > 0) {
      lines.push('WHAT THAT LOOKED LIKE');
      for (const o of data.verticalOutcomes) {
        lines.push(`- ${o.label}${o.detail ? ` (${o.detail})` : ''}`);
      }
      lines.push('');
    }

    lines.push('THE NUMBERS');
    lines.push(`- ${data.draftsCreated} drafted for you`);
    if (data.approvalsApproved > 0) {
      lines.push(`- ${data.approvalsApproved} you approved`);
    }
    if (data.medianTimeToApproveMinutes !== null) {
      lines.push(
        `  (cleared in about ${formatMinutes(
          data.medianTimeToApproveMinutes,
        )} on average)`,
      );
    }
    if (data.actionsAutoExecuted > 0) {
      lines.push(
        `- ${data.actionsAutoExecuted} handled on its own under your limits`,
      );
    }
    if (data.approvalsRejected > 0) {
      lines.push(
        `- ${data.approvalsRejected} sent back for a change (Plaino folds each one into the next draft)`,
      );
    }
    if (data.hoursSaved > 0) {
      lines.push(`- about ${formatHours(data.hoursSaved)} saved`);
    }
    if (data.hasRealDollars && data.dollarsInfluenced > 0) {
      lines.push(
        `- ${usdShort(data.dollarsInfluenced)} in real invoice and estimate dollars chased`,
      );
    }
    lines.push('');

    if (data.workflowsFired.length > 0) {
      lines.push('THE WORK BEHIND IT');
      for (const w of data.workflowsFired.slice(0, 6)) {
        lines.push(`- ${w.label}: ${count(w.count, 'draft')}`);
      }
      lines.push('');
    }
  }

  lines.push(`${partner.toUpperCase()}'S LOOK-AHEAD`);
  lines.push(data.lookAhead.recurringPlan);
  for (const n of data.lookAhead.needsInput) {
    lines.push(`- ${n}`);
  }
  lines.push('');

  lines.push(`See it live in your dashboard: ${args.dashboardUrl}`);
  lines.push('');
  lines.push(`— ${partner}, your service partner at agentplain`);
  lines.push('');
  lines.push(
    `You're getting this weekly summary because ${data.workspaceName} has an agentplain workspace.`,
  );
  lines.push(`Manage email preferences: ${args.managePreferencesUrl}`);
  lines.push(`Unsubscribe from weekly reports: ${args.unsubscribeUrl}`);
  lines.push(args.postalAddress);

  return lines.join('\n');
}

// ── Small render helpers ───────────────────────────────────────────────────────

function eyebrow(label: string): string {
  return `<p style="margin:0 0 10px 0; font-family:${SANS}; font-size:11px; letter-spacing:1.2px; text-transform:uppercase; color:${C.mute};">${esc(
    label,
  )}</p>`;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function formatHours(hours: number): string {
  if (hours <= 0) return '0 hours';
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins} minute${mins === 1 ? '' : 's'}`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hour${rounded === 1 ? '' : 's'}`;
}

function formatHoursShort(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} minute${Math.round(minutes) === 1 ? '' : 's'}`;
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hour${rounded === 1 ? '' : 's'}`;
}

function usdShort(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
