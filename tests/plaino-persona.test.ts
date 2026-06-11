/**
 * tests/plaino-persona.test.ts
 *
 * Pins the Plaino robot-dog persona scaffolding across the customer-facing
 * surface. Per feedback_plaino_is_a_robot_dog (2026-05-28):
 *
 *   - The persona shapes voice via three verbs — FETCH (data/outputs),
 *     HERD (orchestration), SIT (waiting). These appear in the system
 *     prompt and on the talk + approvals surface microcopy.
 *
 *   - The metaphor is NEVER literalized to the customer. No "robot dog",
 *     no "I am a dog", no "woof" — anywhere in the customer-facing
 *     surface or the prompt instructions to the LLM. The constraint is
 *     in the system prompt (`system-prompt.test.ts` covers the prompt
 *     itself) and reinforced here by sweeping the customer-visible
 *     strings.
 *
 *   - The PlainoAvatar takes a `pose` prop with default "sit"; each
 *     pose value renders without throwing.
 *
 * Renders are framework-level snapshots (renderToStaticMarkup over the
 * raw element tree), not DOM-level — same pattern as the leadership-board
 * tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { PlainoAvatar } from "@/components/ui/ap/PlainoAvatar";

// ── PlainoAvatar — pose prop + render ──────────────────────────────────

// PlainoAvatar is now a DEPRECATED SHIM over PlainoStatus (the live-state
// pose family) — see components/ui/ap/PlainoAvatar.tsx + docs/brand/icon-families.md
// (Conner two-family ratification 2026-06-10). It renders a plain <img> pose
// raster (not <svg>), mapping pose → status state → the pose PNG. These tests
// pin the shim contract: the three legacy poses still render without throwing
// and resolve to their status pose, and the metaphor never leaks.
const POSE_TO_PLAINO_STATE: Record<"sit" | "fetch" | "herd", string> = {
  sit: "sitting-alert",
  fetch: "fetching",
  herd: "herding",
};

describe("PlainoAvatar — deprecated shim over PlainoStatus", () => {
  it("renders with default pose='sit' without throwing", () => {
    const html = renderToStaticMarkup(createElement(PlainoAvatar));
    assert.match(html, /<img/);
    assert.match(html, /data-plaino-state="sitting-alert"/);
  });

  it("maps pose='fetch'/'herd'/'sit' to the status pose raster", () => {
    for (const pose of ["sit", "fetch", "herd"] as const) {
      const html = renderToStaticMarkup(
        createElement(PlainoAvatar, { pose }),
      );
      assert.match(
        html,
        new RegExp(`data-plaino-state="${POSE_TO_PLAINO_STATE[pose]}"`),
        `expected pose=${pose} to render the ${POSE_TO_PLAINO_STATE[pose]} raster`,
      );
    }
  });

  it("announces the state when decorative=false; hides otherwise", () => {
    const decorative = renderToStaticMarkup(
      createElement(PlainoAvatar, { decorative: true }),
    );
    assert.match(decorative, /aria-hidden/);

    const labeled = renderToStaticMarkup(
      createElement(PlainoAvatar, { decorative: false, pose: "fetch" }),
    );
    // PlainoStatus announces the live state via the img alt text.
    assert.match(labeled, /alt="Plaino is fetching"/);
    assert.doesNotMatch(labeled, /aria-hidden/);
  });

  it("never embeds the literal metaphor in the rendered markup", () => {
    // The mark is an illustration, not a labeled mascot. The metaphor
    // (working sheepdog on the plains) is scaffolding only. The rendered
    // markup must NOT contain the literal animal vocabulary.
    for (const pose of ["sit", "fetch", "herd"] as const) {
      const html = renderToStaticMarkup(
        createElement(PlainoAvatar, { pose, decorative: false }),
      );
      assert.doesNotMatch(html, /\bdog\b/i, `pose=${pose} leaked "dog"`);
      assert.doesNotMatch(
        html,
        /\bsheepdog\b/i,
        `pose=${pose} leaked "sheepdog"`,
      );
      assert.doesNotMatch(html, /\banimal\b/i, `pose=${pose} leaked "animal"`);
      assert.doesNotMatch(html, /woof/i, `pose=${pose} leaked "woof"`);
    }
  });
});

// ── Talk + approval microcopy — persona verbs, no metaphor leak ────────

// The customer-visible microcopy lives in the page/component files.
// Reading them as text and asserting on substrings is the lightest way
// to pin "persona verbs reach the surface" and "metaphor never leaks"
// without booting Next or a DOM. If the file is renamed, this catches
// the rename (the surface still has to ship the string).

import { readFileSync } from "node:fs";
import path from "node:path";

const TALK_PAGE = path.join(
  process.cwd(),
  "app",
  "(product)",
  "app",
  "workspace",
  "[id]",
  "talk",
  "page.tsx",
);
const TALK_COMPOSER = path.join(
  process.cwd(),
  "app",
  "(product)",
  "app",
  "workspace",
  "[id]",
  "talk",
  "TalkComposer.tsx",
);
// The /talk thread + header copy lives in talk-view.tsx, which page.tsx
// renders. The REGISTER status microcopy ("herding through the team") is
// here, not in the thin page.tsx wrapper.
const TALK_VIEW = path.join(
  process.cwd(),
  "app",
  "(product)",
  "app",
  "workspace",
  "[id]",
  "talk",
  "talk-view.tsx",
);
const APPROVALS_LIST = path.join(
  process.cwd(),
  "app",
  "(product)",
  "app",
  "workspace",
  "[id]",
  "approvals",
  "ApprovalsList.tsx",
);
// The per-item provenance attribution ("herded in by Plaino") lives on the
// card the list renders, not the list shell.
const APPROVALS_CARD = path.join(
  process.cwd(),
  "app",
  "(product)",
  "app",
  "workspace",
  "[id]",
  "approvals",
  "ApprovalCard.tsx",
);
const APPROVALS_PAGE = path.join(
  process.cwd(),
  "app",
  "(product)",
  "app",
  "workspace",
  "[id]",
  "approvals",
  "page.tsx",
);
const MEMORY_PAGE = path.join(
  process.cwd(),
  "app",
  "(product)",
  "app",
  "workspace",
  "[id]",
  "talk",
  "memory",
  "page.tsx",
);

const FORBIDDEN_METAPHOR_PHRASES = [
  /\brobot dog\b/i,
  /\bI am a dog\b/i,
  /\bI'm a dog\b/i,
  /\bsheepdog\b/i,
  /\bwoof\b/i,
  /\bbark(?:s|ing|ed)?\b/i,
  /\bfetch the ball\b/i,
];

function readSurface(file: string): string {
  return readFileSync(file, "utf8");
}

describe("plaino microcopy — persona verbs reach the customer surface", () => {
  it("/talk empty state names a fetch / herd / wait variant", () => {
    const src = readSurface(TALK_PAGE);
    // The empty state should use at least one of the persona verbs in
    // its customer-facing copy. "fetched" / "herded" / "waiting" all
    // qualify — the rule isn't which one, the rule is that one shows.
    assert.match(
      src,
      /fetched|herded|herd|fetch|waiting|sitting/i,
      "expected /talk empty state to use a persona verb",
    );
  });

  it("/talk in-flight composer button uses fetch language", () => {
    const src = readSurface(TALK_COMPOSER);
    assert.match(src, /fetch/i, "expected composer button to use fetch verb");
  });

  it("/talk REGISTER microcopy uses herd language", () => {
    const src = readSurface(TALK_VIEW);
    assert.match(
      src,
      /herd/i,
      "expected REGISTER status text to use herd verb",
    );
  });

  it("approvals queue attribution uses herd vocabulary", () => {
    const src = readSurface(APPROVALS_CARD);
    assert.match(
      src,
      /herd/i,
      "expected approval attribution to use herd verb",
    );
  });

  it("approvals empty state uses sit/herd vocabulary (Plaino sitting ready)", () => {
    const src = readSurface(APPROVALS_PAGE);
    assert.match(
      src,
      /sitting|fetch|herd/i,
      "expected approvals empty state to use a persona verb",
    );
  });

  it("memory page header uses fetch vocabulary", () => {
    const src = readSurface(MEMORY_PAGE);
    assert.match(
      src,
      /fetch/i,
      "expected memory page copy to use fetch verb",
    );
  });
});

describe("plaino microcopy — metaphor MUST NOT leak to customer surface", () => {
  // The "robot dog" metaphor is scaffolding ONLY. It must never reach
  // the customer-facing surface. This test sweeps every file Plaino is
  // named on for the explicit forbidden phrases.
  const SURFACES: Array<{ name: string; file: string }> = [
    { name: "/talk page", file: TALK_PAGE },
    { name: "/talk view", file: TALK_VIEW },
    { name: "/talk composer", file: TALK_COMPOSER },
    { name: "approvals list", file: APPROVALS_LIST },
    { name: "approvals card", file: APPROVALS_CARD },
    { name: "approvals page", file: APPROVALS_PAGE },
    { name: "memory page", file: MEMORY_PAGE },
  ];

  for (const surface of SURFACES) {
    it(`${surface.name} contains no literal metaphor phrases`, () => {
      const src = readSurface(surface.file);
      for (const phrase of FORBIDDEN_METAPHOR_PHRASES) {
        assert.doesNotMatch(
          src,
          phrase,
          `${surface.name} leaked metaphor phrase ${phrase}`,
        );
      }
    });
  }
});

// ── Approval queue Plaino-attributed strings ──────────────────────────

describe("approvals renderApprovalPayload — Plaino-attributed strings", () => {
  it("the fallback line uses persona-coherent attribution (herd verb)", async () => {
    // Direct test of the renderer's fallback path. The fallback used
    // to read "The fleet surfaced an item for your review." — persona
    // refresh moves it to "Plaino herded this through for your review."
    const mod = await import(
      "@/app/(product)/app/workspace/[id]/approvals/renderApprovalPayload"
    );
    // Cast through unknown to a known kind that the switch handles —
    // the fallback only fires for unhandled enum values which TypeScript
    // forbids at compile time. We can't easily trigger it through the
    // public API, so we assert on the source string instead.
    void mod;
    const src = readFileSync(
      path.join(
        process.cwd(),
        "app",
        "(product)",
        "app",
        "workspace",
        "[id]",
        "approvals",
        "renderApprovalPayload.ts",
      ),
      "utf8",
    );
    assert.match(
      src,
      /Plaino herded/i,
      "expected the renderer fallback to use persona-coherent attribution",
    );
  });
});
