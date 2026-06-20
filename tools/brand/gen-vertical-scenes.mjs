// Distinctive per-vertical visual-asset generator.
//
// Item 4 of the de-AI-fication effort: replace generic stock / templated-SaaS
// imagery and the ultra-minimal placeholder prairie motifs with rich, on-brand,
// vertical-grounded scenes — Plaino *in context* (a CPA desk, a PM truck, an RE
// closing table, a law deposition, a kitchen-table office).
//
// This extends the established project idiom (tools/brand/gen-placeholder-scenes.mjs):
// deterministic, reviewable, brand-token-driven SVG composed from a shared
// heritage-primitive library. Nothing is freehand-improvised per asset — a single
// vector Plaino silhouette + shared frame + per-vertical prop clusters guarantee
// consistency AND distinctiveness, and the output is regenerable from source.
//
// Heritage palette + idiom only (paper / ink / clay / moss / mute), no
// sleek-tech gradients, no stock photography, no text inside the scenes
// (the heritage motif idiom is textless). Social cards carry vetted copy only.
//
// Output:
//   public/brand/plaino-system/motifs/vertical-<slug>.svg   (hero scene — overwrites placeholder, same path = zero broken refs)
//   public/brand/illustrations/<slug>/step-{1,2,3}.svg       ("how it works" supporting illustrations)
//   public/brand/social/<slug>/{square,landscape,story}.svg  (social share cards)
//
// Run: node tools/brand/gen-vertical-scenes.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

// ── Brand tokens (mirror lib/brand/tokens.ts; components never hardcode, but a
//    build-time generator is the source that *produces* the committed assets). ──
const C = {
  paper: "#F7F4ED",
  paperDeep: "#EDE9DE",
  ink: "#1A1A1F",
  inkSoft: "#2E2E33",
  clay: "#B65D3A",
  clayDeep: "#9A4D2F",
  moss: "#3F5C3F",
  mute: "#726A5E",
  rule: "#E0DAC9",
};

const VERTICALS = ["real-estate", "cpa", "law", "property-management", "general"];

// Short, R4-safe social copy (no banned buzzwords; vendor-generic; present-tense honest).
const COPY = {
  "real-estate": { label: "Real estate", line: "Your transactions, coordinated.\nYour approvals, intact." },
  cpa: { label: "CPAs & tax", line: "Tax season, organized\nbefore you sit down." },
  law: { label: "Law firms", line: "The intake and drafting, handled.\nThe judgment stays yours." },
  "property-management": { label: "Property management", line: "Maintenance, leasing, and owners —\nkept moving." },
  general: { label: "Local business", line: "The busywork, done.\nYour day, back." },
};

const TAGLINE = "Intelligence rooted in reality.";

// ───────────────────────────── primitive helpers ─────────────────────────────
const rect = (x, y, w, h, fill, o = 1, extra = "") =>
  `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}"${o === 1 ? "" : ` opacity="${o}"`}${extra ? " " + extra : ""}/>`;
const line = (x1, y1, x2, y2, stroke, w = 1.5, o = 1) =>
  `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${stroke}" stroke-width="${w}"${o === 1 ? "" : ` opacity="${o}"`}/>`;
const circle = (cx, cy, rr, fill, o = 1) =>
  `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rr)}" fill="${fill}"${o === 1 ? "" : ` opacity="${o}"`}/>`;
const poly = (pts, fill, o = 1) =>
  `<polygon points="${pts.map(([x, y]) => `${r(x)},${r(y)}`).join(" ")}" fill="${fill}"${o === 1 ? "" : ` opacity="${o}"`}/>`;
const path = (d, fill, o = 1, extra = "") =>
  `<path d="${d}" fill="${fill}"${o === 1 ? "" : ` opacity="${o}"`}${extra ? " " + extra : ""}/>`;
const rrect = (x, y, w, h, rad, fill, o = 1) =>
  `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" rx="${rad}" fill="${fill}"${o === 1 ? "" : ` opacity="${o}"`}/>`;
const ellipse = (cx, cy, rx, ry, fill, o = 1) =>
  `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" fill="${fill}"${o === 1 ? "" : ` opacity="${o}"`}/>`;
const g = (transform, inner) => `<g transform="${transform}">${inner}</g>`;
const r = (n) => Math.round(n * 100) / 100;

