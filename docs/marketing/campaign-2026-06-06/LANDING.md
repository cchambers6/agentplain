# Landing Page & A/B Test Plan — agentplain Wave 1, 2026-06-06

> Each flagship concept gets a dedicated landing page at **`/promo/[slug]`**. This document is
> the **build brief + experiment plan** — it is a spec, not app code (this PR is doc-only). The
> pages reuse existing primitives: the live `RoiCalculator` component
> (`components/RoiCalculator`, imported in `app/(marketing)/page.tsx` L4) and the marketing
> `Section`/card primitives (`components/marketing/HomeCards.tsx`).
>
> **Conversion goals (both real in-product events):**
> 1. **Talk-to-Plaino chat opened** — micro-conversion / upper-funnel intent.
> 2. **Trial start** — `/app/sign-up` completion — the **primary success metric**.
> (`app/(marketing)/page.tsx` L138, L504, L618; `project_no_outbound_architecture.md`.)
>
> **Story-arc discipline:** every section earns its place against the visitor's question order
> (`feedback_everything_tells_a_story.md`). A `/promo/[slug]` page is a *focused* arc — it answers
> "is this for me → what changes → why believe → what's it cost → what do I do now" for ONE
> persona, then offers the "not your industry? pick yours →" escape hatch (page-one-verticals
> rule).

---

## Shared page skeleton (all three `/promo/` pages)

| Order | Section | Purpose (visitor question) | Notes |
|---|---|---|---|
| 1 | **Hero** — concept headline + the scene line + primary CTA | "Is this for me?" | Headline from COPY.md; one-line scene; CTA = Start free trial. UTM-aware. |
| 2 | **The scene** — the day-in-the-life beat, expanded | "What actually changes?" | Mirrors the video; before/after split (reuse the homepage two-column hairline pattern). |
| 3 | **How it works** — Read → Categorize → Coordinate → Schedule → Draft | "How?" | Reuse the 5-step pattern (`page.tsx` L207-233); compressed. |
| 4 | **Control beat** — "Nothing leaves without your name on it." | "Is it safe / am I in control?" | The no-outbound promise; Plaino footer; the single most important trust beat. |
| 5 | **ROI calculator** — `RoiCalculator`, pre-seeded to the concept's vertical | "What's it worth to me?" | Placement is the #1 test variable (see below). |
| 6 | **Proof** — 1–2 proof cards (eat-our-own-cooking + ROI-math-not-vibes) | "Why believe you?" | Reuse `proof` content (`lib/marketing/home-content.ts` L104-125). |
| 7 | **Pricing teaser** — Regular ladder + "first month free" | "What's it cost?" | Regular band; "Talk to a service partner" for Partner-tier verticals (P2). |
| 8 | **Closing CTA** — repeat primary + "not your industry? pick yours →" | "What do I do now?" | Trial start primary; vertical escape hatch mandatory. |

---

## Page 1 — `/promo/before-you-open-the-laptop` (C1 · realty · P1/P4)

- **Hero headline (control):** "The work was done before your coffee was."
- **Scene:** Sarah's 9:14pm counter-offer → 4 minutes at 6:30am (`real-estate/content.ts` L260-269).
- **ROI calculator seed:** vertical = real estate; default to broker-owner / 1 seat; shows the
  26× / ~$5,300/mo result (`real-estate/content.ts` L213-217).
- **Primary conversion goal:** trial start. **Secondary:** talk-to-Plaino.
- **Pricing CTA:** Regular ladder, "Start free trial — first month free."

## Page 2 — `/promo/we-run-it-for-you` (C2 · regulated finance · P2)

- **Hero headline (control):** "Claude gives you the tool. We run it for you."
- **Scene:** March 17 doc-chase, 19 drafts reviewed in 35 min (`cpa/content.ts` L310-318).
- **Extra section (P2-specific):** the **two-column "you get the tool / we run it for you"**
  contrast (reuse `chatbotContrast`, `home-content.ts` L76-97) — this is the objection this
  persona arrives with, so it gets dedicated real estate above the calculator.
- **ROI calculator seed:** vertical = CPA; shows 12× / ~$42,000/yr per seat (`cpa/content.ts` L260-264).
- **Primary conversion goal:** talk-to-Plaino (P2 is consultative; Partner tier is sales-assisted)
  — with trial start as the equally-weighted secondary. *This is the one page where the primary
  micro-conversion is talk-to-Plaino, given Partner-tier economics.*
- **Pricing CTA:** Partner tier framing, "Talk to a service partner"; Regular "Start free trial"
  as the lighter path.

## Page 3 — `/promo/the-73-call-tuesday` (C5 · trades · P3)

