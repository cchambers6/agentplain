import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  checkDegradedMode,
  PrismaChatStore,
  type PersistedChatMessage,
} from "@/lib/plaino";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import { TalkComposer } from "./TalkComposer";
import {
  DegradedNotice,
  TalkEmptyState,
  TalkHeader,
  TalkThread,
  instructionApprovalIdOf,
  supportRequestIdOf,
  type InstructionState,
} from "./talk-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TalkPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  // Phase-1 honesty seam — if the deploy is missing ENCRYPTION_KEY or
  // ANTHROPIC_API_KEY, the dispatcher would throw or stub. Detect
  // BEFORE touching the chat store so the page still renders without
  // any DB-side errors, and surface a calm "Plaino is offline" notice
  // with operator-facing guidance.
  const degraded = checkDegradedMode();

  const ctx = {
    userId: member.userId,
    workspaceId,
    isOperator: member.isOperator,
  } as const;

  // In degraded mode we skip the chat-store read too — the listMessages
  // path itself decrypts each row, which can throw when ENCRYPTION_KEY
  // is missing. Render an empty thread with the degraded notice.
  const store = degraded.degraded
    ? null
    : new PrismaChatStore(workspaceId, { ctx });
  const thread = store
    ? await store.ensureWorkspaceThread({ workspaceId })
    : null;
  const messages =
    store && thread
      ? await store.listMessages({
          threadId: thread.id,
          workspaceId,
          limit: 200,
        })
      : [];

  const draftedSupportRequestIds = collectSupportRequestIds(messages);
  const draftedSet = await findDraftedSupportRequestIds({
    workspaceId,
    supportRequestIds: draftedSupportRequestIds,
  });

  // Look up the current drafting state for any INSTRUCT approval queue
  // items referenced by Plaino messages. This is what powers the
  // WORK_LINK tile under each INSTRUCT turn — "drafting now", "draft
  // ready for review", or "approved & queued".
  const instructionApprovalIds = collectInstructionApprovalIds(messages);
  const instructionStateMap = await findInstructionApprovalStates({
    workspaceId,
    approvalIds: instructionApprovalIds,
  });

  // Bump the cached page so a fresh refresh from another tab also
  // sees new messages. revalidatePath is idempotent.
  revalidatePath(`/app/workspace/${workspaceId}/talk`);

  return (
    <div className="mx-auto max-w-3xl">
      <TalkHeader workspaceId={workspaceId} />

      {degraded.degraded ? (
        <DegradedNotice
          customerNotice={degraded.customerNotice}
          operatorNotice={degraded.operatorNotice}
          isOperator={member.isOperator}
        />
      ) : null}

      {messages.length === 0 && !degraded.degraded ? (
        <TalkEmptyState />
      ) : (
        <TalkThread
          messages={messages}
          workspaceId={workspaceId}
          draftedSet={draftedSet}
          instructionStateMap={instructionStateMap}
        />
      )}

      <div className="mt-10">
        <TalkComposer workspaceId={workspaceId} />
      </div>
    </div>
  );
}

function collectSupportRequestIds(messages: PersistedChatMessage[]): string[] {
  const ids: string[] = [];
  for (const m of messages) {
    if (m.role !== "plaino") continue;
    const id = supportRequestIdOf(m);
    if (id) ids.push(id);
  }
  return ids;
}

function collectInstructionApprovalIds(
  messages: PersistedChatMessage[],
): string[] {
  const ids: string[] = [];
  for (const m of messages) {
    if (m.role !== "plaino") continue;
    const id = instructionApprovalIdOf(m);
    if (id) ids.push(id);
  }
  return ids;
}

async function findInstructionApprovalStates(args: {
  workspaceId: string;
  approvalIds: string[];
}): Promise<Map<string, InstructionState>> {
  const out = new Map<string, InstructionState>();
  if (args.approvalIds.length === 0) return out;
  const rows = await withSystemContext((tx) =>
    tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        kind: "PLAINO_INSTRUCTION",
        id: { in: args.approvalIds },
      },
      select: { id: true, status: true, payload: true },
    }),
  );
  for (const row of rows) {
    // The Inngest handler writes status='awaiting_review' into the
    // payload once the draft lands. Combine that with the row's
    // approval-status to derive the customer-facing tile state.
    const payloadStatus = readPayloadStatus(row.payload);
    if (row.status === "APPROVED" || row.status === "AUTO_APPROVED") {
      out.set(row.id, "approved");
    } else if (row.status === "REJECTED" || row.status === "EXPIRED") {
      out.set(row.id, "rejected");
    } else if (payloadStatus === "awaiting_review") {
      out.set(row.id, "awaiting_review");
    } else {
      out.set(row.id, "drafting");
    }
  }
  return out;
}

function readPayloadStatus(payload: unknown): string | null {
  // The payload is encrypted-at-rest with the v1 envelope (see
  // lib/security/payload-crypto.ts). Decrypt to read the
  // status field; on any decrypt failure, return null so the tile
  // falls back to the "drafting" state.
  if (!payload || typeof payload !== "object") return null;
  const decrypted = decryptPayloadForRead(payload);
  if (!decrypted || typeof decrypted !== "object") return null;
  const obj = decrypted as Record<string, unknown>;
  const status = obj.status;
  return typeof status === "string" ? status : null;
}

const SUPPORT_HANDLER_REF_TABLE = "SupportRequest";
const SUPPORT_HANDLER_KIND = "SUPPORT_HANDLER_REPLY_DRAFT";

async function findDraftedSupportRequestIds(args: {
  workspaceId: string;
  supportRequestIds: string[];
}): Promise<Set<string>> {
  if (args.supportRequestIds.length === 0) return new Set();
  const rows = await withSystemContext((tx) =>
    tx.workApprovalQueueItem.findMany({
      where: {
        workspaceId: args.workspaceId,
        refTable: SUPPORT_HANDLER_REF_TABLE,
        kind: SUPPORT_HANDLER_KIND,
        refId: { in: args.supportRequestIds },
      },
      select: { refId: true },
    }),
  );
  return new Set(rows.map((r) => r.refId));
}
