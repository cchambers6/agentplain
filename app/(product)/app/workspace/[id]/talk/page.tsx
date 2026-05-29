import { revalidatePath } from "next/cache";
import {
  ApEyebrow,
  ApRootedEmptyState,
  PlainoAvatar,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  checkDegradedMode,
  PrismaChatStore,
  type PersistedChatMessage,
} from "@/lib/plaino";
import { decryptPayloadForRead } from "@/lib/security/payload-crypto";
import { TalkComposer } from "./TalkComposer";

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
  const messages = store && thread
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
      <div className="mb-6 flex items-start justify-between gap-4 text-ink">
        <div className="flex items-center gap-3">
          <PlainoAvatar size="lg" pose="sit" decorative={false} />
          <div>
            <ApEyebrow>talk with Plaino</ApEyebrow>
            <h1 className="font-display text-3xl leading-tight text-ink">
              What do you need fetched, herded, or figured out?
            </h1>
          </div>
        </div>
        <a
          href={`/app/workspace/${workspaceId}/talk/memory`}
          className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft underline-offset-4 hover:underline"
        >
          memory →
        </a>
      </div>

      {degraded.degraded ? (
        <DegradedNotice
          customerNotice={degraded.customerNotice}
          operatorNotice={degraded.operatorNotice}
          isOperator={member.isOperator}
        />
      ) : null}

      {messages.length === 0 && !degraded.degraded ? (
        <ApRootedEmptyState
          eyebrow="your service partner"
          motif="lone-tree"
          reality="Plaino's waiting at the workspace door."
          change="Ask a question and I'll fetch from your files and the substrate. Hand me work and I'll herd it through the team — the draft lands in your approval queue. I'll wait here in the meantime."
        />
      ) : (
        <ol
          aria-label="conversation with Plaino"
          className="space-y-6 border-l border-rule pl-6"
        >
          {messages.map((m) => (
            <ChatBubble
              key={m.id}
              message={m}
              showDraftedLink={
                m.role === "plaino"
                  ? draftedSet.has(supportRequestIdOf(m) ?? "")
                  : false
              }
              instructionState={
                m.role === "plaino"
                  ? instructionStateMap.get(
                      instructionApprovalIdOf(m) ?? "",
                    ) ?? null
                  : null
              }
              workspaceId={workspaceId}
            />
          ))}
        </ol>
      )}

      <div className="mt-10">
        <TalkComposer workspaceId={workspaceId} />
      </div>
    </div>
  );
}

/**
 * Tile state for an INSTRUCT turn — derived from the underlying
 * PLAINO_INSTRUCTION approval queue row. "drafting" while the Inngest
 * handler is still working, "awaiting_review" once the draft lands,
 * "approved" once the operator approves.
 */
type InstructionState =
  | "drafting"
  | "awaiting_review"
  | "approved"
  | "rejected";

interface ChatBubbleProps {
  message: PersistedChatMessage;
  showDraftedLink: boolean;
  instructionState: InstructionState | null;
  workspaceId: string;
}

function ChatBubble({
  message,
  showDraftedLink,
  instructionState,
  workspaceId,
}: ChatBubbleProps) {
  const isPlaino = message.role === "plaino";
  const speaker = isPlaino ? "Plaino" : "You";
  return (
    <li>
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {isPlaino ? (
          <PlainoAvatar size="xs" />
        ) : null}
        <span>{speaker}</span>
        <span aria-hidden>·</span>
        <span>{formatTimestamp(message.createdAt)}</span>
      </div>
      <div
        className={
          isPlaino
            ? "whitespace-pre-wrap border border-rule bg-paper-deep p-4 text-[15px] leading-relaxed text-ink"
            : "whitespace-pre-wrap border border-rule bg-paper p-4 text-[15px] leading-relaxed text-ink"
        }
      >
        {message.body}
      </div>
      {isPlaino && message.metadata ? (
        <PlainoFooter
          message={message}
          showDraftedLink={showDraftedLink}
          instructionState={instructionState}
          workspaceId={workspaceId}
        />
      ) : null}
    </li>
  );
}

