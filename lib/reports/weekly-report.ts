/**
 * lib/reports/weekly-report.ts
 *
 * Weekly customer report email — SEND orchestration.
 *
 * Ties the data layer + the renderer to the email seam for ONE workspace.
 * The Friday cron (`lib/inngest/functions/weekly-customer-report-sweep`)
 * iterates active workspaces and calls `sendWeeklyReportForWorkspace` once
 * per. This module owns the gates, idempotency, and the audit record.
 *
 * Gates (a report is skipped, not failed, when any of these say no):
 *   - `weeklyReportEnabled` is false (the customer opted out),
 *   - the workspace is billing-paused (`isWorkspacePaused`) — a paused
 *     workspace pays for nothing, including a report,
 *   - no broker-owner email on file to send to,
 *   - a report for this exact week already sent (idempotent re-run).
 *
 * Idempotency: an AuditLog row `weekly_report.sent` keyed by the week's
 * Sunday `forDate` anchor records each send. A same-week retry finds it and
 * no-ops — the cron can run twice without double-emailing.
 *
 * Per `project_no_outbound_architecture.md`: a product-side report to the
 * customer's OWN inbox is in scope (same shape as the dunning + briefing
 * notices). Agents still never send on the customer's behalf. Per
 * `feedback_no_silent_vendor_lock.md` the send goes through `lib/email/`.
 * Per `feedback_cold_start_safe_agents.md` every gate + the idempotency
 * state is derived from durable rows on each fire.
 */

import type { Prisma, Vertical } from '@prisma/client';
import { getEmailProvider } from '@/lib/email';
import type { EmailProvider } from '@/lib/email';
import { withSystemContext as defaultWithSystemContext } from '@/lib/db';
import type { DbTransactionClient } from '@/lib/db';
import { isWorkspacePaused } from '@/lib/billing/workspace-paused-gate';
import { servicePartnerForWorkspace } from '@/lib/onboarding/service-partner';
import { env } from '@/lib/env';
import { resolveReportedWeek } from '@/lib/measurement/weekly-digest-data';
import { computeWeeklyReportData } from './weekly-report-data';
import { renderWeeklyReportEmail } from './weekly-report-email';
import { renderFirstWeekNoteEmail } from './first-week-note-email';
import { signUnsubscribeToken } from './unsubscribe-token';

export type SystemContextRunner = <T>(
  fn: (tx: DbTransactionClient) => Promise<T>,
) => Promise<T>;

export const WEEKLY_REPORT_SENT_ACTION = 'weekly_report.sent';
export const FIRST_WEEK_NOTE_SENT_ACTION = 'weekly_report.first_week_note';
const WEEKLY_REPORT_MARK_PATH = '/brand/plaino-system/8bit.png';

/** A workspace needs this many business days before the reporting Friday
 *  for the prior Mon–Sun window to be an honest "your week" (pilot
 *  dry-run 2026-07-11, P0-2 — a Monday-activated partner otherwise gets
 *  a "quiet week" email about the pre-activation week on Day 5). */
export const FIRST_REPORT_MIN_BUSINESS_DAYS = 5;

export type WeeklyReportSkipReason =
  | 'opted_out'
  | 'billing_paused'
  | 'no_recipient'
  | 'already_sent'
  | 'first_week_pending';

export interface SendWeeklyReportResult {
  workspaceId: string;
  /** True when an email was actually queued via the provider this call. */
  sent: boolean;
  /** Set when `sent` is false — why the report was skipped. */
  skipped?: WeeklyReportSkipReason;
  /** The Sunday-anchored forDate of the reported week. */
  forDate?: string;
  /** Provider message id when sent. */
  messageId?: string | null;
  /** True when the rendered report was the honest "quiet week" state. */
  wasEmpty?: boolean;
  /** True when what went out was the FIRST-WEEK NOTE, not a report — the
   *  workspace had under FIRST_REPORT_MIN_BUSINESS_DAYS of business days
   *  before this Friday and firstReportMode='note'. */
  firstWeekNote?: boolean;
}

export interface SendWeeklyReportArgs {
  workspaceId: string;
  /** Defaults to now; the data layer resolves the prior Mon–Sun week. */
  now?: Date;
  /** Overrides for tests; live caller omits all. */
  email?: EmailProvider;
  systemContext?: SystemContextRunner;
  appOrigin?: string;
}

interface WorkspaceRow {
  id: string;
  name: string;
  vertical: Vertical;
  closureStatus: string;
  weeklyReportEnabled: boolean;
  brokerOwnerEmail: string | null;
  /** Workspace creation = activation for the first-report gate. The
   *  pilot Day 0 creates the workspace; a finer-grained activation
   *  timestamp can swap in here without touching the gate. */
  activatedAt: Date;
  firstReportMode: string | null;
}

