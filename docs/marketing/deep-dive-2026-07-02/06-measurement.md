# Measurement — what we track before we spend a dollar

**The uncomfortable baseline (audit dept 1, verified):** the marketing site has **no analytics at all.** No tracking scripts, no pageview counts, no funnel data — which is also why no cookie banner is needed today. We are not flying blind because measurement broke; we never installed instruments. That is fixed *before* any paid test, and the fix must not quietly betray the privacy posture we advertise.

---

## 1. The instrumentation plan (weeks 1–2)

1. **Privacy-respecting web analytics** on the marketing surface. Requirement: cookieless or first-party-only, no cross-site tracking, EU-safe by design (self-hostable or a privacy-first hosted tool — final vendor pick goes through the standard adapter seam per `feedback_no_silent_vendor_lock`, and the subprocessor list on `/privacy` is updated if a vendor processes visitor data). What we need from it: pageviews, referrer, UTM parameters, landing page, and 4 goal events. Nothing about identity.
2. **Four goal events, no more to start:** trial-start begun (`/app/sign-up` reached), trial-start completed, talk-to-a-partner submitted (PlainoWidget / lead capture — the `/api/leads/capture` pipeline already exists and stores source-of-lead), and guarantee-page view (risk-reversal engagement).
3. **UTM discipline, documented.** One convention, written in this directory, used everywhere: `utm_source` (platform), `utm_medium` (paid/organic/newsletter/community), `utm_campaign` (vertical-concept, e.g. `re-lead-answered`), `utm_content` (creative variant). Founder outreach links carry UTMs too — the #1 channel must not be the least measured one.
4. **Self-reported attribution at signup:** one optional field, "How did you hear about us?" with 6 options + free text. For a founder-led, dark-social-heavy motion, this regularly out-informs click attribution; it is the cheapest high-signal instrument we can add.
5. **Product-side funnel events already exist in part** (signup, activation, connector-connect land in the product's own tables); marketing needs read access to a weekly rollup: trials started → first connector connected → first draft approved. First-draft-approved is our activation moment and the number the whole story depends on.
6. **Update the privacy page** for whatever ships, through the counsel packet (audit dept 1, finding 6). If we add analytics and don't update `/privacy`, we've manufactured a Truth Wave violation.

## 2. Attribution model

Keep it deliberately simple; sophistication without volume is fiction.

- **Primary: first-touch by UTM/referrer, corroborated by self-report.** At our volume, every trial gets looked at individually — attribution is a review habit, not a statistical model.
- **Founder outreach is tracked as its own channel** in the pipeline of record (conversation → demo → trial → paid), independent of web analytics.
- **Answer-engine and dark-social traffic** (no referrer, no UTM) is expected to be large for us; the self-report field is how we see it. Log "assistant/AI search" as an explicit self-report option — we are optimizing for AEO and should measure whether it works.
- **Rule: no dashboard number without a decision attached.** Every metric below exists to trigger a named action; anything else is vanity and gets cut.

## 3. Weekly review cadence

Folded into the existing kaizen weekly loop (PR #273) — no new meeting, one shared scorecard reviewed every week:

| Metric | Source | Decision it feeds |
|---|---|---|
| Design-partner conversations held | pipeline of record | Is the #1 channel actually running? (target 5/wk) |
| Pieces published passing gates | content tracker | Cadence health (target 2/wk, never 0) |
| Visits by channel + landing page | analytics | Which content earns attention |
| Trial starts + % with known source | analytics + self-report | Instrumentation health (>80% known) |
| Trials → first draft approved (activation) | product rollup | Is the front door delivering people who succeed? |
| Cost per qualified trial start (when paid live) | platform + analytics | Continue / kill / rebalance the test |
| Flagged-for-Conner queue age | decision queue | Unblock stalls (nothing older than 2 cycles) |

Monthly additions: indexed pages + answer-engine citation check (25 tracked queries), funnel conversion end-to-end, competitive-intel scan.

## 4. What "working" looks like at 30 / 60 / 90 days

These are honest expectations for a zero-customer starting line, not promises. Each stage names the signal that says *continue* and the signal that says *change course.*

**Day 30 (early August).** Working: instrumentation live with >80% source-known trials; front-door P0/P1s closed; 8+ pieces published on rhythm; 15+ design-partner conversations held and at least 2 partners actively onboarding; the activation number (trial → first draft approved) is *known*, whatever it is. Change course if: partner conversations aren't happening (the constraint is founder time — fix the calendar before fixing the funnel), or activation is near zero (stop all acquisition work; the product story, not distribution, is the bottleneck — likely intersects the prod-key pause).

**Day 60 (early September).** Working: 5+ design partners active; first permissioned proof asset published; 16+ pieces live with first search impressions accruing on long-tail terms; answer-engine citation check shows first citations; spend gate either opened (realty test live with CPL data accumulating) or consciously held with budget rolled to photography. Change course if: partners are active but no one will go on record — that's a product-pride signal, feed it to the product kaizen, don't paper over it with anonymous "a customer says" copy (banned anyway).

**Day 90 (end of September).** Working: the five executive-plan outcomes green (or consciously re-scoped in the weekly loop); 3 proof assets on the shelf; 20+ pieces compounding; a cost-per-qualified-trial reading exists for realty — even a bad one is a success (we bought a real number, not a guess); the Q4 decision (scale the paid test / double down on organic / push a second vertical) is made **from data on this scorecard, not from instinct.**

**The standing definition of failure** at any checkpoint: metrics reported with no decision taken, or a number in-market that this system can't trace to a source. We'd rather have five honest instruments than fifty aspirational ones — that's the same bar the product copy holds (`feedback_no_guesses_no_estimates`).
