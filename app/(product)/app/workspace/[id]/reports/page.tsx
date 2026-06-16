import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  PlainoMark,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { withRls } from "@/lib/db";
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
  right?: string;
}

// Reports — the J4 hub: "Did I get my money's worth, and is everything safe?"
// Collapses Weekly report + Briefings + Compliance into one door. The weekly
// value report stays at /reports/weekly (the Friday email's one-click
// unsubscribe targets its #email-preferences anchor — that route must not move
// or break), and this index promotes it to the top, with the compliance
// assurance and briefings folded in alongside.
export default async function ReportsHubPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const ctx = { userId: member.userId, workspaceId, isOperator: false };
  const partner = servicePartnerForWorkspace(workspaceId);
  const base = `/app/workspace/${workspaceId}`;

  const openFlags = await withRls(ctx, (tx) =>
    tx.complianceFlag.count({ where: { workspaceId, state: "OPEN" } }),
  ).catch(() => 0);

  const sections: SectionLink[] = [
    {
      href: `${base}/reports/weekly`,
      label: "this week's value report",
      description: `Everything ${partner} did for you this week — drafts, approvals, hours and dollars — the same summary that lands in your inbox every Friday.`,
    },
    {
      href: `${base}/compliance`,
      label: "compliance & safety",
      description:
        "What we checked and anything that needs a look, so nothing slips through.",
      right: openFlags > 0 ? `${openFlags} need a look` : "all clear",
    },
    {
      href: `${base}/briefings`,
      label: "briefings",
      description: `Your daily and weekly briefs from ${partner} — the short "here's what's going on" read.`,
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <PlainoMark size={32} alt={partner} />
        <ApEyebrow className="mb-0">reports</ApEyebrow>
      </div>
      <h1 className="mt-3 font-display text-3xl text-ink">
        Your money&rsquo;s worth — and proof nothing slipped.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        The value {partner} delivered, and the checks that keep your business
        safe. All pulled straight from your workspace.
      </p>

      <section className="mt-10">
        <ApHairlineList aria-label="Reports sections">
          {sections.map((s) => (
            <ApHairlineRow
              key={s.label}
              right={<span>{s.right ?? "open →"}</span>}
            >
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
    </div>
  );
}