// ───────────────────────────── Plaino silhouette ─────────────────────────────
// A calm, sitting beagle in the heritage idiom — ink-filled silhouette with a
// paper chest blaze, a clay collar, and a single soft eye. Drawn once in a local
// ~240×280 box (feet on the baseline y=280), facing left. This is an
// ILLUSTRATION-SYSTEM silhouette for scenes; the canonical 8-bit brand mark
// (public/brand/plaino-system/8bit.png) is untouched.
function plaino(x, y, scale) {
  // Constructed side-profile sitting beagle, facing LEFT. Built from overlapping
  // ink primitives (all merge to one silhouette) so the read is unambiguous:
  // a haunch + chest, two front-leg pillars, an upright neck, a round head with
  // a projecting muzzle, a long floppy ear (the key beagle cue), and a tail.
  // Local box ~ x:0..270, feet on baseline y=280. Beagle tricolor via paper blaze.
  const tail =
    "M236 214 C262 206 276 184 272 156 C264 182 250 200 230 214 Z";
  const ear =
    "M104 78 C82 92 70 124 74 162 C76 184 86 200 100 206 " +
    "C96 178 98 146 110 116 C115 102 114 88 104 78 Z";
  const inner =
    // tail (behind)
    path(tail, C.ink) +
    // seated haunch + chest masses + belly fill
    ellipse(196, 220, 58, 62, C.ink) +
    ellipse(126, 206, 48, 60, C.ink) +
    rect(124, 198, 76, 84, C.ink) +
    // front-leg pillars to the baseline
    rrect(100, 196, 24, 86, 11, C.ink) +
    rrect(142, 200, 24, 82, 11, C.ink) +
    // rear paw peeking at the front of the haunch
    rrect(170, 258, 44, 24, 11, C.ink) +
    // neck + round head
    ellipse(108, 150, 30, 44, C.ink) +
    circle(86, 102, 40, C.ink) +
    // muzzle projecting left + nose
    ellipse(48, 118, 32, 21, C.ink) +
    circle(26, 116, 8, C.ink) +
    // floppy ear over the head (front) — the unmistakable beagle cue
    path(ear, C.clayDeep) +
    // clay collar at the base of the neck
    g("rotate(-58 110 184)", rrect(86, 176, 48, 16, 8, C.clay)) +
    // beagle tricolor — paper chest blaze + muzzle tip + tail tip
    ellipse(118, 206, 17, 46, C.paper, 0.9) +
    ellipse(34, 122, 14, 11, C.paper, 0.85) +
    // eye (paper white + ink pupil) on the head
    circle(92, 96, 6, C.paper, 0.92) +
    circle(90, 97, 3, C.ink);
  return g(`translate(${r(x)},${r(y)}) scale(${scale}) translate(-135,-280)`, inner);
}

// Isolated Plaino render for visual tuning: PLAINO_TEST=1 node ...
function writePlainoTest() {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="320" viewBox="0 0 300 320">
  ${rect(0, 0, 300, 320, C.paper)}
  ${line(0, 300, 300, 300, C.rule, 2, 0.6)}
  ${plaino(150, 300, 1)}
</svg>`;
  writeFileSync(join(ROOT, ".plaino-test.svg"), svg);
  console.log("wrote .plaino-test.svg");
}

// ──────────────────────────── shared scene frame ─────────────────────────────
// Right-anchored composition: HeroBackdrop renders object-cover object-right with
// a left→right paper scrim, so the focal cluster lives in the RIGHT ~55% and the
// LEFT stays calm for the headline. viewBox 1600×1000.
function sceneFrame(inner, { aria }) {
  const horizon = 624;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="${aria}">
  ${rect(0, 0, 1600, 1000, C.paper)}
  ${rect(0, horizon, 1600, 1000 - horizon, C.paperDeep)}
  ${line(0, horizon, 1600, horizon, C.ink, 1.5, 0.35)}
  ${line(0, horizon + 70, 1600, horizon + 70, C.rule, 1.5, 0.6)}
  ${/* distant calm-left horizon detail */ ""}
  ${rect(150, horizon - 26, 70, 26, C.mute, 0.18)}
  ${poly([[150, horizon - 26], [185, horizon - 44], [220, horizon - 26]], C.clay, 0.4)}
  ${inner}
</svg>`;
}

