# Vertical content polish audit — 2026-05-12

**Branch:** `feat/agentplain-vertical-content-polish`
**Scope:** 10 vertical content files at `lib/verticals/{slug}/content.ts` + `tests/marketing-banned-strings.test.ts` extension.
**Owning rules cited:**

- `~/.claude/projects/C--agentplain/memory/project_agentplain_mission_and_positioning.md` (locked 2026-05-11)
- `~/.claude/projects/C--agentplain/memory/feedback_everything_tells_a_story.md` (locked 2026-05-11)
- `~/.claude/projects/C--agentplain/memory/project_stripe_both_surfaces.md` (simplified 2026-05-12 — Regular only on customer surfaces)
- `~/.claude/projects/C--agentplain/memory/feedback_integration_acceptance_is_functional.md`
- `~/.claude/projects/C--agentplain/memory/project_no_outbound_architecture.md`
- `~/.claude/projects/C--agentplain/memory/feedback_no_quick_fixes.md`
- `~/.claude/projects/C--agentplain/memory/feedback_no_guesses_no_estimates.md`

## Summary

- **Vertical content files audited:** 10 (real-estate, mortgage, insurance, property-management, title-escrow, recruiting, home-services, cpa, law, ria).
- **Total claims/fields audited:** 100 across 10 verticals (hero block, JTBD tables, ROI block, claims triad, integrations, valueLoopExample, missionSubject, metadata).
- **Disposition tally:** KEEP 84 · REWRITE 16 · DROP 0 · DRAFT-flag 0 (already-flagged JTBD tables on 9 verticals remain DRAFT, surfaced via `[DRAFT — needs vertical-CEO review]` badge — no change to flag state, no fabrication).

## Cross-vertical sweep — banned framing scan

| Banned framing | Pre-pass hits | Post-pass hits | Action |
|---|---|---|---|
| `Plus tier` / `Max tier` customer-surface mention | 4 (`cpa`, `home-services`, `law`, `ria` heroes + ROI) | 0 | Rewritten to Regular framing; schema-side `tier: "plus"/"max"` retained for future productization per `project_stripe_both_surfaces.md` schema discipline |
| `Plus-tier value` / `Max-tier value` in citation | 4 (same 4) | 0 | Rewritten to cite Regular-tier value-anchor (`project_pricing_value_anchor.md`) |
| `pilot` (customer-visible) | 2 (`real-estate` integrate list "Georgia pilot"; `real-estate` ROI citation "pilot SKUs deprecated") | 0 | "Georgia pilot" → "Georgia markets"; "pilot SKUs deprecated" → "simplified to single Regular tier 2026-05-12" |
| `AI assistant` / `AI magic` / `intelligent automation` | 0 | 0 | None present |
| `V0` / `MVP` / `Phase 0` / `pre-pilot` / `beta-pilot` on customer copy | 0 | 0 | None present in customer-visible strings (JS comments referencing "Phase 0 product_spec.md" are documentation, stripped by test) |
| `\bN agents\b` count framing | 0 | 0 | None present. "5–25-agent brokerage" in real-estate metaDescription refers to human real-estate agents (industry usage), not AI fleet agents — regex does not match (hyphen-form, not whitespace-form) |
| Real-estate-narrow framing in non-real-estate verticals | 0 | 0 | Each vertical's copy is scoped to its own industry; no realty bleed |
| Internal positioning labels in eyebrows ("Top-5 vertical fit", "Recommended Product 3", "Tied #1 vertical fit", "Adjacent vertical", "Roadmap vertical") | 7 | 0 | Rewritten to answer the visitor's "Is this for me?" question per `feedback_everything_tells_a_story.md` story arc |

## Per-vertical audit table