- **Hero headline (control):** "73 calls before lunch. None of them dropped."
- **Scene:** the hailstorm — 73 calls, 41 ranked, crews out by 1pm (`home-services/content.ts` L317-325).
- **ROI calculator seed:** vertical = home services; shows 14× / $50,000+/yr supplements
  (`home-services/content.ts` L269-271).
- **Storm-mode variant:** a lighter, faster-loading cut of the page for storm-trigger geo
  traffic (hero + scene + calculator + CTA only) — matches the 15s storm ad. Mobile-first; this
  traffic is overwhelmingly phone, often on poor connections.
- **Primary conversion goal:** trial start. **Secondary:** talk-to-Plaino.
- **Pricing CTA:** Partner tier ("Talk to a service partner") + Regular "Start free trial."

---

## A/B test plan

> One primary variable per test, sequential not simultaneous (Wave-1 traffic won't support
> multivariate). Each test runs to a pre-registered sample/decision rule, not "until it looks
> good." Decision metric is **trial-start CVR** unless noted; talk-to-Plaino is the guardrail
> secondary.

### Test 1 — Headline (all 3 pages, run first)
- **Variants:** the 3 headlines per concept from COPY.md (H1/H2/H3).
- **Hypothesis:** the *scene-specific* headline (H1) beats the *generic-benefit* headline (H3)
  for cold traffic, because concrete beats abstract (`feedback_everything_tells_a_story.md` L78).
- **Success metric:** trial-start CVR; ship the winner before starting Test 2.

### Test 2 — Hero image / motion
- **Variants:** (a) static hero still from the film; (b) a 6–8s silent auto-loop of the key beat
  (6:30am laptop reveal / the review-tray / the dispatch board); (c) no media, copy-only.
- **Hypothesis:** the silent loop lifts engagement + scroll-depth without hurting load/CVR on
  mobile; copy-only may win on the storm-mode page (speed).
- **Success metric:** trial-start CVR, with bounce + LCP as guardrails (storm-mode is
  speed-sensitive).

### Test 3 — ROI calculator placement (the headline experiment of this plan)
- **Variants:** (a) calculator **above the fold**, immediately after hero; (b) mid-page after
  the scene (skeleton default, section 5); (c) calculator as a sticky/secondary CTA, page leads
  with the scene + proof.
- **Hypothesis:** for ROI-driven personas (P4, and P1) above-the-fold calculator lifts trial
  starts; for trust-driven P2, calculator-after-control-beat wins (they need the "you stay in
  control" trust before they care about the number).
- **Success metric:** trial-start CVR; segment by page (persona). Calculator *interaction rate*
  is the leading indicator.

### Test 4 — Primary CTA wording / destination
- **Variants:** "Start free trial — first month free" vs. "Talk to a service partner" vs. "See
  what the fleet drafts overnight."
- **Hypothesis:** trial-CTA wins on C1/C5 (self-serve-friendly); talk-to-Plaino wins on C2
  (consultative, Partner-tier).
- **Success metric:** total qualified conversions (trial start **+** talk-to-Plaino), weighted —
  because on C2 a talk-to-Plaino open is worth more than a tire-kicker trial.

### Test 5 — Proof ordering
- **Variants:** lead proof with (a) "eat our own cooking" (the brokerage running ~35 agents in
  production) vs. (b) "ROI math, not vibes" (the cited numbers).
- **Hypothesis:** P2 responds to the ROI-math/citation proof; P3 responds to the
  real-operator/eat-own-cooking proof. Confirms persona-proof fit for Wave 2.

---

## Instrumentation & success criteria

- **Per-page events:** page view, calculator interaction, talk-to-Plaino opened, trial start —
  all tagged with `utm_content=[concept-slug]-[variant]` (CHANNELS.md §5) so concept-level and
  variant-level CAC are queryable.
- **Source of truth:** the product database is canonical for trial starts; ad-platform numbers
  reconcile to it.
- **Wave-1 success bar (per page, 30-day):**
  - Trial-start CVR ≥ the planning band floor for its channel mix (CHANNELS.md §4).
  - Blended trial-start CAC ≤ $300 (C1/C5) / ≤ $500 (C2, Partner-tier P2).
  - At least one headline + one calculator-placement winner identified per page with enough
    volume to call (pre-registered minimum detectable effect, not eyeballed).
- **Honesty guardrail:** if a page can't hit the CAC bar after Test 1+3, the concept is reworked
  or retired — we don't quietly keep spending. Any "we hit X" claim in the Wave-1 readout cites
  the platform/product report it came from (`feedback_no_guesses_no_estimates.md`).
