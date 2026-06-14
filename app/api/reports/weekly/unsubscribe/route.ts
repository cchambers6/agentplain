/**
 * One-click unsubscribe for the weekly customer report email.
 *
 * CAN-SPAM + RFC 8058: the link must work WITHOUT login. The signed token
 * (see `lib/reports/unsubscribe-token`) authorizes flipping exactly one
 * workspace's `weeklyReportEnabled` to false — the lowest-stakes action
 * there is. We verify the HMAC, upsert the preference, write an audit row,
 * and show a plain confirmation page.
 *
 *   GET  — the human clicks the footer link → confirmation HTML.
 *   POST — the inbox provider's RFC 8058 one-click handler fires
 *          (List-Unsubscribe-Post: List-Unsubscribe=One-Click) → 200.
 *
 * No session, no CSRF token: the URL itself is the unforgeable capability,
 * and the only thing it can do is turn a report off.
 */

import type { Prisma } from '@prisma/client';
import { withSystemContext } from '@/lib/db';
import { verifyUnsubscribeToken } from '@/lib/reports/unsubscribe-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function applyUnsubscribe(token: string | null): Promise<boolean> {
  if (!token) return false;
  const workspaceId = verifyUnsubscribeToken(token);
  if (!workspaceId) return false;

  await withSystemContext(async (tx) => {
    await tx.workspacePreference.upsert({
      where: { workspaceId },
      create: { workspaceId, weeklyReportEnabled: false },
      update: { weeklyReportEnabled: false },
    });
    await tx.auditLog.create({
      data: {
        workspaceId,
        action: 'weekly_report.unsubscribed',
        targetTable: 'WorkspacePreference',
        targetId: workspaceId,
        payload: { via: 'email_one_click' } satisfies Prisma.InputJsonValue,
      },
    });
  });
  return true;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const ok = await applyUnsubscribe(url.searchParams.get('token'));
  return new Response(confirmationHtml(ok), {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request: Request): Promise<Response> {
  // RFC 8058 one-click: the token rides the query string of the
  // List-Unsubscribe URL; the POST body is the provider's marker, ignored.
  const url = new URL(request.url);
  const ok = await applyUnsubscribe(url.searchParams.get('token'));
  return new Response(ok ? 'unsubscribed' : 'invalid token', {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function confirmationHtml(ok: boolean): string {
  const title = ok
    ? "You're unsubscribed from weekly reports"
    : 'This unsubscribe link is no longer valid';
  const body = ok
    ? "You won't get the Friday weekly summary anymore. Plaino keeps working in your workspace either way — you can turn the email back on any time from your dashboard under email preferences."
    : 'The link may be incomplete or expired. You can manage your email preferences from your workspace dashboard.';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0; background:#EDE9DE; color:#1A1A1F; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;">
<div style="max-width:520px; margin:64px auto; background:#F7F4ED; border:1px solid #E0DAC9; padding:36px;">
  <h1 style="margin:0 0 12px 0; font-family:Georgia,serif; font-weight:500; font-size:22px;">${title}</h1>
  <p style="margin:0; font-size:15px; line-height:1.6; color:#2E2E33;">${body}</p>
  <p style="margin:20px 0 0 0; font-size:13px; color:#726A5E;">— Plaino, your service partner at agentplain</p>
</div>
</body></html>`;
}
