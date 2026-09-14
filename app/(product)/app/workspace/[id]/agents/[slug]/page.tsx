import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApHeritageButton,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import {
  entryForProviderKey,
  type MarketplaceProviderKey,
} from "@/lib/integrations/marketplace";
import { getCalendarConnectorState } from "@/lib/skills/scheduler/calendar-multiplex-fetcher";
import { getVerticalContent } from "@/lib/verticals";
import {
  connectPrompt,
  liveRequiresSatisfied,
  needsCapabilityReconnect,
  type RosterCapability,
} from "../live-requires";

interface PageProps {
  params: Promise<{ id: string; slug: string }>;
}

export default async function AgentDetailPage({ params }: PageProps) {
  const { id: workspaceId, slug: agentSlug } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [
    pendingItems,
    recentHandoffs,
    workspace,
    activeConnectorRows,
    calendarState,
  ] = await Promise.all([
      withRls(ctx, (tx) =>
        tx.workApprovalQueueItem.findMany({
          where: { workspaceId, agentSlug, status: "PENDING" },
          orderBy: { proposedAt: "desc" },
          take: 10,
        }),
      ),
      withRls(ctx, (tx) =>
        tx.handoffLogEntry.findMany({
          where: {
            workspaceId,
            OR: [{ fromAgent: agentSlug }, { toAgent: agentSlug }],
          },
          orderBy: { occurredAt: "desc" },
          take: 20,
        }),
      ),
      withRls(ctx, (tx) =>
        tx.workspace.findUniqueOrThrow({
          where: { id: workspaceId },
          select: { vertical: true },
        }),
      ),
      withRls(ctx, (tx) =>
        tx.integrationCredential.findMany({
          where: { workspaceId, status: "ACTIVE" },
          select: { provider: true },
        }),
      ),
      // Capability check — see the note on the fleet page. Runs under the
      // MEMBER's RLS context, not the cron's system context.
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

  // Resolve the slug to its human name + job from the workspace's vertical
  // roster. Unknown slugs (e.g. a retired or runtime-only agent) fall back to
  // the raw slug so the page never breaks for an unmapped capability.
  const roster =
    getVerticalContent(verticalSlugFromEnum(workspace.vertical))?.agentRoster ??
    [];
  const agent = roster.find((a) => a.slug === agentSlug);

  // Same "connect to activate" derivation as the fleet grid: a live agent
  // whose liveRequires connectors aren't wired gets an actionable connect
  // CTA here — the grid's "Needs a connector" badge lands on this page, so
  // this is where the customer's next step must be clickable.
  const activeConnectors = new Set<string>(
    activeConnectorRows.map((r) => r.provider),
  );
  const satisfiedCapabilities = new Set<RosterCapability>(
    calendarState.readiness.ready ? (["calendar"] as const) : [],
  );
  const neededConnectors =
    agent &&
    agent.runtime === "live" &&
    Array.isArray(agent.liveRequires?.connectors) &&
    !liveRequiresSatisfied(agent, activeConnectors, satisfiedCapabilities)
      ? agent.liveRequires.connectors
      : null;
  // Connector wired but capability missing: the customer already
  // connected this account. Sending them to the same Connect button
  // would show them a tile that already says "connected". They need to
  // re-authorize with calendar access.
  const capabilityMissing = agent
    ? needsCapabilityReconnect(agent, activeConnectors, satisfiedCapabilities)
    : false;
  const neededEntry =
    neededConnectors
      ?.map((key) =>
        entryForProviderKey(key as NonNullable<MarketplaceProviderKey>),
      )
      .find((entry) => entry !== null) ?? null;

  return (
    <div>
      <ApEyebrow className="mb-3">{agent?.name ?? agentSlug}</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        What this capability has been doing.
      </h1>
      {agent ? (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {agent.job}
        </p>
      ) : null}

      {agent?.runtime === "rooting" ? (
        <p className="mt-4 max-w-2xl border-l-2 border-rule pl-4 text-[13px] leading-relaxed text-mute">
          {agent.rootingNote ?? "Setting up — first activity lands soon."}
        </p>
      ) : null}

      {neededConnectors ? (
        <div className="mt-6">
          <ApHeritageButton
            variant="primary"
            withArrow
            href={
              neededEntry
                ? `/app/workspace/${workspaceId}/integrations/${neededEntry.id}`
                : `/app/workspace/${workspaceId}/integrations`
            }
          >
            {agent ? connectPrompt(agent, { capabilityMissing }) : null}
          </ApHeritageButton>
        </div>
      ) : null}

      <section className="mt-8">
        <ApEyebrow className="mb-3">
          awaiting your decision ({pendingItems.length})
        </ApEyebrow>
        {pendingItems.length === 0 ? (
          <ApRootedEmptyState
            motif="wheat"
            reality="Nothing waiting from this capability."
            change="Drafts queue here when this agent surfaces a decision above your threshold."
          />
        ) : (
          <ApHairlineList aria-label="Pending decisions">
            {pendingItems.map((item) => (
              <ApHairlineRow
                key={item.id}
                right={
                  <span className="font-mono text-[11px] uppercase text-mute">
                    {new Date(item.proposedAt).toLocaleString()}
                  </span>
                }
              >
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {item.kind}
                  </p>
                  <p className="mt-1 text-[15px] text-ink">
                    {item.refTable}:{item.refId}
                  </p>
                </div>
              </ApHairlineRow>
            ))}
          </ApHairlineList>
        )}
      </section>

      <section className="mt-10">
        <ApEyebrow className="mb-3">recent handoffs</ApEyebrow>
        {recentHandoffs.length === 0 ? (
          <ApRootedEmptyState
            motif="horizon"
            reality="No handoffs logged involving this capability yet."
            change="Handoffs land here as soon as the fleet routes work through this agent."
          />
        ) : (
          <ApHairlineList aria-label="Recent handoffs">
            {recentHandoffs.map((h) => (
              <ApHairlineRow
                key={h.id}
                right={
                  <span className="font-mono text-[11px] uppercase text-mute">
                    {new Date(h.occurredAt).toLocaleString()}
                  </span>
                }
              >
                <span className="text-ink-soft">
                  <span className="font-mono text-ink">{h.fromAgent}</span>
                  <span className="mx-2 text-mute">→</span>
                  <span className="font-mono text-ink">{h.toAgent}</span>
                  <span className="ml-2 text-mute">· {h.handoffType}</span>
                </span>
              </ApHairlineRow>
            ))}
          </ApHairlineList>
        )}
      </section>
    </div>
  );
}
