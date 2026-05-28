import { revalidatePath } from "next/cache";
import {
  ApEyebrow,
  ApRootedEmptyState,
  PlainoAvatar,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import { PrismaChatStore, type PersistedChatMessage } from "@/lib/plaino";
import { TalkComposer } from "./TalkComposer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TalkPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const ctx = {
    userId: member.userId,
    workspaceId,
    isOperator: member.isOperator,
  } as const;

  const store = new PrismaChatStore(workspaceId, { ctx });
  const thread = await store.ensureWorkspaceThread({ workspaceId });
  const messages = await store.listMessages({
    threadId: thread.id,
    workspaceId,
    limit: 200,
  });

  const draftedSupportRequestIds = collectSupportRequestIds(messages);
  const draftedSet = await findDraftedSupportRequestIds({
    workspaceId,
    supportRequestIds: draftedSupportRequestIds,
  });

  // Bump the cached page so a fresh refresh from another tab also
  // sees new messages. revalidatePath is idempotent.
  revalidatePath(`/app/workspace/${workspaceId}/talk`);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4 text-ink">
        <div className="flex items-center gap-3">
          <PlainoAvatar size="lg" decorative={false} />
          <div>
            <ApEyebrow>talk with Plaino</ApEyebrow>
            <h1 className="font-display text-3xl leading-tight text-ink">
              What do you need today?
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

      {messages.length === 0 ? (
        <ApRootedEmptyState
          eyebrow="your service partner"
          motif="lone-tree"
          reality="Hi, I'm Plaino — your service partner."
          change="Ask me anything about your workspace, or tell me what you need. I read what we have on file and route work to the right hands."
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

interface ChatBubbleProps {
  message: PersistedChatMessage;
  showDraftedLink: boolean;
  workspaceId: string;
}

function ChatBubble({ message, showDraftedLink, workspaceId }: ChatBubbleProps) {
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
          workspaceId={workspaceId}
        />
      ) : null}
    </li>
  );
}

function PlainoFooter({
  message,
  showDraftedLink,
  workspaceId,
}: ChatBubbleProps) {
  const citations = extractCitations(message);
  const kind = extractKind(message);
  const namedGap = extractNamedGap(message);
  const requestId = supportRequestIdOf(message);
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
          not yet wired: {namedGap}
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
            <span>handed to the team — drafting now</span>
          )}
        </div>
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

