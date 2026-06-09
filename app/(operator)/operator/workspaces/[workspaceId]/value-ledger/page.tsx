/**
 * /operator/workspaces/[workspaceId]/value-ledger
 *
 * Read-only operator surface that surfaces the workspace value ledger:
 * hours saved, dollars influenced, LLM token cost, and net value — all
 * computed from real approval decisions and usage records.
 *
 * Auth: layout.tsx enforces `isOperator` at the route-group level; we
 * re-assert here for defense in depth (same pattern as every sibling
 * operator page).
 *
 * Data flow:
 *   withSystemContext → computeWorkspaceValueLedger → render
 *
 * The page supports a `?days=N` query param (default 30, max 365) so the
 * operator can inspect different windows without a code change.
 *
 * Per `project_no_outbound_architecture.md`: this route is read-only. No
 * mutations; no outbound calls; no side effects.
 *
 * Per `feedback_cold_start_safe_agents.md`: every render reads durable DB
 * state. No session-memory dependency.
 */

import { redirect, notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  computeWorkspaceValueLedger,
  MINUTES_SAVED_BY_KIND,
  LABOR_RATE_USD_PER_HOUR_BY_KIND,
  type WorkspaceValueLedger,
  type KindRow,
} from "@/lib/measurement/value-impact";
import type { WorkApprovalKind } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

interface PageProps {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ days?: string | string[] }>;
}

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function parseDays(raw: string | undefined): number {
  if (!raw) return DEFAULT_DAYS;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) return DEFAULT_DAYS;
  return Math.min(n, MAX_DAYS);
}

