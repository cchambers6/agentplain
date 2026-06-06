# Ad Concepts — agentplain Wave 1, 2026-06-06

> 12 concepts, organized by the four vertical groups. Each names: the **hook** (one-line
> pitch), **target persona** (see PERSONAS.md), **channel fit** (see CHANNELS.md), and the
> **ROI claim** with its source. Every ROI figure is cited to `lib/verticals/*/content.ts`.
>
> **Voice guardrails on every concept:** heritage / grounded / plain-spoken. The fleet
> **drafts and proposes; the owner approves and sends.** No "automate everything," no "replace
> your team," no "AI magic," no "plane" wordplay (`project_agentplain_mission_and_positioning.md`
> banned variants; `feedback_everything_tells_a_story.md`). Plaino is the named service partner
> (`project_plaino_named_agent.md`). All-ten-verticals rule applies to general surfaces.

**The three flagship concepts (full scripts + copy + landing pages built this wave):**
**C1 · C2 · C5** (marked ★). Chosen for breadth (realty + finance + trades), strongest concrete
scenes, and the widest ROI spread (12x → 26x).

---

## Group A — Regulated finance (CPA · RIA · mortgage · insurance)

### ★ C2 — "You Get the Tool. We Run It For You." *(FLAGSHIP)*
- **Hook:** "ChatGPT hands you a blank box. We install a service partner that already knows
  tax season — and nothing leaves without your signature."
- **Persona:** P2 (Licensed Partner — CPA lead).
- **Channel fit:** Google Search (safety/skeptic + category queries), LinkedIn, YouTube.
- **ROI claim:** CPA **12x · $42,000/yr in tax-season hour reclamation per staff seat**
  (`lib/verticals/cpa/content.ts` L260-262). Scene anchor: March 17, 23 clients missing docs,
  partner reviews 19 drafts in 35 minutes (`cpa/content.ts` L310-318).
- **Why it wins:** answers the single biggest objection ("why pay when ChatGPT is free?") for
  the most risk-averse, highest-LTV buyer. This is the category-definition concept.

### C3 — "The 8-Week Chase, Done in a Morning"
- **Hook:** "Document chase used to eat 8 weeks. Plaino drafts all 23 reminders before you
  finish your coffee — you just hit approve."
- **Persona:** P2 (CPA) + P5 (CPA admin / CSM).
- **Channel fit:** Meta, Google Search (tax-season flighted Jan–Apr + Sep–Oct), Reddit (r/taxpros).
- **ROI claim:** CPA 12x / $42k per staff (`cpa/content.ts` L260); doc-chase consumes ~25% of
  staff hours across 8 weeks (`cpa/content.ts` L264).

### C4 — "A Bigger Book, Same You" (finance producer cut)
- **Hook:** "Speed-to-lead wins loans. Plaino has the borrower follow-up drafted before your
  competitor calls back — you send it from your own inbox."
- **Persona:** P4 (Producer — mortgage LO).
- **Channel fit:** LinkedIn, X, Google Search (speed-to-lead intent), YouTube.
- **ROI claim:** mortgage **9x · $22,000/yr per LO seat in cycle-time reclamation**
  (`lib/verticals/mortgage/content.ts` L218-220).

### C12 — "Renewals Don't Wait for You" (insurance)
- **Hook:** "Every renewal, every endorsement request, every COI — triaged and drafted
  overnight. Your CSR approves instead of retypes."
- **Persona:** P5 (insurance CSR) + P1 (agency principal).
- **Channel fit:** Meta, Google Search, Big-I / Agency-Nation adjacent placements.
- **ROI claim:** insurance **11x · $27,000/yr per CSR seat saved**
  (`lib/verticals/insurance/content.ts` L239-241).

---

## Group B — Realty (real estate · title/escrow · property management)

### ★ C1 — "Before You Open the Laptop" *(FLAGSHIP)*
- **Hook:** "Sarah's counter-offer landed at 9:14pm. By 6:30am the response was drafted, the
  comps pulled, the thread summarized. Four minutes instead of forty-five."
- **Persona:** P1 (Owner-Operator broker) + P4 (top-producing agent).
- **Channel fit:** Meta, YouTube, Google Search (transaction-coordinator / VA-cost intent),
  Facebook broker groups.
- **ROI claim:** real estate **26x · $5,300/mo recovered at the broker-owner level**
  (`lib/verticals/real-estate/content.ts` L213-217). Scene verbatim from the product's own
  value-loop example (`real-estate/content.ts` L260-269).
- **Why it wins:** highest ROI multiplier in the portfolio, the most universally felt scene
  (the early-morning bottleneck), and it dramatizes the core "what the fleet drafted before
  you open the laptop" promise (`app/(marketing)/page.tsx` L364).

### C6 — "Cycle Time Is the Whole Game" (title/escrow)
- **Hook:** "Every missing doc, every signature, chased and drafted the moment it's needed —
  so the file closes on time and you stop being the bottleneck."
- **Persona:** P5 (title closer) + P1 (agency owner).
- **Channel fit:** Google Search, Meta, escrow-officer Facebook groups, Qualia-adjacent.
- **ROI claim:** title/escrow **10x · $24,000/yr per closer in cycle-time reclamation**
  (`lib/verticals/title-escrow/content.ts` L234-236).

### C7 — "The Doors Don't Manage Themselves" (property management)
- **Hook:** "Maintenance requests triaged, owner updates drafted, delinquency notices ready to
  send — the portfolio runs while you sleep, and you approve in the morning."
