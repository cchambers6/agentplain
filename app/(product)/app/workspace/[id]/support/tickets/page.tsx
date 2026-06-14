import Link from "next/link";
import { ApEyebrow } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { PrismaTicketStore, formatTicketNumber } from "@/lib/support/tickets";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  categoryLabel,
} from "@/components/support/TicketBadges";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MyTicketsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const basePath = `/app/workspace/${workspaceId}`;

  const tickets = await new PrismaTicketStore().listTicketsForWorkspace(
    workspaceId,
    { userId: member.userId, isOperator: member.isOperator },
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <ApEyebrow className="mb-3">support</ApEyebrow>
          <h1 className="font-display text-3xl leading-tight text-ink">
            My tickets
          </h1>
        </div>
        <Link
          href={`${basePath}/support/new`}
          className="border border-ink bg-ink px-4 py-2 font-mono text-[12px] uppercase tracking-eyebrow text-paper transition hover:bg-clay hover:border-clay"
        >
          open a ticket
        </Link>
      </div>

      {tickets.length === 0 ? (
        <div className="mt-8 border border-rule bg-paper-deep p-6 text-[15px] leading-relaxed text-ink-soft">
          <p>You haven&rsquo;t opened any tickets yet.</p>
          <p className="mt-2">
            Hit a snag?{" "}
            <Link
              href={`${basePath}/support/new`}
              className="text-ink underline underline-offset-4 hover:text-clay"
            >
              Open a ticket
            </Link>{" "}
            and we&rsquo;ll get a human on it.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-rule border border-rule">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`${basePath}/support/tickets/${t.id}`}
                className="block bg-paper px-4 py-4 transition hover:bg-paper-deep focus:outline-none focus-visible:bg-paper-deep"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[12px] text-mute">
                    {formatTicketNumber(t.number)}
                  </span>
                  <div className="flex items-center gap-2">
                    <TicketPriorityBadge priority={t.priority} />
                    <TicketStatusBadge status={t.status} />
                  </div>
                </div>
                <p className="mt-1 text-[15px] font-medium text-ink">
                  {t.subject}
                </p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                  {categoryLabel(t.category)} · opened{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                  }).format(t.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
