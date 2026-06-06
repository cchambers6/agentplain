# Campaign Personas — agentplain, 2026-06-06

> **Audience rule (load-bearing):** the subject is always *local businesses / local
> business owners / entrepreneurs* — never "SMB," "knowledge workers," or
> "white-collar workers" (`project_agentplain_mission_and_positioning.md` L70-72).
> Every persona below is a real role inside one of the ten locked verticals
> (`lib/verticals/*/content.ts`).

> **What we are selling them (positioning lock):** a *service partnership*, not a
> tool. "We install the fleet of capable AI partners inside your business,
> configure it for your vertical, run weekly reviews, and customize as your ops
> change." The fleet **drafts and proposes; the owner approves and sends** —
> nothing leaves without their name on it (`app/(marketing)/page.tsx` L84-93,
> `project_no_outbound_architecture.md`). The named service partner is **Plaino**
> (`project_plaino_named_agent.md`).

> **Voice:** heritage / grounded / plain-spoken — "Intelligence rooted in reality."
> agentplain = *agent + the plains, where things take root.* No "plane" wordplay,
> no coastal-SaaS buzzwords, no "AI magic" (`feedback_brand_is_plain_not_plane.md`,
> `feedback_everything_tells_a_story.md`).

---

## Persona summary table

| # | Persona | Core verticals | Economic role | The 2am thought | Primary ROI anchor |
|---|---------|---------------|---------------|-----------------|--------------------|
| P1 | **The Owner-Operator** ("Dana") | Real estate, insurance, property management | Buyer + user | "I'm the bottleneck. Everything routes through me and I can't grow past myself." | 26x · $5,300/mo recovered (real estate) |
| P2 | **The Licensed Partner** ("Marcus") | CPA, law, RIA | Buyer + user | "My license is the asset and I spend half my week on work a license doesn't require." | $42k–$175k/yr in billable-hour reclamation |
| P3 | **The Trades Owner** ("Ray") | Home services (roofing/HVAC/plumbing) | Buyer + user | "Every storm I leave money on the table because I can't answer 73 calls at once." | 14x · $50k+/yr in supplement reclamation |
| P4 | **The Producer Who Wants to Scale** ("Priya") | Mortgage, recruiting, individual agent | Buyer + user | "My income is cycle time. I want a bigger book without hiring a coordinator." | 9x–23x · faster cycle = more closings/placements |
| P5 | **The Back-Office Anchor** ("Sam") | Title/escrow, insurance CSR, PM, CPA admin | Champion / influencer | "I hold every thread in my head. If I take a day off, things drop." | 10x–15x · cycle-time + drop-rate reclamation |

P1–P4 are economic buyers (owner-operators or eat-what-you-kill producers). **P5 is the
internal champion** — the person who *feels* the pain daily and will advocate the loudest,
even when the owner signs. Campaign creative targets buyers; nurture and product-trial
content is built for P5 to forward upward.

---

## P1 — The Owner-Operator ("Dana")

**Who:** Owns an independent real-estate brokerage (5–25 agents), a P&C insurance agency,
or a small property-management company (50–500 doors). Often *also* the top producer —
still carrying a personal book while running the shop. 42–58 years old. Built the business
on relationships and reputation, not systems. Suspicious of "tech that promises the world."

**Demographics / firmographics:**
- Title: Broker-owner, Agency principal, Managing broker, Owner/PM.
- Firm size: 5–25 seats; $1M–$8M gross revenue; owner-operator or small partnership.
- Geography: secondary and tertiary metros, suburban, small-city Main Street — *not*
  coastal-tech hubs. This is the literal "the plains" customer.
- Tech maturity: pays for a CRM (Follow Up Boss, kvCORE, EZLynx, AppFolio) but uses ~30%
  of it. Lives in email + phone + a transaction system.

**Pain points (in their words):**
- "I'm the bottleneck. Every lead, every compliance question, every 'quick' coordination
  task routes through me."
- "I became an owner to build a business and I spend 8–12 hours a week on email triage and
  follow-up" (`lib/verticals/real-estate/content.ts` L216 — 8-12 owner-hrs/wk).
