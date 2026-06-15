import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// @ts-expect-error — dependency-free own-codec PNG lib (Node zlib), no types.
import { decodePng } from "../tools/brand/png-lib.mjs";

// ─── Plaino BRAND MARK no-clip regression guard ──────────────────────────────
//
// The 8-bit Plaino brand mark (public/brand/plaino-system/8bit.png) is rendered
// FULL-BLEED by PlainoMark on identity surfaces (header, footer, login, OG, chat
// entry). The pixel-art dog has a raised tail whose orb extends above the body
// and paws that reach the sides/bottom. Its raster bounds ARE the mark's bounds,
// so if the figure bleeds to the canvas edge, any container using object-fit:
// cover / overflow:hidden / a height-constrained or non-square box clips the orb
// (or paws) first.
//
// That exact clip was reported and "fixed" three times on three surfaces before
// the structural fix: the asset now bakes a uniform paper SAFE-AREA around the
// figure (tools/brand/crop-plaino-sheet.mjs → padToSquare). This test pins that
// safe-area so a future re-crop can never silently re-introduce the bleed.
//
// HISTORICAL NOTE — the pre-fix asset was 210×205 with TOP orb buffer = 5.4%
// and 0px buffer on the other three sides. Every assertion below FAILS on that
// asset, i.e. this guard would have caught all three regressions.

const HERE = dirname(fileURLToPath(import.meta.url));
const MARK_PATH = resolve(HERE, "..", "public", "brand", "plaino-system", "8bit.png");

// Brand Paper #F7F4ED (lib/brand/tokens.ts colors.paper). A pixel is "background"
// if it is within tolerance of paper, OR transparent (future-proof if the mark
// ever ships RGBA).
const PAPER: [number, number, number] = [0xf7, 0xf4, 0xed];
const TOL = 12;

type Img = { width: number; height: number; channels: number; data: Uint8Array };

function loadMark(): Img {
  return decodePng(readFileSync(MARK_PATH)) as Img;
}

function isBackground(img: Img, x: number, y: number): boolean {
  const { width, channels, data } = img;
  const i = (y * width + x) * channels;
  if (channels === 4 && data[i + 3] < 8) return true; // transparent
  return (
    Math.abs(data[i] - PAPER[0]) < TOL &&
    Math.abs(data[i + 1] - PAPER[1]) < TOL &&
    Math.abs(data[i + 2] - PAPER[2]) < TOL
  );
}

/** Tight bounding box of all non-background (figure) pixels. */
function figureBounds(img: Img) {
  const { width, height } = img;
  let top = -1;
  let bottom = -1;
  let left = width;
  let right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isBackground(img, x, y)) {
        if (top < 0) top = y;
        bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { top, bottom, left, right };
}