// ───────────────────────── per-vertical prop clusters ────────────────────────
// Each cluster draws on the ground (baseline ~624) in the right half. Plaino sits
// within the scene, in context. Clean editorial shapes, no text.
const SCENES = {
  // RE — a closing table: contract pages, a key, a sold-ready house behind.
  "real-estate": () => {
    let s = "";
    // house on the plain (right-back)
    s += rect(1280, 470, 210, 154, C.paperDeep);
    s += rect(1280, 470, 210, 154, C.mute, 0.12);
    s += poly([[1262, 470], [1385, 398], [1508, 470]], C.clay, 0.85); // roof
    s += rect(1330, 540, 46, 84, C.ink, 0.82); // door
    s += rect(1410, 512, 46, 46, C.paper); s += rect(1410, 512, 46, 46, C.ink, 0.18);
    s += line(1433, 512, 1433, 558, C.ink, 1.2, 0.5); s += line(1410, 535, 1456, 535, C.ink, 1.2, 0.5);
    // closing table (foreground right)
    s += rect(860, 690, 520, 18, C.ink, 0.9); // table top
    s += rect(880, 708, 16, 150, C.ink, 0.7); s += rect(1344, 708, 16, 150, C.ink, 0.7); // legs
    // stacked contract pages on the table
    s += g("rotate(-4 980 676)", rect(940, 612, 150, 78, C.paper) + rect(940, 612, 150, 78, C.ink, 0.14) +
      line(958, 634, 1066, 634, C.mute, 2, 0.5) + line(958, 650, 1066, 650, C.mute, 2, 0.5) + line(958, 666, 1030, 666, C.mute, 2, 0.5) +
      rect(1044, 660, 26, 26, C.clay, 0.85)); // signature seal
    // a key resting on the table
    s += g("rotate(12 1210 678)", circle(1196, 678, 16, C.clay, 0.9) + circle(1196, 678, 7, C.paperDeep) +
      rect(1210, 672, 60, 12, C.clay, 0.9) + rect(1258, 684, 8, 14, C.clay, 0.9) + rect(1244, 684, 8, 10, C.clay, 0.9));
    // Plaino sits beside the table, in context
    s += plaino(1130, 690, 0.66);
    return s;
  },

  // CPA — a desk: stacked tax folders, a ledger/calculator, a desk lamp, papers.
  cpa: () => {
    let s = "";
    // window with plain behind (right-back)
    s += rect(1300, 430, 200, 194, C.paper); s += rect(1300, 430, 200, 194, C.ink, 0.14);
    s += line(1400, 430, 1400, 624, C.ink, 1.4, 0.4); s += line(1300, 527, 1500, 527, C.ink, 1.4, 0.4);
    // desk
    s += rect(840, 700, 560, 16, C.ink, 0.9);
    s += rect(858, 716, 16, 150, C.ink, 0.7); s += rect(1366, 716, 16, 150, C.ink, 0.7);
    // stacked tax-doc folders
    s += rect(900, 636, 170, 22, C.clay, 0.85);
    s += rect(910, 614, 170, 22, C.moss, 0.5);
    s += rect(896, 658, 170, 22, C.mute, 0.4);
    s += rect(1016, 656, 30, 24, C.paper); // a tab sticking out
    // ledger book open + calculator
    s += g("rotate(-3 1170 676)", rect(1110, 640, 130, 56, C.paper) + rect(1110, 640, 130, 56, C.ink, 0.14) +
      line(1175, 640, 1175, 696, C.ink, 1.2, 0.4) +
      line(1124, 658, 1166, 658, C.mute, 1.6, 0.5) + line(1124, 672, 1166, 672, C.mute, 1.6, 0.5) +
      line(1184, 658, 1226, 658, C.mute, 1.6, 0.5) + line(1184, 672, 1226, 672, C.mute, 1.6, 0.5));
    s += rrect(1252, 648, 70, 50, 6, C.ink, 0.85) + rect(1262, 656, 50, 12, C.paper, 0.85) +
      circle(1270, 684, 4, C.paper, 0.7) + circle(1286, 684, 4, C.paper, 0.7) + circle(1302, 684, 4, C.clay, 0.9);
    // desk lamp
    s += rect(862, 560, 12, 140, C.ink, 0.8) + line(868, 564, 940, 540, C.ink, 8, 0.85) +
      poly([[928, 522], [968, 530], [948, 560], [916, 552]], C.clay, 0.85);
    s += circle(944, 552, 6, C.paper, 0.9);
    // Plaino at the desk corner
    s += plaino(1190, 700, 0.62);
    return s;
  },

  // LAW — a deposition/courtroom: lectern, stacked law books, a gavel, a sealed doc.
  law: () => {
    let s = "";
    // tall window / paneling behind
    s += rect(1320, 410, 180, 214, C.paperDeep);
    s += rect(1320, 410, 180, 214, C.ink, 0.1);
    s += line(1320, 410, 1500, 410, C.clay, 3, 0.7);
    // lectern
    s += poly([[1140, 624], [1300, 624], [1276, 470], [1164, 470]], C.ink, 0.85);
    s += poly([[1158, 470], [1282, 470], [1272, 446], [1168, 446]], C.clay, 0.85); // slanted top
    s += rect(1206, 624, 28, 0, C.ink); // base hint
    // stacked law books (foreground)
    s += rect(900, 678, 150, 26, C.clay, 0.85);
    s += rect(908, 652, 150, 26, C.moss, 0.55);
    s += rect(896, 704, 150, 26, C.ink, 0.7);
    s += line(900, 691, 1050, 691, C.paper, 1.4, 0.5);
    s += line(908, 665, 1058, 665, C.paper, 1.4, 0.5);
    // gavel on a sound block
    s += g("rotate(-18 1130 700)", rrect(1086, 686, 96, 26, 8, C.clayDeep) + rrect(1120, 660, 28, 78, 6, C.clayDeep));
    s += rrect(1080, 716, 110, 16, 4, C.ink, 0.8);
    // sealed document
    s += g("rotate(6 1010 640)", rect(960, 600, 110, 80, C.paper) + rect(960, 600, 110, 80, C.ink, 0.12) +
      line(976, 622, 1054, 622, C.mute, 1.6, 0.5) + line(976, 638, 1054, 638, C.mute, 1.6, 0.5) + line(976, 654, 1020, 654, C.mute, 1.6, 0.5) +
      circle(1040, 662, 12, C.clay, 0.9));
    // Plaino, standing watch by the lectern
    s += plaino(1180, 692, 0.6);
    return s;
  },

  // PM — a service truck with a maintenance kit, a building, a keyring.
  "property-management": () => {
    let s = "";
    // multi-unit building (right-back)
    s += rect(1300, 430, 200, 194, C.paperDeep) + rect(1300, 430, 200, 194, C.mute, 0.1);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++)
      s += rect(1322 + j * 44, 452 + i * 56, 26, 34, C.ink, 0.6);
    s += rect(1382, 588, 36, 36, C.clay, 0.85); // door
    // service truck (foreground)
    s += rect(900, 560, 230, 96, C.clay, 0.9); // box body
    s += rect(1130, 588, 96, 68, C.ink, 0.82); // cab
    s += poly([[1130, 588], [1180, 588], [1196, 624], [1130, 624]], C.paper, 0.85); // windshield
    s += rect(900, 656, 326, 14, C.ink, 0.8); // chassis
    s += circle(966, 678, 30, C.ink) + circle(966, 678, 12, C.paperDeep);
    s += circle(1166, 678, 30, C.ink) + circle(1166, 678, 12, C.paperDeep);
    s += rect(924, 584, 70, 8, C.paper, 0.6) + rect(924, 600, 90, 8, C.paper, 0.45); // panel lines
    // open toolbox / maintenance kit on the ground
    s += rect(820, 690, 120, 50, C.moss, 0.7) + rect(820, 678, 120, 14, C.ink, 0.7);
    s += rect(852, 660, 56, 20, C.ink, 0.6); // handle
    // a wrench leaning
    s += g("rotate(-24 800 700)", rrect(792, 640, 14, 90, 6, C.mute, 0.85) +
      path("M785 632 a18 18 0 1 1 28 0 l-7 8 -14 0 z", C.mute, 0.85));
    // keyring
    s += circle(1280, 700, 18, C.clay, 0.9) + circle(1280, 700, 9, C.paperDeep) +
      rect(1294, 694, 34, 7, C.clay, 0.9) + rect(1294, 706, 28, 7, C.clay, 0.9);
    // Plaino riding shotgun by the kit
    s += plaino(1010, 720, 0.56);
    return s;
  },

  // GENERAL — a kitchen-table office: table, laptop, coffee mug, potted plant, window.
  general: () => {
    let s = "";
    // window with morning plain
    s += rect(1310, 420, 190, 204, C.paper) + rect(1310, 420, 190, 204, C.ink, 0.14);
    s += line(1405, 420, 1405, 624, C.ink, 1.4, 0.4); s += line(1310, 522, 1500, 522, C.ink, 1.4, 0.4);
    s += circle(1360, 478, 22, C.clay, 0.35); // soft morning sun
    // kitchen table
    s += rect(860, 692, 520, 16, C.clayDeep, 0.65);
    s += rect(880, 708, 16, 150, C.clayDeep, 0.6); s += rect(1344, 708, 16, 150, C.clayDeep, 0.6);
    // laptop
    s += g("translate(1040 600)", rrect(0, 0, 150, 92, 6, C.ink, 0.85) + rect(10, 10, 130, 72, C.paper, 0.92) +
      line(20, 30, 120, 30, C.mute, 2, 0.5) + line(20, 46, 120, 46, C.mute, 2, 0.5) + line(20, 62, 90, 62, C.clay, 2, 0.7) +
      poly([[-14, 92], [164, 92], [176, 100], [-26, 100]], C.ink, 0.7));
    // coffee mug
    s += rrect(960, 636, 52, 56, 8, C.clay, 0.9) + path("M1012 648 a18 18 0 0 1 0 34", "none") +
      `<path d="M1012 650 a16 16 0 0 1 0 30" fill="none" stroke="${C.clay}" stroke-width="7" opacity="0.9"/>` +
      `<path d="M972 632 c2 -10 8 -16 8 -16 M988 632 c2 -10 8 -16 8 -16" fill="none" stroke="${C.mute}" stroke-width="3" opacity="0.5"/>`; // steam
    // potted plant
    s += poly([[1234, 692], [1290, 692], [1282, 740], [1242, 740]], C.clayDeep, 0.7);
    s += path("M1262 692 C1250 660 1240 640 1236 618 C1252 636 1260 660 1262 686 Z", C.moss, 0.75);
    s += path("M1262 692 C1276 662 1292 646 1300 626 C1290 654 1278 678 1264 690 Z", C.moss, 0.6);
    // Plaino resting under the table
    s += plaino(1170, 700, 0.6);
    return s;
  },
};

