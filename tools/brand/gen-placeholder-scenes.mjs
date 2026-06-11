// Final-quality prairie/heritage scene motif generator for all 33 illustration slots.
//
// Each slot gets a clean editorial prairie motif in brand tokens — varied
// composition per slot type (marketing hero, auth, empty-state, vertical).
// No text labels, no blocky dog silhouettes, no placeholder callouts.
// These are production-ready SVG scenes that render on pricing, vertical pages,
// homepage, auth, legal, and in-app empty states via components/ui/ap/PlainoScene.tsx.
//
// Dog character slots (auth, empty-states, inquiry-received, about-dogfood) are
// wired to real PNG crops in PlainoScene.tsx — these motif SVGs serve the
// marketing/structural slots only.
//
// Output: public/brand/plaino-system/motifs/<slug>.svg
// Run:    node tools/brand/gen-placeholder-scenes.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PALETTE = {
  paper: "#F7F4ED",
  ink: "#1A1A1F",
  clay: "#B65D3A",
  moss: "#3F5C3F",
  mute: "#726A5E",
  paperDeep: "#EDE9DE",
  rule: "#E0DAC9",
};

// All 33 illustration slots from the audit.
// Each has a motif variant that shapes the prairie composition.
const SLOTS = [
  // ── Marketing heroes / scenes ───────────────────────────────────────────
  { slug: "home-crew-scene",     w: 1200, h: 900,  motif: "wide-plain",    aria: "wide prairie horizon with rolling plain" },
  { slug: "home-knowledge-scene",w: 1200, h: 900,  motif: "granary",       aria: "granary and plain with windmill silhouette" },
  { slug: "home-future-scene",   w: 2000, h: 1000, motif: "open-sky",      aria: "open sky above a broad plain horizon" },
  { slug: "pricing-hero",        w: 1000, h: 1000, motif: "farmstead",     aria: "farmstead roofline on a prairie plain" },
  { slug: "custom-hero",         w: 1600, h: 1000, motif: "ridge",         aria: "low ridge and plain with clay roof detail" },
  { slug: "about-hero",          w: 1800, h: 1100, motif: "town-horizon",  aria: "working town silhouette on the plain" },
  { slug: "about-dogfood",       w: 1200, h: 900,  motif: "fields",        aria: "open fields with distant moss tree line" },
  { slug: "verticals-hero",      w: 2000, h: 1000, motif: "panorama",      aria: "panoramic plain with layered horizon bands" },
  { slug: "legal-motif",         w: 600,  h: 600,  motif: "gate",          aria: "simple gate on a plain with horizon line" },
  { slug: "inquiry-received",    w: 1000, h: 1000, motif: "path",          aria: "path leading to a clay roof on the plain" },

  // ── Auth welcome ─────────────────────────────────────────────────────────
  { slug: "auth-signin",   w: 900, h: 900, motif: "morning",  aria: "morning light on a quiet plain" },
  { slug: "auth-signup",   w: 900, h: 900, motif: "arrival",  aria: "arrival scene with plain and open gate" },
  { slug: "auth-checkout", w: 1000, h: 1000, motif: "settled", aria: "settled homestead plain at dusk" },

  // ── In-app empty-state scenes ─────────────────────────────────────────────
  { slug: "empty-talk",      w: 1200, h: 1200, motif: "clearing",  aria: "clearing in the plain with soft horizon" },
  { slug: "empty-approvals", w: 1000, h: 1000, motif: "restful",   aria: "restful plain under a calm sky" },
  { slug: "empty-activity",  w: 1000, h: 1000, motif: "watchpost", aria: "watchpost on the plain horizon" },
  { slug: "empty-sentinel",  w: 1000, h: 1000, motif: "boundary",  aria: "boundary line across a prairie plain" },

  // ── Per-vertical heroes ───────────────────────────────────────────────────
  { slug: "vertical-real-estate",        w: 1600, h: 1000, motif: "farmstead",   aria: "farmstead roofline on a prairie plain" },
  { slug: "vertical-mortgage",           w: 1600, h: 1000, motif: "wide-plain",  aria: "wide prairie horizon with rolling plain" },
  { slug: "vertical-insurance",          w: 1600, h: 1000, motif: "boundary",    aria: "boundary line across a prairie plain" },
  { slug: "vertical-property-management",w: 1600, h: 1000, motif: "fields",      aria: "open fields with distant moss tree line" },
  { slug: "vertical-title-escrow",       w: 1600, h: 1000, motif: "gate",        aria: "simple gate on a plain with horizon line" },
  { slug: "vertical-recruiting",         w: 1600, h: 1000, motif: "path",        aria: "path leading to a clay roof on the plain" },
  { slug: "vertical-home-services",      w: 1600, h: 1000, motif: "farmstead",   aria: "farmstead roofline on a prairie plain" },
  { slug: "vertical-cpa",               w: 1600, h: 1000, motif: "granary",     aria: "granary and plain with windmill silhouette" },
  { slug: "vertical-law",               w: 1600, h: 1000, motif: "ridge",       aria: "low ridge and plain with clay roof detail" },
  { slug: "vertical-ria",               w: 1600, h: 1000, motif: "open-sky",    aria: "open sky above a broad plain horizon" },
  { slug: "vertical-general",           w: 1600, h: 1000, motif: "panorama",    aria: "panoramic plain with layered horizon bands" },
];