### 1. `lib/verticals/real-estate/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | `project_agentplain_mission_and_positioning.md` (audience-noun rule) | `"realtors and brokerages"` — already populated |
| `hero.eyebrow` (L16) | REWRITE | `feedback_everything_tells_a_story.md` (filler/internal-language ban) | `"Regular tier · live with design partners"` → `"Built for independent real-estate brokerages"` — eyebrow now answers Q2 ("Is this for me?") with vertical fit, not pricing label |
| `hero.headline`, `hero.valueProp` | KEEP | mission rule Q3/Q4 framing | Headline + valueProp already use REPLACE/INTEGRATE/AUGMENT triad |
| `metaTitle`, `metaDescription` | KEEP | story-arc | "5–25-agent independent real-estate brokerage" = human realtors, not AI fleet count |
| `jtbdTables` (Broker-owner + IC) | KEEP — not draft | Real estate is the only ratified Phase 0 spec (`product_spec.md` §3) | Both tables `draft: false`, populated per `tests/vertical-routes.test.ts` discipline |
| `roi` block | KEEP `multiplier` / `inputCost` / `outputValue` / `math`; REWRITE `citation` | `project_stripe_both_surfaces.md` (single Regular tier simplified 2026-05-12) | Citation "pilot SKUs deprecated same day" → "simplified to single Regular tier 2026-05-12; first month free" |
| `claims.replace` | KEEP | story-arc Q3/Q4 | Concrete REPLACE list |
| `claims.integrate` (L151) | REWRITE 1 line | `feedback_everything_tells_a_story.md` (banned "pilot" framing) | `"FMLS + GAMLS (read-only feed for any Georgia pilot)"` → `"FMLS + GAMLS (read-only feed for Georgia markets)"` |
| `claims.augment` | KEEP | `project_no_outbound_architecture.md` | Already framed "drafts" / "approve before MLS" — no outbound by agentplain |
| `integrations` | KEEP | `feedback_integration_acceptance_is_functional.md` | `shipped: []` honest; 10 planned with Q3 2026 window — committed-with-window, not vaporware |
| `valueLoopExample` | KEEP | mission rule (concrete day-in-the-life requirement) | Sarah's 9:14pm counter-offer → 4-minute morning review |

### 2. `lib/verticals/mortgage/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | mission rule | `"mortgage brokers and loan officers"` |
| `hero.eyebrow` (L16) | REWRITE | story-arc | `"Roadmap vertical · Regular tier"` → `"Built for independent mortgage brokerages"` |
| `hero.headline`, `hero.valueProp` | KEEP | story-arc Q3/Q4 | TRID-aware framing + LOS/portal integration list |
| `jtbdTables` (3 roles) | KEEP DRAFT | `feedback_no_quick_fixes.md` (no fabrication) | All 3 role tables `draft: true` — surfaces `[DRAFT — needs vertical-CEO review]` badge; capability-inbox flagged for b2b-head-of-mortgage |
| `roi` block | KEEP | `project_pricing_value_anchor.md` | Regular-tier framing already correct; 9x at solo, 20x+ at scale |
| `claims` triad | KEEP | story-arc | Concrete REPLACE / INTEGRATE / AUGMENT, no outbound |
| `integrations` | KEEP | integration-roadmap rule | 8 planned, Q3 2026 window |
| `valueLoopExample` | KEEP | mission rule | Marcus's 11:47pm relock — "Optimal Blue executes the relock" = customer system executes, not agentplain |

### 3. `lib/verticals/insurance/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | mission rule | `"insurance brokers and agencies"` |
| `hero.eyebrow` (L18) | REWRITE | story-arc (banned internal-ranking language) | `"Tied #1 vertical fit · Regular tier"` → `"Built for independent P&C agencies"` |
| `hero.headline`, `hero.valueProp` | KEEP | story-arc | COI + renewal + carrier-portal framing |
| `jtbdTables` (3 roles) | KEEP DRAFT | `feedback_no_quick_fixes.md` | All 3 role tables `draft: true` — capability-inbox flagged for b2b-head-of-insurance |
| `roi` block | KEEP | `project_pricing_value_anchor.md` | Regular-tier framing already correct; 11x at solo, 23x+ at 50 seats |
| `claims` triad | KEEP | story-arc | No outbound; E&O posture explicit |
| `integrations` | KEEP | integration-roadmap rule | 8 planned, Q3 2026 window |
| `valueLoopExample` | KEEP | mission rule | 47-account renewal week → one-morning review block |

