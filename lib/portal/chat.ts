/**
 * lib/portal/chat.ts
 *
 * End-client ↔ Plaino chat, owner-gated. Two halves:
 *
 *   - loadVisibleMessages(): the READ path the client sees. A CLIENT message is
 *     always shown; a PLAINO (or OWNER) message is shown ONLY when its gating
 *     WorkApprovalQueueItem is APPROVED. Visibility is decided against the
 *     approval row's LIVE status (isPortalMessageVisibleToClient), so a drifted
 *     deliveryStatus column can never leak an unapproved message.
 *
 *   - runPortalChatTurn(): the WRITE path. Persists the client's message,
 *     then — unless Plaino is resting (degraded mode) — drafts a reply and
 *     routes it through the owner-approval gate. The drafted reply is persisted
 *     PENDING_APPROVAL and is invisible to the client until the owner approves
 *     it on /approvals. Nothing reaches the client autonomously
 *     (project_no_outbound_architecture).
 *
 * Message bodies are AES-256-GCM v1 ciphertext at rest, same codec as
 * ChatMessage.body.
 */

import { withSystemContext } from "@/lib/db/rls";
import {
  decrypt,
  encrypt,
  isEncryptionConfigured,
} from "@/lib/security/encryption";
import { checkDegradedMode } from "@/lib/plaino/degraded-mode";
import { getLlmProvider } from "@/lib/llm";
import { PrismaPortalApprovalGate } from "./owner-approval-gate-prisma";
import {
  isPortalMessageVisibleToClient,
  type OwnerApprovalGate,
} from "./with-owner-approval";

export interface VisibleMessage {
  id: string;
  sender: "CLIENT" | "OWNER" | "PLAINO";
  body: string;
  createdAt: Date;
}

/** Decrypt a stored body, degrading to a calm placeholder rather than throwing
 *  (a single corrupt row / missing key must never crash the portal). */
function decodeBody(stored: string): string {
  if (!isEncryptionConfigured()) return "[message unavailable]";
  try {
    return decrypt(stored);
  } catch {
    return "[message unavailable]";
  }
}

/**
 * The messages a client may see in a thread. Filters PLAINO/OWNER messages to
 * those whose linked approval is APPROVED. The authoritative gate is the
 * approval row's status, NOT PortalMessage.deliveryStatus.
 */
export async function loadVisibleMessages(args: {
  portalConfigId: string;
  threadId: string;
}): Promise<VisibleMessage[]> {
  return withSystemContext(async (tx) => {
    const rows = await tx.portalMessage.findMany({
      where: { threadId: args.threadId, portalConfigId: args.portalConfigId },
      orderBy: { createdAt: "asc" },
    });
    const approvalIds = rows
      .map((r) => r.approvalItemId)
      .filter((id): id is string => !!id);
    const statusById = new Map<string, string>();
    if (approvalIds.length > 0) {
      const approvals = await tx.workApprovalQueueItem.findMany({
        where: { id: { in: approvalIds } },
        select: { id: true, status: true },
      });
      for (const a of approvals) statusById.set(a.id, a.status);
    }
    const out: VisibleMessage[] = [];
    for (const r of rows) {
      const approvalStatus = r.approvalItemId
        ? statusById.get(r.approvalItemId) ?? null
        : null;
      if (!isPortalMessageVisibleToClient({ sender: r.sender, approvalStatus })) {
        continue;
      }
      out.push({
        id: r.id,
        sender: r.sender,
        body: decodeBody(r.body),
        createdAt: r.createdAt,
      });
    }
    return out;
  });
}

/**
 * Find-or-create the client's chat thread (optionally scoped to a case). One
 * thread per (client, case) keeps the conversation coherent.
 */
