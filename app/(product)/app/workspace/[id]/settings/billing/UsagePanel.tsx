import {
  ApEyebrow,
  ApPaperCard,
  ApRootedEmptyState,
} from "@/components/ui/ap";
import { withRls } from "@/lib/db";
import type { RlsContext } from "@/lib/db";
import type { LlmSourceSurface } from "@prisma/client";
import {
  computeCacheSavings,
  getWorkspaceUsageReport,
  type SurfaceBreakdownRow,
  type UsageSums,
} from "@/lib/billing/usage/aggregate";
import {
  formatMicroCentsAsUsd,
  ratesForModel,
} from "@/lib/billing/usage/pricing";

interface Props {
  workspaceId: string;
  rls: RlsContext;
  periodStart: Date | null;
  periodEnd: Date | null;
}

// Token + cost usage pane. Sits under the plan card on the billing page.
// Renders today / period / 30-day windows + a per-surface breakdown +
// cache-savings summary. Honest about whether usage is being metered to
// Stripe (env-gated — until Conner flips the meter on, the pane says
// "tracked but not yet metered").
//
// Service-partnership voice. No DIY framing. Forest/clay/Fraunces via the
// shared Ap primitives.
export async function UsagePanel({ workspaceId, rls, periodStart, periodEnd }: Props) {
  const report = await withRls(rls, (tx) =>
    getWorkspaceUsageReport(tx, { workspaceId, periodStart }),
  );

  const meterEnabled = process.env.STRIPE_USAGE_METER_ENABLED === "true";

  if (report.last30Days.callCount === 0) {
    return (
      <section className="mt-12">
        <ApEyebrow className="mb-4">usage</ApEyebrow>
        <ApRootedEmptyState
          motif="silo"
          reality="No agent activity yet."
          change="As your fleet handles inbox, scheduling, and follow-ups for you, we'll show what each agent is doing — and what it's costing — right here."
        />
        <MeteringNotice enabled={meterEnabled} />
      </section>
    );
  }

  // Cache-savings is computed against the Sonnet input/cache-read rate as
  // the canonical reference; downstream UI is a coarse "you saved roughly
  // $X" message, not an audit line, so the single-model approximation is
  // fine even on a workspace that mixes Opus/Haiku calls.
  const sonnetRates = ratesForModel("claude-sonnet-4-5");
  const savings = computeCacheSavings(
    report.period,
    sonnetRates.inputPerMillionMicroCents,
    sonnetRates.cacheReadPerMillionMicroCents,
  );

  return (
    <section className="mt-12">
      <ApEyebrow className="mb-4">usage</ApEyebrow>
      <ApPaperCard
        eyebrow="this billing period"
        title="What your fleet ran for you."
      >
        <p className="text-[14px] leading-relaxed text-ink-soft">
          {periodStart && periodEnd
            ? `Activity from ${formatDate(periodStart)} – ${formatDate(periodEnd)}. Refreshed each time you load this page.`
            : `Most recent 30 days of activity. Refreshed each time you load this page.`}
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <MetricCard
            eyebrow="estimated spend"
            value={formatMicroCentsAsUsd(report.period.costMicroCents)}
            sub={`${formatNum(report.period.callCount)} agent task${report.period.callCount === 1 ? "" : "s"}`}
          />
          <MetricCard
            eyebrow="tokens read"
            value={formatNum(
              report.period.inputTokens + report.period.cacheReadTokens,
            )}
            sub={`${formatNum(report.period.outputTokens)} written back`}
          />
          <MetricCard
            eyebrow="today"
            value={formatMicroCentsAsUsd(report.today.costMicroCents)}
            sub={`${formatNum(report.today.callCount)} task${report.today.callCount === 1 ? "" : "s"} so far`}
          />
        </div>

        {savings.estimatedSavedMicroCents > 0n ? (
          <p className="mt-6 border-t border-rule pt-5 text-[13px] leading-relaxed text-ink-soft">
            <span className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              cache savings
            </span>{" "}
            {Math.round(savings.hitRate * 100)}% of input was served from
            our prompt cache this period — roughly{" "}
            <strong className="text-ink">
              {formatMicroCentsAsUsd(savings.estimatedSavedMicroCents)}
            </strong>{" "}
            in compute we didn't pass to you. We tune the cache so your
            fleet stays fast and your bill stays small.
          </p>
        ) : null}
      </ApPaperCard>

      <SurfaceBreakdown
        rows={report.periodBySurface}
        periodTotal={report.period}
      />

      <MeteringNotice enabled={meterEnabled} />
    </section>
  );
}

function MetricCard({
  eyebrow,
  value,
  sub,
}: {
  eyebrow: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {eyebrow}
      </p>
      <p className="mt-1 font-display text-3xl leading-tight text-ink">
        {value}
      </p>
      <p className="mt-1 text-[13px] text-ink-soft">{sub}</p>
    </div>
  );
}

