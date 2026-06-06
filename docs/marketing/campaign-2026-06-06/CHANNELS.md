# Channel Architecture — agentplain Wave 1, 2026-06-06

> Channel mix, budget-split logic, targeting parameters, benchmark CPM/CPC/CAC ranges, and the
> attribution model for the first wave of paid acquisition. Conversion goals trace to the two
> real in-product events: **talk-to-Plaino chat opened** and **trial start**
> (`app/(marketing)/page.tsx` — "Start free trial" → `/app/sign-up`; "Talk to a service
> partner" mailto/chat). No outbound is sent by agentplain itself — paid media drives to owned
> surfaces only (`project_no_outbound_architecture.md`).

> All benchmark ranges below are **industry-typical planning bands** for B2B local-services
> acquisition, used to set initial bids and CAC guardrails — they are not measured agentplain
> results. They will be replaced by measured numbers after the first 30 days. (Per
> `feedback_no_guesses_no_estimates.md`, anything later asserted as *our* number must cite the
> ad-platform report it came from.)

---

## 1. Strategy in one paragraph

We are defining a category ("a service partnership that runs an AI fleet *for* you," not a
chatbot you operate) for a skeptical, relationship-driven, non-coastal buyer. That means the
mix is weighted toward **intent capture** (Google Search — people already looking for a VA,
coordinator, or lead-management fix) and **high-fidelity demand creation** (YouTube + Meta
video — where the concrete "day in the life" scenes do the convincing), with **LinkedIn** as
the precision instrument for the licensed/professional personas (P2, P4) and **X / Reddit** as
small, surgical test beds. We do not spray. Every dollar maps to a persona and a concept.

---

## 2. Recommended mix & budget split

Planning assumption: a **$40,000/mo** Wave-1 working-media budget (adjust pro-rata; the
*percentages* are the recommendation, not the absolute dollars).

| Channel | % of budget | Monthly @ $40k | Primary job | Primary personas | Primary concepts |
|---|---|---|---|---|---|
| **Google Search** | 30% | $12,000 | Capture existing intent | P1, P2, P3, P4 | #2 (finance), #3 (trades), #1 (realty) |
| **Meta (FB/IG)** | 28% | $11,200 | Demand creation + geo/storm + champion social | P1, P3, P5 | #1, #3 |
| **YouTube** | 20% | $8,000 | Long-form proof; the scenes that convince | P1, P2, P3, P4 | #1, #2, #3 |
| **LinkedIn** | 14% | $5,600 | Precision targeting of licensed/professional ICPs | P2, P4 | #2 |
| **X (Twitter)** | 4% | $1,600 | Test bed — producer/finance communities | P4 | #2 variant |
| **Reddit** | 4% | $1,600 | Test bed — high-intent niche subs | P2, P3, P5 | #2, #3 |

**Why this shape:**
- **Search is the floor, not the ceiling.** It is the highest-intent, most efficient CAC and
  it funds the learning. But search-only caps at existing demand; this is a category-creation
  motion, so >50% goes to demand creation (Meta + YouTube).
- **Meta over-indexes** because two of our three flagship concepts are *visual, concrete
  scenes* (the 6:30am kitchen; the storm-day dispatch) and because the trades + champion
  personas live there. Meta also carries the **storm-trigger geo playbook** for P3.
- **LinkedIn is expensive per click but precise** — it is the only channel that can target
  "Managing Partner at a 1–10 person CPA firm." Reserved for P2/P4 where the seat value (and
  Partner-tier $299/seat) justifies a higher CAC.
- **X + Reddit are 4% each, explicitly experimental.** Kill or scale at day 30 on measured CAC.

### Budget-split decision logic (how to rebalance after launch)
1. Hold Search at ≥25% until branded-search volume proves demand creation is working
   (rising branded queries = the video is landing).
2. Shift budget *toward* whichever channel hits trial-start CAC < target first; shift *away*
   from any channel above 1.5× target CAC after 2 weeks of stable spend.
3. Treat YouTube as the "assist" engine — judge it on view-through + branded-search lift, not
   last-click trials (see attribution §5).

---

## 3. Per-channel targeting parameters

### Google Search (30%)
- **Campaign structure:** one campaign per vertical group (regulated-finance / realty /
  ops-heavy-trades / professional-services) → ad groups per intent cluster.
- **Intent clusters & seed keywords:**
  - *Substitute-shopping* (highest intent): "transaction coordinator cost," "virtual assistant
    for [vertical]," "answering service for HVAC," "tax document collection software."
  - *Problem-aware:* "stop missing leads after a storm," "reduce non-billable hours," "speed to
    lead mortgage," "automate estimate follow-up."
  - *Safety/skeptic (P2):* "is AI safe for tax prep," "AI for accounting firms," "AI tools that
    keep human review."
  - *Competitor/category:* "Claude for small business alternative," "AI assistant for [vertical]."
- **Match types:** phrase + exact at launch; broad only with a tight negative list and Smart
  Bidding after conversion data accrues.
- **Negatives:** "free," "jobs," "salary," "course," "remote work," "template" (filters
  job-seekers and freebie-hunters).
- **Landing:** intent → matching `/promo/[slug]` concept page (see LANDING.md), *not* the
  homepage. Vertical-group campaigns → vertical landing where it exists.

### Meta — Facebook / Instagram (28%)
- **Prospecting audiences:**
  - Interest + behavior stacks per persona (e.g. P1: "real estate broker" + "small business
    owner" + admins of real-estate pages; P3: "roofing" + "general contractor" + ServiceTitan/
    Jobber interest).
  - **Storm-trigger geo (P3):** custom DMA ringfences activated within 48h of a NOAA hail/wind
    event in target states; creative = Concept #3.
  - **Champion social (P5):** Reels/Stories-first relatable creative, broad-ish interest,
    optimized for landing-page view + lead, designed to forward upward.
- **Retargeting:** site visitors, video 50%+ viewers, calculator-engaged → trial CTA.
- **Lookalikes:** seed from trial-starts and talk-to-Plaino openers once ≥100 conversions.
- **Placements:** Reels + Feed + Stories; advantage+ placements off until creative is proven.
- **Optimization event:** trial-start (or talk-to-Plaino) — *not* landing-page view, once
  pixel volume supports it.

### YouTube (20%)
- **Formats:** in-feed (discovery) + skippable in-stream (the 30s/60s scripts) + a small
  Shorts test for P5.
- **Targeting:** custom intent (people who searched the Search keywords above), affinity
  (small-business-owner), placements on vertical-trade channels (Roofing Insights, real-estate
  coaching, accounting-pro channels), and remarketing.
- **Job:** carry the *full* day-in-the-life proof that a 6-second hook can't. Measured on
  view-through conversions + branded-search lift, not last-click.

### LinkedIn (14%)
- **Targeting:** job title (Managing Partner, Owner-CPA, Principal Attorney, Loan Officer,
  Recruiter/Staffing Owner) × company headcount (1–50) × industry (Accounting, Legal,
  Financial Services, Real Estate, Staffing). Exclude enterprise.
- **Formats:** single-image + document ("the 1300-char long-form," see COPY.md) + a thought-
  leader video test from a founder/operator account.
- **Job:** P2/P4 precision. Highest CAC tolerance because seat value is highest (Partner tier).
- **Lead handling:** drive to `/promo/[slug]` or talk-to-Plaino; LinkedIn lead-gen forms only
  as a retargeting fallback.

### X / Twitter (4% — test)
- Communities/follower targeting in finance, mortgage, recruiting, sales. ROI-forward copy
  (Concept #2 variant). Kill at day 30 if CAC > 2× blended.

### Reddit (4% — test)
- Subreddit targeting: r/taxpros, r/accounting, r/realtors, r/Insurance, r/HVAC, r/Roofing.
- Native-feeling, value-first creative only — Reddit punishes ad-speak. Concept #2/#3.
- Heavy negative-comment monitoring; this is a brand-risk surface, run it carefully.

---

## 4. Benchmark CPM / CPC / CAC planning bands

Industry-typical B2B local-services bands (planning only — replace with measured data at day 30):

| Channel | CPM (planning) | CPC (planning) | Landing→trial CVR (planning) | Implied trial CAC band |
|---|---|---|---|---|
| Google Search | — | $4–$12 | 4–9% | $90–$250 |
| Meta | $12–$25 | $1.50–$4.50 | 2–5% | $120–$300 |
| YouTube | $10–$22 | $0.10–$0.30 (CPV) | assist-weighted | $150–$400 (last-click) |
| LinkedIn | $30–$60 | $8–$18 | 3–6% | $250–$600 |
| X | $8–$18 | $1–$5 | 1.5–4% | $150–$400 |
| Reddit | $6–$15 | $0.50–$3 | 1.5–4% | $120–$350 |

**CAC guardrail logic:** Regular-tier first-seat value is **$199/mo / $2,388/yr**; Partner-tier
first-seat is **$299/mo / $3,588/yr** (`lib/marketing/home-content.ts` L22-43). With first
month free, payback starts month 2. A defensible blended **target trial-start CAC ≤ $300** (≈
1.5 months of Regular revenue) and **≤ $500 for LinkedIn/Partner-targeted P2** is the launch
guardrail; tighten once retention/LTV data exists. Because this is a *service partnership* with
human-touch onboarding, expect strong logo retention to support a higher CAC than self-serve
SaaS — but do **not** assume that until measured.

---

## 5. Attribution model

**Model: data-driven / position-based hybrid, with view-through credit for YouTube + Meta
video, and branded-search lift as the demand-creation truth signal.**

- **Last-click is the floor, not the verdict.** Search will look great and YouTube will look
  weak under last-click; that under-credits the channel actually creating the demand. Use a
  position-based model (40% first touch / 20% middle / 40% last touch) so demand-creation
  channels get fair credit.
- **Two conversion events, both real in-product:**
  1. **Talk-to-Plaino chat opened** (micro-conversion, upper-funnel intent signal).
  2. **Trial start** (`/app/sign-up` completion — the primary KPI).
- **View-through window:** 1-day-view / 7-day-click for Meta; YouTube view-through on 30s+
  watch. Report click- and view-through separately; never blend silently.
- **Branded-search lift** is the demand-creation scoreboard: weekly branded-query volume
  (Google Search Console) is the leading indicator that the video concepts are working, even
  before trials convert.
- **Holdout / incrementality:** run a geo holdout for Meta storm-trigger (P3) and a
  branded-search ghost-bid test, so we measure *incremental* trials, not just attributed ones.
- **UTM discipline:** `utm_source` / `utm_medium` / `utm_campaign=ap-w1-[verticalgroup]` /
  `utm_content=[concept-slug]-[variant]`. Every `/promo/[slug]` page reads UTMs into the
  trial-start event so concept-level CAC is queryable.
- **Source of truth:** ad-platform numbers reconcile against in-product trial-start events
  (the product database is canonical for "did they actually start a trial"); discrepancies
  resolve to the product side.

**North-star for Wave 1:** cost per **trial start** by concept × persona × channel, with
talk-to-Plaino as the leading micro-conversion and branded-search lift as the demand-creation
proof.

---

## 6. Flighting

- **Weeks 1–2:** all channels live at reduced budget; gather pixel/conversion data; Search +
  Meta carry the load. Creative = all 3 top concepts, 3 variants each.
- **Weeks 3–4:** rebalance per §2 logic; kill bottom-quartile ad sets; scale the winning
  concept×channel pairs. Activate storm-trigger automation for P3.
- **Day 30:** full read — replace every planning band in §4 with measured CAC; decide X/Reddit
  keep-or-kill; brief Wave 2 from the winning concepts.
