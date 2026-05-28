import { ApEyebrow } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { listDisciplines, type DisciplineId } from "@/lib/disciplines";
import { getActivationState } from "@/lib/disciplines/activation";
import { AGENT_DISCIPLINE } from "@/lib/disciplines/skill-mapping";
import { getVerticalContent } from "@/lib/verticals";
import type { AgentRosterEntry } from "@/lib/verticals/types";
import { AgentsFleetGrid } from "./AgentsFleetGrid";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Agent definitions are workspace-content, not editable in product. The
// fleet is read from the workspace's vertical roster
// (`lib/verticals/<slug>/content.ts → agentRoster`) so a CPA / law /
// insurance workspace sees its own fleet. Activity counts come from real
// workspace state. Discipline facets and the activation toggle are
// customer-facing per Strand 1 §5.2 (premium few-clicks bar) — the
// previous "your service team's call" copy walked the premium promise
// back and is replaced here.

export default async function AgentsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [counts, workspace, activation] = await Promise.all([
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
    getActivationState(ctx, workspaceId),
  ]);

  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const realEstateRoster =
    getVerticalContent("real-estate")?.agentRoster ?? [];
  const fleet: AgentRosterEntry[] =
    getVerticalContent(verticalSlug)?.agentRoster ?? realEstateRoster;

  const disciplines = listDisciplines();
  const cards = fleet.map((agent) => {
    const handoffCount = counts.get(agent.slug) ?? 0;
    // Truthful status — see prior derivation rules in
    // docs/realty-fleet-binding-2026-05-22.md.
    const isRooting = agent.runtime === "rooting";
    const isLiveSkillBound =
      agent.runtime === "live" &&
      typeof agent.boundSkill === "string" &&
      agent.boundSkill.length > 0 &&
      handoffCount === 0;
    const status = isRooting
      ? agent.rootingNote ?? "rooting now — runtime still being built."
      : isLiveSkillBound
        ? "ready — capability tested, first run lands when triggered"
        : handoffCount === 0
          ? "rooting in — first handoff lands soon"
          : `${handoffCount} handoff${handoffCount === 1 ? "" : "s"} logged`;
    const disciplineId = AGENT_DISCIPLINE[agent.slug] ?? null;
    return {
      slug: agent.slug,
      name: agent.name,
      job: agent.job,
      status,
      discipline: disciplineId,
      disabled:
        disciplineId !== null && activation.disabled.includes(disciplineId),
    };
  });

  return (
    <div>
      <ApEyebrow className="mb-3">your fleet</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Your fleet — each capability scoped to one job.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Open any capability for its daily loops, recent activity, and the
        work it has surfaced for review. To turn whole disciplines on or
        off — analytics, research, marketing, and the rest — open{" "}
        <a
          href={`/app/workspace/${workspaceId}/disciplines`}
          className="text-ink underline underline-offset-4 decoration-clay decoration-2 hover:decoration-clay-deep"
        >
          your disciplines
        </a>
        . Plaino still does the work, you keep the call.
      </p>

      <AgentsFleetGrid
        workspaceId={workspaceId}
        cards={cards}
        disciplines={disciplines.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
}

export type AgentCard = {
  slug: string;
  name: string;
  job: string;
  status: string;
  discipline: DisciplineId | null;
  disabled: boolean;
};
