import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WorkspaceDetailView,
  type WorkspaceDetailViewProps,
} from "@/app/(operator)/operator/workspaces/[workspaceId]/workspace-detail-view";
import { deriveBudgetStatus } from "@/lib/billing/budget";
import {
  buildActivityTimeline,
  buildApprovalQueueSummary,
  deriveIntegrationHealth,
  summarizeActivity,
} from "@/lib/operator/workspace-inspector";

// State-render coverage for the operator per-workspace deep-dive. Rendered
// DB-free via the view module (page.tsx is a thin loader). Each test pins one
// state the operator must be able to read at a glance.

const NOW = new Date("2026-06-05T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const USD = 100_000_000n;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

function baseProps(over: Partial<WorkspaceDetailViewProps> = {}): WorkspaceDetailViewProps {
  const activity = buildActivityTimeline([
    { id: "r1", skillSlug: "buyer-inquiry-router", discipline: "client-service", firedAt: ago(HOUR), completedAt: ago(HOUR), outcome: "DRAFTED", durationMs: 900, queueStatus: "PENDING" },
    { id: "r2", skillSlug: "compliance-sentinel", discipline: "compliance", firedAt: ago(2 * HOUR), completedAt: ago(2 * HOUR), outcome: "FAILED", durationMs: 100, queueStatus: null },
  ]);
  return {
    workspace: {
      id: "ws-1",
      name: "Peachtree Realty",
      slug: "peachtree-realty",
      vertical: "REAL_ESTATE",
      verticalTier: "REGULAR",
      billingMode: "SELF_SERVE",
      closureStatus: "ACTIVE",
    },
    now: NOW,
    budget: deriveBudgetStatus({ workspaceId: "ws-1", consumedMicroCents: 40n * USD, capUsdMonthly: 100, tokensThisPeriod: 12345 }),
    approvals: buildApprovalQueueSummary(
      [{ proposedAt: ago(30 * 60 * 1000) }, { proposedAt: ago(10 * DAY) }],
      NOW,
    ),
    integrations: deriveIntegrationHealth(
      [
        { provider: "GOOGLE", accountEmail: "ops@brokerage.com", status: "ACTIVE", scopes: ["read"], expiresAt: ago(-30 * DAY), lastRefreshedAt: ago(DAY) },
      ],
      { GOOGLE: "Gmail" },
      NOW,
    ),
    activity,
    activityCounts: summarizeActivity(activity),
    topSurfaces: [
      { surface: "DRAFT", costMicroCents: 30n * USD, tokens: 9000, callCount: 5 },
    ],
    billing: {
      hasSubscription: true,
      status: "ACTIVE",
      tierLabel: "Regular",
      seats: 4,
      currentPeriodEnd: new Date("2026-07-01T00:00:00Z"),
      monthlyRevenueUsd: 396,
      lastEventType: "invoice.paid",
      lastEventAt: ago(2 * DAY),
    },
    memberships: [
      { userId: "u1", email: "marcus@peachtree.com", name: "Marcus Lee", role: "BROKER_OWNER", status: "ACTIVE" },
    ],
    capabilityProposals: [],
    lastUserActivityAt: ago(3 * HOUR),
    ...over,
  };
}

test("renders the header with impersonate + export entry points", () => {
  const html = render(<WorkspaceDetailView {...baseProps()} />);
  assert.match(html, /Peachtree Realty/);
  assert.match(html, /Impersonate \(read-only\)/i);
  assert.match(html, /Export workspace state/i);
  assert.match(html, /\/operator\/workspaces\/ws-1\/impersonate/);
  assert.match(html, /\/operator\/workspaces\/ws-1\/export/);
});

test("budget bar shows percent of cap and token total", () => {
  const html = render(<WorkspaceDetailView {...baseProps()} />);
  assert.match(html, /40% of cap/);
  assert.match(html, /12,345 tokens this period/);
  assert.match(html, /of \$100 \/ mo/);
});

test("over-budget + revenue-exceeded surfaces margin-risk copy", () => {
  const budget = deriveBudgetStatus({ workspaceId: "ws-1", consumedMicroCents: 500n * USD, capUsdMonthly: 100 });
  const html = render(
    <WorkspaceDetailView
      {...baseProps({
        budget,
        billing: { ...baseProps().billing, monthlyRevenueUsd: 200 },
      })}
    />,
  );
  assert.match(html, /Over budget/i);
  assert.match(html, /margin risk/i);
});

test("no-cap workspace renders the no-cap badge, not a percent", () => {
  const budget = deriveBudgetStatus({ workspaceId: "ws-1", consumedMicroCents: 5n * USD, capUsdMonthly: null });
  const html = render(<WorkspaceDetailView {...baseProps({ budget })} />);
  assert.match(html, /no cap configured/i);
  assert.match(html, /this period · no cap/i);
});

test("approval histogram renders the four buckets and oldest age", () => {
  const html = render(<WorkspaceDetailView {...baseProps()} />);
  assert.match(html, /2 open/);
  assert.match(html, /oldest 10d/);
  assert.match(html, /&lt; 1h/); // bucket label, HTML-escaped
  assert.match(html, /&gt; 7d/);
});

test("integration health table flags an expired credential", () => {
  const integrations = deriveIntegrationHealth(
    [{ provider: "SLACK", accountEmail: "x@y.com", status: "REVOKED", scopes: [], expiresAt: ago(DAY), lastRefreshedAt: null }],
    { SLACK: "Slack" },
    NOW,
  );
  const html = render(<WorkspaceDetailView {...baseProps({ integrations })} />);
  assert.match(html, /Slack/);
  assert.match(html, /revoked/);
  assert.match(html, /1 need attention/);
});

test("empty integrations renders the none-connected state", () => {
  const html = render(<WorkspaceDetailView {...baseProps({ integrations: [] })} />);
  assert.match(html, /No integrations connected/i);
});

test("activity timeline shows skill labels and the failed run", () => {
  const html = render(<WorkspaceDetailView {...baseProps()} />);
  assert.match(html, /buyer inquiry router/);
  assert.match(html, /compliance sentinel/);
  assert.match(html, /failed/);
});

test("billing block names subscription, seats, and last event", () => {
  const html = render(<WorkspaceDetailView {...baseProps()} />);
  assert.match(html, /Regular · ACTIVE/);
  assert.match(html, /invoice\.paid/);
  assert.match(html, /Marcus Lee/);
});

test("closure status renders a flag when not active", () => {
  const html = render(
    <WorkspaceDetailView {...baseProps({ workspace: { ...baseProps().workspace, closureStatus: "CLOSING" } })} />,
  );
  assert.match(html, /closure: CLOSING/);
});

test("pending capability proposals are listed", () => {
  const html = render(
    <WorkspaceDetailView
      {...baseProps({
        capabilityProposals: [
          { id: "c1", targetAgentSlug: "buyer-inquiry-router", state: "AWAITING_REVIEW", proposer: "plaino", createdAt: ago(DAY) },
        ],
      })}
    />,
  );
  assert.match(html, /buyer-inquiry-router/);
  assert.match(html, /awaiting review/);
  assert.match(html, /1 pending/);
});
