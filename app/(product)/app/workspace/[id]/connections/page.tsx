import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApHeritageButton,
  ApHeritageGrid,
  ApHeritageGridCell,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import {
  listIntegrations,
  entryAppliesToVertical,
  entrySourcing,
} from "@/lib/integrations/marketplace";
import { listWeBringServices } from "@/lib/integrations/wb";
import { recommendedConnectorsFor } from "@/lib/integrations/recommendations";
import { listDisciplines } from "@/lib/disciplines";
import { getVerticalContent } from "@/lib/verticals";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface SectionLink {
  href: string;
  label: string;
  description: string;
}

// Connections — the J3 hub: "What can Plaino do, and is it wired into my
// tools?" One door for the three things that used to be four separate tabs
// (Integrations, Marketplace, Agents, Disciplines). This is the Phase-A shell:
// it gives the five-tab IA a real home for the "setup" job and routes into the
// existing detail surfaces, leading with the customer's connected tools.
export default async function ConnectionsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);
  const base = `/app/workspace/${workspaceId}`;

  const [connectedCount, workspaceRow] = await Promise.all([
    withRls(ctx, (tx) =>
      tx.integrationCredential.count({ where: { workspaceId } }),
    ),
    withRls(ctx, (tx) =>
      tx.workspace.findUnique({
        where: { id: workspaceId },
        select: { vertical: true },
      }),
    ),
  ]);

  const verticalSlug = workspaceRow
    ? verticalSlugFromEnum(workspaceRow.vertical)
    : null;
  // How many tools Plaino *could* read from for this business — the honest
  // denominator behind "X of Y connected".
  const verticalEntries = listIntegrations().filter((entry) =>
    verticalSlug ? entryAppliesToVertical(entry, verticalSlug) : true,
  );
  const availableCount = verticalEntries.length;
  const areaCount = listDisciplines().length;
  // The BYO / we-bring split, for the "who pays for what" door.
  const youBringCount = verticalEntries.filter(
    (entry) => entrySourcing(entry) === "byo",
  ).length;
  const weBringCount = listWeBringServices().length;

  // Vertical-aware "connect this first" guidance, led by the connector that
  // unlocks this business's killer workflow. The owner shouldn't have to
  // guess which of N tiles matters most.
  const recs = recommendedConnectorsFor(workspaceRow?.vertical ?? null);
  // The public per-vertical landing page — handy for showing a teammate
  // what their service covers (deliverable: workspace → landing-page link).
  const verticalContent = verticalSlug ? getVerticalContent(verticalSlug) : null;
  const verticalName = verticalContent?.name ?? null;
  const verticalPublicHref = verticalSlug ? `/${verticalSlug}` : null;

  const sections: SectionLink[] = [
    {
      href: `${base}/integrations`,
      label: "your connected tools",
      description:
        "Connect Gmail, QuickBooks, your CRM and more — and reconnect anything that needs it. The more Plaino can read, the more it can do.",
    },
    {
      href: `${base}/marketplace`,
      label: "add capabilities",
      description:
        "Browse everything Plaino can do and turn capabilities on or off for your business.",
    },
    {
      href: `${base}/agents`,
      label: "what Plaino covers",
      description:
        "See the work your service team handles for you, and what each area needs to start.",
    },
    {
      href: `${base}/disciplines`,
      label: "coverage by area",
      description:
        "Turn whole areas of work — like finance, marketing, or legal — on or off.",
    },
    {
      href: `${base}/team`,
      label: "your team",
      description:
        "Invite teammates, set what each person can do, see who's handling what, and generate a new-hire playbook.",
    },
  ];

  return (
    <div>
      <ApEyebrow className="mb-3">connections</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        What {partner} is wired into.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        {partner} can only act on what it can see. Connect your tools here so
        the work actually gets done — and check what your service covers.
      </p>

      <section className="mt-8">
        <ApEyebrow className="mb-3">your setup</ApEyebrow>
        <ApHeritageGrid columnsClass="grid-cols-1 sm:grid-cols-3">
          <ApHeritageGridCell
            label="tools connected"
            value={String(connectedCount)}
          />
          <ApHeritageGridCell
            label="tools available"
            value={String(availableCount)}
          />
          <ApHeritageGridCell
            label="areas of work"
            value={String(areaCount)}
          />
        </ApHeritageGrid>
      </section>

      <section className="mt-10">
        <ApEyebrow className="mb-3">who pays for what</ApEyebrow>
        <div className="border border-rule bg-paper p-5">
          <p className="max-w-2xl text-[13px] leading-relaxed text-ink-soft">
            <strong className="text-ink">{youBringCount} tools you bring</strong>{" "}
            — your own accounts, your own vendor bills. And{" "}
            <strong className="text-ink">{weBringCount} services we bring</strong>{" "}
            — run on our accounts, most included in your plan, a few passed
            through at our cost. Here is the honest split.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <ApHeritageButton
              variant="secondary"
              withArrow
              href={`${base}/connections/sourcing`}
            >
              see what you bring vs what we bring
            </ApHeritageButton>
            <ApHeritageButton
              variant="secondary"
              withArrow
              href={`${base}/usage/connections`}
            >
              connection costs
            </ApHeritageButton>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <ApEyebrow className="mb-3">recommended to connect first</ApEyebrow>
        <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-mute">
          Built for {verticalName ?? "your business"}. Connecting the first
          one turns on the single most valuable thing {partner} does for you.
        </p>

        {recs.primary ? (
          <div className="border border-ink bg-paper-deep p-5">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              unlocks · {recs.killerWorkflowHeadline}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-display text-lg leading-tight text-ink">
                {recs.primary.name}
              </p>
              <span className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                {recs.primary.category}
                {recs.primary.status !== "available"
                  ? ` · ${recs.primary.status}`
                  : ""}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
              {recs.primary.reason}.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ApHeritageButton
                variant="primary"
                withArrow
                href={`${base}/integrations/${recs.primary.id}`}
              >
                connect {recs.primary.name}
              </ApHeritageButton>
              <ApHeritageButton
                variant="secondary"
                withArrow
                href={`${base}/demo`}
              >
                see it run on sample data
              </ApHeritageButton>
            </div>
          </div>
        ) : null}

        {recs.others.length > 0 ? (
          <ApHairlineList
            aria-label="Other recommended connectors"
            className="mt-4"
          >
            {recs.others.map((rec) => (
              <ApHairlineRow
                key={rec.id}
                right={
                  rec.status === "available" ? (
                    <Link
                      href={`${base}/integrations/${rec.id}`}
                      className="font-mono text-[11px] tracking-eyebrow uppercase text-ink underline-offset-4 hover:underline"
                    >
                      connect →
                    </Link>
                  ) : (
                    <span className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                      coming soon
                    </span>
                  )
                }
              >
                <p className="font-display text-base leading-tight text-ink">
                  {rec.name}
                  <span className="ml-2 font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                    {rec.category}
                  </span>
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-mute">
                  {rec.reason}
                </p>
              </ApHairlineRow>
            ))}
          </ApHairlineList>
        ) : null}
      </section>

      <section className="mt-10">
        <ApEyebrow className="mb-3">manage</ApEyebrow>
        <ApHairlineList aria-label="Connection sections">
          {sections.map((s) => (
            <ApHairlineRow key={s.label} right={<span>open →</span>}>
              <Link href={s.href} className="block">
                <p className="font-display text-base leading-tight text-ink">
                  {s.label}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-mute">
                  {s.description}
                </p>
              </Link>
            </ApHairlineRow>
          ))}
        </ApHairlineList>
      </section>

      <div className="mt-10 border-t border-rule pt-6">
        <p className="max-w-2xl text-[13px] leading-relaxed text-mute">
          Not sure what to connect first? Ask {partner} in the Plaino tab — it
          will tell you exactly which tool unlocks the most for your business.
        </p>
        {verticalPublicHref ? (
          <p className="mt-3 text-[13px] leading-relaxed text-mute">
            Want to show a teammate what {partner} does for{" "}
            {verticalName ?? "your business"}?{" "}
            <Link
              href={verticalPublicHref}
              className="text-ink underline-offset-4 hover:underline"
            >
              see your public {verticalName ?? "vertical"} page →
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
