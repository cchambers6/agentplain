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
// - `/app/*`, `/operator/*`, `/api/*` — gated/internal; covered by
//   `app/robots.ts` Disallow rules.
//
// `metadataBase` is set in `app/layout.tsx` to https://agentplain.com.
// Per Next.js sitemap convention, the URL in each entry is the absolute URL.
const BASE = "https://agentplain.com";

const MARKETING_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/about", changeFrequency: "monthly", priority: 0.7 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
  { path: "/verticals", changeFrequency: "weekly", priority: 0.9 },
  { path: "/custom", changeFrequency: "monthly", priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const marketing = MARKETING_ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const verticals = VERTICAL_SLUGS.map((slug) => ({
    url: `${BASE}/${slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // On-ramp surfaces (currently `/general`) — same route shape, lower
  // priority than a ratified vertical landing page since the on-ramp is the
  // catch-all fallback for businesses outside the ten.
  const onRamps = ON_RAMP_SLUGS.map((slug) => ({
    url: `${BASE}/${slug}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...marketing, ...verticals, ...onRamps];
}
