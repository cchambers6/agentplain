import Link from "next/link";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { getBriefingsProvider } from "@/lib/notion";
import { getVerticalContent } from "@/lib/verticals";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkspaceOverviewPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const ctx = {
    userId: member.userId,
    workspaceId,
    isOperator: false,
  };

  const [pendingApprovals, openFlags, recentHandoffs, workspace, onboarding] =
    await Promise.all([
      withRls(ctx, (tx) =>
        tx.workApprovalQueueItem.count({
          where: { workspaceId, status: "PENDING" },
        }),
      ),
      withRls(ctx, (tx) =>
        tx.complianceFlag.count({
          where: { workspaceId, state: "OPEN" },
        }),
      ),
      withRls(ctx, (tx) =>
        tx.handoffLogEntry.findMany({
          where: { workspaceId },
          orderBy: { occurredAt: "desc" },
          take: 6,
        }),
      ),
      withRls(ctx, (tx) =>
        tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { vertical: true, verticalTier: true },
        }),
      ),
      withRls(ctx, (tx) =>
        tx.onboardingState.findUnique({ where: { workspaceId } }),
      ),
    ]);

  const verticalSlug = workspace
    ? verticalSlugFromEnum(workspace.vertical)
    : null;
  const verticalContent = verticalSlug
    ? getVerticalContent(verticalSlug)
    : null;
  // Phase 1 ships realty live; the other 8 verticals accept signup but the
  // per-vertical fleet is upstream work (feedback_no_new_verticals_finish_locked).
  const verticalIsLive = verticalSlug === "real-estate";
  const onboardingComplete = onboarding?.completedAt != null;

  const briefings = await getBriefingsProvider().fetchBriefings({
    workspaceId,
    limit: 1,
  });
  const briefing = briefings[0] ?? null;

  return (
    <div className="space-y-10">
      {!onboardingComplete ? (
        <div className="border border-ink bg-paper-deep p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow mb-1">Onboarding</p>
              <p className="text-[15px] leading-relaxed text-ink">
                Finish workspace setup so your fleet has what it needs to run.
              </p>
            </div>
            <Link
              href={`/app/workspace/${workspaceId}/onboarding`}
              className="btn-primary whitespace-nowrap"
            >
              Continue onboarding
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      ) : null}

      {verticalContent ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule pb-4 text-[13px] text-mute">
          <span className="font-mono text-[11px] tracking-eyebrow uppercase">
            Vertical
          </span>
          <span className="text-ink">{verticalContent.name}</span>
          <span aria-hidden>·</span>
          <span className="font-mono text-[11px] tracking-eyebrow uppercase">
            Tier
          </span>
          <span className="text-ink">{workspace?.verticalTier}</span>
          {!verticalIsLive ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-flag">
                Per-vertical fleet is initializing — early-access workspace.
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
        <section>
        <p className="eyebrow mb-3">Today's briefing</p>
        {briefing ? (
          <article className="border border-rule bg-paper p-6">
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-2xl text-ink">{briefing.title}</h2>
              <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                {new Date(briefing.publishedAt).toLocaleDateString()}
                {briefing.isStale ? " · stale" : ""}
              </span>
            </header>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
              {briefing.body || "(empty briefing)"}
            </p>
            {briefing.sections?.map((s) => (
              <div key={s.heading} className="mt-5 border-t border-rule pt-4">
                <h3 className="mb-1 font-display text-lg text-ink">{s.heading}</h3>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
                  {s.body}
                </p>
              </div>
            ))}
          </article>
        ) : (
          <p className="border border-rule bg-paper p-6 text-[15px] leading-relaxed text-mute">
            No briefing yet. Your chief-of-staff agent files one each morning;
            this section will populate after the first run.
          </p>
        )}
      </section>

      <aside className="space-y-4">
        <Card label="Pending approvals" value={pendingApprovals} href={`/app/workspace/${workspaceId}/approvals`} />
        <Card label="Open compliance flags" value={openFlags} href={`/app/workspace/${workspaceId}/compliance`} />

        <section className="border border-rule bg-paper p-5">
          <p className="eyebrow mb-3">Recent fleet activity</p>
          {recentHandoffs.length === 0 ? (
            <p className="text-[13px] text-mute">
              No handoffs logged yet. Activity from your fleet appears here.
            </p>
          ) : (
            <ul className="space-y-2 text-[13px] text-ink-soft">
              {recentHandoffs.map((h) => (
                <li key={h.id} className="flex justify-between gap-4">
                  <span className="truncate">
                    <span className="font-mono">{h.fromAgent}</span>
                    <span className="mx-1 text-mute">→</span>
                    <span className="font-mono">{h.toAgent}</span>
                    <span className="ml-2 text-mute">{h.handoffType}</span>
                  </span>
                  <span className="font-mono text-[11px] uppercase text-mute">
                    {new Date(h.occurredAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block border border-rule bg-paper p-5 transition hover:border-ink"
    >
      <p className="eyebrow mb-2">{label}</p>
      <p className="font-display text-3xl text-ink">{value}</p>
    </Link>
  );
}