- "Compliance flags fire *after* the listing's already live" (real-estate JTBD,
  `content.ts` L129).
- "I can't justify a $55k/yr office manager, but I can't keep doing it myself."

**Watering holes:**
- Facebook groups (broker-owner peer groups, state-association groups), Inman News, NAR /
  state-association events, local BNI / chamber chapters, Tom Ferry / brokerage-coaching
  ecosystems. Insurance: Big I (IIABA) state chapters, Agency Nation. PM: NARPM.
- Podcasts in the car between showings/site visits.

**Content they consume:** short practical video, peer war-stories, "how the top brokerage in
my market runs their ops," coaching webinars. Skeptical of whitepapers; trusts other owners.

**Search triggers (the moment they look for help):**
- "real estate transaction coordinator cost" / "virtual assistant for brokerage"
- "how to follow up with real estate leads automatically"
- "fair housing compliance checklist" (compliance scare → looks for a safety net)
- A near-miss: a deal almost fell through on a dropped thread → "I can't let that happen again."

**Hook that lands:** *"What the fleet drafted before you open the laptop."* Dana feels the
bottleneck most at 6:30am. → Top Concept #1 ("Before You Open the Laptop").

**Channel fit:** Meta (interest + lookalike), YouTube in-feed, Google Search on
"transaction coordinator / VA cost" intent, Facebook broker groups.

---

## P2 — The Licensed Partner ("Marcus")

**Who:** Solo or 2–10-person CPA firm, small law firm, or independent RIA. The license *is*
the business. 38–60. Bills by the hour or by engagement; every hour on admin is an hour not
billed. Conservative, compliance-sensitive, risk-averse about anything touching client data
or regulated output.

**Demographics / firmographics:**
- Title: Managing partner, Owner-CPA, Principal attorney, Founding advisor.
- Firm size: 1–10 professionals; $300k–$3M revenue.
- Vertical economics: CPA 12x / $42k per staff seat (`lib/verticals/cpa/content.ts` L260-262);
  law target 15x+ / $150k at a 3-attorney firm (`lib/verticals/law/content.ts` L261-263);
  RIA target 15x+ / $175k at a 3-advisor practice (`lib/verticals/ria/content.ts` L271-273).
- Recommended tier: **Partner** ($299→$199/seat, 4 hrs/mo named-service-partner time) —
  the cadence depth matches tax season / case load (`cpa/content.ts` L18-23).

**Pain points (in their words):**
- "I spend 8 weeks every tax season chasing documents instead of advising"
  (`cpa/content.ts` L165, value-loop L313-318).
- "Every return, I run the same federal + state checklist by eyeball before I sign."
- "I'd never let a generic chatbot near a client return — I need something that knows the
  rules and that *I* still sign off on."
- Law: "Intake, conflict checks, engagement letters, status updates — none of it is the
  practice of law, all of it eats the day."

