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
 * RLS: all reads/writes go through `withOperatorContext` (operator tier).
 * The operator action authenticates the human first (requireUser +
 * isOperator) and passes the operator's userId down; the DB context itself
 * is the system-operator grant the rest of the operator surfaces use.
 * Because the DB identity and the deciding human are therefore DIFFERENT,
 * every decision write passes the operator id as an explicit actor rather
 * than letting the shared approval core read it off the RLS context.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { SYSTEM_OPERATOR_CONTEXT, withRls } from "../db/rls";
import { applyApprovalDecisionTx } from "../approvals/decisions";
import { dispatchApprovalExecutors } from "../approvals/dispatch";
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
  private readonly client: PrismaClient | undefined;

  /** `client` is an injection seam only. Production constructs this with
   *  no arguments and gets the shared singleton, exactly as before. It
   *  exists because these three methods are the audited write path and
   *  had no way to be exercised without a live database. */
  constructor(config: { client?: PrismaClient } = {}) {
    this.client = config.client;
  }

  /** Operator tier: the human is authenticated upstream (requireUser +
   *  isOperator) and their id is carried as an explicit actor argument;
   *  the DB grant itself is the system-operator context. */
  private withOperatorContext<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return withRls(SYSTEM_OPERATOR_CONTEXT, fn, { client: this.client });
  }

  async loadDraftContext(
    queueItemId: string,
  ): Promise<SupportReplyDraftContext | null> {
    return this.withOperatorContext(async (tx) => {
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
    const applied = await this.withOperatorContext(async (tx) => {
      // Route the PENDING -> APPROVED transition through the shared
      // approval core rather than flipping the status here. Two things
      // come with it that this path previously lacked:
      //
      //   1. a `work_approval.approved` AuditLog row keyed to
      //      (WorkApprovalQueueItem, queueItemId). The
      //      `support_reply.approved_sent` row written below is keyed to
      //      the SupportRequest, so every consumer that reads the
      //      approval-decision stream by its own target shape saw
      //      nothing for this path.
      //   2. an ALREADY_DECIDED guard evaluated INSIDE this transaction.
      //      resolve-reply.ts checks the status too, but it checks it in
      //      a separate earlier transaction, so two concurrent submits
      //      could both read PENDING.
      //
      //      NOTE ON WHAT MAKES THAT GUARD ACTUALLY HOLD. An earlier
      //      version of this comment claimed the in-transaction check was
      //      enough on its own. It was not, and the claim survived two
      //      rounds of review. applyApprovalDecisionTx used to do a
      //      `findFirst` then an unconditional `update` by id; under
      //      READ COMMITTED (which is what this runs at -- `isolationLevel`
      //      appears nowhere in this repo) both transactions read PENDING,
      //      the second blocked on the row lock, re-read the new version
      //      and applied ANYWAY, because it never re-evaluated status.
      //      Two audit rows, second decision overwriting the first.
      //      The guard holds now because the status predicate moved INTO
      //      the WHERE clause of a conditional updateMany. See the
      //      CONCURRENCY note in lib/approvals/decisions.ts before
      //      changing either side.
      //
      // Throws ApprovalDecisionError; resolve-reply.ts surfaces it as
      // PERSIST_FAILED so the operator sees it rather than a silent
      // double-approve.
      const decided = await applyApprovalDecisionTx(tx, {
        workspaceId: args.workspaceId,
        itemId: args.queueItemId,
        decision: "APPROVED",
        reason: "approved + sent via /operator/support",
        actorUserId: args.operatorUserId,
        auditPayloadExtra: { surface: "operator/support", sent: true },
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
      return decided;
    });

    // SEAM 3 of 3. This path never calls `decideApproval`, so dispatching
    // from there alone would leave every /operator/support approval with no
    // execution -- which is exactly how this surface came to be the one route
    // that already performed an irreversible external action while producing
    // no `work_approval.approved` row.
    //
    // Outside the transaction and non-throwing, like the human path: by the
    // time we get here the reply email has ALREADY been sent to the customer.
    // Rolling back an approval whose side effect is already in someone's
    // inbox would be a lie in the opposite direction.
    await dispatchApprovalExecutors(SYSTEM_OPERATOR_CONTEXT, {
      workspaceId: args.workspaceId,
      itemId: args.queueItemId,
      applied,
      actorUserId: args.operatorUserId,
      route: "operator-support",
      status: "APPROVED",
      // Same injection seam the store itself uses. Without this the dispatch
      // would reach past the injected client to the real Prisma singleton --
      // and because executor failures are swallowed by design, it would fail
      // silently in every test while still looking wired.
      client: this.client,
    });
  }

  async recordRejected(args: {
    queueItemId: string;
    workspaceId: string;
    supportRequestId: string;
    operatorUserId: string;
    reason: string | null;
  }): Promise<void> {
    await this.withOperatorContext(async (tx) => {
      // Same shared core as the approve path. The guard matters here for
      // a second reason: this update was previously unconditional, so a
      // reject arriving after an approve would silently flip an APPROVED
      // item to REJECTED -- rewriting the decision record of a reply the
      // customer had already received.
      //
      // That is now blocked in BOTH orderings, which is the part the
      // original claim glossed. Sequentially, the findFirst catches it.
      // CONCURRENTLY, only the conditional updateMany does -- a reject
      // racing an approve used to read PENDING, block on the lock, and
      // then overwrite the committed APPROVED row.
      await applyApprovalDecisionTx(tx, {
        workspaceId: args.workspaceId,
        itemId: args.queueItemId,
        decision: "REJECTED",
        reason: args.reason ?? "rejected via /operator/support",
        actorUserId: args.operatorUserId,
        auditPayloadExtra: { surface: "operator/support", sent: false },
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
