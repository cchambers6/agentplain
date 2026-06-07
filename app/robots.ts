import type { MetadataRoute } from "next";

// robots.txt for agentplain.com.
//
// Source-of-truth: this file. Next.js compiles it to `/robots.txt` at build time.
// Companion file: `app/sitemap.ts` (which this file references via `sitemap`).
//
// Rules:
//   - Allow all marketing content by default. agentplain has no auth-walled
//     marketing pages; every page in `app/(marketing)/` is publicly indexable.
//   - Disallow the operator + product (app) surfaces. Those routes either
//     require auth (no value to a crawler) or expose per-workspace data
//     (workspace IDs, billing, integrations) that should never land in a SERP.
//   - Disallow `/api/*` — JSON endpoints + webhook receivers aren't useful to
//     crawl — EXCEPT `/api/og`, carved out via a more-specific Allow so OG
//     image generation stays crawlable. (Today the OG images are served via
//     the Next.js `opengraph-image` route convention at `/opengraph-image`
//     and `/<vertical>/opengraph-image`, which live under the allowed
//     marketing tree already; the `/api/og` Allow is kept per the SEO brief
//     and is forward-compatible if an `/api/og` route is ever added.)
//   - Disallow `/promo/*` — internal campaign landing surfaces, not for
//     organic discovery.
//   - Point at the absolute sitemap URL per Google's recommendation.
//
// Longest-match precedence: Googlebot honors the most specific path rule, so
// `Allow: /api/og` overrides `Disallow: /api/` for that subtree.

const BASE = "https://agentplain.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/og"],
        disallow: ["/api/", "/app/", "/operator/", "/promo/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
