// Generates every Plaino brand asset from the canonical reference sheet.
// Source of truth: public/brand/plaino-system/reference-sheet.png (the ChatGPT
// delivery built from docs/brand AGENTPLAIN_BRAND_BRIEF.md). Re-run after any
// re-crop. Dependency-free — uses only ./png-lib.mjs (built on Node zlib),
// same "no new deps to crop" principle as the brief required.
//
// Usage:  node tools/brand/crop-plaino-sheet.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, crop, encodePng, areaResize, nearestResize, padToSquare } from './png-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHEET = path.join(ROOT, 'public/brand/plaino-system/reference-sheet.png');
const PAPER = [247, 244, 237]; // tokens.colors.paper #F7F4ED

const img = decodePng(fs.readFileSync(SHEET));
if (img.width !== 1402 || img.height !== 1122) {
  throw new Error(`reference sheet is ${img.width}x${img.height}, expected 1402x1122 — re-derive crop coordinates`);
}

const write = (rel, image) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, encodePng(image));
  return p;
};
const cut = (l, t, w, h) => crop(img, l, t, w, h);

// --- Cell coordinates in the 1402x1122 sheet ---
// Derived 2026-06-11 by per-pixel column/row luma scan of the reference sheet.
// Each rect is [left, top, width, height] in source pixels.
//
// Row 1 gutters (luma>235 across y=100-300): x=0-26(edge), 192-242(header|dog1),
//   502-548(dog1|dog2), 708-732(dog2|dog3), 1012-1058(dog3|dog4), 1356-1400(edge).
// Illustration x-extents (dark pixels in y=50-330):
//   standing-watch: x=242..505 | sitting-alert: x=541..716
//   herding: x=732..1015       | fetching: x=1059..1361
// Row 1 y: illustration ends at y≈325, caption text starts y≈348.
//   Gap y=326-347 is clean paper — we use top margin of 8px, crop bottom at y=338.
// Row 2 illustration x-extents (dark pixels in y=410-760):
//   scouting: x=57..359  | guarding: x=465..731  | resting: x=765..1057 | head-icon: x=1104..1316
// Row 2 y: scouting illustration bottom y=676, caption y=700.
//   guarding illustration bottom y=755, caption y=700.
//   resting illustration bottom y=755, clean paper gap y=756-785, horizontal rule y=786.
//   head-icon circle y=475..639, caption starts y=640 (excluded).
// Row 3 (y≈810-1015): 8-bit pixel-art dog and heritage landscape.
//   8-bit dog: x=645-800, y=823-1010; caption "9.8-BIT PLAINO" starts y=1043 (excluded).
//   Raised-tail orb topmost pixel = y=823 (pixel-scanned 2026-06-12). Crop top=810
//   gives 13px of paper buffer above the orb so it can never clip at the header edge.
//   Heritage: x=896-1378, y=800-1049.
const POSES = {
  // Row 1 column gutters (luma>235 in y=100-300): x=0-26, 192-242, 502-548, 708-732, 1012-1058, 1356-1400
  // Row 1 illustration extents: sw=242..505 | sa=541..716 | hd=732..1015 | ft=1059..1361
  // Row 1 illustration y: top y≈48-84, ground line y≈320-325, gap y=326-347, caption y=348-358,
  //   subtitle line1 y=372-388, subtitle line2 y=393-409. Crop must end ABOVE y=409.
  'standing-watch': [232, 40, 283, 290],  // dog x=242..505, y=48..325; cap at y=330 before captions
  'sitting-alert':  [531, 40, 175, 290],  // dog x=541..706; gutter starts x=708; tail tip included at x≈700
  'herding':        [722, 40, 303, 290],  // dog x=732..1015; left-padded for snout; ends y=325
  'fetching':       [1049, 40, 318, 290], // dog x=1059..1361; right-padded for tail antenna+bag
  // Row 2 illustration extents (by full column scan of dark pixels, y=410-800):
  //   scouting: dog y=519..676, x=57..359 | guarding: dog y=466..677, x=465..731
  //   resting: dog y=581..674, x=765..1057 | head-icon: circle y=475..639, x=1104..1316
  // Caption "N.NAME MODE" for all row-2 poses: y=700-710 (red text), subtitle y=724-755.
  // All row 1 subtitle text clears by y=410 — safe start for row 2 is y=415.
  'scouting':       [47, 510, 322, 175],  // dog y=519..676; narrow band captures dog, excludes caption
  'guarding':       [455, 455, 295, 230], // dog y=466..677; excludes caption at y=700
  'resting':        [755, 570, 312, 115], // dog y=581..674; tightly cropped to illustration only
  'head-icon':      [1090, 462, 240, 185], // circle x=1104..1316, y=475..643; excludes caption at y=640+ (circle outline ends y=639)
};
const EIGHT_BIT = [595, 810, 237, 205]; // pixel-art dog snout x=603, body x=645-800, orb right x=829, y=823-1014;
// left=595 captures nose at x≈603 with 8px buffer (prior crop at x=617 cut the snout tip off — 2026-06-15 fix)
// width=237 so right edge = 595+237 = 832, covering full orb/tail sparkles at x≈829
// top=810 gives 13px paper above orb top y=823; height=205 reaches paw bottom y=1014
const HERITAGE = [890, 796, 495, 258];  // landscape x=896-1378, y=800-1049; clean

