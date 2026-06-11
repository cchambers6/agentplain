// Custom-inquiry submit handler. Stays inside agentplain's no-outbound
// architecture (per `project_no_outbound_architecture.md`):
//   1. Persist an `Inquiry` row (durable artifact)
//   2. Send ONE email to Conner's inbox (operator notification)
//   3. Send ONE confirmation email to the submitter (transactional ack)
//   4. Render a synchronous ack to the visitor
// The no-outbound rule governs agentplain *agents* reaching into a customer's
// contact graph; transactional acks to a person who just submitted a form on
// our marketing site are the same category as the operator notification — a
// single response to an explicit submission. No drips, no follow-ups.
//
// Persistence runs first so a mail-send failure (operator OR confirmation)
// never loses the inquiry. The two send legs are independent — if either
// fails, the other still runs and the submit still returns ok.
//
// Vendor coupling per `feedback_no_silent_vendor_lock.md` lives behind
// `lib/email/getEmailProvider()` — this module never imports `resend`
// directly. DB writes go through `withSystemContext` (operator RLS) so the
// public POST satisfies the policy on `Inquiry` without a user session.

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { withSystemContext as defaultWithSystemContext } from "@/lib/db/rls";
import { getEmailProvider } from "@/lib/email";
import { getLogger, type Logger } from "@/lib/observability/logger";
import type { EmailProvider } from "@/lib/email";
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

/** Function that runs a callback against the operator/system RLS context.
 *  Production callers pass nothing and pick up the real implementation;
 *  tests inject a fake-tx runner so the unit doesn't need Postgres.
 *  Mirrors the `SystemContextRunner` pattern from
 *  `lib/billing/provisioning.ts`. */
export type SystemContextRunner = <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
) => Promise<T>;

export interface SubmitCustomInquiryDeps {
  /** Override for tests; production uses `withSystemContext`. */
  systemContext?: SystemContextRunner;
  /** Override for tests; production uses `getEmailProvider()`. */
  email?: EmailProvider;
  /** Override for tests; production uses `getLogger()`. */
  logger?: Logger;
}