function PlainoFooter({
  message,
  showDraftedLink,
  instructionState,
  workspaceId,
}: ChatBubbleProps) {
  const citations = extractCitations(message);
  const kind = extractKind(message);
  const namedGap = extractNamedGap(message);
  const requestId = supportRequestIdOf(message);
  const instructionId = instructionApprovalIdOf(message);
  const targetDiscipline = extractTargetDiscipline(message);
  const preferenceScope = extractPreferenceScope(message);
  return (
    <div className="mt-2 space-y-1 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
      {citations.length > 0 ? (
        <div>
          <span className="text-ink-soft">cited:</span>{" "}
          {citations.map((c, i) => (
            <span key={`${c.title}-${i}`}>
              {i > 0 ? ", " : ""}
              {c.sourceUrl ? (
                <a
                  href={c.sourceUrl}
                  className="text-ink underline-offset-4 hover:underline"
                >
                  {c.title}
                </a>
              ) : (
                <span>{c.title}</span>
              )}
            </span>
          ))}
        </div>
      ) : null}
      {kind === "DECLINE_HONESTLY" && namedGap ? (
        <div className="text-clay">
          can't fetch yet: {namedGap}
        </div>
      ) : null}
      {kind === "REGISTER" && requestId ? (
        <div>
          {showDraftedLink ? (
            <a
              href={`/app/workspace/${workspaceId}/approvals`}
              className="text-ink underline-offset-4 hover:underline"
            >
              drafted reply in your approval queue →
            </a>
          ) : (
            <span>herding this through the team — drafting now</span>
          )}
        </div>
      ) : null}
      {kind === "INSTRUCT" && instructionId ? (
        <div>
          <InstructionTile
            state={instructionState}
            approvalId={instructionId}
            targetDiscipline={targetDiscipline}
            workspaceId={workspaceId}
          />
        </div>
      ) : null}
      {kind === "PREFERENCE" && preferenceScope ? (
        <div>
          <span className="text-ink-soft">saved as feedback:</span>{" "}
          <a
            href={`/app/workspace/${workspaceId}/talk/memory`}
            className="text-ink underline-offset-4 hover:underline"
          >
            scope={preferenceScope} →
          </a>
        </div>
      ) : null}
    </div>
  );
}

interface InstructionTileProps {
  state: InstructionState | null;
  approvalId: string;
  targetDiscipline: string | null;
  workspaceId: string;
}

function InstructionTile({
  state,
  approvalId,
  targetDiscipline,
  workspaceId,
}: InstructionTileProps) {
  const disciplineSuffix = targetDiscipline
    ? ` · ${targetDiscipline}`
    : "";
  if (state === "approved" || state === "rejected") {
    return (
      <span className="text-ink-soft">
        {state === "approved"
          ? `approved — queued to send by your team${disciplineSuffix}`
          : `rejected${disciplineSuffix} — re-ask if you want a fresh draft`}
      </span>
    );
  }
  if (state === "awaiting_review") {
    return (
      <a
        href={`/app/workspace/${workspaceId}/approvals?focus=${approvalId}`}
        className="text-ink underline-offset-4 hover:underline"
      >
        draft ready for review{disciplineSuffix} →
      </a>
    );
  }
  // "drafting" or null (still drafting / state unknown)
  return (
    <span>
      herding through the {targetDiscipline ?? "team"} — drafting now
    </span>
  );
}

interface DegradedNoticeProps {
  customerNotice: string;
  operatorNotice: string;
  isOperator: boolean;
}

function DegradedNotice({
  customerNotice,
  operatorNotice,
  isOperator,
}: DegradedNoticeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-8 border border-clay/40 bg-paper-deep p-4 text-[15px] leading-relaxed text-ink"
    >
      <p className="mb-1 font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        Plaino is offline
      </p>
      <p>{customerNotice}</p>
      {isOperator ? (
        <p className="mt-3 border-t border-rule pt-3 font-mono text-[12px] leading-relaxed text-ink-soft">
          <span className="text-clay">operator only:</span> {operatorNotice}
        </p>
      ) : null}
    </div>
  );
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function supportRequestIdOf(message: PersistedChatMessage): string | null {
  if (!message.metadata) return null;
  const v = message.metadata.supportRequestId;
  return typeof v === "string" ? v : null;
}

function instructionApprovalIdOf(
  message: PersistedChatMessage,
): string | null {
  if (!message.metadata) return null;
  const v = message.metadata.instructionApprovalId;
  return typeof v === "string" ? v : null;
}

function extractTargetDiscipline(
  message: PersistedChatMessage,
): string | null {
  if (!message.metadata) return null;
  const v = message.metadata.targetDiscipline;
  return typeof v === "string" ? v : null;
}

function extractPreferenceScope(
  message: PersistedChatMessage,
): string | null {
  if (!message.metadata) return null;
  const v = message.metadata.preferenceScope;
  return typeof v === "string" ? v : null;
}

function extractKind(message: PersistedChatMessage): string | null {
  if (!message.metadata) return null;
  const v = message.metadata.kind;
  return typeof v === "string" ? v : null;
}

function extractNamedGap(message: PersistedChatMessage): string | null {
  if (!message.metadata) return null;
  const v = message.metadata.namedGap;
  return typeof v === "string" ? v : null;
}

interface CitationLite {
  title: string;
  sourceUrl: string | null;
}

function extractCitations(message: PersistedChatMessage): CitationLite[] {
  if (!message.metadata) return [];
  const arr = message.metadata.citations;
  if (!Array.isArray(arr)) return [];
  const out: CitationLite[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.title !== "string") continue;
    out.push({
      title: obj.title,
      sourceUrl: typeof obj.sourceUrl === "string" ? obj.sourceUrl : null,
    });
  }
  return out;
}

function collectSupportRequestIds(
  messages: PersistedChatMessage[],
): string[] {
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

