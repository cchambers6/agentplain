---
name: Stripe billing — three customer-facing tiers (Regular / Partner / Max) under service-partnership lock
description: LOCKED 2026-05-15 by Conner ratification. Three customer-facing tiers as response to Anthropic Claude for Small Business launch — Regular (productized, $99-$199/seat, onboarding bundled), Partner (productized, $199-$299/seat, 4 hrs/mo named-service-partner time), Max (AD-HOC quote-based for higher service intensity), plus /custom for bespoke capability builds. Supersedes the prior simplified Regular-only model (2026-05-12). All tier infra already provisioned in `lib/pricing/tiers.ts` — activation is a marketing + product surface change, not a Stripe schema change.
type: project
ratified: 2026-05-15
priority: load-bearing
supersedes: the 2026-05-12 simplified Regular-only model (kept in HISTORICAL section below for context)
mirror_of: orchestrator-side `project_stripe_both_surfaces.md` (canonical)
---

> Mirror of orchestrator-side canonical at
> `C:\Users\conne\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions\<session>\agent\memory\project_stripe_both_surfaces.md`.
> Synced 2026-05-15 to bring the agentplain repo's local memory in line with the
> orchestrator-side ratification. Source of truth for any conflict is the
> orchestrator file; this mirror exists so fleet agents working inside this
> repo can read the pricing structure without leaving the codebase.

## RATIFIED STRUCTURE (2026-05-15)

Conner ratified all 5 questions from the pricing rethink (`docs/strategic-response/2026-05-15-pricing-restructure.md`) plus one nuance: Max becomes ad-hoc.

### The three customer-facing tiers

| Tier | Pricing | Service intensity | Customer-facing description |
|---|---|---|---|
| **Regular** | $99-$199/seat (ladder by volume) | Standard managed AI ops + onboarding bundled in | "We install. We run. We customize standard skills for you." |
| **Partner** | $199-$299/seat (ladder by volume) | Named-service-partner with 4 hrs/mo reserved time | "Same as Regular, plus your named partner with reserved hours each month for skill iteration, deeper integration, and monthly business review." |
| **Max** | **AD-HOC quote-based** | High-intensity service / multi-state ops / white-label / dedicated team | "Quote-based engagement when Partner's reserved hours aren't enough. Scoped per customer." |

Plus the separate **/custom** path for bespoke capability builds ($5K-$15K + $200-$500/mo maintenance) — unchanged. /custom and Max differ in shape: Max = MORE SERVICE INTENSITY at standard skill scope; /custom = BUILD NEW CAPABILITIES we don't have yet. A customer can be on Max AND have a /custom engagement.

### Per-tier ladder (verbatim from existing `lib/pricing/tiers.ts` Plus row)

| Volume | Regular | Partner | Max |
|---|---|---|---|
| 1 seat (solo) | $199 | $299 | quote |
| 2-9 seats | $179 | $279 | quote |
| 10-24 seats | $149 | $249 | quote |
| 25-49 seats | $119 | $219 | quote |
| 50-99 seats | $99 | $199 | quote |
| 100+ seats | enterprise (quote) | enterprise (quote) | quote |

First month free across Regular + Partner. Month-to-month from day one. Max is custom-quoted month-to-month or annual per engagement.

### Schema vs display naming — load-bearing

The Prisma enum and the in-code `TierName` union STAY as `regular` / `plus` / `max`. The customer-facing string for `plus` is **"Partner"**. This is intentional: changing the schema enum would force a Stripe Subscription metadata migration, a DB migration, and a setup-script rerun against existing Prices — none of which is justified for a marketing-name change. The translation lives in one place: `tierDisplayName()` in `lib/pricing/tiers.ts`, which maps `regular → "Regular"`, `plus → "Partner"`, `max → "Max"`. Stripe Product names follow the display translation via `tierProductName()`.

Do not write hardcoded `"Plus"` strings in customer-facing surfaces. Always go through `tierDisplayName()` so a future rename moves in one file. (`feedback_no_silent_vendor_lock.md` applies — single source of truth.)

## Ratified decisions (verbatim Conner answers 2026-05-15)