// ────────────────────── "how it works" step illustrations ─────────────────────
// Three captionless 640×480 illustrations per vertical, sharing the palette.
// Universal product loop, vertical-grounded prop in each:
//   1 Connect your tools   2 Plaino drafts the work   3 You approve, it goes out
function stepFrame(inner, aria) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="${aria}">
  ${rect(0, 0, 640, 480, C.paper)}
  ${rect(28, 28, 584, 424, "none")}
  <rect x="28" y="28" width="584" height="424" rx="14" fill="none" stroke="${C.rule}" stroke-width="2"/>
  ${line(28, 392, 612, 392, C.rule, 2, 0.7)}
  ${inner}
</svg>`;
}

function steps(slug) {
  // step 1 — connect: three tool tiles plugging into a hub
  const connect = () => {
    let s = "";
    // hub: a soft paperDeep disc with a clay ring; Plaino sits at its center
    s += circle(320, 230, 64, C.paperDeep);
    s += `<circle cx="320" cy="230" r="64" fill="none" stroke="${C.clay}" stroke-width="3"/>`;
    s += plaino(320, 300, 0.36);
    const tiles = [[150, 150], [490, 150], [490, 320]];
    tiles.forEach(([x, y], i) => {
      s += rrect(x - 44, y - 34, 88, 68, 10, C.paper) ;
      s += `<rect x="${x - 44}" y="${y - 34}" width="88" height="68" rx="10" fill="none" stroke="${C.ink}" stroke-width="2" opacity="0.7"/>`;
      const col = [C.clay, C.moss, C.mute][i];
      s += circle(x, y, 14, col, 0.85);
      s += line(x, y, 320, 230, C.ink, 2, 0.35);
    });
    return s;
  };
  // step 2 — draft: Plaino at a document with a clay edit mark
  const draft = () => {
    let s = "";
    s += g("rotate(-3 300 230)", rect(214, 110, 210, 250, C.paper) +
      `<rect x="214" y="110" width="210" height="250" fill="none" stroke="${C.ink}" stroke-width="2" opacity="0.5"/>` +
      line(240, 150, 398, 150, C.mute, 4, 0.5) + line(240, 180, 398, 180, C.mute, 4, 0.5) +
      line(240, 210, 360, 210, C.mute, 4, 0.5) + line(240, 250, 398, 250, C.mute, 4, 0.5) +
      line(240, 280, 340, 280, C.clay, 4, 0.85) + line(240, 310, 398, 310, C.mute, 4, 0.5));
    s += plaino(470, 360, 0.4);
    s += poly([[430, 250], [470, 240], [462, 276]], C.clay, 0.9); // a pointer / pen nib
    return s;
  };
  // step 3 — approve: a check on a card, send arrow
  const approve = () => {
    let s = "";
    s += rrect(180, 150, 200, 160, 14, C.paper);
    s += `<rect x="180" y="150" width="200" height="160" rx="14" fill="none" stroke="${C.ink}" stroke-width="2" opacity="0.6"/>`;
    s += circle(280, 220, 40, C.moss, 0.9);
    s += `<path d="M262 222 l12 14 l24 -30" fill="none" stroke="${C.paper}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += line(220, 278, 340, 278, C.mute, 4, 0.5);
    // send arrow
    s += line(400, 230, 470, 230, C.clay, 5, 0.9);
    s += poly([[470, 214], [500, 230], [470, 246]], C.clay, 0.9);
    s += plaino(150, 360, 0.34);
    return s;
  };
  return [
    stepFrame(connect(), "connect your tools — Plaino at the hub"),
    stepFrame(draft(), "Plaino drafts the work on your documents"),
    stepFrame(approve(), "you approve and it goes out"),
  ];
}

