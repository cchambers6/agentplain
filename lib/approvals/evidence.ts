/**
 * lib/approvals/evidence.ts
 *
 * THE APPROVAL EVIDENCE LEDGER — append-only, discovery-facing.
 *
 * Conner, ratified: "we never send without explicit approval. AND we must
 * save and track every single approval for legal reasons to save our hides
 * if we get sued." This module is that record. It is designed against a
 * document request, not against a dashboard.
 *
 * ---------------------------------------------------------------------------
 * WHY A SECOND TABLE, WHEN AuditLog AND WorkApprovalQueueItem BOTH EXIST
 * ---------------------------------------------------------------------------
 * Neither survives the question "show us what your customer approved".
 *
 *   AuditLog holds NO BODY. `applyApprovalDecisionTx` writes
 *   `payload: { kind, agentSlug }` and nothing else. It proves a decision
 *   happened; it cannot show what was decided.
 *
 *   WorkApprovalQueueItem.payload holds the body, but it is the MUTABLE
 *   PRE-DECISION DRAFT: `editApprovalDraft` rewrites it in place while the
 *   row is PENDING. One column therefore carries both "what was proposed"
 *   and "what was approved", distinguishable only by timing. And the row is
 *   deleted by three reachable paths (see below).
 *
 * The evidence row is a frozen copy taken at the instant of decision, in the
 * decision's own transaction, and it is never updated.
 *
 * ---------------------------------------------------------------------------
 * WHY INSIDE THE TRANSACTION — this is the whole point of the module
 * ---------------------------------------------------------------------------
 * An evidence row written AFTER the decision commits goes missing precisely
 * when the transaction it describes failed and was retried, which is exactly
 * the case a plaintiff will ask about. The recorder therefore takes an
 * already-open `Prisma.TransactionClient` and never opens its own — the same
 * contract `applyApprovalDecisionTx` uses, for the same reason.
 *
 * This is the deliberate opposite of `lib/approvals/executors.ts`, whose
 * criterion A4 keeps executors OUTSIDE the transaction so a failing
 * downstream write cannot revoke a human's decision. Evidence is the case A4
 * explicitly carves out: "If a kind's execution genuinely must be atomic with
 * the decision, it does NOT belong here; it belongs inside
 * `applyApprovalDecisionTx`."
 *
 * ---------------------------------------------------------------------------
 * WHAT IS STORED, AND WHY IT IS THE FULL BODY
 * ---------------------------------------------------------------------------
 * Conner chose the strongest defence over a content-free hash, knowing it
 * means retaining customer content past workspace departure. A hash proves a
 * document was not altered; it cannot produce the document. Discovery asks
 * for the document.
 *
 * We store the PAYLOAD SNAPSHOT, not the rendered card. The card is a pure
 * function of (kind, payload) via renderApprovalPayload, so the snapshot
 * reproduces the card; the reverse is not true. Importing that renderer here
 * would also put an `app/` import inside the transaction path that
 * `decisions.ts` deliberately keeps out — it lazy-imports `./dispatch` for
 * exactly this reason. `approvedBody` is lifted alongside the snapshot so the
 * common question — "what words went out" — is answerable without
 * reconstructing anything.
 *
 * Both are encrypted at rest with the same AES-256-GCM envelope the queue
 * item uses (`lib/security/payload-crypto.ts`), so the evidence ledger is not
 * a plaintext copy of data that is ciphertext one table over.
 *
 * ---------------------------------------------------------------------------
 * DECLINES ARE EVIDENCE TOO
 * ---------------------------------------------------------------------------
 * REJECTED rows are recorded with their reason. A refusal is as useful in
 * discovery as a send: it is the evidence that a human was exercising
 * judgement rather than rubber-stamping a queue. A ledger containing only
 * approvals reads, to opposing counsel, exactly like an auto-approver.
 *
 * ---------------------------------------------------------------------------
 * SURVIVING DELETION — verified at origin/main this session
 * ---------------------------------------------------------------------------
 * `ApprovalEvidence.workspaceId` is nullable with `onDelete: SetNull`, the
 * shape `AuditLog` already uses, so the row outlives the workspace. It is
 * additionally absent from every enumerated delete path:
 *
 *   1. lib/customer-files/deletion.ts#tearDownWorkspaceData — deletes
 *      `workApprovalQueueItem` AND `auditLog`. Its file header claims it is
 *      "Callable-only by design — wired to nothing autoexec". THAT PROSE IS
 *      FALSE. Three paths reach it:
 *        a. cron '0 17 * * *' — lib/inngest/functions/
 *           unsupported-vertical-refund-sweep.ts -> closeLeakingWorkspace
 *        b. cron '0 * * * *' — lib/customer-data/teardown-scheduler.ts
 *        c. CUSTOMER ONE-TAP — app/(product)/app/workspace/[id]/guarantee/
 *           actions.ts -> lib/guarantee/walk-away.ts#executeWalkAway ->
 *           lib/guarantee/delete-customer-data.ts. Not a cron. A button.
 *   2. lib/storage/category-purge.ts — deletes approvals
 *      `WHERE status != 'PENDING'`: the decided ones, i.e. the evidence,
 *      from a self-serve settings control.
 *
 * Do not add `approvalEvidence` to either. If a legal-hold or
 * retention-window model later lands, deletion goes through THAT, not
 * through a workspace teardown sweep.
 *
 * ---------------------------------------------------------------------------
 * APPEND-ONLY IS ENFORCED IN THE DATABASE, NOT BY CONVENTION
 * ---------------------------------------------------------------------------
 * The migration installs a BEFORE UPDATE OR DELETE trigger that raises. Not
 * REVOKE: this schema has no GRANT/REVOKE anywhere, the deploy role and the
 * runtime role are not distinguished, and a table owner is not restrained by
 * REVOKE on its own table. There is no update path in this module because
 * there is no update path in the database. A ledger the application can
 * rewrite is not evidence, and a comment saying "do not update this" is not
 * a control.
 */

