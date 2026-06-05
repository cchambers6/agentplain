/**
 * lib/support/prisma-resolve-store.ts
 *
 * Production bindings for the support-reply resolution ports in
 * lib/support/resolve-reply.ts:
 *
 *   - PrismaSupportReplyStore        — loads the pending draft + request
 *     context, and atomically records the operator's APPROVE / REJECT
 *     decision (queue item + SupportRequest + audit row in one tx).
 *   - InngestSupportResolvedEventSink — emits the analytics resolved event.
 *
 * Per feedback_no_silent_vendor_lock.md: the skill + the resolve-reply core
 * never see Prisma or Inngest. They see the ports. These bindings are the
 * one place the vendor SDKs are wired in.
 *
 * RLS: all reads/writes go through withSystemContext (operator tier). The
 * operator action authenticates the human first (requireUser + isOperator)
 * and passes the operator's userId down; the DB context itself is the
 * system-operator grant the rest of the operator surfaces use.
 */

import type { Prisma } from "@prisma/client";
import { withSystemContext } from "../db/rls";
import { decryptPayloadForRead } from "../security/payload-crypto";
import { inngest } from "../inngest/client";
import {
  SUPPORT_REQUEST_RESOLVED_EVENT,
  type SupportReplyDraftContext,
  type SupportReplyStore,
  type SupportRequestResolvedEventData,
  type SupportResolvedEventSink,
} from "./resolve-reply";

/** The approval-queue kind the support-handler skill writes. Must match
 *  lib/skills/support-handler/prisma-approval-sink.ts. */
const SUPPORT_REPLY_KIND = "SUPPORT_HANDLER_REPLY_DRAFT" as const;

export class PrismaSupportReplyStore implements SupportReplyStore {
  readonly name = "prisma" as const;

  async loadDraftContext(
    queueItemId: string,
  ): Promise<SupportReplyDraftContext | null> {
    return withSystemContext(async (tx) => {
      const item = await tx.workApprovalQueueItem.findUnique({
        where: { id: queueItemId },
        select: {
          id: true,
          kind: true,
          status: true,
          workspaceId: true,
          refTable: true,
          refId: true,
          payload: true,
        },
      });
      if (!item || item.kind !== SUPPORT_REPLY_KIND) return null;

      const request = await tx.supportRequest.findUnique({
        where: { id: item.refId },
        select: {
          id: true,
          status: true,
          subject: true,
          fromUser: { select: { email: true } },
        },
      });
      if (!request) return null;

      const decoded = decodePayload(item.payload);
      return {
        queueItemId: item.id,
        queueItemStatus: item.status,
        workspaceId: item.workspaceId,
        supportRequestId: request.id,
        supportRequestStatus: request.status,
        customerEmail: request.fromUser?.email ?? null,
        subject: decoded.subject ?? defaultSubject(request.subject),
        draftBody: decoded.body ?? "",
        confidence: decoded.confidence,
        citationCount: decoded.citationCount,
      };
    });
  }

  async recordResolved(args: {
    queueItemId: string;
    workspaceId: string;
    supportRequestId: string;
    operatorUserId: string;
    sentSubject: string;
    sentBody: string;
    emailMessageId: string | null;
  }): Promise<void> {
    await withSystemContext(async (tx) => {
      await tx.workApprovalQueueItem.update({
        where: { id: args.queueItemId },
        data: {
          status: "APPROVED",
          decidedAt: new Date(),
          decidedByUserId: args.operatorUserId,
          decisionReason: "approved + sent via /operator/support",
        },
      });
      await tx.supportRequest.update({
        where: { id: args.supportRequestId },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: args.operatorUserId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: args.operatorUserId,
          workspaceId: args.workspaceId,
          action: "support_reply.approved_sent",
          targetTable: "SupportRequest",
          targetId: args.supportRequestId,
          payload: {
            queueItemId: args.queueItemId,
            subject: args.sentSubject,
            emailMessageId: args.emailMessageId,
            bodyChars: args.sentBody.length,
          } satisfies Prisma.InputJsonValue,
        },
      });
    });
  }

  async recordRejected(args: {
    queueItemId: string;
    workspaceId: string;
    supportRequestId: string;
    operatorUserId: string;
    reason: string | null;
  }): Promise<void> {
    await withSystemContext(async (tx) => {
      await tx.workApprovalQueueItem.update({
        where: { id: args.queueItemId },
        data: {
          status: "REJECTED",
          decidedAt: new Date(),
          decidedByUserId: args.operatorUserId,
          decisionReason: args.reason ?? "rejected via /operator/support",
        },
      });
      // The draft is archived; the request returns to OPEN for manual
      // handling — unless it was already RESOLVED by another path.
      const request = await tx.supportRequest.findUnique({
        where: { id: args.supportRequestId },
        select: { status: true },
      });
      if (request && request.status !== "RESOLVED") {
        await tx.supportRequest.update({
          where: { id: args.supportRequestId },
          data: { status: "OPEN" },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: args.operatorUserId,
          workspaceId: args.workspaceId,
          action: "support_reply.rejected",
          targetTable: "SupportRequest",
          targetId: args.supportRequestId,
          payload: {
            queueItemId: args.queueItemId,
            reason: args.reason,
          } satisfies Prisma.InputJsonValue,
        },
      });
    });
  }
}

export class InngestSupportResolvedEventSink
  implements SupportResolvedEventSink
{
  readonly name = "inngest" as const;

  async emitResolved(data: SupportRequestResolvedEventData): Promise<void> {
    await inngest.send({ name: SUPPORT_REQUEST_RESOLVED_EVENT, data });
  }
}

interface DecodedPayload {
  subject: string | null;
  body: string | null;
  confidence: string | null;
  citationCount: number;
}

function decodePayload(raw: unknown): DecodedPayload {
  const decrypted = decryptPayloadForRead(raw);
  if (!decrypted || typeof decrypted !== "object") {
    return { subject: null, body: null, confidence: null, citationCount: 0 };
  }
  const p = decrypted as Record<string, unknown>;
  const citations = Array.isArray(p.citations) ? p.citations : [];
  return {
    subject: typeof p.subject === "string" ? p.subject : null,
    body: typeof p.body === "string" ? p.body : null,
    confidence: typeof p.confidence === "string" ? p.confidence : null,
    citationCount: citations.length,
  };
}

function defaultSubject(original: string): string {
  const trimmed = original.trim();
  if (/^re:/i.test(trimmed)) return trimmed;
  return `Re: ${trimmed}`;
}
