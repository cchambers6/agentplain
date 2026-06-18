/**
 * lib/portal/owner-approval-gate-prisma.ts
 *
 * Production OwnerApprovalGate — backs the gate with the real
 * WorkApprovalQueueItem queue the owner reviews on /approvals (kind
 * PORTAL_CLIENT_MESSAGE). When Plaino drafts a reply to an end client, this
 * gate persists a PENDING row carrying the (encrypted) draft so the owner sees
 * exactly what would be sent, and returns `ok:false` naming it. The owner
 * approves on /approvals (the existing decideApprovalAction flips it APPROVED);
 * the portal then shows the message to the client (lib/portal/chat.ts gates
 * visibility on the row's live status).
 *
 * Mirrors lib/integrations/docusign-mcp/approval-gate-prisma.ts exactly:
 * fingerprint-bound, 24h-TTL grants, encrypted payload, find-or-create dedupe,
 * NEVER auto-approved (a message to a customer's client always demands a
 * human). Rows are written PENDING directly — applyApprovalThreshold is never
 * consulted.
 */

import type { Prisma } from "@prisma/client";
import { withSystemContext } from "@/lib/db/rls";
import {
  decryptPayloadForRead,
  encryptPayloadForWrite,
} from "@/lib/security/payload-crypto";
import {
  approvalGranted,
  approvalRequired,
  fingerprintPortalMessage,
  type OwnerApprovalDecision,
  type OwnerApprovalGate,
  type PortalOutgoingMessage,
} from "./with-owner-approval";

/** A portal-message approval is honored for 24h after the owner decides. */
export const PORTAL_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

const AGENT_SLUG = "portal-owner-approval-gate";
const REF_TABLE = "PortalMessage";
/** Client communications — surfaced under the customer-success discipline. */
const DISCIPLINE = "customer-success";
const KIND = "PORTAL_CLIENT_MESSAGE" as const;

function buildPayload(action: PortalOutgoingMessage, fingerprint: string): unknown {
  return {
    type: "portal_message",
    fingerprint,
    threadId: action.threadId,
    toClientEmail: action.toClientEmail,
    body: action.body,
  };
}

function fingerprintFromPayload(payload: Prisma.JsonValue): string | null {
  const decrypted = decryptPayloadForRead(payload);
  if (!decrypted || typeof decrypted !== "object" || Array.isArray(decrypted)) {
    return null;
  }
  const fp = (decrypted as Record<string, unknown>).fingerprint;
  return typeof fp === "string" ? fp : null;
}

export interface PrismaPortalApprovalGateOptions {
  now?: () => number;
}

export class PrismaPortalApprovalGate implements OwnerApprovalGate {
  private readonly now: () => number;

  constructor(options: PrismaPortalApprovalGateOptions = {}) {
    this.now = options.now ?? Date.now;
  }

  async check(args: {
    workspaceId: string;
    portalConfigId: string;
    action: PortalOutgoingMessage;
  }): Promise<OwnerApprovalDecision> {
    const { workspaceId, action } = args;
    const fingerprint = fingerprintPortalMessage(action);

    return withSystemContext(async (tx) => {
      // 1. A token was presented — try to honor an existing approval.
      if (action.pendingApprovalId) {
        const row = await tx.workApprovalQueueItem.findFirst({
          where: { id: action.pendingApprovalId, workspaceId, kind: KIND },
        });
        if (row && row.status === "APPROVED") {
          if (fingerprintFromPayload(row.payload) !== fingerprint) {
            return approvalRequired(
              `Portal message approval ${row.id} was granted for a different message — re-request approval.`,
              row.id,
            );
          }
          const decidedMs = row.decidedAt ? row.decidedAt.getTime() : null;
          const expiresMs =
            decidedMs !== null ? decidedMs + PORTAL_APPROVAL_TTL_MS : null;
          if (expiresMs !== null && this.now() > expiresMs) {
            await tx.workApprovalQueueItem.update({
              where: { id: row.id },
              data: { status: "EXPIRED" },
            });
            return approvalRequired(
              `Portal message approval ${row.id} expired — re-request approval.`,
              row.id,
            );
          }
          return approvalGranted({
            pendingApprovalId: row.id,
            approvedByUserId: row.decidedByUserId,
            approvedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
            expiresAt: expiresMs !== null ? new Date(expiresMs).toISOString() : null,
          });
        }
        if (row && row.status === "PENDING") {
          return approvalRequired(
            `Portal message approval ${row.id} is still awaiting your decision.`,
            row.id,
          );
        }
        // Rejected / expired / not found — fall through and (re)open a request.
      }

      // 2. No valid grant — find-or-create the PENDING request for THIS message
      //    (deduped by fingerprint so repeated drafts don't pile up rows).
      const existing = await tx.workApprovalQueueItem.findFirst({
        where: { workspaceId, kind: KIND, refId: fingerprint, status: "PENDING" },
      });
      if (existing) {
        return approvalRequired(
          "This message to your client needs your approval before it's sent.",
          existing.id,
        );
      }
      const created = await tx.workApprovalQueueItem.create({
        data: {
          workspaceId,
          agentSlug: AGENT_SLUG,
          kind: KIND,
          refTable: REF_TABLE,
          refId: fingerprint,
          discipline: DISCIPLINE,
          status: "PENDING",
          payload: encryptPayloadForWrite(buildPayload(action, fingerprint)),
        },
        select: { id: true },
      });
      return approvalRequired(
        "This message to your client needs your approval before it's sent.",
        created.id,
      );
    });
  }
}