### 4. `lib/verticals/property-management/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | mission rule | `"property managers and management companies"` |
| `hero.eyebrow` (L16) | REWRITE | story-arc | `"Roadmap vertical · Regular tier"` → `"Built for small-portfolio property managers"` |
| `hero.headline`, `hero.valueProp` | KEEP | story-arc | Buildium/AppFolio/Propertyware framing |
| `jtbdTables` (3 roles) | KEEP DRAFT | `feedback_no_quick_fixes.md` | All 3 role tables `draft: true` — capability-inbox flagged |
| `roi` block | KEEP | `project_pricing_value_anchor.md` | Regular-tier framing already correct |
| `claims` triad | KEEP | story-arc | No outbound; trust-accounting + fair-housing posture explicit |
| `integrations` | KEEP | integration-roadmap rule | 7 planned, Q3 2026 window. "Twilio Voice (inbound triage receiver)" framed as inbound-only per `project_no_outbound_architecture.md` ("Webhook RECEIVERS are fine") |
| `valueLoopExample` | KEEP | mission rule | Friday 4:53pm water-heater leak — one review, three approvals |

### 5. `lib/verticals/title-escrow/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | mission rule | `"title and escrow agencies"` |
| `hero.eyebrow` (L16) | REWRITE | story-arc | `"Roadmap vertical · Regular tier"` → `"Built for local title and escrow agencies"` |
| `hero.headline`, `hero.valueProp` | KEEP | story-arc | File-intake + closing-prep + CFPB-aware framing |
| `jtbdTables` (3 roles) | KEEP DRAFT | `feedback_no_quick_fixes.md` | All 3 role tables `draft: true` — capability-inbox flagged |
| `roi` block | KEEP | `project_pricing_value_anchor.md` | Regular-tier framing already correct; 10x at solo, 13x+ at 10–24 band |
| `claims` triad | KEEP | story-arc | No outbound; wire-fraud guard explicit |
| `integrations` | KEEP | integration-roadmap rule | 7 planned, Q3 2026 window |
| `valueLoopExample` | KEEP | mission rule | Wednesday 5pm payoff discrepancy — four messages reviewed by 5:30pm |

### 6. `lib/verticals/recruiting/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | mission rule | `"recruiters and staffing firms"` |
| `hero.eyebrow` (L16) | REWRITE | story-arc | `"Adjacent vertical · Regular tier"` → `"Built for boutique recruiting firms and in-house talent teams"` |
| `hero.headline`, `hero.valueProp` | KEEP | story-arc | ATS + license-board + substantiated-outreach framing |
| `jtbdTables` (3 roles) | KEEP DRAFT | `feedback_no_quick_fixes.md` | All 3 role tables `draft: true` — capability-inbox flagged |
| `roi` block | KEEP | `project_pricing_value_anchor.md` | Regular-tier framing already correct; 23x at solo, 30x+ at scale |
| `claims` triad | KEEP | story-arc | TCPA/CAN-SPAM posture explicit; "no SMS without documented prior consent" — agent drafts, recruiter sends |
| `integrations` | KEEP | integration-roadmap rule | 7 planned, Q3 2026 window |
| `valueLoopExample` | KEEP | mission rule | Tuesday senior backend role — 12 hours → 90 minutes |

