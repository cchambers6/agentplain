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
import {
  getConversationTurns,
  markConversationLeadCaptured,
} from "@/lib/plaino/conversation-log";
import { leadCaptureSchema } from "./types";
import type { LeadCaptureInput, LeadCaptureSubmitResult } from "./types";

// Phrases that mark a prospect comparing us to Claude / Claude for Small
// Business. Matched case-insensitively against the prospect's own words
// (their intent line + the user turns of the linked conversation) so the
// comparison-prospect cohort is tracked even when the widget doesn't set the
// flag explicitly. Per project_sbm_wrapper_positioning_2026_06_06.
const CLAUDE_MENTION_RE = /\b(claude|anthropic)\b/i;

/** True when the prospect's own words reference Claude / Anthropic. */
export function mentionsClaude(text: string | null | undefined): boolean {
  return typeof text === "string" && CLAUDE_MENTION_RE.test(text);
}

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

  // Tag the comparison-prospect cohort. Trust an explicit widget flag, else
  // infer from the prospect's own words: the intent line plus the user turns
  // of the linked conversation. Best-effort — a turn-read failure never blocks
  // the capture; the explicit flag and intent line still stand.
  let askedAboutClaude = input.askedAboutClaude === true || mentionsClaude(input.intent);
  if (!askedAboutClaude && input.conversationId) {
    try {
      const turns = await getConversationTurns(input.conversationId);
      askedAboutClaude =
        turns?.some((t) => t.role === "user" && mentionsClaude(t.body)) ?? false;
    } catch {
      // Non-fatal — fall back to the explicit flag + intent scan above.
    }
  }

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
          askedAboutClaude,
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
