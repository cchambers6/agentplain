# Execution Roadmap — Synthesis of All Strategic Packet Outputs

**Prepared:** 2026-06-14 · **Author:** fleet (Opus 4.8, 1M-context synthesis pass) · **Status:** planning input for Conner's greenlight — *no execution authorized by this doc*
**Purpose:** One place Conner reads to greenlight the wholistic attack. Every work item, decision, and sequence below is extracted from a landed (or staged) strategic packet and cited to it. This doc plans; it does not build.

**Source packets read in full for this synthesis** (origin/main unless noted):
- `docs/audits/CUSTOMER_JOURNEY_POST_MERGE_2026_06_14.md` (PR #257)
- `docs/launch/CONNER_TOMORROW_MORNING.md` (PR #252)
- `docs/launch/partner-channel-strategy.md`, `investor-deck.md`, `legal-risk-prelaunch-review.md`, `vertical-compliance-deep-dive.md` (PRs #254, #256)
- `docs/customer-success/playbook.md`, `research-engine.md` (PR #256)
- `docs/business-plan/unit-economics.md`, `per-vertical-pricing.md`, `docs/specs/per-customer-token-budget-enforcer.md` (PR #253)
- `docs/marketing/` pack — 5 vertical landing pages, `content-calendar-90-days.md`, 5 sales scripts, `brand-voice-scenario-library.md` (PR #255)
- `docs/business-plan/MASTER.md` + 10 dept files — **on local branch `business-plan/agentplain-2026-06`, NOT yet pushed to origin** (see §0 dependency note)
- `docs/business-plan/money-plan.md`, `first-50-customers.md`, `competitive-battlecards.md`, `30-60-90-launch-plan.md` — **on local branch `business-plan/money-gtm-pack-2026-06-14`, NOT yet pushed to origin** (see §0 dependency note)

---

## §0 — Dependency & integrity notes (read before trusting the rest)

1. **Two source packets are not on origin yet.** The business-plan MASTER (`business-plan/agentplain-2026-06`) and the money-GTM pack (`business-plan/money-gtm-pack-2026-06-14`) exist only as **local worktree branches**; they were never pushed (confirmed: `git branch -r` shows neither). They were synthesized here from those local refs. **Roadmap dependency: these two PRs must be pushed + merged** so the plan they encode is the canonical record, not a local artifact that a tree-wipe could erase. Per `feedback_fleet_waves_use_worktree`, an un-pushed branch in a contested tree is at risk.
2. **The unit-economics packet *refutes* the old margin headline.** The 2026-06-05 production-growth fear ("a heavy workspace's tokens are at/below the subscription") assumed every draft is an Opus call. The shipped killer workflows are **deterministic templates — zero LLM calls/run**. Real per-customer LLM COGS today is **$1.50–$10/mo; blended gross margin ~95%; Stripe's processing fee is the single largest COGS line.** The margin risk is **real but deferred** to the day we upgrade drafts to per-item Opus generation — which is exactly what the token-budget enforcer guards. *Cost is not the constraint. Trust and proof are.*
3. **Everything is gated by one standing policy:** prod `ANTHROPIC_API_KEY` is paused (sentinel) by design until Conner is **actively prospecting**. Degraded mode is the live customer experience today. The plan below treats key-restoration as a deliberate, dual-conditioned event (product market-ready **AND** prospecting underway), not a P0 bug.

---

## §1 — TL;DR

**The holistic picture: the product is further along than the storefront, and the only thing standing between today and first revenue is a spine of trust artifacts that one person (Conner) must unblock and one fleet wave can then build.** Twelve PRs of genuinely strong in-app value landed this month (approval queue, degraded-mode honesty, first-5-min seeded value, support tickets, weekly ROI twin) — the product a hand-held design partner touches is *design-partner-ready today*. But not one of those PRs touched the public storefront, where five trust-existential P0s are still live in production (self-contradicting pricing, present-tense compliance claims the system can't honor, two legal-accuracy defects, zero social proof) and the system **literally cannot take money** (Stripe gated off). Across all 14 packets the single converging theme is unmistakable: **the binding constraint is trust + proof, not product, model, or cost.** The unit economics prove cost is a solved problem (~95% margin); the audits prove the product works; the gap is (a) a storefront that tells one true story, (b) the legal/consent spine that lets us take a dollar safely, (c) named social proof we have zero of, and (d) the founder-led design-partner motion that manufactures that proof. The wholistic attack is therefore not a feature build — it is **Truth → Proof → Prospect → Unlock**: fire the Truth Wave, sign and showcase the first design partners, and let real prospecting unlock the (deliberately paused) AI spend. The highest-leverage single act in the entire plan costs Conner ~20 minutes: **make the four FW-1 decisions** and let one Opus agent ship the Truth Wave PR that clears most of the live P0s at once.

---

## §2 — Master work item list

Deduplicated across all 14 packets. **Owner type:** FCD = fleet-can-do · CON = needs-Conner-decision · CNS = needs-counsel · PRT = needs-partner · VND = needs-vendor. **Effort:** XS <1h · S 1–4h · M 4–16h · L 16–40h · XL >40h. **Cust** = customer-value impact 1–5 · **Rev** = directness to first-$ 1–5. *Dep/Blocks reference other item IDs.*

### 2A. Revenue-path / storefront truth (the money moment)

| ID | Item | Source(s) | Owner | Effort | Cust | Rev | Dep | Blocks |
|----|------|-----------|-------|--------|------|-----|-----|--------|
| R1 | **Fire FW-1 "Truth Wave"** (one PR: price-drift fix, compliance-tense fix, legal-accuracy trio, vertical→tier resolution, home-services live, P2 batch) | journey audit, CONNER_TOMORROW, biz-plan (all lenses), marketing | CON→FCD | M | 5 | 5 | D1–D4 | R2,R3,P1 |
| R2 | Fix price self-contradiction ($269/$239 vs $279/$249) — derive all tables from `lib/pricing/tiers.ts`, delete hardcoded bands | journey audit P0-a, biz-plan | FCD | S | 4 | 5 | — | — |
| R3 | Resolve vertical→tier anchoring (CPA/HS show Partner $299; law/ria Max wall) — set `content.ts` tiers per Conner's nod; delete `flows.ts:101` content-tier→billing | journey audit P0-2, CONNER_TOMORROW (Dec C), biz-plan | CON | S | 4 | 5 | D3 | — |
| R4 | Build canonical `lib/billing/facts.ts` single-source pricing/trial/charge module (all surfaces render from it) | biz-plan master/finance | FCD | M | 3 | 5 | — | R2,R5 |
| R5 | Implement new trial mechanics: card-at-signup, 7-day default, 14-day CPA+Law, 14-day money-back | money-plan, pricing, CS playbook, journey audit P0-f, legal-risk A3 | CON→FCD | L | 4 | 5 | D1 | — |
| R6 | Turn on Stripe billing (`STRIPE_BILLING_ENABLED`+keys; `STRIPE_CHECKOUT_ENABLED` per trial decision) — *the product cannot charge today* | journey audit P0-d, CONNER_TOMORROW, biz-plan finance | CON | S+config | 4 | 5 | D1,R5 | — |
| R7 | Stand up live Stripe catalog (Regular/Partner Prices on lookup-key contract; trial+webhook tested E2E) | 30-60-90 §0.1 | CON | M | 4 | 5 | R6 | — |
| R8 | Wire `/custom?type=max` → operator triage → manual provisioning (Max is quote-based) | money-plan §2 | FCD | M | 2 | 4 | — | — |
| R9 | Replace Partner/Max `mailto:` CTAs with `/custom` routes; reconcile /about "not self-serve"; cut homepage to 1 primary+1 secondary CTA | biz-plan sales (P1-5), marketing | FCD | S | 4 | 4 | — | — |
| R10 | Implement à-la-carte add-on billing (compliance pack $49/mo, connector build, migration $750, custom skill) | money-plan §4 | FCD | M | 2 | 4 | R7 | — |
| R11 | Decide + (if yes) build annual-plan self-serve SKU | biz-plan finance | CON | S | 1 | 3 | R7 | — |
| R12 | Pricing-page money footnote (refund/tax/trial-timing/grace) + metered-billing disclosure decision | biz-plan finance, journey P0-7, legal A3/A10 | CON→FCD | XS | 3 | 3 | D2 | — |

### 2B. Proof & social-proof engine (the #1 strategic gap)

| ID | Item | Source(s) | Owner | Effort | Cust | Rev | Dep | Blocks |
|----|------|-----------|-------|--------|------|-----|-----|--------|
| P1 | **Publish social-proof system** (logo strip + ≥2 attributed testimonials + count) — zero exists anywhere today | journey P1-1, biz-plan, investor-deck S8, partner-channel | CON+FCD | S | 5 | 5 | P2 | — |
| P2 | Run first testimonial ask (FlatSBO counts as #1); secure on-record permission | CONNER_TOMORROW #6, money-gtm | CON | XS | 5 | 5 | — | P1 |
| P3 | Build per-vertical case studies / quotable proof artifacts (target 6+ of first 10 partners → public) | first-50 §3/§8, biz-plan | FCD+CON | M | 4 | 4 | C3 | — |
| P4 | Ship no-signup demo sandbox (seeded fixture workspace) — see-before-you-buy | biz-plan sales/product, marketing | FCD | M | 4 | 4 | — | — |
| P5 | "See the product" screenshot/illustration strip (interim proof until sandbox) | biz-plan sales/marketing | FCD | S | 3 | 3 | — | — |
| P6 | Build comparison pages ("vs DIY Claude/SBM", "vs hiring a VA", "vs incumbent") | biz-plan marketing/sales, competitive-battlecards | FCD | M | 2 | 4 | — | — |

### 2C. AI cost architecture (the margin guardrail — build the meter before we need it)

| ID | Item | Source(s) | Owner | Effort | Cust | Rev | Dep | Blocks |
|----|------|-----------|-------|--------|------|-----|-----|--------|
| A1 | **Ship per-customer token-budget enforcer** (`WorkspaceTokenUsage` table + RLS + hot-path gate + 80%/100% markers, per the spec) | token-budget spec, unit-econ §7, money-plan §7 | FCD | L | 3 | 4 | — | A5 |
| A2 | Verify cost governor LIVE end-to-end (budgets cap, routing downshifts, caching on) — heavy-workspace exit test before key un-pause | money-plan §7, 30-60-90 §0.2, unit-econ | FCD | L | 3 | 5 | A1,A3 | D5 |
| A3 | Flip `LLM_MODEL_ROUTING=on` (founder workspace 1wk → default-on) — the ~free margin lever | biz-plan eng/finance, unit-econ §7 | CON→FCD | XS | 1 | 5 | — | A2 |
| A4 | Refresh `lib/billing/usage/pricing.ts` Haiku rates to $0.80/$4 (keep meter exact) | unit-econ §1.1 | FCD | XS | 1 | 2 | — | — |
| A5 | Promote usage meter to customer dashboard (80% alert / 100% soft-gate, framed as trust + upsell) | token-budget spec §8, biz-plan product/CS | FCD | S | 3 | 3 | A1 | — |
| A6 | Stand up fleet AI-economics rollup + cost-governor alarm (token spend ÷ MRR = margin %, alert at 30% MRR) | biz-plan data/finance | FCD | S | 1 | 4 | — | — |
| A7 | Set per-tier default token budget cap policy ($40 Solo / $80 Partner / custom Max) | unit-econ §4, token-budget spec §2, biz-plan finance | CON | XS | 1 | 4 | — | A1 |
| A8 | Provision `ANTHROPIC_API_KEY_SECONDARY` in Vercel (failover self-heal when primary returns) | CONNER_TOMORROW #3 | CON | XS | 5 | 2 | — | D5 |

### 2D. Legal / consent spine (the hard gate on taking a dollar)

| ID | Item | Source(s) | Owner | Effort | Cust | Rev | Dep | Blocks |
|----|------|-----------|-------|--------|------|-----|-----|--------|
| L1 | **Engage counsel on the P1-10 packet** (run `scripts/render-counsel-handoff-packets.ts`, send) — weeks-long clock, start now | CONNER_TOMORROW #5, legal-risk, biz-plan legal | CON | M | 2 | 5 | — | L2–L8 |
| L2 | Publish + clickwrap ToS, Privacy, AUP, AI-Use-Disclosure (versioned, logged consent) | legal-risk §B/A4, biz-plan legal | CNS | M | 2 | 5 | L1 | — |
| L3 | Draft + publish DPA + versioned subprocessor exhibit + signing flow — *biggest procurement unblock* | legal-risk §B, biz-plan legal | CNS | M | 2 | 5 | L1 | — |
| L4 | Fix the 3 legal-accuracy defects: OpenAI subprocessor omission, AES-256-GCM overclaim on plaintext `KnowledgeDocument.body`, OAuth-scope wording | journey P0-5, legal-risk A5, biz-plan legal | FCD | S | 2 | 3 | — | — |
| L5 | Encrypt `KnowledgeDocument.body` + backfill migration (closes the AES false claim for real) | journey P1-9, biz-plan eng/legal | FCD | M | 2 | 4 | — | — |
| L6 | Port homepage compliance-honesty qualifier to all 9 non-RE vertical pages; flip present-tense scanner verbs → conditional | journey P0-6, legal-risk A2, vertical-compliance, marketing | FCD | S | 3 | 3 | — | (in R1) |
| L7 | §7216 (CPA) + attorney-privilege/UPL (law) language in /terms; AS-IS/no-warranty/no-reliance/indemnity/damages-cap | legal-risk, vertical-compliance, biz-plan legal | CNS | S | 2 | 4 | L1 | — |
| L8 | Counsel red-line live real-estate HUD corpus → flip `COUNSEL_REVIEWED` (the one firing scanner is the one un-reviewed) | CONNER_TOMORROW #5, legal-risk C, biz-plan | CNS | S | 4 | 5 | L1 | — |
| L9 | Working + tested account-deletion / data-rights flow (incl. OAuth-token revoke + cache purge); CCPA/CPRA block | legal-risk A11, biz-plan legal | FCD+CNS | M | 2 | 3 | L1 | — |
| L10 | OAuth "Limited Use" (Google) + Microsoft Graph review; scope CASA assessment if sensitive scopes | legal-risk A5 | CNS+VND | M | 1 | 3 | L1 | — |
| L11 | Persistent "AI-generated — review before sending" disclosure on every drafted artifact + chat | legal-risk A7, vertical-compliance | FCD | S | 2 | 3 | — | — |
| L12 | Gate metered-billing meter off in prod + public "no usage charges" commitment (P0-7) | journey P0-7, biz-plan finance, CONNER_TOMORROW Dec B | CON | XS | 3 | 3 | D2 | — |
| L13 | Form legal entity + assign founder IP (prerequisite to any DPA/customer) | biz-plan master Q3 | CON | S | 1 | 4 | — | L3 |

### 2E. Product / in-app value & honesty

| ID | Item | Source(s) | Owner | Effort | Cust | Rev | Dep | Blocks |
|----|------|-----------|-------|--------|------|-----|-----|--------|
| PR1 | Fix customer-vocab leak on `/fleet` + `/disciplines/[id]` detail ("rooting"/raw slugs → display labels) | journey P1-a, biz-plan, `feedback_customer_vocab_not_engineer` | FCD | S | 3 | 2 | — | — |
| PR2 | home-services `runtime:'live'` one-line fix in `registry.ts:1019` (sells it but silently waitlists) | journey P0-3, CONNER_TOMORROW Dec D | CON→FCD | S | 4 | 4 | D4 | (in R1) |
| PR3 | Land registry-truth CI guard (every sweep slug → `runtime:'live'`) + claims-vs-code drift sentinel (weekly cron) | biz-plan product/eng/legal, journey | FCD | M | 2 | 4 | — | — |
| PR4 | Onboarding vertical-awareness: LAW/RIA dead-end CTA (`unlockedBy:null`), always-Gmail connect, realty jargon for all 10 verticals | journey M4/P1-c, biz-plan | FCD | M | 3 | 3 | — | — |
| PR5 | Support front door: drop `/help` BROKER_OWNER gate, public/header door, route paying customers to ticket form (not lead-capture) | journey M6/P1-b, biz-plan CS | FCD | M | 4 | 3 | — | — |
| PR6 | Render one SLA ("one business day") from `sla.ts` across all surfaces; tier honesty (no human-support promise on fleet-only tiers) | biz-plan CS, legal-risk A9 | FCD | S | 3 | 2 | — | — |
| PR7 | Make compliance page actionable (acknowledge / apply-rewrite), today read-only | journey M5, biz-plan | FCD | M | 3 | 2 | — | — |
| PR8 | Customer-facing value tally on workspace Overview ("this month Plaino saved you X") | journey M8, biz-plan CS, explainer-visual | FCD | S | 4 | 3 | — | — |
| PR9 | Plaino "what next" card in dashboard (2–4 tappable next-steps; generative DECLINE path) | biz-plan CS/product, explainer-visual | FCD | S | 4 | 3 | — | — |
| PR10 | Productize design-partner onboarding into guided self-serve flow (remove Conner from Regular/Partner critical path ~cust #20) | first-50 §4/§7, 30-60-90, biz-plan | FCD | XL | 5 | 4 | — | — |
| PR11 | Status page: Better Stack monitor on `/api/health` + `status.agentplain.com` CNAME + footer link | CONNER_TOMORROW #2, journey P1-3, biz-plan | CON+FCD | XS+VND | 3 | 3 | — | — |
| PR12 | Render `failed`/`skipped` activity-feed states honestly (silent non-fire ≠ quiet day) — *largely landed (#c634c26); verify* | biz-plan eng | FCD | S | 3 | 2 | — | — |
| PR13 | Teardown PII fix: delete orphaned support/lead rows on workspace closure | journey M6/M9 | FCD | S | 2 | 1 | — | — |
| PR14 | Trial-end value-summary auto-generation ("here's what it did") before 7/14-day mark | money-gtm, first-50 §7, journey M7 | FCD | M | 4 | 4 | R5 | — |
| PR15 | Weekly value report = real Friday send to 100% active workspaces + "quiet week" reactivation pivot | biz-plan CS/data, research-engine | FCD | S | 5 | 4 | — | — |
| PR16 | Referral mechanism (engineered day-30 ask, founding-customer credit) | first-50 §2, biz-plan sales | FCD | M | 3 | 4 | — | — |
| PR17 | Expansion surfaces (add seats, compliance-pack add-on, Partner upgrade prompts; budget-threshold upsell signal) | money-plan §4/§5, biz-plan CS/finance | FCD | M | 3 | 5 | A5 | — |
| PR18 | Partner-tier async quarterly business-review *template* (replaces the removed 4 reserved live hours) | money-plan §3, biz-plan sales/CS | FCD | S | 3 | 3 | D6 | — |
| PR19 | Remove `PARTNER_RESERVED_HOURS_PER_MONTH` (Conner-time = Max/Custom only); correct stale `tiers.ts` constants | money-plan §3, biz-plan (all lenses) | FCD | S | 2 | 3 | D6 | — |

### 2F. Marketing engine & content

| ID | Item | Source(s) | Owner | Effort | Cust | Rev | Dep | Blocks |
|----|------|-----------|-------|--------|------|-----|-----|--------|
| M1 | Port the 5 vertical landing-page drafts into live routes (reconcile vs `content.ts` — don't double-build) | marketing pack (all 5), biz-plan | CON→FCD | L | 5 | 5 | R3 | M2 |
| M2 | Wire per-vertical FAQ sections + FAQ JSON-LD; verify every live-vs-"Setting up" claim vs `registry.ts` | marketing pack, biz-plan AEO | FCD | M | 4 | 4 | M1,PR3 | — |
| M3 | AEO foundation (FAQPage JSON-LD, question-titles, per-page OG, sitemap lastmod, `/login`→`/app/sign-in`) | biz-plan marketing | FCD | M | 2 | 4 | — | — |
| M4 | Stand up blog/content publishing surface (MDX routes or CMS — Sanity MCP available) | marketing content-calendar | CON | L | 3 | 4 | — | M5,M6 |
| M5 | Build 6 SEO pillar pages | content-calendar §2 | FCD | L | 4 | 5 | M4 | — |
| M6 | Write the 30 cluster blog posts (90-day calendar) | content-calendar §3 | FCD | XL | 4 | 4 | M4 | — |
| M7 | Repurposing pipeline (each post → 3 LinkedIn + 1 X thread + 1 newsletter section) | content-calendar §6 | FCD | M | 3 | 3 | M6 | — |
| M8 | Load 5 sales scripts + 5-touch sequences into sales-enablement surface; build competitive battlecard cheat-sheet | marketing scripts, competitive-battlecards | CON→FCD | M | 3 | 5 | — | — |
| M9 | Encode brand-voice banned-word list + 5 quick tests as a copy CI/lint gate; wire scenario library into drafting prompts | brand-voice-library | FCD | M | 3 | 2 | — | — |
| M10 | Per-vertical ROI calculators (from the scripts' math) + compliance-penalty proof one-pagers | marketing scripts | FCD | M | 3 | 4 | — | — |
| M11 | Surface Plaino by name in "your service partner" copy (home + /about); PlainoStatus poses on empty states (via creative-router) | biz-plan marketing, explainer-visual | FCD | S | 2 | 2 | — | — |
| M12 | Newsletter + lifecycle nurture stack decision (ESP behind adapter; clears no-outbound doctrine) | content-calendar, biz-plan marketing | CON | M | 2 | 3 | — | M7 |

### 2G. GTM / partnerships / customer success ops

| ID | Item | Source(s) | Owner | Effort | Cust | Rev | Dep | Blocks |
|----|------|-----------|-------|--------|------|-----|-----|--------|
| C1 | Build first-10 design-partner prospect list (warm, RE beachhead, Atlanta/GA network) | first-50 §3, 30-60-90 §0.4, partner-channel | CON | S | 4 | 5 | — | C2,C3 |
| C2 | Run founder-led design-partner outreach (founder-voice templates, one ask each) — *Channel #1, the only one that matters month 1* | first-50 §5, 30-60-90 §1, partner-channel | CON | M | 5 | 5 | C1 | C3 |
| C3 | Founder white-glove onboarding of 10 RE partners + write the runbook (the one deliberate pre-Max Conner-time spend) | first-50 §3/§7, CS playbook | CON | XL | 5 | 5 | C2 | P3,PR10 |
| C4 | Make `hello@agentplain.com` support inbox live + monitored with SLA (already set to real inbox; confirm SLA) | money-gtm, CONNER_TOMORROW, CS playbook | CON | XS | 3 | 2 | — | — |
| C5 | Pursue top-5 partnerships: GA Realtor Assoc → RE coach/influencer → TaxDome/Karbon integration → GA CPA Society → ServiceTitan listing prep | partner-channel §5 | CON | L | 3 | 4 | P3 | — |
| C6 | Stand up the customer research engine (Feedback schema in Linear; week-1/week-4/month-3 cadence; ≥3-customer roadmap rule; draft-edit mining) | research-engine | CON+FCD | M | 4 | 3 | C3 | — |
| C7 | Instrument leading-indicator dashboard (time-to-first-fire, weekly approved actions, connector-attach, trial→paid by vertical, referral rate) + activation funnel events | first-50 §8, biz-plan data | FCD | M | 3 | 4 | — | — |
| C8 | Retention health-score dashboard (per-customer 0–100 + alerts: 0-approvals-7d, integration-dark-72h, acceptance drop) | research-engine §4, biz-plan data/CS | FCD | M | 3 | 3 | C7 | — |
| C9 | List on Anthropic services-partner track + no-commission Marketplace | first-50, competitive, 30-60-90 | CON+PRT | S | 2 | 3 | P3 | — |
| C10 | Founder content engine (weekly vertical teardown on LinkedIn + newsletter) — Channel #3, Conner is the voice | first-50 §2, 30-60-90 | CON | M | 2 | 3 | — | — |

### 2H. Infrastructure / hardening / org

| ID | Item | Source(s) | Owner | Effort | Cust | Rev | Dep | Blocks |
|----|------|-----------|-------|--------|------|-----|-----|--------|
| I1 | Get E2E revenue-path Playwright suite green (signup→trial→paid→cancel) — pre-GO gate (PR #247 queued) | 30-60-90, CONNER_TOMORROW #4, e2e memory | FCD | M | 3 | 4 | — | — |
| I2 | Audit-log immutability migration (REVOKE UPDATE/DELETE + trigger + drift baseline) — SOC2 + law/RIA/insurance prereq | biz-plan eng/legal, production-growth | FCD | S | 1 | 3 | — | — |
| I3 | RLS CI coverage gate (every workspace-scoped model has a policy) | biz-plan eng | FCD | S | 1 | 2 | — | — |
| I4 | Drill key-rotation + Neon PITR restore end-to-end (un-drilled guarantee = claim, not capability) | biz-plan eng, production-growth | CON+FCD | S | 1 | 2 | — | — |
| I5 | Configure Stripe Tax (`automatic_tax`, `tax_id_collection`) + nexus decision (selling to CPAs across states) | biz-plan finance | CON+VND | S | 1 | 3 | R7 | — |
| I6 | SOC 2 Type I/II kickoff (Vanta; posture built, attestation missing) — procurement gate for regulated verticals | biz-plan eng/strategy, money-gtm | CON+VND | L | 2 | 5 | — | — |
| I7 | Stand up real LTV/CAC + cohort-retention measurement (gates any paid spend) | biz-plan finance/data, research-engine | FCD | M | 1 | 4 | C7 | — |
| I8 | Hire Trusted Human #1 (escalation + L1 support owner) — survival, not growth; 8 dead-letter failure modes today | biz-plan people | CON | S | 3 | 2 | C4 | — |
| I9 | "Conner-unavailable" runbook + page ack-tracking/escalation-on-no-ack | biz-plan people/eng | FCD+CON | M | 2 | 2 | — | — |
| I10 | Memory hygiene pass (MEMORY.md ≤24.4KB, ≤200-char index entries — currently over budget, truncating) | biz-plan people | FCD | S | 1 | 1 | — | — |
| I11 | Push + merge the two un-pushed business-plan PRs (MASTER + money-GTM) so the plan is canonical | §0 note | FCD | XS | 1 | 2 | — | — |

### 2I. Vertical expansion (deliberately deferred — depth before breadth)

| ID | Item | Source(s) | Owner | Effort | Cust | Rev | Dep | Blocks |
|----|------|-----------|-------|--------|------|-----|-----|--------|
| V1 | Deepen the 4 live verticals to 2–3 fired workflows each (one workflow is fragile retention) | biz-plan product | FCD | L | 4 | 4 | — | — |
| V2 | Activate INSURANCE (vertical 5): AMS adapter (EZLynx/HawkSoft) + COI skill live + corpus counsel-reviewed + ≥3 design partners | biz-plan product/strategy, money-gtm, b2b roster | PRT+CNS+FCD | XL | 4 | 5 | L1 | — |
| V3 | Codify the vertical-activation kit (checklist artifact: adapter × corpus × pull × workflow-quality) | biz-plan product | FCD | S | 1 | 2 | V2 | — |
| V4 | Land law connectors (Clio/MyCase/NetDocuments); activate MORTGAGE + HOME-SERVICES depth (Q1–Q2 2027 windows) | biz-plan product/strategy | PRT+CNS+FCD | XL | 3 | 4 | V2 | — |

---

## §3 — Cross-cutting themes (patterns in 3+ packets)

Five patterns recur across the packets and each defines a **coherent cross-cutting wave** (not a scattered set of tickets). These are the load-bearing initiatives.

### Theme 1 — "One true story at the money moment" (FW-1 Truth Wave)
**Appears in:** customer-journey audit, CONNER_TOMORROW, business-plan (every lens), marketing pack, legal-risk.
**Pattern:** the product is honest and strong; the *storefront* contradicts itself at exactly the points trust is decided — price drift, present-tense compliance claims the system can't honor, two legal-accuracy defects, vertical→tier whipsaw. All are *failures to propagate* the honesty the homepage already has, not dishonest strategy.
**Scope of wave:** one Opus PR (R1) gated on four Conner decisions (D1–D4), bundling R2, R3, L4, L6, PR2 + the P2 small-fixes batch. Land the canonical pricing module (R4) alongside so the drift can't recur.
**Expected outcome:** self-serve storefront stops contradicting itself; 5 live P0s clear in one shot; Sales lens 2.5→~3.5, Legal 2.5→~3.5.

### Theme 2 — "AI cost is solved; build the meter before we need it"
**Appears in:** unit-economics, token-budget spec, money-plan, business-plan (finance + data + eng), production-growth memory.
**Pattern:** today's COGS is ~5% of revenue (~95% GM) because killer workflows are templates; the margin risk is *deferred* to the day drafts go per-item-Opus. The guardrails (routing-on, per-customer budget enforcer, cost-governor alarm) must exist **before** the key un-pauses and before any LLM-draft upgrade.
**Scope of wave:** A1 (enforcer) + A3 (routing) + A4 (rate refresh) + A6 (economics rollup/alarm) + A7 (cap policy) + A2 (live exit test), then A5/A8.
**Expected outcome:** a verified cost governor; key-restoration becomes a safe, deliberate flip; the central competitive claim ("your AI bill can't explode") becomes literally true.

### Theme 3 — "Card-at-signup + single-source pricing/trial truth"
**Appears in:** per-vertical-pricing, journey audit, CS playbook, money-plan, marketing pack, legal-risk.
**Pattern:** the stated go-live mandate (card-at-signup required, 7/14-day split) is the *opposite* of shipped code (no-card, flat-14-day) — self-consistent today but not what go-live says; and prices are hardcoded in ≥3 places that drift.
**Scope of wave:** D1 decision → R4 (`facts.ts`) + R5 (trial mechanics) + R6/R7 (Stripe live) + R2 (drift fix) + R19/D6 (Partner-hours removal) — a coherent "money plumbing" wave.
**Expected outcome:** one price, one trial story, per-vertical-correct, enforced in code, able to charge.

### Theme 4 — "Proof we don't have" (social-proof + research loop)
**Appears in:** journey audit, business-plan (strategy/sales), investor-deck, partner-channel, money-GTM, research-engine.
**Pattern:** zero testimonials/logos/named customers anywhere; it's the #1 conversion drag after pricing and the weakest investor slide. The fix is *manufactured*, not bought: founder-led design partners → case studies → referrals.
**Scope of wave:** C1→C2→C3 (the design-partner motion) feeding P2→P1→P3 (proof artifacts) and C6 (research engine that turns partners into a learning loop).
**Expected outcome:** ≥2 attributed testimonials by end of first cohort; a referenceable cohort that unlocks partnerships (C5) and the investor narrative.

### Theme 5 — "The consent-and-claims spine" (legal go-live gate)
**Appears in:** legal-risk, vertical-compliance, business-plan legal, journey audit, CS playbook.
**Pattern:** sophisticated fail-closed compliance *machinery* exists, but the outward-facing legal layer (ToS/Privacy/DPA/AI-disclosure, clickwrap, OAuth Limited-Use, tested deletion) is missing — and every one is a hard gate on taking money. Counsel sign-off gates every compliance claim.
**Scope of wave:** L1 (engage counsel — start the weeks-long clock immediately) → L2/L3/L7/L8/L9/L10 (counsel-gated) running parallel to fleet-doable L4/L5/L6/L11.
**Expected outcome:** a published legal spine behind which verticals launch in honest flag-only mode; law/CPA procurement walls cleared.

---

## §4 — Phased plan (the wholistic attack sequencing)

The macro-arc across every packet: **Truth → Proof → Prospect → Unlock.** Phases below are gated, not calendared ("GO is a checklist, not a date" — 30-60-90 §0.4).

### Phase 1 — This week (revenue-path-critical, low-effort, ship fastest customer-facing truth)
1. **D1–D4 decisions (≈20 min)** → fire **R1 FW-1 Truth Wave** (clears R2, R3, L4, L6, PR2).
2. **A3** flip routing on (founder workspace) + **A4** rate refresh + **A8** secondary key slot.
3. **P2** one testimonial ask + **PR11** status page (15 min Conner + 1-line PR).
4. **L1** engage counsel (start the clock) + **I11** push the two un-pushed business-plan PRs.
5. **C1** start the first-10 design-partner prospect list.
6. **PR1** customer-vocab leak fix + **I1** get E2E suite green (merge #246 → #247).

### Phase 2 — Next 2 weeks (foundation + first-customer-ready)
- **Money plumbing wave (Theme 3):** R4 `facts.ts` → R5 trial mechanics → R6/R7 Stripe live → R19 Partner-hours removal → R12 footnote/L12 metered disclosure.
- **AI cost wave (Theme 2):** A1 enforcer → A2 live exit test → A6 economics alarm → A7 cap policy → A5 meter UX.
- **Trust-surface batch:** PR4 onboarding vertical-awareness, PR5 support front door, PR6 SLA, PR8 value tally, PR12 verify, PR13 teardown PII, PR3 registry-truth guard.
- **Proof interim:** P4 demo sandbox, P5 screenshot strip, P1 social-proof strip (once P2 lands).
- **Legal fleet-side:** L5 encrypt knowledge body, L11 AI disclosure, L9 deletion flow.
- **IA simplification** (`/fleet`+`/disciplines` consolidation — audit branch `audit/workspace-ia-simplification-2026-06-14` exists) **if greenlit** by Conner.

### Phase 3 — Month 2 (first 10 design partners + scale prep)
- **C2→C3** founder outreach + white-glove onboarding of 10 RE partners + runbook (PR10 productizes it).
- **P3** case studies + **C6** research engine + **C7/C8** leading-indicator + health dashboards.
- **PR14/PR15/PR16/PR17** trial-end summary, weekly value send, referral, expansion surfaces.
- **C5** top-5 partnerships kickoff (GA Realtor Assoc, RE coach, TaxDome/Karbon) + **C9** Anthropic Marketplace listing.
- **L2/L3/L7/L8** counsel deliverables land; **L8** flips RE corpus to COUNSEL_REVIEWED.
- **M8** sales enablement live; **M1/M2** vertical pages ported; **M3** AEO foundation.
- **Decision point:** with product market-ready + prospecting underway → **un-pause `ANTHROPIC_API_KEY`** (D5).

### Phase 4 — Quarter (50-customer infrastructure + marketing engine + next vertical)
- **M4/M5/M6/M7** content engine (blog surface, 6 pillars, 30 posts, repurposing) + **C10** founder content + **M12** newsletter stack.
- **V1** deepen 4 live verticals; **V2** activate insurance (gated on adapter + counsel + pull) + **V3** activation kit.
- **I2** audit-log immutability, **I3** RLS gate, **I4** key-rotation drill, **I5** Stripe Tax, **I6** SOC 2 kickoff, **I7** LTV/CAC.
- **I8** Trusted Human #1 hire (support/escalation) + **I9** Conner-unavailable runbook.
- **P6** comparison pages; mobile distribution polish (existing `feat/mobile-app-*` branches).

---

## §5 — Conner-decision queue

Only Conner can make these. Recommendation is first/bolded where the packets give one.

| # | Decision | Options | Recommendation (from packets) | Unblocks |
|---|----------|---------|-------------------------------|----------|
| **D1** | Trial timing | (a) Ratify add-card-later (what prod does) · (b) Card-at-signup required, 7/14 split | **Per money-plan/pricing/CS: card-at-signup, 7-day default, 14-day CPA+Law, 14-day money-back.** *(Journey audit notes prod currently does add-card-later — choosing card-at-signup means building R5; choosing add-card-later means aligning copy only. Money-plan recommends card-at-signup as the qualifier that filters non-payers before token burn.)* | R1,R5,R6 |
| **D2** | Metered billing | (a) Public "no usage charges" + gate meter off · (b) Add fair-use clause to /pricing+/terms | **(a) — flat-fee is the competitive edge; meter never flipped in prod.** | L12,R12 |
| **D3** | Vertical→tier anchoring | (a) All verticals show Regular on their page (cadence sets tier) · (b) Keep Partner anchor for CPA/Law per per-vertical-pricing | **Resolve the conflict yourself — do not let an agent guess.** Price *drift* (R2) is an unambiguous bug, fix regardless. Per-vertical-pricing argues CPA/Law anchor Partner on *value*; CONNER_TOMORROW/master argue all-Regular. Pick one and make `content.ts` consistent from first touch. | R1,R3,M1 |
| **D4** | home-services go-live | Ship `runtime:'live'` now / hold | **Ship it (one-line, in FW-1).** | R1,PR2 |
| **D5** | Un-pause `ANTHROPIC_API_KEY` | When | **Only after A2 cost-governor exit test passes AND active prospecting underway (dual condition).** | live LLM |
| **D6** | Partner-tier Conner-time | Remove 4 reserved live hours / keep | **Remove — Conner-time is Max/Custom only; Partner gets async + QBR template.** | R19,PR18 |
| **D7** | Pricing ladder ratification | Adopt Option C productized-service ladder | **Yes — Regular $199→$99, Partner $299→$199, Max quoted, Custom $5–15K.** | R4 |
| **D8** | First 5 partnerships | Pick targets | **GA Realtor Assoc → RE coach → TaxDome/Karbon → GA CPA Society → ServiceTitan prep.** | C5 |
| **D9** | First 3–5 design partners + on-record | Name them | **FlatSBO = #1; founding offer free 60d → $149/mo locked 12mo.** | C1,P2 |
| **D10** | Counsel engagement scope | Fractional / project / retainer | **Fractional, $8–20K — the one place outside money buys a durable moat.** | L1 |
| **D11** | Legal entity + IP assignment | Form now / later | **Form in Q3 before first paid customer or DPA ($1–3K incl. trademark).** | L13,L3 |
| **D12** | Blog/CMS surface | MDX routes / Sanity CMS / none yet | Conner's call — none exists today; gates the content engine. | M4 |
| **D13** | Newsletter/sequencer stack | Vendor behind adapter / defer | Must clear no-outbound doctrine; Klaviyo MCP available behind adapter. | M12 |
| **D14** | Annual-plan SKU + $99 floor | Offer / not | Improves cash timing + churn; validate on real data first. | R11 |
| **D15** | IA simplification | Greenlight `/fleet`+`/disciplines` consolidation / hold | Audit branch exists; Conner greenlight gates the wave. | Phase-2 IA |
| **D16** | Fundraise | Bootstrap / raise | **Default bootstrap (LTV:CAC ≈33:1, ~1-mo payback); raise only to accelerate the compliance moat.** | I-track |
| **D17** | First hire trigger | When/who | **Trusted Human #1 (support/escalation) first — survival; Ops/CS lead ~50 seats; no eng FTE on feature backlog.** | I8 |
| **D18** | North-star metric | Ratify AA/WAW (Approved Actions per Active Workspace per Week) | **Yes — degraded-safe value-frequency proxy.** | C7 |

---

## §6 — Resource map

### People (per business-plan people-culture.md)
| When | Role | Form | Trigger |
|------|------|------|---------|
| Now (Q3) | **Trusted Human #1** — escalation + L1 support owner (fills `FLEET_TRUSTED_HUMAN_EMAIL`) | VA / part-time | Survival — 8 dead-letter failure modes; prereq for any honest SLA (I8) |
| Q3 | Named backup for Trusted Human | Part-time | Bus-factor ≥2 before customer count grows |
| Q4 | Fractional counsel | Project/retainer | Audit P1-10 + first paying customers (L1) |
| Q4 | Fractional accountant/bookkeeper | Monthly retainer | Selling to CPAs with no tax handling (I5) |
| Q1 2027 | **Ops / CS lead** (first true teammate, owns a function) | Part-time → FT, equity | Support > VA bandwidth AND margin covers comp (~50 seats) |
| Q1 2027 | Fractional senior eng backstop | Retainer | First production incident or security drill |
| Q2 2027 | Support pod (1–2) + Hire #3 (vertical-CS or growth) | Part-time | Customer count + timezone spread |
**Rule:** sub-5 humans through first 250 customers; payroll <~25% of gross margin; no eng FTE on a feature trigger (the fleet *is* engineering).

### Capital (per finance.md)
- **No outside capital required to reach first revenue.** Default = bootstrap; cash-flow-positive at ~1–3 paying seats; fixed burn ~$100–500/mo (Anthropic ~$0 by policy today).
- Discretionary spends finance endorses: **counsel $8–20K** (durable moat), accountant (few hrs), **SOC 2 $10–30K/yr** (defer to Q2), status monitor ~$0–30/mo, **entity + trademark $1–3K**.
- Fundraise = optional choice at the Q2 2027 checkpoint, only to accelerate the compliance moat or a proven-but-capital-constrained acquisition engine.

### Partners (per partner-channel-strategy.md)
- **Only partner where the killer workflow is live** (RE, CPA, law, general today; home-services landing). Don't build a partner motion ahead of a live workflow — it generates demand routed to a waitlist.
- Sequence: state/local trade bodies (fast) → influencers/coaches (fastest trust transfer) → vertical-SaaS coopetition (TaxDome/Karbon/FUB — real MCP surfaces today) → franchise/broker networks (many seats) → community.
- Hire a partner manager only at ≥3 active partnerships + ≥10 paying customers + 2–3 case studies.

### Vendor / API budget (per unit-economics + finance)
| Customers | MRR | Total COGS | Gross margin | Notable |
|-----------|-----|-----------|--------------|---------|
| 50 | ~$11.75K | ~$865/mo | **92.6%** | Neon Launch, Vercel Pro, Resend Pro; LLM ~$150 |
| 200 | ~$47K | ~$2,960/mo | **93.7%** | Neon Scale + read replica; LLM ~$600 |
| 1,000 | ~$235K | ~$13.8K/mo | **94.1%** | Stripe is the largest line (~3.5% rev) > LLM+infra combined |
- **API spend turns on** at key-restoration (D5). Even at 1,000 customers LLM COGS is ~$3K/mo. The cost that grows is **human service (the moat)** — OpEx, not COGS.
- Forward risk: if drafts move to per-item Opus, heavy-profile LLM could go $6→$60–120/mo; +$60–120K/mo at 1,000 such customers (margin 94%→~70–75%) — survivable, but must be metered (A1).

---

## §7 — Cost expectation per phase

| Phase | Fleet cost (token spend) | Conner cost (hours) | Notes |
|-------|--------------------------|---------------------|-------|
| **Phase 1 (this week)** | Low — ~1 Opus PR (FW-1) + small fixes + green-suite. Est. **$30–80** dispatch. | **~2–3 hrs** (20 min decisions + status page + counsel email + testimonial ask + prospect-list start) | Highest value-per-hour in the whole plan. |
| **Phase 2 (2 wks)** | Medium — money-plumbing wave + AI-cost wave + trust-surface batch + legal fleet-side. Multiple Opus/Sonnet PRs. Est. **$300–600**. | **~6–10 hrs** (Stripe config, decision ratifications, IA greenlight, review cycles) | Several waves run parallel in worktrees. |
| **Phase 3 (month 2)** | Medium-high — research engine, dashboards, vertical pages, AEO, retention surfaces. Est. **$400–800**. | **~30–50 hrs** (the white-glove onboarding of 10 partners is the big Conner spend — deliberate, pre-Max) | Conner time peaks here, then PR10 productizes it down. |
| **Phase 4 (quarter)** | High — content engine (30 posts), vertical activation, hardening track, SOC 2. Est. **$1–3K** over the quarter. | **~20–40 hrs/mo** shifting to Max/Custom + strategy + partnerships only | Founder exits Regular/Partner critical path. |

*Fleet costs are dispatch estimates at current model mix; they do not include the (paused) production customer-serving key. Conner hours are the scarce resource — the plan is explicitly designed to spend them on decisions, prospecting, and proof, not features.*

---

## §8 — Risk register (top 10)

| # | Risk | Mitigation | Early-warning signal |
|---|------|-----------|----------------------|
| 1 | **Storefront contradictions cost a live deal** (price drift, compliance over-claim live now) | Fire FW-1 (R1) this week; canonical `facts.ts` (R4) prevents recurrence; claims-vs-code sentinel (PR3) | A prospect screenshots two prices; a refund citing a compliance claim |
| 2 | **Legal spine not ready → can't take money safely / UPL exposure** (law is highest-severity) | Start counsel clock now (L1); launch verticals flag-only behind published ToS/DPA; AI disclosure everywhere (L11) | Counsel engagement slips past Phase 1; a law prospect asks for a DPA |
| 3 | **Zero social proof stalls every channel** | Manufacture it (C1→C3→P3); one testimonial now (P2) | Outreach reply rate near zero; partnership pitches fall flat |
| 4 | **Cost governor not verified before key un-pause → margin blowout on a draft-quality upgrade** | A1 enforcer + A2 live exit test gate D5; routing on (A3) | A heavy test workspace exceeds budget without gating |
| 5 | **Contested shared tree wipes a wave's work** (already bit this synthesis — worktree path drift) | Per `feedback_fleet_waves_use_worktree`: isolated worktrees, commit+push own files immediately, junction node_modules | A peer branch-switch; `build:no-migrate` failing on another wave's files |
| 6 | **Founder time becomes the bottleneck** (white-glove onboarding doesn't scale) | PR10 productizes onboarding by ~cust #20; Conner-time gated to Max/Custom (D6); Trusted Human #1 (I8) | Conner >25% time on onboarding/support; response SLAs slip |
| 7 | **Un-pushed business-plan PRs lost** (MASTER + money-GTM local-only) | I11 push+merge this week | A tree-wipe removes the local worktree branches |
| 8 | **Trial mechanics mismatch (mandate≠code) confuses buyers at checkout** | D1 decision → R4/R5 single-source; regression test (exists for trial copy) | A buyer charged differently than the page promised |
| 9 | **Procurement walls (SOC 2, §7216, privilege) block the highest-margin verticals** | I6 SOC 2 Q2 kickoff; L7 vertical language; DPA (L3) first | A CPA/law firm's security questionnaire stops a deal |
| 10 | **Server-side PR merges silently regress the local brand-gate baseline** (bit the money-GTM push) | Add a server-side (CI) brand-gate check, not just the local hook; baseline kept current (`7b29509` did this) | Fresh branches fail pre-push brand-gate with no code change |

---

## §9 — The "wholistic attack" dispatch plan (Phase 1, wave-by-wave)

Read + greenlight this section to fire the next dispatch round. Waves are sequenced by dependency; parallel waves use **isolated git worktrees** (`feedback_fleet_waves_use_worktree`). Models assigned by task shape.

> **Gate before any wave fires: Conner answers D1, D2, D3, D4** (≈20 min). FW-1 cannot ship clean without them.

| Wave | Scope | Model | Parallel? | Est. cost | Deliverable |
|------|-------|-------|-----------|-----------|-------------|
| **W1 — FW-1 Truth Wave** (R1,R2,R3,L4,L6,PR2 + P2 batch) | One PR: derive pricing from `tiers.ts` (kill $269/$239 drift), set `content.ts` tiers per D3, port compliance honesty qualifier + conditional tense to 9 vertical pages, add OpenAI subprocessor + scope AES claim + fix OAuth wording, home-services `runtime:'live'`, drop "~35 agents" + cancel-confirm | **Opus** (high-stakes copy + legal accuracy) | Sequential (lands first; others rebase on it) | $40–70 | 1 PR clearing 5 live P0s |
| **W2 — Canonical pricing module** (R4) | `lib/billing/facts.ts` single source; refactor `/pricing`, `home-content.ts`, vertical banners to read it; regression test | **Sonnet** (mechanical refactor) | After W1 | $20–40 | Drift structurally impossible |
| **W3 — Cost-governor verify** (A3,A4,A6) | Flip `LLM_MODEL_ROUTING=on` in founder workspace; refresh `pricing.ts` Haiku rates; build `fleet-economics.ts` rollup + 30%-of-MRR alarm | **Sonnet** | Parallel w/ W1 (separate worktree) | $20–40 | Margin observability + free routing margin |
| **W4 — Customer-vocab + E2E green** (PR1,I1) | Fix `/fleet`+`/disciplines/[id]` slugs via existing `agentDisplayLabel` mapping; get Playwright revenue-path suite green | **Sonnet** | Parallel (separate worktree) | $20–40 | Vocab consistent; CI revenue coverage |
| **W5 — Status page PR** (PR11 follow-on) | One-line footer link to `status.agentplain.com` after Conner sets the Better Stack monitor + CNAME | **Haiku** | After Conner config | $5–10 | Cheapest trust signal live |
| **W6 — Push business-plan PRs** (I11) | Push `business-plan/agentplain-2026-06` + `business-plan/money-gtm-pack-2026-06-14`; open PRs; verify brand-gate passes (baselined in `7b29509`) | **Haiku** | Parallel | $5–10 | Canonical plan on origin |

**Conner-side Phase-1 actions (not fleet-dispatchable):** D1–D4 decisions (gate W1) · Better Stack monitor + CNAME (gates W5) · counsel engagement email (L1) · testimonial ask (P2) · start first-10 prospect list (C1) · provision `ANTHROPIC_API_KEY_SECONDARY` (A8).

**Sequencing rule:** W1 lands first (everyone rebases on it per `feedback_sequential_not_parallel_for_overlapping_prs`); W3/W4/W6 run in parallel isolated worktrees; W2 follows W1; W5 follows Conner's Better Stack setup. After Phase 1 lands and at least one testimonial is live, proceed to the Phase 2 money-plumbing + AI-cost waves.

---

*This roadmap synthesizes 14 strategic packets. It plans the work; it authorizes none. Fire the waves in §9 once §5's D1–D4 are answered.*
