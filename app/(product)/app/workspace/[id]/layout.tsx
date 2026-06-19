import Link from "next/link";
import { requireWorkspaceMember, listPasskeys } from "@/lib/auth";
import { withSystemContext } from "@/lib/db";
import { ApWorkspaceStrip } from "@/components/ui/ap";
import { signOutAction } from "../../actions";
import { WorkspaceNavLink } from "./WorkspaceNavLink";
import { PasskeyEnrollNudge } from "./PasskeyEnrollNudge";
import { isWorkspacePaused } from "@/lib/billing/workspace-paused-gate";
import {
  controllingBudgetStatus,
  getWorkspaceDualBudgetSnapshot,
  resolveBudgetCapUsd,
  resolveDailyBudgetCapUsd,
} from "@/lib/billing/budget";
import { getUnhealthyIntegrations } from "@/lib/integrations/health-banner";
import { checkDegradedMode } from "@/lib/plaino";
import { PlainoRestingBanner } from "@/components/plaino/PlainoRestingBanner";
import { WORKSPACE_TABS } from "@/lib/workspace/nav";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { NAV_TOUR_KEYS } from "@/lib/onboarding/tour-steps";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { id } = await params;
  const member = await requireWorkspaceMember(id, ["BROKER_OWNER"]);

  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, settings: true },
    }),
  );
  if (!workspace) {
    // Shouldn't happen — requireWorkspaceMember already redirects on miss.
    return null;
  }

  // Budget dashboard alert. Only the cheap settings read runs on the common
  // (no-cap) path; the usage-report aggregation only fires when a cap is
  // actually configured, so an unbudgeted workspace pays nothing for this.
  // When set and the controlling (stricter of daily/monthly) state is WARN or
  // OVER, we surface a calm top-of-app banner — the customer-visible reason
  // the budget gate is throttling (the auto-pause itself is structural, in
  // BudgetEnforcingLlmProvider).
  const hasBudgetCap =
    resolveBudgetCapUsd(workspace.settings, null) !== null ||
    resolveDailyBudgetCapUsd(workspace.settings, null) !== null;
  const budget = hasBudgetCap
    ? await withSystemContext((tx) =>
        getWorkspaceDualBudgetSnapshot(tx, { workspaceId: id }),
      ).catch(() => null)
    : null;
  const budgetState = budget
    ? controllingBudgetStatus(budget.monthly, budget.daily).state
    : null;

  // Wave-3 phase 5 — read subscription status once so every workspace
  // page surfaces a "Plaino is paused — update billing to resume" banner
  // when PAUSED / PAST_DUE. The runtime gate at the Inngest layer
  // already prevents fleet activity in that state; this banner is the
  // customer-visible reason.
  const pauseState = await isWorkspacePaused({ workspaceId: id }).catch(
    () => ({ isPaused: false, status: null, reason: '' }),
  );

  // Passkey enrollment nudge — show only to a member who has none yet. The
  // client component additionally gates on browser support + a per-device
  // dismissal, so this is a single cheap count, not a render decision.
  const hasPasskey = await listPasskeys(member.userId)
    .then((list) => list.length > 0)
    .catch(() => true); // on error, assume enrolled → never nag

  // pfd-2 integration self-heal — surface any integration the daily health
  // sweep found UNHEALTHY, so the owner finds out FROM US with a one-click fix
  // the moment they open the app (not after weeks of silently-missing drafts).
  const unhealthyIntegrations = await getUnhealthyIntegrations({
    userId: member.userId,
    workspaceId: id,
    isOperator: false,
  }).catch(() => []);

  // Universal degraded-mode signal. Env-only (no DB) — cheap to read on
  // every page. When the LLM dispatch can't run (paused-spend sentinel,
  // missing credential, forced `LLM_DEGRADED_MODE`, upstream outage) every
  // interactive surface would otherwise look broken: chat replies, agent
  // fires and drafts return silently. The top-of-app resting banner reframes
  // that as a deliberate, calm pause across ALL product pages at once.
  const degraded = checkDegradedMode();

  const base = `/app/workspace/${id}`;

  return (
    <div>
      <a href="#workspace-main" className="skip-to-content">
        skip to content
      </a>
      <ApWorkspaceStrip
        slug={workspace.slug}
        name={workspace.name}
        right={
          <>
            <span>{member.email}</span>
            <span aria-hidden>·</span>
            <span>{member.role.replace("_", " ").toLowerCase()}</span>
            {member.isOperator ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href="/operator/leadership-board"
                  className="text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
                >
                  operator
                </Link>
              </>
            ) : null}
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-mute underline-offset-4 hover:text-ink hover:underline focus:outline-none focus-visible:text-ink focus-visible:underline"
              >
                sign out
              </button>
            </form>
          </>
        }
        nav={WORKSPACE_TABS.map((item) => (
          <WorkspaceNavLink
            key={item.label}
            href={`${base}${item.href}`}
            exact={item.href === ""}
            match={item.match?.map((m) => `${base}${m}`)}
            dataTour={NAV_TOUR_KEYS[item.href]}
          >
            {item.label}
          </WorkspaceNavLink>
        ))}
      />
      {/* First-run walkthrough. Renders only until this member finishes or
          skips it (welcomeTourSeenAt set by the complete route). Non-blocking
          spotlight — never gates the workspace below it. */}
      {member.welcomeTourSeenAt === null ? (
        <WelcomeTour workspaceId={id} />
      ) : null}
      {!hasPasskey ? <PasskeyEnrollNudge workspaceId={id} /> : null}
      {degraded.degraded ? (
        <PlainoRestingBanner
          variant="strip"
          customerNotice={degraded.customerNotice}
          operatorNotice={degraded.operatorNotice}
          isOperator={member.isOperator}
        />
      ) : null}
      {pauseState.isPaused ? (
        <div className="container-wide mt-4">
          <div
            role="status"
            aria-live="polite"
            className="border border-flag bg-paper p-4 text-[14px] text-ink"
          >
            {pauseState.status === null ? (
              // Wave-4 — abandoned-signup state. No Subscription row exists;
              // the gate fired because setupDeactivatedAt is set. Different
              // copy because the customer hasn't finished checkout in the
              // first place — they're not behind on billing, they never
              // started.
              <>
                <p className="font-medium">
                  Complete setup to resume Plaino.
                </p>
                <p className="mt-2 text-ink-soft">
                  Plaino is on standby — you signed up but did not finish
                  Stripe Checkout, so the fleet is not running drafts,
                  briefings, or sync work for {workspace.name}. Add your
                  payment method in{' '}
                  <Link
                    href={`${base}/settings/billing`}
                    className="underline underline-offset-4 hover:text-ink"
                  >
                    Settings · Billing
                  </Link>
                  {' '}to bring the fleet online.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">
                  Plaino is paused — update billing to resume.
                </p>
                <p className="mt-2 text-ink-soft">
                  Your subscription is {pauseState.status === 'PAUSED' ? 'paused' : 'past due'};
                  Plaino is not running drafts, briefings, or sync work until billing
                  is current. Update your payment method in{' '}
                  <Link
                    href={`${base}/settings/billing`}
                    className="underline underline-offset-4 hover:text-ink"
                  >
                    Settings · Billing
                  </Link>
                  {' '}to bring the fleet back online.
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
      {budgetState === "OVER" || budgetState === "WARN" ? (
        <div className="container-wide mt-4">
          <div
            role="status"
            aria-live="polite"
            className={`border bg-paper p-4 text-[14px] text-ink ${
              budgetState === "OVER" ? "border-flag" : "border-clay"
            }`}
          >
            {budgetState === "OVER" ? (
              <>
                <p className="font-medium">
                  Plaino paused new work — you&rsquo;ve reached your budget.
                </p>
                <p className="mt-2 text-ink-soft">
                  Your fleet hit the budget set for {workspace.name}, so new
                  drafts and agent work wait rather than running up a surprise.
                  Nothing is lost — queued work resumes when the period resets
                  or the budget is raised. See the detail in{" "}
                  <Link
                    href={`${base}/usage`}
                    className="underline underline-offset-4 hover:text-ink"
                  >
                    Account · Usage
                  </Link>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">
                  You&rsquo;re near your budget.
                </p>
                <p className="mt-2 text-ink-soft">
                  Your fleet is using most of its budget for this period.
                  Nothing changes today — review the breakdown in{" "}
                  <Link
                    href={`${base}/usage`}
                    className="underline underline-offset-4 hover:text-ink"
                  >
                    Account · Usage
                  </Link>
                  .
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
      {unhealthyIntegrations.length > 0 ? (
        <div className="container-wide mt-4">
          <div
            role="status"
            aria-live="polite"
            className="border border-flag bg-paper p-4 text-[14px] text-ink"
          >
            <p className="font-medium">
              {unhealthyIntegrations.length === 1
                ? `We can't reach your ${unhealthyIntegrations[0].name} — reconnect to keep Plaino working.`
                : `We can't reach ${unhealthyIntegrations.length} of your connected tools — reconnect to keep Plaino working.`}
            </p>
            <p className="mt-2 text-ink-soft">
              The work that runs through{" "}
              {unhealthyIntegrations.length === 1
                ? unhealthyIntegrations[0].name
                : "them"}{" "}
              is on hold. Nothing is lost — anything Plaino was about to do is
              queued and will run the moment you reconnect.
            </p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {unhealthyIntegrations.map((it) => (
                <li key={it.provider}>
                  <Link
                    href={it.reconnectPath}
                    className="underline underline-offset-4 hover:text-ink"
                  >
                    Reconnect {it.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {/* tabIndex=-1 so the skip-to-content anchor moves focus here without
          adding a permanent tab stop. <section> not <main> because
          ApAppShell already wraps children in a single <main>. */}
      <section
        id="workspace-main"
        tabIndex={-1}
        aria-label="workspace content"
        className="container-wide py-10 focus:outline-none"
      >
        {children}
      </section>
    </div>
  );
}
