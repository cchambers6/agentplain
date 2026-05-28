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

/**
 * Render-time precondition check for `liveRequires`. A roster card with
 * `runtime: "live"` AND a `liveRequires.connectors` list is HONESTLY live
 * only when at least one of the listed connectors is ACTIVE for the
 * workspace. With no active connector, the card degrades to "connect to
 * activate" instead of a stale "live" badge.
 */
function liveRequiresSatisfied(
  agent: AgentRosterEntry,
  activeConnectors: ReadonlySet<string>,
): boolean {
  const required = agent.liveRequires?.connectors;
  if (!required || required.length === 0) return true;
  return required.some((c) => activeConnectors.has(c));
}

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

  const [counts, workspace, activation, activeConnectorRows] = await Promise.all([
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
    // ACTIVE IntegrationCredential provider keys for this workspace.
    // Powers the `liveRequires` check below — a roster card whose live
    // status depends on a connector (e.g. chief-of-staff needs GOOGLE
    // or M365 calendar) degrades honestly when nothing's connected.
    withRls(ctx, (tx) =>
      tx.integrationCredential.findMany({
        where: { workspaceId, status: "ACTIVE" },
        select: { provider: true },
      }),
    ),
  ]);
  const activeConnectors = new Set<string>(
    activeConnectorRows.map((r) => r.provider),
  );

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
    const requiresOk = liveRequiresSatisfied(agent, activeConnectors);
    const requiresConnector =
      agent.runtime === "live" &&
      !requiresOk &&
      Array.isArray(agent.liveRequires?.connectors);
    const isLiveSkillBound =
      agent.runtime === "live" &&
      typeof agent.boundSkill === "string" &&
      agent.boundSkill.length > 0 &&
      requiresOk &&
      handoffCount === 0;
    // "connect to activate" wins over "ready/rooting" when a card's
    // liveRequires connector list is unfulfilled. The customer's next
    // step is to wire the integration; the agents page surfaces that
    // explicitly with the connector list so the call to action is
    // unambiguous.
    const status = requiresConnector
      ? `connect to activate — needs ${formatConnectors(agent.liveRequires!.connectors)}`
      : isRooting
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
      needsConnector: requiresConnector,
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
  /** True when the card's runtime is "live" but the workspace has not yet
   *  connected one of the required integrations from `liveRequires`. The
   *  grid renders this as a "connect to activate" affordance. */
  needsConnector: boolean;
};

/**
 * Render a `liveRequires.connectors` list as a human-readable phrase
 * for the status line. Maps provider keys (the durable identifier on
 * `IntegrationCredential.provider`) to the marketplace tile names a
 * customer recognizes. Falls back to the raw key when no mapping
 * exists so a new connector key doesn't render as blank.
 */
function formatConnectors(connectors: string[]): string {
  if (connectors.length === 0) return "a connector";
  const labels = connectors.map((c) => {
    switch (c) {
      case "GOOGLE":
        return "Google Calendar";
      case "M365":
        return "Outlook Calendar";
      case "QUICKBOOKS":
        return "QuickBooks";
      case "DOCUSIGN":
        return "DocuSign";
      case "SLACK":
        return "Slack";
      default:
        return c.toLowerCase();
    }
  });
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}