export default async function ValueLedgerPage(props: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }

  const { workspaceId } = await props.params;
  const searchParams = await props.searchParams;
  const days = parseDays(pickFirst(searchParams.days));

  // Verify workspace exists before computing (fast check; keeps 404 clean).
  const workspace = await withSystemContext((tx) =>
    tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true, vertical: true },
    }),
  );
  if (!workspace) notFound();

  // Compute the ledger under system context so RLS policies allow cross-workspace
  // reads for the operator. This mirrors the pattern in /operator/workspaces/page.tsx.
  const ledger = await withSystemContext((tx) =>
    computeWorkspaceValueLedger(tx, { workspaceId, periodDays: days }),
  );

  return (
    <div className="container-wide py-12">
      <p className="eyebrow mb-3">Operator · workspaces · value ledger</p>
      <h1 className="font-display text-3xl text-ink">
        {workspace.name} — Value Ledger
      </h1>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {workspace.slug} · {workspace.vertical.toLowerCase().replace(/_/g, " ")}
      </p>

      {/* Window selector */}
      <div className="mt-6 flex items-center gap-3 text-[13px]">
        <span className="text-ink-soft">Window:</span>
        {[7, 30, 90].map((d) => (
          <a
            key={d}
            href={`/operator/workspaces/${workspaceId}/value-ledger?days=${d}`}
            className={
              days === d
                ? "font-mono text-[12px] uppercase tracking-eyebrow text-ink underline underline-offset-4"
                : "font-mono text-[12px] uppercase tracking-eyebrow text-mute hover:text-ink"
            }
          >
            {d}d
          </a>
        ))}
        <span className="text-mute">
          (showing last <strong>{days}</strong> days)
        </span>
      </div>

      {/* Headline metrics */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          label="Hours saved"
          value={`${ledger.hoursSaved.toFixed(1)} hrs`}
          sub="Accepted approvals × estimated minutes per kind ÷ 60"
        />
        <MetricCard
          label="Dollars influenced"
          value={`$${ledger.dollarsInfluenced.toFixed(2)}`}
          sub="Hours saved × labor rate per kind (BLS 2024 medians)"
        />
        <MetricCard
          label="Token cost"
          value={`$${ledger.tokenCostUsd.toFixed(4)}`}
          sub="LlmUsageRecord.costMicroCents ÷ 100 M"
        />
        <MetricCard
          label="Net value"
          value={`$${ledger.netValueUsd.toFixed(2)}`}
          sub="Dollars influenced − token cost"
          highlight={ledger.netValueUsd > 0 ? "positive" : "negative"}
        />
      </div>

      {/* Activity breadth */}
      <div className="mt-6 border border-rule bg-paper p-4">
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          Approvals actioned (accepted + rejected)
        </p>
        <p className="mt-1 font-display text-2xl text-ink">
          {ledger.approvalsActioned}
        </p>
        <p className="mt-1 text-[12px] text-ink-soft">
          Includes APPROVED, AUTO_APPROVED, and REJECTED decisions in the window.
        </p>
      </div>

      {/* Per-kind breakdown */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">By approval kind</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Accepted items only (APPROVED + AUTO_APPROVED). Each row shows the
          assumption inputs so you can validate or tune them.
        </p>
        {Object.keys(ledger.byKind).length === 0 ? (
          <p className="mt-4 text-[13px] text-mute italic">
            No accepted approvals in this window.
          </p>
        ) : (
          <table className="mt-4 w-full border border-rule bg-paper text-left text-[13px]">
            <thead>
              <tr className="border-b border-rule bg-paper-deep text-[11px] font-mono uppercase tracking-eyebrow text-mute">
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3 text-right">Count</th>
                <th className="px-4 py-3 text-right">Min/item</th>
                <th className="px-4 py-3 text-right">Rate $/hr</th>
                <th className="px-4 py-3 text-right">Hours saved</th>
                <th className="px-4 py-3 text-right">$ influenced</th>
              </tr>
            </thead>
            <tbody>
              {(
                Object.entries(ledger.byKind) as Array<
                  [WorkApprovalKind, KindRow]
                >
              )
                .sort((a, b) => b[1].dollars - a[1].dollars)
                .map(([kind, row]) => (
                  <tr
                    key={kind}
                    className="border-b border-rule last:border-b-0"
                  >
                    <td className="px-4 py-2 font-mono text-[12px] text-ink">
                      {kind}
                    </td>
                    <td className="px-4 py-2 text-right text-ink">
                      {row.count}
                    </td>
                    <td className="px-4 py-2 text-right text-mute">
                      {MINUTES_SAVED_BY_KIND[kind] ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-mute">
                      ${LABOR_RATE_USD_PER_HOUR_BY_KIND[kind] ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-ink">
                      {row.hours.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-ink">
                      ${row.dollars.toFixed(2)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Assumptions manifest */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Assumptions</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Every number above is derived from the inputs below — no hidden
          guesses. To tune labor rates or minutes-saved, update{" "}
          <code className="font-mono text-[12px]">
            lib/measurement/value-impact.ts
          </code>{" "}
          and redeploy.
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-[13px] md:grid-cols-2">
          <AssumptionRow
            term="Period"
            desc={`Last ${ledger.assumptions.periodDays} days (configurable via ?days=N, max 365)`}
          />
          <AssumptionRow
            term="Computed at"
            desc={ledger.assumptions.computedAt}
          />
          <AssumptionRow
            term="Dollars influenced formula"
            desc={ledger.assumptions.dollarsInfluencedFormula}
          />
          <AssumptionRow
            term="Token cost formula"
            desc={ledger.assumptions.tokenCostFormula}
          />
          <AssumptionRow
            term="Net value formula"
            desc={ledger.assumptions.netValueFormula}
          />
          <AssumptionRow
            term="Accepted statuses"
            desc={ledger.assumptions.acceptedStatusesOnly}
          />
        </dl>
        <p className="mt-4 text-[12px] text-mute">
          Labor rates sourced from US Bureau of Labor Statistics Occupational
          Outlook Handbook (2024). Admin kinds: $45/hr (Administrative Services
          Managers median). Professional services: $55/hr. Compliance/finance:
          $75/hr. Minutes-saved are internally estimated and should be calibrated
          against real workspace feedback over time.
        </p>
      </section>

      {/* Nav back */}
      <div className="mt-10">
        <a
          href="/operator/workspaces"
          className="text-[13px] text-ink underline"
        >
          ← all workspaces
        </a>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: "positive" | "negative";
}) {
  const valueClass =
    highlight === "positive"
      ? "font-display text-2xl text-emerald-700"
      : highlight === "negative"
        ? "font-display text-2xl text-red-700"
        : "font-display text-2xl text-ink";

  return (
    <div className="border border-rule bg-paper p-4">
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {label}
      </p>
      <p className={valueClass}>{value}</p>
      <p className="mt-1 text-[11px] text-ink-soft">{sub}</p>
    </div>
  );
}

function AssumptionRow({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="border border-rule bg-paper p-3">
      <dt className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {term}
      </dt>
      <dd className="mt-1 text-[12px] text-ink">{desc}</dd>
    </div>
  );
}