// ───────────────────────────── social share cards ────────────────────────────
function wordmark(x, y, color = C.mute, size = 22) {
  return `<text x="${x}" y="${y}" font-family="ui-monospace, monospace" font-size="${size}" letter-spacing="3.4" fill="${color}" text-transform="uppercase">AGENTPLAIN</text>`;
}
function multiline(x, y, lines, opts) {
  const { size = 52, lh = 1.16, fill = C.ink, family = "Georgia, 'Times New Roman', serif', weight" } = opts;
  return lines
    .map((ln, i) => `<text x="${x}" y="${r(y + i * size * lh)}" font-family="Georgia, 'Times New Roman', serif" font-size="${size}" fill="${fill}">${esc(ln)}</text>`)
    .join("");
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function cardScene(slug, scale, tx, ty) {
  // reuse the hero prop cluster, scaled, as the card's illustration
  return g(`translate(${tx},${ty}) scale(${scale})`, SCENES[slug]());
}

function socialSquare(slug) {
  const c = COPY[slug];
  const lines = c.line.split("\n");
  let s = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" role="img" aria-label="${esc("agentplain for "+c.label)}">`;
  s += rect(0, 0, 1080, 1080, C.paper);
  // top scene band
  s += `<clipPath id="sq"><rect x="0" y="0" width="1080" height="560"/></clipPath>`;
  s += `<g clip-path="url(#sq)">${cardScene(slug, 0.74, 80, 40)}</g>`;
  s += line(0, 560, 1080, 560, C.ink, 2, 0.3);
  s += rect(0, 560, 120, 6, C.clay);
  s += wordmark(72, 632, C.mute, 24);
  s += `<text x="72" y="690" font-family="ui-monospace, monospace" font-size="22" letter-spacing="3" fill="${C.clay}">${esc(c.label.toUpperCase())}</text>`;
  s += multiline(72, 786, lines, { size: 66 });
  s += `<text x="72" y="1010" font-family="Georgia, serif" font-size="30" fill="${C.clay}">${esc(TAGLINE)}</text>`;
  s += `</svg>`;
  return s;
}

function socialLandscape(slug) {
  const c = COPY[slug];
  const lines = c.line.split("\n");
  let s = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628" role="img" aria-label="${esc("agentplain for "+c.label)}">`;
  s += rect(0, 0, 1200, 628, C.paper);
  // right scene
  s += `<clipPath id="ls"><rect x="600" y="0" width="600" height="628"/></clipPath>`;
  s += `<g clip-path="url(#ls)">${cardScene(slug, 0.62, 360, 30)}</g>`;
  s += `<rect x="0" y="0" width="1200" height="628" fill="url(#lsScrim)"/>`;
  s += `<defs><linearGradient id="lsScrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0.42" stop-color="${C.paper}" stop-opacity="1"/><stop offset="0.66" stop-color="${C.paper}" stop-opacity="0.7"/><stop offset="1" stop-color="${C.paper}" stop-opacity="0.2"/></linearGradient></defs>`;
  s += wordmark(72, 96, C.mute, 22);
  s += `<text x="72" y="150" font-family="ui-monospace, monospace" font-size="20" letter-spacing="3" fill="${C.clay}">${esc(c.label.toUpperCase())}</text>`;
  s += multiline(72, 250, lines, { size: 58 });
  s += rect(72, 470, 110, 5, C.clay);
  s += `<text x="72" y="540" font-family="Georgia, serif" font-size="30" fill="${C.ink}">${esc(TAGLINE)}</text>`;
  s += `</svg>`;
  return s;
}

function socialStory(slug) {
  const c = COPY[slug];
  const lines = c.line.split("\n");
  let s = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="${esc("agentplain for "+c.label)}">`;
  s += rect(0, 0, 1080, 1350, C.paper);
  s += `<clipPath id="st"><rect x="0" y="120" width="1080" height="640"/></clipPath>`;
  s += `<g clip-path="url(#st)">${cardScene(slug, 0.78, 60, 130)}</g>`;
  s += wordmark(72, 96, C.mute, 24);
  s += line(0, 760, 1080, 760, C.ink, 2, 0.3);
  s += rect(72, 800, 120, 6, C.clay);
  s += `<text x="72" y="884" font-family="ui-monospace, monospace" font-size="24" letter-spacing="3" fill="${C.clay}">${esc(c.label.toUpperCase())}</text>`;
  s += multiline(72, 980, lines, { size: 70 });
  s += `<text x="72" y="1280" font-family="Georgia, serif" font-size="34" fill="${C.clay}">${esc(TAGLINE)}</text>`;
  s += `</svg>`;
  return s;
}

// ──────────────────────────────── write all ──────────────────────────────────
function write(p, content) {
  const full = join(ROOT, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  console.log("wrote", p, `(${content.length}b)`);
}

const ariaFor = {
  "real-estate": "a closing table with contract pages and a key, a house on the plain, and Plaino sitting beside it",
  cpa: "a tax-season desk with stacked folders, a ledger and calculator, a desk lamp, and Plaino at the corner",
  law: "a deposition lectern with stacked law books, a gavel and a sealed document, and Plaino standing watch",
  "property-management": "a service truck with an open maintenance kit and a keyring, a multi-unit building, and Plaino beside the kit",
  general: "a kitchen-table office with a laptop, coffee, and a plant by a sunny window, and Plaino resting underneath",
};

if (process.env.PLAINO_TEST) {
  writePlainoTest();
  process.exit(0);
}

for (const slug of VERTICALS) {
  write(`public/brand/plaino-system/motifs/vertical-${slug}.svg`, sceneFrame(SCENES[slug](), { aria: ariaFor[slug] }));
  const [s1, s2, s3] = steps(slug);
  write(`public/brand/illustrations/${slug}/step-1.svg`, s1);
  write(`public/brand/illustrations/${slug}/step-2.svg`, s2);
  write(`public/brand/illustrations/${slug}/step-3.svg`, s3);
  write(`public/brand/social/${slug}/square.svg`, socialSquare(slug));
  write(`public/brand/social/${slug}/landscape.svg`, socialLandscape(slug));
  write(`public/brand/social/${slug}/story.svg`, socialStory(slug));
}

console.log("\nDone:", VERTICALS.length, "verticals ×", "(1 hero scene + 3 illustrations + 3 social cards) =", VERTICALS.length * 7, "assets");
