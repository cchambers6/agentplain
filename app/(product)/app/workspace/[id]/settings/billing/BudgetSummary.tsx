import { ApEyebrow, ApPaperCard } from "@/components/ui/ap";
import type { BudgetState } from "@/lib/billing/budget";

// Customer-facing monthly token-activity transparency. Renders the workspace's
// last-30-day activity so there's never a surprise overage (production+growth
// plan §6 "Trial conversion / no surprise overages").
//
// Two facts, kept distinct:
//   - ENFORCEMENT: only the operator-set explicit cap (`capUsd`) throttles
//     anything. When set, we show spend against it with an OK/WARN/OVER tone.
//     When unset (`NO_CAP`), nothing is throttled and we say so plainly.
//   - RECOMMENDATION: `recommendedUsd` (MRR × 0.30) is advisory copy only —
//     a healthy-margin budget for the plan. It changes nothing on its own.
//
// Voice: service-partnership, never "you're expensive." The operator board
// carries the cost judgment (project_no_outbound_architecture keeps the
// customer surface advisory and on-brand).
//
// Serializable props only — the page resolves the snapshot server-side and
// passes primitives so this stays a pure presentational server component.

interface Props {
  /** NO_CAP | OK | WARN | OVER from the budget seam (lib/billing/budget.ts). */
  state: BudgetState;
  /** Last-30-day spend, formatted USD (e.g. "$12.40"). */
  spendUsd: string;
  /** Operator-set explicit monthly cap in whole USD; null when none is set. */
  capUsd: number | null;
  /** spend / cap, 0..>1; null when there is no cap. */
  percentUsed: number | null;
  /** Advisory recommended monthly budget in whole USD (MRR × 0.30), or null
   *  for usage-based engagements with no productized price. */
  recommendedUsd: number | null;
}

function RecommendationNote({
  recommendedUsd,
}: {
  recommendedUsd: number | null;
}) {
  if (recommendedUsd === null || recommendedUsd <= 0) return null;
  return (
    <p className="mt-4 border-t border-rule pt-4 text-[13px] leading-relaxed text-ink-soft">
      Recommended budget for your plan:{" "}
      <strong className="text-ink">
        ${recommendedUsd.toLocaleString("en-US")}/mo
      </strong>
      . That&rsquo;s a guide we use to keep your service healthy — it&rsquo;s
      not a charge or a limit. Your fleet keeps running; if usage ever climbs
      well past it, your service partner will talk through the right plan with
      you.
    </p>
  );
}

export function BudgetSummary({
  state,
  spendUsd,
  capUsd,
  percentUsed,
  recommendedUsd,
}: Props) {
  // No explicit cap (the default): nothing is throttled. Honest, calm note +
  // the advisory recommendation.
  if (capUsd === null) {
    return (
      <section className="mt-12">
        <ApEyebrow className="mb-4">monthly activity</ApEyebrow>
        <ApPaperCard eyebrow="last 30 days" title="Your fleet's activity.">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            {spendUsd} of compute went into your fleet over the last 30 days.
            There&rsquo;s no monthly activity cap on your plan — your fleet runs
            without you watching a meter. We show this so the picture stays
            honest.
          </p>
          <RecommendationNote recommendedUsd={recommendedUsd} />
        </ApPaperCard>
      </section>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round((percentUsed ?? 0) * 100)));
  const barColor =
    state === "OVER"
      ? "bg-flag"
      : state === "WARN"
        ? "bg-clay"
        : "bg-moss";

  return (
    <section className="mt-12">
      <ApEyebrow className="mb-4">monthly activity</ApEyebrow>
      <ApPaperCard
        eyebrow="last 30 days"
        title="Your plan&rsquo;s activity this month."
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="font-display text-3xl leading-tight text-ink">
            {spendUsd}
          </p>
          <p className="font-mono text-[12px] uppercase tracking-eyebrow text-mute">
            of ${capUsd.toLocaleString("en-US")} budget
          </p>
        </div>

        <div
          className="mt-4 h-2 w-full overflow-hidden border border-rule bg-paper-deep"
          role="img"
          aria-label={`${pct}% of your monthly budget used`}
        >
          <div
            className={`h-full ${barColor}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
          {state === "OK" ? (
            <>
              Plenty of headroom — your fleet runs without you watching a
              meter. We show this so the picture stays honest, not so you
              ration it.
            </>
          ) : state === "WARN" ? (
            <>
              You&rsquo;re using most of this month&rsquo;s budget. Nothing
              changes today — if your usage keeps climbing, your service
              partner will reach out to make sure you&rsquo;re on the right
              plan. No surprise charges.
            </>
          ) : (
            <>
              You&rsquo;ve reached this month&rsquo;s budget. We flagged it for
              your service partner to review your plan with you — new drafts may
              wait until that&rsquo;s sorted or the month resets. We&rsquo;d
              rather pause and talk than bill you a surprise.
            </>
          )}
        </p>

        <RecommendationNote recommendedUsd={recommendedUsd} />
      </ApPaperCard>
    </section>
  );
}