// 1) Eight poses + head-icon → poses/<slug>.png
for (const [slug, [l, t, w, h]] of Object.entries(POSES)) {
  write(`public/brand/plaino-system/poses/${slug}.png`, cut(l, t, w, h));
}

// 2) Standalone full-size hero assets (favicon / app-icon / hero sources)
const headIcon = cut(...POSES['head-icon']);
const eightBit = cut(...EIGHT_BIT);
const heritage = cut(...HERITAGE);
write('public/brand/plaino-system/head-icon.png', headIcon);
write('public/brand/plaino-system/heritage.png', heritage);

// 8bit.png is the BRAND MARK rendered full-bleed by PlainoMark on identity
// surfaces (site header, footer, login, OG, chat entry). Unlike the favicon /
// mobile / app-icon derivations below — which each composite onto their own
// platform safe zone — this file is consumed RAW, so its own bounds ARE the
// mark's bounds. The raised-tail orb (top) and the paws (bottom/sides) of the
// pixel-art dog bleed to the very edge of the tight EIGHT_BIT crop (≤6% buffer
// above the orb, 0px on the other three sides). Any container that uses
// `object-fit: cover`, `overflow: hidden`, or a height-constrained / non-square
// box therefore clips the orb first — the failure mode reported THREE times on
// three different surfaces (header, then login, then this card tile).
//
// STRUCTURAL FIX (Option A — asset-level safe-area): bake a uniform paper
// margin into the SHIPPED mark so the figure occupies ~78% of the canvas with
// ≥15% clear paper above the orb. Every container is now clip-proof regardless
// of its sizing/overflow — there is nothing to re-solve per surface. The tight
// `eightBit` crop is deliberately reused unchanged by the favicon/mobile/icon
// builders below, which apply their own (smaller) platform safe zones.
//
// Guard: tests/plaino-brand-mark-no-clip.test.ts asserts this safe-area on the
// committed PNG and fails CI if a future re-crop removes it (would have caught
// all three prior regressions). See docs/brand/icon-families.md.
const MARK_SAFE_COVERAGE = 0.78; // figure ≤78% of canvas → ≥11% margin/side, ≥15% above the orb
const markSide = Math.round(Math.max(eightBit.width, eightBit.height) / MARK_SAFE_COVERAGE);
const eightBitMark = padToSquare(eightBit, markSide, PAPER);
write('public/brand/plaino-system/8bit.png', eightBitMark);

// 3) Favicon — 8-bit Plaino. Self-contained pixelated SVG (crisp at 16-32px)
//    plus a PNG fallback. The 8-bit art is a *textured* raster, so we embed it
//    rather than vectorise (vectorising would flatten the texture).
const fav64 = padToSquare(areaResize(eightBit, 58, 48), 64, PAPER);
write('public/brand/plaino-system/8bit-64.png', fav64);
write('app/icon.png', fav64);
const favB64 = encodePng(fav64).toString('base64');
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges"><image href="data:image/png;base64,${favB64}" width="64" height="64" style="image-rendering:pixelated"/></svg>\n`;
fs.writeFileSync(path.join(ROOT, 'app/icon.svg'), faviconSvg);
fs.writeFileSync(path.join(ROOT, 'public/favicon.svg'), faviconSvg);

// 4) Mobile (Expo) icons. Pixel-art upscales with nearest-neighbour.
const appIcon = padToSquare(nearestResize(eightBit, 888, 728), 1024, PAPER); // ~4x, fills most of 1024
write('apps/mobile/assets/icon.png', appIcon);
const adaptive = padToSquare(nearestResize(eightBit, 620, 508), 1024, PAPER); // smaller — Android safe zone
write('apps/mobile/assets/adaptive-icon.png', adaptive);
write('apps/mobile/assets/favicon.png', padToSquare(areaResize(eightBit, 58, 48), 64, PAPER));
// Splash: heritage centred (native res → crisp) on a portrait paper canvas; contain handles scaling.
const splashCanvas = (() => {
  const W = 1242, H = 2208, c = 3;
  const data = new Uint8Array(W * H * c);
  for (let i = 0; i < W * H; i++) { data[i*c]=PAPER[0]; data[i*c+1]=PAPER[1]; data[i*c+2]=PAPER[2]; }
  const ox = Math.round((W - heritage.width) / 2), oy = Math.round((H - heritage.height) / 2);
  for (let y = 0; y < heritage.height; y++) for (let x = 0; x < heritage.width; x++) {
    const si = (y*heritage.width+x)*heritage.channels, di = ((oy+y)*W+(ox+x))*c;
    data[di]=heritage.data[si]; data[di+1]=heritage.data[si+1]; data[di+2]=heritage.data[si+2];
  }
  return { width: W, height: H, channels: c, data };
})();
write('apps/mobile/assets/splash.png', splashCanvas);

// (The OG route fetches public/brand/plaino-system/heritage.png from the
//  deployment origin at request time — nothing is bundled.)

console.log('Plaino assets generated:');
console.log('  poses:', Object.keys(POSES).join(', '));
console.log('  standalone: head-icon.png, 8bit.png, heritage.png');
console.log('  favicon: app/icon.svg, app/icon.png, public/favicon.svg');
console.log('  mobile: icon/adaptive-icon/splash/favicon.png');
