// Wheat-only logo build — agentplain — 2026-05-19
// Robot dropped entirely. Wheat carries the whole thesis (agent + the PLAINS,
// "intelligence rooted in reality") on its own — refined, heritage, NOT cute.
// Fraunces wordmark + tagline reused as pre-outlined paths from
// feat/logo-iterations-2026-05-19/iteration-1.svg. Forest-on-cream, monoline.
// Renders via @resvg/resvg-js (all paths — no font needed for the marks).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const PNG = join(DIR, 'png');
mkdirSync(PNG, { recursive: true });

const FOREST = '#1F3D2E';
const CREAM = '#F7F4ED';
const SW = 2.2; // uniform monoline stroke weight

// ---- Reuse the locked Fraunces lockup (outlined paths) -------------------
const iter = readFileSync(join(DIR, '..', 'logo-iterations-2026-05-19', 'iteration-1.svg'), 'utf8');
function grabPath(sig) {
  const i = iter.indexOf(`<path transform="translate(${sig}`);
  if (i < 0) throw new Error('missing path ' + sig);
  const end = iter.indexOf('/>', i);
  return iter.slice(i, end + 2);
}
const WORDMARK = grabPath('119.7 308'); // "agentplain" Fraunces, baseline y=308
const TAGLINE = grabPath('71.4 362');   // "INTELLIGENCE ROOTED IN REALITY"

