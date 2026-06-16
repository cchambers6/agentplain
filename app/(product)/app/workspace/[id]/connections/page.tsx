import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApHeritageGrid,
  ApHeritageGridCell,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { listIntegrations, entryAppliesToVertical } from "@/lib/integrations/marketplace";
import { listDisciplines } from "@/lib/disciplines";
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
  const availableCount = listIntegrations().filter((entry) =>
    verticalSlug ? entryAppliesToVertical(entry, verticalSlug) : true,
  ).length;
  const areaCount = listDisciplines().length;

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

      <p className="mt-10 border-t border-rule pt-6 max-w-2xl text-[13px] leading-relaxed text-mute">
        Not sure what to connect first? Ask {partner} in the Plaino tab — it
        will tell you exactly which tool unlocks the most for your business.
      </p>
    </div>
  );
}
