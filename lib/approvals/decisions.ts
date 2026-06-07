// Shared approval-decision core.
//
// The web /approvals page (server actions) and the native app (mobile JSON
// routes) drive the SAME decisions: approve, reject, edit a draft, or flag
// "doesn't sound like us". Both surfaces funnel through these functions so
// the audit trail, the preference-signal capture (the closed-loop substrate),
// and the encrypt-on-write of edited drafts can never drift between web and
// mobile.
//
// These take an already-resolved RLS context (the caller has run its own
// membership gate — requireWorkspaceMember on web, requireMobileWorkspaceMember
// on mobile) and do the durable work only. Surface concerns (FormData parsing,
// revalidatePath/redirect, JSON responses) stay in the callers.

import { withRls, type RlsContext } from "@/lib/db";
import {
  captureDraftEditSignal,
  captureDraftRejectSignal,
} from "@/lib/preferences";
import { appendLearnedDraftNote } from "@/lib/preferences/store";
import {
  LEARNED_NOTES_CAP,
  LEARNED_NOTE_MAX_CHARS,
} from "@/lib/preferences/types";
import {
  recordPreferenceFeedback,
  CATEGORY_DESCRIPTION,
  type FeedbackCategory,
} from "@/lib/feedback";
import {
  decryptPayloadForRead,
  encryptPayloadForWrite,
} from "@/lib/security/payload-crypto";

export const VALID_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type ApprovalDecision = (typeof VALID_DECISIONS)[number];

/** Typed error so callers map to the right status/redirect. */
export type ApprovalErrorCode =
  | "NOT_FOUND"
  | "ALREADY_DECIDED"
  | "INVALID"
  | "TOO_LONG";

export class ApprovalDecisionError extends Error {
  readonly code: ApprovalErrorCode;
  constructor(code: ApprovalErrorCode, message: string) {
    super(message);
    this.name = "ApprovalDecisionError";
    this.code = code;
  }
}

const DRAFT_BODY_MAX = 50_000;

function clipNote(s: string): string {
  if (s.length <= LEARNED_NOTE_MAX_CHARS) return s;
  return s.slice(0, LEARNED_NOTE_MAX_CHARS - 1).trimEnd() + "…";
}

export interface DecideApprovalParams {
  workspaceId: string;
  itemId: string;
  decision: ApprovalDecision;
  reason?: string | null;
}

/**
 * Approve or reject a pending item. Writes the decision + an audit row, and
 * (on reject-with-reason) captures a preference signal so the next draft
 * reflects the pushback.
 */
