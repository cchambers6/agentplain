/**
 * lib/support/tickets/notify.ts
 *
 * Production binding for the TicketNotifier port.
 *
 * STAFF alert → routed through lib/ops/page-human, the fleet's single
 * page-a-human choke point. That gives us, for free: a guaranteed recipient
 * (never "nobody" — Conner-dead P0 #1), an audit-log row even when email is
 * down (the loud-fail artifact), and the SAME routing every other escalation
 * uses. Priority maps to page severity (P0/P1 → critical) and the SLA
 * deadline rides the page's `deadline`.
 *
 * CUSTOMER confirmation → sent through the generic lib/email seam (Resend in
 * prod, the in-memory test provider in tests). This is a transactional
 * acknowledgement of an action the customer just took — like a magic link —
 * NOT outbound marketing, so it does not violate
 * project_no_outbound_architecture (the actual ANSWER still goes through the
 * operator-gated reply path).
 *
 * Per feedback_no_silent_vendor_lock.md neither Resend nor Inngest is touched
 * directly here beyond the existing seams.
 */

import { getEmailProvider, type EmailProvider } from "../../email";
import { pageHuman } from "../../ops/page-human";

/** The page-a-human function signature, for test injection. */
type Pager = typeof pageHuman;
import { resolveTicketAssignee } from "./routing";
import { formatTicketNumber, slaWindowLabel } from "./sla";
import type {
  CustomerConfirmArgs,
  StaffNotifyArgs,
  StaffNotifyResult,
  TicketNotifier,
  TicketPriority,
} from "./types";

/** Absolute URL of a ticket in the staff inbox, for the alert body. */
function staffTicketUrl(ticketId: string, env: NodeJS.ProcessEnv): string {
  const base = (env.NEXT_PUBLIC_APP_URL ?? env.APP_URL ?? "https://app.agentplain.com")
    .replace(/\/$/, "");
  return `${base}/operator/tickets/${ticketId}`;
}

const CRITICAL_PRIORITIES: ReadonlySet<TicketPriority> = new Set(["P0", "P1"]);

export class PageHumanTicketNotifier implements TicketNotifier {
  readonly name = "page-human+email" as const;

  constructor(
    private readonly deps: {
      email?: EmailProvider;
      pager?: Pager;
      env?: NodeJS.ProcessEnv;
    } = {},
  ) {}

  async notifyStaffNewTicket(
    args: StaffNotifyArgs,
  ): Promise<StaffNotifyResult> {
    const env = this.deps.env ?? process.env;
    const pager = this.deps.pager ?? pageHuman;
    const severity = CRITICAL_PRIORITIES.has(args.priority) ? "critical" : "warn";

    const details = [
      `New support ticket ${formatTicketNumber(args.number)} — ${args.category} / ${args.priority}.`,
      ``,
      `Workspace: ${args.workspaceName} (${args.workspaceId})`,
      `From: ${args.fromEmail}`,
      `Subject: ${args.subject}`,
      ``,
      `What they said:`,
      args.description,
      ``,
      `Workspace context at the time:`,
      `  • Vertical: ${args.context.vertical ?? "—"}`,
      `  • Plan: ${args.context.plan ?? "—"}`,
      `  • Integrations connected: ${
        args.context.integrationsConnected.length > 0
          ? args.context.integrationsConnected.join(", ")
          : "none"
      }`,
      `  • Plaino state: ${args.context.plainoState ?? "—"}`,
      ...(args.context.recentQueueItems.length > 0
        ? [`  • Recent queue items:`, ...args.context.recentQueueItems.map((q) => `      - ${q}`)]
        : []),
      ``,
      `Work it here: ${staffTicketUrl(args.ticketId, env)}`,
    ].join("\n");

    const result = await pager(
      {
        severity,
        summary: `Support ticket ${formatTicketNumber(args.number)}: ${args.subject}`,
        details,
        deadline: args.firstResponseDueAt,
        source: "support-ticket",
        workspaceId: args.workspaceId,
      },
      { email: this.deps.email, env },
    );

    return {
      delivered: result.delivered,
      recipients: result.recipients,
      usedHardcodedFallback: result.usedHardcodedFallback === true,
      persisted: result.persisted,
    };
  }

  async confirmToCustomer(
    args: CustomerConfirmArgs,
  ): Promise<{ delivered: boolean }> {
    const email = this.deps.email ?? getEmailProvider();
    const num = formatTicketNumber(args.number);
    const subject = `We got your ticket ${num} — ${args.subject}`;
    const text = [
      `Thanks for reaching out.`,
      ``,
      `We've opened ticket ${num} for "${args.subject}".`,
      `Expected first response: ${args.slaWindowLabel}.`,
      ``,
      `You can follow the conversation any time from your workspace under Support → My tickets. Just reply there and we'll see it.`,
      ``,
      `— ${args.partnerName} and the agentplain team`,
    ].join("\n");
    const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;color:#1A1A1F;background:#F7F4ED;padding:24px;">
  <p style="margin:0 0 16px;">Thanks for reaching out.</p>
  <p style="margin:0 0 8px;">We've opened ticket <strong>${num}</strong> for &ldquo;${escapeHtml(args.subject)}&rdquo;.</p>
  <p style="margin:0 0 16px;">Expected first response: <strong>${escapeHtml(args.slaWindowLabel)}</strong>.</p>
  <p style="margin:0 0 16px;color:#5A554C;">You can follow the conversation any time from your workspace under Support → My tickets. Just reply there and we'll see it.</p>
  <p style="margin:24px 0 0;color:#8C8478;">— ${escapeHtml(args.partnerName)} and the agentplain team</p>
</body></html>`;

    try {
      await email.send({
        to: args.toEmail,
        subject,
        text,
        html,
        tags: { surface: "support-ticket-confirmation" },
      });
      return { delivered: true };
    } catch {
      // Best-effort: a failed confirmation never fails ticket creation. The
      // ticket + the staff page already landed; the customer also sees the
      // SLA on-screen immediately after submitting.
      return { delivered: false };
    }
  }
}

/** Re-export so callers needn't reach into routing for the loud-fallback bit. */
export { resolveTicketAssignee, slaWindowLabel };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
