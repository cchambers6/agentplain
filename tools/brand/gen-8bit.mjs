// 8-bit robot-dog brand generator.
//
// Ratified 2026-06-06: the public brand mark + mobile app icon is the agentplain
// robot dog rendered as 8-bit pixel art, standing on an 8-bit plain. This makes
// the long-internal "Plaino is a robot dog" metaphor a public-facing mark, per
// project_brand_public_robot_dog_ratified_2026_06_06.md (supersedes the prior
// "metaphor never disclosed" rule).
//
// No new dependencies: SVG is a <rect> grid, PNG is hand-encoded via node:zlib
// (truecolor+alpha, filter 0), ICO wraps PNGs. All raster scaling is
// nearest-neighbour with ZERO anti-aliasing — hard pixel edges at every size.
//
// Palette: <=16 colours, sourced from the canonical brand tokens in
// lib/brand/tokens.ts (moss #3F5C3F, clay #B65D3A, paper #F7F4ED, ink #1A1A1F,
// plus the file's own in-family derived steps). Sky tints are documented blends
// of those tokens — kept in-family, never invented hues.

import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

// ----------------------------------------------------------------------------
// Palette — every entry traces to lib/brand/tokens.ts or an in-family blend.
// ----------------------------------------------------------------------------
const PAL = {
  // Canonical tokens (spec §4)
  ink: "#1A1A1F",
  inkSoft: "#2E2E33",
  paper: "#F7F4ED",
  paperDeep: "#EDE9DE",
  clay: "#B65D3A",
  clayDeep: "#9A4D2F",
  moss: "#3F5C3F",
  mute: "#726A5E",
  rule: "#E0DAC9",
  // Derived in-family steps (blends of the tokens above; documented per use)
  mossDeep: "#33492F", // moss @ -8% L — horizon shadow band
  mossHi: "#4C6E4A", // moss @ +10% L — grass highlight
  clayHi: "#CF7A50", // clay @ +12% L — lit body face
  metalHi: "#8E867A", // mute @ +14% L — lit metal edge
  // Sky tints (paper<->clay / paper blends — warm at dawn/dusk, neutral noon)
  dawnHi: "#E8CBB2", // paper warmed toward clay (high) — sunrise upper sky
  dawnLo: "#E7A074", // clay lightened — sunrise horizon glow
  noonHi: "#F7F4ED", // = paper
  noonLo: "#EDE9DE", // = paperDeep
  duskHi: "#BE7048", // clay deepened — sunset upper sky
  duskLo: "#E2A267", // clay-amber — sunset horizon band
  sun: "#EBB880", // amber sun disc (clay @ high L, warm)
};

function rgba(hex, a = 255) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    a,
  ];
}

// ----------------------------------------------------------------------------
// Grid primitives. A grid is {w,h,px} where px[y*w+x] is a PAL key or null.
// ----------------------------------------------------------------------------
function makeGrid(w, h, fill = null) {
  return { w, h, px: new Array(w * h).fill(fill) };
}
function set(g, x, y, c) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.px[y * g.w + x] = c;
}
function get(g, x, y) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
  return g.px[y * g.w + x];
}
function rect(g, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, c);
}
function hline(g, x0, x1, y, c) {
  for (let x = x0; x <= x1; x++) set(g, x, y, c);
}
function vline(g, x, y0, y1, c) {
  for (let y = y0; y <= y1; y++) set(g, x, y, c);
}
// Outline every non-null pixel that borders a null/edge cell, in colour c,
// by writing into the null neighbours (1px silhouette outline).
function outline(g, c) {
  const adds = [];
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      if (get(g, x, y) !== null) continue;
      const n =
        get(g, x - 1, y) ||
        get(g, x + 1, y) ||
        get(g, x, y - 1) ||
        get(g, x, y + 1);
      if (n !== null) adds.push([x, y]);
    }
  for (const [x, y] of adds) set(g, x, y, c);
}

