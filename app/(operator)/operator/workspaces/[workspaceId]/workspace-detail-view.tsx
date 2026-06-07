// DB-free presentational view for the operator per-workspace deep-dive.
// page.tsx is a thin loader that shapes data and hands it here; all the
// rendering + state copy lives in this module so it renders under
// `renderToStaticMarkup` in tests without a database (same split as
// overview-view.tsx and the fleet inspector).

import Link from "next/link";
import { formatMicroCentsAsUsd } from "@/lib/billing/usage/pricing";
import type { WorkspaceBudgetStatus, BudgetState } from "@/lib/billing/budget";
import {
  formatAge,
  type ActivityRow,
  type ApprovalQueueSummary,
  type IntegrationHealth,
  type IntegrationHealthRow,
  type UsageSurfaceRow,
} from "@/lib/operator/workspace-inspector";
import type { FleetStatus } from "@/lib/operator/fleet-activity-filters";

export interface WorkspaceHeader {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  verticalTier: string;
  billingMode: string;
  closureStatus: string;
}

export interface MembershipRow {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
}

export interface CapabilityProposalRow {
  id: string;
  targetAgentSlug: string | null;
  state: string;
  proposer: string | null;
  createdAt: Date;
}

export interface BillingSummary {
  hasSubscription: boolean;
  status: string | null;
  tierLabel: string | null;
  seats: number | null;
  currentPeriodEnd: Date | null;
  monthlyRevenueUsd: number | null;
  lastEventType: string | null;
  lastEventAt: Date | null;
}