**Watering holes:** AICPA / state-society publications and CPE, Karbon / TaxDome user
communities, the Tax Pro / Accounting Today ecosystem, r/accounting, r/taxpros, state-bar
sections and CLE, law-practice-management blogs (Clio's ecosystem), ProAdvisor groups.

**Content they consume:** CPE/CLE-flavored explainers, peer-firm case studies, anything that
leads with *risk reduction and "you stay in control."* Wants the citation, not the vibe.

**Search triggers:**
- "AI for accounting firms" / "is AI safe for tax prep" / "tax document collection software"
- "law firm intake automation" / "how to reduce non-billable hours"
- "RIA client review prep" / "how to scale advisory without hiring"
- Tax-season onset (Jan–Feb) and extension deadlines (Sep–Oct) are seasonal demand spikes.

**Hook that lands:** *"You get the tool. We run it for you — and nothing leaves without your
name on it."* The control + service-partnership framing is the unlock for the most risk-averse
buyer. → Top Concept #2 ("You Get the Tool. We Run It For You.").

**Channel fit:** Google Search (highest-intent + safety queries), LinkedIn (title + firm
targeting), CPE/CLE-adjacent placements, retargeting with the citation-heavy long-form.

---

## P3 — The Trades Owner ("Ray")

**Who:** Owns a residential trades operation — roofing, HVAC, plumbing, electrical, GC
remodel — with 5–25 crew. 35–55. Came up in the field, runs the business from a truck and a
phone. Not a "computer person"; allergic to anything that smells like a software project.
Revenue is lumpy and storm/season-driven.

**Demographics / firmographics:**
- Title: Owner, GM, Owner-operator.
- Firm size: 5–25 crew; $1M–$25M revenue; storm-exposed roofing shops skew higher.
- Vertical economics: 14x / **$50k+/yr in insurance-supplement reclamation alone** at a
  storm-heavy shop (`lib/verticals/home-services/content.ts` L269-271, cited from
  `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3).
- Stack: ServiceTitan / Jobber / Housecall Pro / AccuLynx / JobNimbus + a pile of lead
  sources (Angi, HomeAdvisor, LSA, GBP, referrals).

**Pain points (in their words):**
- "A hailstorm hits and the phone rings 73 times before lunch — I can't answer them all, so I
  lose the ones I don't get to" (`home-services/content.ts` value-loop L319-325).
- "The supplement fight with adjusters is 30–60% of my office's time and I'm still leaving
  money on the table" (`content.ts` L254).
- "Leads come from five places and half of them rot before anyone calls back."
- "I don't have time to learn another app. Just make it work."

**Watering holes:** Trade Facebook groups (Roofing Insights, HVAC pros), YouTube (trade
channels, business-of-trades creators like Roofing Insights / ServiceTitan's Toolbox),
trade shows (IRE, AHR Expo), supplier counters, ride-along podcasts.

**Content they consume:** raw, real, jobsite-shot video. War stories. "How a shop like mine
stopped losing storm leads." Hates polish-for-polish's-sake; trusts other owners in work
shirts.

**Search triggers:**
- "roofing lead management" / "stop missing calls after a storm"
- "insurance supplement software roofing" / "Xactimate supplement help"
- "answering service for HVAC" / "how to follow up on estimates automatically"
- A storm event itself is the trigger — demand is weather-correlated and geo-spiky.

**Hook that lands:** *"The 73-call Tuesday."* The storm-day chaos scene is visceral and
specific. → Top Concept #3 ("The 73-Call Tuesday").

**Channel fit:** Meta (geo + storm-triggered), YouTube (trade audiences), Google Search on
lead-management + supplement intent, Local-Service-adjacent retargeting. Geo-spike playbook:
ringfence storm-hit DMAs within 48 hours.

---

## P4 — The Producer Who Wants to Scale ("Priya")

**Who:** Independent mortgage loan officer, boutique recruiter / staffing principal, or a
high-producing individual real-estate agent. 30–48. Eat-what-you-kill: income is a direct
function of throughput and cycle time. Ambitious, growth-minded, *will* adopt tech if it
demonstrably makes them more money. Doesn't want to become a manager — wants leverage.

**Demographics / firmographics:**
- Title: LO / branch producer, Recruiter / staffing owner, Top-producing agent or small team
  lead.
- Firm size: 1–5 seats; commission-driven.
- Vertical economics: mortgage 9x / $22k/yr per LO seat in cycle-time reclamation
  (`lib/verticals/mortgage/content.ts` L218-220); recruiting **23x / $54k/yr per recruiter**
  in cycle-time + placement-rate reclamation (`lib/verticals/recruiting/content.ts` L268-270);
  real-estate 26x / $5,300/mo (`real-estate/content.ts` L213-215).

**Pain points (in their words):**
- "Speed-to-lead is everything and I can't be first when I'm in a closing / an interview / a
  showing."
- "Every hour on status updates and pipeline hygiene is an hour I'm not originating."
- "I want to double my book, but the only lever I know is hiring a coordinator I can't afford
  yet."
- Recruiting: "Candidate follow-through and submittal prep is where placements leak."

**Watering holes:** LinkedIn (heaviest here of any persona), production-coaching ecosystems
(mortgage: The Mortgage Calculator / branch communities; recruiting: staffing-owner groups,
The Staffing Show), X/Twitter finance + sales communities, Sierra/FUB user groups, sales
podcasts.

**Content they consume:** ROI-forward, "how I closed X more deals," tactical thread content,
LinkedIn long-form, creator-led video. Responds to *numbers* and to peer flexing.

**Search triggers:**
- "speed to lead mortgage" / "loan officer CRM automation"
- "recruiting follow-up automation" / "ATS that does the busywork"
- "how to scale my real estate business without a team"
- Income plateau frustration; a quarter where they *know* they left deals on the table.

**Hook that lands:** the throughput math — *"More closings, same you."* Variant of Concept #1
+ the ROI-calculator landing. P4 is the most calculator-responsive persona.

**Channel fit:** LinkedIn (title + skill targeting), X, YouTube, Google Search on
speed-to-lead / CRM-automation intent.

---

## P5 — The Back-Office Anchor ("Sam") — *the champion*

**Who:** Title/escrow closer, insurance CSR, property manager, CPA admin / client-services
manager, paralegal, dispatcher. 28–52. The person who *actually holds every thread*. Not
usually the economic buyer — but the loudest internal advocate, because the pain is theirs
every single day. The product's first power user.

**Demographics / firmographics:**
- Title: Closer, CSR, Account manager, Office manager, Admin, Dispatcher, Paralegal, CSM.
- Vertical economics: title/escrow 10x / $24k/yr per closer (`lib/verticals/title-escrow/content.ts`
  L234-236); insurance 11x / $27k/yr per CSR (`lib/verticals/insurance/content.ts` L239-241);
  property management 15x / $36k/yr (`lib/verticals/property-management/content.ts` L254-256).

**Pain points (in their words):**
- "If I take a sick day, things drop. I'm the single point of failure and nobody sees it."
- "I retype the same updates fifty times a day across email, the system, and the phone."
- "I want to do the *good* part of my job — talking to people — not the copy-paste."
- Title: "Cycle time is everything and I'm the one chasing every missing doc and signature."

**Watering holes:** role-specific Facebook groups (escrow officers, CSR communities, NARPM
for PMs), LinkedIn role groups, vendor user communities (AppFolio, EZLynx, Qualia), Reddit
(r/Insurance, r/realtors back-office threads), TikTok/Reels "day in the life of a [role]."

**Content they consume:** relatable "this is my actual day" content, time-back stories,
anything that says *"you keep control, the tedium goes away."* They forward content upward
to the owner with "can we get this?"

**Search triggers:**
- "[role] burnout" / "too much admin work" / "automate data entry [system]"
- often discover via social, not search — then research the product to pitch their boss.

**Hook that lands:** *"You keep the relationships. The tedium goes away."* — the mission line,
literally. Used in social-first creative (Reels/TikTok/Shorts) and in the trial-nurture
sequence designed to be forwarded to the owner.

**Channel fit:** Meta/Reels, TikTok, LinkedIn role groups, retargeting → owner-targeted
case-study content. P5 is a *demand-gen and word-of-mouth* play, not a direct-close play.

---

## Cross-persona notes for media buying

- **Buyers (P1–P4)** get direct-response creative with an ROI claim and a trial CTA.
- **Champion (P5)** gets relatable social creative + a forward-to-your-boss trial-nurture path.
- **All ten verticals must appear on page one** of any general surface
  (`feedback_everything_tells_a_story.md`) — vertical-specific creative narrows to one ICP,
  but the landing experience always offers "not your industry? pick yours →."
- **Never claim "built for X"** without the per-vertical compliance corpus + JTBD + a
  reference customer; soften to "built for" only where the corpus fires today (real estate
  fair-housing scanner). Elsewhere lead with the value loop, not a compliance claim
  (`project_agentplain_mission_and_positioning.md` Q6, `lib/marketing/home-content.ts` L66-67).
