import Link from "next/link";
import {
  ApEyebrow,
  ApHeritageButton,
  ApPaperCard,
  PlainoStatus,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { listDisciplines, type DisciplineId } from "@/lib/disciplines";
import {
  getActivationState,
  isDisciplineEnabled,
} from "@/lib/disciplines/activation";
import {
  AGENT_DISCIPLINE,
  SKILL_DISCIPLINE,
} from "@/lib/disciplines/skill-mapping";
import {
  entriesForDiscipline,
  entryAppliesToVertical,
} from "@/lib/integrations/marketplace";
import { isIntegrationConfigured } from "@/lib/integrations/config-status";
import { getVerticalContent } from "@/lib/verticals";
import { toggleDisciplineAction } from "./actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

// Status the card surfaces — derived from actual wiring, never a label.
// - `active`             : ≥1 connected credential for the discipline AND
//                          ≥1 mapped agent/skill exists in the workspace.
// - `connector-needed`   : ≥1 mapped agent/skill exists, but no relevant
//                          connector is connected yet.
// - `build-pending`      : no mapped agent/skill for the workspace's
//                          vertical AND no connected credentials touch this
//                          discipline — the panel still surfaces the card
//                          (so the customer sees the surface) but states
//                          the truth.
type CardStatus = "active" | "connector-needed" | "build-pending";

interface CardInput {
  id: DisciplineId;
  agentCount: number;
  skillCount: number;
  connectedCount: number;
  availableCount: number;
  enabled: boolean;
}

function deriveStatus(card: CardInput): CardStatus {
  const hasFleet = card.agentCount + card.skillCount > 0;
  if (hasFleet && card.connectedCount > 0) return "active";
  if (hasFleet) return "connector-needed";
  return "build-pending";
}

function statusLabel(status: CardStatus): string {
  if (status === "active") return "active";
  if (status === "connector-needed") return "connector needed";
  return "build pending";
}

export default async function DisciplinesPanelPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [workspace, credentials, activation] = await Promise.all([
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
    getActivationState(ctx, workspaceId),
  ]);

  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const content = getVerticalContent(verticalSlug);
  const roster = content?.agentRoster ?? [];

  // Pre-compute discipline → agentCount from the vertical's roster.
  const agentCounts = new Map<DisciplineId, number>();
  for (const entry of roster) {
    const d = AGENT_DISCIPLINE[entry.slug];
    if (!d) continue;
    agentCounts.set(d, (agentCounts.get(d) ?? 0) + 1);
  }

  // Skill counts pull from the catalog, scoped to skills that ship for
  // this vertical OR are horizontal (`vertical: 'all'`). Lazy-import to
  // dodge a server-component cycle if any.
  const { SKILL_CATALOG } = await import("@/lib/skills/registry");
  const skillCounts = new Map<DisciplineId, number>();
  for (const skill of SKILL_CATALOG) {
    if (skill.vertical !== "all" && skill.vertical !== verticalSlug) continue;
    const d = SKILL_DISCIPLINE[skill.slug];
    if (!d) continue;
    skillCounts.set(d, (skillCounts.get(d) ?? 0) + 1);
  }

  // Connected providers for the workspace — connection status is one of
  // the two inputs to a discipline's "active" verdict.
  const connectedProviders = new Set(credentials.map((c) => c.provider));

  const disciplines = listDisciplines();
  const cards: Array<{
    id: DisciplineId;
    name: string;
    description: string;
    iconKey: string;
    agentCount: number;
    skillCount: number;
    connectedCount: number;
    availableCount: number;
    status: CardStatus;
    enabled: boolean;
  }> = disciplines.map((d) => {
    const entriesForD = entriesForDiscipline(d.id).filter((e) =>
      entryAppliesToVertical(e, verticalSlug),
    );
    const connectedCount = entriesForD.filter(
      (e) =>
        e.providerKey !== null && connectedProviders.has(e.providerKey),
    ).length;
    const availableCount = entriesForD.filter(
      (e) => e.status === "available" && isIntegrationConfigured(e),
    ).length;
    const agentCount = agentCounts.get(d.id) ?? 0;
    const skillCount = skillCounts.get(d.id) ?? 0;
    const enabled = isDisciplineEnabled(activation, d.id);
    const status = deriveStatus({
      id: d.id,
      agentCount,
      skillCount,
      connectedCount,
      availableCount,
      enabled,
    });
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      iconKey: d.iconKey,
      agentCount,
      skillCount,
      connectedCount,
      availableCount,
      status,
      enabled,
    };
  });

  return (
    <div>
      <ApEyebrow className="mb-3">your disciplines</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        Eight disciplines, one service partner.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Plaino runs your fleet across eight disciplines — analytics,
        research, legal, marketing, sales, customer success, finance,
        and operations. Each card shows what is wired up, what is waiting
        on a connection, and what is still being built. Turn a discipline
        off and Plaino stops surfacing work in it.
      </p>

      <p className="mt-4 flex max-w-2xl items-center gap-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        <PlainoStatus state="herd" size={16} />
        <span>herded by Plaino</span>
      </p>

      <div
        className="mt-8 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-2"
        role="list"
        aria-label="Disciplines"
      >
        {cards.map((card) => (
          <article
            key={card.id}
            role="listitem"
            className="flex flex-col gap-4 bg-paper p-6"
          >
            <header>
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                {card.iconKey}
              </p>
              <h2 className="mt-2 font-display text-2xl text-ink">
                {card.name}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                {card.description}
              </p>
            </header>

            <dl className="grid grid-cols-3 gap-4 border-t border-rule pt-4 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              <div>
                <dt className="text-mute">agents</dt>
                <dd
                  className="mt-1 font-display text-xl text-ink"
                  aria-label={`${card.agentCount} agents`}
                >
                  {card.agentCount}
                </dd>
              </div>
              <div>
                <dt className="text-mute">skills</dt>
                <dd
                  className="mt-1 font-display text-xl text-ink"
                  aria-label={`${card.skillCount} skills`}
                >
                  {card.skillCount}
                </dd>
              </div>
              <div>
                <dt className="text-mute">connected</dt>
                <dd
                  className="mt-1 font-display text-xl text-ink"
                  aria-label={`${card.connectedCount} connectors connected`}
                >
                  {card.connectedCount}
                </dd>
              </div>
            </dl>

            <p
              className={[
                "inline-flex items-center gap-2 self-start font-mono text-[11px] tracking-eyebrow uppercase",
                card.status === "active" ? "text-ink" : "text-mute",
              ].join(" ")}
              data-status={card.status}
            >
              <span
                aria-hidden
                className={[
                  "inline-block h-1.5 w-1.5",
                  card.status === "active" ? "bg-clay" : "bg-rule",
                ].join(" ")}
              />
              status · {statusLabel(card.status)}
            </p>

            <footer className="mt-auto flex flex-wrap items-center gap-3 border-t border-rule pt-4">
              <Link
                href={`/app/workspace/${workspaceId}/disciplines/${card.id}`}
                className="inline-flex min-h-[44px] items-center justify-center border border-ink bg-paper px-3 py-2 font-sans text-sm text-ink underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                aria-label={`Open ${card.name} detail`}
              >
                open detail
              </Link>
              <form action={toggleDisciplineAction}>
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="discipline" value={card.id} />
                <input
                  type="hidden"
                  name="enabled"
                  value={card.enabled ? "false" : "true"}
                />
                {card.enabled ? (
                  <ApHeritageButton variant="secondary" type="submit">
                    turn off
                  </ApHeritageButton>
                ) : (
                  <ApHeritageButton variant="primary" type="submit">
                    turn on
                  </ApHeritageButton>
                )}
              </form>
              <span
                className="font-mono text-[11px] tracking-eyebrow uppercase text-mute"
                aria-label={`Discipline is ${card.enabled ? "on" : "off"}`}
              >
                {card.enabled ? "on" : "off"}
              </span>
            </footer>
          </article>
        ))}
      </div>

      <ApPaperCard className="mt-10" density="dense">
        <p className="text-[14px] leading-relaxed text-ink-soft">
          A discipline can show <span className="font-mono text-ink">active</span>{" "}
          only when a real connector is connected AND a real agent or
          skill is wired up for this vertical. Anything less reads{" "}
          <span className="font-mono text-ink">connector needed</span> or{" "}
          <span className="font-mono text-ink">build pending</span>. We do
          not claim live work that is not running.
        </p>
      </ApPaperCard>
    </div>
  );
}
