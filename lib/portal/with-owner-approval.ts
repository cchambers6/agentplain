/**
 * lib/portal/with-owner-approval.ts
 *
 * The owner-approval gate for OUTGOING client-portal messages — every message
 * Plaino wants to send to the SMB owner's END client (through the branded
 * portal at app/portal/[customerSlug]) must clear this gate first. It mirrors
 * the DocuSign send/void gate (lib/integrations/docusign-mcp/with-approval.ts):
 * a mutating outbound action that never fires from an autonomous run without an
 * explicit, recorded human approval.
 *
 * Why this exists (project_no_outbound_architecture.md): agents draft; the
 * customer's own system — here, the owner via /approvals — decides what reaches
 * a third party. A portal message goes from the owner's brand to the owner's
 * client; the owner must see and approve it before the client ever does.
 *
 * The gate is a PORT with two implementations (feedback_runner_portability):
 * the Prisma gate (owner-approval-gate-prisma.ts) writes the real
 * WorkApprovalQueueItem queue the owner approves on /approvals; the in-memory
 * gate (owner-approval-gate-memory.ts) backs the unit tests. This file imports
 * neither — it only defines the port, the action shape, the fingerprint, and
 * the decision constructors.
 *
 * The grant is bound to the EXACT message by a fingerprint (thread + recipient
 * + body), so an approval for one reply can never be replayed to deliver a
 * different one to a different client. Visibility to the client is ultimately
 * decided by the linked approval row's live status (see
 * lib/portal/chat.ts#visibleMessages) — this gate is how that row is created
 * and re-checked.
 */

import { createHash } from "node:crypto";

/**
 * A message Plaino proposes to send to one end client. `pendingApprovalId` is
 * absent on the first attempt (the gate then opens a PENDING request and names
 * it); it is carried forward on any later re-check.
 */
export interface PortalOutgoingMessage {
  /** Thread the message belongs to (PortalThread.id). */
  threadId: string;
  /** Recipient end-client email — shown on the owner's approval card. */
  toClientEmail: string;
  /** The drafted reply body (plaintext, pre-encryption). */
  body: string;
  /** Approval token carried on a re-check; absent on first attempt. */
  pendingApprovalId?: string;
}

/** A validated, owner-approved, unexpired grant. */
export interface OwnerApprovalGrant {
  pendingApprovalId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
}

/**
 * The gate's answer. `ok:true` ONLY when an approved, unexpired,
 * fingerprint-matching grant exists. Every other state (just opened a request,
 * still pending, rejected, expired, action changed) returns `ok:false` with the
 * pendingApprovalId the owner must act on (when one can be named).
 */
export type OwnerApprovalDecision =
  | { ok: true; grant: OwnerApprovalGrant }
  | { ok: false; pendingApprovalId: string | null; message: string };

/** The persistence port. */
export interface OwnerApprovalGate {
  check(args: {
    workspaceId: string;
    portalConfigId: string;
    action: PortalOutgoingMessage;
  }): Promise<OwnerApprovalDecision>;
}

/**
 * A stable hash binding a grant to the exact message approved — recomputed at
 * delivery time and compared to the stored fingerprint. Email is lowercased so
 * casing drift doesn't break a legitimate match; body is included verbatim so
 * an edited draft is treated as a new, separately-approved message.
 */
export function fingerprintPortalMessage(action: PortalOutgoingMessage): string {
  const canonical = {
    threadId: action.threadId,
    toClientEmail: action.toClientEmail.trim().toLowerCase(),
    body: action.body,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function approvalRequired(
  message: string,
  pendingApprovalId: string | null,
): OwnerApprovalDecision {
  return { ok: false, pendingApprovalId, message };
}

export function approvalGranted(grant: OwnerApprovalGrant): OwnerApprovalDecision {
  return { ok: true, grant };
}

/**
 * The single source of truth for "may this PLAINO message be shown to the end
 * client?" — true ONLY when the gating approval row is APPROVED. A CLIENT
 * message has no gate (the client wrote it) and is always visible. Used by both
 * the read path (lib/portal/chat.ts) and the gate's tests so the invariant is
 * defined in exactly one place.
 */
export function isPortalMessageVisibleToClient(args: {
  sender: "CLIENT" | "OWNER" | "PLAINO";
  approvalStatus: string | null;
}): boolean {
  if (args.sender === "CLIENT") return true;
  // OWNER + PLAINO messages are only visible once the owner has approved.
  return args.approvalStatus === "APPROVED";
}
