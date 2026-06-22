/**
 * lib/measurement/weekly-digest-email.ts
 *
 * Weekly proof-of-value digest — product-side notification email.
 *
 * NEW module (wave cv-x2). Mirrors `lib/skills/briefing-generator/email.ts`:
 * a lightweight transactional notice (agentplain → broker-owner inbox) that
 * the weekly digest is ready, with the headline numbers and a deep link to
 * the briefings page (where the digest renders as a WorkspaceBriefing row).
 *
 * Per `project_no_outbound_architecture.md`: product-side transactional,
 * same scope as the daily briefing notice and Stripe invoice receipts —
 * NOT outbound on a customer's behalf.
 * Per `feedback_no_silent_vendor_lock`: Resend access goes through the
 * `lib/email` adapter, never the SDK directly.
 */

import type { EmailProvider } from '@/lib/email';
import { getEmailProvider } from '@/lib/email';
import { formatUsd, type WeeklyDigestData } from './weekly-digest-data';

export interface NotifyWeeklyDigestReadyInput {
  brokerOwnerEmail: string;
  workspaceName: string;
  workspaceId: string;
  data: WeeklyDigestData;
  /** Absolute origin used to compose the deep link. */
  appOrigin: string;
  /** Override for tests; live caller uses `getEmailProvider()`. */
  email?: EmailProvider;
}

export interface NotifyWeeklyDigestReadyResult {
  messageId: string | null;
}

export async function notifyWeeklyDigestReady(
  input: NotifyWeeklyDigestReadyInput,
): Promise<NotifyWeeklyDigestReadyResult> {
  const email = input.email ?? getEmailProvider();
  const briefingsUrl = `${input.appOrigin.replace(/\/$/, '')}/app/workspace/${input.workspaceId}/briefings`;
  const subject = `What Plaino did for you last week — ${input.workspaceName}`;
  const headline = headlineFor(input.data);
  const html = renderHtml({
    workspaceName: input.workspaceName,
    briefingsUrl,
    headline,
  });
  const text = renderText({
    workspaceName: input.workspaceName,
    briefingsUrl,
    headline,
  });
  const result = await email.send({
    to: input.brokerOwnerEmail,
    subject,
    html,
    text,
    tags: {
      kind: 'weekly_proof_digest',
      workspace_id: input.workspaceId,
    },
    headers: {
      'List-Unsubscribe': `<mailto:plaino@agentplain.com?subject=unsubscribe-digest-${input.workspaceId}>, <${briefingsUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
  return { messageId: result.messageId };
}

/** One honest sentence of headline numbers. Empty week says so plainly. */
export function headlineFor(data: WeeklyDigestData): string {
  if (data.isEmpty) {
    return 'A quiet week — Plaino is still learning your business';
  }
  const dollars = formatUsd(data.dollarsInfluenced);
  const actions = `${data.actionsTaken} action${data.actionsTaken === 1 ? '' : 's'}`;
  const auto =
    data.actionsAutoExecuted > 0
      ? `, ${data.actionsAutoExecuted} handled automatically`
      : '';
  return `${actions} taken, ${dollars} influenced${auto}`;
}

function renderHtml(args: {
  workspaceName: string;
  briefingsUrl: string;
  headline: string;
}): string {
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif; color:#1A1612; background:#F5F0E6; padding:32px;">
  <h2 style="font-weight:500; color:#1A1612;">What Plaino did for you last week.</h2>
  <p>${escapeHtml(args.headline)} for ${escapeHtml(args.workspaceName)}.</p>
  <p><a href="${args.briefingsUrl}" style="display:inline-block; padding:12px 20px; background:#1A1612; color:#F5F0E6; text-decoration:none; font-weight:500;">See the full digest</a></p>
  <p style="font-size:13px; color:#726A5E;">This proof-of-value digest lands every Monday morning. <a href="${args.briefingsUrl}" style="color:#726A5E;">Turn briefings off from the briefings page</a> if you'd rather not get this email.</p>
  <p style="font-size:13px; color:#726A5E;">Plaino, your service partner at agentplain</p>
  <p style="font-size:12px; color:#726A5E; margin-top:24px;">You're receiving this because you have an agentplain workspace.</p>
</body></html>`;
}

function renderText(args: {
  workspaceName: string;
  briefingsUrl: string;
  headline: string;
}): string {
  return `What Plaino did for you last week.

${args.headline} for ${args.workspaceName}.

See the full digest: ${args.briefingsUrl}

This proof-of-value digest lands every Monday morning. Turn briefings off here: ${args.briefingsUrl}

Plaino, your service partner at agentplain

You're receiving this because you have an agentplain workspace.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
