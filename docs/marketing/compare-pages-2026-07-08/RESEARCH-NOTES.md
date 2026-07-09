# Vendor comparison pages — source notes (2026-07-08)

Claims ledger for the three Georgia real-estate vendor pages
(`/compare/follow-up-boss`, `/compare/sierra`, `/compare/boldtrail`).
Every defensible claim on those pages maps to a line here. All sources are
public pages, retrieved 2026-07-03 and re-verified 2026-07-08 before the
Monday outbound send. Per the competitive-positioning doc
(`docs/marketing/deep-dive-2026-07-02/01-competitive-positioning.md`), this
file decays: re-verify anything here before using it in-market after one
quarter.

Re-verification notes (2026-07-08, via public search):

- **Follow Up Boss** — per-user Grow pricing (annual ~$58/user/mo) with the
  dialer as a per-user add-on on Grow (included on Pro/Platform) confirmed;
  Pro (~$416/mo annual, 10 users) and Platform (~$833/mo annual, 30 users)
  are annual-billing figures — the 2026-07-03 numbers ($499/$1,000) were
  monthly billing. On-page copy states pricing *shape* only, so no page
  change needed.
- **Sierra Interactive** — 30/60/90-day onboarding windows on
  Starter/Essential/Growth confirmed on the published pricing page; the
  one-time setup fee still exists (amount not re-confirmed; it stays out of
  page copy). Starter ~$299.95/mo annual.
- **BoldTrail** — quote-based packages (Base/Plus/Pro), no published
  universal price, confirmed; kvCORE→BoldTrail rebrand (Inside Real Estate,
  2024) confirmed via HousingWire/Inman coverage.

Rules applied on all three pages:

- **No integration claims.** Follow Up Boss, Sierra Interactive, and BoldTrail
  are roadmap, not wired. The pages say "works alongside" and the integration
  FAQ answers "Not directly today." The live integration story is email +
  calendar + QuickBooks, plus DocuSign/Drive on the realty stack.
- **No fabricated proof.** No customer counts, no saved-time figures, no
  review scores quoted as our own endorsement. The shared-pain intros are
  written as a described week, not as statistics.
- **One dollar figure outside the seat ladder:** the HUD fair-housing penalty
  (sourced below). The seat ladder ($99–$299) is the locked pricing canon.
- **Model vendor invisible.** No model or AI-provider name appears on any of
  the three pages.

---

## Cross-page claims

| Claim on page | Source | Note |
|---|---|---|
| Fair-housing first-offense civil penalty "up to $26,262" | 24 CFR § 180.671 (eCFR, current text); HUD adjustment of civil monetary penalty amounts (Federal Register, 2025 adjustment) | The inflation-adjusted maximum where the respondent has no prior adjudicated violation. Repeat offenses run higher. Cited on all three pages with the CFR cite inline. Re-check the figure at each annual adjustment. |
| "Real-estate drafts are checked against the fair-housing corpus" | Internal runtime truth — real estate is in `BASELINE_LIVE_VERTICALS`; corpus lives in `lib/agents/sentinel` | Live for real estate only. Do NOT reuse this sentence on non-RE pages. |
| "Flat per-seat monthly, $99–$299 by tier, published in full" | `/pricing` (our own published page); pricing canon `project_stripe_both_surfaces` | Matches the wording already shipped on the four generic compare pages. |
| Draft-then-approve / nothing auto-sends | No-outbound architecture (`project_no_outbound_architecture`) | Architecture fact, not a marketing claim. |

## Follow Up Boss (`/compare/follow-up-boss`)