// ----------------------------------------------------------------------------
// The robot dog. Drawn facing right from boxes — square head + muzzle (dog),
// one folded ear + one antenna with a moss tip (robot/tech), a visor eye, a
// segmented tail, and metal legs. pose in {sit,stand,walk}.
// Local art box is 30w x 26h; origin passed by caller.
// ----------------------------------------------------------------------------
function drawDog(g, ox, oy, pose) {
  const S = (x, y, c) => set(g, ox + x, oy + y, c);
  const R = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S(x, y, c);
  };

  // --- Body core (boxy torso) ---
  R(4, 13, 18, 21, "clay");
  R(4, 19, 18, 21, "clayDeep"); // underbelly shadow
  R(5, 13, 17, 14, "clayHi"); // lit top edge
  // Robot panel seams + a port on the flank
  vline(g, ox + 10, oy + 14, oy + 20, "clayDeep");
  R(6, 16, 7, 17, "mute"); // metal access port
  S(6, 16, "metalHi");

  // --- Head (square = robotic) ---
  R(14, 4, 24, 13, "clay");
  R(14, 4, 24, 5, "clayHi"); // lit crown
  R(14, 12, 24, 13, "clayDeep"); // jaw shadow
  // Visor eye band (moss) with a paper glint — robotic single eye
  R(16, 7, 21, 8, "moss");
  S(20, 7, "paper");
  S(17, 8, "mossHi");
  // Muzzle / snout (paper) pushing forward
  R(22, 9, 26, 13, "paper");
  R(22, 9, 26, 9, "paperDeep");
  S(26, 10, "ink"); // nose
  S(25, 10, "ink");
  hline(g, ox + 22, ox + 25, oy + 12, "inkSoft"); // mouth line

  // --- Ears: one folded dog ear (left) + one antenna (right) ---
  R(14, 1, 16, 4, "clay"); // folded ear
  S(14, 1, "clayDeep");
  vline(g, ox + 20, oy + 0, oy + 3, "mute"); // antenna stalk
  S(20, -1, "moss"); // antenna tip
  S(20, -2, "mossHi"); // tip highlight (beacon)

  // --- Collar (moss = brand accent) ---
  R(13, 13, 18, 14, "moss");
  S(18, 13, "mossHi");

  // --- Tail: segmented, curling up at the back (robotic/antenna read) ---
  R(1, 9, 4, 12, "mute");
  S(0, 8, "mute");
  S(1, 8, "metalHi");
  S(0, 7, "moss"); // tail-tip beacon

  // --- Legs (metal) — pose dependent ---
  const leg = (x0, x1, y0, y1) => {
    R(x0, y0, x1, y1, "mute");
    R(x0, y1, x1, y1, "ink"); // foot/paw shadow
    S(x0, y0, "metalHi");
  };
  if (pose === "sit") {
    // Folded haunch at back + two front legs planted
    R(2, 15, 8, 22, "clay");
    R(2, 20, 8, 22, "clayDeep");
    R(3, 22, 7, 23, "mute"); // folded back paw forward
    S(3, 22, "metalHi");
    R(3, 23, 7, 23, "ink");
    leg(13, 15, 21, 25);
    leg(16, 18, 21, 25);
  } else if (pose === "stand") {
    leg(5, 7, 21, 25);
    leg(9, 11, 21, 25);
    leg(13, 15, 21, 25);
    leg(16, 18, 21, 25);
  } else {
    // walk — staggered stride
    leg(4, 6, 21, 24); // back, lifted
    leg(8, 10, 21, 25); // back, planted
    leg(13, 15, 21, 25); // front, planted
    leg(17, 19, 21, 23); // front, reaching forward (shorter = lifted)
  }
}

// Bounding offsets so the dog (incl antenna tip at y=-2 and tail at x=0) fits.
const DOG_OX = 2;
const DOG_OY = 4;
const DOG_W = 30; // local 0..27 + margins
const DOG_H = 30; // local -2..25 + margins

