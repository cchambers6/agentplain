import { ApEyebrow, ApPaperCard } from "@/components/ui/ap";

// Customer-facing monthly token-budget transparency. Renders the workspace's
// month-to-date activity against the activity allowance included with its
// plan, so there's never a surprise overage (production+growth plan §6
// "Trial conversion / no surprise overages" + the task's §5 requirement).
//
// Voice: service-partnership, never "you're expensive" (the operator-facing
// cost-review chip carries that judgment — project_no_outbound_architecture
// keeps the customer surface advisory and on-brand). The hard numbers live on
// the operator board; here the customer sees a calm allowance bar.
//
// Serializable props only — the page resolves the snapshot server-side and
// passes primitives so this stays a pure presentational server component.

interface Props {
  /** OK | WATCH | OVER from the budget snapshot. */
  status: "OK" | "WATCH" | "OVER";
  /** Month-to-date spend, formatted USD (e.g. "$12.40"). */
  spendUsd: string;
  /** Monthly allowance, formatted USD; null when the plan is uncapped (Max). */
  allowanceUsd: string | null;
  /** spend / allowance, 0..>1. Ignored when uncapped. */
  fraction: number;
  /** Human month label, e.g. "June 2026". */
  monthLabel: string;
}

export function BudgetSummary({
  status,
  spendUsd,
  allowanceUsd,
  fraction,
  monthLabel,
}: Props) {
  // Uncapped (Max / quote-based): no bar, just an honest note.
  if (allowanceUsd === null) {
    return (
      <section className="mt-12">
        <ApEyebrow className="mb-4">monthly activity</ApEyebrow>
        <ApPaperCard eyebrow={monthLabel} title="Usage-based, no monthly cap.">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Your engagement runs usage-based — there&rsquo;s no monthly
            activity ceiling. {spendUsd} of compute went into your fleet so
            far this month. Your service partner reviews usage with you as
            part of the engagement.
          </p>
        </ApPaperCard>
      </section>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(fraction * 100)));
  const barColor =
    status === "OVER"
      ? "bg-flag"
      : status === "WATCH"
        ? "bg-clay"
        : "bg-moss";

  return (
    <section className="mt-12">
      <ApEyebrow className="mb-4">monthly activity</ApEyebrow>
      <ApPaperCard
        eyebrow={monthLabel}
        title="Your plan&rsquo;s activity this month."
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-3xl leading-tight text-ink">
            {spendUsd}
          </p>
          <p className="font-mono text-[12px] uppercase tracking-eyebrow text-mute">
            of {allowanceUsd} included
          </p>
        </div>

        <div
          className="mt-4 h-2 w-full overflow-hidden border border-rule bg-paper-deep"
          role="img"
          aria-label={`${pct}% of included monthly activity used`}
        >
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
          {status === "OK" ? (
            <>
              Plenty of headroom — your fleet runs without you watching a
              meter. We show this so the picture stays honest, not so you
              ration it.
            </>
          ) : status === "WATCH" ? (
            <>
              You&rsquo;re using most of this month&rsquo;s included activity.
              Nothing changes today — if your usage keeps climbing, your
              service partner will reach out to make sure you&rsquo;re on the
              right plan. No surprise charges.
            </>
          ) : (
            <>
              You&rsquo;ve reached this month&rsquo;s included activity. We
              flagged it for your service partner to review your plan with you
              — new drafts may wait until that&rsquo;s sorted or the month
              resets. We&rsquo;d rather pause and talk than bill you a
              surprise.
            </>
          )}
        </p>
      </ApPaperCard>
    </section>
  );
}
