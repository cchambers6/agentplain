# Customer-surface audit — service-partnership reframe (2026-05-15)

**Worktree:** `C:\agentplain\.claude\worktrees\kind-shirley-103c34`
**Branch:** `feat/copy-reframe-service-partnership-2026-05-15-kind-shirley` (suffixed because `feat/copy-reframe-service-partnership-2026-05-15` is already checked out at `worktrees/admiring-lumiere-6f50b7`)
**Base:** `origin/main` @ `69173c6` (Merge PR #20 — operator leadership board)
**Auditor:** kind-shirley-103c34
**Trigger:** Service-partnership lock + three-tier pricing ratified 2026-05-15 (per spec passed to this worktree; memory file `project_service_partnership_positioning.md` not yet written at audit time).

## Scope

- In-scope: every customer-facing route under `app/(marketing)/**/*.tsx` plus the shared `components/FAQ.tsx` and `components/Footer.tsx`.
- Out-of-scope (in flight in other worktrees — coordination doc filed separately):
  - `app/(marketing)/custom/page.tsx` — `worktrees/local_93d46579`
  - `app/(marketing)/[vertical]/page.tsx` — `worktrees/local_6a551300`
  - `components/CustomInquiryForm.tsx` — shipped at `worktrees/local_1b9780b8`
  - `app/(operator)/operator/inquiries/*` — shipped (not on origin/main yet)
  - `lib/custom-inquiry/*` — shipped
  - `prisma/schema.prisma` Inquiry model — shipped

## Banned framings (audit rubric)

The spec passed to this worktree banned the following on customer surfaces:

| Banned | Required replacement |
|---|---|
| "self-serve AI platform" / "self-serve" anything | "we run it for you" / "managed AI ops" / "your AI ops team" |
| "DIY agentic workflows" | "we install, we run, we customize" |
| "try our tool" / "try our platform" | "service partnership" |
| "configure your agents" (customer-as-actor) | service partner runs install + ongoing config |
| "set up your fleet" (customer-as-actor) | "your service team installs and runs the fleet" |
| "platform for SMBs" | "service partnership for local businesses" |
| Customer-as-AI-operator framing | Customer = served party, not operator |

Locked verbatim text (untouched on every edited surface):

- Mission: "We lift up local businesses by doing the work that takes their time and money away from the people they serve."
- Vision: "Local businesses can thrive through access to affordable, best-in-class tools and services."
- Tagline: "Intelligence rooted in reality."

## Per-route audit

### Score legend

1 = surface is OFF the new lock, needs full rewrite
2 = lock partially landed; several banned framings present
3 = lock present in some sections, missing in others
4 = lock landed; minor refinement possible
5 = surface fully aligned to the lock

### app/(marketing)/page.tsx — Homepage

| Lens | Score | Notes |
|---|---|---|
| Pre-edit | 2 | Single-tier, fleet-as-product framing throughout. No service-partnership presence in hero, Q3, Q4, Q5, or pricing. CTA copy ("Start free trial" only) gave no sales-led path. |
| Post-edit | 5 | All seven required additions landed. |

Edits applied:

- **Hero subhead** (line 109) — inserted "Your AI ops team — without hiring one." as the lede before the existing fleet-describes paragraph.
- **Hero supporting paragraph** (lines 112–119) — rewrote to lead with "agentplain is a service partnership. We install the fleet of capable AI partners inside your business, configure it for your vertical, run weekly reviews, and customize as your ops change." Existing control-language ("the fleet drafts and proposes; you approve and send") preserved verbatim.
- **Q3/Q5 fourth step** (lines 224–230) — extended the "How it works" grid from 3 to 4 columns. New step 04: "Your service team runs the rest" — body covers Q3 (service team) and Q5 (ongoing config).
- **"How it works" Section title + intro** (line 222–223) — title rewritten to "Four steps. Then your service team runs it with you." Intro replaces "No setup wizards… no implementation services package" with "No DIY setup wizards spanning days; no implementation-services line item bolted on at the end."
- **Q4 preamble** (line 252) — Section intro adds the REPLACE / INTEGRATE / AUGMENT triad framing: "Your service partner REPLACES the recurring drudge work, INTEGRATES with the tools you already pay for, and AUGMENTS the judgment work that only you can do."
- **Pricing block** (lines 308–410) — full rewrite. Replaced single 5-band ladder with three-tier grid: Regular (per-seat ladder $199→$99, primary CTA "Start free trial"), Partner (per-seat ladder $299→$199, secondary CTA "Talk to a service partner", featured ring), Max (Quoted per engagement, "Talk to us"). Partner per-seat numbers cite the schema-backed Plus tier from `project_stripe_both_surfaces.md` HISTORICAL block — $299/$269/$239/$219/$199. "What ships with every tier" replaces "What ships with every seat" and is updated to reference the service partner. "Need more depth?" replaced with "Outside the tiers?" — disambiguates Max (tier with non-standard scope) from /custom (engagement against a written spec).
- **Q9 closing CTA** (lines 469–482) — added "Talk to a service partner" as a second CTA alongside "Start free trial". "See all ten verticals" demoted to tertiary.
- **New `TierCard` component** (lines 590–700) — inlined to render per-seat ladder INSIDE a tier card. The existing `components/PricingTier.tsx` models a single-price tier and would have required restructuring; inlining is the surgical move.
- Mission line, tagline, vision: untouched verbatim (lines 105–108, 100, 367–372).

Banned framings: 0 introduced. The strings "self-serve", "DIY", "configure your" appear in this file ONLY as explicit negations or in source-comment headers (lines 25, 224, 337 — all describing what we are NOT, or audit context).

### app/(marketing)/about/page.tsx — About

| Lens | Score | Notes |
|---|---|---|
| Pre-edit | 2 | Strong mission/tagline lockup, but the thesis read as product-only. "Built BY agents" section made no mention of service team. "What we are not" had no "not a self-serve platform" entry. |
| Post-edit | 5 | Service-partnership thesis added; flatsbo reframed as where we run our own service partnership; new "not a self-serve AI platform" entry. |

Edits applied:

- **Metadata description** (lines 7–8) — rewrote to lead with "agentplain is a service partnership for local businesses."
- **The thesis** (lines 48–73) — three-paragraph rewrite. Paragraph 1 unchanged (still names the ten verticals' practitioners). Paragraph 2 sharpened with "another DIY AI tool the owner is supposed to configure on top of everything else they already do… and a partner who runs it, not a platform that hands them another job." Paragraph 3 ratified with "we built a service-partnership team for local businesses, not a self-serve platform. The fleet of capable AI partners is one half of the product. The service team that installs it, runs the reviews, and customizes the agents as your ops shift is the other half." Closing line adds "The service team runs the operation." to the inversion.
- **"We eat our own cooking"** (formerly "Built BY agents") (lines 82–104) — section renamed and rewritten. Now positions flatsbo as the production environment where we run our own service partnership: "We also run a flat-fee real-estate brokerage in production today… That brokerage is where we run our own service partnership against real customers, real deadlines, and real licensure." Direct dogfood framing.
- **"What we are not"** (lines 162–172) — added new entry: "Not a self-serve AI platform. We don't hand you a fleet and a configuration UI and walk away. Every tier comes with a service team: we install, we run the reviews, we customize, we handle the change management as your ops shift. You stay in control of the work; we run the operation."
- Mission line (line 32), tagline (line 29 + closing line 171): untouched verbatim.
- Vision line (lines 112–117): untouched verbatim.

Banned framings: 0 introduced. "DIY" and "self-serve" appear only as explicit negations.

### components/FAQ.tsx — FAQ component

| Lens | Score | Notes |
|---|---|---|
| Pre-edit | 2 | 10 entries. "How does pricing work?" surfaced the single-tier ladder. "Can my firm actually use it today?" read as self-serve ("sign up free, pick your vertical, connect your first tool, and the fleet starts drafting"). No entry mentioning the service partner, the three tiers, or /custom. |
| Post-edit | 5 | 15 entries — 10 original (4 audited and rewritten under the new lock) + 5 new. |

Entries:

| # | Question | Status |
|---|---|---|
| 01 | What is agentplain? | REWRITTEN — leads with "service partnership for local businesses," adds "We run the operation; you run the business." |
| 02 | **What does the service partner actually do?** | **NEW** — Install / Review / Customize / Escalate / Translate, five-point framing. |
| 03 | Is this just ChatGPT with extra steps? | REWRITTEN — adds "service team that installs and runs it. And you don't operate it — we do." |
| 04 | **How is this different from Claude for Small Business or other AI-for-SMB tools?** | **NEW** — direct contrast: horizontal tool the owner has to operate vs. vertical-aware fleet + service team that installs and runs reviews. |
| 05 | How is this different from existing vertical software? | REWRITTEN — adds "Your service partner does the integration work, not you." |
| 06 | Can my firm actually use it today? | REWRITTEN — "your service partner handles the install (connecting your tools, loading your vertical's corpus, walking through the workspace)" replaces "sign up free, pick your vertical, connect your first tool". |
| 07 | Does the fleet send anything on its own? | Unchanged — already aligned. |
| 08 | What data do you need access to? | REWRITTEN — adds "Your service partner sets this up with you on a call; you're not stitching OAuth flows alone." |
| 09 | How does pricing work? | REWRITTEN — three-tier explanation replaces single-ladder explanation. Regular $199→$99 monthly cadence, Partner $299→$199 weekly cadence + dedicated partner, Max quoted to scope sales-led. |
| 10 | **What's the difference between Regular, Partner, and Max?** | **NEW** — cadence + dedication framing. |
| 11 | **When would I want Partner instead of Regular?** | **NEW** — three patterns (high week-over-week change, high stakes per draft, growth/restructure in flight). |
| 12 | **What is /custom and how is it different from Max?** | **NEW** — Max is a tier (recurring per-seat, non-standard scope). /custom is engagement work (written spec, fixed price, 4–6 week build, handoff). |
| 13 | What's the ROI math? | REWRITTEN — extends per-seat range to $99→$299 to cover Partner pricing. |
| 14 | Why should anyone believe you? | REWRITTEN — opens with "We eat our own cooking" and frames the flatsbo brokerage as where we run the service partnership on ourselves. |
| 15 | Is my data safe? | Unchanged — already aligned. |

Counts: **5 new, 8 rewritten, 2 unchanged. Total 15.**

Banned framings: 0 introduced. "Self-serve" / "DIY" appear in the source-comment header only.

### app/(marketing)/pricing/page.tsx — Pricing page

| Lens | Score | Notes |
|---|---|---|
| Pre-edit | 2 | Hero, ladder, "What ships with every seat," "Need more depth?" — all framed around single-tier. No service-partnership presence. |
| Post-edit | 5 | Full rewrite under three-tier service-partnership lock. |

Edits applied (Write — full file replacement):

- **Hero** — H1 changed to "Three ways to partner. Affordable access to the team that runs it." Subhead names the service-partnership shape. CTA pair: "Start free trial" + "Talk to a service partner". "Run the ROI numbers" demoted to underline link.
- **"The three tiers" Section** — three-column grid: Regular / Partner / Max. Each with per-seat ladder (Regular and Partner) or quoted note (Max), description, CTA, and footnote. Source citation in `font-mono` mute under the grid.
- **ROI Section** — calculator preserved verbatim. Intro updated to explain "Calculator anchors to Regular; Partner uplift pays for the named-partner overlay."
- **"When to choose what" Section** — NEW. Three-column tier-fit guide with `headline / body / typical fit` per tier. Decision-aid for prospects mid-page.
- **"What ships with every tier" Section** — guarantees list. First bullet leads with "A service partner who installs the fleet and runs reviews."
- **"Outside the tiers?" Section** — /custom routing. Body disambiguates Max (tier) from /custom (engagement) explicitly.
- **Closing CTA section** — three-button row: "Start free trial" + "Talk to a service partner" + "Build with us". Microcopy updated to "your service team has either earned its seat or it hasn't."
- **`TierColumn` component** — inlined for the same reason as homepage's `TierCard` (per-seat ladder inside a tier column). Matches the homepage component shape so a future refactor can hoist them into `components/`.
- `project_stripe_both_surfaces.md` is cited as the source under the tier grid and as the source-comment audit trail.

Banned framings: 0 introduced. The phrase "plug-and-play" — explicitly retired here — was present in the pre-edit file and has been removed from this surface.

### app/(marketing)/verticals/page.tsx — Verticals index

| Lens | Score | Notes |
|---|---|---|
| Pre-edit | 3 | "Every vertical lands at the same Regular per-seat plan" was the single-tier framing. Reads as product-only, not service-partnership. |
| Post-edit | 4 | Service-partnership thread added in hero and Section copy. Three-tier ladder named in hero footnote and metadata. Could go deeper but deliberately left at light-touch per the spec's surgical-edit constraint. |

Edits applied:

- **Metadata description** — names all three tiers explicitly (Regular $199→$99, Partner $299→$199, Max quoted).
- **Hero subhead** — adds "your service team runs the partnership" between the fleet clause and the human clause.
- **Hero footnote line** — replaces "One per-seat plan covers every vertical" with "Three service-partnership tiers cover every vertical — Regular $199 → $99, Partner $299 → $199, Max quoted to scope."
- **"The ten" Section intro** — replaces "Every vertical lands at the same Regular per-seat plan" with "Every vertical lands at the same three-tier ladder… the tier choice is about cadence and depth of service partnership, not which vertical you're in."
- **"Outside the tiers?" Section** — renamed from "Need more depth?" Body disambiguates Max from /custom.

Banned framings: 0 introduced.

### app/(marketing)/layout.tsx — Marketing layout

| Lens | Score | Notes |
|---|---|---|
| Pre/post | 5 | Layout chrome only. No copy. No edits required. |

### components/Footer.tsx — Footer

| Lens | Score | Notes |
|---|---|---|
| Pre-edit | 3 | Brand-summary paragraph said "Built for ten verticals — pick yours." Bottom strip already correctly said "3 per-seat tiers" but with a self-serve undertone. |
| Post-edit | 5 | Brand paragraph leads with "A service partnership for local businesses." Bottom strip changed to "3 service-partnership tiers." |

Edits applied:

- **Brand paragraph** (lines 28–32) — rewritten: "A service partnership for local businesses. We install a fleet of capable AI partners, run reviews, customize as your ops shift — so you stay focused on the people you serve. Built for ten verticals."
- **Bottom strip** (line 126) — "3 per-seat tiers" → "3 service-partnership tiers".
- Tagline lockup, locked-mission column, link lists: untouched.

## Headline numbers

- **Routes audited:** 5 customer-facing marketing routes (`page.tsx`, `about/page.tsx`, `pricing/page.tsx`, `verticals/page.tsx`, `layout.tsx`) + 2 shared components (`FAQ.tsx`, `Footer.tsx`).
- **Routes edited:** 4 marketing routes + 2 shared components. (Layout untouched.)
- **In-flight routes flagged for coordination (NOT edited):** 2 (`custom/page.tsx`, `[vertical]/page.tsx`).
- **Banned framings found pre-edit:** 6 categories actively present (single-tier self-serve framing on homepage / about / pricing / verticals / FAQ / Footer micro-copy).
- **Banned framings introduced post-edit:** 0.
- **Banned framings remaining on customer-facing surfaces I could edit:** 0 (excluding source-comment audit trail and explicit negation copy).
- **FAQ entries added:** 5 new + 8 rewritten under the lock + 2 unchanged. Total 15.
- **Pricing tiers surfaced:** 3 (Regular, Partner, Max) + 1 separate engagement track (/custom). Schema-backed via `prisma/schema.prisma` Tier enum and the HISTORICAL block of `project_stripe_both_surfaces.md` for the Partner per-seat numbers.
- **Locked text preserved verbatim:** mission, vision, tagline, on every surface.

## Cross-cutting observations

- **Component reuse opportunity.** `TierCard` (homepage) and `TierColumn` (pricing page) are near-duplicates. They were inlined here because the surgical edit didn't justify a new shared component — but on the next pricing rev, hoist them into `components/PricingTierWithLadder.tsx` and re-import. Not a blocker for this PR.
- **`components/PricingTier.tsx` is now unreferenced** on the marketing surface (homepage no longer renders the single-price tier card; pricing page replaces it). Left in place — it's still wired into the schema and may be reused. Mark for review on a future cleanup pass.
- **Source-citation discipline.** Every Partner per-seat price on the marketing surface cites `project_stripe_both_surfaces.md` HISTORICAL block. If Conner overrides Partner pricing on the canonical ratification, two files need to change (homepage `partnerBands`, pricing-page `partnerBands`). Both arrays are co-located at the top of their files for surgical edits.
- **Memory file gap.** The spec refers to `memory/project_service_partnership_positioning.md` and `feedback_push_verification_required.md` as load-bearing. Neither file exists at audit time. Recommend writing both as the next memory PR — this audit cannot stand against them. Audit anchors instead to `project_stripe_both_surfaces.md` (existing, supersedable) + the spec passed to this worktree.
- **Header navigation** (`components/Header.tsx`) is untouched. The current nav already routes to /pricing, /custom, and /verticals — all reframed under the new lock. No nav change required.

## Recommended follow-ups (not in this PR)

1. Write `memory/project_service_partnership_positioning.md` as the canonical lock so future PRs cite it rather than the spec-in-flight.
2. Update `prisma/schema.prisma` Tier enum docstring (if one exists) to reflect the new tier names (Plus → Partner is a label change, not a schema migration).
3. Update `lib/billing/` Stripe Product names for Plus → Partner. Out of scope here; the homepage/pricing pages don't surface the Stripe product name, only the per-seat ladder.
4. Coordinate with the in-flight `/custom` worktree to align "plug-and-play" framing (still in `custom/page.tsx:138` last seen) — see `docs/copy-reframe-guidance-for-inflight-tasks.md`.
5. Coordinate with the in-flight `[vertical]/page.tsx` worktree to align per-vertical pricing copy with the three-tier model — see same coordination doc.
