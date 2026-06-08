import { ApEyebrow, ApRootedEmptyState, Plaino } from "@/components/ui/ap";
import type { PersistedChatMessage } from "@/lib/plaino";

// DB-free presentation for the Plaino talk thread. `page.tsx` owns the
// chat store, decryption, and approval-state lookups; it hands this
// module already-resolved data (messages + per-turn link state). Keeping
// presentation here lets every state — empty, populated, degraded, the
// INSTRUCT tile states — render in a unit test. See
// tests/customer-talk.test.tsx.

/**
 * Tile state for an INSTRUCT turn — derived from the underlying
 * PLAINO_INSTRUCTION approval queue row. "drafting" while the Inngest
 * handler is still working, "awaiting_review" once the draft lands,
 * "approved" once the operator approves.
 */
export type InstructionState =
  | "drafting"
  | "awaiting_review"
  | "approved"
  | "rejected";

export function TalkEmptyState() {
  return (
    <ApRootedEmptyState
      eyebrow="your service partner"
      scene="empty-talk"
      reality="Plaino's waiting at the workspace door."
      change="Ask a question and I'll fetch from your files and the substrate. Hand me work and I'll herd it through the team — the draft lands in your approval queue. I'll wait here in the meantime."
    />
  );
}

export interface TalkThreadProps {
  messages: PersistedChatMessage[];
  workspaceId: string;
  draftedSet: Set<string>;
  instructionStateMap: Map<string, InstructionState>;
}

export function TalkThread({
  messages,
  workspaceId,
  draftedSet,
  instructionStateMap,
}: TalkThreadProps) {
  return (
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
              ? instructionStateMap.get(instructionApprovalIdOf(m) ?? "") ??
                null
              : null
          }
          workspaceId={workspaceId}
        />
      ))}
    </ol>
  );
}

interface ChatBubbleProps {
  message: PersistedChatMessage;
  showDraftedLink: boolean;
  instructionState: InstructionState | null;
  workspaceId: string;
}

export function ChatBubble({
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
        {isPlaino ? <Plaino state="head-icon" size={16} /> : null}
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
        <div className="text-clay">can&rsquo;t fetch yet: {namedGap}</div>
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
  const disciplineSuffix = targetDiscipline ? ` · ${targetDiscipline}` : "";
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
    <span>herding through the {targetDiscipline ?? "team"} — drafting now</span>
  );
}

export interface DegradedNoticeProps {
  customerNotice: string;
  operatorNotice: string;
  isOperator: boolean;
}

export function DegradedNotice({
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

export function TalkHeader({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 text-ink">
      <div className="flex items-center gap-3">
        <Plaino state="head-icon" size={48} alt="Plaino" />
        <div>
          <ApEyebrow>talk with Plaino</ApEyebrow>
          <h1 className="font-display text-3xl leading-tight text-ink">
            What do you need fetched, herded, or figured out?
          </h1>
        </div>
      </div>
      <a
        href={`/app/workspace/${workspaceId}/talk/memory`}
        className="mt-1 rounded-sm font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        memory →
      </a>
    </div>
  );
}

// ─── Pure metadata readers ──────────────────────────────────────────────────

export function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function supportRequestIdOf(
  message: PersistedChatMessage,
): string | null {
  if (!message.metadata) return null;
  const v = message.metadata.supportRequestId;
  return typeof v === "string" ? v : null;
}

export function instructionApprovalIdOf(
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

function extractPreferenceScope(message: PersistedChatMessage): string | null {
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
