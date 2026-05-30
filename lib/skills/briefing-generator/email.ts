// Wave-2 briefings — notification email.
//
// Lightweight transactional notice: agentplain → broker-owner inbox
// telling them today's briefing is ready, with a deep link. Same
// project-side scope as the trial-warning email — NOT outbound on
// a customer's behalf.
//
// Per `project_no_outbound_architecture.md`: this is product-side
// transactional email, the same shape Stripe sends invoice receipts.
//
// Per `feedback_no_silent_vendor_lock`: Resend access goes through the
// `lib/email` adapter, never the SDK directly.

import type { EmailProvider } from '@/lib/email';
import { getEmailProvider } from '@/lib/email';
import type { BriefingSummary } from './types';

export interface NotifyBriefingReadyInput {
  brokerOwnerEmail: string;
  workspaceName: string;
  workspaceId: string;
  briefingId: string;
  summary: BriefingSummary;
  /** Absolute origin used to compose the deep link. */
  appOrigin: string;
  /** Override for tests; live caller uses `getEmailProvider()`. */
  email?: EmailProvider;
}

export interface NotifyBriefingReadyResult {
  messageId: string | null;
}

export async function notifyBriefingReady(
  input: NotifyBriefingReadyInput,
): Promise<NotifyBriefingReadyResult> {
  const email = input.email ?? getEmailProvider();
  const briefingsUrl = `${input.appOrigin.replace(/\/$/, '')}/app/workspace/${input.workspaceId}/briefings`;
  const today = new Date().toISOString().slice(0, 10);
  const subject = `Morning briefing — ${input.workspaceName}`;
  const headline = headlineFor(input.summary);
  const html = renderHtml({
    workspaceName: input.workspaceName,
    today,
    briefingsUrl,
    headline,
  });
  const text = renderText({
    workspaceName: input.workspaceName,
    today,
    briefingsUrl,
    headline,
  });
  const result = await email.send({
    to: input.brokerOwnerEmail,
    subject,
    html,
    text,
    tags: {
      kind: 'briefing_ready',
      workspace_id: input.workspaceId,
      briefing_id: input.briefingId,
    },
  });
  return { messageId: result.messageId };
}

function headlineFor(s: BriefingSummary): string {
  if (s.pendingApprovals > 0) {
    return `${s.pendingApprovals} ${pluralize('item', s.pendingApprovals)} waiting for your eye`;
  }
  if (s.approvalsInWindow > 0) {
    return `${s.approvalsInWindow} ${pluralize('thing', s.approvalsInWindow)} moved through your fleet`;
  }
  return 'A quiet morning — the fleet is still running its cadence';
}

function pluralize(noun: string, n: number): string {
  return n === 1 ? noun : `${noun}s`;
}

function renderHtml(args: {
  workspaceName: string;
  today: string;
  briefingsUrl: string;
  headline: string;
}): string {
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif; color:#1A1A1F; background:#F7F4ED; padding:32px;">
  <h2 style="font-weight:500; color:#1A1A1F;">Your morning briefing is ready.</h2>
  <p>${escapeHtml(args.headline)} for ${escapeHtml(args.workspaceName)} — ${escapeHtml(args.today)}.</p>
  <p><a href="${args.briefingsUrl}" style="display:inline-block; padding:12px 20px; background:#1A1A1F; color:#F7F4ED; text-decoration:none; font-weight:500;">Read the briefing</a></p>
  <p style="font-size:13px; color:#8C8478;">Briefings land daily Mon–Fri at ~09:00 ET. Turn them off from the briefings page if you'd rather not get this email.</p>
  <p style="font-size:13px; color:#8C8478;">Plaino, your service partner at agentplain</p>
</body></html>`;
}

function renderText(args: {
  workspaceName: string;
  today: string;
  briefingsUrl: string;
  headline: string;
}): string {
  return `Your morning briefing is ready.

${args.headline} for ${args.workspaceName} — ${args.today}.

Read the briefing: ${args.briefingsUrl}

Briefings land daily Mon–Fri at ~09:00 ET. Turn them off from the briefings page if you'd rather not get this email.

Plaino, your service partner at agentplain`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
