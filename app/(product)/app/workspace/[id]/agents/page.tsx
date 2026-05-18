import Link from "next/link";
import { ApEyebrow } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Phase 1 has a static fleet — agent definitions aren't editable in product
// (per product_spec §7.3, the product is "not the agent runtime itself").
// Activity counts come from real workspace state.
const FLEET = [
  { slug: "realty-listing-coordinator", name: "Listing Coordinator" },
  { slug: "realty-buyer-inquiry-router", name: "Buyer Inquiry Router" },
  { slug: "realty-showing-scheduler", name: "Showing Scheduler" },
  { slug: "realty-compliance-sentinel", name: "Compliance Sentinel" },
  { slug: "realty-crm-hygiene", name: "CRM Hygiene" },
  { slug: "realty-production-reporter", name: "Production Reporter" },
  { slug: "realty-recruiter-assistant", name: "Recruiter Assistant" },
];

export default async function AgentsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const counts = await withRls(ctx, async (tx) => {
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
  });

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
        {FLEET.map((agent) => {
          const handoffCount = counts.get(agent.slug) ?? 0;
          return (
            <Link
              key={agent.slug}
              href={`/app/workspace/${workspaceId}/agents/${agent.slug}`}
              className="block bg-paper p-5 transition hover:bg-paper-deep focus:outline-none focus-visible:bg-paper-deep focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-inset"
            >
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                {agent.slug}
              </p>
              <p className="mt-2 font-display text-xl text-ink">{agent.name}</p>
              <p className="mt-3 text-[13px] text-mute">
                {handoffCount === 0
                  ? "rooting in — first handoff lands soon"
                  : `${handoffCount} handoff${handoffCount === 1 ? "" : "s"} logged`}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
