import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  OverviewView,
  buildHeadline,
  buildNextActions,
  firstNameFromEmail,
  type OverviewHandoff,
} from "@/app/(product)/app/workspace/[id]/overview-view";

// State-render coverage for the workspace home — the first page a
// customer sees after sign-in. Rendered DB-free via the extracted view
// module (page.tsx is a thin loader). Each test pins one state: empty,
// populated, mid-onboarding, and paused.

const WS = "ws_test";
const PARTNER = "Plaino";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

function handoff(over: Partial<OverviewHandoff> = {}): OverviewHandoff {
  return {
    id: over.id ?? "h1",
    fromAgent: over.fromAgent ?? "reader",
    toAgent: over.toAgent ?? "router",
    handoffType: over.handoffType ?? "categorize",
    occurredAt: over.occurredAt ?? new Date("2026-06-05T14:00:00Z"),
  };
}

const baseProps = {
  workspaceId: WS,
  email: "conner@flatsbo.com",
  partner: PARTNER,
  pendingApprovals: 0,
  openFlags: 0,
  recentHandoffs: [] as OverviewHandoff[],
  briefing: null,
  onboardingComplete: true,
  verticalName: "Real Estate",
  verticalTier: "REGULAR",
  verticalIsLive: true,
  verticalIntegrationsWindow: "this summer",
  activePause: null,
};

test("empty state explains why + offers a connect CTA", () => {
  const html = render(<OverviewView {...baseProps} />);
  assert.match(html, /watching your inbox/i);
  assert.match(html, /first handoff lands/i);
  assert.match(html, /connect another tool/i);
  // The illustrative loop preview is clearly labeled as an example.
  assert.match(html, /An illustration, not your data/i);
});

test("populated state names today's work in the headline + feed", () => {
  const html = render(
    <OverviewView
      {...baseProps}
      pendingApprovals={3}
      openFlags={1}
      recentHandoffs={[
        handoff({ id: "h1", handoffType: "categorize" }),
        handoff({ id: "h2", fromAgent: "router", toAgent: "scheduler", handoffType: "schedule" }),
      ]}
    />,
  );
  assert.match(html, /We drafted 3 replies/i);
  assert.match(html, /flagged 1 item/i);
  // Feed renders the handoff rows, not the empty state.
  assert.doesNotMatch(html, /watching your inbox/i);
  assert.match(html, /scheduler/);
});

test("mid-onboarding shows the continue-onboarding nudge", () => {
  const html = render(
    <OverviewView {...baseProps} onboardingComplete={false} />,
  );
  assert.match(html, /continue onboarding/i);
  assert.match(html, /Finish workspace setup/i);
});

test("active pause renders a calm paused banner", () => {
  const html = render(
    <OverviewView
      {...baseProps}
      activePause={{
        pausedUntil: new Date("2026-06-06T09:00:00Z"),
        pausedDisciplineIds: ["client-comms"],
      }}
    />,
  );
  assert.match(html, /is paused/i);
  assert.match(html, /client-comms/);
  assert.match(html, /manage/i);
});

test("greeting derives a first name from the email", () => {
  const html = render(<OverviewView {...baseProps} email="conner@x.com" />);
  assert.match(html, /Conner/);
});

// ── Pure logic ──────────────────────────────────────────────────────────────

test("buildHeadline: nothing-yet copy when fully empty", () => {
  assert.equal(
    buildHeadline({ pendingApprovals: 0, openFlags: 0, recentHandoffs: [], partner: PARTNER }),
    "Plaino is watching your inbox. Nothing's come in yet.",
  );
});

test("buildHeadline: joins drafted + scheduled + flagged", () => {
  const line = buildHeadline({
    pendingApprovals: 2,
    openFlags: 1,
    recentHandoffs: [{ handoffType: "propose-schedule" }],
    partner: PARTNER,
  });
  assert.match(line, /drafted 2 replies/);
  assert.match(line, /scheduled 1 showing/);
  assert.match(line, /flagged 1 item/);
});

test("buildNextActions: onboarding + compliance rank high, capped at 3", () => {
  const actions = buildNextActions({
    workspaceId: WS,
    onboardingComplete: false,
    openFlags: 2,
    pendingApprovals: 5,
    verticalName: "Real Estate",
    verticalIntegrationsWindow: "soon",
  });
  assert.equal(actions.length, 3);
  assert.equal(actions[0]!.key, "onboarding");
  assert.equal(actions[0]!.urgency, "high");
});

test("firstNameFromEmail: falls back to 'there' for numeric/empty locals", () => {
  assert.equal(firstNameFromEmail(""), "there");
  assert.equal(firstNameFromEmail("12345@x.com"), "there");
  assert.equal(firstNameFromEmail("jane.doe@x.com"), "Jane");
});