- **Persona:** P1 (PM owner) + P5 (property manager).
- **Channel fit:** Meta, Google Search, NARPM-adjacent, AppFolio user communities.
- **ROI claim:** property management **15x · $36,000/yr saved on PM-hour and delinquency
  reclamation** (`lib/verticals/property-management/content.ts` L254-256).

---

## Group C — Ops-heavy (home services)

### ★ C5 — "The 73-Call Tuesday" *(FLAGSHIP)*
- **Hook:** "Hailstorm Tuesday night. 73 calls before lunch. The fleet classified every one by
  roof-age and zone, ranked 41 high-margin leads, and drafted the intake replies. You ran a
  one-hour review and dispatched by 1pm. None dropped."
- **Persona:** P3 (Trades Owner — roofing lead).
- **Channel fit:** Meta (storm-trigger geo), YouTube (trade audiences), Google Search
  (lead-management + supplement intent), Reddit (r/Roofing, r/HVAC).
- **ROI claim:** home services **14x · $50,000+/yr in insurance-supplement reclamation alone**
  at a storm-heavy shop (`lib/verticals/home-services/content.ts` L269-271, cited from
  `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3). Scene verbatim from the value-loop
  example (`home-services/content.ts` L317-325).
- **Why it wins:** the most cinematic scene in the portfolio, a persona under-served by C1/C2,
  a hard-dollar single-stream ROI ($50k+ from supplements alone), and it powers the
  storm-trigger geo playbook — the campaign's most defensible incrementality test.

### C8 — "Five Lead Sources, One Queue"
- **Hook:** "Angi, the website, Google, the referral, the truck-wrap call — all scored and
  routed into one queue, with the first reply already drafted. Stop letting leads rot."
- **Persona:** P3 (Trades Owner) + P5 (dispatcher).
- **Channel fit:** Meta, YouTube, Google Search ("roofing lead management," "answering service
  for HVAC").
- **ROI claim:** home services 14x / $50k+ supplement anchor; lead-leakage reduction is
  additive (`home-services/content.ts` L272-273 — "reduced lead leakage across HomeAdvisor /
  Angi / LSA / GBP").

---

## Group D — Professional services (law · recruiting)

### C9 — "The Practice of Law, Minus the Paperwork"
- **Hook:** "Intake, conflict checks, engagement letters, status updates — drafted for your
  signature. You spend the recovered hours practicing, not processing."
- **Persona:** P2 (Licensed Partner — attorney).
- **Channel fit:** LinkedIn, Google Search ("law firm intake automation," "reduce non-billable
  hours"), CLE-adjacent, YouTube.
- **ROI claim:** law **target 15x+ · $150,000/yr in attorney-hour reclamation at a 3-attorney
  firm** (`lib/verticals/law/content.ts` L261-263).

### C10 — "Placements Leak Where Follow-Through Dies"
- **Hook:** "Candidate follow-up, submittal prep, client status — drafted the moment each step
  is due. Plug the leaks between sourcing and placement."
- **Persona:** P4 (Producer — recruiter / staffing owner).
- **Channel fit:** LinkedIn (heaviest), X, Google Search, staffing-owner communities.
- **ROI claim:** recruiting **23x · $54,000/yr per recruiter in cycle-time and placement-rate
  reclamation** (`lib/verticals/recruiting/content.ts` L268-270).

---

## Cross-group / brand concepts

### C11 — "Your AI Ops Team — Without Hiring One" (umbrella / brand)
- **Hook:** "We install the fleet, connect your systems, run the weekly review, and customize
  as you grow. You run the business; we run the operation."
- **Persona:** P1 across all verticals (general umbrella).
- **Channel fit:** YouTube (brand), Meta (broad prospecting), homepage / `/verticals`.
- **ROI claim:** value band **$2,900–$10,600/mo per practitioner vs. $99–$299/seat — 15x to
  110x typical** (`lib/marketing/home-content.ts` L116-118; `app/(marketing)/page.tsx` L483).
  Names all ten verticals on-screen per the page-one rule.
- **Use:** top-of-funnel brand + the connective tissue between vertical-specific concepts.
  This is the line already live in the hero ("Your AI ops team — without hiring one,"
  `app/(marketing)/page.tsx` L82).

---

## Concept → asset map

| Concept | Group | Persona | Flagship? | Full script | Copy matrix | Landing page |
|---|---|---|---|---|---|---|
| C1 Before You Open the Laptop | Realty | P1/P4 | ★ | SCRIPTS/ | COPY.md | /promo/before-you-open-the-laptop |
| C2 You Get the Tool, We Run It | Finance | P2 | ★ | SCRIPTS/ | COPY.md | /promo/we-run-it-for-you |
| C5 The 73-Call Tuesday | Ops | P3 | ★ | SCRIPTS/ | COPY.md | /promo/the-73-call-tuesday |
| C3 8-Week Chase | Finance | P2/P5 | | Wave 2 | | |
| C4 Bigger Book, Same You | Finance | P4 | | Wave 2 | | |
| C6 Cycle Time | Realty | P5/P1 | | Wave 2 | | |
| C7 Doors Don't Manage Themselves | Realty | P1/P5 | | Wave 2 | | |
| C8 Five Sources, One Queue | Ops | P3/P5 | | Wave 2 | | |
| C9 Practice of Law Minus Paperwork | Prof svc | P2 | | Wave 2 | | |
| C10 Placements Leak | Prof svc | P4 | | Wave 2 | | |
| C11 Your AI Ops Team | Brand | P1 | | Wave 2 (brand) | | |
| C12 Renewals Don't Wait | Finance | P5/P1 | | Wave 2 | | |