describe("Plaino brand mark — clip-proof safe-area (8bit.png)", () => {
  // The orb-clip contract (Conner, 2026-06-15): figure occupies ~80% of the
  // canvas with ≥15% clear paper above the orb so no container can clip it.
  const MIN_TOP_FRACTION = 0.15; // ≥15% paper above the raised-tail orb
  const MIN_SIDE_FRACTION = 0.08; // ≥8% paper on the other three sides (no bleed)

  it("decodes and is (near-)square", () => {
    const img = loadMark();
    assert.ok(img.width > 0 && img.height > 0, "8bit.png failed to decode");
    const ratio = img.width / img.height;
    assert.ok(
      ratio > 0.9 && ratio < 1.1,
      `brand mark should be near-square so objectFit:contain never letterboxes oddly (got ${img.width}x${img.height})`,
    );
  });

  it("has ≥15% paper clearance above the raised-tail orb", () => {
    const img = loadMark();
    const { top } = figureBounds(img);
    const fraction = top / img.height;
    assert.ok(
      fraction >= MIN_TOP_FRACTION,
      `orb clearance is ${(fraction * 100).toFixed(1)}% of canvas height — must be ≥${MIN_TOP_FRACTION * 100}% so the orb never clips (regression: this was 5.4% when the mark clipped on three surfaces)`,
    );
  });

  it("has a paper margin on the bottom and both sides (figure does not bleed to any edge)", () => {
    const img = loadMark();
    const { bottom, left, right } = figureBounds(img);
    const bottomBuf = (img.height - 1 - bottom) / img.height;
    const leftBuf = left / img.width;
    const rightBuf = (img.width - 1 - right) / img.width;
    assert.ok(bottomBuf >= MIN_SIDE_FRACTION, `bottom buffer ${(bottomBuf * 100).toFixed(1)}% < ${MIN_SIDE_FRACTION * 100}% (paws bleed to bottom edge)`);
    assert.ok(leftBuf >= MIN_SIDE_FRACTION, `left buffer ${(leftBuf * 100).toFixed(1)}% < ${MIN_SIDE_FRACTION * 100}% (figure bleeds to left edge)`);
    assert.ok(rightBuf >= MIN_SIDE_FRACTION, `right buffer ${(rightBuf * 100).toFixed(1)}% < ${MIN_SIDE_FRACTION * 100}% (figure bleeds to right edge)`);
  });

  it("row 0 is entirely background (the canonical Plaino crop gate)", () => {
    // Per memory project_plaino_orb_clip_fix_2026_06_12: scan row 0 of any
    // Plaino PNG — any non-background pixel there means the crop is too tight.
    const img = loadMark();
    let nonBg = 0;
    for (let x = 0; x < img.width; x++) if (!isBackground(img, x, 0)) nonBg++;
    assert.equal(nonBg, 0, `${nonBg} non-background pixel(s) on row 0 — crop is too tight, orb will clip`);
  });

  it("figure still fills a healthy share of the canvas (mark not shrunk to a dot)", () => {
    // Guard the other direction: over-padding would make the dog tiny. Keep the
    // figure ≥65% of the canvas in its larger dimension (~78% as generated).
    const img = loadMark();
    const { top, bottom, left, right } = figureBounds(img);
    const wFrac = (right - left) / img.width;
    const hFrac = (bottom - top) / img.height;
    assert.ok(
      Math.max(wFrac, hFrac) >= 0.65,
      `figure only ${(Math.max(wFrac, hFrac) * 100).toFixed(1)}% of canvas — over-padded, mark reads too small`,
    );
  });

  // ─── Character detail guards (nose + collar tag) — 2026-06-15 ────────────
  // These two details were absent from every prior crop because the EIGHT_BIT
  // rect in crop-plaino-sheet.mjs started at x=617 while the snout/nose pixels
  // live at x=603-616. This is the SECOND time regeneration silently lost
  // character detail (previous was the orb-clip trilogy). Pinning these here
  // so any future re-crop that loses the nose or collar fails CI immediately.
  //
  // Both checks operate as fractions of the figure bounding box so they stay
  // valid across pad/scale changes — they pin CHARACTER PRESENCE, not pixel
  // coordinates. The canonical reference is
  //   public/plaino/source/9.8-bit-plaino-canonical.jpeg
  // (stored 2026-06-15; design intent for all future re-exports).

  it("nose pixel is present (dark pixel at snout tip — left edge of figure, upper-half)", () => {
    // In the canonical, the dog faces LEFT. The nose is the leftmost dark detail
    // of the figure, sitting vertically ~22-42% down from the figure top.
    // Expanding the crop from x=617 to x=595 made this pixel available; this
    // test ensures a future narrowing of the crop never silently removes it.
    const img = loadMark();
    const { top, bottom, left, right } = figureBounds(img);
    const figH = bottom - top;
    const figW = right - left;

    const noseScanLeft = left;
    const noseScanRight = Math.round(left + figW * 0.13);
    const noseScanTop = Math.round(top + figH * 0.22);
    const noseScanBottom = Math.round(top + figH * 0.42);

    let darkPixels = 0;
    const { channels, data, width } = img;
    for (let y = noseScanTop; y <= noseScanBottom; y++) {
      for (let x = noseScanLeft; x <= noseScanRight; x++) {
        if (!isBackground(img, x, y)) {
          const i = (y * width + x) * channels;
          if (data[i] + data[i + 1] + data[i + 2] < 200) darkPixels++;
        }
      }
    }
    assert.ok(
      darkPixels >= 1,
      `nose pixel missing — no dark pixel found in expected snout region (left 0-13% of figure width, 22-42% from figure top). ` +
      `Regression: prior crop EIGHT_BIT=[617,810,210,205] started at x=617 while the nose is at x≈603. ` +
      `Re-run tools/brand/crop-plaino-sheet.mjs after correcting source crop to capture the snout.`,
    );
  });

  it("collar tag is present (warm-brown pixel cluster on chest — left-center of figure)", () => {
    // The collar is a brown/terracotta circular tag with the "a" agentplain logo.
    // It sits roughly 5-35% from the left of the figure and 45-72% down from the
    // figure top (mid-chest). Warm-brown = R significantly higher than B.
    const img = loadMark();
    const { top, bottom, left, right } = figureBounds(img);
    const figH = bottom - top;
    const figW = right - left;

    const collarLeft = Math.round(left + figW * 0.05);
    const collarRight = Math.round(left + figW * 0.36);
    const collarTop = Math.round(top + figH * 0.45);
    const collarBottom = Math.round(top + figH * 0.72);

    let warmBrownPixels = 0;
    const { channels, data, width } = img;
    for (let y = collarTop; y <= collarBottom; y++) {
      for (let x = collarLeft; x <= collarRight; x++) {
        if (!isBackground(img, x, y)) {
          const i = (y * width + x) * channels;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (r > 100 && r > b * 1.4 && g > 50) warmBrownPixels++;
        }
      }
    }
    assert.ok(
      warmBrownPixels >= 3,
      `collar tag missing — expected warm-brown (terracotta) pixels in chest region (5-36% figure width, 45-72% height). ` +
      `The "a" tag is part of Plaino's canonical identity. Check that the crop includes the chest area.`,
    );
  });
});