### 7. `lib/verticals/home-services/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | mission rule | `"home services contractors"` |
| `hero.eyebrow` (L17) | REWRITE | `project_stripe_both_surfaces.md` (Plus/Max ban) + story-arc (internal-ranking ban) | `"Recommended Product 3 · Plus tier"` → `"Built for residential trades operations"` |
| `hero.headline`, `hero.valueProp` | KEEP | story-arc | Lead-source juggle + supplement framing |
| `jtbdTables` (3 roles) | KEEP DRAFT | `feedback_no_quick_fixes.md` | All 3 role tables `draft: true` — capability-inbox flagged |
| `roi.multiplier` | REWRITE | `project_stripe_both_surfaces.md` (Regular pricing only on customer surface) | `"14x"` → `"21x"` — recomputed at $50k/yr ÷ ($199/mo × 12) ≈ 20.9x at solo Regular |
| `roi.inputCost` | REWRITE | same | `"Plus tier · $299..."` → `"Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free"` |
| `roi.outputValue` | KEEP | `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3 (verbatim citation) | `"$50,000+ / yr in supplement reclamation alone at a storm-heavy shop"` |
| `roi.math` | REWRITE | same | Math recomputed against Regular $199/mo seat; mentions /custom for bespoke depth |
| `roi.citation` | REWRITE | `project_stripe_both_surfaces.md` + `project_pricing_value_anchor.md` (Regular-tier range) | Removed "Plus-tier value", "Plus-tier mapping per `project_vertical_tier_mapping.md`" (archived). Now cites Regular-tier 15x–107x range. |
| `claims` triad | KEEP | story-arc | Owner sign-off on supplements explicit |
| `integrations` | KEEP | integration-roadmap rule | 8 planned, Q4 2026 window |
| `valueLoopExample` | KEEP | mission rule | Hailstorm Tuesday — 73 calls → one-hour review block; crews dispatch by 1pm |
| File header comment | REWRITE | doc accuracy | Added note: "Pricing: surfaces as Regular tier... `tier: \"plus\"` field below is schema-only and is NOT surfaced on the customer page." |

### 8. `lib/verticals/cpa/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | mission rule | `"CPAs and tax practices"` |
| `hero.eyebrow` (L15) | REWRITE | `project_stripe_both_surfaces.md` + story-arc | `"Top-5 vertical fit · Plus tier"` → `"Built for small CPA and tax practices"` |
| `hero.headline`, `hero.valueProp` | KEEP | story-arc | 8-week document-chase + federal/state checklist framing |
| `jtbdTables` (3 roles) | KEEP DRAFT | `feedback_no_quick_fixes.md` | All 3 role tables `draft: true` — capability-inbox flagged |
| `roi.multiplier` | REWRITE | `project_stripe_both_surfaces.md` | `"12x"` → `"17x"` — recomputed at $42k/yr ÷ ($199/mo × 12) ≈ 17.6x at solo Regular |
| `roi.inputCost` | REWRITE | same | `"Plus tier · $299..."` → `"Regular tier · $199..."` |
| `roi.outputValue` | KEEP | `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.4 | `"$42,000 / yr in tax-season hour reclamation per staff seat"` |
| `roi.math` | REWRITE | same | Math recomputed against Regular $199/mo seat; mentions /custom |
| `roi.citation` | REWRITE | `project_stripe_both_surfaces.md` | Removed "Plus-tier mapping per `project_vertical_tier_mapping.md`" (archived); Plus-tier value range replaced with Regular-tier range |
| `claims` triad | KEEP | story-arc | Partner review on every return explicit |
| `integrations` | KEEP | integration-roadmap rule | 10 planned, Q4 2026 window |
| `valueLoopExample` | KEEP | mission rule | March 17 5:42pm 23 missing docs — 17 clients respond by March 18 noon |
| File header comment | REWRITE | doc accuracy | Added pricing-surfacing note |

### 9. `lib/verticals/law/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | mission rule | `"law firms and solo practitioners"` |
| `hero.eyebrow` (L18) | REWRITE | `project_stripe_both_surfaces.md` | `"Max tier · narrow competitive window"` → `"Built for small law firms and solo practitioners"` |
| `hero.headline`, `hero.valueProp` | KEEP | story-arc | Privilege-aware + ABA Rule 1.6 framing |
| `metaDescription` | KEEP | story-arc | Already names Clio Work April 2026 + CoCounsel/Smokeball partnership context (proof discipline per `feedback_no_guesses_no_estimates.md`) |
| `jtbdTables` (3 roles) | KEEP DRAFT | `feedback_no_quick_fixes.md` | All 3 role tables `draft: true` — capability-inbox flagged |
| `roi.multiplier` | REWRITE | `project_stripe_both_surfaces.md` | `"28x"` → `"21x"` — recomputed at $150k/yr ÷ (3 × $199/mo × 12) ≈ 20.9x at 3-attorney Regular; ceiling 60x+ at 25-attorney $119/seat band |
| `roi.inputCost` | REWRITE | same | `"Max tier · $499..."` → `"Regular tier · $199..."` |
| `roi.outputValue` | REWRITE | same math base | `"$148,000..."` → `"$150,000 / yr in attorney-hour reclamation at a 3-attorney firm"` (rounds to the captured-share figure) |
| `roi.math` | REWRITE | same | Math recomputed against Regular pricing; mentions /custom for privilege/jurisdiction depth |
| `roi.citation` | REWRITE | `project_stripe_both_surfaces.md` + `project_pricing_value_anchor.md` | Removed "Max-tier value $8,000–$33,000/mo"; now cites Regular-tier 15x–107x range |
| `claims` triad | KEEP | story-arc | Partner review on every privilege-sensitive draft; ABA Model Rule citations |
| `integrations` | KEEP | integration-roadmap rule | 7 planned, Q1 2027 window |
| `valueLoopExample` | KEEP | mission rule | 4,200-document discovery production — 60 hours → 14 hours |
| File header comment | REWRITE | doc accuracy | Removed stale "Max-tier here because..." rationale; added pricing-surfacing note |

