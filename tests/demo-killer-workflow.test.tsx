import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { OverviewView } from "@/app/(product)/app/workspace/[id]/overview-view";
import { DemoModePanel } from "@/components/workspace/DemoModePanel";
import { KillerWorkflowRuntime } from "@/components/workspace/KillerWorkflowRuntime";
import { SavedTimeCounter } from "@/components/workspace/SavedTimeCounter";
import { killerWorkflowStoryFor } from "@/lib/workflows/verticals";

// Render coverage for the visible killer-workflow runtime. Client components
// render their INITIAL (pre-effect) state under renderToStaticMarkup — enough
// to prove the surface mounts, the synthetic story text is present, and the
// counter + connect CTA are wired. The step-through animation itself is a
// timing concern covered by the pure runtime tests (lib/workflows/*).

const WS = "ws_demo";
const PARTNER = "Plaino";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

test("runtime renders the trigger, every step, and a sample-data banner", () => {
  const story = killerWorkflowStoryFor("REAL_ESTATE");
  const html = render(<KillerWorkflowRuntime story={story} autoPlay={false} />);
  assert.match(html, /sample data/i);
  assert.match(html, /9:14pm/);
  // Every step label is always in the DOM (value is never animation-dependent).
  for (const step of story.steps) {
    assert.ok(html.includes(step.label), `step "${step.label}" present`);
  }
  // Counter line is present at its initial zero state.
  assert.match(html, /Plaino/);
});

test("CPA runtime surfaces the 47-request batch line", () => {
  const story = killerWorkflowStoryFor("CPA");
  const html = render(<KillerWorkflowRuntime story={story} autoPlay={false} />);
  assert.match(html, /47 personalized document requests/i);
});

test("SavedTimeCounter renders the calibrated line", () => {
  const html = render(
    <SavedTimeCounter
      actions={3}
      savedMinutes={27}
      verb="drafted"
      noun="first touches"
    />,
  );
  assert.match(html, /Plaino/);
  assert.match(html, /drafted/);
  // Initial tween state is the target value under static render.
  assert.match(html, /27 minutes/);
});

test("DemoModePanel shows headline, trial projection, and connect CTA", () => {
  const story = killerWorkflowStoryFor("REAL_ESTATE");
  const html = render(
    <DemoModePanel story={story} workspaceId={WS} partner={PARTNER} variant="page" />,
  );
  assert.match(html, /Every lead gets a first touch in 5 minutes/);
  assert.match(html, /7-day trial/i);
  assert.match(html, /connect Follow Up Boss/i);
  assert.match(html, new RegExp(`/app/workspace/${WS}/integrations/follow-up-boss`));
  // Honesty: the projection is labeled an estimate, not a promise.
  assert.match(html, /estimate on sample data/i);
});

test("Today view enters demo mode and suppresses the static loop preview", () => {
  const story = killerWorkflowStoryFor("LAW");
  const baseProps = {
    workspaceId: WS,
    email: "conner@example.com",
    partner: PARTNER,
    pendingApprovals: 0,
    openFlags: 0,
    recentHandoffs: [],
    briefing: null,
    onboardingComplete: true,
    verticalName: "Law",
    verticalTier: "REGULAR",
    verticalIsLive: false,
    verticalIntegrationsWindow: null,
    verticalPublicHref: "/law",
    activePause: null,
  };
  const html = render(<OverviewView {...baseProps} demoStory={story} />);
  // The demo panel runs the law killer workflow...
  assert.match(html, /Never take a conflicted client/);
  assert.match(html, /11:02pm/);
  // ...and the redundant static "illustration" preview is gone.
  assert.ok(!/An illustration, not your data/i.test(html), "loop preview suppressed");
});

test("Today view without a demo story is unchanged (no panel)", () => {
  const baseProps = {
    workspaceId: WS,
    email: "conner@example.com",
    partner: PARTNER,
    pendingApprovals: 2,
    openFlags: 0,
    recentHandoffs: [],
    briefing: null,
    onboardingComplete: true,
    verticalName: "Real Estate",
    verticalTier: "REGULAR",
    verticalIsLive: true,
    verticalIntegrationsWindow: null,
    verticalPublicHref: "/real-estate",
    activePause: null,
  };
  const html = render(<OverviewView {...baseProps} />);
  assert.ok(!/see it run · sample data/i.test(html), "no demo panel when real work present");
});
