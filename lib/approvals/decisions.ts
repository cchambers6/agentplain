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

import type { Prisma } from "@prisma/client";
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

export interface ApplyApprovalDecisionParams {
  workspaceId: string;
  itemId: string;
  decision: ApprovalDecision;
  reason: string | null;
  /**
   * The human this decision is attributed to.
   *
   * Passed EXPLICITLY rather than read off the RLS context, because the
   * two callers do not agree on where the actor lives. The customer
   * surfaces (web + mobile) run under the deciding member's own context,
   * so actor == ctx.userId. The operator support surface
   * (lib/support/prisma-resolve-store.ts) runs under the system-operator
   * RLS grant, where ctx.userId is null and the real actor is the
   * authenticated operator. Parameterising the actor is what lets one
   * function serve both without either lying about who decided.
   */
  actorUserId: string | null;
  /** Merged into the audit row payload. Lets a surface record how the
   *  decision was taken without forking the audit action name. */
  auditPayloadExtra?: Record<string, unknown>;
}

/**
 * What the transition observed on the row.
 *
 * Returned rather than left to the caller to re-read, so that executor
 * dispatch acts on the row AS IT WAS at the instant of the decision. A caller
 * that re-read the row afterwards could pick up a payload some other writer
 * had moved underneath it, and would then execute text the human never saw.
 */
export interface AppliedApprovalDecision {
  kind: string;
  agentSlug: string;
  refTable: string;
  refId: string;
  /** Payload AFTER decryption. */
  payload: Record<string, unknown>;
}

/**
 * THE approval state transition. Every path that moves a
 * WorkApprovalQueueItem out of PENDING must go through here, because this
 * is the only place that pairs the status write with the
 * `work_approval.<decision>` AuditLog row. A surface that flips the status
 * itself produces an approval with no evidence a human decided it, which
 * is the evidentiary basis of the product's standing "agents draft, a
 * human approves" promise.
 *
 * Takes an ALREADY-OPEN transaction rather than opening its own. That is
 * deliberate: the operator support path must update the queue item, the
 * SupportRequest, and the audit row atomically, and it can only do that
 * if this function joins its transaction instead of starting a second
 * one.
 *
 * Throws ApprovalDecisionError(NOT_FOUND | ALREADY_DECIDED).
 *
 * CONCURRENCY -- read this before changing the update below.
 * ---------------------------------------------------------
 * The PENDING guard is enforced by the WHERE CLAUSE OF THE UPDATE ITSELF,
 * not by the `findFirst` above it. That is the whole mechanism, and it is
 * not interchangeable with a read-then-write.
 *
 * `isolationLevel` appears nowhere in this repo, so every transaction here
 * runs at Postgres' default READ COMMITTED. Under READ COMMITTED a
 * read-then-write does NOT serialise two concurrent decisions:
 *
 *   T1 findFirst -> PENDING          T2 findFirst -> PENDING
 *   T1 update, commit                T2 update blocks on the row lock
 *                                    T2 re-reads the NEW row version and
 *                                    APPLIES ANYWAY, because the status it
 *                                    checked came from its own earlier
 *                                    snapshot and is never re-evaluated.
 *
 * Result: two `work_approval.*` audit rows, and the second decision
 * silently overwrites the first. An approve and a reject arriving together
 * meant whichever committed last won, with a full audit trail for both.
 *
 * A conditional `updateMany` closes it WITHOUT needing a stricter isolation
 * level, because that is precisely what READ COMMITTED promises for a
 * single statement: when an UPDATE blocks on a concurrently-locked row, it
 * re-evaluates its WHERE clause against the updated row version once the
 * lock is released. The losing transaction therefore matches zero rows and
 * `count` is 0. `SELECT ... FOR UPDATE` would also work; the conditional
 * update is one statement instead of two and cannot be separated from the
 * write it guards by a later edit.
 *
 * The `findFirst` remains ONLY to distinguish NOT_FOUND from
 * ALREADY_DECIDED and to carry the row's payload out to the caller for
 * executor dispatch. It is not the guard. Do not "simplify" it back into
 * one by dropping `status` from the update's WHERE.
 */
