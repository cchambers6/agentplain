import Link from "next/link";
import { ApEyebrow } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { getVerticalContent } from "@/lib/verticals";
import type { AgentRosterEntry } from "@/lib/verticals/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Agent definitions aren't editable in product (per product_spec §7.3, the
// product is "not the agent runtime itself"). The fleet is read from the
// workspace's vertical roster (`lib/verticals/<slug>/content.ts → agentRoster`)
// so a CPA / law / insurance workspace sees its own fleet, not the realty one.
// Activity counts come from real workspace state.

export default async function AgentsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [counts, workspace] = await Promise.all([
    withRls(ctx, async (tx) => {
      const grouped = await tx.handoffLogEntry.groupBy({
        by: ["fromAgent"],
        where: { workspaceId },
        _count: { _all: true },
      });
      const byAgent = new Map<string, number>();
      for (const row of grouped) {
        byAgent.set(row.fromAgent, row._count._all);
      }
      return byAgent;
    }),
    withRls(ctx, (tx) =>
      tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { vertical: true },
      }),
    ),
  ]);

  // Resolve the workspace's vertical to its content roster. The slug bridge
  // is the single boundary between the Prisma enum and the content layer.
  // Real estate is the fallback when a surface has no roster (e.g. the
  // `/general` on-ramp content), so the page never renders empty.
  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const realEstateRoster = getVerticalContent("real-estate")?.agentRoster ?? [];
  const fleet: AgentRosterEntry[] =
    getVerticalContent(verticalSlug)?.agentRoster ?? realEstateRoster;

  return (
    <div>
      <ApEyebrow className="mb-3">your fleet</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Your fleet — each capability scoped to one job.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Open any capability for its daily loops, recent activity, and
        the work it has surfaced for review. Enabling or disabling
        capabilities is your service team&rsquo;s call today; ask your
        partner if your fleet should change.
      </p>

      <div className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {fleet.map((agent) => {
          const handoffCount = counts.get(agent.slug) ?? 0;
          // Truthful status, never a perpetual spinner:
          //  - rooting capability → say what it's waiting on (no fake imminence).
          //  - live + work logged  → the real count.
          //  - live + nothing yet  → honest "first handoff lands soon" (it will,
          //    once matching email flows). Verticals with no `runtime` binding
          //    keep the legacy count-only line.
          const isRooting = agent.runtime === "rooting";
          const status = isRooting
            ? (agent.rootingNote ?? "rooting now — runtime still being built.")
            : handoffCount === 0
              ? "rooting in — first handoff lands soon"
              : `${handoffCount} handoff${handoffCount === 1 ? "" : "s"} logged`;
          return (
            <Link
              key={agent.slug}
              href={`/app/workspace/${workspaceId}/agents/${agent.slug}`}
              className="block border border-transparent bg-paper p-5 transition hover:border-ink focus:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-inset"
            >
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                {agent.slug}
              </p>
              <p className="mt-2 font-display text-xl text-ink">{agent.name}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                {agent.job}
              </p>
              <p className="mt-3 text-[13px] text-mute">{status}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
