import Link from "next/link";
import {
  ApEyebrow,
  ApHairlineList,
  ApHairlineRow,
  ApHeritageButton,
  ApPaperCard,
  ApRootedEmptyState,
  PlainoAvatar,
} from "@/components/ui/ap";
import { requireWorkspaceMember } from "@/lib/auth";
import { verticalSlugFromEnum } from "@/lib/auth/vertical-enum";
import { withRls } from "@/lib/db";
import { getBriefingsProvider } from "@/lib/notion";
import { servicePartnerForWorkspace } from "@/lib/onboarding/service-partner";
import { getVerticalContent } from "@/lib/verticals";
import type { VerticalContent } from "@/lib/verticals/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Broker-owner workspace overview — the daily report-back from the fleet.
// Per design language §4.3 + Wave-B brief:
//   - Top eyebrow + computed headline that names what just happened.
//   - Left: handoff feed (ApHairlineList) or ApRootedEmptyState.
//   - Right: today's queue (ApPaperCard) → /approvals, and next-actions.
// No KPI grid. No "Welcome back!" No dashboard widgets that do nothing.

export default async function WorkspaceOverviewPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);

  const ctx = {
    userId: member.userId,
    workspaceId,
    isOperator: false,
  };

  const [pendingApprovals, openFlags, recentHandoffs, workspace, onboarding, activePause] =
    await Promise.all([
      withRls(ctx, (tx) =>
        tx.workApprovalQueueItem.count({
          where: { workspaceId, status: "PENDING" },
        }),
      ),
      withRls(ctx, (tx) =>
        tx.complianceFlag.count({ where: { workspaceId, state: "OPEN" } }),
      ),
      withRls(ctx, (tx) =>
        tx.handoffLogEntry.findMany({
          where: { workspaceId },
          orderBy: { occurredAt: "desc" },
          take: 8,
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
      // Wave-5 active-pause banner. Pull the first currently-active
      // pause (if any) so the overview can render "Plaino is paused"
      // above the headline. We surface only `pausedUntil` +
      // discipline scope — the encrypted reason stays out of the
      // overview to keep the banner non-PII.
      withRls(ctx, (tx) =>
        tx.workspacePauseConfig.findFirst({
          where: {
            workspaceId,
            pausedFrom: { lte: new Date() },
            pausedUntil: { gt: new Date() },
          },
          select: { pausedUntil: true, pausedDisciplineIds: true },
          orderBy: { pausedUntil: "desc" },
        }),
      ),
    ]);

  const verticalSlug = workspace
    ? verticalSlugFromEnum(workspace.vertical)
    : null;
  const verticalContent = verticalSlug
    ? getVerticalContent(verticalSlug)
    : null;
  const verticalIsLive = verticalSlug === "real-estate";
  const onboardingComplete = onboarding?.completedAt != null;
  const partner = servicePartnerForWorkspace(workspaceId);

  const briefings = await getBriefingsProvider().fetchBriefings({
    workspaceId,
    limit: 1,
  });
  const briefing = briefings[0] ?? null;

  const headline = buildHeadline({
    pendingApprovals,
    openFlags,
    recentHandoffs,
    partner,
  });

  const nextActions = buildNextActions({
    workspaceId,
    onboardingComplete,
    openFlags,
    pendingApprovals,
    verticalContent,
  });

  const firstName = firstNameFromEmail(member.email);

  return (
    <div className="space-y-10">
      {activePause ? (
        <aside
          role="status"
          className="rounded-md border border-rule bg-paper-deep p-4 text-[14px] text-ink"
        >
          <p>
            <span className="font-mono text-[11px] uppercase text-mute">
              fleet paused
            </span>{" "}
            {partner} is paused
            {activePause.pausedDisciplineIds.length > 0
              ? ` for: ${activePause.pausedDisciplineIds.join(", ")}`
              : ""}{" "}
            — resuming {new Date(activePause.pausedUntil).toLocaleString()}.{" "}
            <Link
              href={`/app/workspace/${workspaceId}/settings/pause`}
              className="underline-offset-4 hover:underline"
            >
              manage →
            </Link>
          </p>
        </aside>
      ) : null}

      <header className="border-b border-rule pb-8">
        <ApEyebrow>
          {timeOfDayLabel()}, {firstName}
        </ApEyebrow>
        <h1 className="mt-3 font-display text-3xl leading-tight text-ink md:text-4xl">
          {headline}
        </h1>
        <p className="mt-3 flex max-w-2xl items-start gap-3 text-[15px] leading-relaxed text-ink-soft">
          <PlainoAvatar size="md" className="shrink-0" />
          <span>
            {partner} is your service partner. Your fleet is doing the
            work that doesn&rsquo;t need you so you can focus on what
            does. Approve, edit, or reject — your existing tools send.
          </span>
        </p>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-mute">
          {verticalContent ? (
            <>
              <span className="font-mono tracking-eyebrow uppercase">vertical</span>
              <span className="text-ink">{verticalContent.name}</span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          {workspace?.verticalTier ? (
            <>
              <span className="font-mono tracking-eyebrow uppercase">tier</span>
              <span className="text-ink">{workspace.verticalTier}</span>
            </>
          ) : null}
          {!verticalIsLive && verticalContent ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-mute">
                per-vertical fleet rooting in
              </span>
            </>
          ) : null}
        </div>

        {!onboardingComplete ? (
          <div className="mt-6 flex flex-col gap-3 border border-ink bg-paper-deep p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                onboarding
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink">
                Finish workspace setup so {partner} has what the fleet
                needs to run.
              </p>
            </div>
            <ApHeritageButton
              variant="primary"
              withArrow
              href={`/app/workspace/${workspaceId}/onboarding`}
            >
              continue onboarding
            </ApHeritageButton>
          </div>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          <TodaysWork
            handoffs={recentHandoffs}
            workspaceId={workspaceId}
            onboardingComplete={onboardingComplete}
            partner={partner}
          />
          <TodaysBriefing briefing={briefing} partner={partner} />
        </div>

        <aside className="space-y-6">
          <TodaysQueue
            workspaceId={workspaceId}
            pendingApprovals={pendingApprovals}
            openFlags={openFlags}
          />
          {nextActions.length > 0 ? (
            <NextActions actions={nextActions} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// ─── Headline computation ───────────────────────────────────────────────────

function buildHeadline({
  pendingApprovals,
  openFlags,
  recentHandoffs,
  partner,
}: {
  pendingApprovals: number;
  openFlags: number;
  recentHandoffs: Array<{ handoffType: string }>;
  partner: string;
}): string {
  if (recentHandoffs.length === 0 && pendingApprovals === 0 && openFlags === 0) {
    return `${partner} is watching your inbox. Nothing's come in yet.`;
  }

  const parts: string[] = [];
  if (pendingApprovals > 0) {
    parts.push(
      `drafted ${pendingApprovals} ${plural(pendingApprovals, "reply", "replies")}`,
    );
  }

  const scheduled = recentHandoffs.filter((h) =>
    /(schedul|propose)/i.test(h.handoffType),
  ).length;
  if (scheduled > 0) {
    parts.push(`scheduled ${scheduled} ${plural(scheduled, "showing", "showings")}`);
  }

  if (openFlags > 0) {
    parts.push(`flagged ${openFlags} ${plural(openFlags, "item", "items")}`);
  }

  if (parts.length === 0) {
    return `We're working on ${recentHandoffs.length} ${plural(recentHandoffs.length, "handoff", "handoffs")}.`;
  }

  const joined =
    parts.length === 1
      ? parts[0]!
      : parts.length === 2
        ? `${parts[0]} and ${parts[1]}`
        : `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)!}`;

  return `We ${joined}.`;
}

function plural(n: number, single: string, many: string): string {
  return n === 1 ? single : many;
}

// ─── Today's work feed ──────────────────────────────────────────────────────

function TodaysWork({
  handoffs,
  workspaceId,
  onboardingComplete,
  partner,
}: {
  handoffs: Array<{
    id: string;
    fromAgent: string;
    toAgent: string;
    handoffType: string;
    occurredAt: Date;
  }>;
  workspaceId: string;
  onboardingComplete: boolean;
  partner: string;
}) {
  return (
    <section>
      <header className="mb-4 flex items-baseline justify-between">
        <ApEyebrow>what we did</ApEyebrow>
        <Link
          href={`/app/workspace/${workspaceId}/agents`}
          className="font-mono text-[11px] tracking-eyebrow uppercase text-mute hover:text-ink"
        >
          see fleet →
        </Link>
      </header>

      {handoffs.length === 0 ? (
        <>
          <ApRootedEmptyState
            motif="lone-tree"
            reality={
              onboardingComplete
                ? `Nothing has come in yet. ${partner} is watching your inbox.`
                : "Nothing yet — the fleet needs to know where to read from."
            }
            change={
              onboardingComplete
                ? "The first handoff lands once new mail or a webhook fires."
                : "Finish onboarding to point the fleet at your tools."
            }
            cta={
              onboardingComplete ? (
                <ApHeritageButton
                  variant="secondary"
                  withArrow
                  href={`/app/workspace/${workspaceId}/integrations`}
                >
                  connect another tool
                </ApHeritageButton>
              ) : (
                <ApHeritageButton
                  variant="primary"
                  withArrow
                  href={`/app/workspace/${workspaceId}/onboarding`}
                >
                  continue onboarding
                </ApHeritageButton>
              )
            }
          />
          <LoopPreview />
        </>
      ) : (
        <ApHairlineList>
          {handoffs.map((h) => (
            <ApHairlineRow
              key={h.id}
              right={new Date(h.occurredAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
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
  );
}

// ─── Loop preview ─────────────────────────────────────────────────────────
// A clearly-labeled illustrative sample shown only while the real handoff
// feed is empty, so a customer who hasn't connected a tool yet (or whose
// loop hasn't fired) can still see the SHAPE of what the fleet surfaces.
// Marked "example" throughout — it is never mistaken for live data.

const LOOP_PREVIEW_ROWS: Array<{
  from: string;
  to: string;
  type: string;
  detail: string;
}> = [
  {
    from: "reader",
    to: "router",
    type: "categorize",
    detail: "New buyer inquiry on 142 Peachtree — tagged scheduling-needed.",
  },
  {
    from: "router",
    to: "scheduler",
    type: "schedule",
    detail: "Proposed Tuesday 10:30 and Thursday 2:00 from your open calendar.",
  },
  {
    from: "scheduler",
    to: "drafter",
    type: "draft",
    detail: "Reply drafted for your review — waiting in your approvals queue.",
  },
];

function LoopPreview() {
  return (
    <div className="mt-6 border border-rule bg-paper-deep p-5">
      <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
        example · what lands here once mail flows
      </p>
      <ul className="mt-3 divide-y divide-rule border-y border-rule">
        {LOOP_PREVIEW_ROWS.map((r) => (
          <li key={`${r.from}-${r.to}`} className="py-3">
            <span className="text-[14px] text-ink-soft">
              <span className="font-mono text-ink">{r.from}</span>
              <span className="mx-2 text-mute">→</span>
              <span className="font-mono text-ink">{r.to}</span>
              <span className="ml-2 text-mute">· {r.type}</span>
            </span>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {r.detail}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] leading-relaxed text-mute">
        An illustration, not your data. Your fleet&rsquo;s real handoffs replace
        this the moment your first message comes in.
      </p>
    </div>
  );
}

// ─── Today's briefing ───────────────────────────────────────────────────────

function TodaysBriefing({
  briefing,
  partner,
}: {
  briefing: {
    title: string;
    body: string;
    publishedAt: Date | string;
    isStale: boolean;
    sections?: Array<{ heading: string; body: string }>;
  } | null;
  partner: string;
}) {
  if (!briefing) {
    return (
      <section>
        <ApEyebrow className="mb-4">today&rsquo;s briefing</ApEyebrow>
        <ApRootedEmptyState
          reality="No briefing filed yet."
          change={`${partner} files one each morning after the overnight run. The first one lands tomorrow.`}
        />
      </section>
    );
  }

  return (
    <section>
      <ApEyebrow className="mb-4">today&rsquo;s briefing</ApEyebrow>
      <ApPaperCard
        title={briefing.title}
        density="default"
      >
        <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          {new Date(briefing.publishedAt).toLocaleDateString()}
          {briefing.isStale ? " · stale" : ""}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
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
      </ApPaperCard>
    </section>
  );
}

// ─── Today's queue (sidebar) ────────────────────────────────────────────────

function TodaysQueue({
  workspaceId,
  pendingApprovals,
  openFlags,
}: {
  workspaceId: string;
  pendingApprovals: number;
  openFlags: number;
}) {
  return (
    <ApPaperCard
      eyebrow="today's queue"
      title={pendingApprovals === 0 ? "Nothing waiting." : "Decisions waiting."}
      footer={
        pendingApprovals > 0 ? (
          <ApHeritageButton
            variant="primary"
            withArrow
            href={`/app/workspace/${workspaceId}/approvals`}
          >
            open queue
          </ApHeritageButton>
        ) : (
          <ApHeritageButton
            variant="secondary"
            withArrow
            href={`/app/workspace/${workspaceId}/approvals`}
          >
            view queue
          </ApHeritageButton>
        )
      }
    >
      <dl className="space-y-3 text-[14px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-soft">drafts to review</dt>
          <dd className="font-display text-xl text-ink">{pendingApprovals}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-soft">compliance flags</dt>
          <dd className="font-display text-xl text-ink">{openFlags}</dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-rule pt-3 text-[13px] leading-relaxed text-mute">
        Drafts wait here for your approve, edit, or reject. Your own tools do
        the sending — nothing leaves without your hand on it.
      </p>
    </ApPaperCard>
  );
}

// ─── Next actions ───────────────────────────────────────────────────────────

interface NextAction {
  key: string;
  label: string;
  detail: string;
  href: string;
  urgency: "high" | "normal";
}

function NextActions({ actions }: { actions: NextAction[] }) {
  return (
    <ApPaperCard eyebrow="next actions">
      <ul className="space-y-3">
        {actions.map((a) => (
          <li key={a.key}>
            <Link
              href={a.href}
              className="block border border-rule bg-paper p-4 transition hover:border-ink focus:outline-none focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
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
    </ApPaperCard>
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
        "Confirm details, connect an inbox, pick what to watch, set your voice. Five steps; the first fire lands inside the wizard.",
      href: `/app/workspace/${workspaceId}/onboarding`,
      urgency: "high",
    });
  }

  if (openFlags > 0) {
    actions.push({
      key: "compliance",
      label: `Triage ${openFlags} compliance flag${openFlags > 1 ? "s" : ""}`,
      detail:
        "The Compliance Sentinel surfaced these before the customer-facing draft ships.",
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
    actions.push({
      key: "idle",
      label: "Connect another tool",
      detail: `Integrations for ${verticalContent.name} land ${verticalContent.integrations.plannedWindow}. The more the fleet reads, the more it can draft.`,
      href: `/app/workspace/${workspaceId}/integrations`,
      urgency: "normal",
    });
  }

  return actions.slice(0, 3);
}

function firstNameFromEmail(email: string): string {
  if (!email) return "there";
  const local = email.split("@", 1)[0] ?? "";
  if (!local) return "there";
  const first = local.split(/[.\-_+]/, 1)[0] ?? "";
  if (!first || /^\d+$/.test(first)) return "there";
  return first[0]!.toUpperCase() + first.slice(1);
}

function timeOfDayLabel(): string {
  const h = new Date().getHours();
  if (h < 5) return "late";
  if (h < 12) return "this morning";
  if (h < 17) return "this afternoon";
  if (h < 21) return "this evening";
  return "tonight";
}
