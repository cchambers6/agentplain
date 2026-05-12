import Link from "next/link";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { getBriefingsProvider } from "@/lib/notion";
import { getVerticalContent } from "@/lib/verticals";
import type { VerticalContent } from "@/lib/verticals/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Broker-owner workspace overview. Three-section layout (spec §9 + customer-
// surface task):
//   1. What's running now    — most-recent fleet activity from handoff log
//   2. Today's progress      — drafts ready / compliance flags / hours returned
//   3. Next actions          — 1–3 prioritized items the owner should handle
//
// Vertical-specific welcome copy is pulled from the canonical content registry
// (lib/verticals/*) per feedback_runner_portability.md so realty, CPA, law,
// etc. each render their own framing without per-vertical case statements
// living in this file.
//
// Customer surface — calm, dense, specific. No marketing voice.

export default async function WorkspaceOverviewPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const ctx = {
    userId: member.userId,
    workspaceId,
    isOperator: false,
  };

  const [
    pendingApprovals,
    openFlags,
    recentHandoffs,
    workspace,
    onboarding,
  ] = await Promise.all([
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
  // Phase 1 ships realty live; the other 9 verticals accept signup but the
  // per-vertical fleet is upstream work (feedback_no_new_verticals_finish_locked).
  const verticalIsLive = verticalSlug === "real-estate";
  const onboardingComplete = onboarding?.completedAt != null;

  const briefings = await getBriefingsProvider().fetchBriefings({
    workspaceId,
    limit: 1,
  });
  const briefing = briefings[0] ?? null;

  // "Hours returned" estimate is the customer-facing surface of the same
  // 8–12 hr/wk coordination workload we anchor the ROI math against
  // (project_pricing_value_anchor.md). At Phase 1 the fleet isn't filing
  // actual handoffs yet, so we render an intentional "—" rather than a
  // confident-sounding zero. Once handoff volume ramps, this becomes a
  // computed estimate; today it's a placeholder so the layout reads complete.
  const todayProgress = {
    draftsReady: pendingApprovals,
    flagsSurfaced: openFlags,
    hoursReturned: recentHandoffs.length > 0 ? "tracking" : "—",
  };

  // Next-actions list: prioritized. Onboarding → flags → approvals → idle CTA.
  const nextActions = buildNextActions({
    workspaceId,
    onboardingComplete,
    openFlags,
    pendingApprovals,
    verticalContent,
  });

  return (
    <div className="space-y-10">
      {/* Welcome strip — vertical-specific framing pulled from registry. */}
      <WelcomeStrip
        memberEmail={member.email}
        verticalContent={verticalContent}
        verticalIsLive={verticalIsLive}
        tier={workspace?.verticalTier ?? null}
        onboardingComplete={onboardingComplete}
        workspaceId={workspaceId}
      />

      {/* Three-section grid: 2/3 left column = activity + briefing, 1/3 right = progress + actions. */}
      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          <RunningNow
            handoffs={recentHandoffs}
            verticalIsLive={verticalIsLive}
            workspaceId={workspaceId}
            onboardingComplete={onboardingComplete}
          />
          <TodaysBriefing briefing={briefing} />
        </div>

        <aside className="space-y-6">
          <TodaysProgress progress={todayProgress} workspaceId={workspaceId} />
          <NextActions actions={nextActions} />
        </aside>
      </div>
    </div>
  );
}

// ─── Welcome strip ──────────────────────────────────────────────────────────

function WelcomeStrip({
  memberEmail,
  verticalContent,
  verticalIsLive,
  tier,
  onboardingComplete,
  workspaceId,
}: {
  memberEmail: string;
  verticalContent: VerticalContent | null;
  verticalIsLive: boolean;
  tier: string | null;
  onboardingComplete: boolean;
  workspaceId: string;
}) {
  const firstName = memberEmail.split("@")[0]?.split(".")[0] ?? "there";
  const greeting = greetingForTimeOfDay();
  return (
    <div className="border-b border-rule pb-6">
      <p className="eyebrow mb-2">{greeting}, {firstName}</p>
      <h1 className="font-display text-3xl leading-tight text-ink md:text-4xl">
        {verticalContent
          ? `Today's work, ${verticalContent.name.toLowerCase()} edition.`
          : "Today's work, ready for review."}
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        The fleet drafted overnight. You decide what ships. Approve, edit, or
        reject — your existing tools send.
      </p>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-mute">
        {verticalContent ? (
          <>
            <span className="font-mono tracking-eyebrow uppercase">Vertical</span>
            <span className="text-ink">{verticalContent.name}</span>
            <span aria-hidden>·</span>
          </>
        ) : null}
        {tier ? (
          <>
            <span className="font-mono tracking-eyebrow uppercase">Tier</span>
            <span className="text-ink">{tier}</span>
          </>
        ) : null}
        {!verticalIsLive && verticalContent ? (
          <>
            <span aria-hidden>·</span>
            <span className="text-flag">
              Per-vertical fleet initializing — early-access workspace.
            </span>
          </>
        ) : null}
      </div>

      {!onboardingComplete ? (
        <div className="mt-6 flex flex-col gap-3 border border-ink bg-paper-deep p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow mb-1">Onboarding</p>
            <p className="text-[14px] leading-relaxed text-ink">
              Finish workspace setup so the fleet has what it needs to run.
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
      ) : null}
    </div>
  );
}

function greetingForTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Late";
}