import type { Prisma, WorkApprovalKind } from "@prisma/client";
import {
  encryptPayloadForWrite,
  decryptPayloadForRead,
} from "@/lib/security/payload-crypto";

/**
 * The three write seams that can move a row into a decided state. Stored on
 * the row so discovery can distinguish "a named human clicked" from "the
 * confidence threshold accepted" from "an agentplain operator resolved a
 * support request" WITHOUT inferring it from a null actor id.
 */
export type ApprovalEvidenceRoute = "human" | "machine" | "operator";

/** The decided states this ledger records. PENDING is not a decision. */
export type ApprovalEvidenceDecision =
  | "APPROVED"
  | "AUTO_APPROVED"
  | "REJECTED";

export interface RecordApprovalEvidenceParams {
  workspaceId: string;
  approvalItemId: string;
  kind: WorkApprovalKind | string;
  agentSlug: string;
  refTable: string;
  refId: string;
  decision: ApprovalEvidenceDecision;
  decisionReason: string | null;
  /** When the human (or threshold) decided. Distinct from sentAt. */
  decidedAt: Date;
  /** NULL on the machine route and on operator-context writes. */
  decidedByUserId: string | null;
  route: ApprovalEvidenceRoute;
  /**
   * The item's payload AS DECIDED. Accepts either the decrypted object or
   * the stored envelope; `decryptPayloadForRead` is idempotent on plain
   * objects, so both call shapes are safe.
   */
  payload: unknown;
}

/** Payload keys that carry the addressee, most-specific first. */
const RECIPIENT_KEYS = ["recipients", "to", "recipient", "toEmail"] as const;
/** Payload keys that carry the sending identity. */
const FROM_KEYS = ["fromAccount", "from", "fromEmail", "sendAsAccount"] as const;
/** Payload keys that carry the approved prose, most-specific first. */
const BODY_KEYS = ["editableBody", "body", "draftBody", "text"] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Discrete recipients only. NEVER parse a humanized display line: per
 * lib/approvals/artifact.ts, `recipientLine` is "To: a@b.com  Re: <subject>"
 * and on reply-draft kinds that subject came from an inbound email a stranger
 * sent — so a stranger could put themselves on the To line by writing an
 * address into their subject.
 */