// ---- geometry helpers ----------------------------------------------------
const f = (n) => (Math.round(n * 1000) / 1000);
function line(x1, y1, x2, y2) { return `<path d="M${f(x1)} ${f(y1)} L${f(x2)} ${f(y2)}"/>`; }
function circle(x, y, r) { return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`; }

// A single wheat grain: a slim almond/teardrop OUTLINE (closed) along the
// stem, from base point P to tip, bulging by half-width W. Stroked, not
// filled — keeps the refined monoline language. This is the heritage
// "real wheat grain" shape, not a bushy stroke.
function grain(px, py, a, L, W) {
  const tx = px + L * Math.cos(a), ty = py + L * Math.sin(a);
  const mx = px + 0.5 * L * Math.cos(a), my = py + 0.5 * L * Math.sin(a);
  const ox = -Math.sin(a) * W, oy = Math.cos(a) * W; // perpendicular
  return `<path d="M${f(px)} ${f(py)} Q${f(mx + ox)} ${f(my + oy)} ${f(tx)} ${f(ty)} Q${f(mx - ox)} ${f(my - oy)} ${f(px)} ${f(py)} Z"/>`;
}

// Quadratic-bezier wheat stalk: a curved/straight stem with evenly-spaced,
// equal-angle PAIRED teardrop grains, gently tapering toward the tip, plus a
// terminal grain at the very tip. Deliberate angle + spacing = refined spike.
function stalk({ bx, by, cx, cy, tx, ty, n = 6, gL = 12, gW = 2.7, spread = 0.62, tStart = 0.34, tEnd = 0.92, taper = 0.26, tip = true }) {
  const B = (t) => [
    (1 - t) ** 2 * bx + 2 * (1 - t) * t * cx + t * t * tx,
    (1 - t) ** 2 * by + 2 * (1 - t) * t * cy + t * t * ty,
  ];
  const ang = (t) => {
    const dx = 2 * (1 - t) * (cx - bx) + 2 * t * (tx - cx);
    const dy = 2 * (1 - t) * (cy - by) + 2 * t * (ty - cy);
    return Math.atan2(dy, dx); // tangent pointing toward the tip (up)
  };
  let out = `<path d="M${f(bx)} ${f(by)} Q${f(cx)} ${f(cy)} ${f(tx)} ${f(ty)}"/>`; // stem
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    const t = tStart + (tEnd - tStart) * u;
    const [px, py] = B(t);
    const a = ang(t);
    const L = gL * (1 - taper * u);
    for (const sgn of [-1, 1]) out += grain(px, py, a + sgn * spread, L, gW);
  }
  if (tip) { const [px, py] = B(1); out += grain(px, py, ang(1), gL * (1 - taper), gW); }
  return out;
}

// ==========================================================================
// MARK 1 — SINGLE STALK · minimal
// One upright, confident stalk. Maximum restraint. Bare lower stem, a refined
// tapering spike of paired teardrop grains up top. Financial-services calm.
function mark1() {
  let s = '';
  s += stalk({ bx: 0, by: 64, cx: 0, cy: 0, tx: 0, ty: -70, n: 6, gL: 13, gW: 2.9, spread: 0.6, tStart: 0.40, tEnd: 0.9, taper: 0.30 });
  return s;
}

// ==========================================================================
// MARK 2 — TIED SHEAF · classic
// Three stalks gathered from a common base, fanned at the top, bound by a band
// near the base. The archetypal "staff of life" sheaf, symmetric + balanced.
function mark2() {
  let s = '';
  const baseX = 0, baseY = 60;
  // central upright
  s += stalk({ bx: baseX, by: baseY, cx: 0, cy: -4, tx: 0, ty: -74, n: 5, gL: 12, gW: 2.7, spread: 0.6, tStart: 0.40, tEnd: 0.9, taper: 0.28 });
  // left + right fanned
  s += stalk({ bx: baseX, by: baseY, cx: -20, cy: -2, tx: -34, ty: -56, n: 4, gL: 11, gW: 2.6, spread: 0.6, tStart: 0.42, tEnd: 0.92, taper: 0.28 });
  s += stalk({ bx: baseX, by: baseY, cx: 20, cy: -2, tx: 34, ty: -56, n: 4, gL: 11, gW: 2.6, spread: 0.6, tStart: 0.42, tEnd: 0.92, taper: 0.28 });
  // binding tie near the base — two slim bands cinching the gathered stalks
  s += line(-10, 39, 10, 39);
  s += line(-10, 45, 10, 45);
  return s;
}

// ==========================================================================
// MARK 3 — GEOMETRIC / ABSTRACT · designed glyph
// Wheat reduced to its essence: a stylized EAR built from up-pointing grain
// pairs (V's opening upward off an implied spine), in a pointed-lens
// silhouette, over a bare straight stem. No trunk-through-head, no ground line
// — so it reads as a wheat ear / typographic glyph, never a conifer.
function mark3() {
  let s = '';
  const headTop = -60, headBot = 6, n = 8, drop = 9;
  // bare stem below the ear
  s += line(0, 60, 0, headBot + 2);
  for (let i = 0; i < n; i++) {
    const p = i / (n - 1);                 // 0 = top tip, 1 = base of ear
    const y = headTop + (headBot - headTop) * p;
    const hw = 3.5 + 13 * Math.sin(Math.PI * Math.min(1, p * 0.92)); // lens
    if (hw < 2) continue;
    // V opening upward: arms point up-and-out, meeting on the implied spine
    s += `<path d="M${f(-hw)} ${f(y - drop)} L0 ${f(y)} L${f(hw)} ${f(y - drop)}"/>`;
  }
  // pointed tip grain at the crown
  s += line(0, headTop + 2, 0, headTop - 9);
  return s;
}

// ==========================================================================
// MARK 5 — EMBLEM / SEAL · heritage crest  (defined before 4 for ordering)
// A crossed pair of wheat stalks inside a fine double ring, a small diamond
// finial up top. Grain-cooperative seal — "been here 100 years", app-icon ready.
function mark5() {
  let s = '';
  s += circle(0, 0, 66);  // outer ring
  s += circle(0, 0, 59);  // inner hairline ring
  // crossed pair, rising from bottom-center, fanning up + out
  s += stalk({ bx: 4, by: 46, cx: -10, cy: -6, tx: -30, ty: -44, n: 4, gL: 11, gW: 2.6, spread: 0.58, tStart: 0.40, tEnd: 0.92, taper: 0.26 });
  s += stalk({ bx: -4, by: 46, cx: 10, cy: -6, tx: 30, ty: -44, n: 4, gL: 11, gW: 2.6, spread: 0.58, tStart: 0.40, tEnd: 0.92, taper: 0.26 });
  // diamond finial (heritage seal touch) at top-center, inside the ring
  s += `<path d="M0 -52 L6 -45 L0 -38 L-6 -45 Z"/>`;
  // small grounding base line where the stalks cross/meet
  s += line(-7, 49, 7, 49);
  return s;
}

// ==========================================================================
// MARK 4 — WHEAT-INTEGRATED WORDMARK · horizontal lockup
// A delicate wheat stalk grows up out of the ascender of the 'l' in
// "agentplain" — the mark and the wordmark become one. Built in CANVAS coords
// (the 'l' top sits at ~(364.7, 242.7) on the 600x398 lockup).
const L_TOP = { x: 363.6, y: 242.7 }; // top of the 'l' ascender (measured: local x=243.9 + 119.7, y=308-65.3)
function wheatOnL() {
  // stem continues straight up out of the 'l', delicate grains in the upper half
  return stalk({
    bx: L_TOP.x, by: L_TOP.y, cx: L_TOP.x, cy: L_TOP.y - 34, tx: L_TOP.x, ty: L_TOP.y - 66,
    n: 5, gL: 9.5, gW: 2.2, spread: 0.58, tStart: 0.30, tEnd: 0.92, taper: 0.30,
  });
}
// synthetic "l + wheat" unit for the 64px small-size strip (local centered coords)
function mark4Strip() {
  let s = '';
  s += line(0, 0, 0, -64); // the 'l' stem, abstracted
  s += stalk({ bx: 0, by: -64, cx: 0, cy: -64 - 34, tx: 0, ty: -64 - 66, n: 5, gL: 9.5, gW: 2.2, spread: 0.58, tStart: 0.30, tEnd: 0.92, taper: 0.30 });
  return s;
}

const MARKS = [
  { id: 1, name: 'single stalk', type: 'stacked', inner: mark1(), markBox: [-26, -78, 52, 150] },
  { id: 2, name: 'tied sheaf', type: 'stacked', inner: mark2(), markBox: [-46, -80, 92, 148] },
  { id: 3, name: 'geometric', type: 'stacked', inner: mark3(), markBox: [-26, -72, 52, 140] },
  { id: 4, name: 'integrated wordmark', type: 'integrated', inner: wheatOnL(), markBox: [-18, -136, 36, 150], stripInner: mark4Strip() },
  { id: 5, name: 'emblem / seal', type: 'stacked', inner: mark5(), markBox: [-70, -70, 140, 140] },
];

// ---- compose a full stacked lockup --------------------------------------
const MARK_CY = 122; // vertical center of the mark group on the 600x398 canvas
function lockupInner(m, color = 'currentColor') {
  if (m.type === 'integrated') {
    return `<g fill="none" stroke="${color}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">
${m.inner}
</g>
${WORDMARK.replaceAll('currentColor', color)}
${TAGLINE.replaceAll('currentColor', color)}`;
  }
  return `<g transform="translate(300 ${MARK_CY})" fill="none" stroke="${color}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">
${m.inner}
</g>
${WORDMARK.replaceAll('currentColor', color)}
${TAGLINE.replaceAll('currentColor', color)}`;
}
function lockupSVG(m, { bg = false } = {}) {
  const bgRect = bg ? `<rect x="0" y="0" width="600" height="398" fill="${CREAM}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 398" role="img" aria-label="agentplain — Intelligence rooted in reality" style="color:${FOREST}">
${bgRect}
${lockupInner(m)}
</svg>`;
}

// ---- mark-only SVG (tight box) for small-size judging --------------------
function markOnlyInner(m) { return m.type === 'integrated' ? m.stripInner : m.inner; }
function markOnlySVG(m, { bg = false, pad = 10 } = {}) {
  const [x, y, w, h] = m.markBox;
  const vb = `${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const bgRect = bg ? `<rect x="${x - pad}" y="${y - pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" fill="${CREAM}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" style="color:${FOREST}">
${bgRect}
<g fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">
${markOnlyInner(m)}
</g>
</svg>`;
}

function render(svg, width) {
  const resolved = svg.replaceAll('currentColor', FOREST);
  const r = new Resvg(resolved, {
    background: CREAM,
    fitTo: { mode: 'width', value: width },
    font: { fontDirs: ['C:/Windows/Fonts'], defaultFontFamily: 'Arial', loadSystemFonts: true },
  });
  return r.render().asPng();
}

// ---- write SVGs + PNGs ---------------------------------------------------
for (const m of MARKS) {
  writeFileSync(join(DIR, `wheat-${m.id}.svg`), lockupSVG(m));
  writeFileSync(join(PNG, `wheat-${m.id}.png`), render(lockupSVG(m, { bg: true }), 800));
}
console.log('wrote 5 lockup svgs + pngs');

// ==========================================================================
// CONTACT SHEET — 5 lockups (2 cols x 3 rows) + a 64px mark-only strip.
// ==========================================================================
const CW = 1000;
const CELL_W = 500, CELL_H = 332;
const lockScale = 462 / 600;
const lockH = 398 * lockScale;
function placedLockup(m, gx, gy) {
  const tx = gx + (CELL_W - 600 * lockScale) / 2;
  const ty = gy + 14;
  return `<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(lockScale)})">
${lockupInner(m, FOREST)}
</g>
<text x="${f(gx + CELL_W / 2)}" y="${f(gy + lockH + 26)}" font-family="Arial" font-size="17" font-weight="700" fill="${FOREST}" text-anchor="middle">${m.id}. ${m.name}</text>`;
}
function placedMark64(m, cx, cy) {
  const [x, y, w, h] = m.markBox;
  const box = 64;
  const sc = box / Math.max(w, h);
  const ox = cx - (x + w / 2) * sc;
  const oy = cy - (y + h / 2) * sc;
  return `<g transform="translate(${f(ox)} ${f(oy)}) scale(${f(sc)})">
<g fill="none" stroke="${FOREST}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${markOnlyInner(m)}</g>
</g>
<text x="${f(cx)}" y="${f(cy + box / 2 + 22)}" font-family="Arial" font-size="12.5" fill="${FOREST}" text-anchor="middle" opacity="0.8">${m.name}</text>`;
}

const gridTop = 70;
const stripTop = gridTop + 3 * CELL_H + 16;
const CH = stripTop + 150;
let cs = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}">
<rect x="0" y="0" width="${CW}" height="${CH}" fill="${CREAM}"/>
<text x="${CW / 2}" y="40" font-family="Arial" font-size="24" font-weight="700" fill="${FOREST}" text-anchor="middle">agentplain — wheat-only logo directions — 2026-05-19</text>
<line x1="60" y1="54" x2="${CW - 60}" y2="54" stroke="${FOREST}" stroke-width="1" opacity="0.25"/>`;
const cells = [
  [0, gridTop], [CELL_W, gridTop],
  [0, gridTop + CELL_H], [CELL_W, gridTop + CELL_H],
  [0, gridTop + 2 * CELL_H], [CELL_W, gridTop + 2 * CELL_H],
];
MARKS.forEach((m, i) => { cs += placedLockup(m, cells[i][0], cells[i][1]); });
cs += `<line x1="60" y1="${stripTop - 8}" x2="${CW - 60}" y2="${stripTop - 8}" stroke="${FOREST}" stroke-width="1" opacity="0.25"/>
<text x="${CW / 2}" y="${stripTop + 18}" font-family="Arial" font-size="15" font-weight="700" fill="${FOREST}" text-anchor="middle">marks alone at 64px — refinement check at small size</text>`;
const stripY = stripTop + 72;
MARKS.forEach((m, i) => { cs += placedMark64(m, (CW / 6) * (i + 1), stripY); });
cs += `</svg>`;

writeFileSync(join(PNG, 'contact-sheet.svg'), cs);
const csPng = new Resvg(cs, {
  fitTo: { mode: 'width', value: CW },
  font: { fontDirs: ['C:/Windows/Fonts'], defaultFontFamily: 'Arial', loadSystemFonts: true },
}).render().asPng();
writeFileSync(join(PNG, 'contact-sheet.png'), csPng);
console.log('wrote contact-sheet.svg + .png');
