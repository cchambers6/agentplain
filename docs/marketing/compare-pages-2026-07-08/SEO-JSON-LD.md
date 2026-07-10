# FAQ schema (JSON-LD) spec — vendor comparison pages (2026-07-08)

Answer-engine spec for `/compare/follow-up-boss`, `/compare/sierra`, and
`/compare/boldtrail`. Most of this is already emitted by infrastructure that
shipped with #286/#289 — this file documents what renders, so the AEO
citation check (`docs/marketing/deep-dive-2026-07-02/06-measurement.md`) has
a spec to audit against.

## What each page emits (automatic)

Every `/compare/[alt]` page emits two JSON-LD blocks via
`components/seo/JsonLd` + `lib/seo/structured-data.ts`:

1. **BreadcrumbList** — Home → Compare → {vendor}. Built by
   `breadcrumbJsonLd()` in `app/(marketing)/compare/[alt]/page.tsx`.
2. **FAQPage** — one `Question`/`Answer` pair per entry in the comparison's
   `faq` array, built by `faqPageJsonLd()`. The registry entries are the
   single source of truth; nothing is hand-authored per page.

Sitewide `Organization` + `WebSite` nodes come from the root layout. Per the
Truth Wave rule and the SEO pipeline doc: **no `aggregateRating`, no
`Review` markup anywhere** — we have no reviews, and fabricated markup is a
penalty risk. No `Product` markup either; these are editorial comparisons.

## The FAQ sets per page

The question wording targets the query shapes from the keyword map
(`02-seo-aeo-content-pipeline.md`, real-estate rows 8–11): "X alternatives",
"X vs doing it yourself", "does X integrate with…".

### /compare/follow-up-boss

| # | Question | Answer targets (AEO intent) |
|---|---|---|
| 1 | Do I have to replace Follow Up Boss to use agentplain? | "follow up boss alternatives" queries where the honest answer is "keep it" — the answer states no direct integration exists today and names what the fleet actually reads (email, calendar, QuickBooks, documents). |
| 2 | Follow Up Boss has automations. How is run-for-you different? | The category-defining distinction: automation sends what you pre-wrote; run-for-you drafts what you would have written, behind a human approval. |
| 3 | Does the fleet send anything on its own? | The shared no-outbound answer (`NO_OUTBOUND_ANSWER`) — identical string across all comparison pages so answer engines see one consistent claim. |

### /compare/sierra

| # | Question | Answer targets |
|---|---|---|
| 1 | Does agentplain integrate with Sierra Interactive? | Honest "not directly today" + where the fleet works instead. |
| 2 | Sierra already sends automated follow-ups. Why add agentplain? | Triggered templates vs per-thread drafts; the handoff when a lead gets serious. |
| 3 | Does the fleet send anything on its own? | Shared no-outbound answer. |

### /compare/boldtrail

| # | Question | Answer targets |
|---|---|---|
| 1 | Does agentplain integrate with BoldTrail? | Honest "not directly today"; BoldTrail stays platform of record. |
| 2 | BoldTrail already has automation and a big feature list. What's left for agentplain? | "boldtrail vs building it yourself" queries — breadth vs the specific message; both can coexist. |
| 3 | Does the fleet send anything on its own? | Shared no-outbound answer. |

## Rendered example (follow-up-boss, generated shape)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I have to replace Follow Up Boss to use agentplain?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. Keep it. Follow Up Boss stays your CRM of record; agentplain works alongside it on the email, calendar, QuickBooks, and document work a CRM doesn't do. …"
      }
    }
  ]
}
```

(Exact `text` values come from `lib/marketing/comparisons.ts` at build time —
this file never duplicates them, so copy edits can't drift from the schema.)

## AEO checklist applied to these pages

- **Direct-answer paragraph first** — each page's `directAnswer` is a
  40–110-word literal answer to "should I choose {vendor} or agentplain?",
  rendered in the hero and quotable in isolation.
- **Citable numbers with sources** — the one penalty figure ($26,262)
  carries its CFR cite inline on the page; every other number stays in
  RESEARCH-NOTES.md.
- **Honest concession up top** — "where {vendor} wins" renders before our
  own column; answer engines reward pages that concede.
- **Vocabulary ownership** — every H1 is "{Vendor} vs run for you" (the
  canonical DIY-vs-run-for-you frame), tying the query space to the
  `/glossary` definitions (`run-for-you-vs-diy`, `draft-then-approve`).
- **Author + dating** — pages inherit the site-wide attribution ("the
  agentplain team"); the hub's "Updated 2026" dateline covers the new cards.
- **Monthly citation check** — add these three URLs and the queries
  "follow up boss alternatives for solo agents", "boldtrail vs building it
  yourself", and "sierra interactive vs doing it yourself" to the 25-query
  AEO audit list.
