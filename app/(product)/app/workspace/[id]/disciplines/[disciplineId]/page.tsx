import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ApHairlineList,
  ApHairlineRow,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { asDisciplineId, getDiscipline } from "@/lib/disciplines";
import {
  AGENT_DISCIPLINE,
  SKILL_DISCIPLINE,
} from "@/lib/disciplines/skill-mapping";
import {
  entriesForDiscipline,
  entryAppliesToVertical,
} from "@/lib/integrations/marketplace";
import { isIntegrationConfigured } from "@/lib/integrations/config-status";
import { buildSkillScorecard, type SkillScorecard } from "@/lib/skills/skill-scorecard";
import { getVerticalContent } from "@/lib/verticals";

interface PageProps {
  params: Promise<{ id: string; disciplineId: string }>;
}

export const dynamic = "force-dynamic";

export default async function DisciplineDetailPage({ params }: PageProps) {
  const { id: workspaceId, disciplineId } = await params;
  const validId = asDisciplineId(disciplineId);
  if (!validId) notFound();
  const discipline = getDiscipline(validId);
  if (!discipline) notFound();

  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };

  const [workspace, recentApprovals, credentials] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { vertical: true },
      }),
    ),
    withRls(ctx, (tx) =>
      tx.workApprovalQueueItem.findMany({
        where: { workspaceId, discipline: validId },
        orderBy: { proposedAt: "desc" },
        take: 20,
      }),
    ),
    withRls(ctx, (tx) =>
      tx.integrationCredential.findMany({
        where: { workspaceId, status: "ACTIVE" },
        select: { provider: true },
      }),
    ),
  ]);

  const verticalSlug = verticalSlugFromEnum(workspace.vertical);
  const connectors = entriesForDiscipline(validId).filter((e) =>
    entryAppliesToVertical(e, verticalSlug),
  );
  const connectedProviders = new Set(credentials.map((c) => c.provider));

  const content = getVerticalContent(verticalSlug);
  const roster = content?.agentRoster ?? [];
  const agentsForDiscipline = roster.filter(
    (a) => AGENT_DISCIPLINE[a.slug] === validId,
  );

  const { SKILL_CATALOG } = await import("@/lib/skills/registry");
  const skillsForDiscipline = SKILL_CATALOG.filter(
    (s) =>
      (s.vertical === "all" || s.vertical === verticalSlug) &&
      SKILL_DISCIPLINE[s.slug] === validId,
  );

  // Build per-skill scorecards in parallel. Each card consults
  // WorkApprovalQueueItem + WorkspaceSkillInstallation +
  // WorkspaceMemoryEntry under RLS.
  const scorecards: SkillScorecard[] = await withRls(ctx, async (tx) =>
    Promise.all(
      skillsForDiscipline.map((s) =>
        buildSkillScorecard({
          tx,
          workspaceId,
          skillSlug: s.slug,
          disciplineId: validId,
        }),
      ),
    ),
  );
  // Pair each card with its catalog entry (name + runtime status).
  const scorecardEntries = skillsForDiscipline.map((s, i) => ({
    catalog: s,
    card: scorecards[i],
  }));

  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        <Link
          href={`/app/workspace/${workspaceId}/disciplines`}
          className="underline-offset-4 hover:underline"
        >
          ← all disciplines
        </Link>
      </p>
      <h1 className="font-display text-3xl text-ink mt-3">{discipline.name}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        {discipline.description}
      </p>

      <section className="mt-10" aria-labelledby="connectors-heading">
        <h2
          id="connectors-heading"
          className="font-mono text-[11px] tracking-eyebrow uppercase text-mute"
        >
          connectors this discipline reads from
        </h2>
        {connectors.length === 0 ? (
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-mute">
            No connectors map to this discipline for your vertical yet.
            Your service partner adds these as the integration roadmap
            rolls out.
          </p>
        ) : (
          <ApHairlineList className="mt-3" aria-label="Connectors">
            {connectors.map((c) => {
              const connected =
                c.providerKey !== null && connectedProviders.has(c.providerKey);
              const configured = isIntegrationConfigured(c);
              const stateLabel = connected
                ? "connected"
                : c.status === "coming-soon"
                  ? "coming soon"
                  : configured
                    ? "ready to connect"
                    : "your service partner wires this";
              return (
                <ApHairlineRow
                  key={c.id}
                  right={
                    <span className="font-mono text-[11px] uppercase text-mute">
                      {stateLabel}
                    </span>
                  }
                >
                  <div>
                    <p className="font-display text-lg text-ink">{c.name}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                      {c.description}
                    </p>
                  </div>
                </ApHairlineRow>
              );
            })}
          </ApHairlineList>
        )}
      </section>

      <section className="mt-10" aria-labelledby="fleet-heading">
        <h2
          id="fleet-heading"
          className="font-mono text-[11px] tracking-eyebrow uppercase text-mute"
        >
          agents + skills in {discipline.name.toLowerCase()}
        </h2>
        {agentsForDiscipline.length === 0 && skillsForDiscipline.length === 0 ? (
          <ApRootedEmptyState
            motif="lone-tree"
            reality={`Nothing in this discipline for your vertical yet.`}
            change={`Your service partner adds capabilities here as the per-vertical fleet rolls out.`}
          />
        ) : (
          <ApHairlineList className="mt-3" aria-label="Fleet">
            {agentsForDiscipline.map((a) => (
              <ApHairlineRow
                key={`agent-${a.slug}`}
                right={
                  <span className="font-mono text-[11px] uppercase text-mute">
                    {a.runtime === "live" ? "live" : "rooting"}
                  </span>
                }
              >
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {a.slug}
                  </p>
                  <p className="mt-1 font-display text-lg text-ink">{a.name}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                    {a.job}
                  </p>
                </div>
              </ApHairlineRow>
            ))}
            {skillsForDiscipline.map((s) => (
              <ApHairlineRow
                key={`skill-${s.slug}`}
                right={
                  <span className="font-mono text-[11px] uppercase text-mute">
                    skill · {s.kind}
                  </span>
                }
              >
                <div>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {s.slug}
                  </p>
                  <p className="mt-1 font-display text-lg text-ink">{s.name}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                    {s.description}
                  </p>
                </div>
              </ApHairlineRow>
            ))}
          </ApHairlineList>
        )}
      </section>

      <section className="mt-10" aria-labelledby="scorecard-heading">
        <h2
          id="scorecard-heading"
          className="font-mono text-[11px] tracking-eyebrow uppercase text-mute"
        >
          scorecard — skills in {discipline.name.toLowerCase()}
        </h2>
        {scorecardEntries.length === 0 ? (
          <ApRootedEmptyState
            motif="horizon"
            reality={`No skills live in this discipline for your vertical yet.`}
            change={`Once a discipline-tagged skill ships, its draft + acceptance + last-fire numbers will land here.`}
          />
        ) : (
          <ApHairlineList className="mt-3" aria-label="Skill scorecards">
            {scorecardEntries.map(({ catalog, card }) => {
              const lastFireLabel =
                card.lastFireIso === null
                  ? "never"
                  : new Date(card.lastFireIso).toLocaleString();
              const acceptanceLabel =
                card.acceptanceRate7d === null
                  ? "—"
                  : `${Math.round(card.acceptanceRate7d * 100)}%`;
              const installLabel =
                card.installState === "installed"
                  ? "installed"
                  : card.installState === "uninstalled"
                    ? "uninstalled"
                    : "not installed";
              const isRooted =
                card.installState !== "installed" || card.draftsLast7d === 0;
              return (
                <ApHairlineRow
                  key={`scorecard-${catalog.slug}`}
                  right={
                    <span className="font-mono text-[11px] uppercase text-mute">
                      {installLabel}
                    </span>
                  }
                >
                  <div>
                    <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                      {catalog.slug}
                    </p>
                    <p className="mt-1 font-display text-lg text-ink">
                      {catalog.name}
                    </p>
                    {isRooted ? (
                      <p className="mt-2 text-[13px] leading-relaxed text-mute">
                        {card.installState !== "installed"
                          ? `Not running on your workspace yet — install from /marketplace to bring it into the fleet.`
                          : `Installed — nothing fired in the last 7 days yet.`}
                      </p>
                    ) : (
                      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] text-ink-soft md:grid-cols-4">
                        <div>
                          <dt className="font-mono text-[10px] uppercase text-mute">
                            drafts · 7d
                          </dt>
                          <dd className="text-ink">{card.draftsLast7d}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[10px] uppercase text-mute">
                            accepted · 7d
                          </dt>
                          <dd className="text-ink">{acceptanceLabel}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[10px] uppercase text-mute">
                            last fire
                          </dt>
                          <dd className="text-ink">{lastFireLabel}</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[10px] uppercase text-mute">
                            rules applied
                          </dt>
                          <dd className="text-ink">
                            {card.feedbackRuleCount}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                </ApHairlineRow>
              );
            })}
          </ApHairlineList>
        )}
      </section>

      <section className="mt-10" aria-labelledby="recent-heading">
        <h2
          id="recent-heading"
          className="font-mono text-[11px] tracking-eyebrow uppercase text-mute"
        >
          recent approvals in {discipline.name.toLowerCase()}
        </h2>
        {recentApprovals.length === 0 ? (
          <ApRootedEmptyState
            motif="horizon"
            reality="Nothing landed in this discipline yet."
            change={`Items appear here as ${discipline.name.toLowerCase()} work flows into your approval queue.`}
          />
        ) : (
          <ApHairlineList className="mt-3" aria-label="Recent approvals">
            {recentApprovals.map((item) => (
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
                    {item.kind} · {item.agentSlug}
                  </p>
                  <p className="mt-1 text-[14px] text-ink">
                    {item.refTable}:{item.refId}
                  </p>
                </div>
              </ApHairlineRow>
            ))}
          </ApHairlineList>
        )}
        {recentApprovals.length > 0 ? (
          <p className="mt-4">
            <Link
              href={`/app/workspace/${workspaceId}/approvals?discipline=${validId}`}
              className="font-mono text-[12px] tracking-eyebrow uppercase text-ink underline-offset-4 hover:underline"
            >
              open the full queue →
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