// ----------------------------------------------------------------------------
// Backgrounds — sky bands + sun + flat plain. dir in {1,2,3}.
// ----------------------------------------------------------------------------
const DIRECTIONS = {
  1: {
    name: "sunrise-sit",
    pose: "sit",
    skyHi: "dawnHi",
    skyLo: "dawnLo",
    sun: "sun",
    sunX: 7,
    sunY: 9,
    sunR: 3,
    plain: "moss",
    plainHi: "mossHi",
    horizon: "mossDeep",
  },
  2: {
    name: "noon-stand",
    pose: "stand",
    skyHi: "noonHi",
    skyLo: "noonLo",
    sun: "paper",
    sunX: 24,
    sunY: 6,
    sunR: 2,
    plain: "moss",
    plainHi: "mossHi",
    horizon: "mossDeep",
  },
  3: {
    name: "sunset-walk",
    pose: "walk",
    skyHi: "duskHi",
    skyLo: "duskLo",
    sun: "sun",
    sunX: 25,
    sunY: 10,
    sunR: 3,
    plain: "moss",
    plainHi: "mossHi",
    horizon: "mossDeep",
  },
  // --- v2: restrained, brand-mark directions (Conner: "silhouette of the new
  // dog, simplicity of the old line-art mark"). Flat INK silhouette, 3 colours
  // max (ink + paper + one clay accent), single eye-hole, boxy legs, no
  // shading, no sky gradient. Same alert-sit silhouette / antenna / boxy snout
  // as direction-1. Ground is the only variable: none / line / clay strip.
  4: { name: "mark-flat", minimal: true, pose: "sit", ground: "none" },
  5: { name: "mark-horizon", minimal: true, pose: "sit", ground: "line" },
  6: { name: "mark-claystrip", minimal: true, pose: "sit", ground: "clay" },
};

// ----------------------------------------------------------------------------
// Minimal mark — flat ink silhouette of the alert-sitting robot dog. Built from
// per-row spans (outline-first) so the silhouette reads, not a blob. One clay
// pixel (antenna beacon) is the only accent; the eye is a knocked-out hole.
// Local content box ~22w x 23h; clay tip at the very top, feet at the bottom.
// ----------------------------------------------------------------------------
const MIN_SPANS = [
  // [y, xStart, xEnd] — ink fill. Profile alert-sit: head up-right with a snout,
  // a neck PINCH (rows 9-10, narrow) separating head from body, the back
  // sloping up from a rounded rump (left) to the shoulders, ending in a single
  // vertical front leg + folded back paw on the ground.
  [3, 9, 15],            // head crown
  [4, 8, 16],            // head
  [5, 8, 18],            // head + snout
  [6, 8, 19],            // snout jut (muzzle)
  [7, 8, 17],            // jaw
  [8, 9, 15],            // jaw underside
  [9, 10, 14],           // neck pinch
  [10, 10, 14],          // neck pinch
  [11, 8, 16],           // shoulders
  [12, 6, 16],           // chest widening
  [13, 5, 16],           // back sloping out to the left
  [14, 4, 16],
  [15, 3, 16],
  [16, 3, 16],
  [17, 3, 16],
  [18, 3, 15],           // lower body, rump rounding
];
const MIN_W = 22;
const MIN_H = 24;
const MIN_OX = 1;
const MIN_OY = 1;

