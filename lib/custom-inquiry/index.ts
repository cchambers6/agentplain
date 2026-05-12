// Custom-inquiry submit handler. Stays inside agentplain's no-outbound
// architecture (per `project_no_outbound_architecture.md`) — the only
// thing that leaves the system is one email to Conner's inbox (the
// inquiry itself) plus a synchronous ack rendered to the visitor. No
// drip sequences, no auto-follow-ups, no Twilio/SendGrid/dialer plumbing.
//
// Vendor coupling per `feedback_no_silent_vendor_lock.md` lives behind
// `lib/email/getEmailProvider()` — this module never imports `resend`
// directly.

import { env } from "@/lib/env";
import { getEmailProvider } from "@/lib/email";
import { customInquirySchema } from "./types";
import type {
  CustomInquiryInput,
  CustomInquirySubmitResponse,
} from "./types";

export async function submitCustomInquiry(
  raw: unknown,
): Promise<CustomInquirySubmitResponse> {
  const parsed = customInquirySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof CustomInquiryInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key as keyof CustomInquiryInput] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }
  const input = parsed.data;

  const email = getEmailProvider();
  const to = env.customInquiryTo();

  const subject = `Custom inquiry · ${input.business} (${input.vertical})`;

  const text = [
    `Custom-engagement inquiry from agentplain.com/custom`,
    ``,
    `Name:     ${input.name}`,
    `Business: ${input.business}`,
    `Vertical: ${input.vertical}`,
    `Seats:    ${input.seats}`,
    `Email:    ${input.email}`,
    ``,
    `What they need:`,
    input.needs,
    ``,
    `--`,
    `Sent from /custom contact form.`,
  ].join("\n");

  const html = [
    `<p><strong>Custom-engagement inquiry from agentplain.com/custom</strong></p>`,
    `<table cellspacing="0" cellpadding="4" style="font-family:monospace">`,
    `<tr><td><b>Name</b></td><td>${escapeHtml(input.name)}</td></tr>`,
    `<tr><td><b>Business</b></td><td>${escapeHtml(input.business)}</td></tr>`,
    `<tr><td><b>Vertical</b></td><td>${escapeHtml(input.vertical)}</td></tr>`,
    `<tr><td><b>Seats</b></td><td>${escapeHtml(input.seats)}</td></tr>`,
    `<tr><td><b>Email</b></td><td>${escapeHtml(input.email)}</td></tr>`,
    `</table>`,
    `<p><b>What they need:</b></p>`,
    `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(input.needs)}</pre>`,
    `<hr/>`,
    `<p style="color:#666">Sent from <code>/custom</code> contact form.</p>`,
  ].join("\n");

  try {
    const result = await email.send({
      to,
      subject,
      text,
      html,
      replyTo: input.email,
      tags: {
        surface: "custom-inquiry",
        vertical: input.vertical,
      },
    });
    return { ok: true, messageId: result.messageId };
  } catch (err) {
    return {
      ok: false,
      formError:
        err instanceof Error
          ? err.message
          : "Something went wrong sending your inquiry. Email hello@agentplain.com directly.",
    };
  }
}

// Tiny HTML escaper. Plenty for a 4000-char free-text field rendered into
// an email body; not a generic XSS shield (the message never re-renders to
// a browser surface).
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type {
  CustomInquiryInput,
  CustomInquirySubmitResponse,
  CustomInquiryVertical,
} from "./types";
export {
  CUSTOM_INQUIRY_VERTICAL_OPTIONS,
  customInquirySchema,
} from "./types";
