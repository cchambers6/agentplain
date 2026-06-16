/**
 * Structured-data builders (schema.org JSON-LD).
 *
 * Every payload is derived from existing canonical content — no invented
 * claims. Sources:
 *   - Organization / wordmark / tagline → `lib/brand/tokens.ts`
 *   - Service / verticals               → `lib/verticals/*` (locked ten + on-ramp)
 *   - FAQPage                           → `components/FAQ.tsx` (exported items)
 *   - Pricing / Offer bands             → `lib/pricing/tiers.ts`
 *
 * Per `feedback_no_guesses_no_estimates.md`: nothing here makes up reviewer
 * counts, ratings, pricing not already locked, or claims not present in the
 * memory rules. Per `feedback_no_silent_vendor_lock.md`: this lives behind a
 * pure builder boundary — components consume the typed shape, never schema.org
 * vocabulary directly.
 *
 * 2026-06-06 refresh (SEO/marketing pack following PR #158 + PR #159 ROI
 * softening), amended 2026-06-11 (vendor-invisible customer surfaces):
 *   - Organization / SoftwareApplication / Service descriptions are
 *     vendor-generic — the underlying AI model is NOT named on any customer
 *     surface (per the 2026-06-11 rule; the sole sanctioned disclosure home is
 *     the privacy + security subprocessor list). The earlier "service layer on
 *     top of Claude" framing and the `isBasedOn` Claude/Anthropic node were
 *     removed here for that reason.
 *   - `verticalProductJsonLd()` — per-vertical Product with the softened ROI
 *     band (15–50× cap; the retired 107× claim is never emitted) and a real
 *     per-seat Offer derived from the locked pricing ladder.
 */

import { tokens } from "@/lib/brand/tokens";
import { getAllVerticals } from "@/lib/verticals";
import type { VerticalContent } from "@/lib/verticals/types";
import {
  PER_SEAT_MONTHLY_USD_CENTS,
  isSelfServeTier,
  tierDisplayName,
  type TierName,
} from "@/lib/pricing/tiers";

export const BASE_URL = "https://agentplain.com";

/**
 * The softened ROI band, stated once so every Product payload and the
 * FAQ-derived copy read identically. Per PR #159 (`feat/roi-soften-violation
 * -anchor`) + the competitive audit in PR #155: the headline band is capped
 * at 50× and paired with the violation-avoidance anchor. The retired 107×
 * figure must never appear in any structured-data payload.
 */
export const ROI_BAND = "15–50× per workflow";
export const ROI_FRAME =
  "Modeled 15–50× ROI per workflow on hours reclaimed — plus the regulatory violations a draft-then-approve loop catches as a draft and never sends, the one thing an auto-execution tool can't promise to dodge.";

/**
 * Organization payload — names agentplain as the publisher across every
 * surface. Logo/sameAs are intentionally omitted until we have canonical
 * URLs to point at (no invented LinkedIn/X handles).
 *
 * Description is vendor-generic — the underlying AI model is not named on a
 * customer surface (per the 2026-06-11 rule).
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
    // Logo points at the in-repo brand mark (public/favicon.svg). Real asset,
    // no invented CDN URL. `sameAs` stays omitted until agentplain has
    // canonical social profiles to point at — no invented handles.
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/favicon.svg`,
    },
    description:
      "agentplain is a managed AI fleet for local businesses. We bring the pre-built skills and agents a shop would otherwise build itself, curate the memory that keeps it useful, connect the tools you already run, and operate the whole thing for a low flat fee — run for you, not configured by you. Built for ten verticals: real estate, mortgage, insurance, property management, title & escrow, recruiting, home services, CPA / tax, law, and RIA.",
    knowsAbout: getAllVerticals().map((v) => v.name),
  };
}

/**
 * WebSite node — the entity-recognition anchor for "tell me about agentplain"
 * style queries and for Google's site-name resolution. No SearchAction is
 * emitted because the marketing site has no site-search endpoint (claiming one
 * would be a lie). Wired once, on the homepage.
 */
export function webSiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    name: tokens.wordmark,
    url: BASE_URL,
    description: tokens.tagline,
    publisher: { "@id": `${BASE_URL}/#organization` },
    inLanguage: "en-US",
  };
}

/**
 * SoftwareApplication payload. Description is vendor-generic — the underlying
 * AI model is not named on a customer surface (per the 2026-06-11 rule; the
 * `isBasedOn` Claude/Anthropic node that previously lived here was removed for
 * that reason — the sanctioned disclosure home is the privacy/security
 * subprocessor list, not crawler-facing structured data).
 *
 * `offers` is an AggregateOffer spanning the self-serve per-seat ladder
 * (Regular $99–$199, Partner $199–$299) sourced from the locked pricing
 * tiers. Max is quote-based and excluded by design.
 */
export function softwareApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${BASE_URL}/#software`,
    name: tokens.wordmark,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Managed AI operations for local businesses",
    operatingSystem: "Web",
    url: BASE_URL,
    provider: { "@id": `${BASE_URL}/#organization` },
    description:
      "A managed, vertical-aware fleet of AI partners that reads your email, calendar, CRM, and documents, then drafts what you'd otherwise type — installed, run, and customized for you by a human service team. Run for you; you stay in control because the fleet drafts and you approve.",
    offers: selfServeAggregateOffer(),
  };
}