function drawDogMinimal(g, ox, oy) {
  const ink = (x, y) => set(g, ox + x, oy + y, "ink");
  for (const [y, x0, x1] of MIN_SPANS) for (let x = x0; x <= x1; x++) ink(x, y);
  // Ear (one upright, back of head) + antenna with clay beacon (the one accent)
  ink(9, 1); ink(9, 2); ink(10, 2);     // ear
  ink(14, 1); ink(14, 2);               // antenna stalk
  set(g, ox + 14, oy + 0, "clay");      // antenna beacon tip
  // Tail — short stub curling up off the back-left
  ink(1, 14); ink(2, 14); ink(0, 13); ink(1, 13);
  // Sitting stance: the rear is a folded HAUNCH resting flat on the ground
  // (solid wedge, left) and the front is a single vertical LEG (right). A
  // 1-column gap separates them so the sit reads. Boxy, no shading.
  for (let y = 19; y <= 22; y++) {
    for (let x = 3; x <= 10; x++) ink(x, y);  // seated haunch on the ground
    for (let x = 12; x <= 15; x++) ink(x, y); // front leg pillar
  }
  // Round the haunch's lower-back corner so the seated rear reads as a curve.
  set(g, ox + 3, oy + 22, null);
  // Eye — single knocked-out hole in the head (one calm, alert eye)
  set(g, ox + 15, oy + 5, null);
  // Soften the rump's top-back corner so it isn't a hard rectangle
  set(g, ox + 3, oy + 13, null);
}

// Minimal transparent sprite. withGround adds the variant's ground under it.
function buildMinimalDog(dir, withGround = false) {
  const d = DIRECTIONS[dir];
  const w = MIN_W;
  const h = MIN_H + (withGround && d.ground !== "none" ? 3 : 1);
  const g = makeGrid(w, h);
  drawDogMinimal(g, MIN_OX, MIN_OY);
  if (withGround && d.ground !== "none") {
    const gy = MIN_OY + 22 + 2; // just below the feet
    hline(g, 0, w - 1, gy, "ink");
    if (d.ground === "clay") hline(g, 0, w - 1, gy + 1, "clay");
  }
  return g;
}

// Minimal opaque square scene (paper field, ink dog, variant ground).
function buildMinimalScene(dir, size = 36) {
  const d = DIRECTIONS[dir];
  const g = makeGrid(size, size, "paper");
  const dog = makeGrid(MIN_W, MIN_H, null);
  drawDogMinimal(dog, MIN_OX, MIN_OY);
  const ox = Math.round((size - MIN_W) / 2);
  // Feet sit ~58% down so there's headroom; horizon (if any) aligns to feet.
  const feetY = Math.round(size * 0.62);
  const oy = feetY - 22; // local feet row 22
  if (d.ground !== "none") {
    hline(g, 0, size - 1, feetY + 2, "ink");
    if (d.ground === "clay") hline(g, 0, size - 1, feetY + 3, "clay");
  }
  blit(g, dog, ox, oy);
  return g;
}

// Full opaque square scene (dog on a plain). size = grid edge in art-pixels.
function buildScene(dir, size = 36) {
  if (DIRECTIONS[dir].minimal) return buildMinimalScene(dir, size);
  const g = makeGrid(size, size);
  const d = DIRECTIONS[dir];
  const horizonY = Math.round(size * 0.66);
  // Sky: two bands, lighter low near the horizon for an atmospheric glow.
  for (let y = 0; y < horizonY; y++) {
    const c = y < horizonY * 0.55 ? d.skyHi : d.skyLo;
    hline(g, 0, size - 1, y, c);
  }
  // Sun disc (filled circle, blocky).
  const sx = Math.round((d.sunX / 32) * size);
  const sy = Math.round((d.sunY / 32) * size);
  for (let y = -d.sunR; y <= d.sunR; y++)
    for (let x = -d.sunR; x <= d.sunR; x++)
      if (x * x + y * y <= d.sunR * d.sunR + 1) set(g, sx + x, sy + y, d.sun);
  // Plain: flat ground, a 1px darker horizon rule, scattered grass highlight.
  rect(g, 0, horizonY, size - 1, size - 1, d.plain);
  hline(g, 0, size - 1, horizonY, d.horizon);
  hline(g, 0, size - 1, horizonY + 1, d.plainHi);
  for (let x = 1; x < size; x += 5) set(g, x, horizonY + 3, d.plainHi);
  for (let x = 3; x < size; x += 7) set(g, x, size - 2, d.horizon);
  // Dog — centred horizontally, feet on the plain. Local feet ~y25.
  const dogOx = Math.round((size - DOG_W) / 2) + 1;
  const dogOy = horizonY - 25; // local foot row 25 lands on horizon
  // soft contact shadow
  hline(g, dogOx + 4, dogOx + 20, horizonY + 1, d.horizon);
  drawDog(g, dogOx + DOG_OX, dogOy + DOG_OY, d.pose);
  return g;
}

