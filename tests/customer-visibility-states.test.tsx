import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

// Render-state coverage for the C.3 visibility cluster (parallel-path wave 3):
// /activity, /agents (+[slug]), /fleet, /disciplines (+[disciplineId]),
// /compliance.
//
// Like the settings cluster, these are force-dynamic server pages that read
// workspace state under RLS — not unit-renderable without a DB. This file
// pins the DB-free surfaces that report state to the customer:
//   1. the first-paint loader for every visibility route (two added this
//      wave: /disciplines and /disciplines/[disciplineId]);
//   2. the shared workspace error boundary, which is the error state for
//      every page in BOTH clusters; and
//   3. the empty-state + loader primitives every page composes, which must
//      hold the heritage voice (no "!", no emoji, announced to a11y).

import ActivityLoading from "@/app/(product)/app/workspace/[id]/activity/loading";
import AgentsLoading from "@/app/(product)/app/workspace/[id]/agents/loading";
import AgentDetailLoading from "@/app/(product)/app/workspace/[id]/agents/[slug]/loading";
import FleetLoading from "@/app/(product)/app/workspace/[id]/fleet/loading";
import DisciplinesLoading from "@/app/(product)/app/workspace/[id]/disciplines/loading";
import DisciplineDetailLoading from "@/app/(product)/app/workspace/[id]/disciplines/[disciplineId]/loading";
import ComplianceLoading from "@/app/(product)/app/workspace/[id]/compliance/loading";
import WorkspaceError from "@/app/(product)/app/workspace/[id]/error";
import { ApRootedEmptyState, ApRootedLoader } from "@/components/ui/ap";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

const LOADERS: Array<{ route: string; Comp: () => React.ReactElement; copy: RegExp }> = [
  { route: "/activity", Comp: ActivityLoading, copy: /reading your inbox/i },
  { route: "/agents", Comp: AgentsLoading, copy: /tallying your fleet/i },
  { route: "/agents/[slug]", Comp: AgentDetailLoading, copy: /pulling this capability/i },
  { route: "/fleet", Comp: FleetLoading, copy: /reading the queue/i },
  { route: "/disciplines", Comp: DisciplinesLoading, copy: /reading your disciplines/i },
  { route: "/disciplines/[disciplineId]", Comp: DisciplineDetailLoading, copy: /building this discipline/i },
  { route: "/compliance", Comp: ComplianceLoading, copy: /pulling sentinel/i },
];

for (const { route, Comp, copy } of LOADERS) {
  test(`${route} loader: contextual copy, polite status, no TODO/spinner`, () => {
    const html = render(<Comp />);
    assert.match(html, copy);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.doesNotMatch(html, /TODO/i);
    assert.doesNotMatch(html, /Loading…|Loading\.\.\./);
    assert.doesNotMatch(html, /!/);
  });
}

// ── Error state (shared boundary — covers both clusters) ─────────────────────

test("workspace error boundary reports failure → recovery, not a stack trace", () => {
  const html = render(
    <WorkspaceError
      error={Object.assign(new Error("boom"), { digest: "abc123" })}
      reset={() => {}}
    />,
  );
  // What failed, in plain language.
  assert.match(html, /we hit a snag/i);
  // Apostrophe renders as `&#x27;` in static markup — match around it.
  assert.match(html, /this view did/i);
  assert.match(html, /load\./i);
  // What we're doing + reassurance the fleet is still running.
  assert.match(html, /still running/i);
  assert.match(html, /service partner is notified/i);
  // A way out.
  assert.match(html, /try again/i);
  // A support reference, not a raw stack.
  assert.match(html, /reference/i);
  assert.match(html, /abc123/);
  assert.doesNotMatch(html, /boom/);
  assert.doesNotMatch(html, /Oops/i);
});

test("workspace error boundary renders without a digest", () => {
  const html = render(<WorkspaceError error={new Error("x")} reset={() => {}} />);
  assert.match(html, /we hit a snag/i);
  assert.doesNotMatch(html, /reference ·/);
});

// ── State primitives (the contract every page composes) ──────────────────────

test("ApRootedEmptyState reports reality + change + a motif, in the heritage voice", () => {
  const html = render(
    <ApRootedEmptyState
      motif="plow"
      reality="Nothing flagged. Plaino is reading every draft before it goes out."
      change="New flags surface here the moment Sentinel catches one."
    />,
  );
  assert.match(html, /Nothing flagged/);
  assert.match(html, /New flags surface here/);
  // A single image cue rendered.
  assert.match(html, /<svg/);
  // Heritage voice — no chirpy punctuation, no banned "looks like" framing.
  assert.doesNotMatch(html, /!/);
  assert.doesNotMatch(html, /looks like/i);
  assert.doesNotMatch(html, /all (caught up|set)/i);
});

test("ApRootedLoader is announced to assistive tech with a contextual label", () => {
  const html = render(<ApRootedLoader label="Building this discipline's scorecard…" />);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  // Apostrophe renders as `&#x27;` in the escaped attribute — match the prefix.
  assert.match(html, /aria-label="Building this discipline/);
});