export function extractRecipients(payload: unknown): string[] {
  const rec = asRecord(payload);
  for (const key of RECIPIENT_KEYS) {
    const value = rec[key];
    if (Array.isArray(value)) {
      const list = value.filter(
        (v): v is string => typeof v === "string" && v.trim() !== "",
      );
      if (list.length > 0) return list;
    }
    if (typeof value === "string" && value.trim() !== "") return [value];
  }
  return [];
}

export function extractFromAccount(payload: unknown): string | null {
  const rec = asRecord(payload);
  for (const key of FROM_KEYS) {
    const value = rec[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

export function extractSubject(payload: unknown): string | null {
  const value = asRecord(payload).subject;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * The approved prose. Returns "" rather than null when no body-shaped field
 * exists — a great many approval kinds are structured, not prose. The payload
 * snapshot is the authoritative record in that case, and "" says "this kind
 * has no body" without pretending the row is incomplete.
 */
export function extractApprovedBody(payload: unknown): string {
  const rec = asRecord(payload);
  for (const key of BODY_KEYS) {
    const value = rec[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return "";
}

/**
 * Did the human change the draft before approving it?
 *
 * `editApprovalDraft` stamps `editedAt` into the payload on every edit and
 * leaves the item PENDING, so the presence of that key on a decided payload
 * is a positive record that the text the human approved is not the text the
 * agent proposed. That distinction is the difference between "our customer
 * reviewed and rewrote this" and "our customer clicked a button", and it is
 * the first thing opposing counsel will probe.
 */
export function extractHumanEdited(payload: unknown): boolean {
  const value = asRecord(payload).editedAt;
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Write one immutable evidence row inside the caller's OPEN transaction.
 *
 * Throws on failure, deliberately. The caller's transaction must roll back:
 * a decision that commits without evidence is the exact failure this table
 * exists to prevent, and swallowing the error here would reintroduce it while
 * making the ledger look complete.
 */
export async function recordApprovalEvidenceTx(
  tx: Prisma.TransactionClient,
  params: RecordApprovalEvidenceParams,
): Promise<void> {
  const payload = asRecord(decryptPayloadForRead(params.payload));

  await tx.approvalEvidence.create({
    data: {
      workspaceId: params.workspaceId,
      approvalItemId: params.approvalItemId,
      kind: String(params.kind),
      agentSlug: params.agentSlug,
      refTable: params.refTable,
      refId: params.refId,
      decision: params.decision,
      decisionReason: params.decisionReason,
      decidedAt: params.decidedAt,
      decidedByUserId: params.decidedByUserId,
      route: params.route,
      humanEdited: extractHumanEdited(payload),
      subject: extractSubject(payload),
      recipients: extractRecipients(payload),
      fromAccount: extractFromAccount(payload),
      approvedBody: encryptPayloadForWrite({
        body: extractApprovedBody(payload),
      }),
      payloadSnapshot: encryptPayloadForWrite(payload),
      // sentAt stays NULL here. Decision time and send time are distinct
      // values by design: the fleet drafts, a human approves, and the
      // customer's own system sends (lib/skills/draft.ts). Stamping sentAt at
      // decision time would assert a send we did not perform and cannot
      // observe. It is filled by whatever later records a confirmed handoff,
      // or it stays NULL and the record honestly says so.
    },
  });
}

/**
 * Read helper for an evidence row's protected body column. Exported so the
 * eventual operator-facing export path has one decryption convention rather
 * than re-deriving the envelope shape at each call site.
 */
export function readApprovedBody(stored: unknown): string {
  const value = asRecord(decryptPayloadForRead(stored)).body;
  return typeof value === "string" ? value : "";
}
