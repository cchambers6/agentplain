// /operator/fleet — cross-workspace fleet ACTIVITY INSPECTOR (Stream D.1).
//
// The operator's primary "see what the fleet is doing" surface. Three composed
// views (client component FleetInspector):
//   1. Live activity feed — newest agent runs across ALL workspaces.
//   2. Sticky search bar — free text + workspace/skill/agent/discipline/status
//      multi-selects + time range; filters compose, URL-bookmarkable.
//   3. Drill-down drawer — full run detail, skill-chain handoffs, inputs /
//      outputs (PII-redacted), approval + webhook links, view-in-workspace,
//      save-to-memory. Detail is fetched fresh from the DB on open.
//
// Data sourcing (feedback_no_guesses_no_estimates) — all real, all from the
// live audit tables via lib/operator/fleet-activity.ts:
//   - feed rows         → SkillRun (LEFT JOIN WorkApprovalQueueItem)
//   - skill chain       → HandoffLogEntry (keyed on the artifact's subject)
//   - inbound triggers  → WebhookEvent (time-correlated, labelled as such)
//   - drift banner      → CapabilityProposal (pending states)
// Empty DB → honest empty states, never fabricated motion.
//
// Gate: this route lives under `app/(operator)/layout.tsx` which redirects
// non-operator sessions to `/app`; we re-assert isOperator here for defense in
// depth, same as /operator/leadership-board. Cross-workspace reads use
// `withSystemContext` (operator GUC), not `withRls` — operators are the
// audience and per-membership RLS would scope reads to their own workspaces.

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import {
  countPendingCapabilityProposals,
  loadFleetActivityFeed,
  loadFleetFilterOptions,
} from "@/lib/operator/fleet-activity";
import {
  fleetFiltersToSearchParams,
  parseFleetFilters,
} from "@/lib/operator/fleet-activity-filters";
import FleetInspector from "./FleetInspector";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OperatorFleetPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }

  const filters = parseFleetFilters(searchParams);
  const filterQuery = fleetFiltersToSearchParams(filters).toString();

  const [initialPage, options, pendingCapabilityProposals] = await Promise.all([
    loadFleetActivityFeed({ filters, limit: 50 }),
    loadFleetFilterOptions(),
    countPendingCapabilityProposals(),
  ]);

  return (
    <FleetInspector
      initialPage={initialPage}
      filters={filters}
      filterQuery={filterQuery}
      options={options}
      pendingCapabilityProposals={pendingCapabilityProposals}
    />
  );
}
