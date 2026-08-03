import {
  ApEyebrow,
  ApRootedEmptyState,
  PlainoMark,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { PrismaMemoryStore } from "@/lib/plaino";
import type { MemoryEntry, MemoryKind } from "@/lib/plaino/memory";
import { MEMORY_KINDS } from "@/lib/plaino/memory";
import {
  describeProvenance,
  sourceChatMessageIdFromRef,
} from "@/lib/provenance/describe";
import { deleteAction, editAction, pinAction } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MemoryPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const store = new PrismaMemoryStore(workspaceId, {
    ctx: {
      userId: member.userId,
      workspaceId,
      isOperator: member.isOperator,
    },
  });
  const entries = await store.listForWorkspace({ workspaceId });

  const grouped = groupByKind(entries);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4 text-ink">
        <div className="flex items-center gap-3">
          <PlainoMark size={48} alt="Plaino" />
          <div>
            <ApEyebrow>what Plaino remembers</ApEyebrow>
            <h1 className="font-display text-3xl leading-tight text-ink">
              Memory for this workspace
            </h1>
            <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-ink-soft">
              Durable facts Plaino fetches from on every turn. Pin the ones
              you want kept on hand always. Everything is encrypted at rest
              and stays inside this workspace.
            </p>
          </div>
        </div>
        <a
          href={`/app/workspace/${workspaceId}/talk`}
          className="mt-1 font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft underline-offset-4 hover:underline"
        >
          ← back to chat
        </a>
      </div>

      {entries.length === 0 ? (
        <ApRootedEmptyState
          eyebrow="a quiet shelf"
          motif="lone-tree"
          reality="Plaino doesn't have anything saved yet."
          change="The shelf fills as you talk — durable facts about you, your work, and the way you like things done. Plaino fetches from here on every turn."
        />
      ) : (
        <div className="space-y-10">
          {MEMORY_KINDS.map((kind) => {
            const rows = grouped[kind];
            if (rows.length === 0) return null;
            return (
              <section key={kind}>
                <h2 className="mb-3 font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft">
                  {labelFor(kind)} · {rows.length}
                </h2>
                <ol className="space-y-3 border-l border-rule pl-6">
                  {rows.map((entry) => (
                    <MemoryRow
                      key={entry.id}
                      entry={entry}
                      workspaceId={workspaceId}
                    />
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface RowProps {
  entry: MemoryEntry;
  workspaceId: string;
}

function MemoryRow({ entry, workspaceId }: RowProps) {
  const pinNext = entry.pinned ? "false" : "true";
  return (
    <li className="border border-rule bg-paper p-4">
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {entry.pinned ? <span className="text-forest">pinned</span> : null}
        <span>updated {formatTimestamp(entry.updatedAt)}</span>
        <Citation entry={entry} workspaceId={workspaceId} />
      </div>

      <details>
        <summary className="cursor-pointer text-[15px] leading-relaxed text-ink">
          <span className="font-display">{entry.title}</span>
        </summary>
        <form action={editAction.bind(null, workspaceId)} className="mt-3 space-y-2">
          <input type="hidden" name="id" value={entry.id} />
          <label
            className="block font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft"
            htmlFor={`title-${entry.id}`}
          >
            title
          </label>
          <input
            id={`title-${entry.id}`}
            name="title"
            defaultValue={entry.title}
            className="w-full border border-rule bg-paper-deep px-3 py-2 text-[14px] leading-relaxed text-ink"
            maxLength={120}
          />
          <label
            className="block font-mono text-[11px] tracking-eyebrow uppercase text-ink-soft"
            htmlFor={`body-${entry.id}`}
          >
            body
          </label>
          <textarea
            id={`body-${entry.id}`}
            name="body"
            defaultValue={entry.body}
            rows={4}
            className="w-full border border-rule bg-paper-deep px-3 py-2 text-[14px] leading-relaxed text-ink"
            maxLength={2_000}
          />
          <button
            type="submit"
            className="border border-rule bg-forest px-3 py-1 font-mono text-[11px] tracking-eyebrow uppercase text-paper"
          >
            save
          </button>
        </form>
      </details>

      {!entry.sourceChatMessageId ? null : (
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{entry.body}</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <form action={pinAction.bind(null, workspaceId)}>
          <input type="hidden" name="id" value={entry.id} />
          <input type="hidden" name="pinned" value={pinNext} />
          <button
            type="submit"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-ink underline-offset-4 hover:underline"
          >
            {entry.pinned ? "unpin" : "pin"}
          </button>
        </form>
        <form action={deleteAction.bind(null, workspaceId)}>
          <input type="hidden" name="id" value={entry.id} />
          <button
            type="submit"
            className="font-mono text-[11px] tracking-eyebrow uppercase text-clay underline-offset-4 hover:underline"
          >
            delete
          </button>
        </form>
      </div>
    </li>
  );
}

/**
 * Where this fact came from, in the customer's words.
 *
 * The copy comes from `describeProvenance` — the only sanctioned
 * translation of the stored block. Nothing on this page ever prints an
 * enum value, a slug, or the word "provenance" (the ratified
 * customer-vocab rule); the customer reads "you told Plaino this in chat"
 * or "Plaino worked this out on its own — unconfirmed".
 *
 * Three states, all honest:
 *   - block present + a chat turn to open  → the citation IS the link
 *   - block present, nothing to link to    → plain text, no fake link
 *   - LEGACY row (no block)                → exactly the old "· from
 *     chat" behaviour. We know a source message id but not how the fact
 *     got there, so we claim only what we actually know.
 */
function Citation({ entry, workspaceId }: RowProps) {
  const turnHref = (id: string) =>
    `/app/workspace/${workspaceId}/talk#msg-${id}`;

  if (!entry.provenance) {
    if (!entry.sourceChatMessageId) return null;
    return (
      <a
        href={turnHref(entry.sourceChatMessageId)}
        className="text-ink-soft underline-offset-4 hover:underline"
      >
        · from chat
      </a>
    );
  }

  const copy = describeProvenance(entry.provenance);
  const capturedOn = formatDate(new Date(entry.provenance.capturedAt));
  const linkId =
    sourceChatMessageIdFromRef(entry.provenance) ?? entry.sourceChatMessageId;

  if (!linkId) {
    return (
      <span className="text-ink-soft">
        · {copy} · {capturedOn}
      </span>
    );
  }
  return (
    <a
      href={turnHref(linkId)}
      className="text-ink-soft underline-offset-4 hover:underline"
    >
      · {copy} · {capturedOn}
    </a>
  );
}

function labelFor(kind: MemoryKind): string {
  switch (kind) {
    case "USER":
      return "about you";
    case "FEEDBACK":
      return "how I should work";
    case "PROJECT":
      return "what you're moving";
    case "REFERENCE":
      return "where things live";
  }
}

function groupByKind(entries: MemoryEntry[]): Record<MemoryKind, MemoryEntry[]> {
  const out: Record<MemoryKind, MemoryEntry[]> = {
    USER: [],
    FEEDBACK: [],
    PROJECT: [],
    REFERENCE: [],
  };
  for (const e of entries) out[e.kind].push(e);
  return out;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Day-level date for the citation — "you told Plaino this in chat ·
 *  Jun 12". The minute a fact was captured is noise here; the day is
 *  what a customer actually recognizes. */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