// Transparent dog sprite alone (for adaptive fg / notification / mark on plain).
function buildDog(dir, withPlain = false) {
  if (DIRECTIONS[dir].minimal) return buildMinimalDog(dir, withPlain);
  const w = DOG_W + 4;
  const h = DOG_H + (withPlain ? 5 : 2);
  const g = makeGrid(w, h);
  const d = DIRECTIONS[dir];
  const footY = DOG_OY + 25;
  if (withPlain) {
    const py = footY + 1;
    rect(g, 0, py, w - 1, py + 2, "moss");
    hline(g, 0, w - 1, py, "mossDeep");
    for (let x = 1; x < w; x += 5) set(g, x, py + 1, "mossHi");
  }
  drawDog(g, DOG_OX, DOG_OY, d.pose);
  return g;
}

// Monochrome silhouette (single colour) of the dog — for notification icons.
function buildSilhouette(dir, color) {
  const src = buildDog(dir, false);
  const g = makeGrid(src.w, src.h);
  for (let i = 0; i < src.px.length; i++)
    if (src.px[i] !== null) g.px[i] = color;
  return g;
}

// ----------------------------------------------------------------------------
// Tiny 5x7 pixel font — only the glyphs in "agentplain" (a g e n t p l i).
// Used for the pixel wordmark on splash + og-image. 1 = lit.
// ----------------------------------------------------------------------------
const FONT = {
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  n: ["00000", "00000", "10110", "11001", "10001", "10001", "10001"],
  t: ["00000", "00100", "11111", "00100", "00100", "00101", "00010"],
  p: ["00000", "00000", "11110", "10001", "11110", "10000", "10000"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
function drawText(g, ox, oy, text, color, scale = 1) {
  let cx = ox;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (!glyph) {
      cx += 6 * scale;
      continue;
    }
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 5; c++)
        if (glyph[r][c] === "1")
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++)
              set(g, cx + c * scale + sx, oy + r * scale + sy, color);
    cx += 6 * scale;
  }
  return cx - scale; // right edge
}
function textWidth(text, scale = 1) {
  return text.length * 6 * scale - scale;
}