export async function sendWeeklyReportForWorkspace(
  args: SendWeeklyReportArgs,
): Promise<SendWeeklyReportResult> {
  const now = args.now ?? new Date();
  const systemContext = args.systemContext ?? defaultWithSystemContext;
  const origin = (args.appOrigin ?? env.appPublicOrigin()).replace(/\/$/, '');

  // ── 1. Load the workspace, its opt-in, and the recipient. ───────────────────
  const ws = await loadWorkspace(systemContext, args.workspaceId);
  if (!ws) {
    return { workspaceId: args.workspaceId, sent: false, skipped: 'no_recipient' };
  }
  if (!ws.weeklyReportEnabled) {
    return { workspaceId: ws.id, sent: false, skipped: 'opted_out' };
  }
  if (!ws.brokerOwnerEmail) {
    return { workspaceId: ws.id, sent: false, skipped: 'no_recipient' };
  }

  // ── 2. Billing pause — a paused workspace pays for nothing. ──────────────────
  const pause = await isWorkspacePaused({
    workspaceId: ws.id,
    systemContext,
    now,
  }).catch(() => ({ isPaused: false }) as { isPaused: boolean });
  if (pause.isPaused) {
    return { workspaceId: ws.id, sent: false, skipped: 'billing_paused' };
  }

  // ── 2b. First-full-week gate (pilot dry-run 2026-07-11, P0-2). ───────────────
  // The report window is the PRIOR completed Mon–Sun week. A workspace with
  // fewer than 5 business days before this Friday would be told about a week
  // it mostly (or entirely) did not exist for — the "quiet week" body against
  // a pre-activation window is a trust own-goal on the first-ever email. Per
  // the partner's firstReportMode we either send the first-week note (default)
  // or send nothing until the first full week completes. The quiet-week body
  // never renders here.
  if (businessDaysSince(ws.activatedAt, now) < FIRST_REPORT_MIN_BUSINESS_DAYS) {
    if ((ws.firstReportMode ?? 'note') !== 'note') {
      return { workspaceId: ws.id, sent: false, skipped: 'first_week_pending' };
    }
    return sendFirstWeekNote({ ws, now, systemContext, origin, email: args.email });
  }

  // ── 3. Compute the report data (resolves the prior Mon–Sun week). ────────────
  const data = await systemContext((tx) =>
    computeWeeklyReportData(tx, {
      workspaceId: ws.id,
      workspaceName: ws.name,
      vertical: ws.vertical,
      now,
    }),
  );

  // ── 4. Idempotency — already sent for this week? ─────────────────────────────
  const already = await systemContext((tx) =>
    tx.auditLog.findFirst({
      where: {
        workspaceId: ws.id,
        action: WEEKLY_REPORT_SENT_ACTION,
        targetId: data.forDate,
      },
      select: { id: true },
    }),
  );
  if (already) {
    return {
      workspaceId: ws.id,
      sent: false,
      skipped: 'already_sent',
      forDate: data.forDate,
    };
  }

  // ── 5. Render + send. ────────────────────────────────────────────────────────
  const partner = servicePartnerForWorkspace(ws.id);
  const token = signUnsubscribeToken(ws.id);
  const dashboardUrl = `${origin}/app/workspace/${ws.id}/reports/weekly`;
  const managePreferencesUrl = `${dashboardUrl}#email-preferences`;
  const unsubscribeUrl = `${origin}/api/reports/weekly/unsubscribe?token=${encodeURIComponent(
    token,
  )}`;

  const rendered = renderWeeklyReportEmail({
    data,
    dashboardUrl,
    unsubscribeUrl,
    managePreferencesUrl,
    markUrl: `${origin}${WEEKLY_REPORT_MARK_PATH}`,
    postalAddress: env.companyPostalAddress(),
    partner,
  });

  const email = args.email ?? getEmailProvider();
  const result = await email.send({
    to: ws.brokerOwnerEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    // RFC 8058 one-click + RFC 2369 list-unsubscribe — keeps the report out
    // of spam folders and gives inbox-native unsubscribe.
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: {
      kind: 'weekly_report',
      workspace_id: ws.id,
      empty: data.isEmpty ? 'true' : 'false',
    },
  });

  // ── 6. Record the send (idempotency key + proof trail). ──────────────────────
  await systemContext(async (tx) => {
    await tx.auditLog.create({
      data: {
        workspaceId: ws.id,
        action: WEEKLY_REPORT_SENT_ACTION,
        targetTable: 'WorkspacePreference',
        targetId: data.forDate,
        payload: {
          forDate: data.forDate,
          weekStart: data.weekStart,
          weekEnd: data.weekEnd,
          to: ws.brokerOwnerEmail,
          draftsCreated: data.draftsCreated,
          approvalsApproved: data.approvalsApproved,
          hoursSaved: data.hoursSaved,
          dollarsInfluenced: data.dollarsInfluenced,
          isEmpty: data.isEmpty,
          messageId: result.messageId,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  return {
    workspaceId: ws.id,
    sent: true,
    forDate: data.forDate,
    messageId: result.messageId,
    wasEmpty: data.isEmpty,
  };
}

async function loadWorkspace(
  systemContext: SystemContextRunner,
  workspaceId: string,
): Promise<WorkspaceRow | null> {
  return systemContext(async (tx) => {
    const ws = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        vertical: true,
        closureStatus: true,
        createdAt: true,
        preference: {
          select: { weeklyReportEnabled: true, firstReportMode: true },
        },
        memberships: {
          where: { role: 'BROKER_OWNER', status: 'ACTIVE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { user: { select: { email: true } } },
        },
      },
    });
    if (!ws) return null;
    return {
      id: ws.id,
      name: ws.name,
      vertical: ws.vertical,
      closureStatus: ws.closureStatus,
      // No preference row yet = default opted-in (mirrors the column default).
      weeklyReportEnabled: ws.preference?.weeklyReportEnabled ?? true,
      brokerOwnerEmail: ws.memberships[0]?.user.email ?? null,
      activatedAt: ws.createdAt,
      firstReportMode: ws.preference?.firstReportMode ?? null,
    };
  });
}

// ── First-week note (P0-2, mode 'note') ───────────────────────────────────────

interface SendFirstWeekNoteArgs {
  ws: WorkspaceRow;
  now: Date;
  systemContext: SystemContextRunner;
  origin: string;
  email?: EmailProvider;
}

/**
 * Send the one-time first-week note in place of a report. Idempotent via
 * its own AuditLog action keyed on the same Sunday `forDate` anchor the
 * report would have used — a same-week cron retry no-ops, and next
 * Friday's REAL report is untouched (different action + different week).
 */
async function sendFirstWeekNote(
  args: SendFirstWeekNoteArgs,
): Promise<SendWeeklyReportResult> {
  const { ws, now, systemContext, origin } = args;
  const { forDate } = resolveReportedWeek(now);

  const already = await systemContext((tx) =>
    tx.auditLog.findFirst({
      where: {
        workspaceId: ws.id,
        action: FIRST_WEEK_NOTE_SENT_ACTION,
        targetId: forDate,
      },
      select: { id: true },
    }),
  );
  if (already) {
    return { workspaceId: ws.id, sent: false, skipped: 'already_sent', forDate };
  }

  const partner = servicePartnerForWorkspace(ws.id);
  const token = signUnsubscribeToken(ws.id);
  const dashboardUrl = `${origin}/app/workspace/${ws.id}/reports/weekly`;
  const unsubscribeUrl = `${origin}/api/reports/weekly/unsubscribe?token=${encodeURIComponent(
    token,
  )}`;

  const rendered = renderFirstWeekNoteEmail({
    workspaceName: ws.name,
    partner,
    dashboardUrl,
    unsubscribeUrl,
    managePreferencesUrl: `${dashboardUrl}#email-preferences`,
    postalAddress: env.companyPostalAddress(),
  });

  const email = args.email ?? getEmailProvider();
  const result = await email.send({
    to: ws.brokerOwnerEmail!,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: {
      kind: 'weekly_report_first_week_note',
      workspace_id: ws.id,
    },
  });

  await systemContext(async (tx) => {
    await tx.auditLog.create({
      data: {
        workspaceId: ws.id,
        action: FIRST_WEEK_NOTE_SENT_ACTION,
        targetTable: 'WorkspacePreference',
        targetId: forDate,
        payload: {
          forDate,
          to: ws.brokerOwnerEmail,
          activatedAt: ws.activatedAt.toISOString(),
          messageId: result.messageId,
        } satisfies Prisma.InputJsonValue,
      },
    });
  });

  return {
    workspaceId: ws.id,
    sent: true,
    forDate,
    messageId: result.messageId,
    firstWeekNote: true,
  };
}

/**
 * Whole business days (UTC weekdays) strictly after `from`'s date, up to
 * and including `to`'s date. Monday activation → Friday of the same week
 * counts Tue+Wed+Thu+Fri = 4 (< 5, gated); the NEXT Friday counts 9
 * (≥ 5, report sends). Exported for the tests that pin the gate's edges.
 */
export function businessDaysSince(from: Date, to: Date): number {
  const dayUtc = (d: Date) =>
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const DAY_MS = 24 * 60 * 60 * 1000;
  let count = 0;
  for (let t = dayUtc(from) + DAY_MS; t <= dayUtc(to); t += DAY_MS) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}
