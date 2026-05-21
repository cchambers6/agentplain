// Support-request intake shape. Scaffold (feat/support-routing, 2026-05-20)
// — real ticketing comes later; this validates and normalizes the in-app
// "message your service partner" form.

import { z } from "zod";

export const supportRequestSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Add a short subject so we know what this is about.")
    .max(200, "Keep the subject under 200 characters."),
  body: z
    .string()
    .trim()
    .min(10, "Tell us a little more so we can help.")
    .max(5000, "Keep the message under 5000 characters."),
});

export type SupportRequestInput = z.infer<typeof supportRequestSchema>;

export interface SupportSubmitResult {
  ok: boolean;
  requestId?: string;
  messageId?: string | null;
  fieldErrors?: Partial<Record<keyof SupportRequestInput, string>>;
  formError?: string;
}