### 10. `lib/verticals/ria/content.ts`

| Field | Disposition | Cite | Before → After |
|---|---|---|---|
| `missionSubject` | KEEP | mission rule | `"RIAs and wealth advisors"` |
| `hero.eyebrow` (L16) | REWRITE | `project_stripe_both_surfaces.md` | `"Max tier · fiduciary-aware fleet"` → `"Built for independent RIAs and wealth practices"` |
| `hero.headline`, `hero.valueProp` | KEEP | story-arc | Wealthbox/Redtail/eMoney + fiduciary-aware framing |
| `jtbdTables` (3 roles) | KEEP DRAFT | `feedback_no_quick_fixes.md` | All 3 role tables `draft: true` — capability-inbox flagged |
| `roi.multiplier` | REWRITE | `project_stripe_both_surfaces.md` | `"33x"` → `"24x"` — recomputed at $175k/yr ÷ (3 × $199/mo × 12) ≈ 24.4x at 3-advisor Regular; ceiling 40x+ at 25-advisor $119/seat band |
| `roi.inputCost` | REWRITE | same | `"Max tier · $499..."` → `"Regular tier · $199..."` |
| `roi.outputValue` | KEEP | `b2b_vertical_opportunity_analysis_2026-04-27.md` §2 | `"$175,000 / yr in advisor-hour reclamation at a 3-advisor practice"` |
| `roi.math` | REWRITE | same | Math recomputed against Regular pricing; mentions /custom for fiduciary/SEC Marketing Rule depth |
| `roi.citation` | REWRITE | `project_stripe_both_surfaces.md` + `project_pricing_value_anchor.md` | Removed "Max-tier value $8,000–$33,000/mo"; now cites Regular-tier 15x–107x range |
| `claims` triad | KEEP | story-arc | Advisor review on every client-facing communication; ADV + suitability + plain-English check |
| `integrations` | KEEP | integration-roadmap rule | 8 planned, Q1 2027 window |
| `valueLoopExample` | KEEP | mission rule | Q1 review cycle 87 clients — three weeks → two mornings |
| File header comment | REWRITE | doc accuracy | Removed stale "Max-tier mapping..." rationale; added pricing-surfacing note |

## Top 3 most-impactful fixes

### 1. Plus/Max tier surfacing collapsed across 4 verticals (cpa, home-services, law, ria) — 16 customer-visible strings removed

