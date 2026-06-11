/**
 * Explainer visual-system components — render + brand-discipline tests.
 *
 * Implements PR #186 (docs/explainer-visual-system-2026-06-07.md). Each
 * CODE-SVG / HTML explainer must:
 *   - render under renderToStaticMarkup (server-safe, no next/image, no client
 *     APIs) — the same node:test seam the Ap* primitives use;
 *   - be a11y-correct (role="img" + aria-label on diagrams);
 *   - use ONLY brand-palette hexes (lib/brand/tokens.ts);
 *   - never use a banned color (blue/purple, pure black/white, gradient stops).
 *
 * createElement (not JSX) because tsconfig has `jsx: preserve` — mirrors
 * tests/operator-leadership-board.test.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { ValueLoopDiagram } from "@/components/explainers/ValueLoopDiagram";
import { DiyVsRunForYou } from "@/components/explainers/DiyVsRunForYou";
import { ControlLoopDiagram } from "@/components/explainers/ControlLoopDiagram";
import { TrustArchitecture } from "@/components/explainers/TrustArchitecture";
import { OnboardingRoadmap } from "@/components/explainers/OnboardingRoadmap";
import { chatbotContrast } from "@/lib/marketing/home-content";
import { colorHex } from "@/lib/brand/tokens";

const ALLOWED_HEXES = new Set(
  Object.values(colorHex).map((h) => h.toUpperCase()),
);

// Banned colors per the global hard-NOs: no blue/purple, no pure black/white.
const BANNED_HEXES = [
  "#000000",
  "#000",
  "#FFFFFF",
  "#FFF",
  "#0000FF",
  "#0070F3", // generic SaaS blue
  "#1E90FF",
  "#6B46C1", // purple
  "#7C3AED",
];

function allHexes(html: string): string[] {
  const matches = html.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
  return matches.map((h) => h.toUpperCase());
}

describe("explainer visuals — render + brand discipline", () => {
  const cases: Array<{ name: string; html: string }> = [
    { name: "ValueLoopDiagram (V01)", html: renderToStaticMarkup(createElement(ValueLoopDiagram)) },
    { name: "DiyVsRunForYou (V02)", html: renderToStaticMarkup(createElement(DiyVsRunForYou)) },
    { name: "ControlLoopDiagram (V06)", html: renderToStaticMarkup(createElement(ControlLoopDiagram)) },
    { name: "TrustArchitecture (V07)", html: renderToStaticMarkup(createElement(TrustArchitecture)) },
    { name: "TrustArchitecture compact (V18)", html: renderToStaticMarkup(createElement(TrustArchitecture, { compact: true })) },
    { name: "OnboardingRoadmap static (V13)", html: renderToStaticMarkup(createElement(OnboardingRoadmap)) },
    { name: "OnboardingRoadmap progress (V13)", html: renderToStaticMarkup(createElement(OnboardingRoadmap, { currentStep: 2 })) },
  ];

  for (const c of cases) {
    it(`${c.name} renders non-empty markup`, () => {
      assert.ok(c.html.length > 50, "expected substantial markup");
      // No next/image leakage — these must be server-pure.
      assert.ok(!/<Image\b/.test(c.html), "must not render next/image");
    });

    it(`${c.name} uses only brand-palette hexes`, () => {
      for (const hex of allHexes(c.html)) {
        // Normalize 3-digit to nothing-special; the palette uses 6-digit only.
        assert.ok(
          ALLOWED_HEXES.has(hex),
          `${c.name} used non-brand hex ${hex}`,
        );
      }
    });

    it(`${c.name} uses no banned color`, () => {
      const hexes = new Set(allHexes(c.html));
      for (const banned of BANNED_HEXES) {
        assert.ok(
          !hexes.has(banned.toUpperCase()),
          `${c.name} used banned color ${banned}`,
        );
      }
    });

    it(`${c.name} declares no gradient`, () => {
      assert.ok(
        !/gradient|linearGradient|radialGradient/i.test(c.html),
        `${c.name} must not use gradients`,
      );
    });
  }

  it("diagrams expose an accessible role + label", () => {
    const diagrams = [
      renderToStaticMarkup(createElement(ValueLoopDiagram)),
      renderToStaticMarkup(createElement(ControlLoopDiagram)),
      renderToStaticMarkup(createElement(TrustArchitecture)),
      renderToStaticMarkup(createElement(OnboardingRoadmap)),
    ];
    for (const html of diagrams) {
      assert.match(html, /role="img"/, "diagram needs role=img");
      assert.match(html, /aria-label="[^"]{20,}"/, "diagram needs a descriptive aria-label");
    }
  });

  it("DiyVsRunForYou binds verbatim to chatbotContrast (single source of truth)", () => {
    const html = renderToStaticMarkup(createElement(DiyVsRunForYou));
    for (const row of chatbotContrast) {
      assert.ok(html.includes(escapeHtml(row.free)), `missing free row: ${row.free}`);
      assert.ok(html.includes(escapeHtml(row.us)), `missing us row: ${row.us}`);
    }
    // moss check present (verified-good signal) — verdict color is brand moss.
    assert.ok(html.includes("#3F5C3F"), "expected moss check in run-for-you column");
  });

  it("DiyVsRunForYou is vendor-invisible (no AI model/vendor named)", () => {
    const html = renderToStaticMarkup(createElement(DiyVsRunForYou)).toLowerCase();
    // 2026-06-11: no model, provider, or product name may appear on a
    // customer surface. The contrast is do-it-yourself vs. run-for-you.
    for (const vendor of ["claude", "anthropic", "chatgpt", "openai", "gpt-"]) {
      assert.ok(!html.includes(vendor), `vendor name leaked: ${vendor}`);
    }
    assert.ok(html.includes("a powerful tool, run for you"), "expected run-for-you header note");
  });

  it("OnboardingRoadmap lights the current step clay only when currentStep is set", () => {
    const staticHtml = renderToStaticMarkup(createElement(OnboardingRoadmap));
    const progressHtml = renderToStaticMarkup(createElement(OnboardingRoadmap, { currentStep: 1 }));
    // Both render five step labels.
    assert.ok(staticHtml.includes("pick your vertical"));
    assert.ok(progressHtml.includes("steady rhythm"));
    // The progress variant fills earlier steps clay; clay (#B65D3A) appears.
    assert.ok(progressHtml.includes("#B65D3A"), "progress variant should use clay");
  });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