// ─── Every DERIVED icon raster must also clear the orb ───────────────────────
//
// The mark ships at multiple resolutions through TWO generators
// (tools/brand/crop-plaino-sheet.mjs → favicon; tools/brand/gen-app-icons.mjs →
// iOS/PWA). Each is a distinct rendering pipeline + a real browse surface
// (browser tab, iOS home screen, Android launcher/PWA). The orb-clip recurred
// because a single source was tight; this pins the WHOLE family so no one
// resolution can regress on its own. Each raster renders as a full square (no
// container crop), so the bar is: a real top margin above the orb (≥10%) and a
// clean row 0. apple-icon.png was 7.8% top / 1.7% sides before the source fix —
// this block fails on that asset.
describe("Plaino mark — derived icon rasters clear the orb (multi-pipeline)", () => {
  const RASTERS: Array<{ label: string; path: string; minTop: number }> = [
    { label: "favicon 64 (app/icon.png — browser tab)", path: "app/icon.png", minTop: 0.1 },
    { label: "favicon source (8bit-64.png)", path: "public/brand/plaino-system/8bit-64.png", minTop: 0.1 },
    { label: "apple-icon 180 (iOS home screen)", path: "app/apple-icon.png", minTop: 0.1 },
    { label: "maskable 512 (Android/PWA)", path: "public/icon-maskable.png", minTop: 0.1 },
  ];

  for (const r of RASTERS) {
    it(`${r.label} — orb has ≥${r.minTop * 100}% top clearance + clean row 0`, () => {
      const img = decodePng(readFileSync(resolve(HERE, "..", r.path))) as Img;
      const { top } = figureBounds(img);
      const topFrac = top / img.height;
      assert.ok(
        topFrac >= r.minTop,
        `${r.label}: orb clearance ${(topFrac * 100).toFixed(1)}% < ${r.minTop * 100}% — re-run tools/brand/gen-app-icons.mjs after correcting 8bit.png`,
      );
      let row0 = 0;
      for (let x = 0; x < img.width; x++) if (!isBackground(img, x, 0)) row0++;
      assert.equal(row0, 0, `${r.label}: ${row0} non-bg pixel(s) on row 0 — crop too tight`);
    });
  }
});
