// Support-request submit handler. Same no-outbound posture as custom-inquiry
// (project_no_outbound_architecture):
//   1. Persist a SupportRequest row (the durable artifact)
//   2. Send ONE notification email to the support address
//   3. Return a synchronous ack to the customer
// No drip, no auto-reply. Real ticketing (Intercom/Zendesk-grade) is later;
// the goal here is that a customer's first question doesn't vanish into a
// personal inbox (project_service_partnership_positioning).
//
// Persistence runs first so an email-send failure never loses the request.
// DB writes go through the customer's own workspace RLS context (NOT the
// system context) — the customer is signed in and acting in their workspace,
// so the workspace-isolation policy on SupportRequest is satisfied directly.
// Vendor coupling stays behind lib/email/getEmailProvider per
// feedback_no_silent_vendor_lock — this module never imports `resend`.

import type { Prisma } from "@prisma/client";
import { withRls, type RlsContext } from "@/lib/db/rls";
import { getEmailProvider } from "@/lib/email";
import { env } from "@/lib/env";
import { supportRequestSchema } from "./types";
import type { SupportRequestInput, SupportSubmitResult } from "./types";

export interface SubmitSupportRequestArgs {
  raw: unknown;
  workspaceId: string;
  fromUserId: string;
  fromEmail: string;
  workspaceName: string;
  /** Service-partner first name for the notification subject. */
  partnerName: string;
}

export async function submitSupportRequest(
  args: SubmitSupportRequestArgs,
): Promise<SupportSubmitResult> {
  const parsed = supportRequestSchema.safeParse(args.raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof SupportRequestInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key as keyof SupportRequestInput] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }
  const input = parsed.data;

  const ctx: RlsContext = {
    userId: args.fromUserId,
    workspaceId: args.workspaceId,
    isOperator: false,
  };

  // 1. Persist under the customer's workspace context.
  let requestId: string;
  try {
    requestId = await withRls(ctx, async (tx) => {
      const row = await tx.supportRequest.create({
        data: {
          workspaceId: args.workspaceId,
          fromUserId: args.fromUserId,
          subject: input.subject,
          body: input.body,
        },
        select: { id: true },
      });
      return row.id;
    });
  } catch (err) {
    return {
      ok: false,
      formError:
        err instanceof Error
          ? `We couldn't send your message (${err.message}). Try again, or email ${env.supportEmail()} directly.`
          : `We couldn't send your message. Try again, or email ${env.supportEmail()} directly.`,
    };
  }

  // 2. Notify the support inbox. The row is already saved; a send failure is
  //    logged to the audit trail (operator-visible) rather than surfaced as a
  //    form error, since the customer's message is not lost.
  const email = getEmailProvider();
  const { subject, text, html } = buildEmail(args, input, requestId);

  let messageId: string | null = null;
  try {
    const result = await email.send({
      to: env.supportEmail(),
      subject,
      text,
      html,
      replyTo: args.fromEmail,
      tags: { surface: "support-request", workspace_id: args.workspaceId },
    });
    messageId = result.messageId;
    await withRls(ctx, async (tx) => {
      await tx.supportRequest.update({
        where: { id: requestId },
        data: { emailMessageId: messageId },
      });
    });
  } catch (err) {
    await withRls(ctx, async (tx) => {
      await tx.auditLog.create({
        data: {
          actorUserId: args.fromUserId,
          workspaceId: args.workspaceId,
          action: "support_request.email_send_failed",
          targetTable: "SupportRequest",
          targetId: requestId,
          payload: {
            reason: err instanceof Error ? err.message : String(err),
          } satisfies Prisma.InputJsonValue,
        },
      });
    });
  }

  return { ok: true, requestId, messageId };
}

function buildEmail(
  args: SubmitSupportRequestArgs,
  input: SupportRequestInput,
  requestId: string,
): { subject: string; text: string; html: string } {
  const subject = `Support · ${args.workspaceName}: ${input.subject}`;

  const text = [
    `Support message from ${args.workspaceName}`,
    ``,
    `From:      ${args.fromEmail}`,
    `Workspace: ${args.workspaceName} (${args.workspaceId})`,
    `Subject:   ${input.subject}`,
    ``,
    input.body,
    ``,
    `--`,
    `Request id: ${requestId}`,
    `Triage at /operator/support.`,
  ].join("\n");

  const html = [
    `<p><strong>Support message from ${escapeHtml(args.workspaceName)}</strong></p>`,
    `<table cellspacing="0" cellpadding="4" style="font-family:monospace">`,
    `<tr><td><b>From</b></td><td>${escapeHtml(args.fromEmail)}</td></tr>`,
    `<tr><td><b>Workspace</b></td><td>${escapeHtml(args.workspaceName)}</td></tr>`,
    `<tr><td><b>Subject</b></td><td>${escapeHtml(input.subject)}</td></tr>`,
    `</table>`,
    `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(input.body)}</pre>`,
    `<hr/>`,
    `<p style="color:#666">Request id: <code>${escapeHtml(requestId)}</code> · Triage at <code>/operator/support</code>.</p>`,
  ].join("\n");

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export { supportRequestSchema } from "./types";
export type { SupportRequestInput, SupportSubmitResult } from "./types";