// ─── Section: What's running now ────────────────────────────────────────────

function RunningNow({
  handoffs,
  verticalIsLive,
  workspaceId,
  onboardingComplete,
}: {
  handoffs: Array<{
    id: string;
    fromAgent: string;
    toAgent: string;
    handoffType: string;
    occurredAt: Date;
  }>;
  verticalIsLive: boolean;
  workspaceId: string;
  onboardingComplete: boolean;
}) {
  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between">
        <p className="eyebrow">What's running now</p>
        <Link
          href={`/app/workspace/${workspaceId}/agents`}
          className="font-mono text-[11px] tracking-eyebrow uppercase text-mute hover:text-ink"
        >
          See fleet →
        </Link>
      </header>

      {handoffs.length === 0 ? (
        <div className="border border-rule bg-paper p-6">
          <p className="text-[15px] leading-relaxed text-ink">
            No agent activity yet.
          </p>
          <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-mute">
            {!onboardingComplete
              ? "Finish onboarding so the fleet knows where to read from."
              : verticalIsLive
                ? "Your fleet drafts overnight and posts the morning briefing here. The first handoff lands after the next run."
                : "This vertical's fleet is initializing. You'll see handoffs here once the per-vertical agents come online."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {!onboardingComplete ? (
              <Link
                href={`/app/workspace/${workspaceId}/onboarding`}
                className="btn-primary"
              >
                Continue onboarding
                <span aria-hidden>→</span>
              </Link>
            ) : (
              <Link
                href={`/app/workspace/${workspaceId}/onboarding`}
                className="btn-secondary"
              >
                Connect a tool
                <span aria-hidden>→</span>
              </Link>
            )}
            <Link
              href={`/app/workspace/${workspaceId}/agents`}
              className="btn-secondary"
            >
              See the agent fleet
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-rule border border-rule bg-paper">
          {handoffs.map((h) => (
            <li
              key={h.id}
              className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4 text-[14px]"
            >
              <span className="text-ink-soft">
                <span className="font-mono text-ink">{h.fromAgent}</span>
                <span className="mx-2 text-mute">→</span>
                <span className="font-mono text-ink">{h.toAgent}</span>
                <span className="ml-2 text-mute">· {h.handoffType}</span>
              </span>
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
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
  );
}

// ─── Section: Today's briefing ──────────────────────────────────────────────

function TodaysBriefing({
  briefing,
}: {
  briefing: {
    title: string;
    body: string;
    publishedAt: Date | string;
    isStale: boolean;
    sections?: Array<{ heading: string; body: string }>;
  } | null;
}) {
  return (
    <section>
      <p className="eyebrow mb-4">Today's briefing</p>
      {briefing ? (
        <article className="border border-rule bg-paper p-6">
          <header className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl leading-tight text-ink">
              {briefing.title}
            </h2>
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
              <h3 className="mb-1 font-display text-lg text-ink">
                {s.heading}
              </h3>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
                {s.body}
              </p>
            </div>
          ))}
        </article>
      ) : (
        <div className="border border-rule bg-paper p-6">
          <p className="text-[15px] leading-relaxed text-ink">
            No briefing filed yet.
          </p>
          <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-mute">
            Your chief-of-staff agent files one each morning. This section
            populates after the first run — you'll see what the fleet did
            overnight before you open the rest of the day.
          </p>
        </div>
      )}
    </section>
  );
}

// ─── Section: Today's progress ──────────────────────────────────────────────

function TodaysProgress({
  progress,
  workspaceId,
}: {
  progress: { draftsReady: number; flagsSurfaced: number; hoursReturned: string };
  workspaceId: string;
}) {
  return (
    <section className="border border-rule bg-paper p-5">
      <p className="eyebrow mb-4">Today's progress</p>
      <dl className="space-y-4">
        <Stat
          label="Drafts ready for review"
          value={String(progress.draftsReady)}
          href={`/app/workspace/${workspaceId}/approvals`}
        />
        <Stat
          label="Compliance flags surfaced"
          value={String(progress.flagsSurfaced)}
          href={`/app/workspace/${workspaceId}/compliance`}
        />
        <Stat label="Hours returned this week" value={progress.hoursReturned} />
      </dl>
      <p className="mt-5 border-t border-rule pt-4 font-mono text-[11px] leading-relaxed text-mute">
        Hours-returned estimate goes live once the fleet logs its first
        completed coordination handoffs.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const valueBlock = (
    <p className="font-display text-3xl leading-none text-ink">{value}</p>
  );
  const labelBlock = (
    <dt className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
      {label}
    </dt>
  );
  if (href) {
    return (
      <Link href={href} className="block group">
        {labelBlock}
        <dd className="mt-2 transition group-hover:text-clay">{valueBlock}</dd>
      </Link>
    );
  }
  return (
    <div>
      {labelBlock}
      <dd className="mt-2">{valueBlock}</dd>
    </div>
  );
}

// ─── Section: Next actions ──────────────────────────────────────────────────

interface NextAction {
  key: string;
  label: string;
  detail: string;
  href: string;
  urgency: "high" | "normal";
}

function NextActions({ actions }: { actions: NextAction[] }) {
  return (
    <section className="border border-rule bg-paper p-5">
      <p className="eyebrow mb-4">Next actions</p>
      {actions.length === 0 ? (
        <p className="text-[14px] leading-relaxed text-mute">
          Nothing on the list right now. The fleet will surface work here as
          it lands.
        </p>
      ) : (
        <ul className="space-y-3">
          {actions.map((a) => (
            <li key={a.key}>
              <Link
                href={a.href}
                className="block border border-rule bg-paper p-4 transition hover:border-ink"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-base leading-tight text-ink">
                    {a.label}
                  </p>
                  {a.urgency === "high" ? (
                    <span className="font-mono text-[10px] tracking-eyebrow uppercase text-flag">
                      review
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
                      open
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-mute">
                  {a.detail}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function buildNextActions({
  workspaceId,
  onboardingComplete,
  openFlags,
  pendingApprovals,
  verticalContent,
}: {
  workspaceId: string;
  onboardingComplete: boolean;
  openFlags: number;
  pendingApprovals: number;
  verticalContent: VerticalContent | null;
}): NextAction[] {
  const actions: NextAction[] = [];

  if (!onboardingComplete) {
    actions.push({
      key: "onboarding",
      label: "Finish onboarding",
      detail:
        "Confirm workspace details, connect a tool, set drafting preferences. ~10 minutes.",
      href: `/app/workspace/${workspaceId}/onboarding`,
      urgency: "high",
    });
  }

  if (openFlags > 0) {
    actions.push({
      key: "compliance",
      label: `Triage ${openFlags} compliance flag${openFlags > 1 ? "s" : ""}`,
      detail:
        "The Compliance Sentinel surfaced these for review before the customer-facing draft ships.",
      href: `/app/workspace/${workspaceId}/compliance`,
      urgency: "high",
    });
  }

  if (pendingApprovals > 0) {
    actions.push({
      key: "approvals",
      label: `Review ${pendingApprovals} draft${pendingApprovals > 1 ? "s" : ""} ready to send`,
      detail:
        "Drafts queue here after the fleet finishes them. Approve, edit, or reject — your existing system sends.",
      href: `/app/workspace/${workspaceId}/approvals`,
      urgency: "normal",
    });
  }

  if (actions.length === 0 && verticalContent) {
    // Idle-state guidance — point owner to the vertical's planned-integration
    // window so they know what's coming and when.
    actions.push({
      key: "idle",
      label: "Connect another tool",
      detail: `Integrations for ${verticalContent.name} land ${verticalContent.integrations.plannedWindow}. The more the fleet reads, the more it can draft.`,
      href: `/app/workspace/${workspaceId}/onboarding`,
      urgency: "normal",
    });
  }

  // Cap at three to keep the panel a short list, not a backlog dump.
  return actions.slice(0, 3);
}