// Per-motif composition functions. Each returns SVG interior elements only.
// All use brand tokens. Square corners, hairline rules, no shadows, no blue, no gradients.
function motifElements(motif, w, h) {
  const hz = Math.round(h * 0.60);   // main horizon y
  const hz2 = Math.round(h * 0.68);  // secondary land band y
  const sw = 1.5;                     // standard stroke-width (hairline)

  const elems = [
    // Paper background (always)
    `<rect width="${w}" height="${h}" fill="${PALETTE.paper}"/>`,
  ];

  switch (motif) {
    case "wide-plain":
      // Wide rolling plain: two land bands, horizon rule, one clay roof far-left
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<rect x="0" y="${hz2}" width="${w}" height="${h - hz2}" fill="${PALETTE.rule}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.45"/>`,
        `<line x1="0" y1="${hz2}" x2="${w}" y2="${hz2}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.2"/>`,
        // Distant clay roof far-left
        `<path d="M${r(w*0.07)} ${hz} l${r(w*0.05)} 0 l-${r(w*0.025)} -${r(h*0.05)} z" fill="${PALETTE.clay}" opacity="0.75"/>`,
        `<rect x="${r(w*0.07)}" y="${hz}" width="${r(w*0.05)}" height="${r(h*0.04)}" fill="${PALETTE.mute}" opacity="0.25"/>`,
      );
      break;

    case "granary":
      // Granary + windmill silhouette center-right
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.4"/>`,
        // Granary body
        `<rect x="${r(w*0.58)}" y="${r(hz - h*0.18)}" width="${r(w*0.08)}" height="${r(h*0.18)}" fill="${PALETTE.mute}" opacity="0.35"/>`,
        // Granary roof
        `<path d="M${r(w*0.57)} ${r(hz - h*0.18)} l${r(w*0.05)} -${r(h*0.06)} l${r(w*0.05)} ${r(h*0.06)} z" fill="${PALETTE.clay}" opacity="0.80"/>`,
        // Windmill pole
        `<line x1="${r(w*0.72)}" y1="${hz}" x2="${r(w*0.72)}" y2="${r(hz - h*0.22)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.5"/>`,
        // Windmill blades (4 lines from center)
        `<line x1="${r(w*0.72)}" y1="${r(hz - h*0.22)}" x2="${r(w*0.72 + w*0.025)}" y2="${r(hz - h*0.22 - h*0.06)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.45"/>`,
        `<line x1="${r(w*0.72)}" y1="${r(hz - h*0.22)}" x2="${r(w*0.72 - w*0.025)}" y2="${r(hz - h*0.22 + h*0.06)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.45"/>`,
        `<line x1="${r(w*0.72)}" y1="${r(hz - h*0.22)}" x2="${r(w*0.72 - w*0.02)}" y2="${r(hz - h*0.22 - h*0.07)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.45"/>`,
        `<line x1="${r(w*0.72)}" y1="${r(hz - h*0.22)}" x2="${r(w*0.72 + w*0.02)}" y2="${r(hz - h*0.22 + h*0.07)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.45"/>`,
        // Moss tree line far-right
        `<rect x="${r(w*0.88)}" y="${r(hz - h*0.12)}" width="${r(w*0.10)}" height="${r(h*0.12)}" fill="${PALETTE.moss}" opacity="0.22"/>`,
        `<line x1="0" y1="${hz2}" x2="${w}" y2="${hz2}" stroke="${PALETTE.rule}" stroke-width="${sw}" opacity="0.6"/>`,
      );
      break;

    case "open-sky":
      // Vast sky: just a low horizon band, three thin strata, calm rule
      elems.push(
        `<rect x="0" y="${r(h*0.72)}" width="${w}" height="${r(h*0.28)}" fill="${PALETTE.paperDeep}"/>`,
        `<rect x="0" y="${r(h*0.80)}" width="${w}" height="${r(h*0.20)}" fill="${PALETTE.rule}" opacity="0.55"/>`,
        `<line x1="0" y1="${r(h*0.72)}" x2="${w}" y2="${r(h*0.72)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.35"/>`,
        `<line x1="0" y1="${r(h*0.80)}" x2="${w}" y2="${r(h*0.80)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.20"/>`,
        // Tiny clay roof silhouette at left quarter
        `<path d="M${r(w*0.22)} ${r(h*0.72)} l${r(w*0.04)} 0 l-${r(w*0.02)} -${r(h*0.04)} z" fill="${PALETTE.clay}" opacity="0.65"/>`,
      );
      break;

    case "farmstead":
      // Farmstead: one prominent clay roof center, surrounding outbuildings
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.45"/>`,
        // Main farmhouse wall
        `<rect x="${r(w*0.44)}" y="${r(hz - h*0.20)}" width="${r(w*0.12)}" height="${r(h*0.20)}" fill="${PALETTE.mute}" opacity="0.28"/>`,
        // Main roof (clay)
        `<path d="M${r(w*0.42)} ${r(hz - h*0.20)} l${r(w*0.08)} -${r(h*0.08)} l${r(w*0.08)} ${r(h*0.08)} z" fill="${PALETTE.clay}" opacity="0.82"/>`,
        // Outbuilding left
        `<rect x="${r(w*0.30)}" y="${r(hz - h*0.10)}" width="${r(w*0.07)}" height="${r(h*0.10)}" fill="${PALETTE.mute}" opacity="0.18"/>`,
        `<path d="M${r(w*0.29)} ${r(hz - h*0.10)} l${r(w*0.045)} -${r(h*0.04)} l${r(w*0.045)} ${r(h*0.04)} z" fill="${PALETTE.clay}" opacity="0.55"/>`,
        // Outbuilding right
        `<rect x="${r(w*0.63)}" y="${r(hz - h*0.08)}" width="${r(w*0.06)}" height="${r(h*0.08)}" fill="${PALETTE.mute}" opacity="0.18"/>`,
        `<path d="M${r(w*0.62)} ${r(hz - h*0.08)} l${r(w*0.04)} -${r(h*0.035)} l${r(w*0.04)} ${r(h*0.035)} z" fill="${PALETTE.clay}" opacity="0.50"/>`,
        // Moss ground cover
        `<rect x="0" y="${r(hz + h*0.06)}" width="${w}" height="${r(h*0.04)}" fill="${PALETTE.moss}" opacity="0.14"/>`,
      );
      break;

    case "ridge":
      // Low ridge curve with clay roof detail
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.4"/>`,
        // Ridge curve (low hill)
        `<path d="M0 ${hz} Q${r(w*0.40)} ${r(hz - h*0.12)} ${r(w*0.65)} ${hz} L${w} ${hz}" fill="${PALETTE.rule}" opacity="0.5" stroke="none"/>`,
        `<path d="M0 ${hz} Q${r(w*0.40)} ${r(hz - h*0.12)} ${r(w*0.65)} ${hz}" fill="none" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.3"/>`,
        // Clay roof on the ridge
        `<path d="M${r(w*0.35)} ${r(hz - h*0.12)} l${r(w*0.035)} -${r(h*0.055)} l${r(w*0.035)} ${r(h*0.055)} z" fill="${PALETTE.clay}" opacity="0.80"/>`,
        `<rect x="${r(w*0.35)}" y="${r(hz - h*0.12)}" width="${r(w*0.07)}" height="${r(h*0.05)}" fill="${PALETTE.mute}" opacity="0.22"/>`,
      );
      break;

    case "town-horizon":
      // Working-town silhouette: stepped rooflines
      elems.push(
        `<rect x="0" y="${r(h*0.55)}" width="${w}" height="${r(h*0.45)}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${r(h*0.55)}" x2="${w}" y2="${r(h*0.55)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.4"/>`,
        // Multiple rooflines across center
        ...buildTownRooflines(w, h),
        `<rect x="0" y="${r(h*0.70)}" width="${w}" height="${r(h*0.30)}" fill="${PALETTE.moss}" opacity="0.10"/>`,
      );
      break;

    case "fields":
      // Open fields: three horizontal bands at different luma, distant tree line
      elems.push(
        `<rect x="0" y="${r(h*0.58)}" width="${w}" height="${r(h*0.42)}" fill="${PALETTE.paperDeep}"/>`,
        `<rect x="0" y="${r(h*0.68)}" width="${w}" height="${r(h*0.32)}" fill="${PALETTE.rule}" opacity="0.6"/>`,
        `<line x1="0" y1="${r(h*0.58)}" x2="${w}" y2="${r(h*0.58)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.38"/>`,
        `<line x1="0" y1="${r(h*0.68)}" x2="${w}" y2="${r(h*0.68)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.20"/>`,
        // Moss tree line right-half
        `<rect x="${r(w*0.60)}" y="${r(h*0.48)}" width="${r(w*0.38)}" height="${r(h*0.10)}" fill="${PALETTE.moss}" opacity="0.18"/>`,
        `<line x1="${r(w*0.60)}" y1="${r(h*0.48)}" x2="${r(w*0.98)}" y2="${r(h*0.48)}" stroke="${PALETTE.moss}" stroke-width="${sw}" opacity="0.40"/>`,
        // Lone clay roof far-left
        `<path d="M${r(w*0.10)} ${r(h*0.58)} l${r(w*0.03)} 0 l-${r(w*0.015)} -${r(h*0.04)} z" fill="${PALETTE.clay}" opacity="0.70"/>`,
      );
      break;

    case "panorama":
      // Panoramic plain: four thin horizon strata across full width
      elems.push(
        `<rect x="0" y="${r(h*0.54)}" width="${w}" height="${r(h*0.46)}" fill="${PALETTE.paperDeep}"/>`,
        `<rect x="0" y="${r(h*0.62)}" width="${w}" height="${r(h*0.38)}" fill="${PALETTE.rule}" opacity="0.50"/>`,
        `<rect x="0" y="${r(h*0.72)}" width="${w}" height="${r(h*0.28)}" fill="${PALETTE.moss}" opacity="0.10"/>`,
        `<line x1="0" y1="${r(h*0.54)}" x2="${w}" y2="${r(h*0.54)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.38"/>`,
        `<line x1="0" y1="${r(h*0.62)}" x2="${w}" y2="${r(h*0.62)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.22"/>`,
        `<line x1="0" y1="${r(h*0.72)}" x2="${w}" y2="${r(h*0.72)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.15"/>`,
        // Spaced clay roofs at thirds
        `<path d="M${r(w*0.18)} ${r(h*0.54)} l${r(w*0.025)} -${r(h*0.04)} l${r(w*0.025)} ${r(h*0.04)} z" fill="${PALETTE.clay}" opacity="0.70"/>`,
        `<path d="M${r(w*0.49)} ${r(h*0.54)} l${r(w*0.025)} -${r(h*0.04)} l${r(w*0.025)} ${r(h*0.04)} z" fill="${PALETTE.clay}" opacity="0.60"/>`,
        `<path d="M${r(w*0.80)} ${r(h*0.54)} l${r(w*0.025)} -${r(h*0.04)} l${r(w*0.025)} ${r(h*0.04)} z" fill="${PALETTE.clay}" opacity="0.55"/>`,
      );
      break;

    case "gate":
      // Simple gate: two posts and a crossbar, horizon
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.40"/>`,
        // Gate posts
        `<rect x="${r(w*0.38)}" y="${r(hz - h*0.20)}" width="${r(w*0.015)}" height="${r(h*0.20)}" fill="${PALETTE.ink}" opacity="0.55"/>`,
        `<rect x="${r(w*0.60)}" y="${r(hz - h*0.20)}" width="${r(w*0.015)}" height="${r(h*0.20)}" fill="${PALETTE.ink}" opacity="0.55"/>`,
        // Gate rails (2)
        `<rect x="${r(w*0.38)}" y="${r(hz - h*0.14)}" width="${r(w*0.235)}" height="${r(h*0.018)}" fill="${PALETTE.ink}" opacity="0.40"/>`,
        `<rect x="${r(w*0.38)}" y="${r(hz - h*0.07)}" width="${r(w*0.235)}" height="${r(h*0.018)}" fill="${PALETTE.ink}" opacity="0.30"/>`,
        // Clay cap on post tops
        `<rect x="${r(w*0.378)}" y="${r(hz - h*0.22)}" width="${r(w*0.02)}" height="${r(h*0.025)}" fill="${PALETTE.clay}" opacity="0.75"/>`,
        `<rect x="${r(w*0.598)}" y="${r(hz - h*0.22)}" width="${r(w*0.02)}" height="${r(h*0.025)}" fill="${PALETTE.clay}" opacity="0.75"/>`,
        // Distant plain continues
        `<rect x="0" y="${r(hz + h*0.08)}" width="${w}" height="${r(h*0.03)}" fill="${PALETTE.moss}" opacity="0.12"/>`,
      );
      break;

    case "path":
      // Path converging to horizon, clay roof at vanishing point
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.40"/>`,
        // Path (two converging lines)
        `<path d="M${r(w*0.30)} ${h} L${r(w*0.48)} ${hz}" stroke="${PALETTE.mute}" stroke-width="${sw}" opacity="0.45" fill="none"/>`,
        `<path d="M${r(w*0.70)} ${h} L${r(w*0.52)} ${hz}" stroke="${PALETTE.mute}" stroke-width="${sw}" opacity="0.45" fill="none"/>`,
        // Clay roof at path end
        `<path d="M${r(w*0.45)} ${hz} l${r(w*0.03)} -${r(h*0.05)} l${r(w*0.03)} ${r(h*0.05)} z" fill="${PALETTE.clay}" opacity="0.80"/>`,
        `<rect x="${r(w*0.45)}" y="${hz}" width="${r(w*0.06)}" height="${r(h*0.05)}" fill="${PALETTE.mute}" opacity="0.22"/>`,
      );
      break;

    case "morning":
      // Morning light: low horizon, single line, open field, muted warmth
      elems.push(
        `<rect x="0" y="${r(h*0.65)}" width="${w}" height="${r(h*0.35)}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${r(h*0.65)}" x2="${w}" y2="${r(h*0.65)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.35"/>`,
        `<rect x="0" y="${r(h*0.75)}" width="${w}" height="${r(h*0.25)}" fill="${PALETTE.rule}" opacity="0.45"/>`,
        `<line x1="0" y1="${r(h*0.75)}" x2="${w}" y2="${r(h*0.75)}" stroke="${PALETTE.rule}" stroke-width="${sw}" opacity="0.6"/>`,
        // Distant clay roof very far right
        `<path d="M${r(w*0.84)} ${r(h*0.65)} l${r(w*0.025)} -${r(h*0.035)} l${r(w*0.025)} ${r(h*0.035)} z" fill="${PALETTE.clay}" opacity="0.60"/>`,
      );
      break;

    case "arrival":
      // Arrival: open gate on horizon, inviting
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.38"/>`,
        // Open gate (single post, open bar tilted)
        `<rect x="${r(w*0.44)}" y="${r(hz - h*0.18)}" width="${r(w*0.012)}" height="${r(h*0.18)}" fill="${PALETTE.ink}" opacity="0.50"/>`,
        `<rect x="${r(w*0.63)}" y="${r(hz - h*0.18)}" width="${r(w*0.012)}" height="${r(h*0.18)}" fill="${PALETTE.ink}" opacity="0.50"/>`,
        // Open rail (angled up-right — gate is open)
        `<path d="M${r(w*0.44)} ${r(hz - h*0.10)} L${r(w*0.63)} ${r(hz - h*0.17)}" stroke="${PALETTE.ink}" stroke-width="${sw*1.2}" opacity="0.38" fill="none"/>`,
        `<rect x="${r(w*0.44)}" y="${r(hz - h*0.20)}" width="${r(w*0.015)}" height="${r(h*0.025)}" fill="${PALETTE.clay}" opacity="0.72"/>`,
        `<rect x="${r(w*0.628)}" y="${r(hz - h*0.20)}" width="${r(w*0.015)}" height="${r(h*0.025)}" fill="${PALETTE.clay}" opacity="0.72"/>`,
      );
      break;

    case "settled":
      // Settled homestead: complete farmstead, warm low-light feel
      elems.push(
        `<rect x="0" y="${r(h*0.62)}" width="${w}" height="${r(h*0.38)}" fill="${PALETTE.paperDeep}"/>`,
        `<rect x="0" y="${r(h*0.72)}" width="${w}" height="${r(h*0.28)}" fill="${PALETTE.rule}" opacity="0.40"/>`,
        `<line x1="0" y1="${r(h*0.62)}" x2="${w}" y2="${r(h*0.62)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.42"/>`,
        // House
        `<rect x="${r(w*0.38)}" y="${r(h*0.62 - h*0.17)}" width="${r(w*0.12)}" height="${r(h*0.17)}" fill="${PALETTE.mute}" opacity="0.26"/>`,
        `<path d="M${r(w*0.36)} ${r(h*0.62 - h*0.17)} l${r(w*0.08)} -${r(h*0.08)} l${r(w*0.08)} ${r(h*0.08)} z" fill="${PALETTE.clay}" opacity="0.78"/>`,
        // Left barn
        `<rect x="${r(w*0.24)}" y="${r(h*0.62 - h*0.10)}" width="${r(w*0.09)}" height="${r(h*0.10)}" fill="${PALETTE.mute}" opacity="0.18"/>`,
        `<path d="M${r(w*0.23)} ${r(h*0.62 - h*0.10)} l${r(w*0.055)} -${r(h*0.045)} l${r(w*0.055)} ${r(h*0.045)} z" fill="${PALETTE.clay}" opacity="0.55"/>`,
        // Chimney
        `<rect x="${r(w*0.46)}" y="${r(h*0.62 - h*0.27)}" width="${r(w*0.015)}" height="${r(h*0.10)}" fill="${PALETTE.ink}" opacity="0.35"/>`,
      );
      break;

    case "clearing":
      // Clearing: minimal, open, centered calm
      elems.push(
        `<rect x="0" y="${r(h*0.60)}" width="${w}" height="${r(h*0.40)}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${r(h*0.60)}" x2="${w}" y2="${r(h*0.60)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.32"/>`,
        // Gentle arc — a clearing edge
        `<path d="M${r(w*0.20)} ${r(h*0.60)} Q${r(w*0.50)} ${r(h*0.52)} ${r(w*0.80)} ${r(h*0.60)}" fill="${PALETTE.rule}" opacity="0.40" stroke="${PALETTE.ink}" stroke-width="${sw*0.8}" opacity="0.22"/>`,
        // Moss fringe left and right
        `<rect x="0" y="${r(h*0.60)}" width="${r(w*0.12)}" height="${r(h*0.08)}" fill="${PALETTE.moss}" opacity="0.16"/>`,
        `<rect x="${r(w*0.88)}" y="${r(h*0.60)}" width="${r(w*0.12)}" height="${r(h*0.08)}" fill="${PALETTE.moss}" opacity="0.16"/>`,
      );
      break;

    case "restful":
      // Restful plain: very low horizon, wide sky, one hairline rule
      elems.push(
        `<rect x="0" y="${r(h*0.74)}" width="${w}" height="${r(h*0.26)}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${r(h*0.74)}" x2="${w}" y2="${r(h*0.74)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.30"/>`,
        `<rect x="0" y="${r(h*0.80)}" width="${w}" height="${r(h*0.20)}" fill="${PALETTE.rule}" opacity="0.35"/>`,
        `<line x1="0" y1="${r(h*0.80)}" x2="${w}" y2="${r(h*0.80)}" stroke="${PALETTE.rule}" stroke-width="${sw}" opacity="0.55"/>`,
      );
      break;

    case "watchpost":
      // Watchpost: a raised post/tower silhouette on horizon
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.38"/>`,
        // Watchpost tower
        `<rect x="${r(w*0.48)}" y="${r(hz - h*0.28)}" width="${r(w*0.04)}" height="${r(h*0.28)}" fill="${PALETTE.ink}" opacity="0.45"/>`,
        `<rect x="${r(w*0.46)}" y="${r(hz - h*0.28)}" width="${r(w*0.08)}" height="${r(h*0.06)}" fill="${PALETTE.ink}" opacity="0.45"/>`,
        // Platform
        `<rect x="${r(w*0.45)}" y="${r(hz - h*0.30)}" width="${r(w*0.10)}" height="${r(h*0.025)}" fill="${PALETTE.clay}" opacity="0.70"/>`,
        // Viewing slit
        `<rect x="${r(w*0.468)}" y="${r(hz - h*0.26)}" width="${r(w*0.012)}" height="${r(h*0.015)}" fill="${PALETTE.paper}" opacity="0.80"/>`,
      );
      break;

    case "boundary":
      // Boundary: a long fence line across the plain
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.38"/>`,
        // Fence posts (evenly spaced)
        ...[0.12, 0.24, 0.36, 0.48, 0.60, 0.72, 0.84].map(x =>
          `<rect x="${r(w*x)}" y="${r(hz - h*0.12)}" width="${r(w*0.008)}" height="${r(h*0.12)}" fill="${PALETTE.ink}" opacity="0.40"/>`
        ),
        // Fence rail (two horizontal lines)
        `<line x1="${r(w*0.10)}" y1="${r(hz - h*0.08)}" x2="${r(w*0.88)}" y2="${r(hz - h*0.08)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.35"/>`,
        `<line x1="${r(w*0.10)}" y1="${r(hz - h*0.04)}" x2="${r(w*0.88)}" y2="${r(hz - h*0.04)}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.25"/>`,
        // Clay cap on leftmost post
        `<rect x="${r(w*0.118)}" y="${r(hz - h*0.14)}" width="${r(w*0.014)}" height="${r(h*0.025)}" fill="${PALETTE.clay}" opacity="0.72"/>`,
        // Moss ground
        `<rect x="0" y="${r(hz + h*0.06)}" width="${w}" height="${r(h*0.03)}" fill="${PALETTE.moss}" opacity="0.12"/>`,
      );
      break;

    default:
      // Fallback: simple wide-plain
      elems.push(
        `<rect x="0" y="${hz}" width="${w}" height="${h - hz}" fill="${PALETTE.paperDeep}"/>`,
        `<line x1="0" y1="${hz}" x2="${w}" y2="${hz}" stroke="${PALETTE.ink}" stroke-width="${sw}" opacity="0.40"/>`,
      );
  }

  return elems.join("\n  ");
}

