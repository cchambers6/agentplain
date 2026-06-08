/**
 * Plaino "what next" visual-card retention payload (V27–V30) — builder, carrier
 * validation, and renderer tests.
 *
 * Implements PR #186 §4 (docs/explainer-visual-system-2026-06-07.md).
 *
 *   - buildNextSteps: pure, cold-start safe, priority-ordered, capped at 4,
 *     exactly one primary, never dead-ends.
 *   - parsePlainoCard: total + non-throwing validation off raw metadata
 *     (degraded-mode discipline — malformed → null).
 *   - PlainoCardView: renders each card type under renderToStaticMarkup with
 *     real <a>/<button> deep links (screen-reader complete), brand palette,
 *     and renders nothing for a null card.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { buildNextSteps, buildNextStepsCard } from "@/lib/plaino/next-steps";
import { parsePlainoCard } from "@/lib/plaino/visual-card";
import type { PlainoCard } from "@/lib/plaino/visual-card";
import { PlainoCardView } from "@/components/plaino/PlainoCardView";
import type { PlainoCapabilitySnapshot } from "@/lib/plaino/types";

const WS = "ws_test_123";

const emptySnapshot: PlainoCapabilitySnapshot = {
  disciplines: [],
  connectedIntegrations: [],
  availableButUnconnected: [],
  comingSoon: [],
};

const healthyOnboarding = {
  verticalPicked: true,
  firstToolConnected: true,
  scheduleWindowSet: true,
  firstDraftReviewed: true,
};

describe("buildNextSteps — pure, cold-start safe builder", () => {
  it("prioritizes setup gaps first and marks exactly one primary", () => {
    const steps = buildNextSteps({
      workspaceId: WS,
      snapshot: emptySnapshot,
      onboarding: {
        verticalPicked: false,
        firstToolConnected: false,
        scheduleWindowSet: false,
        firstDraftReviewed: false,
      },
      approvals: { draftsWaiting: 0, oldestAgeHrs: 0 },
      compliance: { openFlags: 0 },
    });
    assert.ok(steps.length >= 1 && steps.length <= 4, "capped 1..4");
    assert.equal(steps.filter((s) => s.weight === "primary").length, 1, "exactly one primary");
    assert.equal(steps[0].weight, "primary", "first step is primary");
    assert.match(steps[0].label, /vertical/i, "setup gap (vertical) ranks first");
    // every step is a real deep link into the workspace
    for (const s of steps) {
      assert.ok(s.href.startsWith(`/app/workspace/${WS}/`), `deep link: ${s.href}`);
    }
  });

  it("surfaces oldest drafts then compliance flags when setup is done", () => {
    const steps = buildNextSteps({
      workspaceId: WS,
      snapshot: emptySnapshot,
      onboarding: healthyOnboarding,
      approvals: { draftsWaiting: 3, oldestAgeHrs: 50 },
      compliance: { openFlags: 2 },
    });
    assert.match(steps[0].label, /3 drafts/);
    assert.ok(steps[0].href.endsWith("/approvals"));
    assert.ok(steps.some((s) => /compliance flags/.test(s.label)), "compliance flag step present");
  });

  it("never dead-ends — returns a positive step when everything is healthy", () => {
    const steps = buildNextSteps({
      workspaceId: WS,
      snapshot: emptySnapshot,
      onboarding: healthyOnboarding,
      approvals: { draftsWaiting: 0, oldestAgeHrs: 0 },
      compliance: { openFlags: 0 },
    });
    assert.equal(steps.length, 1);
    assert.match(steps[0].label, /all set/i);
    assert.ok(steps[0].href.endsWith("/digest"));
  });

  it("caps at 4 even when every category fires + suggests an unused capability", () => {
    const steps = buildNextSteps({
      workspaceId: WS,
      snapshot: {
        ...emptySnapshot,
        availableButUnconnected: [{ id: "gmail", name: "Gmail", category: "inbox" }],
      },
      onboarding: {
        verticalPicked: false,
        firstToolConnected: false,
        scheduleWindowSet: false,
        firstDraftReviewed: false,
      },
      approvals: { draftsWaiting: 5, oldestAgeHrs: 12 },
      compliance: { openFlags: 1 },
    });
    assert.equal(steps.length, 4, "hard cap at 4");
  });

  it("buildNextStepsCard attaches a queue glance only when the queue is non-empty", () => {
    const withQueue = buildNextStepsCard({
      workspaceId: WS,
      snapshot: emptySnapshot,
      onboarding: healthyOnboarding,
      approvals: { draftsWaiting: 2, oldestAgeHrs: 6 },
      compliance: { openFlags: 0 },
    });
    assert.ok(withQueue.queue, "queue glance attached");
    assert.equal(withQueue.queue?.drafts, 2);

    const noQueue = buildNextStepsCard({
      workspaceId: WS,
      snapshot: emptySnapshot,
      onboarding: healthyOnboarding,
      approvals: { draftsWaiting: 0, oldestAgeHrs: 0 },
      compliance: { openFlags: 0 },
    });
    assert.equal(noQueue.queue, undefined, "no queue glance when empty");
  });
});

describe("parsePlainoCard — total, non-throwing carrier validation", () => {
  it("returns null for non-objects and unknown types (degraded mode)", () => {
    assert.equal(parsePlainoCard(null), null);
    assert.equal(parsePlainoCard(undefined), null);
    assert.equal(parsePlainoCard("nope"), null);
    assert.equal(parsePlainoCard({ type: "mystery" }), null);
    assert.equal(parsePlainoCard({ type: "next-steps" }), null, "missing steps");
    assert.equal(parsePlainoCard({ type: "next-steps", steps: [] }), null, "empty steps");
  });

  it("round-trips a valid next-steps card", () => {
    const raw: PlainoCard = {
      type: "next-steps",
      steps: [{ label: "review drafts", href: "/app/workspace/x/approvals", weight: "primary" }],
      queue: { drafts: 1, flags: 0, oldestAgeHrs: 3 },
    };
    const parsed = parsePlainoCard(JSON.parse(JSON.stringify(raw)));
    assert.deepEqual(parsed, raw);
  });

  it("validates capability, work-status, and nav cards", () => {
    assert.ok(parsePlainoCard({ type: "capability", verdict: "yes", detail: "yep" }));
    assert.equal(parsePlainoCard({ type: "capability", verdict: "maybe", detail: "x" }), null);
    assert.ok(parsePlainoCard({ type: "work-status", state: "drafting", approvalId: "a1", discipline: null }));
    assert.equal(parsePlainoCard({ type: "work-status", state: "drafting" }), null, "missing approvalId");
    assert.ok(parsePlainoCard({ type: "nav", destinations: [{ label: "Approvals", href: "/a" }] }));
    assert.equal(parsePlainoCard({ type: "nav", destinations: [] }), null);
  });

  it("drops malformed steps but keeps the card if at least one is valid", () => {
    const parsed = parsePlainoCard({
      type: "next-steps",
      steps: [{ bad: true }, { label: "ok", href: "/x", weight: "normal" }],
    });
    assert.ok(parsed && parsed.type === "next-steps");
    assert.equal((parsed as { steps: unknown[] }).steps.length, 1);
  });
});

describe("PlainoCardView — accessible, additive renderer", () => {
  it("renders nothing for a null/undefined card (text-only degrade)", () => {
    assert.equal(renderToStaticMarkup(createElement(PlainoCardView, { card: null })), "");
    assert.equal(renderToStaticMarkup(createElement(PlainoCardView, { card: undefined })), "");
  });

  it("renders next-steps as real anchor deep links with text labels", () => {
    const card: PlainoCard = {
      type: "next-steps",
      steps: [
        { label: "review 3 drafts waiting on you", href: "/app/workspace/x/approvals", weight: "primary", why: "nothing sends until you approve" },
        { label: "connect Gmail", href: "/app/workspace/x/integrations", weight: "normal" },
      ],
      queue: { drafts: 3, flags: 1, oldestAgeHrs: 30 },
    };
    const html = renderToStaticMarkup(createElement(PlainoCardView, { card }));
    assert.match(html, /<a [^>]*href="\/app\/workspace\/x\/approvals"/);
    assert.ok(html.includes("review 3 drafts waiting on you"), "step label present (SR complete)");
    assert.ok(html.includes("aria-label="), "section labelled");
    // primary step uses clay; brand palette only
    assert.ok(html.includes("#B65D3A"), "primary glyph clay");
  });

  it("renders a capability connect CTA and a work-status progress", () => {
    const cap: PlainoCard = {
      type: "capability",
      verdict: "not-yet",
      detail: "MLS lookups aren't wired yet",
      namedGap: "MLS lookups aren't wired",
      connect: { integrationId: "fub", label: "Follow Up Boss", href: "/app/workspace/x/integrations" },
    };
    const capHtml = renderToStaticMarkup(createElement(PlainoCardView, { card: cap }));
    assert.ok(capHtml.includes("connect Follow Up Boss"));
    assert.match(capHtml, /href="\/app\/workspace\/x\/integrations"/);

    const ws: PlainoCard = { type: "work-status", state: "awaiting-review", approvalId: "ap_9", discipline: "legal" };
    const wsHtml = renderToStaticMarkup(createElement(PlainoCardView, { card: ws }));
    assert.ok(wsHtml.includes("awaiting review"));
    assert.match(wsHtml, /href="\?focus=ap_9"/);
  });

  it("uses no banned colors in any card type", () => {
    const cards: PlainoCard[] = [
      { type: "next-steps", steps: [{ label: "x", href: "/x", weight: "primary" }] },
      { type: "capability", verdict: "yes", detail: "yes" },
      { type: "work-status", state: "approved", approvalId: "a", discipline: null },
      { type: "nav", destinations: [{ label: "Approvals", href: "/a" }] },
    ];
    for (const card of cards) {
      const html = renderToStaticMarkup(createElement(PlainoCardView, { card }));
      for (const banned of ["#0000FF", "#7C3AED", "#000000", "#FFFFFF"]) {
        assert.ok(!html.toUpperCase().includes(banned), `${card.type} used banned ${banned}`);
      }
    }
  });
});
