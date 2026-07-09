import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApHeritageGrid,
  ApHeritageGridCell,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withSystemContext } from "@/lib/db";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { countDemoRecords } from "@/lib/onboarding/demo-seed";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SectionLink {
  /** Omitted for coming-soon rows — they render as a disabled label, never
   *  a clickable link, so there is no placeholder "#" href to dead-end on. */
  href?: string;
  label: string;
  description: string;
  status?: "available" | "coming-soon";
}

export default async function SettingsPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        tier: true,
        stateCode: true,
        billingMode: true,
        tierPriceUsdMonthly: true,
        createdAt: true,
      },
    }),
  );
  // notFound(), not a silent null: the bare return used to render a blank
  // pane with live nav around it (audit 2026-07-02 shell finding F3). The
  // workspace-level not-found boundary gives the designed dead-end instead.
  if (!workspace) notFound();

  const memberCount = await withSystemContext((tx) =>
    tx.membership.count({
      where: { workspaceId, status: "ACTIVE" },
    }),
  );

  const partner = servicePartnerForWorkspace(workspaceId);

  // First-5-min: only surface the demo-data control when sample data is
  // actually present (it auto-clears once real records land).
  const demoCount = await countDemoRecords(workspaceId);

  const sections: SectionLink[] = [
    {
      href: `/app/workspace/${workspaceId}/integrations`,
      label: "connections",
      description: "Connect or manage the tools your fleet reads from.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/work-thresholds`,
      label: "work thresholds",
      description:
        "Tell your service team which agent decisions need explicit ratification.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/autonomy`,
      label: "autonomy",
      description:
        "Choose which low-stakes, reversible actions flow through without your click — and the dollar ceiling each must stay under. Includes the log of everything done autonomously.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/skills`,
      label: "skill config",
      description:
        "Per-skill knobs — wait days for follow-ups, priority keywords for triage, default meeting length for the scheduler.",
    },
    {
      href: `/app/workspace/${workspaceId}/marketplace`,
      label: "marketplace",
      description:
        "Install or uninstall any skill in the catalog. Live skills install by default; schema-only carry a honest badge.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/billing`,
      label: "billing",
      description: "Plan, seats, invoices, payment method.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/pause`,
      label: "pause your fleet",
      description:
        "Schedule a vacation / PTO / cutover window. The fleet auto-resumes at the end.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/schedule`,
      label: "scheduling windows",
      description:
        "Constrain a skill to your business hours, weekdays only, or any window you choose.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/discipline-heads`,
      label: "discipline heads",
      description:
        "Nominate one person to approve everything in a given discipline — legal, finance, marketing. Each discipline can have a different head, or none.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/passkeys`,
      label: "sign-in & security",
      description: "Add a passkey for faster sign-in. Email links still work.",
    },
    {
      href: `/app/workspace/${workspaceId}/activity`,
      label: "activity",
      description: "Every handoff your fleet has executed.",
    },
    {
      href: `/app/workspace/${workspaceId}/data-rights`,
      label: "your data & rights",
      description:
        "What's yours, what we never do with it (no training, ever), and where it lives. Export everything or delete it, any time.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/data`,
      label: "export & close",
      description:
        "Export a copy of everything in this workspace, or close the workspace.",
    },
    {
      href: `/app/workspace/${workspaceId}/settings/voice`,
      label: "voice & templates",
      description:
        "How your fleet sounds in customer-facing drafts — your tone, the templates it learns from, and the corrections you've made.",
    },
    ...(demoCount > 0
      ? [
          {
            href: `/app/workspace/${workspaceId}/settings/demo`,
            label: "demo data",
            description:
              "The sample records we seeded so you could watch your first workflow run. Remove them any time — they also clear themselves once your real data lands.",
          } satisfies SectionLink,
        ]
      : []),
    {
      href: `/app/workspace/${workspaceId}/team`,
      label: "team members",
      description:
        "Add, remove, and assign roles. See who's handling what, and generate a new-hire playbook.",
    },
    {
      label: "notifications",
      description: "When your service team pings you and how.",
      status: "coming-soon",
    },
  ];

  return (
    <div>
      <ApEyebrow className="mb-3">settings</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">Workspace settings</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Tell {partner} how you like things. Every setting here is a note
        to your service team, not a knob you have to fiddle with.
      </p>

      <section className="mt-8">
        <ApEyebrow className="mb-3">workspace</ApEyebrow>
        <ApHeritageGrid columnsClass="grid-cols-1 sm:grid-cols-2">
          <ApHeritageGridCell label="workspace name" value={workspace.name} />
          <ApHeritageGridCell label="slug" value={workspace.slug} />
          <ApHeritageGridCell label="tier" value={workspace.tier} />
          <ApHeritageGridCell label="state" value={workspace.stateCode} />
          <ApHeritageGridCell
            label="billing mode"
            value={workspace.billingMode}
          />
          <ApHeritageGridCell
            label="active members"
            value={String(memberCount)}
          />
          <ApHeritageGridCell
            label="created"
            value={new Date(workspace.createdAt).toLocaleString()}
          />
        </ApHeritageGrid>
      </section>

      <section className="mt-10">
        <ApEyebrow className="mb-3">sections</ApEyebrow>
        <ApHairlineList aria-label="Settings sections">
          {sections.map((s) => (
            <ApHairlineRow
              key={s.label}
              right={
                s.status === "coming-soon" ? (
                  <span className="text-mute">coming soon</span>
                ) : (
                  <span>open →</span>
                )
              }
            >
              {s.href && s.status !== "coming-soon" ? (
                <Link href={s.href} className="block">
                  <p className="font-display text-base leading-tight text-ink">
                    {s.label}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-mute">
                    {s.description}
                  </p>
                </Link>
              ) : (
                <div aria-disabled={s.status === "coming-soon"}>
                  <p className="font-display text-base leading-tight text-ink">
                    {s.label}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-mute">
                    {s.description}
                  </p>
                </div>
              )}
            </ApHairlineRow>
          ))}
        </ApHairlineList>
      </section>

      <p className="mt-10 border-t border-rule pt-6 max-w-2xl text-[13px] leading-relaxed text-mute">
        Reach out to {partner}, your service partner, to change anything
        you don&rsquo;t see here.
      </p>
    </div>
  );
}