export async function ensurePortalThread(args: {
  portalConfigId: string;
  clientId: string;
  caseId?: string | null;
}): Promise<string> {
  return withSystemContext(async (tx) => {
    const existing = await tx.portalThread.findFirst({
      where: {
        portalConfigId: args.portalConfigId,
        clientId: args.clientId,
        caseId: args.caseId ?? null,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) return existing.id;
    const created = await tx.portalThread.create({
      data: {
        portalConfigId: args.portalConfigId,
        clientId: args.clientId,
        caseId: args.caseId ?? null,
      },
      select: { id: true },
    });
    return created.id;
  });
}

export interface PortalChatContext {
  portalConfigId: string;
  workspaceId: string;
  clientId: string;
  clientEmail: string;
  brandName: string;
  /** Optional case the thread is about — grounds Plaino's reply. */
  caseTitle?: string | null;
  caseStatus?: string | null;
  threadId: string;
}

export type PortalChatTurnResult =
  | { ok: true; pendingApprovalId: string | null }
  | { ok: false; reason: "DEGRADED" | "DRAFT_FAILED" | "EMPTY"; customerNotice: string };

const MAX_CLIENT_MESSAGE_CHARS = 8000;

/**
 * Run one client turn: persist the client's message, then draft + gate Plaino's
 * reply. The drafted reply is never visible to the client until the owner
 * approves it.
 */
export async function runPortalChatTurn(
  ctx: PortalChatContext,
  rawBody: string,
  gateOverride?: OwnerApprovalGate,
): Promise<PortalChatTurnResult> {
  const body = rawBody.trim();
  if (!body) {
    return { ok: false, reason: "EMPTY", customerNotice: "Type a message to send." };
  }
  const clientMessage = body.slice(0, MAX_CLIENT_MESSAGE_CHARS);

  // Degraded mode is checked BEFORE any DB write so a paused/keyless deploy
  // doesn't burn the encryption seam on a doomed turn (mirrors /talk).
  const degraded = checkDegradedMode();
  if (degraded.degraded) {
    return {
      ok: false,
      reason: "DEGRADED",
      customerNotice: degraded.customerNotice,
    };
  }

  // 1. Persist the client's message — delivered immediately (they wrote it).
  await withSystemContext((tx) =>
    tx.portalMessage.create({
      data: {
        threadId: ctx.threadId,
        portalConfigId: ctx.portalConfigId,
        sender: "CLIENT",
        body: encrypt(clientMessage),
        deliveryStatus: "DELIVERED",
        deliveredAt: new Date(),
      },
    }),
  );

  // 2. Draft Plaino's reply from the visible history + case context.
  const history = await loadVisibleMessages({
    portalConfigId: ctx.portalConfigId,
    threadId: ctx.threadId,
  });
  const draft = await draftReply(ctx, history);
  if (!draft) {
    return {
      ok: false,
      reason: "DRAFT_FAILED",
      customerNotice:
        `Thanks — ${ctx.brandName} has your message and will follow up with you here shortly.`,
    };
  }

  // 3. Gate the reply. A fresh draft has no approval yet, so the gate opens a
  //    PENDING WorkApprovalQueueItem and returns its id. We persist the reply
  //    PENDING_APPROVAL, bound to that approval row — invisible to the client
  //    until the owner approves.
  const gate = gateOverride ?? new PrismaPortalApprovalGate();
  const decision = await gate.check({
    workspaceId: ctx.workspaceId,
    portalConfigId: ctx.portalConfigId,
    action: { threadId: ctx.threadId, toClientEmail: ctx.clientEmail, body: draft },
  });
  const approvalItemId = decision.ok
    ? decision.grant.pendingApprovalId
    : decision.pendingApprovalId;

  await withSystemContext((tx) =>
    tx.portalMessage.create({
      data: {
        threadId: ctx.threadId,
        portalConfigId: ctx.portalConfigId,
        sender: "PLAINO",
        body: encrypt(draft),
        deliveryStatus: decision.ok ? "DELIVERED" : "PENDING_APPROVAL",
        approvalItemId: approvalItemId ?? null,
        deliveredAt: decision.ok ? new Date() : null,
        metadata: { gatedByApprovalItemId: approvalItemId ?? null },
      },
    }),
  );

  // Touch the thread so the owner's most-recent ordering is correct.
  await withSystemContext((tx) =>
    tx.portalThread.update({
      where: { id: ctx.threadId },
      data: { updatedAt: new Date() },
    }),
  );

  return { ok: true, pendingApprovalId: approvalItemId ?? null };
}

const PORTAL_DRAFT_MODEL_MAX_TOKENS = 700;

/**
 * Draft a reply on the owner's brand. The system prompt is explicit that the
 * draft will be reviewed by the business before the client sees it, and that
 * Plaino must never invent facts about the client's matter — when it doesn't
 * know, it says the team will follow up. Returns null on any provider failure
 * (the caller shows a calm acknowledgment instead).
 */
async function draftReply(
  ctx: PortalChatContext,
  history: VisibleMessage[],
): Promise<string | null> {
  const caseLine = ctx.caseTitle
    ? `\nThe client is asking about: "${ctx.caseTitle}"${ctx.caseStatus ? ` (current status: ${ctx.caseStatus})` : ""}.`
    : "";
  const system =
    `You are a helpful assistant replying on behalf of ${ctx.brandName} to one of ${ctx.brandName}'s clients in their client portal. ` +
    `Write a warm, concise, professional reply to the client's latest message. ` +
    `Your draft will be REVIEWED by ${ctx.brandName} before the client sees it, so do not promise specific dates, amounts, or legal/financial outcomes. ` +
    `Never invent facts about the client's matter — if you don't have the information, say that ${ctx.brandName} will follow up with the details. ` +
    `Do not mention that you are an AI or name any vendor. Sign off as ${ctx.brandName}.${caseLine}`;

  const messages = history.slice(-12).map((m) => ({
    role: (m.sender === "CLIENT" ? "user" : "assistant") as "user" | "assistant",
    content: m.body,
  }));
  // Ensure the conversation ends on a user turn for the model.
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return null;
  }

  try {
    const result = await getLlmProvider().complete({
      system,
      messages,
      maxTokens: PORTAL_DRAFT_MODEL_MAX_TOKENS,
      temperature: 0.4,
      meta: { skill: "portal-client-reply", workspaceId: ctx.workspaceId },
    });
    if (!result.ok) return null;
    const text = result.value.text.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
