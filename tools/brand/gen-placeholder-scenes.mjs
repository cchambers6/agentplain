// Placeholder heritage-scene generator (NON-BLOCKING brand wiring).
//
// The Visual Gap Audit (memory/visual_gap_audit_2026_06_07.md) found 25
// PLACEHOLDER illustration slots across the marketing site, auth gate, and
// in-app empty states — surfaces that should host a heritage Plaino scene but
// currently render text-only (or a generic line-art ApMotif).
//
// Per Conner's non-blocking principle: we WIRE every slot and ship a
// brand-correct placeholder stand-in NOW so the plumbing is ready and the UX
// flow is reviewable. When Conner pastes the real ChatGPT-generated assets
// back (prompts indexed at docs/brand/asset-prompts/), a follow-up micro-PR
// swaps the real raster into the SAME wired slot — a one-file change per slot
// because every slot reads from a single src map (see PlainoScene.tsx).
//
// These are DELIBERATELY simple, honest, geometric/typographic stand-ins —
// NOT freehand illustrations (per feedback_creative_assets_use_tools_or_humans:
// brand-defining illustration goes brief → tool/human, never raw-SVG improv).
// Each placeholder:
//   - occupies the exact target dimensions,
//   - uses ONLY the locked palette (Paper/Ink/Clay/Moss/Mute),
//   - states its own slot name + target so it reads unmistakably as a
//     placeholder, not a finished asset,
//   - draws a minimal "plain + low rise + watching dog silhouette" motif so
//     the composition/negative-space of the real asset is previewable.
//
// Output: public/brand/plaino-system/placeholders/<slug>.svg
// Run:    node tools/brand/gen-placeholder-scenes.mjs
//
// No deps — writes SVG text. SVG is chosen over a rasterizer so the output is
// deterministic, diff-reviewable, and doesn't contend with any parallel
// wave's shared headless-browser.

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PALETTE = {
  paper: "#F7F4ED",
  ink: "#1A1A1F",
  clay: "#B65D3A",
  moss: "#3F5C3F",
  mute: "#726A5E",
};

