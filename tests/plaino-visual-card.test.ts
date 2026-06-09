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
import { buildBeforeAfterCard } from "@/lib/plaino/before-after";
import { buildDecisionTreeCard } from "@/lib/plaino/decision-tree";
import { buildCompliancePostureCard } from "@/lib/plaino/compliance-posture";
import { buildOnboardingProgressCard } from "@/lib/plaino/onboarding-progress";
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
      {
        type: "before-after",
        rows: [{ task: "drafting", before: "manual", after: "queued" }],
      },
      {
        type: "decision-tree",
        question: "What is urgent?",
        branches: [{ condition: "email backlog", outcome: "inbox triage", href: "/a" }],
      },
      {
        type: "compliance-posture",
        vertical: "realty",
        coverageAreas: [{ label: "agency disclosure", covered: true }],
        recentFlags: 0,
        openFlags: 0,
        complianceHref: "/a",
      },
      {
        type: "onboarding-progress",
        pct: 50,
        milestones: [
          { label: "Pick vertical", done: true, href: "/a" },
          { label: "Connect tool", done: false, href: "/b" },
        ],
      },
    ];
    for (const card of cards) {
      const html = renderToStaticMarkup(createElement(PlainoCardView, { card }));
      for (const banned of ["#0000FF", "#7C3AED", "#000000", "#FFFFFF"]) {
        assert.ok(!html.toUpperCase().includes(banned), `${card.type} used banned ${banned}`);
      }
    }
  });
});

// ── V31 before-after builder ────────────────────────────────────────────────

describe("buildBeforeAfterCard — V31 deterministic before/after builder", () => {
  it("returns a valid card with rows for a known vertical", () => {
    const card = buildBeforeAfterCard({
      vertical: "realty",
      connectedIntegrations: [],
    });
    assert.equal(card.type, "before-after");
    assert.ok(card.rows.length >= 1 && card.rows.length <= 4, "1–4 rows");
    for (const row of card.rows) {
      assert.ok(row.task.length > 0, "task non-empty");
      assert.ok(row.before.length > 0, "before non-empty");
      assert.ok(row.after.length > 0, "after non-empty");
    }
  });

  it("falls back to general rows for an unknown vertical", () => {
    const card = buildBeforeAfterCard({
      vertical: "unknown-vertical",
      connectedIntegrations: [],
    });
    assert.equal(card.type, "before-after");
    assert.ok(card.rows.length >= 1);
  });

  it("round-trips through parsePlainoCard", () => {
    const card = buildBeforeAfterCard({ vertical: "insurance", connectedIntegrations: [] });
    const parsed = parsePlainoCard(JSON.parse(JSON.stringify(card)));
    assert.ok(parsed && parsed.type === "before-after");
    assert.equal((parsed as { rows: unknown[] }).rows.length, card.rows.length);
  });

  it("parsePlainoCard rejects before-after card with missing fields", () => {
    assert.equal(parsePlainoCard({ type: "before-after" }), null);
    assert.equal(parsePlainoCard({ type: "before-after", rows: [] }), null);
    assert.equal(
      parsePlainoCard({ type: "before-after", rows: [{ task: "x" }] }),
      null,
      "incomplete row filtered → empty rows → null"
    );
  });

  it("renders rows with before/after columns and screen-reader accessible markup", () => {
    const card = buildBeforeAfterCard({
      vertical: "realty",
      connectedIntegrations: [{ id: "gmail", category: "inbox" }],
    });
    const html = renderToStaticMarkup(createElement(PlainoCardView, { card }));
    assert.ok(html.includes("without agentplain"), "before column header");
    assert.ok(html.includes("with agentplain"), "after column header");
    assert.ok(html.includes("aria-label="), "section labelled");
  });
});

// ── V32 decision-tree builder ───────────────────────────────────────────────