1. **Activate Plus tier as customer-facing "Partner"?** → YES
2. **Bundle onboarding into Regular at no separate charge?** → YES
3. **Per-vertical pricing differentiation?** → NO
4. **Introduce a freemium tier?** → NO
5. **Activate Max as a third paid tier now?** → YES, but **AD-HOC pricing** (not a fixed published price-per-seat)

## Why this shape works

- **Regular** answers Anthropic at the entry tier: $99-$199 for "managed AI ops + onboarding" vs Anthropic's $0 for "DIY tool with no service." The service-partnership framing justifies the spread.
- **Partner** closes the structural gap between Regular ($199 ceiling) and Max ($5K+ engagements). Solo brokerages / mid-vertical firms with 5-25 seats that need more service intensity than Regular's standard cadence now have a productized path instead of falling out the funnel to Anthropic or to a quote conversation they're not ready for.
- **Max as ad-hoc** is right because: high-intensity engagements vary too much (multi-state ops, white-label, dedicated team, regulated-vertical compliance gates) for a fixed seat price to fit cleanly. Quote-based protects margin AND lets the conversation surface real scope. Maps cleanly to existing /custom intake flow.
- **/custom** stays distinct because building new capabilities ≠ adding service intensity. A real-estate brokerage might subscribe to Max (high-touch service) AND have a /custom engagement (custom MLS scraping skill we built for them).

## Customer-facing pricing page surface

Three tier cards on /pricing:
1. **Regular** — full price list visible
2. **Partner** — full price list visible
3. **Max** — "Quote-based for higher service intensity" + CTA "Talk to a service partner" (routes to same intake flow as /custom or its own intake)

Plus the small "Need a custom build?" link to /custom for the capability-build path.

## Stripe Product changes required

**Zero schema changes:**
- `Regular` Products + 6 Prices: already exist
- `Partner` Products + 6 Prices: provisioned (under the on-disk `plus` lookup keys) but not activated — surface only
- `Max`: do NOT need Stripe Products at all — quote-based engagements bill via Stripe Invoices (one-off + recurring) using existing `agentplain-custom-build-base` + `agentplain-custom-build-maintenance-monthly` Products. New customer-facing label "Max" is a UI string only.

Cosmetic: rename the `agentplain_plus` Product display name in Stripe dashboard to "Partner" via the `tierProductName()` helper output (which already returns "agentplain Partner").

## App-side changes required

- Sign-up flow (`/app/sign-up`): tier toggle Regular | Partner | "Talk to us about Max"
- Billing settings: show current tier + upgrade/downgrade to other productized tier; Max upgrade routes through quote flow
- `RoiCalculator`: add tier toggle (Partner adds named-partner-hours value to the math)
- Operator UI: marks workspace `vertical_tier ∈ {Regular, Partner, Max}` already supported

App-tier-picker work landed in `feat/app-three-tier-billing` (`local_3c115f03`, branch HEAD `2d861a0`). The display-name translation is in place; remaining work is propagating customer-facing strings (vertical content modules, marketing copy) — owned by THIS chore branch.

## Marketing site surface changes

Reframe shipped on `feat/copy-reframe-service-partnership-2026-05-15` (`local_d94b4ed8`, HEAD `508fb9b`). Key edits already landed:
- /pricing — three-card layout (Regular | Partner | Max), Regular and Partner have full ladder visible, Max says "Quote-based"
- Homepage Q3 ("What's the app") + Q5 ("Why easy") + pricing block — references Partner tier as the named-service-partner offering
- FAQ — pricing entry rewritten under three-tier lock
- /custom — clarifies difference between Max and /custom (service intensity vs capability build)
- About + Footer — updated under service-partnership thesis

Vertical content modules (`lib/verticals/<slug>/content.ts` × 10) still reference Regular-only-tier copy from the 2026-05-12 simplification — owned by THIS chore branch.

## Top friction risk

Solo owner-operator at /pricing might down-select to Regular when actual fit is Partner. Mitigation: Partner card leads with "for customers who want named-partner reserved hours" (service-intensity choice) not "for customers with more needs" (feature-tier upsell). Wrong copy here turns the structural fix back into a funnel leak.

## When to revisit

- After ~20 paid Partner customers — assess whether Partner pricing should rise, fall, or stay; whether Max should productize at a specific seat count
- After any vertical hits 10+ customers — assess whether per-vertical pricing differentiation has signal (rule 3 currently NO)
- If Anthropic adds a service-tier — re-read this whole memory and re-ratify

