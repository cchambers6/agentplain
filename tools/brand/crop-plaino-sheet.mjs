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

// --- Cell coordinates in the 1402x1122 sheet (column centres 386/652/918/1184) ---
const POSES = {
  'standing-watch': [261, 48, 250, 278],
  'sitting-alert': [527, 48, 250, 278],
  'herding': [793, 48, 250, 278],
  'fetching': [1059, 48, 250, 278],
  'scouting': [190, 458, 245, 253],
  'guarding': [527, 458, 250, 253],
  'resting': [793, 458, 250, 253],
  'head-icon': [1085, 500, 210, 206],
};
const EIGHT_BIT = [680, 852, 222, 182];
const HERITAGE = [905, 815, 495, 235];

// 1) Eight poses + head-icon → poses/<slug>.png
for (const [slug, [l, t, w, h]] of Object.entries(POSES)) {
  write(`public/brand/plaino-system/poses/${slug}.png`, cut(l, t, w, h));
}

// 2) Standalone full-size hero assets (favicon / app-icon / hero sources)
const headIcon = cut(...POSES['head-icon']);
const eightBit = cut(...EIGHT_BIT);
const heritage = cut(...HERITAGE);
write('public/brand/plaino-system/head-icon.png', headIcon);
write('public/brand/plaino-system/8bit.png', eightBit);
write('public/brand/plaino-system/heritage.png', heritage);

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
