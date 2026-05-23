import type { MetadataRoute } from "next";

// robots.txt for agentplain.com.
//
// Source-of-truth: this file. Next.js compiles it to `/robots.txt` at build time.
// Companion file: `app/sitemap.ts` (which this file references via `sitemap`).
//
// Rules:
//   - Allow all by default. agentplain has no auth-walled marketing content;
//     every page in `app/(marketing)/` is publicly indexable.
//   - Disallow the operator + product (app) surfaces. Those routes either
//     require auth (no value to a crawler) or expose per-workspace data
//     (workspace IDs, billing, integrations) that should never land in a SERP.
//   - Disallow `/api/*`. JSON endpoints aren't useful to crawl, and some
//     surface webhook receivers / internal contracts.
//   - Point at the absolute sitemap URL per Google's recommendation.

const BASE = "https://agentplain.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/app/", "/operator/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
