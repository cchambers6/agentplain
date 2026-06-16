import type { MetadataRoute } from "next";

import { VERTICAL_SLUGS, ON_RAMP_SLUGS } from "@/lib/verticals";

// Sitemap for agentplain.com.
//
// Sources:
// - Marketing routes are enumerated explicitly (one entry per page).
// - The 10 vertical landing pages come from `lib/verticals/index.ts` — the
//   single source of truth for the locked vertical set per
//   `project_vertical_tier_mapping.md` (and its 2026-05-12 simplification in
//   `project_stripe_both_surfaces.md`). Adding/removing a vertical there
//   propagates here automatically.
// - On-ramp surfaces (currently just `/general`) resolve through the same
//   `[vertical]` dynamic route. They aren't part of the locked ten, but they
//   ARE crawlable public pages and should appear in the sitemap so the
//   "Don't see your industry?" on-ramp gets discovered organically.
//
// Excluded by design:
// - `/inquiry-received` — sets `robots: { index: false, follow: false }`
//   in its own metadata; confirmation surface, not search-discoverable.
// - `/trust` — not built yet (needs design judgment); revisit when it
//   ships.
// - `/app/*`, `/operator/*`, `/api/*`, `/promo/*` — gated/internal; covered
//   by `app/robots.ts` Disallow rules. NONE are enumerated here, so no
//   operator/app route can leak into the sitemap.
//
// `lastModified`: this SEO/marketing pack (PR following #158 SBM-wrapper +
// #159 ROI softening) touched the copy + structured data on every marketing
// route, so all entries carry a fixed 2026-06-06 lastmod. A fixed date (not
// `new Date()`) is the correct SEO signal — it reports when the CONTENT
// actually changed, not when the build ran. Bump `LAST_UPDATED` on the next
// content pass.
//
// `metadataBase` is set in `app/layout.tsx` to https://agentplain.com.
// Per Next.js sitemap convention, the URL in each entry is the absolute URL.
const BASE = "https://agentplain.com";

// Content-change date for this refresh. ISO date → Next.js serializes it as
// the `<lastmod>` value. Update when marketing content materially changes.
const LAST_UPDATED = "2026-06-06";

// Priority weighting per the SEO pack brief:
//   homepage 1.0 · vertical pages 0.9 · /pricing 0.9 · /verticals 0.9
//   /about 0.7 · /custom 0.7 · /privacy /terms /security 0.3
// (The brief also lists /agents 0.7 — that's a gated product route excluded
//  by robots, so it stays out. /how-it-works 0.8 now exists as a standalone
//  marketing route and is enumerated below.)
const MARKETING_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
  { path: "/verticals", changeFrequency: "weekly", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/custom", changeFrequency: "monthly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/security", changeFrequency: "monthly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const marketing = MARKETING_ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: LAST_UPDATED,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // The ten ratified vertical landing pages — top organic-acquisition
  // surface, so 0.9 (just under the homepage).
  const verticals = VERTICAL_SLUGS.map((slug) => ({
    url: `${BASE}/${slug}`,
    lastModified: LAST_UPDATED,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  // On-ramp surfaces (currently `/general`) — same route shape, lower
  // priority than a ratified vertical landing page since the on-ramp is the
  // catch-all fallback for businesses outside the ten.
  const onRamps = ON_RAMP_SLUGS.map((slug) => ({
    url: `${BASE}/${slug}`,
    lastModified: LAST_UPDATED,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...marketing, ...verticals, ...onRamps];
}