export interface WorkspaceDetailViewProps {
  workspace: WorkspaceHeader;
  now: Date;
  budget: WorkspaceBudgetStatus;
  approvals: ApprovalQueueSummary;
  integrations: IntegrationHealthRow[];
  activity: ActivityRow[];
  activityCounts: Record<FleetStatus, number>;
  topSurfaces: UsageSurfaceRow[];
  billing: BillingSummary;
  memberships: MembershipRow[];
  capabilityProposals: CapabilityProposalRow[];
  lastUserActivityAt: Date | null;
  /** MRR-proportional advisory cap (whole USD), or null when there is no
   *  productized price to anchor a recommendation (Max). NOT enforced — see
   *  `lib/billing/recommendations.ts`. When present, the Token budget section
   *  renders a "Recommended cap — Apply" control. */
  recommendedCapUsd?: number | null;
  /** Server action that writes the explicit cap (settings.tokenBudgetUsdMonthly)
   *  for this workspace. Reads `workspaceId` + `capUsd` from the submitted
   *  form. Omitted in DB-free render tests, where the Apply control is hidden. */
  applyBudgetCapAction?: (formData: FormData) => void | Promise<void>;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function ageFrom(now: Date, then: Date | null): string {
  if (!then) return "—";
  return formatAge(now.getTime() - then.getTime()) + " ago";
}

const BUDGET_TONE: Record<BudgetState, string> = {
  NO_CAP: "bg-rule",
  OK: "bg-ink",
  WARN: "bg-flag",
  OVER: "bg-flag",
};

const HEALTH_TONE: Record<IntegrationHealth, string> = {
  HEALTHY: "text-ink-soft",
  EXPIRING: "text-flag",
  EXPIRED: "text-flag",
  REVOKED: "text-flag",
  ERROR: "text-flag",
};

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between border-b border-rule pb-2">
        <h2 className="font-display text-xl text-ink">{title}</h2>
        {badge ? (
          <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function WorkspaceDetailView(props: WorkspaceDetailViewProps) {
  const {
    workspace,
    now,
    budget,
    approvals,
    integrations,
    activity,
    activityCounts,
    topSurfaces,
    billing,
    memberships,
    capabilityProposals,
    lastUserActivityAt,
    recommendedCapUsd,
    applyBudgetCapAction,
  } = props;

  const unhealthy = integrations.filter((i) => i.health !== "HEALTHY").length;

  return (
    <div className="container-wide py-12">
      <p className="eyebrow mb-3">
        <Link href="/operator/workspaces" className="underline">
          Operator · workspaces
        </Link>{" "}
        / deep-dive
      </p>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">{workspace.name}</h1>
          <p className="mt-1 font-mono text-[12px] uppercase text-mute">
            {workspace.slug} · {workspace.vertical.toLowerCase().replace(/_/g, " ")} ·
            tier {workspace.verticalTier} · {workspace.billingMode}
          </p>
          <p className="mt-1 font-mono text-[11px] text-mute">{workspace.id}</p>
          {workspace.closureStatus !== "ACTIVE" ? (
            <p className="mt-2 inline-block border border-flag px-2 py-1 font-mono text-[11px] uppercase text-flag">
              closure: {workspace.closureStatus}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href={`/operator/workspaces/${workspace.id}/impersonate`}
            className="border border-rule bg-paper-deep px-3 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-ink hover:bg-paper"
          >
            Impersonate (read-only) →
          </Link>
          {/* Plain <a> (not next/link): this hits a GET route that returns a
              JSON attachment, so we want a real browser navigation/download,
              not a client-side route transition. */}
          <a
            href={`/operator/workspaces/${workspace.id}/export`}
            className="border border-rule bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-ink hover:bg-paper-deep"
          >
            ↓ Export workspace state (JSON)
          </a>
        </div>
      </div>

      {/* ── Token budget ─────────────────────────────────────────────── */}
      <Section
        title="Token budget"
        badge={
          budget.capUsdMonthly === null
            ? "no cap configured"
            : `${Math.round((budget.percentUsed ?? 0) * 100)}% of cap`
        }
      >
        <div className="border border-rule bg-paper p-4">
          <div className="flex items-baseline justify-between text-[14px] text-ink">
            <span className="font-display text-2xl">
              {formatMicroCentsAsUsd(budget.consumedMicroCents)}
            </span>
            <span className="font-mono text-[12px] text-mute">
              {budget.capUsdMonthly === null
                ? "this period · no cap"
                : `of $${budget.capUsdMonthly.toLocaleString("en-US")} / mo`}
            </span>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden border border-rule bg-paper-deep">
            <div
              className={`h-full ${BUDGET_TONE[budget.state]}`}
              style={{
                width: `${Math.min(100, Math.round((budget.percentUsed ?? 0) * 100))}%`,
              }}
              aria-hidden
            />
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            state: {budget.state.toLowerCase()} ·{" "}
            {budget.tokensThisPeriod.toLocaleString("en-US")} tokens this period
            {budget.remainingUsd !== null
              ? ` · $${budget.remainingUsd.toFixed(2)} remaining`
              : ""}
          </p>
          {budget.state === "OVER" ? (
            <p className="mt-2 text-[13px] text-flag">
              Over budget — token spend has reached the configured cap.
            </p>
          ) : null}
          {billing.monthlyRevenueUsd !== null ? (
            <p className="mt-2 text-[12px] text-ink-soft">
              Subscription revenue: ${billing.monthlyRevenueUsd.toLocaleString("en-US")}/mo
              {budget.consumedUsd > billing.monthlyRevenueUsd ? (
                <span className="text-flag">
                  {" "}
                  — period token spend exceeds revenue (margin risk)
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        {/* Recommended cap (advisory, MRR × 0.30 — lib/billing/recommendations.ts).
            Applying it WRITES the explicit cap the gate enforces on; it is never
            auto-applied. Hidden when there's no recommendation (Max / no price). */}
        {recommendedCapUsd != null && recommendedCapUsd > 0 ? (
          <div className="mt-4 border border-rule bg-paper-deep p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                  recommended cap
                </p>
                <p className="mt-1 font-display text-xl text-ink">
                  ${recommendedCapUsd.toLocaleString("en-US")}
                  <span className="ml-2 font-mono text-[11px] uppercase text-mute">
                    / mo
                  </span>
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                  30% of MRR — keeps token COGS inside a ~70% gross-margin
                  target. Advisory only; applying it sets this workspace&rsquo;s
                  enforced monthly cap.
                </p>
              </div>
              {applyBudgetCapAction ? (
                <form action={applyBudgetCapAction} className="shrink-0">
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <input type="hidden" name="capUsd" value={recommendedCapUsd} />
                  <button
                    type="submit"
                    className="border border-rule bg-paper px-3 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-ink hover:bg-paper-deep"
                  >
                    {budget.capUsdMonthly === null
                      ? "Apply recommended cap"
                      : "Set cap to recommended"}
                  </button>
                </form>
              ) : null}
            </div>
            {budget.capUsdMonthly !== null &&
            budget.capUsdMonthly !== recommendedCapUsd ? (
              <p className="mt-3 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                current cap: ${budget.capUsdMonthly.toLocaleString("en-US")}/mo
              </p>
            ) : null}
            {applyBudgetCapAction && budget.capUsdMonthly !== null ? (
              <form action={applyBudgetCapAction} className="mt-2">
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <input type="hidden" name="capUsd" value="" />
                <button
                  type="submit"
                  className="font-mono text-[11px] uppercase tracking-eyebrow text-mute underline hover:text-ink"
                >
                  remove cap (NO_CAP)
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {topSurfaces.length > 0 ? (
          <table className="mt-4 w-full border border-rule bg-paper text-left text-[13px]">
            <thead>
              <tr className="border-b border-rule bg-paper-deep text-[11px] font-mono uppercase tracking-eyebrow text-mute">
                <th className="px-3 py-2">Surface</th>
                <th className="px-3 py-2">Cost</th>
                <th className="px-3 py-2">Tokens</th>
                <th className="px-3 py-2">Calls</th>
              </tr>
            </thead>
            <tbody>
              {topSurfaces.map((s) => (
                <tr key={s.surface} className="border-b border-rule last:border-b-0">
                  <td className="px-3 py-2 font-mono text-[12px] text-ink-soft">
                    {s.surface.toLowerCase().replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2 text-ink">
                    {formatMicroCentsAsUsd(s.costMicroCents)}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">
                    {s.tokens.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{s.callCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-4 text-[13px] text-mute">No token usage this period.</p>
        )}
      </Section>

      {/* ── Approvals queue ──────────────────────────────────────────── */}
      <Section
        title="Approval queue"
        badge={`${approvals.total} open${
          approvals.oldestAgeMs !== null
            ? ` · oldest ${formatAge(approvals.oldestAgeMs)}`
            : ""
        }`}
      >
        {approvals.total === 0 ? (
          <p className="text-[13px] text-mute">Queue is empty.</p>
        ) : (
          <div className="flex gap-4">
            {approvals.buckets.map((b) => (
              <div
                key={b.key}
                className="flex-1 border border-rule bg-paper p-3 text-center"
              >
                <p className="font-display text-2xl text-ink">{b.count}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                  {b.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Integration health ───────────────────────────────────────── */}
      <Section
        title="Integration health"
        badge={
          integrations.length === 0
            ? "none connected"
            : unhealthy > 0
              ? `${unhealthy} need attention`
              : "all healthy"
        }
      >
        {integrations.length === 0 ? (
          <p className="text-[13px] text-mute">
            No integrations connected for this workspace.
          </p>
        ) : (
          <table className="w-full border border-rule bg-paper text-left text-[13px]">
            <thead>
              <tr className="border-b border-rule bg-paper-deep text-[11px] font-mono uppercase tracking-eyebrow text-mute">
                <th className="px-3 py-2">Integration</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Health</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2">Last refresh</th>
                <th className="px-3 py-2">Scopes</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((i) => (
                <tr
                  key={`${i.provider}-${i.accountEmail}`}
                  className="border-b border-rule last:border-b-0"
                >
                  <td className="px-3 py-2 text-ink">{i.name}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-ink-soft">
                    {i.accountEmail}
                  </td>
                  <td className={`px-3 py-2 font-mono text-[12px] uppercase ${HEALTH_TONE[i.health]}`}>
                    {i.health.toLowerCase()}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">
                    {i.expiresInDays < 0
                      ? `${Math.abs(i.expiresInDays)}d ago`
                      : `in ${i.expiresInDays}d`}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">
                    {ageFrom(now, i.lastRefreshedAt)}
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{i.scopesCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* ── Recent activity ──────────────────────────────────────────── */}
      <Section
        title="Recent activity"
        badge={`${activityCounts.succeeded} ok · ${activityCounts.failed} failed · ${activityCounts["awaiting-approval"]} awaiting`}
      >
        {activity.length === 0 ? (
          <p className="text-[13px] text-mute">No agent activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-rule border border-rule bg-paper">
            {activity.map((a) => (
              <li
                key={a.id}
                className="flex items-baseline justify-between px-3 py-2 text-[13px]"
              >
                <span className="text-ink">
                  {a.skillLabel}
                  {a.discipline ? (
                    <span className="text-mute"> · {a.discipline}</span>
                  ) : null}
                </span>
                <span className="flex items-baseline gap-3">
                  <span
                    className={`font-mono text-[11px] uppercase ${
                      a.status === "failed" ? "text-flag" : "text-mute"
                    }`}
                  >
                    {a.statusLabel}
                  </span>
                  <span className="font-mono text-[11px] text-mute">
                    {ageFrom(now, a.firedAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── Billing + people ─────────────────────────────────────────── */}
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <div className="border-b border-rule pb-2">
            <h2 className="font-display text-xl text-ink">Billing</h2>
          </div>
          <dl className="mt-4 space-y-2 text-[13px]">
            <Row label="Subscription">
              {billing.hasSubscription
                ? `${billing.tierLabel ?? "?"} · ${billing.status ?? "?"}`
                : "— none"}
            </Row>
            <Row label="Seats">{billing.seats ?? "—"}</Row>
            <Row label="Period ends">{fmtDate(billing.currentPeriodEnd)}</Row>
            <Row label="Last billing event">
              {billing.lastEventType
                ? `${billing.lastEventType} (${ageFrom(now, billing.lastEventAt)})`
                : "—"}
            </Row>
          </dl>
        </div>

        <div>
          <div className="border-b border-rule pb-2">
            <h2 className="font-display text-xl text-ink">Members & activity</h2>
          </div>
          <dl className="mt-4 space-y-2 text-[13px]">
            <Row label="Members">{memberships.length}</Row>
            <Row label="Last user activity">
              {ageFrom(now, lastUserActivityAt)}
            </Row>
          </dl>
          <ul className="mt-3 divide-y divide-rule border border-rule bg-paper text-[13px]">
            {memberships.map((m) => (
              <li
                key={m.userId}
                className="flex items-baseline justify-between px-3 py-2"
              >
                <span className="text-ink">{m.name ?? m.email}</span>
                <span className="font-mono text-[11px] uppercase text-mute">
                  {m.role.toLowerCase().replace(/_/g, " ")} · {m.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Capability proposals ─────────────────────────────────────── */}
      <Section
        title="Capability proposals pending review"
        badge={`${capabilityProposals.length} pending`}
      >
        {capabilityProposals.length === 0 ? (
          <p className="text-[13px] text-mute">No proposals awaiting review.</p>
        ) : (
          <ul className="divide-y divide-rule border border-rule bg-paper text-[13px]">
            {capabilityProposals.map((p) => (
              <li
                key={p.id}
                className="flex items-baseline justify-between px-3 py-2"
              >
                <span className="text-ink">
                  {p.targetAgentSlug ?? "(unscoped)"}
                  {p.proposer ? (
                    <span className="text-mute"> · {p.proposer}</span>
                  ) : null}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] uppercase text-mute">
                    {p.state.toLowerCase().replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-[11px] text-mute">
                    {ageFrom(now, p.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {label}
      </dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