export async function applyApprovalDecisionTx(
  tx: Prisma.TransactionClient,
  params: ApplyApprovalDecisionParams,
): Promise<AppliedApprovalDecision> {
  if (!VALID_DECISIONS.includes(params.decision)) {
    throw new ApprovalDecisionError("INVALID", `Invalid decision: ${params.decision}`);
  }

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

  // THE guard. `status: "PENDING"` in the WHERE is load-bearing -- see the
  // CONCURRENCY note above. Scoped by workspaceId as well as id so a
  // mismatched pair can never write across a tenant boundary even if RLS
  // were somehow absent.
  const { count } = await tx.workApprovalQueueItem.updateMany({
    where: {
      id: params.itemId,
      workspaceId: params.workspaceId,
      status: "PENDING",
    },
    data: {
      status: params.decision,
      decidedAt: new Date(),
      decidedByUserId: params.actorUserId,
      decisionReason: params.reason,
    },
  });

  // count === 0 means a concurrent transaction decided this row between our
  // findFirst and our update. The loser throws, its whole transaction rolls
  // back, and no second audit row is written.
  if (count !== 1) {
    throw new ApprovalDecisionError(
      "ALREADY_DECIDED",
      "Item was decided concurrently by another request",
    );
  }

  await tx.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      workspaceId: params.workspaceId,
      action: `work_approval.${params.decision.toLowerCase()}`,
      targetTable: "WorkApprovalQueueItem",
      targetId: params.itemId,
      payload: {
        kind: item.kind,
        agentSlug: item.agentSlug,
        ...(params.auditPayloadExtra ?? {}),
      },
    },
  });

  const decrypted = decryptPayloadForRead(item.payload);
  const payload =
    decrypted && typeof decrypted === "object" && !Array.isArray(decrypted)
      ? (decrypted as Record<string, unknown>)
      : {};

  return {
    kind: item.kind,
    agentSlug: item.agentSlug,
    refTable: item.refTable,
    refId: item.refId,
    payload,
  };
}

export interface DecideApprovalParams {
  workspaceId: string;
  itemId: string;
  decision: ApprovalDecision;
  reason?: string | null;
}

export interface DecideApprovalOptions {
  /**
   * Executor dependencies. Omitted in production, where the default
   * Prisma/renderer-backed deps are built lazily. Pass `null` to disable
   * dispatch entirely -- used by tests that are asserting the decision write
   * and nothing else.
   */
  executorDeps?: import("./executors").ApprovalExecutorDeps | null;
}

/**
 * Approve or reject a pending item. Writes the decision + an audit row, and
 * (on reject-with-reason) captures a preference signal.
 *
 * ON APPROVE, THIS NOW EXECUTES. Before, `decideApproval` had no APPROVED
 * branch at all: approving set a status, wrote an audit row, and produced
 * nothing the customer could use. See lib/approvals/executors.ts.
 *
 * The executor dispatch runs AFTER the transaction commits, deliberately
 * OUTSIDE it, and cannot throw. On this path there is a prior human act to
 * protect: the customer clicked approve and watched it succeed. A failing
 * executor that rolled the transaction back would leave the screen saying
 * yes and the database saying no -- strictly worse than a missing artifact.
 * That is the same trade the `captureDraftRejectSignal` site below has always
 * made, and this follows its shape (warn + continue) rather than inventing a
 * second convention for the same problem.
 *
 * The machine path in lib/skills/persist-artifacts.ts makes the OPPOSITE
 * trade for a reason stated there: it has no prior human act to protect.
 */
export async function decideApproval(
  ctx: RlsContext,
  params: DecideApprovalParams,
  options: DecideApprovalOptions = {},
): Promise<void> {
  const reason = params.reason ?? null;

  const applied = await withRls(ctx, (tx) =>
    applyApprovalDecisionTx(tx, {
      workspaceId: params.workspaceId,
      itemId: params.itemId,
      decision: params.decision,
      reason,
      // Customer surfaces decide as themselves, so the actor IS the RLS
      // identity here. The operator support path is the case that is not.
      actorUserId: ctx.userId,
    }),
  );

  if (params.decision === "APPROVED" && options.executorDeps !== null) {
    // Never throws. See lib/approvals/dispatch.ts.
    const { dispatchApprovalExecutors } = await import("./dispatch");
    await dispatchApprovalExecutors(ctx, {
      workspaceId: params.workspaceId,
      itemId: params.itemId,
      applied,
      actorUserId: ctx.userId,
      route: "human",
      status: "APPROVED",
      deps: options.executorDeps,
    });
  }

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

    // Conditional, for the same reason applyApprovalDecisionTx is: the
    // findFirst above is a READ COMMITTED snapshot, so without `status` in
    // this WHERE an edit racing an approve would rewrite the body of an
    // item that had already been approved -- changing the text after the
    // human authorized it, which is the one thing an approval record must
    // never allow.
    const { count } = await tx.workApprovalQueueItem.updateMany({
      where: {
        id: params.itemId,
        workspaceId: params.workspaceId,
        status: "PENDING",
      },
      data: { payload: encryptPayloadForWrite(next) },
    });
    if (count !== 1) {
      throw new ApprovalDecisionError(
        "ALREADY_DECIDED",
        "Item was decided concurrently by another request",
      );
    }

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