/**
 * AggregateOffer across the self-serve per-seat ladder. Min = the cheapest
 * Regular seat (50–99 band), max = the most expensive Partner seat (solo).
 * Sourced from `PER_SEAT_MONTHLY_USD_CENTS`; quote-based Max is excluded.
 */
function selfServeAggregateOffer(): Record<string, unknown> {
  const selfServe: TierName[] = (["regular", "plus"] as TierName[]).filter(
    isSelfServeTier,
  );
  const prices = selfServe.flatMap((t) =>
    Object.values(PER_SEAT_MONTHLY_USD_CENTS[t]).map((c) => c / 100),
  );
  return {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: prices.length,
    unitText: "per seat per month",
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
      "Managed AI ops: we install, run, and customize a vertical-aware fleet of capable AI partners inside your business. Run for you, not configured by you. The fleet drafts; you decide. Built for ten verticals plus a /general on-ramp.",
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
 * Per-vertical Product payload — used on each `/[vertical]` page alongside the
 * Service payload. Carries the softened ROI band (capped at 50×; the retired
 * 107× claim is never emitted) as a `PropertyValue`, plus a real per-seat
 * `Offer` derived from the vertical's locked tier.
 *
 * Offer rules (truthful pricing only):
 *   - Regular / Partner (self-serve) → AggregateOffer with the tier's own
 *     per-seat band from `PER_SEAT_MONTHLY_USD_CENTS`.
 *   - Max (law, ria) → quote-based; NO price Offer is emitted (we never
 *     invent a seat price for a quoted engagement). The Product still ships
 *     so the ROI + brand signal lands; pricing surfaces on /pricing + /custom.
 *
 * The per-vertical `multiplier` (e.g. "26x", "11x–23x") is asserted ≤ 50× by
 * the content audit; we surface it verbatim. The ROI_FRAME copy states the
 * 15–50× band + violation anchor identically to the FAQ and pricing surfaces.
 */
export function verticalProductJsonLd(v: VerticalContent): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${BASE_URL}/${v.slug}/#product`,
    name: `${tokens.wordmark} for ${v.name.toLowerCase()}`,
    category: "Managed AI operations",
    brand: { "@id": `${BASE_URL}/#organization` },
    url: `${BASE_URL}/${v.slug}`,
    description: `${v.hero.valueProp} ${ROI_FRAME}`,
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "ROI band",
        value: ROI_BAND,
      },
      {
        "@type": "PropertyValue",
        name: "Vertical ROI multiplier",
        value: v.roi.multiplier,
      },
      {
        "@type": "PropertyValue",
        name: "Service tier",
        value: tierDisplayName(v.tier),
      },
    ],
  };

  const offer = verticalOffer(v.tier);
  if (offer) payload.offers = offer;

  return payload;
}

/**
 * Per-seat Offer for a vertical's tier. Returns null for quote-based Max so
 * we never publish an invented seat price. Self-serve tiers (Regular,
 * Partner) get an AggregateOffer spanning their own seat band.
 */
function verticalOffer(tier: TierName): Record<string, unknown> | null {
  if (!isSelfServeTier(tier)) return null;
  const prices = Object.values(PER_SEAT_MONTHLY_USD_CENTS[tier]).map(
    (c) => c / 100,
  );
  return {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: prices.length,
    unitText: "per seat per month",
    availability: "https://schema.org/InStock",
  };
}

/**
 * The exact direct-answer question for a vertical — "What is agentplain for
 * {name}?". Single source of truth so the rendered heading
 * (`VerticalDirectAnswer`) and the FAQPage `name` field are byte-identical;
 * Google requires the structured-data question to match the visible one.
 */
export function verticalFaqQuestion(name: string): string {
  return `What is agentplain for ${name.toLowerCase()}?`;
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
 * Generic BreadcrumbList — pass an ordered trail of {name, path}. Paths are
 * resolved against BASE_URL. Used by the /compare and /glossary surfaces
 * (the vertical pages keep their dedicated builder above).
 */
export function breadcrumbJsonLd(
  trail: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((node, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: node.name,
      // Root → `${BASE_URL}/`; every other node → no trailing slash, matching
      // the canonical URLs (`alternatesFor`) and `verticalBreadcrumbJsonLd`.
      item: node.path === "/" ? `${BASE_URL}/` : `${BASE_URL}${node.path}`,
    })),
  };
}

/**
 * DefinedTermSet payload for the glossary — emits one DefinedTerm per entry,
 * each addressable by its on-page anchor. This is the structured-data home for
 * the positioning vocabulary agentplain wants answer engines to cite
 * ("service partnership", "run-for-you", "draft-then-approve").
 */
export function definedTermSetJsonLd(
  terms: Array<{ slug: string; term: string; definition: string }>,
): Record<string, unknown> {
  const glossaryUrl = `${BASE_URL}/glossary`;
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${glossaryUrl}/#glossary`,
    name: `${tokens.wordmark} glossary`,
    url: glossaryUrl,
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${glossaryUrl}#${t.slug}`,
      name: t.term,
      description: t.definition,
      inDefinedTermSet: `${glossaryUrl}/#glossary`,
    })),
  };
}

/**
 * FAQPage payload — built from a list of {q, a} pairs the FAQ component
 * exports. Keeping the shape this loose lets the same builder drive a
 * sub-FAQ on a vertical page later without a schema change.
 *
 * Google requires FAQPage structured data to mirror FAQ content VISIBLE on
 * the page — so every caller must render the same items it passes here
 * (the homepage renders all of FAQ_ITEMS; /pricing renders + emits only the
 * pricing-topic subset).
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