export async function submitCustomInquiry(
  raw: unknown,
  deps: SubmitCustomInquiryDeps = {},
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

  const withSystemContext: SystemContextRunner =
    deps.systemContext ?? defaultWithSystemContext;
  const email = deps.email ?? getEmailProvider();
  const logger = deps.logger ?? getLogger();

  // 1. Persist. If this fails we never send any email — the visitor sees a
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

  // 2. Email Conner (operator notification). If this fails we keep the row
  //    but flag the issue — operator triage can read the row directly on
  //    /operator/inquiries.
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

  // 3. Confirmation email to the submitter. Failure-isolated — must not
  //    affect the persisted row OR the operator notification leg above.
  //    Per the just-merged PII-scrubbing work (commit 0db5e12), the
  //    breadcrumb on failure stores only an address hash + length + error
  //    name. Never the submitter's address, message body, or the raw
  //    provider error string (which can echo address fragments back).
  const confirmation = buildConfirmationEmail(input, inquiryId);
  try {
    await email.send({
      to: input.email,
      subject: confirmation.subject,
      text: confirmation.text,
      html: confirmation.html,
      tags: {
        surface: "custom-inquiry-confirmation",
        inquiry_type: input.inquiryType,
      },
    });
  } catch (err) {
    const errorName = err instanceof Error ? err.name : "UnknownError";
    const addressHash = createHash("sha256")
      .update(input.email)
      .digest("hex")
      .slice(0, 16);
    const addressLength = input.email.length;
    logger.warn("custom-inquiry confirmation send failed", {
      error_name: errorName,
      address_hash: addressHash,
      address_length: addressLength,
      inquiry_id: inquiryId,
      inquiry_type: input.inquiryType,
    });
    await withSystemContext(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: "inquiry.confirmation_email_send_failed",
          targetTable: "Inquiry",
          targetId: inquiryId,
          payload: {
            error_name: errorName,
            address_hash: addressHash,
            address_length: addressLength,
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
    `<p style="color:#726A5E">Inquiry id: <code>${escapeHtml(inquiryId)}</code> · Triage at <code>/operator/inquiries</code>.</p>`,
  ].join("\n");

  return { text, html };
}

// Confirmation email sent to the submitter. Heritage voice — calm,
// plainspoken, unhurried — and service-partnership tone ("we run it for
// you", Plaino, agent + the plains). The SLA paragraph mirrors the
// on-page `SentState` ack (components/CustomInquiryForm.tsx:345-371) so
// inbox + on-page see the same windows. No DIY-tool framing, no airplane
// wordplay, no internal pilot/V0 language (per `docs/brand-and-claims.md`
// §1 and `feedback_everything_tells_a_story.md`).
export function buildConfirmationEmail(
  input: CustomInquiryInput,
  inquiryId: string,
): { subject: string; text: string; html: string } {
  const isMax = input.inquiryType === "max_service_engagement";
  const subject = "We got your note — agentplain";

  const slaParagraph = isMax
    ? "Within one business day, a service partner will reach out to start scoping the engagement. Max-tier work is quote-based, so the first reply is a real human reading what you wrote — not a form, not an automation."
    : "Within two business days, a real human will come back with a scoping call invite and a written spec — what we'd build, how long it'd take, what it'd cost. No surprise charges, no drip sequence.";

  const partnerParagraph =
    "agentplain runs the operational tail for you. Agents handle the steady, repeatable work — drafts, scheduling, follow-ups, hygiene — and Plaino, your service partner, keeps things moving and reports back. You're not learning a tool; we run the work that takes your time away from the people you serve.";

  const text = [
    `Hi ${input.name},`,
    ``,
    `Thanks for reaching out about ${input.business}. Your note made it here, and we're reading it.`,
    ``,
    `What happens next`,
    slaParagraph,
    ``,
    `How we work`,
    partnerParagraph,
    ``,
    `If anything changes on your end, or you want to send more context, just reply to this email — it goes to a real inbox we read.`,
    ``,
    `Plaino, your service partner at agentplain`,
    `hello@agentplain.com`,
    ``,
    `You're receiving this because you submitted an inquiry at agentplain.com.`,
    `Inquiry id: ${inquiryId}`,
  ].join("\n");

  // Brand palette: canonical tokens from lib/brand/tokens.ts.
  // paper #F7F4ED, ink #1A1A1F, clay #B65D3A, moss #3F5C3F, mute #726A5E.
  // Display in a humanist body face; the email surface intentionally avoids
  // loading a custom display font — every client renders the fallback cleanly.
  const html = [
    `<!doctype html>`,
    `<html><body style="margin:0;padding:0;background:#F7F4ED;">`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F4ED;">`,
    `<tr><td align="center" style="padding:32px 16px;">`,
    `<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;background:#F7F4ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1A1A1F;">`,
    `<tr><td style="padding:0 0 24px 0;">`,
    `<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:#3F5C3F;letter-spacing:-0.01em;">agentplain</p>`,
    `<p style="margin:4px 0 0 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#726A5E;">Intelligence rooted in reality</p>`,
    `</td></tr>`,
    `<tr><td style="padding:0 0 16px 0;">`,
    `<p style="margin:0;font-size:16px;line-height:1.6;color:#1A1A1F;">Hi ${escapeHtml(input.name)},</p>`,
    `</td></tr>`,
    `<tr><td style="padding:0 0 16px 0;">`,
    `<p style="margin:0;font-size:16px;line-height:1.6;color:#1A1A1F;">Thanks for reaching out about <strong>${escapeHtml(
      input.business,
    )}</strong>. Your note made it here, and we're reading it.</p>`,
    `</td></tr>`,
    `<tr><td style="padding:8px 0 8px 0;">`,
    `<p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#B65D3A;">What happens next</p>`,
    `<p style="margin:0;font-size:15px;line-height:1.65;color:#1A1A1F;">${escapeHtml(
      slaParagraph,
    )}</p>`,
    `</td></tr>`,
    `<tr><td style="padding:16px 0 8px 0;">`,
    `<p style="margin:0 0 6px 0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#B65D3A;">How we work</p>`,
    `<p style="margin:0;font-size:15px;line-height:1.65;color:#1A1A1F;">${escapeHtml(
      partnerParagraph,
    )}</p>`,
    `</td></tr>`,
    `<tr><td style="padding:20px 0 0 0;">`,
    `<p style="margin:0;font-size:15px;line-height:1.65;color:#1A1A1F;">If anything changes on your end, or you want to send more context, just reply to this email — it goes to a real inbox we read.</p>`,
    `</td></tr>`,
    `<tr><td style="padding:24px 0 0 0;">`,
    `<p style="margin:0;font-size:15px;line-height:1.6;color:#3F5C3F;">Plaino, your service partner at agentplain</p>`,
    `<p style="margin:2px 0 0 0;font-size:14px;line-height:1.6;color:#726A5E;">hello@agentplain.com</p>`,
    `</td></tr>`,
    `<tr><td style="padding:28px 0 0 0;border-top:1px solid rgba(63,92,63,0.15);margin-top:24px;">`,
    `<p style="margin:8px 0 0 0;font-size:12px;color:#726A5E;">You're receiving this because you submitted an inquiry at agentplain.com.</p>`,
    `<p style="margin:8px 0 0 0;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:11px;color:#726A5E;">Inquiry id: ${escapeHtml(
      inquiryId,
    )}</p>`,
    `</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</body></html>`,
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
