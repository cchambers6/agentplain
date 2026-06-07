// OG static-preview generator.
//
// The PRODUCTION OpenGraph images are rendered dynamically by next/og at
//   app/opengraph-image.tsx                            (homepage)
//   app/(marketing)/[vertical]/opengraph-image.tsx     (per vertical + /general)
// and edge-cached by Vercel as 1200×630 PNGs. Those routes are the single
// source of truth and the actual og:image every social crawler fetches.
//
// This script emits a COMMITTED, version-controlled SVG preview of each card
// into public/og/<slug>.svg that mirrors the next/og layout (same brand
// tokens, same copy, same serif/sans/mono families). It exists so Conner can
// spot-check every share image — locally or on the Vercel preview deploy —
// before the dynamic route ships, and so the marketing copy on each card is
// reviewable as a diff. SVG is chosen over a rasterized PNG deliberately:
//   - it's deterministic + reproducible from this script (no headless-browser
//     step that contends with parallel waves' shared Playwright instance),
//   - it's a text diff in the PR, so a copy change is reviewable,
//   - it renders pixel-faithfully in any browser at 1200×630.
// The live og:image is still the next/og PNG route — these are previews.
//
// Run: `node --import tsx tools/brand/gen-og-previews.mjs`
// Re-run after any hero/positioning copy change so previews don't drift.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// tsx compiles these .ts modules to CJS, so dynamic import() surfaces the
// named exports under `.default`. Resolve both shapes defensively.
const brandMod = await import("../../lib/brand/tokens.ts");
const verticalsMod = await import("../../lib/verticals/index.ts");
const brand = brandMod.default ?? brandMod;
const verticals = verticalsMod.default ?? verticalsMod;
const tokens = brand.tokens;
const getAllVerticalsIncludingOnRamps = verticals.getAllVerticalsIncludingOnRamps;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "..", "public", "og");

const { colors } = tokens;
const ROI_LINE = "15–50× per workflow + the violations you don't pay for";
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "system-ui, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, 'Courier New', monospace";

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function trim(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const i = cut.lastIndexOf(" ");
  return `${cut.slice(0, i > 0 ? i : cut.length).trim()}…`;
}

// Greedy word-wrap by approximate character budget per line: build ALL lines
// first, then cap to maxLines and ellipsize the last if we overflowed.
function wrap(text, perLine, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= perLine) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = trim(kept[maxLines - 1] + " …", perLine + 2);
  return kept;
}

function tspans(lines, x, y, lineHeight, attrs = "") {
  return lines
    .map(
      (ln, i) =>
        `<text x="${x}" y="${y + i * lineHeight}" ${attrs}>${esc(ln)}</text>`,
    )
    .join("");
}

// Build one 1200×630 SVG card. `headlineLines` is an array of plain strings
// (home overrides with a custom clay-accented markup via `headlineRaw`).
function svgCard({ eyebrowClay, headlineLines, headlineRaw, oneLiner }) {
  const headlineSize = 56;
  const headBaseY = eyebrowClay ? 300 : 290;
  const headBlock = headlineRaw
    ? headlineRaw
    : tspans(
        headlineLines,
        80,
        headBaseY,
        66,
        `font-family="${SERIF}" font-size="${headlineSize}" fill="${colors.ink.hex}" letter-spacing="-1"`,
      );
  const oneLinerLines = wrap(oneLiner, 74, 2);
  const oneLinerY = headBaseY + (headlineLines?.length ?? 2) * 66 + 18;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
  <rect width="1200" height="630" fill="${colors.paper.hex}"/>
  <!-- TOP: wordmark + vertical eyebrow -->
  <text x="80" y="96" font-family="${MONO}" font-size="20" letter-spacing="3.6" fill="${colors.mute.hex}">${esc(
    tokens.wordmark.toUpperCase(),
  )}</text>
  ${
    eyebrowClay
      ? `<text x="80" y="130" font-family="${MONO}" font-size="18" letter-spacing="3" fill="${colors.clay.hex}">${esc(
          eyebrowClay.toUpperCase(),
        )}</text>`
      : ""
  }
  <!-- MIDDLE: headline + value-prop one-liner -->
  ${headBlock}
  ${tspans(
    oneLinerLines,
    80,
    oneLinerY,
    34,
    `font-family="${SANS}" font-size="24" fill="${colors.inkSoft.hex}"`,
  )}
  <!-- BOTTOM: clay bar + ROI line + Built on Claude stamp -->
  <rect x="80" y="512" width="120" height="4" fill="${colors.clay.hex}"/>
  <text x="80" y="566" font-family="${SANS}" font-size="22" fill="${colors.ink.hex}">${esc(
    ROI_LINE,
  )}</text>
  <rect x="906" y="538" width="214" height="46" fill="none" stroke="${colors.ink.hex}" stroke-width="2"/>
  <text x="1013" y="567" text-anchor="middle" font-family="${MONO}" font-size="18" letter-spacing="1.5" fill="${colors.ink.hex}">BUILT ON CLAUDE</text>
</svg>`;
}

function build() {
  mkdirSync(OUT, { recursive: true });
  const written = [];

  // Homepage card — custom two-line headline with clay "reality".
  const homeHeadline = `<text x="80" y="280" font-family="${SERIF}" font-size="72" fill="${colors.ink.hex}" letter-spacing="-2">Intelligence.</text>
  <text x="80" y="356" font-family="${SERIF}" font-size="72" fill="${colors.ink.hex}" letter-spacing="-2">Rooted in <tspan fill="${colors.clay.hex}">reality</tspan>.</text>`;
  writeFileSync(
    join(OUT, "home.svg"),
    svgCard({
      headlineRaw: homeHeadline,
      headlineLines: ["", ""],
      oneLiner:
        "Claude for Small Business is powerful. We make it usable — the service layer that runs it for you.",
    }),
    "utf8",
  );
  written.push("home.svg");

  // One card per vertical + the /general on-ramp.
  for (const v of getAllVerticalsIncludingOnRamps()) {
    const oneLiner = v.hero.sbmSubhead ?? v.hero.eyebrow ?? tokens.tagline;
    const headlineLines = wrap(v.hero.headline, 34, 2);
    writeFileSync(
      join(OUT, `${v.slug}.svg`),
      svgCard({
        eyebrowClay: `for ${v.name.toLowerCase()}`,
        headlineLines,
        oneLiner,
      }),
      "utf8",
    );
    written.push(`${v.slug}.svg`);
  }

  console.log(`Wrote ${written.length} OG preview card(s) to ${OUT}`);
  for (const f of written) console.log(`  public/og/${f}`);
}

build();
