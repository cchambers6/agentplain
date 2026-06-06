// Lead-capture intake — typed shape + Zod schema for the marketing Plaino
// widget's hand-off panel. When an anonymous conversation produces real
// intent (demo / trial / "what would this cost for my team"), the widget
// collects an email + light context and persists a LeadCapture row for
// /operator/leads.
//
// Lighter than the /custom Inquiry on purpose: a widget lead carries the
// conversation that produced it, not a scoped engagement brief. Only the
// email + a one-line intent are required; everything else is optional.
//
// No-outbound posture (project_no_outbound_architecture): the row is the
// durable artifact. There is no auto-reply and no drip — the operator
// reaches out from the leads queue. A real human, not a sequence.

import { z } from "zod";

export const leadCaptureSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  name: z.string().trim().max(120).optional(),
  business: z.string().trim().max(160).optional(),
  // Free-form vertical slug or label — wider than the locked-ten enum so an
  // off-list prospect is still captured.
  vertical: z.string().trim().max(60).optional(),
  intent: z
    .string()
    .trim()
    .min(1, "Tell us what you're after")
    .max(2000),
  // Marketing route the conversation happened on.
  sourcePage: z.string().trim().max(200).optional(),
  // Soft link to the PlainoConversation that produced the lead.
  conversationId: z.string().uuid().optional(),
  // True when the prospect asked about Claude / Claude for Small Business
  // during the conversation. The widget can set it explicitly; the submit
  // handler also infers it from the linked conversation turns, so an absent
  // flag never under-counts the comparison-prospect cohort. See
  // project_sbm_wrapper_positioning_2026_06_06.
  askedAboutClaude: z.boolean().optional(),
});

export type LeadCaptureInput = z.infer<typeof leadCaptureSchema>;

export type LeadCaptureSubmitResult =
  | { ok: true; leadId: string }
  | {
      ok: false;
      fieldErrors?: Partial<Record<keyof LeadCaptureInput, string>>;
      formError?: string;
    };
