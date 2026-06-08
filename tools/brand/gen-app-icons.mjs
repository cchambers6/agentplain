// Generate the App Router PWA icon set from the existing 8-bit Plaino mark.
// Dependency-free: reuses the own-codec helpers in png-lib.mjs (no sharp, no
// canvas). Source is the shipped `public/brand/plaino-system/8bit.png`
// (the favicon/app-icon pose per docs/brand/plaino-system.md).
//
// Outputs (App Router metadata-route convention):
//   app/apple-icon.png           — 180×180, Paper background, full-bleed mark.
//                                  iOS clips to a rounded square itself, so the
//                                  mark sits on the brand Paper field edge-to-edge.
//   public/icon-maskable.png     — 512×512, Paper background, mark scaled into a
//                                  ~80% safe zone (Android maskable spec: the
//                                  outer ~10% on every side may be cropped to a
//                                  circle/squircle, so keep content centred).
//                                  Lives in public/ (not app/) because it is
//                                  referenced by the manifest at a fixed URL —
//                                  App Router only auto-serves the reserved
//                                  icon/apple-icon/favicon filenames.
//
// Both are pixel-art, so the mark is upscaled nearest-neighbour to preserve the
// 8-bit hard edges, then composited onto a solid Paper square.
//
// Run: node tools/brand/gen-app-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  decodePng,
  encodePng,
  nearestResize,
  padToSquare,
} from "./png-lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

// Brand Paper #F7F4ED — lib/brand/tokens.ts colors.paper.hex.
const PAPER = [0xf7, 0xf4, 0xed];

const SRC = join(ROOT, "public", "brand", "plaino-system", "8bit.png");
const src = decodePng(readFileSync(SRC)); // 222×182 RGB pixel-art

// Composite `src` (pixel-art) centred onto a Paper square of `side`, with the
// mark occupying `coverage` fraction of the side (the rest is Paper padding).
function iconOnPaper(side, coverage) {
  // Fit the source into coverage*side while preserving aspect ratio.
  const maxBox = Math.round(side * coverage);
  const scale = Math.min(maxBox / src.width, maxBox / src.height);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const scaled = nearestResize(src, w, h); // nearest keeps hard 8-bit edges
  return padToSquare(scaled, side, PAPER);
}

// apple-icon: full-bleed-ish. iOS adds its own corner mask + margin, so a
// near-edge mark (96% coverage) reads best without looking inset.
const apple = iconOnPaper(180, 0.96);
writeFileSync(join(ROOT, "app", "apple-icon.png"), encodePng(apple));

// maskable: Android may crop to a circle. Keep the mark inside the inner ~80%
// safe zone (coverage 0.72 gives comfortable margin on every side).
const maskable = iconOnPaper(512, 0.72);
writeFileSync(join(ROOT, "public", "icon-maskable.png"), encodePng(maskable));

console.log(
  "ok: app/apple-icon.png (180×180), public/icon-maskable.png (512×512)",
);
