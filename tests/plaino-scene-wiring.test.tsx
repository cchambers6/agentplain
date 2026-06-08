import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PlainoScene,
  isPlaceholderScene,
  verticalSceneName,
  ApRootedEmptyState,
  type PlainoSceneName,
} from "@/components/ui/ap";
import { TalkEmptyState } from "@/app/(product)/app/workspace/[id]/talk/talk-view";

// Wave-6 wiring coverage for the heritage-scene slots. Every PLACEHOLDER
// illustration slot from the Visual Gap Audit (2026-06-07) renders through
// PlainoScene; this test proves each slot resolves to a renderable <img> with
// the expected src/markers and survives react-dom/server renderToStaticMarkup
// (the bare-node:test render path that next/image would break — see Plaino.tsx).

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(node);
}

// The full set of wired scene names — keep in sync with PlainoScene's SRC map.
const ALL_SCENES: PlainoSceneName[] = [
  "home-crew",
  "home-knowledge",
  "home-future",
  "pricing",
  "custom",
  "about-hero",
  "about-dogfood",
  "verticals",
  "legal",
  "inquiry-received",
  "auth-signin",
  "auth-signup",
  "auth-checkout",
  "empty-talk",
  "empty-approvals",
  "empty-activity",
  "empty-sentinel",
  "vertical-real-estate",
  "vertical-mortgage",
  "vertical-insurance",
  "vertical-property-management",
  "vertical-title-escrow",
  "vertical-recruiting",
  "vertical-home-services",
  "vertical-cpa",
  "vertical-law",
  "vertical-ria",
  "vertical-general",
];

test("every wired scene renders an <img> with a resolvable src and survives SSR", () => {
  for (const name of ALL_SCENES) {
    const html = render(<PlainoScene name={name} />);
    assert.match(html, /<img/, `${name} should render an img`);
    // Resolves to a real asset path under the brand system (placeholder today).
    assert.match(
      html,
      /src="\/brand\/plaino-system\//,
      `${name} should point at a /brand/plaino-system asset`,
    );
    // Carries the scene marker so the slot is auditable in the DOM.
    assert.match(
      html,
      new RegExp(`data-plaino-scene="${name}"`),
      `${name} should tag its slot`,
    );
  }
});

test("decorative scene is aria-hidden; labelled scene exposes alt", () => {
  const decorative = render(<PlainoScene name="legal" />);
  assert.match(decorative, /aria-hidden="true"/);
  assert.match(decorative, /alt=""/);

  const labelled = render(
    <PlainoScene name="auth-signin" alt="Plaino at the gate" />,
  );
  assert.match(labelled, /alt="Plaino at the gate"/);
  assert.doesNotMatch(labelled, /aria-hidden/);
});

test("placeholder slots are flagged so a real-asset swap is detectable", () => {
  // All slots ship as placeholders in this wave.
  for (const name of ALL_SCENES) {
    assert.equal(
      isPlaceholderScene(name),
      true,
      `${name} should be a placeholder until a real asset lands`,
    );
  }
  const html = render(<PlainoScene name="empty-talk" />);
  assert.match(html, /data-plaino-placeholder="true"/);
});

test("verticalSceneName maps known slugs and falls back to general", () => {
  assert.equal(verticalSceneName("real-estate"), "vertical-real-estate");
  assert.equal(verticalSceneName("cpa"), "vertical-cpa");
  // Unknown / on-ramp slug → general, never a blank render.
  assert.equal(verticalSceneName("not-a-vertical"), "vertical-general");
  assert.equal(verticalSceneName("general"), "vertical-general");
});

test("ApRootedEmptyState renders the heritage scene over the line-art motif", () => {
  const html = render(
    <ApRootedEmptyState
      scene="empty-approvals"
      reality="Nothing waiting on you."
    />,
  );
  assert.match(html, /data-plaino-scene="empty-approvals"/);
  assert.match(html, /Nothing waiting on you\./);
});

test("ApRootedEmptyState still supports the legacy line-art motif when no scene", () => {
  const html = render(
    <ApRootedEmptyState motif="lone-tree" reality="No drafts." />,
  );
  // Falls back to the inline svg motif (no scene img tag).
  assert.match(html, /<svg/);
  assert.doesNotMatch(html, /data-plaino-scene/);
});

test("talk empty state renders the wired empty-talk scene", () => {
  const html = render(<TalkEmptyState />);
  assert.match(html, /data-plaino-scene="empty-talk"/);
  assert.match(html, /Plaino&#x27;s waiting|Plaino's waiting/);
});
