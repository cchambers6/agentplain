import Link from "next/link";
import {
  ApEyebrow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";

export type ApprovalBoardCard = {
  id: string;
  agentSlug: string;
  kind: string;
  title: string;
  proposedAtIso: string;
};

interface TodoBoardProps {
  workspaceId: string;
  drafting: ApprovalBoardCard[];
  readyForYou: ApprovalBoardCard[];
  ratifiedRecently: ApprovalBoardCard[];
  partner: string;
}

/**
 * Three-column board of where work sits relative to the human.
 *
 *   drafting (fleet is still preparing)
 *   ready for you (PENDING approvals — the only column you act on)
 *   ratified (recently APPROVED — proof the loop closed)
 *
 * "Drafting" intentionally uses HandoffLogEntry rows whose draft has
 * not yet landed in WorkApprovalQueueItem. We surface a count, not
 * placeholder cards, because a half-drafted reply is not yet a
 * decision the customer can make.
 */
export function TodoBoard({
  workspaceId,
  drafting,
  readyForYou,
  ratifiedRecently,
  partner,
}: TodoBoardProps) {
  const totalActionable = readyForYou.length;

  return (
    <section aria-labelledby="todo-board-heading">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <ApEyebrow>to-do board</ApEyebrow>
          <h2
            id="todo-board-heading"
            className="mt-2 font-display text-2xl text-ink md:text-3xl"
          >
            {totalActionable === 0
              ? "Nothing waiting on you."
              : totalActionable === 1
                ? "One decision waiting on you."
                : `${totalActionable} decisions waiting on you.`}
          </h2>
        </div>
        <Link
          href={`/app/workspace/${workspaceId}/approvals`}
          className="font-mono text-[11px] tracking-eyebrow uppercase text-mute hover:text-ink"
        >
          open approvals queue →
        </Link>
      </header>

      <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
        <BoardColumn
          eyebrow="drafting"
          tone="muted"
          subtitle={
            drafting.length === 0
              ? "Nothing in flight right now."
              : "Fleet is still preparing these — they'll cross over when ready."
          }
        >
          {drafting.length === 0 ? (
            <EmptyTile copy="Quiet at the moment." />
          ) : (
            <ul className="space-y-3">
              {drafting.map((c) => (
                <BoardCard key={c.id} card={c} workspaceId={workspaceId} actionable={false} />
              ))}
            </ul>
          )}
        </BoardColumn>

        <BoardColumn
          eyebrow="ready for you"
          tone={readyForYou.length > 0 ? "primary" : "muted"}
          subtitle={
            readyForYou.length === 0
              ? "Approve, edit, or reject. Nothing here yet."
              : "Open the approvals queue to decide."
          }
        >
          {readyForYou.length === 0 ? (
            <EmptyTile copy={`${partner} hands these over once they cross your threshold.`} />
          ) : (
            <ul className="space-y-3">
              {readyForYou.map((c) => (
                <BoardCard key={c.id} card={c} workspaceId={workspaceId} actionable />
              ))}
            </ul>
          )}
        </BoardColumn>

        <BoardColumn
          eyebrow="ratified"
          tone="muted"
          subtitle={
            ratifiedRecently.length === 0
              ? "Approved items land here once you've decided."
              : "Last seven days — your fleet, with your hand on every send."
          }
        >
          {ratifiedRecently.length === 0 ? (
            <EmptyTile copy="No ratified items yet." />
          ) : (
            <ul className="space-y-3">
              {ratifiedRecently.map((c) => (
                <BoardCard key={c.id} card={c} workspaceId={workspaceId} actionable={false} />
              ))}
            </ul>
          )}
        </BoardColumn>
      </div>

      {readyForYou.length === 0 && drafting.length === 0 && ratifiedRecently.length === 0 ? (
        <div className="mt-6">
          <ApRootedEmptyState
            motif="sheaf"
            reality="Nothing on the board yet."
            change={`${partner} is watching your inbox. The board fills as drafts cross the wire.`}
            cta={
              <ApHeritageButton
                variant="secondary"
                withArrow
                href={`/app/workspace/${workspaceId}/integrations`}
              >
                connect another tool
              </ApHeritageButton>
            }
          />
        </div>
      ) : null}
    </section>
  );
}

interface BoardColumnProps {
  eyebrow: string;
  subtitle: string;
  tone: "primary" | "muted";
  children: React.ReactNode;
}

function BoardColumn({ eyebrow, subtitle, tone, children }: BoardColumnProps) {
  const headerClass =
    tone === "primary"
      ? "font-mono text-[11px] tracking-eyebrow uppercase text-clay"
      : "font-mono text-[11px] tracking-eyebrow uppercase text-mute";
  return (
    <div className="bg-paper p-4 md:p-5">
      <p className={headerClass}>{eyebrow}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-mute">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyTile({ copy }: { copy: string }) {
  return (
    <div className="border border-dashed border-rule bg-paper-deep px-3 py-4 text-[13px] leading-relaxed text-mute">
      {copy}
    </div>
  );
}

function BoardCard({
  card,
  workspaceId,
  actionable,
}: {
  card: ApprovalBoardCard;
  workspaceId: string;
  actionable: boolean;
}) {
  // Only the "ready for you" column links into the approvals route —
  // the others are read-only context, so we render them as plain
  // articles (no link affordance that would imply action).
  const inner = (
    <>
      <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
        {humanKind(card.kind)} · {card.agentSlug}
      </p>
      <p className="mt-1 font-display text-[15px] leading-snug text-ink">
        {card.title}
      </p>
      <p className="mt-1 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
        {formatRelative(card.proposedAtIso)}
      </p>
    </>
  );

  if (actionable) {
    return (
      <li>
        <Link
          href={`/app/workspace/${workspaceId}/approvals`}
          className="block border border-rule bg-paper p-3 transition hover:border-ink focus:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-inset"
        >
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li className="border border-rule bg-paper p-3">
      {inner}
    </li>
  );
}

function humanKind(kind: string): string {
  return kind.replace(/_/g, " ").toLowerCase();
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return date.toLocaleDateString();
}