export async function decideApproval(
  ctx: RlsContext,
  params: DecideApprovalParams,
): Promise<void> {
  if (!VALID_DECISIONS.includes(params.decision)) {
    throw new ApprovalDecisionError("INVALID", `Invalid decision: ${params.decision}`);
  }
  const reason = params.reason ?? null;

  await withRls(ctx, async (tx) => {
    const item = await tx.workApprovalQueueItem.findFirst({
      where: { id: params.itemId, workspaceId: params.workspaceId },
    });
    if (!item) throw new ApprovalDecisionError("NOT_FOUND", "Item not found");
    if (item.status !== "PENDING") {
      throw new ApprovalDecisionError(
        "ALREADY_DECIDED",
        `Item already decided (${item.status})`,
      );
    }

    await tx.workApprovalQueueItem.update({
      where: { id: params.itemId },
      data: {
        status: params.decision,
        decidedAt: new Date(),
        decidedByUserId: ctx.userId,
        decisionReason: reason,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: ctx.userId,
        workspaceId: params.workspaceId,
        action: `work_approval.${params.decision.toLowerCase()}`,
        targetTable: "WorkApprovalQueueItem",
        targetId: params.itemId,
        payload: { kind: item.kind, agentSlug: item.agentSlug },
      },
    });
  });

  if (params.decision === "REJECTED" && reason && reason.trim().length > 0) {
    try {
      await captureDraftRejectSignal(ctx, {
        workspaceId: params.workspaceId,
        approvalItemId: params.itemId,
        reason,
      });
    } catch (err) {
      console.warn(
        `captureDraftRejectSignal failed (ignored): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

export interface EditApprovalParams {
  workspaceId: string;
  itemId: string;
  body: string;
}

/**
 * Replace a pending draft's body (re-encrypted on write), audit it, and
 * capture the edit as a preference signal. The item stays PENDING — editing
 * is not a decision.
 */
export async function editApprovalDraft(
  ctx: RlsContext,
  params: EditApprovalParams,
): Promise<void> {
  if (params.body.length > DRAFT_BODY_MAX) {
    throw new ApprovalDecisionError("TOO_LONG", "Draft body too long");
  }

  let originalBody = "";
  await withRls(ctx, async (tx) => {
    const item = await tx.workApprovalQueueItem.findFirst({
      where: { id: params.itemId, workspaceId: params.workspaceId },
    });
    if (!item) throw new ApprovalDecisionError("NOT_FOUND", "Item not found");
    if (item.status !== "PENDING") {
      throw new ApprovalDecisionError(
        "ALREADY_DECIDED",
        `Item already decided (${item.status})`,
      );
    }

    const decrypted = decryptPayloadForRead(item.payload);
    const existing =
      decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)
        ? (decrypted as Record<string, unknown>)
        : {};
    if (typeof existing.body === "string") originalBody = existing.body;
    const next = {
      ...existing,
      body: params.body,
      editedAt: new Date().toISOString(),
    };

    await tx.workApprovalQueueItem.update({
      where: { id: params.itemId },
      data: { payload: encryptPayloadForWrite(next) },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: ctx.userId,
        workspaceId: params.workspaceId,
        action: "work_approval.edited",
        targetTable: "WorkApprovalQueueItem",
        targetId: params.itemId,
        payload: { kind: item.kind, agentSlug: item.agentSlug },
      },
    });
  });

  try {
    await captureDraftEditSignal(ctx, {
      workspaceId: params.workspaceId,
      approvalItemId: params.itemId,
      originalBody,
      finalBody: params.body,
    });
  } catch (err) {
    console.warn(
      `captureDraftEditSignal failed (ignored): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export interface DraftFeedbackParams {
  workspaceId: string;
  approvalItemId: string;
  targetSkillSlug: string;
  category: FeedbackCategory;
  reason: string;
}

/**
 * Capture categorized "doesn't sound like us" feedback. Does NOT decide the
 * item — the draft stays in the queue. Persists a PreferenceFeedback row,
 * appends a learnedDraftNote so the next draft reflects the correction, and
 * audits it.
 */
export async function submitDraftFeedback(
  ctx: RlsContext,
  params: DraftFeedbackParams,
): Promise<void> {
  // Snapshot the draft body (best-effort) so a future learner can re-derive
  // richer notes.
  let originalDraft: string | null = null;
  await withRls(ctx, async (tx) => {
    const item = await tx.workApprovalQueueItem.findFirst({
      where: { id: params.approvalItemId, workspaceId: params.workspaceId },
      select: { payload: true },
    });
    if (item) {
      const decrypted = decryptPayloadForRead(item.payload);
      if (
        decrypted &&
        typeof decrypted === "object" &&
        !Array.isArray(decrypted) &&
        typeof (decrypted as Record<string, unknown>).body === "string"
      ) {
        originalDraft = (decrypted as Record<string, string>).body;
      }
    }
  });

  if (!ctx.userId) {
    throw new ApprovalDecisionError("INVALID", "feedback requires a user");
  }

  await recordPreferenceFeedback(ctx, {
    workspaceId: params.workspaceId,
    userId: ctx.userId,
    targetSkillSlug: params.targetSkillSlug,
    category: params.category,
    reason: params.reason,
    originalDraft,
  });

  const note = clipNote(
    `Customer flagged a ${params.targetSkillSlug} draft — ${CATEGORY_DESCRIPTION[params.category]}: ${params.reason}`,
  );
  try {
    await appendLearnedDraftNote(ctx, {
      workspaceId: params.workspaceId,
      note,
      cap: LEARNED_NOTES_CAP,
    });
  } catch (err) {
    console.warn(
      `appendLearnedDraftNote (feedback) failed (ignored): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  await withRls(ctx, async (tx) => {
    await tx.auditLog.create({
      data: {
        actorUserId: ctx.userId,
        workspaceId: params.workspaceId,
        action: "draft_feedback.captured",
        targetTable: "WorkApprovalQueueItem",
        targetId: params.approvalItemId,
        payload: { category: params.category, targetSkillSlug: params.targetSkillSlug },
      },
    });
  });
}
