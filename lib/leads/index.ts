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

import type { Prisma } from "@prisma/client";
import { withSystemContext } from "@/lib/db/rls";
import {
  getConversationTurns,
  markConversationLeadCaptured,
} from "@/lib/plaino/conversation-log";
import {
  assertProvenance,
  buildProvenance,
  type Provenance,
} from "@/lib/provenance/types";
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

  const provenance = buildLeadCaptureProvenance(input);

  let leadId: string;
  try {
    leadId = await withSystemContext(async (tx) => {
      const row = await createLeadCaptureRow(tx, {
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
        provenance,
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

/**
 * Provenance for one captured lead.
 *
 * Every lead here is the PROSPECT typing their own details into the
 * widget — that is `customer-chat` / `customer` origin at confidence 1,
 * because nothing about the row was inferred. `verified: false` because
 * nobody has confirmed the email is real or the intent is serious; that
 * happens in operator triage at /operator/leads.
 *
 * The citation degrades honestly, best pointer first:
 *   1. the conversation the lead came out of, when the widget linked one
 *   2. the marketing route they submitted from
 *   3. a bare marker — the form was posted with neither, and saying so
 *      beats inventing a source.
 */
export function buildLeadCaptureProvenance(
  input: Pick<LeadCaptureInput, "conversationId" | "sourcePage">,
  now?: Date,
): Provenance {
  const sourceRef = input.conversationId
    ? `PlainoConversation:${input.conversationId}`
    : (input.sourcePage ?? "LeadCapture:direct");
  return buildProvenance({
    sourceType: "customer-chat",
    origin: "customer",
    recordType: "lead",
    sourceRef,
    storedBy: "plaino-widget",
    confidence: 1,
    verified: false,
    now,
  });
}

/**
 * The LeadCapture write door. Exported (rather than inlined) so the
 * rejection path is testable against a stub tx: a bad block must throw
 * BEFORE the create, leaving no half-written lead behind.
 */
export async function createLeadCaptureRow(
  tx: Prisma.TransactionClient,
  args: {
    data: Prisma.LeadCaptureUncheckedCreateInput;
    provenance: Provenance;
  },
): Promise<{ id: string }> {
  const provenance = assertProvenance("lead", args.provenance);
  return tx.leadCapture.create({
    data: {
      ...args.data,
      provenance: provenance as unknown as Prisma.InputJsonObject,
    },
    select: { id: true },
  });
}

export { leadCaptureSchema } from "./types";
export type { LeadCaptureInput, LeadCaptureSubmitResult } from "./types";
