import type { Metadata } from "next";

import { BASE_URL } from "./structured-data";

/**
 * Canonical + hreflang helpers for marketing routes.
 *
 * Why a helper and not inline `alternates`: every marketing page needs a
 * self-referential canonical so syndication, UTM-tagged inbound, and the
 * `www`/apex pair never split ranking signal (see
 * `project_apex_alias_drift_rootcause.md` — apex/app are distinct origins;
 * a canonical pins the apex as the indexable one). `metadataBase` is set in
 * `app/layout.tsx` to https://agentplain.com, so a path-only canonical
 * resolves to the absolute URL Next.js emits.
 *
 * Multi-region prep (hreflang stub): agentplain is US-only today (every
 * vertical carries a US-federal compliance corpus). We are NOT shipping
 * en-GB / en-AU variants yet — but the architecture is staged here so adding
 * them later is a one-line change per locale, not a site-wide retrofit. The
 * `x-default` entry points at the canonical (the US English page is the
 * default for every region until localized variants exist). When a real
 * variant ships, add e.g. `"en-GB": `${BASE_URL}/uk${path}`` to the map
 * returned by `hreflangLanguages` and emit the alternate sitemap entries.
 */

/** Locale → path-prefix map. Empty today (US-only). Populate to launch a region. */
const LOCALE_PREFIXES: Record<string, string> = {
  // "en-GB": "/uk",
  // "en-AU": "/au",
};

/**
 * Build the `languages` map for a path. Always includes `x-default` pointing
 * at the canonical US English URL; adds one entry per configured locale once
 * `LOCALE_PREFIXES` is populated. Returns absolute URLs.
 */
export function hreflangLanguages(path: string): Record<string, string> {
  const normalized = normalizePath(path);
  const languages: Record<string, string> = {
    "x-default": `${BASE_URL}${normalized}`,
    "en-US": `${BASE_URL}${normalized}`,
  };
  for (const [locale, prefix] of Object.entries(LOCALE_PREFIXES)) {
    languages[locale] = `${BASE_URL}${prefix}${normalized === "/" ? "" : normalized}`;
  }
  return languages;
}

/**
 * `alternates` block for a marketing route — canonical + hreflang stub.
 * Spread into a page's `metadata.alternates`.
 *
 *   export const metadata = { title: "...", alternates: alternatesFor("/pricing") };
 */
export function alternatesFor(path: string): NonNullable<Metadata["alternates"]> {
  const normalized = normalizePath(path);
  return {
    canonical: normalized,
    languages: hreflangLanguages(normalized),
  };
}

/** Ensure a leading slash and no trailing slash (except root). */
function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  const withLeading = path.startsWith("/") ? path : `/${path}`;
  return withLeading.length > 1 && withLeading.endsWith("/")
    ? withLeading.slice(0, -1)
    : withLeading;
}
