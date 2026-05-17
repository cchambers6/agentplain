// Custom-inquiry intake — typed shape + Zod schema for the /custom contact
// form. Each vertical option matches `VERTICAL_SLUGS` from
// `lib/verticals` (the 10 locked verticals per
// `feedback_no_new_verticals_finish_locked.md`) plus an `other` escape valve
// for prospects who don't fit one yet.
//
// `inquiryType` was added 2026-05-15 (feat/max-quote-intake) so /custom doubles
// as the intake for Max-tier quote engagements per
// `project_stripe_both_surfaces.md` (Max is ad-hoc / quote-based, not
// productized in Stripe). One form, one inbox, one operator triage surface —
// Conner reads the row and routes it. The Tier enum stays in
// `prisma/schema.prisma`; this field is the customer-side framing.

import { z } from "zod";
import { VERTICAL_SLUGS } from "@/lib/verticals";

export const CUSTOM_INQUIRY_VERTICAL_OPTIONS = [
  ...VERTICAL_SLUGS,
  "other",
] as const;

export type CustomInquiryVertical =
  (typeof CUSTOM_INQUIRY_VERTICAL_OPTIONS)[number];

// Inquiry type — drives operator triage and SLA copy on the confirmation
// state. `not_sure` is the explicit "both / route me" option so visitors
// don't have to self-classify when they're not certain which side they need.
export const INQUIRY_TYPE_OPTIONS = [
  "custom_skill_build",
  "max_service_engagement",
  "not_sure",
] as const;

export type InquiryType = (typeof INQUIRY_TYPE_OPTIONS)[number];

export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = {
  custom_skill_build: "Custom skill build",
  max_service_engagement: "Max-tier service engagement",
  not_sure: "Not sure / both",
};

export const INQUIRY_TYPE_DETAIL: Record<InquiryType, string> = {
  custom_skill_build:
    "Custom skill, integration, white-label, bespoke compliance, dedicated success — anything Regular doesn't ship.",
  max_service_engagement:
    "Multi-state ops, white-label, dedicated team, regulated-vertical compliance gates. Quote-based, scoped per engagement.",
  not_sure: "We'll read what you wrote and route you the right way.",
};

// Visitors with a high-intensity engagement should get the conditional
// "what does your operation look like?" textarea. Predicate centralized so
// the form + the API agree on when to require it.
export function showsServiceIntensityNotes(t: InquiryType): boolean {
  return t === "max_service_engagement" || t === "not_sure";
}

export const customInquirySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    business: z.string().trim().min(1, "Business name is required").max(160),
    vertical: z.enum(CUSTOM_INQUIRY_VERTICAL_OPTIONS),
    seats: z
      .string()
      .trim()
      .min(1, "Estimated seat count is required")
      .max(40),
    needs: z
      .string()
      .trim()
      .min(20, "Tell us a bit about what you need (20+ characters)")
      .max(4000),
    email: z.string().trim().toLowerCase().email("Valid email is required"),
    inquiryType: z
      .enum(INQUIRY_TYPE_OPTIONS)
      .default("custom_skill_build"),
    // Optional even when shown; field is encouraged, not gating. Operator
    // triage benefits from the prose but a Max prospect typing only into
    // `needs` is still actionable.
    serviceIntensityNotes: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  // If the visitor picked the Max path but left the intensity field empty,
  // surface the prompt rather than silently accepting — the operator wants
  // signal on multi-state / white-label / compliance shape before the call.
  .refine(
    (data) =>
      data.inquiryType !== "max_service_engagement" ||
      (data.serviceIntensityNotes !== undefined &&
        data.serviceIntensityNotes.length >= 20),
    {
      message:
        "Sketch your operation in a couple of sentences (20+ characters) — multi-state, white-label, compliance gates, etc.",
      path: ["serviceIntensityNotes"],
    },
  );

export type CustomInquiryInput = z.infer<typeof customInquirySchema>;

export interface CustomInquirySubmitResult {
  ok: true;
  /** UUID of the persisted Inquiry row. */
  inquiryId: string;
  /** Provider-side message id from the email send (Resend re_*, test id). */
  messageId: string | null;
  /** Echoed back so the form can render type-aware ack copy without a refetch. */
  inquiryType: InquiryType;
}

export interface CustomInquirySubmitError {
  ok: false;
  /** Field-level Zod errors, keyed by field name. */
  fieldErrors?: Partial<Record<keyof CustomInquiryInput, string>>;
  /** Top-level message for non-field errors (network, mail-send, persist). */
  formError?: string;
}

export type CustomInquirySubmitResponse =
  | CustomInquirySubmitResult
  | CustomInquirySubmitError;