// ----------------------------------------------------------------------------
// Raster: grid -> RGBA buffer, nearest-neighbour scale, PNG/ICO encoders.
// ----------------------------------------------------------------------------
function gridToRGBA(g, bg = null) {
  const buf = Buffer.alloc(g.w * g.h * 4);
  const bgc = bg ? rgba(PAL[bg]) : [0, 0, 0, 0];
  for (let i = 0; i < g.w * g.h; i++) {
    const key = g.px[i];
    const [r, gr, b, a] = key ? rgba(PAL[key]) : bgc;
    buf[i * 4] = r;
    buf[i * 4 + 1] = gr;
    buf[i * 4 + 2] = b;
    buf[i * 4 + 3] = a;
  }
  return { buf, w: g.w, h: g.h };
}
// Nearest-neighbour resize, zero anti-aliasing. Handles non-integer ratios
// (pixels become 1 unit wider/narrower; edges stay hard — no blending).
function scaleNN(img, destW, destH) {
  const out = Buffer.alloc(destW * destH * 4);
  for (let y = 0; y < destH; y++) {
    const sy = Math.min(img.h - 1, Math.floor((y * img.h) / destH));
    for (let x = 0; x < destW; x++) {
      const sx = Math.min(img.w - 1, Math.floor((x * img.w) / destW));
      const si = (sy * img.w + sx) * 4;
      const di = (y * destW + x) * 4;
      out[di] = img.buf[si];
      out[di + 1] = img.buf[si + 1];
      out[di + 2] = img.buf[si + 2];
      out[di + 3] = img.buf[si + 3];
    }
  }
  return { buf: out, w: destW, h: destH };
}
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(img) {
  const { buf, w, h } = img;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // raw scanlines with filter byte 0
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    buf.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
// ICO wrapping PNG entries (Vista+ PNG-in-ICO is universally supported).
function encodeICO(pngs) {
  // pngs: [{size, buf}]
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const p of pngs) {
    const e = Buffer.alloc(16);
    e[0] = p.size >= 256 ? 0 : p.size;
    e[1] = p.size >= 256 ? 0 : p.size;
    e[2] = 0;
    e[3] = 0;
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(p.buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += p.buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

// ----------------------------------------------------------------------------
// SVG: one <rect> per horizontal run of same-colour pixels. Crisp, tiny.
// ----------------------------------------------------------------------------
function gridToSVG(g, { px = 1, bg = null, pad = 0 } = {}) {
  const W = (g.w + pad * 2) * px;
  const H = (g.h + pad * 2) * px;
  let body = "";
  if (bg) body += `<rect width="${W}" height="${H}" fill="${PAL[bg]}"/>`;
  for (let y = 0; y < g.h; y++) {
    let x = 0;
    while (x < g.w) {
      const c = get(g, x, y);
      if (c === null) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < g.w && get(g, x + run, y) === c) run++;
      const px0 = (x + pad) * px;
      const py0 = (y + pad) * px;
      body += `<rect x="${px0}" y="${py0}" width="${run * px}" height="${px}" fill="${PAL[c]}"/>`;
      x += run;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${body}</svg>`;
}

// Horizontal lockup: pixel mark (dog on a sliver of plain) + serif wordmark.
function lockupHorizontal(dir, { inverted = false } = {}) {
  const mark = buildDog(dir, true);
  const px = 6;
  const markW = mark.w * px;
  const markH = mark.h * px;
  const gap = 28;
  const fontSize = Math.round(markH * 0.42);
  const wordmarkW = 360;
  const W = markW + gap + wordmarkW;
  const H = markH;
  const fg = inverted ? PAL.paper : PAL.ink;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`;
  if (inverted) svg += `<rect width="${W}" height="${H}" fill="${PAL.ink}"/>`;
  // mark
  for (let y = 0; y < mark.h; y++) {
    let x = 0;
    while (x < mark.w) {
      const c = get(mark, x, y);
      if (c === null) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < mark.w && get(mark, x + run, y) === c) run++;
      svg += `<rect x="${x * px}" y="${y * px}" width="${run * px}" height="${px}" fill="${PAL[c]}"/>`;
      x += run;
    }
  }
  // wordmark (serif, matches public/brand/wordmark-light.svg)
  svg += `<text x="${markW + gap}" y="${H / 2}" font-family="'Source Serif 4', Georgia, serif" font-size="${fontSize}" font-weight="500" fill="${fg}" text-anchor="start" dominant-baseline="central" letter-spacing="-1">agentplain</text>`;
  svg += `</svg>`;
  return svg;
}

function lockupStacked(dir) {
  const mark = buildScene(dir, 36);
  const px = 6;
  const markW = mark.w * px;
  const wordY = mark.h * px + 18;
  const fontSize = 52;
  const W = markW;
  const H = wordY + fontSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">`;
  for (let y = 0; y < mark.h; y++) {
    let x = 0;
    while (x < mark.w) {
      const c = get(mark, x, y);
      if (c === null) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < mark.w && get(mark, x + run, y) === c) run++;
      svg += `<rect x="${x * px}" y="${y * px}" width="${run * px}" height="${px}" fill="${PAL[c]}"/>`;
      x += run;
    }
  }
  svg += `<text x="${W / 2}" y="${wordY + fontSize / 2}" font-family="'Source Serif 4', Georgia, serif" font-size="${fontSize}" font-weight="500" fill="${PAL.ink}" text-anchor="middle" dominant-baseline="central" letter-spacing="-1">agentplain</text>`;
  svg += `</svg>`;
  return svg;
}

// ----------------------------------------------------------------------------
// Composite raster scenes: splash (portrait) + og-image (landscape).
// ----------------------------------------------------------------------------
function buildSplash(dir, mode /* 'light'|'dark' */) {
  // Render at a manageable art resolution then NN-scale to 2048x2732.
  const W = 256;
  const H = 341; // ~2048:2732 ratio (0.749)
  const g = makeGrid(W, H, mode === "dark" ? "ink" : "paper");
  // centred scene
  const scene = buildScene(dir, 96);
  const sx = Math.round((W - scene.w) / 2);
  const sy = Math.round(H * 0.30);
  blit(g, scene, sx, sy);
  // pixel wordmark beneath
  const word = "agentplain";
  const scale = 3;
  const wW = textWidth(word, scale);
  drawText(
    g,
    Math.round((W - wW) / 2),
    sy + scene.h + 28,
    word,
    mode === "dark" ? "paper" : "ink",
    scale,
  );
  const img = scaleNN(gridToRGBA(g), 2048, 2732);
  return encodePNG(img);
}

function buildOG(dir) {
  // 1200x630 -> art grid 240x126 (x10). Warm sky scene left, wordmark right.
  const W = 240;
  const H = 126;
  const g = makeGrid(W, H, "paper");
  // left: full scene tile
  const scene = buildScene(dir, 96);
  blit(g, scene, 8, Math.round((H - scene.h) / 2));
  // right: pixel wordmark + a clay rule (sized to fit the right column)
  const word = "agentplain";
  const scale = 2;
  const wW = textWidth(word, scale);
  const tx = 8 + scene.w + Math.round((W - (8 + scene.w) - wW) / 2);
  const ty = Math.round((H - 14) / 2) - 6;
  drawText(g, tx, ty, word, "ink", scale);
  rect(g, tx, ty + 18, tx + wW, ty + 19, "clay");
  // Bottom ground accent strip echoing the plain. Full directions use the moss
  // plain; minimal (3-colour) directions stay ink+paper+clay only — no moss.
  if (DIRECTIONS[dir].minimal) {
    rect(g, 0, H - 3, W - 1, H - 1, "clay");
    hline(g, 0, W - 1, H - 3, "ink");
  } else {
    rect(g, 0, H - 4, W - 1, H - 1, "moss");
    hline(g, 0, W - 1, H - 4, "mossDeep");
  }
  const img = scaleNN(gridToRGBA(g), 1200, 630);
  return encodePNG(img);
}

// blit src grid onto dst at (ox,oy), skipping transparent src pixels.
function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const c = get(src, x, y);
      if (c !== null) set(dst, ox + x, oy + y, c);
    }
}