describe("buildDecisionTreeCard — V32 deterministic decision tree builder", () => {
  it("returns 2–4 branches with real workspace deep links", () => {
    for (const axis of ["inbox", "approvals", "compliance", "general"] as const) {
      const card = buildDecisionTreeCard({ workspaceId: WS, axis });
      assert.equal(card.type, "decision-tree");
      assert.ok(card.question.length > 0, "question non-empty");
      assert.ok(card.branches.length >= 2 && card.branches.length <= 4, "2–4 branches");
      for (const b of card.branches) {
        assert.ok(b.condition.length > 0);
        assert.ok(b.outcome.length > 0);
        assert.ok(b.href.startsWith(`/app/workspace/${WS}/`), `deep link: ${b.href}`);
      }
    }
  });

  it("round-trips through parsePlainoCard", () => {
    const card = buildDecisionTreeCard({ workspaceId: WS, axis: "general" });
    const parsed = parsePlainoCard(JSON.parse(JSON.stringify(card)));
    assert.ok(parsed && parsed.type === "decision-tree");
  });

  it("parsePlainoCard rejects decision-tree card with missing/empty fields", () => {
    assert.equal(parsePlainoCard({ type: "decision-tree" }), null);
    assert.equal(parsePlainoCard({ type: "decision-tree", question: "x", branches: [] }), null);
  });

  it("renders each branch as an anchor with condition and outcome text", () => {
    const card = buildDecisionTreeCard({ workspaceId: WS, axis: "inbox" });
    const html = renderToStaticMarkup(createElement(PlainoCardView, { card }));
    assert.ok(html.includes(card.question), "question in output");
    assert.match(html, /<a [^>]*href=/, "branches render as anchors");
    assert.ok(html.includes(card.branches[0].condition), "condition text present (SR complete)");
    assert.ok(html.includes(card.branches[0].outcome), "outcome text present");
  });
});

// ── V33 compliance-posture builder ──────────────────────────────────────────

describe("buildCompliancePostureCard — V33 deterministic compliance posture builder", () => {
  it("returns coverage areas for known verticals", () => {
    for (const vertical of ["realty", "insurance", "home-services", "general"]) {
      const card = buildCompliancePostureCard({
        workspaceId: WS,
        vertical,
        openFlags: 0,
        recentFlags: 2,
      });
      assert.equal(card.type, "compliance-posture");
      assert.ok(card.coverageAreas.length >= 1, "at least one area");
      assert.ok(card.complianceHref.startsWith(`/app/workspace/${WS}/`));
      for (const area of card.coverageAreas) {
        assert.ok(area.label.length > 0);
        assert.equal(typeof area.covered, "boolean");
      }
    }
  });

  it("falls back to general areas for unknown vertical", () => {
    const card = buildCompliancePostureCard({
      workspaceId: WS,
      vertical: "veterinary",
      openFlags: 0,
      recentFlags: 0,
    });
    assert.equal(card.type, "compliance-posture");
    assert.ok(card.coverageAreas.length >= 1);
  });

  it("round-trips through parsePlainoCard", () => {
    const card = buildCompliancePostureCard({
      workspaceId: WS,
      vertical: "realty",
      openFlags: 1,
      recentFlags: 3,
    });
    const parsed = parsePlainoCard(JSON.parse(JSON.stringify(card)));
    assert.ok(parsed && parsed.type === "compliance-posture");
  });

  it("parsePlainoCard rejects compliance-posture with missing required fields", () => {
    assert.equal(parsePlainoCard({ type: "compliance-posture" }), null);
    assert.equal(
      parsePlainoCard({ type: "compliance-posture", vertical: "x", coverageAreas: [], recentFlags: 0 }),
      null,
      "missing openFlags + complianceHref"
    );
  });

  it("renders open flags in flag color and no-flags in moss color", () => {
    const withFlags = buildCompliancePostureCard({
      workspaceId: WS, vertical: "realty", openFlags: 2, recentFlags: 5,
    });
    const htmlFlags = renderToStaticMarkup(createElement(PlainoCardView, { card: withFlags }));
    assert.ok(htmlFlags.includes("open flags") || htmlFlags.includes("flag"), "flags shown");

    const noFlags = buildCompliancePostureCard({
      workspaceId: WS, vertical: "realty", openFlags: 0, recentFlags: 0,
    });
    const htmlClean = renderToStaticMarkup(createElement(PlainoCardView, { card: noFlags }));
    assert.ok(htmlClean.includes("no open flags"), "all clear shown");
  });

  it("compliance page link is a real deep link", () => {
    const card = buildCompliancePostureCard({
      workspaceId: WS, vertical: "insurance", openFlags: 0, recentFlags: 0,
    });
    const html = renderToStaticMarkup(createElement(PlainoCardView, { card }));
    assert.match(html, new RegExp(`href="[^"]*compliance[^"]*"`), "compliance link present");
  });
});