// Build a sequence of stepped rooflines for "town-horizon" motif
function buildTownRooflines(w, h) {
  const hz = Math.round(h * 0.55);
  const buildings = [
    { x: 0.15, bw: 0.06, bh: 0.12, rh: 0.06 },
    { x: 0.22, bw: 0.09, bh: 0.18, rh: 0.07 },
    { x: 0.32, bw: 0.05, bh: 0.10, rh: 0.045 },
    { x: 0.38, bw: 0.10, bh: 0.22, rh: 0.09 },
    { x: 0.49, bw: 0.07, bh: 0.14, rh: 0.06 },
    { x: 0.57, bw: 0.08, bh: 0.17, rh: 0.07 },
    { x: 0.66, bw: 0.05, bh: 0.09, rh: 0.04 },
    { x: 0.72, bw: 0.09, bh: 0.13, rh: 0.055 },
    { x: 0.82, bw: 0.06, bh: 0.11, rh: 0.05 },
  ];
  const sw = 1.5;
  return buildings.flatMap(({ x, bw, bh, rh }, i) => {
    const bx = r(w * x);
    const by = r(hz - h * bh);
    const bwp = r(w * bw);
    const bhp = r(h * bh);
    const rhp = r(h * rh);
    const isRoof = i % 3 !== 1; // most get a clay triangular roof
    return [
      `<rect x="${bx}" y="${by}" width="${bwp}" height="${bhp}" fill="${PALETTE.mute}" opacity="0.20"/>`,
      isRoof
        ? `<path d="M${bx} ${by} l${r(bwp / 2)} -${rhp} l${r(bwp / 2)} ${rhp} z" fill="${PALETTE.clay}" opacity="0.65"/>`
        : `<rect x="${bx}" y="${r(by - rhp * 0.4)}" width="${bwp}" height="${r(rhp * 0.4)}" fill="${PALETTE.clay}" opacity="0.60"/>`,
    ];
  });
}

// Round helper for pixel-crisp coordinates
function r(n) { return Math.round(n); }

function sceneSvg({ w, h, motif, aria }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escapeXml(aria)}">
  ${motifElements(motif, w, h)}
</svg>
`;
}

function escapeXml(s) {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "public", "brand", "plaino-system", "motifs");
mkdirSync(outDir, { recursive: true });

let n = 0;
for (const slot of SLOTS) {
  const svg = sceneSvg(slot);
  writeFileSync(join(outDir, `${slot.slug}.svg`), svg, "utf8");
  n++;
}

console.log(`wrote ${n} scene motif SVGs to public/brand/plaino-system/motifs/`);