function SurfaceBreakdown({
  rows,
  periodTotal,
}: {
  rows: SurfaceBreakdownRow[];
  periodTotal: UsageSums;
}) {
  if (rows.length === 0) return null;
  const total = periodTotal.costMicroCents;
  return (
    <div className="mt-8">
      <ApEyebrow className="mb-4">where your spend went</ApEyebrow>
      <div className="border border-rule bg-paper">
        {rows.map((row) => {
          const share =
            total > 0n
              ? Math.round((Number(row.sums.costMicroCents) / Number(total)) * 100)
              : 0;
          return (
            <div
              key={row.sourceSurface}
              className="flex flex-col gap-2 border-b border-rule px-5 py-4 last:border-b-0 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-display text-[15px] text-ink">
                  {surfaceLabel(row.sourceSurface)}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-soft">
                  {surfaceDescription(row.sourceSurface)}
                </p>
              </div>
              <div className="flex items-center gap-5 text-[13px]">
                <span className="font-mono text-[12px] text-mute">
                  {formatNum(row.sums.callCount)} task
                  {row.sums.callCount === 1 ? "" : "s"}
                </span>
                <span className="font-mono text-[12px] text-mute">
                  {share}%
                </span>
                <span className="font-display text-[15px] text-ink">
                  {formatMicroCentsAsUsd(row.sums.costMicroCents)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Service-partnership voice. Truth about what's actually happening:
// "tracked" until the meter is wired up. "Reported to Stripe daily" once
// `STRIPE_USAGE_METER_ENABLED=true`. NEVER claims billing is happening
// when it isn't. (project_no_outbound_architecture; HONESTY guardrail.)
function MeteringNotice({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <p className="mt-6 text-[13px] leading-relaxed text-ink-soft">
        Usage is reported to your subscription each day at 3 AM ET so
        invoices reflect the activity above without anything from you.
      </p>
    );
  }
  return (
    <p className="mt-6 text-[13px] leading-relaxed text-ink-soft">
      <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        in development
      </span>
      {" "}Usage is tracked here so the picture is honest — it isn&rsquo;t
      yet metered against your subscription. When metered billing turns on
      we&rsquo;ll let you know in advance.
    </p>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Labels — keyed off the LlmSourceSurface Prisma enum. Adding a new
// surface widens the enum + this map. Falls back to a sentence-case of
// the enum token so a typo at a call site still renders something.
// ────────────────────────────────────────────────────────────────────────

const SURFACE_LABELS: Record<LlmSourceSurface, string> = {
  PLAINO_CHAT: "Plaino chat",
  OFFICE_ADMIN: "Office admin",
  CATEGORIZE: "Inbox categorizer",
  COORDINATE: "Inbox coordinator",
  SCHEDULE: "Scheduler",
  DRAFT: "Reply drafter",
  SUPPORT_HANDLER: "Support handler",
  INBOX_TRIAGE: "Inbox triage",
  FOLLOW_UP_CHASER: "Follow-up chaser",
  PROCESS_DOC_DRAFTER: "Process-doc drafter",
  SCHEDULER_SWEEP: "Scheduler sweep",
  MEMORY_EXTRACT: "Memory keeper",
  OTHER: "Other",
};

const SURFACE_DESCRIPTIONS: Record<LlmSourceSurface, string> = {
  PLAINO_CHAT: "When you talk with Plaino in the workspace.",
  OFFICE_ADMIN: "Verification codes, password resets, billing-notice drafts.",
  CATEGORIZE: "Sorting incoming mail into the right lane.",
  COORDINATE: "Weaving conversations across threads and people.",
  SCHEDULE: "Holding times, sending invites, watching the calendar.",
  DRAFT: "Writing reply drafts for your approval.",
  SUPPORT_HANDLER: "Triaging support requests you've sent us.",
  INBOX_TRIAGE: "Catching what needs your eye in the morning.",
  FOLLOW_UP_CHASER: "Nudging the threads that have gone quiet.",
  PROCESS_DOC_DRAFTER: "Capturing how your office actually does the work.",
  SCHEDULER_SWEEP: "The hourly look-around for new things to schedule.",
  MEMORY_EXTRACT: "Remembering what you've told us so we don't ask twice.",
  OTHER: "Other agent activity.",
};

function surfaceLabel(s: LlmSourceSurface): string {
  return SURFACE_LABELS[s] ?? toTitle(s);
}

function surfaceDescription(s: LlmSourceSurface): string {
  return SURFACE_DESCRIPTIONS[s] ?? "";
}

function toTitle(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => (w.length === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US");
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