## Compounds with

- `project_service_partnership_positioning.md` (orchestrator) — the lock this pricing structure operationalizes
- `project_agentplain_mission_and_positioning.md` — mission verbatim still applies; pricing serves it
- `feedback_max_friction_reduction_for_trials.md` — first-month-free + month-to-month preserved
- `feedback_low_friction_over_margin.md` — Regular onboarding bundled per this rule
- `project_pricing_value_anchor.md` — 15-107x ROI math still anchors all three tiers
- `feedback_no_silent_vendor_lock.md` — pricing model stays Stripe-agnostic via BillingProvider interface; tier display name lives in ONE helper, not scattered strings
- `feedback_brand_is_plain_not_plane.md` — Regular/Partner/Max language stays grounded/heritage; banned phrasing (cloud, scale, deploy, blitzscale) does not appear in pricing copy

## Compounds with — implementation tasks

- `local_d94b4ed8` (Customer copy reframe) — DONE on `feat/copy-reframe-service-partnership-2026-05-15`
- `local_0dd3427b` (/custom page build) — Max-vs-/custom distinction landed
- `local_b0a0d505` (10-vertical route shell) — content modules still reference Regular-only copy
- `local_3c115f03` (App-side tier picker) — DONE on `feat/app-three-tier-billing`; `tierDisplayName()` helper introduced
- THIS chore branch (`chore/sync-tier-names-vocab`) — propagates Partner/Max naming to vertical content + any leftover hardcoded `"Plus"` strings, mirrors orchestrator memory into the repo

## CHANGELOG

- 2026-05-15: Mirrored from orchestrator canonical (this file). Reflects 2026-05-15 ratification — 5 questions answered + Max-as-ad-hoc nuance added in response to Anthropic Claude for Small Business launch. Supersedes the 2026-05-12 simplified Regular-only model (preserved below as HISTORICAL context).
- 2026-05-12: Simplified to Regular-only + /custom (preserved below). NOW SUPERSEDED.
- 2026-05-09: Three-tier productized (Regular/Plus/Max all productized per-seat). DEPRECATED — Max is now ad-hoc, not productized; Plus is now Partner.

---

## HISTORICAL (SUPERSEDED 2026-05-15) — 2026-05-12 simplified Regular-only model

The 2026-05-12 model below was the pricing model from 2026-05-12 → 2026-05-15. It was a simplification of the earlier 3-tier productized model (Regular/Plus/Max all productized). The 2026-05-15 ratification REACTIVATES the 3-tier shape but with Max as ad-hoc (not productized) and Plus renamed to Partner.

Conner 2026-05-12 in Dispatch: "What if we just started with normal and expansions or custom work was adhoc?" + "Regular should be plug and play. Should require almost nothing from us. Download and go."

ONE productized tier (Regular, $99-$199/seat, plug-and-play, zero-touch) + custom engagements ad-hoc per scope via /custom.

WHY THIS WAS SUPERSEDED: Anthropic Claude for Small Business launch (2026-05-13) created a structural gap. Anthropic's $0 horizontal-SMB tool commoditized the entry layer, and our $99-$199 Regular tier had no productized step-up path — customers either stayed at Regular or jumped to a $5K+ /custom conversation. The 2026-05-15 ratification reintroduces Partner ($199-$299, named-service-partner) AND Max (ad-hoc) to close that gap and operationalize the service-partnership lock.

---

## DEPRECATED — DO NOT USE — 2026-05-09 three-tier productized model

The 2026-05-09 model had Regular/Plus/Max all productized at fixed per-seat prices:
- Regular $199 → $99
- Plus $299 → $199
- Max $499 → $299

This model is DEPRECATED. The 2026-05-15 model is the source of truth. Specifically:
- Plus is renamed Partner (same per-seat ladder $299 → $199)
- Max is now QUOTE-BASED, not productized at $499 → $299

The Stripe Products from this 2026-05-09 model still exist in code (`lib/pricing/tiers.ts`) and that's fine — the 2026-05-15 model uses the Plus row infra for Partner. The Max Products from 2026-05-09 (if they were created) should be removed or repurposed for invoicing-only flow.
