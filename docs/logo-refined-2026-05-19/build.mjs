// Refined logo build — agentplain — 2026-05-19
// Hand-authored marks (robot + wheat), Fraunces wordmark + tagline reused as
// pre-outlined paths from feat/logo-iterations-2026-05-19/iteration-1.svg.
// Renders forest-on-cream PNGs via @resvg/resvg-js (no font needed: all paths).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const PNG = join(DIR, 'png');
mkdirSync(PNG, { recursive: true });

const FOREST = '#1F3D2E';
const CREAM = '#F7F4ED';
const SW = 2.2; // uniform monoline stroke weight (refined: thinner + uniform)

// ---- Reuse the locked Fraunces lockup (outlined paths) -------------------
const iter = readFileSync(join(DIR, '..', 'logo-iterations-2026-05-19', 'iteration-1.svg'), 'utf8');
function grabPath(sig) {
  // find `<path transform="translate(SIG ...` ... `/>`
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
function dot(x, y, r) { return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="currentColor" stroke="none"/>`; }
function rrect(x, y, w, h, r) { return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}"/>`; }
function circle(x, y, r) { return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`; }

// Quadratic-bezier wheat stalk: stem + evenly-spaced, equal-angle grain pairs.
// Grains are short equal-length strokes — elegant, not bushy.
function wheat({ bx, by, cx, cy, tx, ty, n = 6, len = 11, spread = 0.42, tStart = 0.18, tEnd = 0.98 }) {
  const B = (t) => [
    (1 - t) ** 2 * bx + 2 * (1 - t) * t * cx + t * t * tx,
    (1 - t) ** 2 * by + 2 * (1 - t) * t * cy + t * t * ty,
  ];
  let out = `<path d="M${f(bx)} ${f(by)} Q${f(cx)} ${f(cy)} ${f(tx)} ${f(ty)}"/>`; // stem
  for (let i = 0; i < n; i++) {
    const t = tStart + (tEnd - tStart) * (i / (n - 1));
    const [px, py] = B(t);
    // tangent (points toward tip = "up")
    const dx = 2 * (1 - t) * (cx - bx) + 2 * t * (tx - cx);
    const dy = 2 * (1 - t) * (cy - by) + 2 * t * (ty - cy);
    const a = Math.atan2(dy, dx);
    for (const s of [-1, 1]) {
      const ga = a + s * spread; // grain angle off the stem, pointing up-out
      out += line(px, py, px + len * Math.cos(ga), py + len * Math.sin(ga));
    }
  }
  return out;
}

// ==========================================================================
// MARK 1 — REFINED-MINIMAL
// Centered little robot (true rounded-square head + body, dot eyes, no smile)
// framed by two slim symmetric wheat stalks. The baseline idea, executed clean.
// Local coords centered on x=0, y downward.
function mark1() {
  let s = '';
  // framing wheat — open laurel, symmetric, rising from beside the lower body
  // outward then up to head height. No bottom crossing, grains point up.
  s += wheat({ bx: -11, by: 44, cx: -44, cy: 22, tx: -47, ty: -40, n: 5, len: 9.5, spread: 0.52, tStart: 0.26, tEnd: 0.96 });
  s += wheat({ bx: 11, by: 44, cx: 44, cy: 22, tx: 47, ty: -40, n: 5, len: 9.5, spread: 0.52, tStart: 0.26, tEnd: 0.96 });
  // antenna
  s += line(0, -58, 0, -70);
  s += dot(0, -73, 3.0);
  // head (true rounded square)
  s += rrect(-23, -58, 46, 40, 12);
  // eyes — tiny dots, no smile (considered glyph, not mascot)
  s += dot(-9, -39, 2.4);
  s += dot(9, -39, 2.4);
  // neck
  s += line(0, -18, 0, -12);
  // body (rounded rect, slightly narrower)
  s += rrect(-18, -12, 36, 30, 8);
  // legs
  s += line(-8, 18, -8, 28);
  s += line(8, 18, 8, 28);
  return s;
}

// ==========================================================================
// MARK 2 — REFINED-GEOMETRIC
// Architectural robot: precise rounded-rect head, eye-slits; the torso is a
// stack of crisp chevrons that read simultaneously as a wheat head and a
// rectilinear robot body, on a central spine. A designed system.
function mark2() {
  let s = '';
  // antenna + square cap
  s += line(0, -64, 0, -74);
  s += rrect(-3.5, -80, 7, 7, 1.5);
  // head — wide precise rounded rect
  s += rrect(-30, -64, 60, 34, 8);
  // eye slits (short horizontal bars — less cute than dots)
  s += line(-15, -47, -5, -47);
  s += line(5, -47, 15, -47);
  // central spine (wheat stalk / robot core)
  s += line(0, -24, 0, 50);
  // chevrons — equal angle/spacing, pointing up: wheat grain == torso
  const top = -16, gap = 15, half = 22, drop = 12;
  for (let i = 0; i < 5; i++) {
    const y = top + i * gap;
    s += `<path d="M${f(-half)} ${f(y + drop)} L0 ${f(y)} L${f(half)} ${f(y + drop)}"/>`;
  }
  // base line
  s += line(-14, 54, 14, 54);
  return s;
}

// ==========================================================================
// MARK 3 — REFINED-ABSTRACT
// The robot SUGGESTED: a rounded-top bracket (head implied, open at base) +
// dot eyes, paired with a single elegant wheat stalk. The eye completes it.
function mark3() {
  let s = '';
  // single elegant wheat stalk, set to the right, tall and slim
  s += wheat({ bx: 30, by: 64, cx: 40, cy: 6, tx: 41, ty: -62, n: 7, len: 11, spread: 0.46, tStart: 0.12 });
  // antenna for the implied head
  s += line(-18, -52, -18, -64);
  s += dot(-18, -67, 2.8);
  // head implied as an open rounded-top bracket (arch), left of the stalk
  s += `<path d="M${f(-40)} ${f(8)} L${f(-40)} ${f(-34)} Q${f(-40)} ${f(-52)} ${f(-22)} ${f(-52)} L${f(-14)} ${f(-52)} Q${f(4)} ${f(-52)} ${f(4)} ${f(-34)} L${f(4)} ${f(8)}"/>`;
  // dot eyes inside the arch
  s += dot(-26, -28, 2.6);
  s += dot(-10, -28, 2.6);
  return s;
}

// ==========================================================================
// MARK 4 — REFINED-EMBLEM
// Robot + wheat unified in a circular badge (app-icon ready): a rounded-square
// head whose "antenna" is literally a wheat sprig growing from its crown —
// wheat reading as the robot's own form. The most ownable mark.
function mark4() {
  let s = '';
  // enclosing circle
  s += circle(0, 0, 66);
  // wheat sprig growing from head crown (the antenna IS wheat)
  s += line(0, -10, 0, -50);            // central stalk
  s += dot(0, -53, 2.6);                 // crown grain tip
  const grains = [[-1, 0.85], [1, 0.85], [-1, 0.55], [1, 0.55]];
  for (const [side, t] of grains) {
    const y = -10 - (50 - 10) * t;       // along the stalk
    s += line(0, y, side * 11, y - 12);  // grain
  }
  // robot head (rounded square)
  s += rrect(-23, -10, 46, 40, 11);
  // eyes — tiny dots, no smile
  s += dot(-8, 9, 2.4);
  s += dot(8, 9, 2.4);
  // subtle base/jaw line
  s += line(-12, 30, 12, 30);
  return s;
}

const MARKS = [
  { id: 1, name: 'refined-minimal', inner: mark1(), markBox: [-54, -80, 108, 116] },
  { id: 2, name: 'refined-geometric', inner: mark2(), markBox: [-34, -82, 68, 144] },
  { id: 3, name: 'refined-abstract', inner: mark3(), markBox: [-44, -70, 96, 140] },
  { id: 4, name: 'refined-emblem', inner: mark4(), markBox: [-70, -70, 140, 140] },
];

// ---- compose a full stacked lockup --------------------------------------
const MARK_CY = 122; // vertical center of the mark group on the 600x398 canvas
function lockupSVG(m, { bg = false } = {}) {
  const bgRect = bg ? `<rect x="0" y="0" width="600" height="398" fill="${CREAM}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 398" role="img" aria-label="agentplain — Intelligence rooted in reality" style="color:${FOREST}">
${bgRect}
<g transform="translate(300 ${MARK_CY})" fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">
${m.inner}
</g>
${WORDMARK}
${TAGLINE}
</svg>`;
}

// ---- mark-only SVG (tight box) for small-size judging --------------------
function markOnlySVG(m, { bg = false, pad = 10 } = {}) {
  const [x, y, w, h] = m.markBox;
  const vb = `${x - pad} ${y - pad} ${w + 2 * pad} ${h + 2 * pad}`;
  const bgRect = bg ? `<rect x="${x - pad}" y="${y - pad}" width="${w + 2 * pad}" height="${h + 2 * pad}" fill="${CREAM}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" style="color:${FOREST}">
${bgRect}
<g fill="none" stroke="currentColor" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">
${m.inner}
</g>
</svg>`;
}

function render(svg, width) {
  // resvg honors fill/stroke colors directly; replace currentColor with hex.
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
  const svg = lockupSVG(m);
  writeFileSync(join(DIR, `refined-${m.id}.svg`), svg);
  writeFileSync(join(PNG, `refined-${m.id}.png`), render(lockupSVG(m, { bg: true }), 800));
}
console.log('wrote 4 lockup svgs + pngs');

// ==========================================================================
// CONTACT SHEET — 2x2 lockups + a 64px mark-only strip, labelled (Arial).
// ==========================================================================
const CW = 1000;
const CELL_W = 500, CELL_H = 340;
const lockScale = 460 / 600; // fit lockup width into cell
const lockH = 398 * lockScale;
function placedLockup(m, gx, gy) {
  const tx = gx + (CELL_W - 600 * lockScale) / 2;
  const ty = gy + 18;
  return `<g transform="translate(${f(tx)} ${f(ty)}) scale(${f(lockScale)})">
<g transform="translate(300 ${MARK_CY})" fill="none" stroke="${FOREST}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${m.inner}</g>
${WORDMARK.replaceAll('currentColor', FOREST)}
${TAGLINE.replaceAll('currentColor', FOREST)}
</g>
<text x="${f(gx + CELL_W / 2)}" y="${f(gy + lockH + 30)}" font-family="Arial" font-size="17" font-weight="700" fill="${FOREST}" text-anchor="middle">${m.id}. ${m.name}</text>`;
}
// mark-only at fixed 64px box for the small strip
function placedMark64(m, cx, cy) {
  const [x, y, w, h] = m.markBox;
  const box = 64;
  const sc = box / Math.max(w, h);
  const ox = cx - (x + w / 2) * sc;
  const oy = cy - (y + h / 2) * sc;
  return `<g transform="translate(${f(ox)} ${f(oy)}) scale(${f(sc)})">
<g fill="none" stroke="${FOREST}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${m.inner}</g>
</g>
<text x="${f(cx)}" y="${f(cy + box / 2 + 24)}" font-family="Arial" font-size="13" fill="${FOREST}" text-anchor="middle" opacity="0.8">${m.name}</text>`;
}

const gridTop = 70;
const stripTop = gridTop + 2 * CELL_H + 20;
const CH = stripTop + 150;
let cs = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}">
<rect x="0" y="0" width="${CW}" height="${CH}" fill="${CREAM}"/>
<text x="${CW / 2}" y="40" font-family="Arial" font-size="24" font-weight="700" fill="${FOREST}" text-anchor="middle">agentplain — refined logo takes — 2026-05-19</text>
<line x1="60" y1="54" x2="${CW - 60}" y2="54" stroke="${FOREST}" stroke-width="1" opacity="0.25"/>`;
// 2x2 grid
const cells = [[0, gridTop], [CELL_W, gridTop], [0, gridTop + CELL_H], [CELL_W, gridTop + CELL_H]];
MARKS.forEach((m, i) => { cs += placedLockup(m, cells[i][0], cells[i][1]); });
// divider + strip label
cs += `<line x1="60" y1="${stripTop - 8}" x2="${CW - 60}" y2="${stripTop - 8}" stroke="${FOREST}" stroke-width="1" opacity="0.25"/>
<text x="${CW / 2}" y="${stripTop + 18}" font-family="Arial" font-size="15" font-weight="700" fill="${FOREST}" text-anchor="middle">marks alone at 64px — refinement check at small size</text>`;
// 64px strip — 4 marks evenly spaced
const stripY = stripTop + 70;
MARKS.forEach((m, i) => { cs += placedMark64(m, (CW / 5) * (i + 1), stripY); });
cs += `</svg>`;

writeFileSync(join(PNG, 'contact-sheet.svg'), cs);
const csPng = new Resvg(cs, {
  fitTo: { mode: 'width', value: CW },
  font: { fontDirs: ['C:/Windows/Fonts'], defaultFontFamily: 'Arial', loadSystemFonts: true },
}).render().asPng();
writeFileSync(join(PNG, 'contact-sheet.png'), csPng);
console.log('wrote contact-sheet.svg + .png');
