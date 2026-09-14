import { ApEyebrow } from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { listDisciplines, type DisciplineId } from "@/lib/disciplines";
import { getActivationState } from "@/lib/disciplines/activation";
import { AGENT_DISCIPLINE } from "@/lib/disciplines/skill-mapping";
import { getCalendarConnectorState } from "@/lib/skills/scheduler/calendar-multiplex-fetcher";
import { getVerticalContent } from "@/lib/verticals";
import type { AgentRosterEntry } from "@/lib/verticals/types";
import { AgentsFleetGrid } from "./AgentsFleetGrid";
import {
  connectPrompt,
  liveRequiresSatisfied,
  needsCapabilityReconnect,
  type RosterCapability,
} from "./live-requires";

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

  const [counts, workspace, activation, activeConnectorRows, calendarState] =
    await Promise.all([
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
      // Powers the `liveRequires` connector check below — a roster card
      // whose live status depends on a connector degrades honestly when
      // nothing's connected.
      withRls(ctx, (tx) =>
        tx.integrationCredential.findMany({
          where: { workspaceId, status: "ACTIVE" },
          select: { provider: true },
        }),
      ),
      // CAPABILITY check, which the connector check above cannot make.
      // Gmail and Google Calendar ride the same GOOGLE credential row, so
      // "GOOGLE is connected" did NOT mean "we can read a calendar" — and
      // this page rendered the Chief of Staff card LIVE on the strength
      // of a mail connection while every calendar read 403'd at Google.
      //
      // `getCalendarConnectorState` is the function written for exactly
      // this surface. It takes an injected reader so it runs under the
      // MEMBER's RLS context here rather than the system context its cron
      // caller uses — a page must not read wider than the person viewing
      // it.
      getCalendarConnectorState(workspaceId, {
        readCredentials: (wsId) =>
          withRls(ctx, (tx) =>
            tx.integrationCredential.findMany({
              where: {
                workspaceId: wsId,
                status: "ACTIVE",
                provider: { in: ["GOOGLE", "M365"] },
              },
              select: { provider: true, scopes: true },
            }),
          ),
      }),
    ]);
  const activeConnectors = new Set<string>(
    activeConnectorRows.map((r) => r.provider),
  );
  const satisfiedCapabilities = new Set<RosterCapability>(
    calendarState.readiness.ready ? (["calendar"] as const) : [],
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
    const requiresOk = liveRequiresSatisfied(
      agent,
      activeConnectors,
      satisfiedCapabilities,
    );
    const requiresConnector =
      agent.runtime === "live" &&
      !requiresOk &&
      Array.isArray(agent.liveRequires?.connectors);
    // Connector wired, capability missing — the customer already
    // connected the account, so "connect X" would send them to a
    // Connections page where everything looks green. They need to
    // RE-consent with calendar access.
    const capabilityMissing = needsCapabilityReconnect(
      agent,
      activeConnectors,
      satisfiedCapabilities,
    );
    const isLiveSkillBound =
      agent.runtime === "live" &&
      typeof agent.boundSkill === "string" &&
      agent.boundSkill.length > 0 &&
      requiresOk &&
      handoffCount === 0;
    // "connect to activate" wins over "ready/rooting" when a card's
    // liveRequires precondition is unfulfilled. The customer's next
    // step is to wire (or re-authorize) the integration; the agents page
    // surfaces that explicitly so the call to action is unambiguous.
    const status = requiresConnector
      ? connectPrompt(agent, { capabilityMissing })
      : isRooting
        ? agent.rootingNote ?? "Setting up — Plaino is getting ready."
        : isLiveSkillBound
          ? "Watching — ready when triggered"
          : handoffCount === 0
            ? "Setting up — first activity lands soon"
            : `Working — ${handoffCount} ${handoffCount === 1 ? "item" : "items"} surfaced`;
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
   *  satisfied its `liveRequires` precondition — either no connector is
   *  wired, or a connector is wired without the scope the capability
   *  needs. The grid renders this as a "connect to activate" affordance;
   *  the card's `status` string says which of the two it is. */
  needsConnector: boolean;
};
