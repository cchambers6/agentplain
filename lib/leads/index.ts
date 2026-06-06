// Lead-capture submit handler for the marketing Plaino widget.
//
// Same no-outbound posture as custom-inquiry (project_no_outbound_architecture):
// persist the durable LeadCapture row; the operator reaches out from
// /operator/leads. No drip, no auto-reply.
//
// RLS: operator-only, exactly like Inquiry. The visitor is anonymous, so the
// write goes through withSystemContext (app.is_operator='true') and satisfies
// the leadcapture_operator_all policy's WITH CHECK without a logged-in user.
//
// When the lead links back to a PlainoConversation, we flag that row
// leadCaptured=true so the drift sweep can separate converting conversations
// from the rest. Best-effort — a flag failure never fails the capture.

import { withSystemContext } from "@/lib/db/rls";
import { markConversationLeadCaptured } from "@/lib/plaino/conversation-log";
import { leadCaptureSchema } from "./types";
import type { LeadCaptureInput, LeadCaptureSubmitResult } from "./types";

export async function submitLeadCapture(
  raw: unknown,
): Promise<LeadCaptureSubmitResult> {
  const parsed = leadCaptureSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<keyof LeadCaptureInput, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !(key in fieldErrors)) {
        fieldErrors[key as keyof LeadCaptureInput] = issue.message;
      }
    }
    return { ok: false, fieldErrors };
  }
  const input = parsed.data;

  let leadId: string;
  try {
    leadId = await withSystemContext(async (tx) => {
      const row = await tx.leadCapture.create({
        data: {
          email: input.email,
          name: input.name ?? null,
          business: input.business ?? null,
          vertical: input.vertical ?? null,
          intent: input.intent,
          sourcePage: input.sourcePage ?? null,
          conversationId: input.conversationId ?? null,
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
          ? `We couldn't save your details (${err.message}). Try again, or email hello@agentplain.com directly.`
          : "We couldn't save your details. Try again, or email hello@agentplain.com directly.",
    };
  }

  if (input.conversationId) {
    try {
      await markConversationLeadCaptured(input.conversationId);
    } catch {
      // Non-fatal — the lead row is already durable.
    }
  }

  return { ok: true, leadId };
}

export { leadCaptureSchema } from "./types";
export type { LeadCaptureInput, LeadCaptureSubmitResult } from "./types";