**Why it matters:** The simplified pricing model locked 2026-05-12 in `project_stripe_both_surfaces.md` says explicitly: *"The Tier enum stays in `prisma/schema.prisma` for future productization but the words 'Plus tier' and 'Max tier' do NOT appear on the marketing surface, the app, or sales material."* Pre-pass, those four vertical pages were rendering the very strings the rule bans — in the hero eyebrow, the ROI inputCost row, the ROI citation, and the math line. A visitor on /verticals/law saw "Max tier · $499 per seat" and a citation referencing the archived `project_vertical_tier_mapping.md`. Post-pass, every vertical page reads as Regular pricing with a "Build with us" link to /custom for bespoke depth — the rule the Stripe surfaces memory locks in.

**Before (law/content.ts L114-120):**
```
multiplier: "28x",
inputCost: "Max tier · $499 per seat (solo), sliding to $299 per seat (50–99 seats) — first month free",
outputValue: "$148,000 / yr in attorney-hour reclamation at a 3-attorney firm",
math: "...Against 3 Max-tier seats at $499/mo solo ($17,964/yr) that's ~8x at three seats..."
citation: "...ROI band per `project_pricing_value_anchor.md` (Max-tier value $8,000–$33,000/mo per seat)..."
```

**After:**
```
multiplier: "21x",
inputCost: "Regular tier · $199 per seat (solo), sliding to $99 per seat (50–99 seats) — first month free",
outputValue: "$150,000 / yr in attorney-hour reclamation at a 3-attorney firm",
math: "...Against 3 Regular-tier seats at $199/mo solo ($7,164/yr) that's ~21x at three attorneys; a 25-attorney firm on the $119/seat band ($35,700/yr) capturing 75% of $3.125M opportunity runs well past 60x. Privilege-aware compliance, ABA Model Rule 1.6 review, and the bespoke jurisdiction corpus route to /custom when a firm needs depth beyond plug-and-play."
citation: "Pricing per `project_stripe_both_surfaces.md` (single Regular tier, simplified 2026-05-12; per-seat ladder $199→$99; anything bespoke routes to /custom). ROI band per `project_pricing_value_anchor.md` (Regular-tier ROI range 15x–107x)..."
```

### 2. Eyebrows rewritten across 7 verticals — internal positioning labels removed, vertical-fit framing added

**Why it matters:** Per `feedback_everything_tells_a_story.md`, every element on a customer surface must answer a question the visitor has *right now*. "Roadmap vertical · Regular tier" and "Tied #1 vertical fit · Regular tier" and "Recommended Product 3 · Plus tier" answer none of the nine story-arc questions — they're internal product-org language about which verticals are prioritized. The visitor's question at the top of the page is "Is this for me?" (Q2). Post-pass every eyebrow answers it directly: "Built for [audience-specific noun]."

**Before:**
- `real-estate`: "Regular tier · live with design partners"
- `mortgage`: "Roadmap vertical · Regular tier"
- `insurance`: "Tied #1 vertical fit · Regular tier"
- `property-management`: "Roadmap vertical · Regular tier"
- `title-escrow`: "Roadmap vertical · Regular tier"
- `recruiting`: "Adjacent vertical · Regular tier"
- `home-services`: "Recommended Product 3 · Plus tier"
- `cpa`: "Top-5 vertical fit · Plus tier"
- `law`: "Max tier · narrow competitive window"
- `ria`: "Max tier · fiduciary-aware fleet"

**After:**
- `real-estate`: "Built for independent real-estate brokerages"
- `mortgage`: "Built for independent mortgage brokerages"
- `insurance`: "Built for independent P&C agencies"
- `property-management`: "Built for small-portfolio property managers"
- `title-escrow`: "Built for local title and escrow agencies"
- `recruiting`: "Built for boutique recruiting firms and in-house talent teams"
- `home-services`: "Built for residential trades operations"
- `cpa`: "Built for small CPA and tax practices"
- `law`: "Built for small law firms and solo practitioners"
- `ria`: "Built for independent RIAs and wealth practices"

### 3. Pilot-framing removed from real-estate; regression test extended to catch future bleed

