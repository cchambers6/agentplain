// Custom-inquiry submit handler. Stays inside agentplain's no-outbound
// architecture (per `project_no_outbound_architecture.md`):
//   1. Persist an `Inquiry` row (durable artifact)
//   2. Send ONE email to Conner's inbox (notification)
//   3. Render a synchronous ack to the visitor
// No drip sequences, no auto-follow-ups, no Twilio/SendGrid/dialer plumbing.
//
// Persistence runs first so an email-send failure never loses the inquiry.
// If the DB write fails the visitor sees a retry prompt and Conner is not
// silently surprised by a missing record later.
//
// Vendor coupling per `feedback_no_silent_vendor_lock.md` lives behind
// `lib/email/getEmailProvider()` — this module never imports `resend`
// directly. DB writes go through `withSystemContext` (operator RLS) so the
// public POST satisfies the policy on `Inquiry` without a user session.

import type { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { withSystemContext } from "@/lib/db/rls";
import { getEmailProvider } from "@/lib/email";
import {
  customInquirySchema,
  INQUIRY_TYPE_LABEL,
  showsServiceIntensityNotes,
} from "./types";
import type {
  CustomInquiryInput,
  CustomInquirySubmitResponse,
  InquiryType,
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

  // 1. Persist. If this fails we never send the email — the visitor sees a
  //    retry prompt rather than the inquiry vanishing into Conner's inbox
  //    with no DB trace.
  let inquiryId: string;
  try {
    inquiryId = await withSystemContext(async (tx) => {
      const row = await tx.inquiry.create({
        data: {
          name: input.name,
          business: input.business,
          vertical: input.vertical,
          seats: input.seats,
          needs: input.needs,
          email: input.email,
          inquiryType: inquiryTypeForDb(input.inquiryType),
          serviceIntensityNotes:
            input.serviceIntensityNotes &&
            showsServiceIntensityNotes(input.inquiryType)
              ? input.serviceIntensityNotes
              : null,
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
          ? `We couldn't save your inquiry (${err.message}). Try again or email hello@agentplain.com directly.`
          : "We couldn't save your inquiry. Try again or email hello@agentplain.com directly.",
    };
  }

  // 2. Email Conner. If this fails we keep the row but flag the issue —
  //    operator triage can read the row directly on /operator/inquiries.
  const email = getEmailProvider();
  const to = env.customInquiryTo();
  const subject = subjectFor(input);
  const { text, html } = bodyFor(input, inquiryId);

  let messageId: string | null = null;
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
        inquiry_type: input.inquiryType,
      },
    });
    messageId = result.messageId;
    // Stamp the email id on the row so triage knows the notification fired.
    await withSystemContext(async (tx) => {
      await tx.inquiry.update({
        where: { id: inquiryId },
        data: { emailMessageId: messageId },
      });
    });
  } catch (err) {
    // Don't surface as a formError — the inquiry IS saved. Log the failure
    // path through the audit table so operator triage knows the
    // notification leg didn't land.
    await withSystemContext(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "inquiry.email_send_failed",
          targetTable: "Inquiry",
          targetId: inquiryId,
          payload: {
            reason: err instanceof Error ? err.message : String(err),
          } satisfies Prisma.InputJsonValue,
        },
      });
    });
  }

  return {
    ok: true,
    inquiryId,
    messageId,
    inquiryType: input.inquiryType,
  };
}

function inquiryTypeForDb(
  t: InquiryType,
): "CUSTOM_SKILL_BUILD" | "MAX_SERVICE_ENGAGEMENT" | "NOT_SURE" {
  switch (t) {
    case "custom_skill_build":
      return "CUSTOM_SKILL_BUILD";
    case "max_service_engagement":
      return "MAX_SERVICE_ENGAGEMENT";
    case "not_sure":
      return "NOT_SURE";
  }
}

function subjectFor(input: CustomInquiryInput): string {
  const tag =
    input.inquiryType === "max_service_engagement"
      ? "Max inquiry"
      : input.inquiryType === "not_sure"
        ? "Inquiry (unrouted)"
        : "Custom inquiry";
  return `${tag} · ${input.business} (${input.vertical})`;
}

function bodyFor(
  input: CustomInquiryInput,
  inquiryId: string,
): { text: string; html: string } {
  const typeLabel = INQUIRY_TYPE_LABEL[input.inquiryType];
  const showsIntensity = showsServiceIntensityNotes(input.inquiryType);

  const textLines = [
    `Inquiry from agentplain.com/custom`,
    ``,
    `Type:     ${typeLabel}`,
    `Name:     ${input.name}`,
    `Business: ${input.business}`,
    `Vertical: ${input.vertical}`,
    `Seats:    ${input.seats}`,
    `Email:    ${input.email}`,
    ``,
    `What they need:`,
    input.needs,
  ];
  if (showsIntensity && input.serviceIntensityNotes) {
    textLines.push(``, `Service intensity:`, input.serviceIntensityNotes);
  }
  textLines.push(``, `--`, `Inquiry id: ${inquiryId}`, `Triage at /operator/inquiries.`);
  const text = textLines.join("\n");

  const intensityHtml =
    showsIntensity && input.serviceIntensityNotes
      ? [
          `<p><b>Service intensity:</b></p>`,
          `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(
            input.serviceIntensityNotes,
          )}</pre>`,
        ].join("\n")
      : "";

  const html = [
    `<p><strong>Inquiry from agentplain.com/custom</strong></p>`,
    `<table cellspacing="0" cellpadding="4" style="font-family:monospace">`,
    `<tr><td><b>Type</b></td><td>${escapeHtml(typeLabel)}</td></tr>`,
    `<tr><td><b>Name</b></td><td>${escapeHtml(input.name)}</td></tr>`,
    `<tr><td><b>Business</b></td><td>${escapeHtml(input.business)}</td></tr>`,
    `<tr><td><b>Vertical</b></td><td>${escapeHtml(input.vertical)}</td></tr>`,
    `<tr><td><b>Seats</b></td><td>${escapeHtml(input.seats)}</td></tr>`,
    `<tr><td><b>Email</b></td><td>${escapeHtml(input.email)}</td></tr>`,
    `</table>`,
    `<p><b>What they need:</b></p>`,
    `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(input.needs)}</pre>`,
    intensityHtml,
    `<hr/>`,
    `<p style="color:#666">Inquiry id: <code>${escapeHtml(inquiryId)}</code> · Triage at <code>/operator/inquiries</code>.</p>`,
  ].join("\n");

  return { text, html };
}

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
  InquiryType,
} from "./types";
export {
  CUSTOM_INQUIRY_VERTICAL_OPTIONS,
  INQUIRY_TYPE_LABEL,
  INQUIRY_TYPE_OPTIONS,
  customInquirySchema,
  showsServiceIntensityNotes,
} from "./types";
