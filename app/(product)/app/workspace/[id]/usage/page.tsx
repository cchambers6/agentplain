import { ApEyebrow, ApPaperCard } from "@/components/ui/ap";
import { withWorkspace } from "@/lib/auth";
import { withRls } from "@/lib/db";
import {
  getWorkspaceDualBudgetSnapshot,
  type WorkspaceBudgetStatus,
} from "@/lib/billing/budget";
import { recommendBudgetCapUsd } from "@/lib/billing/recommendations";
import { formatMicroCentsAsUsd } from "@/lib/billing/usage/pricing";
import {
  monthlyChargeUsdCents,
  tierFromVerticalTier,
} from "@/lib/pricing/tiers";
import { BudgetSummary } from "../settings/billing/BudgetSummary";
import { UsagePanel } from "../settings/billing/UsagePanel";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Dedicated per-customer usage + spend dashboard. The billing page carries a
// usage PANEL under the plan card; this is the standalone "what is my fleet
// costing me" surface — both budget dimensions (today + this month) up top,
// then the full per-agent spend breakdown + cache savings (reused from the
// billing UsagePanel so the numbers are identical wherever they appear).
//
// Production+growth plan §2/§6: at 100→10k customers, no-surprise-overage
// transparency is the trust contract. This page is where a customer sees the
// meter — calm, honest, never "you're expensive."
export default async function UsageDashboardPage({ params }: PageProps) {
  const { id: workspaceId } = await params;
  const { workspace, rls } = await withWorkspace(workspaceId, ["BROKER_OWNER"]);

  const [dual, subscription] = await Promise.all([
    withRls(rls, (tx) =>
      getWorkspaceDualBudgetSnapshot(tx, { workspaceId }),
    ),
    withRls(rls, (tx) =>
      tx.subscription.findUnique({ where: { workspaceId } }),
    ),
  ]);

  // Advisory recommended monthly budget (MRR × 0.30) — copy only, nothing
  // enforced unless an operator sets an explicit cap. Mirrors the billing page.
  const tier = subscription
    ? tierFromVerticalTier(subscription.tier)
    : tierFromVerticalTier(workspace.verticalTier);
  const charge = subscription
    ? monthlyChargeUsdCents(tier, subscription.seats)
    : null;
  const monthlyRevenueUsd =
    charge && tier !== "max" ? charge.totalCents / 100 : null;
  const recommendedBudgetUsd =
    monthlyRevenueUsd !== null ? recommendBudgetCapUsd(monthlyRevenueUsd) : null;

  return (
    <div>
      <ApEyebrow className="mb-3">account · usage</ApEyebrow>
      <h1 className="font-display text-3xl text-ink">
        What your fleet is costing you.
      </h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
        Every agent task your fleet runs, what it cost, and how it tracks
        against any budget you&rsquo;ve set — refreshed each time you open this
        page. We show this so there&rsquo;s never a surprise.
      </p>

      {/* Both budget dimensions. The daily card shows only when a daily cap is
          set; the monthly summary reuses the billing component verbatim. */}
      {dual ? (
        <>
          {dual.daily.capUsdMonthly !== null ? (
            <DailyBudgetCard status={dual.daily} />
          ) : null}
          <BudgetSummary
            state={dual.monthly.state}
            spendUsd={formatMicroCentsAsUsd(dual.monthly.consumedMicroCents)}
            capUsd={dual.monthly.capUsdMonthly}
            percentUsed={dual.monthly.percentUsed}
            recommendedUsd={recommendedBudgetUsd}
          />
        </>
      ) : null}

      {/* Full per-agent spend breakdown + cache savings — reused from billing
          so the figures never disagree across surfaces. */}
      <UsagePanel
        workspaceId={workspaceId}
        rls={rls}
        periodStart={null}
        periodEnd={null}
      />
    </div>
  );
}

// Compact daily-budget readout — the fast circuit-breaker dimension. Mirrors
// BudgetSummary's tone but for the today window. Note: on the daily status the
// `capUsdMonthly` field carries the DAILY cap (the derivation is shared).
function DailyBudgetCard({ status }: { status: WorkspaceBudgetStatus }) {
  const cap = status.capUsdMonthly;
  if (cap === null) return null;
  const pct = Math.max(0, Math.min(100, Math.round((status.percentUsed ?? 0) * 100)));
  const barColor =
    status.state === "OVER"
      ? "bg-flag"
      : status.state === "WARN"
        ? "bg-clay"
        : "bg-moss";
  return (
    <section className="mt-12">
      <ApEyebrow className="mb-4">today</ApEyebrow>
      <ApPaperCard eyebrow="since midnight UTC" title="Today&rsquo;s activity.">
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-3xl leading-tight text-ink">
            {formatMicroCentsAsUsd(status.consumedMicroCents)}
          </p>
          <p className="font-mono text-[12px] uppercase tracking-eyebrow text-mute">
            of ${cap.toLocaleString("en-US")} daily budget
          </p>
        </div>
        <div
          className="mt-4 h-2 w-full overflow-hidden border border-rule bg-paper-deep"
          role="img"
          aria-label={`${pct}% of today's budget used`}
        >
          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
          {status.state === "OVER"
            ? "Today's budget is spent — new agent work waits until tomorrow (UTC) so a single busy day can't run up a surprise. Anything queued resumes then."
            : status.state === "WARN"
              ? "You're near today's budget. Your fleet keeps running; the daily cap is just a guard against a runaway day."
              : "Plenty of room today. The daily budget is a quiet circuit-breaker — you'll rarely notice it."}
        </p>
      </ApPaperCard>
    </section>
  );
}