// Every PLACEHOLDER slot from the audit, with its target raster path and
// dimensions. `target` is the path the real asset lands at (the swap target);
// `slug` names the committed placeholder SVG.
const SLOTS = [
  // ── Marketing heroes / scenes ───────────────────────────────────────────
  { slug: "home-crew-scene", w: 1200, h: 900, label: "home · what the crew does", pose: "herding", target: "public/brand/plaino-system/scenes/home-crew.png" },
  { slug: "home-knowledge-scene", w: 1200, h: 900, label: "home · knowledge substrate", pose: "resting", target: "public/brand/plaino-system/scenes/home-knowledge.png" },
  { slug: "home-future-scene", w: 2000, h: 1000, label: "home · future of work", pose: "standing-watch", target: "public/brand/plaino-system/scenes/home-future.png" },
  { slug: "pricing-hero", w: 1000, h: 1000, label: "pricing · one fair price", pose: "sitting-alert", target: "public/brand/plaino-system/scenes/pricing.png" },
  { slug: "custom-hero", w: 1600, h: 1000, label: "custom · made to fit", pose: "fetching", target: "public/brand/plaino-system/scenes/custom.png" },
  { slug: "about-hero", w: 1800, h: 1100, label: "about · the working town", pose: "standing-watch", target: "public/brand/plaino-system/scenes/about-hero.png" },
  { slug: "about-dogfood", w: 1200, h: 900, label: "about · run on ourselves", pose: "herding", target: "public/brand/plaino-system/scenes/about-dogfood.png" },
  { slug: "verticals-hero", w: 2000, h: 1000, label: "verticals · the ten", pose: "scouting", target: "public/brand/plaino-system/scenes/verticals.png" },
  { slug: "legal-motif", w: 600, h: 600, label: "legal · we keep it safe", pose: "guarding", target: "public/brand/plaino-system/scenes/legal.png" },
  { slug: "inquiry-received", w: 1000, h: 1000, label: "inquiry · in good hands", pose: "fetching", target: "public/brand/plaino-system/scenes/inquiry-received.png" },

  // ── Auth welcome ─────────────────────────────────────────────────────────
  { slug: "auth-signin", w: 900, h: 900, label: "sign-in · welcome back", pose: "sitting-alert", target: "public/brand/plaino-system/scenes/auth-signin.png" },
  { slug: "auth-signup", w: 900, h: 900, label: "sign-up · welcome aboard", pose: "standing-watch", target: "public/brand/plaino-system/scenes/auth-signup.png" },
  { slug: "auth-checkout", w: 1000, h: 1000, label: "checkout · you're all set", pose: "sitting-alert", target: "public/brand/plaino-system/scenes/auth-checkout.png" },

  // ── In-app empty-state scenes ─────────────────────────────────────────────
  { slug: "empty-talk", w: 1200, h: 1200, label: "talk · here when ready", pose: "sitting-alert", target: "public/brand/plaino-system/scenes/empty-talk.png" },
  { slug: "empty-approvals", w: 1000, h: 1000, label: "approvals · caught up", pose: "resting", target: "public/brand/plaino-system/scenes/empty-approvals.png" },
  { slug: "empty-activity", w: 1000, h: 1000, label: "activity · on watch", pose: "standing-watch", target: "public/brand/plaino-system/scenes/empty-activity.png" },
  { slug: "empty-sentinel", w: 1000, h: 1000, label: "sentinel · holding the line", pose: "guarding", target: "public/brand/plaino-system/scenes/empty-sentinel.png" },

  // ── Per-vertical heroes (the ten + on-ramp) ───────────────────────────────
  ...[
    ["real-estate", "standing-watch"],
    ["mortgage", "sitting-alert"],
    ["insurance", "guarding"],
    ["property-management", "herding"],
    ["title-escrow", "fetching"],
    ["recruiting", "scouting"],
    ["home-services", "standing-watch"],
    ["cpa", "sitting-alert"],
    ["law", "guarding"],
    ["ria", "standing-watch"],
    ["general", "scouting"],
  ].map(([v, pose]) => ({
    slug: `vertical-${v}`,
    w: 1600,
    h: 1000,
    label: `${v} · hero`,
    pose,
    target: `public/brand/plaino-system/scenes/vertical-${v}.png`,
  })),
];

