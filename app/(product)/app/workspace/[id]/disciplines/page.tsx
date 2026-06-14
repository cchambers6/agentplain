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

// Customer-readable one-liner matching Plaino state vocabulary.
// Workers = agents + skills — both count, the customer doesn't care which.
// Fix 6: "active with 0 agents" was a UX model issue; agentCount=0 +
// skillCount>0 is a skill-driven discipline, still correctly "active".
// Removing the raw agent/skill/connected counter grid (Fix 2) and
// replacing with this sentence resolves the misleading "AGENTS 0" display.
function customerStatusSentence(card: {
  status: CardStatus;
  enabled: boolean;
  agentCount: number;
  skillCount: number;
  connectedCount: number;
  availableCount: number;
}): string {
  if (!card.enabled) return "Paused";
  const workers = card.agentCount + card.skillCount;
  const w = workers === 1 ? "1 worker" : `${workers} workers`;
  if (card.status === "build-pending") return "Setting up";
  if (card.status === "connector-needed") {
    return card.availableCount > 0
      ? `${w} · 0 of ${card.availableCount} connections live`
      : `${w} · connection needed`;
  }
  // active — connectedCount > 0 guaranteed by deriveStatus
  if (card.availableCount === 0 || card.connectedCount >= card.availableCount) {
    return workers === 0
      ? "Working · all connections live"
      : `Working · ${w}, all connections live`;
  }
  return `${w} · ${card.connectedCount} of ${card.availableCount} connections live`;
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
    agentCount: number;
    skillCount: number;
    connectedCount: number;
    availableCount: number;
    status: CardStatus;
    enabled: boolean;
    firstNeededConnector: { id: string; name: string } | null;
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
    // First available-but-unconnected connector for the discipline (Fix 3).
    const firstNeeded =
      status === "connector-needed"
        ? (entriesForD.find(
            (e) =>
              e.providerKey !== null &&
              !connectedProviders.has(e.providerKey) &&
              isIntegrationConfigured(e) &&
              e.status === "available",
          ) ?? null)
        : null;
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      agentCount,
      skillCount,
      connectedCount,
      availableCount,
      status,
      enabled,
      firstNeededConnector: firstNeeded
        ? { id: firstNeeded.id, name: firstNeeded.name }
        : null,
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
            {/* Fix 1 — eyebrow removed; card.iconKey was a Lucide slug being
                rendered as visible text ("bar-chart", "book-open", etc.).
                The discipline name below is sufficient. */}
            <header>
              <h2 className="font-display text-2xl text-ink">
                {card.name}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                {card.description}
              </p>
            </header>

            {/* Fix 2 — single customer-meaningful sentence replaces the
                AGENTS / SKILLS / CONNECTED three-counter grid.
                Fix 6 — "active with 0 agents" was UX modeling: skill-only
                disciplines are correctly active; the old grid surfaced
                "AGENTS 0" which looked broken. Workers = agents + skills. */}
            <p
              className={[
                "flex items-center gap-2 text-[13px]",
                card.status === "active" && card.enabled
                  ? "text-ink"
                  : "text-mute",
              ].join(" ")}
              data-status={card.status}
            >
              <span
                aria-hidden
                className={[
                  "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                  card.status === "active" && card.enabled
                    ? "bg-clay"
                    : "bg-rule",
                ].join(" ")}
              />
              {customerStatusSentence(card)}
            </p>

            {/* Fix 3 — "CONNECTOR NEEDED" status label replaced with
                a named, actionable button that routes to the connector page. */}
            {card.status === "connector-needed" ? (
              card.firstNeededConnector ? (
                <ApHeritageButton
                  variant="primary"
                  withArrow
                  href={`/app/workspace/${workspaceId}/integrations/${card.firstNeededConnector.id}`}
                >
                  Connect {card.firstNeededConnector.name} to start
                </ApHeritageButton>
              ) : (
                <ApHeritageButton
                  variant="secondary"
                  withArrow
                  href={`/app/workspace/${workspaceId}/integrations`}
                >
                  View integrations
                </ApHeritageButton>
              )
            ) : null}

            {/* Fix 4+5 — iOS toggle replaces button+redundant state text.
                "See activity →" replaces passive "open detail". */}
            <footer className="mt-auto flex flex-wrap items-center gap-4 border-t border-rule pt-4">
              <Link
                href={`/app/workspace/${workspaceId}/disciplines/${card.id}`}
                className="inline-flex min-h-[44px] items-center justify-center border border-ink bg-paper px-3 py-2 font-sans text-sm text-ink underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                See activity →
              </Link>
              <form
                action={toggleDisciplineAction}
                className="flex items-center gap-2.5"
              >
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <input type="hidden" name="discipline" value={card.id} />
                <input
                  type="hidden"
                  name="enabled"
                  value={card.enabled ? "false" : "true"}
                />
                <button
                  type="submit"
                  role="switch"
                  aria-checked={card.enabled}
                  aria-label={`${card.name} is ${card.enabled ? "on" : "off"} — tap to ${card.enabled ? "turn off" : "turn on"}`}
                  className={[
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
                    "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                    card.enabled ? "bg-clay" : "bg-rule",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={[
                      "pointer-events-none inline-block h-5 w-5 rounded-full bg-paper shadow ring-0 transition-transform duration-200",
                      card.enabled ? "translate-x-5" : "translate-x-0",
                    ].join(" ")}
                  />
                </button>
                <span
                  aria-hidden
                  className="select-none font-sans text-[13px] text-ink-soft"
                >
                  {card.enabled ? "On" : "Off"}
                </span>
              </form>
            </footer>
          </article>
        ))}
      </div>

      <ApPaperCard className="mt-10" density="dense">
        <p className="text-[14px] leading-relaxed text-ink-soft">
          A discipline shows <span className="text-ink">Working</span>{" "}
          only when a real connector is connected AND a real agent or
          skill is wired up for this vertical. Anything less shows{" "}
          <span className="text-ink">connect to start</span> or{" "}
          <span className="text-ink">Setting up</span>. We do not claim
          live work that is not running.
        </p>
      </ApPaperCard>
    </div>
  );
}
