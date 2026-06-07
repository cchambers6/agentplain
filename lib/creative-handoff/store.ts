// CreatorBrief persistence — the operator-only handoff queue.
//
// All reads/writes run under withSystemContext (app.is_operator='true'),
// matching the LeadCapture RLS posture: the table is reachable only by the
// operator clause. The creative router persists DRAFT rows; the operator
// dispatches and decides them at /operator/creative-briefs.
//
// Persistence-only. The packet shape + status machine are the pure modules
// (./packet, ./lifecycle); this file just lands them in Postgres.

import type { CreatorBrief, CreatorBriefKind, CreatorBriefStatus } from "@prisma/client";
import { withSystemContext } from "@/lib/db/rls";
import { canTransition, isAcceptanceDecision } from "./lifecycle";
import { buildBriefPacket, type BuildPacketInput } from "./packet";

export interface CreateBriefInput extends BuildPacketInput {
  title: string;
  /** Why this routed to a human rather than a tool — audit trail. */
  routedReason: string;
  /** Optional workspace the asset is for; omit for platform brand work. */
  workspaceId?: string | null;
  /** The agent slug that authored the brief (e.g. "media-creative-router"). */
  createdByAgent?: string | null;
}

/** Assemble the packet and land a DRAFT brief. Returns the created row. */
export async function createDraftBrief(
  input: CreateBriefInput,
): Promise<CreatorBrief> {
  const packet = buildBriefPacket(input);
  return withSystemContext((tx) =>
    tx.creatorBrief.create({
      data: {
        workspaceId: input.workspaceId ?? null,
        kind: input.kind,
        status: "DRAFT",
        title: input.title,
        packet: packet as unknown as object,
        routedReason: input.routedReason,
        createdByAgent: input.createdByAgent ?? null,
      },
    }),
  );
}

export interface ListBriefsArgs {
  statuses?: CreatorBriefStatus[];
  kind?: CreatorBriefKind;
  take?: number;
}

/** List briefs for the operator queue, newest first. */
export async function listBriefs(
  args: ListBriefsArgs = {},
): Promise<CreatorBrief[]> {
  return withSystemContext((tx) =>
    tx.creatorBrief.findMany({
      where: {
        ...(args.statuses ? { status: { in: args.statuses } } : {}),
        ...(args.kind ? { kind: args.kind } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: args.take ?? 100,
    }),
  );
}

/** Shape stored on the `delivery` JSON column when a creator returns an asset. */
export interface CreatorDelivery {
  /** Where the asset landed — Blob URL / path. */
  assetRef: string;
  /** Optional additional file refs (source files, variants). */
  extraRefs?: string[];
  /** Creator's notes on the delivery. */
  note?: string;
}

export interface TransitionInput {
  briefId: string;
  to: CreatorBriefStatus;
  /** Set when moving DRAFT → BRIEFED: the creator the brief went to. */
  creatorRef?: string | null;
  /** Set when moving BRIEFED → DELIVERED: where the asset landed. */
  delivery?: CreatorDelivery | null;
  /** Operator prose for the acceptance review. */
  reviewNotes?: string | null;
  /** The deciding operator's user id — stamped on acceptance decisions. */
  decidedByUserId?: string | null;
}

export class InvalidBriefTransitionError extends Error {
  readonly briefId: string;
  readonly from: CreatorBriefStatus;
  readonly to: CreatorBriefStatus;
  constructor(briefId: string, from: CreatorBriefStatus, to: CreatorBriefStatus) {
    super(`CreatorBrief ${briefId}: illegal transition ${from} → ${to}`);
    this.name = "InvalidBriefTransitionError";
    this.briefId = briefId;
    this.from = from;
    this.to = to;
  }
}

/** Apply a status transition with the lifecycle guard enforced. Throws
 *  InvalidBriefTransitionError on an illegal move (the operator UI only ever
 *  offers legal moves, but a stale form or an agent caller could try one). */
export async function transitionBrief(
  input: TransitionInput,
): Promise<CreatorBrief> {
  return withSystemContext(async (tx) => {
    const current = await tx.creatorBrief.findUnique({
      where: { id: input.briefId },
    });
    if (!current) {
      throw new InvalidBriefTransitionError(input.briefId, "DRAFT", input.to);
    }
    if (!canTransition(current.status, input.to)) {
      throw new InvalidBriefTransitionError(
        input.briefId,
        current.status,
        input.to,
      );
    }
    const stampDecision = isAcceptanceDecision(current.status, input.to);
    const updated = await tx.creatorBrief.update({
      where: { id: input.briefId },
      data: {
        status: input.to,
        ...(input.creatorRef !== undefined ? { creatorRef: input.creatorRef } : {}),
        ...(input.delivery !== undefined
          ? { delivery: (input.delivery as unknown as object) ?? undefined }
          : {}),
        ...(input.reviewNotes !== undefined ? { reviewNotes: input.reviewNotes } : {}),
        ...(stampDecision
          ? { decidedByUserId: input.decidedByUserId ?? null, decidedAt: new Date() }
          : {}),
      },
    });
    return updated;
  });
}