// A tiny, honest plain-+-dog-silhouette composition. Not an illustration —
// a geometric stand-in that previews the real asset's negative space and the
// "calm dog watching over a low plain" framing. One Clay charge (the collar
// tag), Moss for the land band, Ink for the silhouette, Mute for the
// placeholder labelling.
function sceneSvg({ w, h, label, pose, target }) {
  // Horizon at ~62% height; dog silhouette sits on the rise, right-of-center
  // so the left field stays open for headline type (mirrors the hero pattern).
  const horizon = Math.round(h * 0.62);
  const cx = Math.round(w * 0.72);
  const dogW = Math.round(Math.min(w, h) * 0.16);
  const dogH = Math.round(dogW * 1.15);
  const dogX = cx - dogW / 2;
  const dogY = horizon - dogH;
  const tag = Math.round(dogW * 0.12);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="placeholder heritage scene: ${label}">
  <!-- PLACEHOLDER — non-blocking stand-in. Real asset swaps in at ${target} -->
  <rect width="${w}" height="${h}" fill="${PALETTE.paper}"/>
  <!-- low land band (Moss) -->
  <rect x="0" y="${horizon}" width="${w}" height="${h - horizon}" fill="${PALETTE.moss}" opacity="0.16"/>
  <!-- horizon line (Ink hairline) + low rise -->
  <path d="M0 ${horizon} H${w}" stroke="${PALETTE.ink}" stroke-width="2" opacity="0.55"/>
  <path d="M${Math.round(w * 0.5)} ${horizon} Q${cx} ${horizon - Math.round(dogH * 0.45)} ${Math.round(w * 0.94)} ${horizon}" fill="none" stroke="${PALETTE.ink}" stroke-width="2" opacity="0.35"/>
  <!-- a single distant clay roof (the one Clay charge in the land) -->
  <path d="M${Math.round(w * 0.14)} ${horizon} l${Math.round(dogW * 0.5)} 0 l-${Math.round(dogW * 0.25)} -${Math.round(dogW * 0.22)} z" fill="${PALETTE.clay}" opacity="0.85"/>
  <!-- Plaino silhouette: calm working dog, head up, watching -->
  <g fill="${PALETTE.ink}">
    <!-- body -->
    <rect x="${dogX}" y="${dogY + Math.round(dogH * 0.45)}" width="${dogW}" height="${Math.round(dogH * 0.4)}" rx="${Math.round(dogW * 0.12)}"/>
    <!-- legs -->
    <rect x="${dogX + Math.round(dogW * 0.12)}" y="${dogY + Math.round(dogH * 0.78)}" width="${Math.round(dogW * 0.12)}" height="${Math.round(dogH * 0.22)}"/>
    <rect x="${dogX + Math.round(dogW * 0.72)}" y="${dogY + Math.round(dogH * 0.78)}" width="${Math.round(dogW * 0.12)}" height="${Math.round(dogH * 0.22)}"/>
    <!-- head -->
    <rect x="${dogX + Math.round(dogW * 0.6)}" y="${dogY + Math.round(dogH * 0.18)}" width="${Math.round(dogW * 0.34)}" height="${Math.round(dogH * 0.34)}" rx="${Math.round(dogW * 0.08)}"/>
    <!-- ear (up, alert) -->
    <path d="M${dogX + Math.round(dogW * 0.66)} ${dogY + Math.round(dogH * 0.2)} l0 -${Math.round(dogH * 0.14)} l${Math.round(dogW * 0.12)} ${Math.round(dogH * 0.1)} z"/>
    <!-- tail -->
    <path d="M${dogX} ${dogY + Math.round(dogH * 0.5)} q-${Math.round(dogW * 0.18)} -${Math.round(dogH * 0.05)} -${Math.round(dogW * 0.16)} -${Math.round(dogH * 0.22)}" fill="none" stroke="${PALETTE.ink}" stroke-width="${Math.round(dogW * 0.1)}" stroke-linecap="round"/>
  </g>
  <!-- collar tag: the single Clay charge on the dog -->
  <circle cx="${dogX + Math.round(dogW * 0.62)}" cy="${dogY + Math.round(dogH * 0.5)}" r="${tag}" fill="${PALETTE.clay}"/>
  <!-- placeholder labelling (Mute) — makes it unmistakably a stand-in -->
  <text x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.14)}" font-family="ui-monospace, Menlo, monospace" font-size="${Math.round(h * 0.028)}" fill="${PALETTE.mute}" letter-spacing="2">PLACEHOLDER · ${escapeXml(label.toUpperCase())}</text>
  <text x="${Math.round(w * 0.06)}" y="${Math.round(h * 0.14) + Math.round(h * 0.045)}" font-family="ui-monospace, Menlo, monospace" font-size="${Math.round(h * 0.02)}" fill="${PALETTE.mute}" opacity="0.8">${escapeXml(`${w}×${h} · pose ${pose} · awaiting real asset`)}</text>
</svg>
`;
}

function escapeXml(s) {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "public", "brand", "plaino-system", "placeholders");
mkdirSync(outDir, { recursive: true });

let n = 0;
for (const slot of SLOTS) {
  const svg = sceneSvg(slot);
  writeFileSync(join(outDir, `${slot.slug}.svg`), svg, "utf8");
  n++;
}

console.log(`wrote ${n} placeholder scenes to public/brand/plaino-system/placeholders/`);