| Claim on page | Source | Note |
|---|---|---|
| "CRM of record for real-estate teams; lead routing, deal stages, accountability" | followupboss.com product + pricing pages | Category-standard description; also how the competitive-positioning doc frames it. |
| "Portals and lead providers forward into it with an email swap; its own docs put basic setup at minutes" | followupboss.com — setup/onboarding copy: change the lead-source email to the assigned @followupboss.com address; "less than 10 minutes to get set up" | We soften to "minutes, not weeks" rather than quoting their exact minutes claim. |
| "Automations 2.0 fires templates, tasks, and record updates on triggers your team defines" | followupboss.com feature pages — Automations 2.0 (action plans folded in) | Their own naming. The load-bearing point for us: the team builds and maintains the triggers. |
| "Its own plans reserve richer onboarding for the higher tiers" | followupboss.com/pricing — "Personalized onboarding" listed on Pro; enhanced onboarding on Platform | Supports "setup is real work, and it's yours." No prices quoted on the page. |
| "Per-user pricing, with add-ons like the dialer billed per user on top" | followupboss.com/pricing — Grow is per-user ($69/user/mo monthly, $58 annual); dialer is a per-user add-on on Grow; Pro $499/mo (10 users), Platform $1,000/mo (30 users) | Dollar amounts stay HERE, not on the page — pricing shape only on the customer surface, so their price changes don't strand our copy. |
| "Phone-first team workflows, with a dialer add-on and calling reports" | followupboss.com feature + pricing pages | Fair-credit item. |

## Sierra Interactive (`/compare/sierra`)

| Claim on page | Source | Note |
|---|---|---|
| "Couples an IDX website with a CRM; captures leads, listing alerts, drip campaigns tied to browsing" | sierrainteractive.com product pages | Their core pitch, stated fairly. |
| "Built for teams that want to rank on Google organically" | Consistent across sierrainteractive.com positioning and third-party reviews (e.g., inboundREM, AgentAdvice) | Fair-credit item — the SEO-site reputation is their moat. |
| "Onboarding windows measured in days — 30 to 90 by tier, per its published pricing" | sierrainteractive.com/pricing — Starter: 30-day onboarding; Essential: 60; Growth: 90 + Sierra Connect training hours | First-party, load-bearing for the "comes with a window, not a person" gap. |
| "Platform tiers with setup fees on monthly billing and per-feed add-ons" | sierrainteractive.com/pricing — $500 setup on monthly billing ($0 annual); additional MLS feeds $25; tiers Starter/Essential/Growth (~$300–$725/mo depending on billing) | Dollar amounts stay here, shape only on the page. |
| "Drips and alerts can't answer the specific question the buyer asked" | Product-category fact: drip/e-alert automation sends pre-written content on triggers (their feature pages) | Defensible as a description of what triggered templates are. |

## BoldTrail (`/compare/boldtrail`)

| Claim on page | Source | Note |
|---|---|---|
| "The platform that grew out of kvCORE" | Inside Real Estate announcements + insiderealestate.com/boldtrail; widely reported 2024 rebrand | Neutral phrasing; avoids implying it's a different product than reviewers reviewed. |
| "Website, CRM, lead nurture, marketing, and back-office modules under one login" | insiderealestate.com/boldtrail product pages | Their own all-in-one framing, stated fairly. |
| "A quote-based sale; rates aren't published" | insiderealestate.com — demo/quote motion; corroborated by Capterra/SoftwareAdvice profiles noting no public pricing (third parties report solo plans ~$499+/mo) | We state only "quote-based; rates aren't published" — first-party-verifiable. The ~$499 figure stays here as context and is NOT used on the page. |
| "A learning curve public reviewers put at weeks" | Aggregated review sites (Capterra ~4.5/5 across 540+ reviews; G2; AgentAdvice; RealEstateSkills) — recurring reviewer theme: multi-week ramp, feature set overwhelming at setup | Phrased as "public reviewers" — attributed to reviewers, not asserted as our measurement. Do not sharpen to a specific week count on the page. |
| "Behavioral alerts and campaigns across a database of thousands" | insiderealestate.com/boldtrail nurture feature pages | Fair-credit item, volume framing theirs. |

## What we deliberately did NOT claim

- Any Zillow-ownership framing on the Follow Up Boss page (true — acquired
  2023 — but irrelevant to the DIY-vs-run-for-you frame and reads as FUD).
- Any specific vendor price on a customer surface. Shapes only; numbers live
  in this file.
- Any support-quality judgment ("mixed reviews") on the BoldTrail page.
  Review sentiment is contested territory; the learning-curve theme is
  broad enough to stand, support quality isn't.
- Any response-time or hours-saved statistic in the shared-pain intros. No
  source we'd stand behind; the intros describe the week instead.