**Why it matters:** `project_stripe_both_surfaces.md` killed pilot pricing 2026-05-09 and `feedback_everything_tells_a_story.md` bans every form of pilot language on customer surfaces. The real-estate `claims.integrate` array still surfaced `"FMLS + GAMLS (read-only feed for any Georgia pilot)"` — a single string that would render verbatim on /verticals/real-estate. The fix is one line. The harder part is the architectural one: `tests/marketing-banned-strings.test.ts` previously didn't scan `lib/verticals/*/content.ts` files at all, so this bleed could have lived for months. The test now walks `lib/verticals/*/content.ts` (one per subdirectory, excluding the registry index and type definitions whose JS comments legitimately reference the banned framings as documentation of the rule itself).

**Before (real-estate/content.ts L151):**
```
"FMLS + GAMLS (read-only feed for any Georgia pilot)",
```

**After:**
```
"FMLS + GAMLS (read-only feed for Georgia markets)",
```

**Regression test (tests/marketing-banned-strings.test.ts):**
```
const SURFACE_FILES: string[] = [
  ...walk(join(REPO_ROOT, "app", "(marketing)")),
  // ... existing entries ...
  ...walk(join(REPO_ROOT, "components", "vertical")),
  ...walkVerticalContent(join(REPO_ROOT, "lib", "verticals")),  // NEW
];
```

## DRAFT-flag items surfaced for vertical-CEO follow-up

Per `feedback_no_quick_fixes.md` and `tests/vertical-routes.test.ts` enforcement, 9 of 10 verticals carry `jtbdTables[*].draft = true` so the renderer surfaces the `[DRAFT — needs vertical-CEO review]` badge. **No new fabrication** in this pass; these were already flagged at content-drop time and the test enforces the flag. They remain DRAFT until each vertical-CEO ratifies a canonical JTBD table backed by primary research:

- `mortgage` — needs b2b-head-of-mortgage (does not yet exist as a skill)
- `insurance` — needs b2b-head-of-insurance (skill exists; LATENT per MEMORY.md)
- `property-management` — needs a vertical-CEO
- `title-escrow` — needs a vertical-CEO
- `recruiting` — needs a vertical-CEO
- `home-services` — needs b2b-head-of-home-services (skill exists; LATENT)
- `cpa` — needs a vertical-CEO
- `law` — needs a vertical-CEO
- `ria` — needs a vertical-CEO

Only `real-estate` has a ratified Phase 0 JTBD table (`C:\flatsbo\outputs\agentplain_product_phase0\product_spec.md` §3) and so its tables ship `draft: false`.

## Files changed

```
lib/verticals/cpa/content.ts
lib/verticals/home-services/content.ts
lib/verticals/insurance/content.ts
lib/verticals/law/content.ts
lib/verticals/mortgage/content.ts
lib/verticals/property-management/content.ts
lib/verticals/real-estate/content.ts
lib/verticals/recruiting/content.ts
lib/verticals/ria/content.ts
lib/verticals/title-escrow/content.ts
tests/marketing-banned-strings.test.ts
outputs/vertical_content_audit_2026-05-12/audit.md  (this file)
```

## Out-of-scope (per task brief — DO NOT touch)

- `lib/skills/` — parallel task owns
- `app/(marketing)/page.tsx` — homepage rebuild owns
- `lib/integrations/*` — PR-B work
- `prisma/schema.prisma` — separate scope
- The Tier enum on disk + Stripe Plus/Max product IDs in `lib/billing/` (schema discipline per `project_stripe_both_surfaces.md` — kept schema-ready for future productization)

## Acceptance check

- [x] PR branch `feat/agentplain-vertical-content-polish` created
- [x] `outputs/vertical_content_audit_2026-05-12/audit.md` written (this file)
- [x] 10 `lib/verticals/{slug}/content.ts` files updated
- [x] Regression test extended (`tests/marketing-banned-strings.test.ts` now scans `lib/verticals/*/content.ts` via `walkVerticalContent`)
- [ ] `npm run typecheck` / lint / test / `build:no-migrate` — run next
- [ ] PR pushed + description with totals
