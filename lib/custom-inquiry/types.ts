// Custom-inquiry intake — typed shape + Zod schema for the /custom contact
// form. Each vertical option matches `VERTICAL_SLUGS` from
// `lib/verticals` (the 10 locked verticals per
// `feedback_no_new_verticals_finish_locked.md`) plus an `other` escape valve
// for prospects who don't fit one yet. Plus/Max tiers are NOT options here —
// per `project_stripe_both_surfaces.md` (locked 2026-05-12) Plus/Max are not
// surfaced on customer surfaces.

import { z } from "zod";
import { VERTICAL_SLUGS } from "@/lib/verticals";

export const CUSTOM_INQUIRY_VERTICAL_OPTIONS = [
  ...VERTICAL_SLUGS,
  "other",
] as const;

export type CustomInquiryVertical =
  (typeof CUSTOM_INQUIRY_VERTICAL_OPTIONS)[number];

export const customInquirySchema = z.object({
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
});

export type CustomInquiryInput = z.infer<typeof customInquirySchema>;

export interface CustomInquirySubmitResult {
  ok: true;
  /** Provider-side message id from the email send (Resend re_*, test id). */
  messageId: string | null;
}

export interface CustomInquirySubmitError {
  ok: false;
  /** Field-level Zod errors, keyed by field name. */
  fieldErrors?: Partial<Record<keyof CustomInquiryInput, string>>;
  /** Top-level message for non-field errors (network, mail-send). */
  formError?: string;
}

export type CustomInquirySubmitResponse =
  | CustomInquirySubmitResult
  | CustomInquirySubmitError;