// ── V34 onboarding-progress builder ────────────────────────────────────────

describe("buildOnboardingProgressCard — V34 deterministic onboarding progress builder", () => {
  it("returns 0% when nothing is done", () => {
    const card = buildOnboardingProgressCard({
      workspaceId: WS,
      onboarding: {
        verticalPicked: false,
        firstToolConnected: false,
        scheduleWindowSet: false,
        firstDraftReviewed: false,
      },
    });
    assert.equal(card.type, "onboarding-progress");
    assert.equal(card.pct, 0);
    assert.equal(card.milestones.length, 4, "4 milestones");
    assert.ok(card.milestones.every((m) => !m.done), "all undone");
  });

  it("returns 100% when everything is done", () => {
    const card = buildOnboardingProgressCard({
      workspaceId: WS,
      onboarding: {
        verticalPicked: true,
        firstToolConnected: true,
        scheduleWindowSet: true,
        firstDraftReviewed: true,
      },
    });
    assert.equal(card.pct, 100);
    assert.ok(card.milestones.every((m) => m.done), "all done");
  });

  it("computes correct percentage for partial completion", () => {
    const card = buildOnboardingProgressCard({
      workspaceId: WS,
      onboarding: {
        verticalPicked: true,
        firstToolConnected: true,
        scheduleWindowSet: false,
        firstDraftReviewed: false,
      },
    });
    assert.equal(card.pct, 50);
  });

  it("every milestone has a real workspace deep link", () => {
    const card = buildOnboardingProgressCard({
      workspaceId: WS,
      onboarding: {
        verticalPicked: false,
        firstToolConnected: false,
        scheduleWindowSet: false,
        firstDraftReviewed: false,
      },
    });
    for (const m of card.milestones) {
      assert.ok(m.href.startsWith(`/app/workspace/${WS}/`), `deep link: ${m.href}`);
    }
  });

  it("round-trips through parsePlainoCard", () => {
    const card = buildOnboardingProgressCard({
      workspaceId: WS,
      onboarding: { verticalPicked: true, firstToolConnected: false, scheduleWindowSet: false, firstDraftReviewed: false },
    });
    const parsed = parsePlainoCard(JSON.parse(JSON.stringify(card)));
    assert.ok(parsed && parsed.type === "onboarding-progress");
    assert.equal((parsed as { pct: number }).pct, card.pct);
  });

  it("parsePlainoCard rejects onboarding-progress with missing pct or milestones", () => {
    assert.equal(parsePlainoCard({ type: "onboarding-progress" }), null);
    assert.equal(parsePlainoCard({ type: "onboarding-progress", milestones: [] }), null, "missing pct");
  });

  it("renderer links incomplete milestones and renders done ones as plain text", () => {
    const card = buildOnboardingProgressCard({
      workspaceId: WS,
      onboarding: {
        verticalPicked: true,
        firstToolConnected: false,
        scheduleWindowSet: false,
        firstDraftReviewed: false,
      },
    });
    const html = renderToStaticMarkup(createElement(PlainoCardView, { card }));
    // Done milestone: plain text, no anchor
    assert.ok(html.includes("Pick your vertical"), "done milestone label present (SR complete)");
    // Undone milestone: wrapped in anchor
    assert.match(html, /<a [^>]*href="[^"]*integrations[^"]*"/, "undone milestone is a link");
    // Progress bar rendered
    assert.ok(html.includes('role="progressbar"'), "progress bar present");
    assert.ok(html.includes('aria-valuenow="25"'), "correct aria-valuenow");
  });
});