// ----------------------------------------------------------------------------
// Adaptive Android icon: separate foreground (dog) + background (sky) layers.
// ----------------------------------------------------------------------------
function buildAdaptiveBg(dir, sizePx) {
  const d = DIRECTIONS[dir];
  const g = makeGrid(48, 48);
  if (d.minimal) {
    // Flat paper field; a clay strip at the base only for the clay-strip variant.
    rect(g, 0, 0, 47, 47, "paper");
    if (d.ground === "clay") rect(g, 0, 44, 47, 47, "clay");
    return encodePNG(scaleNN(gridToRGBA(g), sizePx, sizePx));
  }
  const horizonY = 32;
  for (let y = 0; y < horizonY; y++)
    hline(g, 0, 47, y, y < horizonY * 0.55 ? d.skyHi : d.skyLo);
  rect(g, 0, horizonY, 47, 47, d.plain);
  hline(g, 0, 47, horizonY, d.horizon);
  return encodePNG(scaleNN(gridToRGBA(g), sizePx, sizePx));
}
function buildAdaptiveFg(dir, sizePx) {
  // dog centred in a 48x48 safe zone (Android masks ~33% margins)
  const dog = buildDog(dir, false);
  const g = makeGrid(48, 48);
  blit(g, dog, Math.round((48 - dog.w) / 2), Math.round((48 - dog.h) / 2) + 2);
  return encodePNG(scaleNN(gridToRGBA(g), sizePx, sizePx));
}

