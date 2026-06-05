/**
 * Render smoke tests for the /operator/fleet activity inspector view.
 *
 * Like operator-leadership-board.test.ts, this renders the PURE presentational
 * components (FleetFeedView) with renderToStaticMarkup and asserts on the
 * string output — framework-level, not DOM-level (the project's test runner is
 * node:test, not jsdom/RTL). The stateful shell (FleetInspector) is excluded
 * here because it depends on the Next router + server actions; its presentation
 * is entirely these components, which is what we cover.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  DriftBanner,
  DrawerBody,
  FeedList,
  SearchBar,
  StatusPill,
} from "@/app/(operator)/operator/fleet/FleetFeedView";
import {
  EMPTY_FLEET_FILTERS,
  FLEET_STATUSES,
  type FleetActivityDetail,
  type FleetActivityRow,
  type FleetFilterOptions,
} from "@/lib/operator/fleet-activity-filters";

const NOOP = () => {};

function row(overrides: Partial<FleetActivityRow> = {}): FleetActivityRow {
  return {
    id: overrides.id ?? "run-1",
    workspaceId: overrides.workspaceId ?? "ws-1",
    workspaceName: overrides.workspaceName ?? "Peachtree Realty",
    verticalSlug: overrides.verticalSlug ?? "realty",
    skillSlug: overrides.skillSlug ?? "buyer-inquiry-router",
    skillName: overrides.skillName ?? "Buyer Inquiry Router",
    discipline: overrides.discipline ?? "client-service",
    agentSlug: overrides.agentSlug ?? "buyer-inquiry-router",
    status: overrides.status ?? "awaiting-approval",
    outcomeLine: overrides.outcomeLine ?? "drafted reply — Re: 142 Peachtree",
    firedAt: overrides.firedAt ?? new Date("2026-06-03T11:30:00Z").toISOString(),
    durationMs: overrides.durationMs ?? 1200,
    hasQueueItem: overrides.hasQueueItem ?? true,
  };
}

const OPTIONS: FleetFilterOptions = {
  workspaces: [
    { id: "ws-1", name: "Peachtree Realty", verticalSlug: "realty" },
    { id: "ws-2", name: "Cobb CPA", verticalSlug: "accounting" },
  ],
  skillSlugs: [
    { slug: "buyer-inquiry-router", name: "Buyer Inquiry Router" },
    { slug: "compliance-sentinel", name: "Compliance Sentinel" },
  ],
  agentSlugs: ["buyer-inquiry-router", "compliance-sentinel"],
  disciplines: ["client-service", "compliance"],
  statuses: FLEET_STATUSES,
};

// ---------------------------------------------------------------------------
// FeedList
// ---------------------------------------------------------------------------

describe("FeedList", () => {
  it("shows the cold-start empty state when there are no rows and no filters", () => {
    const html = renderToStaticMarkup(
      createElement(FeedList, { rows: [], filtersActive: false, onOpen: NOOP }),
    );
    assert.match(html, /No agent activity yet/);
  });

  it("shows a filter-specific empty state when filters are active", () => {
    const html = renderToStaticMarkup(
      createElement(FeedList, { rows: [], filtersActive: true, onOpen: NOOP }),
    );
    assert.match(html, /No runs match these filters/);
  });

  it("renders a populated feed with workspace, agent, skill, status, and outcome", () => {
    const html = renderToStaticMarkup(
      createElement(FeedList, {
        rows: [
          row(),
          row({
            id: "run-2",
            status: "failed",
            skillName: "Compliance Sentinel",
            agentSlug: "compliance-sentinel",
            outcomeLine: "compliance flag fired on listing #4521 — fair housing",
          }),
        ],
        filtersActive: false,
        onOpen: NOOP,
      }),
    );
    assert.match(html, /Peachtree Realty/);
    assert.match(html, /Buyer Inquiry Router/);
    assert.match(html, /buyer-inquiry-router/);
    assert.match(html, /drafted reply/);
    assert.match(html, /fair housing/);
    // both rows render as clickable buttons in the feed list
    assert.match(html, /aria-label="fleet activity feed"/);
    assert.equal((html.match(/<button/g) ?? []).length, 2);
  });
});

// ---------------------------------------------------------------------------
// StatusPill
// ---------------------------------------------------------------------------

describe("StatusPill", () => {
  it("renders a labelled, data-attributed pill for every status", () => {
    for (const status of FLEET_STATUSES) {
      const html = renderToStaticMarkup(createElement(StatusPill, { status }));
      assert.match(html, new RegExp(`data-status="${status}"`));
    }
    const awaiting = renderToStaticMarkup(
      createElement(StatusPill, { status: "awaiting-approval" }),
    );
    assert.match(awaiting, /awaiting approval/);
  });
});

// ---------------------------------------------------------------------------
// DriftBanner
// ---------------------------------------------------------------------------

describe("DriftBanner", () => {
  it("links to the leadership board with the pending proposal count", () => {
    const html = renderToStaticMarkup(createElement(DriftBanner, { count: 3 }));
    assert.match(html, /3/);
    assert.match(html, /pending\s+capability proposals/);
    assert.match(html, /href="\/operator\/leadership-board"/);
  });

  it("singularizes for a count of one", () => {
    const html = renderToStaticMarkup(createElement(DriftBanner, { count: 1 }));
    assert.match(html, /capability proposal —/);
  });
});

// ---------------------------------------------------------------------------
// SearchBar
// ---------------------------------------------------------------------------

describe("SearchBar", () => {
  it("renders the free-text input and every filter axis", () => {
    const html = renderToStaticMarkup(
      createElement(SearchBar, {
        filters: EMPTY_FLEET_FILTERS,
        options: OPTIONS,
        onApply: NOOP,
      }),
    );
    assert.match(html, /aria-label="Search fleet activity"/);
    for (const label of ["workspace", "skill", "agent", "discipline", "status"]) {
      assert.match(html, new RegExp(`>${label}`));
    }
    assert.match(html, /aria-label="Time range"/);
    // workspace options surface inside the disclosure
    assert.match(html, /Peachtree Realty/);
    assert.match(html, /Compliance Sentinel/);
  });

  it("shows an active-filter clear control with the active count", () => {
    const html = renderToStaticMarkup(
      createElement(SearchBar, {
        filters: { ...EMPTY_FLEET_FILTERS, statuses: ["failed"], q: "boom" },
        options: OPTIONS,
        onApply: NOOP,
      }),
    );
    assert.match(html, /clear \(2\)/);
  });

  it("reveals custom date inputs only for the custom time range", () => {
    const base = renderToStaticMarkup(
      createElement(SearchBar, {
        filters: EMPTY_FLEET_FILTERS,
        options: OPTIONS,
        onApply: NOOP,
      }),
    );
    assert.doesNotMatch(base, /type="datetime-local"/);
    const custom = renderToStaticMarkup(
      createElement(SearchBar, {
        filters: { ...EMPTY_FLEET_FILTERS, time: "custom" },
        options: OPTIONS,
        onApply: NOOP,
      }),
    );
    assert.match(custom, /type="datetime-local"/);
  });
});

// ---------------------------------------------------------------------------
// DrawerBody
// ---------------------------------------------------------------------------

function detail(overrides: Partial<FleetActivityDetail> = {}): FleetActivityDetail {
  return {
    run: {
      id: "run-1",
      workspaceId: "ws-1",
      workspaceName: "Peachtree Realty",
      verticalSlug: "realty",
      skillSlug: "buyer-inquiry-router",
      skillName: "Buyer Inquiry Router",
      discipline: "client-service",
      agentSlug: "buyer-inquiry-router",
      status: "awaiting-approval",
      outcomeLine: "drafted reply — Re: 142 Peachtree",
      firedAt: new Date("2026-06-03T11:30:00Z").toISOString(),
      completedAt: new Date("2026-06-03T11:30:02Z").toISOString(),
      durationMs: 1800,
      errorMessage: null,
      ...overrides.run,
    },
    output:
      overrides.output !== undefined
        ? overrides.output
        : {
            queueItemId: "q-1",
            kind: "DRAFT_REPLY",
            approvalStatus: "PENDING",
            redactedPayload: '{\n  "subject": "Re: 142 Peachtree"\n}',
          },
    skillChain:
      overrides.skillChain ?? [
        {
          id: "h-1",
          fromAgent: "office-admin",
          toAgent: "buyer-inquiry-router",
          handoffType: "categorized",
          occurredAt: new Date("2026-06-03T11:29:00Z").toISOString(),
          summary: "buyer inquiry — showing request",
        },
      ],
    inboundEvents:
      overrides.inboundEvents ?? [
        {
          id: "w-1",
          receivedAt: new Date("2026-06-03T11:28:00Z").toISOString(),
          processed: true,
          processedAt: new Date("2026-06-03T11:29:30Z").toISOString(),
          dedupeKey: "msg-abc",
          redactedPayload: '{\n  "emailAddress": "g•••@gmail.com"\n}',
        },
      ],
    workspaceActivityHref: "/app/workspace/ws-1/activity",
    approvalsHref: "/app/workspace/ws-1/approvals",
  };
}

describe("DrawerBody", () => {
  it("renders run facts, skill chain, output, inbound, and both action links", () => {
    const html = renderToStaticMarkup(
      createElement(DrawerBody, {
        detail: detail(),
        saveState: "idle",
        onSave: NOOP,
      }),
    );
    // run facts
    assert.match(html, /Buyer Inquiry Router/);
    assert.match(html, /client-service/);
    assert.match(html, /1800 ms/);
    // skill chain provenance
    assert.match(html, /office-admin/);
    assert.match(html, /categorized/);
    // output artifact + approval deep link
    assert.match(html, /Re: 142 Peachtree/);
    assert.match(html, /open approval queue item/);
    assert.match(html, /href="\/app\/workspace\/ws-1\/approvals"/);
    // inbound, time-correlated
    assert.match(html, /processed/);
    // actions
    assert.match(html, /view in workspace/);
    assert.match(html, /href="\/app\/workspace\/ws-1\/activity"/);
    assert.match(html, /save to memory/);
  });

  it("shows honest empty states when there is no output, chain, or inbound", () => {
    const html = renderToStaticMarkup(
      createElement(DrawerBody, {
        detail: detail({ output: null, skillChain: [], inboundEvents: [] }),
        saveState: "idle",
        onSave: NOOP,
      }),
    );
    assert.match(html, /produced no queued artifact/);
    assert.match(html, /No handoffs logged for this subject/);
    assert.match(html, /No webhook events received/);
    // no approval link when there's no output
    assert.doesNotMatch(html, /open approval queue item/);
  });

  it("reflects the save state in the button label", () => {
    const saved = renderToStaticMarkup(
      createElement(DrawerBody, {
        detail: detail(),
        saveState: "saved",
        onSave: NOOP,
      }),
    );
    assert.match(saved, /saved ✓/);
  });

  it("surfaces the error message for a failed run", () => {
    const html = renderToStaticMarkup(
      createElement(DrawerBody, {
        detail: detail({
          run: {
            ...detail().run,
            status: "failed",
            errorMessage: "anthropic 503 — retry exhausted",
          },
          output: null,
        }),
        saveState: "idle",
        onSave: NOOP,
      }),
    );
    assert.match(html, /anthropic 503 — retry exhausted/);
  });
});
