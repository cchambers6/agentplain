import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

// Render-state coverage for the C.2 settings cluster (parallel-path wave 3).
//
// The settings pages are force-dynamic server components that read workspace
// state under RLS, so they cannot be unit-rendered without a DB — and the
// server/client split is locked by PR #147's behavior wiring, so we do NOT
// restructure them here. What this wave ADDED is a real first-paint loader
// for every settings route that lacked one; those loaders are DB-free and
// are pinned below. The error state is the shared workspace boundary
// (covered in customer-visibility-states.test.tsx). Each loader must report
// what is actually happening — never a bare spinner, "Loading…", or a TODO.

import SettingsLoading from "@/app/(product)/app/workspace/[id]/settings/loading";
import BillingLoading from "@/app/(product)/app/workspace/[id]/settings/billing/loading";
import WorkThresholdsLoading from "@/app/(product)/app/workspace/[id]/settings/work-thresholds/loading";
import PauseSettingsLoading from "@/app/(product)/app/workspace/[id]/settings/pause/loading";
import ScheduleSettingsLoading from "@/app/(product)/app/workspace/[id]/settings/schedule/loading";
import PasskeysSettingsLoading from "@/app/(product)/app/workspace/[id]/settings/passkeys/loading";
import DataControlsLoading from "@/app/(product)/app/workspace/[id]/settings/data/loading";
import DisciplineHeadsLoading from "@/app/(product)/app/workspace/[id]/settings/discipline-heads/loading";
import SkillsSettingsLoading from "@/app/(product)/app/workspace/[id]/settings/skills/loading";

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

// Every settings route — index + each section — now resolves to a real,
// contextual loader. The pages this wave touched (the last six) plus the
// three that already had one: the whole cluster is loader-complete.
const LOADERS: Array<{ route: string; Comp: () => React.ReactElement; copy: RegExp }> = [
  { route: "/settings", Comp: SettingsLoading, copy: /reading your workspace settings/i },
  { route: "/settings/billing", Comp: BillingLoading, copy: /reading your plan and invoices/i },
  { route: "/settings/work-thresholds", Comp: WorkThresholdsLoading, copy: /reading your approval thresholds/i },
  { route: "/settings/pause", Comp: PauseSettingsLoading, copy: /reading your pause schedule/i },
  { route: "/settings/schedule", Comp: ScheduleSettingsLoading, copy: /reading your scheduling windows/i },
  // `&` renders as `&amp;` in static markup — match the unambiguous prefix.
  { route: "/settings/passkeys", Comp: PasskeysSettingsLoading, copy: /reading your sign-in/i },
  { route: "/settings/data", Comp: DataControlsLoading, copy: /reading your data controls/i },
  { route: "/settings/discipline-heads", Comp: DisciplineHeadsLoading, copy: /reading your approver routing/i },
  { route: "/settings/skills", Comp: SkillsSettingsLoading, copy: /reading your skill settings/i },
];

for (const { route, Comp, copy } of LOADERS) {
  test(`${route} loader: contextual copy, polite status, no TODO/spinner`, () => {
    const html = render(<Comp />);
    // Reports what's happening, specifically.
    assert.match(html, copy);
    // Announced to assistive tech, not a silent visual-only state.
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    // Real state, not a placeholder.
    assert.doesNotMatch(html, /TODO/i);
    assert.doesNotMatch(html, /Loading…|Loading\.\.\./);
    // No chirpy punctuation in the heritage voice.
    assert.doesNotMatch(html, /!/);
  });
}

test("settings loaders carry a non-empty copy line, not just a bare strip", () => {
  for (const { route, Comp } of LOADERS) {
    const html = render(<Comp />);
    assert.match(html, /<p[^>]*>[^<]+<\/p>/, `${route} loader should render a copy paragraph`);
  }
});