// ----------------------------------------------------------------------------
// Emit everything.
// ----------------------------------------------------------------------------
const ROOT = process.cwd();
const MOBILE = path.join(ROOT, "apps", "mobile", "assets", "brand");
const WEB = path.join(ROOT, "public", "brand");

function w(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function emitDirection(dir) {
  const tag = `direction-${dir}`;
  const mDir = path.join(MOBILE, tag);
  const wDir = path.join(WEB, tag);

  // --- Mobile icon set ---
  const scene = buildScene(dir, 36);
  const sceneImg = gridToRGBA(scene);
  for (const sz of [1024, 512, 256, 180, 120]) {
    w(path.join(mDir, `icon-${sz}.png`), encodePNG(scaleNN(sceneImg, sz, sz)));
  }
  // Android adaptive (foreground + background layers) + a composed 1024
  w(path.join(mDir, "icon-1024-android-foreground.png"), buildAdaptiveFg(dir, 1024));
  w(path.join(mDir, "icon-1024-android-background.png"), buildAdaptiveBg(dir, 1024));
  // splash light/dark
  w(path.join(mDir, "splash-light.png"), buildSplash(dir, "light"));
  w(path.join(mDir, "splash-dark.png"), buildSplash(dir, "dark"));
  // notification monochrome silhouette
  w(
    path.join(mDir, "notification-icon.png"),
    encodePNG(scaleNN(gridToRGBA(buildSilhouette(dir, "paper")), 96, 96)),
  );

  // --- Web logo set ---
  w(path.join(wDir, "logo-horizontal.svg"), lockupHorizontal(dir));
  w(path.join(wDir, "logo-horizontal-inverted.svg"), lockupHorizontal(dir, { inverted: true }));
  w(path.join(wDir, "logo-stacked.svg"), lockupStacked(dir));
  w(path.join(wDir, "logo-icon.svg"), gridToSVG(buildDog(dir, true), { px: 8, pad: 1 }));
  w(
    path.join(wDir, "logo-monochrome.svg"),
    gridToSVG(buildSilhouette(dir, "ink"), { px: 8, pad: 1 }),
  );
  // favicons
  const dogImg = gridToRGBA(buildDog(dir, false));
  const ico16 = encodePNG(scaleNN(dogImg, 16, 16));
  const ico32 = encodePNG(scaleNN(dogImg, 32, 32));
  const ico48 = encodePNG(scaleNN(dogImg, 48, 48));
  w(path.join(wDir, "favicon-16.png"), ico16);
  w(path.join(wDir, "favicon-32.png"), ico32);
  w(
    path.join(wDir, "favicon.ico"),
    encodeICO([
      { size: 16, buf: ico16 },
      { size: 32, buf: ico32 },
      { size: 48, buf: ico48 },
    ]),
  );
  // apple-touch-icon (opaque scene, 180px) — served from /public for <link rel="apple-touch-icon">
  w(path.join(wDir, "apple-touch-icon.png"), encodePNG(scaleNN(sceneImg, 180, 180)));
  // og-image
  w(path.join(wDir, "og-image.png"), buildOG(dir));

  return { tag, mDir, wDir };
}

const built = [1, 2, 3, 4, 5, 6].map(emitDirection);
console.log("Generated 8-bit robot-dog brand directions:");
for (const b of built) console.log(`  ${b.tag}\n    mobile: ${b.mDir}\n    web:    ${b.wDir}`);
