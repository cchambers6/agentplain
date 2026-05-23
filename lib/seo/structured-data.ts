/**
 * Structured-data builders (schema.org JSON-LD).
 *
 * Every payload is derived from existing canonical content — no invented
 * claims. Sources:
 *   - Organization / wordmark / tagline → `lib/brand/tokens.ts`
 *   - Service / verticals               → `lib/verticals/*` (locked ten + on-ramp)
 *   - FAQPage                           → `components/FAQ.tsx` (exported items)
 *
 * Per `feedback_no_guesses_no_estimates.md`: nothing here makes up reviewer
 * counts, ratings, pricing not already locked, or claims not present in the
 * memory rules. Per `feedback_no_silent_vendor_lock.md`: this lives behind a
 * pure builder boundary — components consume the typed shape, never schema.org
 * vocabulary directly.
 */

import { tokens } from "@/lib/brand/tokens";
import { getAllVerticals } from "@/lib/verticals";
import type { VerticalContent } from "@/lib/verticals/types";

export const BASE_URL = "https://agentplain.com";

/**
 * Organization payload — names agentplain as the publisher across every
 * surface. Logo/sameAs are intentionally omitted until we have canonical
 * URLs to point at (no invented LinkedIn/X handles).
 */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: tokens.wordmark,
    legalName: "agentplain",
    url: BASE_URL,
    slogan: tokens.tagline,
    description:
      "agentplain is a service partnership for local businesses. A service team installs a fleet of capable AI partners inside your shop, configures it for your vertical, and customizes the agents as your ops shift. Built for ten verticals: real estate, mortgage, insurance, property management, title & escrow, recruiting, home services, CPA / tax, law, and RIA.",
    knowsAbout: getAllVerticals().map((v) => v.name),
  };
}

/**
 * Top-level Service payload — describes the managed AI ops offering.
 *
 * `areaServed` stays "United States" because every locked vertical is
 * US-bound today (GA real-estate first; other verticals carry US-federal
 * compliance corpus per memory rules). `serviceType` is a category, not a
 * tier name — tier-specific Offer payloads would invent price points that
 * already live in the pricing-tiers source of truth and are surfaced
 * differently on /pricing.
 */
export function serviceJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${BASE_URL}/#service`,
    name: `${tokens.wordmark} service partnership`,
    serviceType: "Managed AI operations for local businesses",
    provider: { "@id": `${BASE_URL}/#organization` },
    areaServed: "United States",
    description:
      "Managed AI ops: we install, run, and customize a vertical-aware fleet of capable AI partners inside your business. The fleet drafts; you decide. Built for ten verticals plus a /general on-ramp.",
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Local businesses (1–99 seats)",
    },
  };
}

/**
 * Per-vertical Service payload — used on each `/[vertical]` page. Sources
 * the headline + value prop from the vertical's own content file so a
 * positioning edit lands here automatically.
 */
export function verticalServiceJsonLd(v: VerticalContent): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${BASE_URL}/${v.slug}/#service`,
    name: `${tokens.wordmark} for ${v.name.toLowerCase()}`,
    serviceType: `Managed AI operations for ${v.name.toLowerCase()}`,
    provider: { "@id": `${BASE_URL}/#organization` },
    areaServed: "United States",
    url: `${BASE_URL}/${v.slug}`,
    description: v.hero.valueProp,
    audience: {
      "@type": "BusinessAudience",
      audienceType: v.missionSubject ?? v.name,
    },
  };
}

/**
 * BreadcrumbList for `/[vertical]` — Home → Verticals → {Vertical}.
 * `/verticals` is the canonical index page (it ships in the sitemap).
 */
export function verticalBreadcrumbJsonLd(v: VerticalContent): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${BASE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Verticals",
        item: `${BASE_URL}/verticals`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: v.name,
        item: `${BASE_URL}/${v.slug}`,
      },
    ],
  };
}

/**
 * FAQPage payload — built from a list of {q, a} pairs the FAQ component
 * exports. Keeping the shape this loose lets the same builder drive a
 * sub-FAQ on a vertical page later without a schema change.
 */
export function faqPageJsonLd(items: Array<{ q: string; a: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}
