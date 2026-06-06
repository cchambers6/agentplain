# Home-services wedge — claims-to-cash, not speed-to-lead

**Date:** 2026-06-06
**Author:** fleet wave `feat/home-services-win-strategy-2026-06-06`
**Status:** proposal for Conner's call. Does not change any locked rule. The no-outbound
architecture (`~/memory/project_no_outbound_architecture.md`, ratified 2026-05-06)
remains load-bearing and is not touched by this wedge — see `ARCHITECTURE_QUESTIONS.md`
for the one place it has to be read carefully.

---

## TL;DR

The wedge is **supplement & claims-documentation depth for storm/restoration trades**
— roofing first. We do NOT compete on speed-to-lead. We win the part of the job that
happens *after* the lead is captured and *after* the adjuster's first scope lands: the
line-item supplement that recovers money the carrier left out, and the documentation
trail (photos, measurements, scope, certs) that makes the supplement approvable.

This is not a new bet. It is the bet the product already half-makes. The home-services
vertical page already names a **Supplement agent** and anchors its entire ROI on it:

> "$50,000+ / yr in supplement reclamation alone at a storm-heavy shop … This single
> agent [insurance supplement] saves $50K+/yr at a storm-heavy shop."
> — `lib/verticals/home-services/content.ts:271`, citing
> `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3

The roadmap already chose roofing as V1 for exactly this reason:

> "Working V1 sub-vertical (roofing — per `b2b_vertical_opportunity_analysis_2026-04-27.md`,
> highest deal size + insurance-supplement workflow + lower competitive density)"
> — `docs/agent-interviews/02-vertical-agents.md:183`

This document does one thing: it kills the speed-to-lead distraction, names supplement
depth as the single wedge, and defends that choice with the audit data and the
constraint. Everything downstream (`PRODUCT_SPEC.md`, `GTM.md`, `COMPETITIVE_DELTA.md`)
builds on this one decision.

---

## The battle we are NOT fighting, and why

The competitive read is that home-services buyers want **speed-to-lead in under 60
seconds** — auto-text and auto-call the instant a lead comes in. Hatch, ServiceTitan's
AI layer, and the voice-AI entrants (Rilla on the coaching side, Avoca AI / ServiceAgent
on the inbound-call side per the watchlist in
`docs/agent-interviews/02-vertical-agents.md:179`) all orient around that first-touch
race.

We cannot win that battle, and we should stop pretending the constraint is a bug:

1. **The no-outbound architecture forbids the mechanism.** agentplain agents READ,
   REASON, and DRAFT; any reaching out (SMS, voice, dialer) executes from the customer's
   own system with the customer's permissions
   (`~/memory/project_no_outbound_architecture.md`). "Twilio, SendGrid, dialer APIs are
   forbidden in agentplain's surface" — verbatim. A <60s auto-call product would require
   us to *be* the dialer. That is the one thing we have decided not to be, for compliance
   (TCPA caller-of-record liability), cost, and positioning reasons.

2. **The category is already commoditized.** Speed-to-lead is a feature ServiceTitan
   ships inside the FSM the customer already pays for, and Hatch sells as a point tool.
   Entering there means being a worse, slower version of an incumbent's bundled feature.

3. **It's the wrong end of the value chain.** Speed-to-lead optimizes the *cheapest*
   moment in the job — the first reply. The expensive moments are the supplement (tens of
   thousands of dollars per storm job) and the documentation that determines whether the
   supplement gets paid. Competitors crowd the cheap moment and abandon the expensive one.

**Conclusion: speed-to-lead is a lost battle on a low-value square. Concede it cleanly.**

The Lead Router and Estimate-Followup agents we already ship
(`lib/verticals/home-services/content.ts:37-66`) are enough of a lead-side story —
they route and nudge from the operator's own inbox, no outbound required. We don't
abandon lead handling; we just refuse to make the <60s race our differentiator.

---

## The wedge: supplement & claims-documentation depth

### What it is

For storm and restoration trades, the money is in the **insurance claim**, not the cash
job. The sequence is:

1. Storm hits → homeowner files a claim → carrier sends an adjuster.
2. The adjuster writes a **scope** (in Xactimate or Symbility) — almost always *short*.
   It misses code-required items, underprices line items, omits accessories, and uses
   stale unit pricing.
3. The contractor must write a **supplement**: a line-by-line rebuttal that adds the
   missed scope, cites the code/measurement/photo evidence, and re-prices to the carrier's
   own price list — then routes it back to the adjuster for approval.
4. Approved supplement = recovered revenue. A storm-heavy shop's margin lives here.

The audit's number: **30–60% of back-office time at storm-heavy shops** is spent reading
adjuster scopes and preparing supplements (`lib/verticals/home-services/content.ts:253`).
That is the single largest, most-skilled, most-underserved back-office job in the trade.

### Why it wins

- **No competitor touches it.** Hatch is first-touch outreach. Rilla is rep call-coaching.
  ServiceTitan's AI is dispatch/CRM/booking. None of them read an Xactimate scope and
  draft a line-item supplement. This is open field — the audit's exact phrase for roofing
  was "**lower competitive density**" (`docs/agent-interviews/02-vertical-agents.md:183`).
- **The constraint is irrelevant here.** A supplement is a *document the contractor
  prepares and the owner signs and sends*. It is draft-and-advise by nature — the exact
  shape the no-outbound architecture is built for. We do not have to bend any rule to do
  our best work on the highest-value job. (One edge — sending the supplement TO the
  carrier — is examined in `ARCHITECTURE_QUESTIONS.md`; the answer there is still
  "customer's system sends," so even the edge stays inside the rule.)
- **The ROI is already underwritten.** $50K+/yr per storm-heavy shop, cited from the
  vertical opportunity analysis, against a $299→$199 per-seat Partner tier — ~14x at a
  single seat (`lib/verticals/home-services/content.ts:268-275`). No other agent in any
  vertical has an ROI claim this large or this defensible.
- **It compounds with documentation.** A supplement is only as good as its evidence. The
  same wedge pulls in photo (CompanyCam), measurement (EagleView/Hover), and compliance
  documentation (lien waivers, certs of completion, EPA RRP, Magnuson-Moss warranty
  language) — all of which the Sentinel compliance corpus already partly covers
  (`outputs/counsel-handoff-packets/home-services.md`). The wedge isn't one agent; it's a
  coherent **claims-to-cash workspace**.
- **It is sticky and high-switching-cost.** Once a shop's supplement workflow, price
  lists, and evidence templates live in agentplain, ripping it out means going back to
  hand-drafting in Word and fax (`lib/verticals/home-services/content.ts:152` — the
  "today" state). Speed-to-lead tools have near-zero switching cost; a supplement engine
  embedded in the shop's claim P&L does not.

### Who we beat

| Competitor | Their square | Why they lose the supplement square |
| --- | --- | --- |
| **Hatch** | <60s lead outreach, automated follow-up texts | Never touches the post-adjuster claim. Pure top-of-funnel. |
| **ServiceTitan AI** | Booking, dispatch, CRM, call summary inside the FSM | Built for service/maintenance trades, not storm restoration; no Xactimate scope reading; supplement is out of product scope. |
| **Rilla** | Virtual ride-along / rep call-coaching (speech analytics) | Coaches the sales conversation; has nothing to do with claims or carrier scope. Orthogonal. |
| **Avoca AI / ServiceAgent** | AI inbound call answering / CSR | Front-desk, not back-office. Never reaches the supplement. |

### Who we still lose (honest)

- **The lead race.** If a buyer's *only* problem is "I miss calls and lose leads," Hatch /
  Avoca / ServiceTitan win and we should not pretend otherwise. Our lead story (Router +
  Followup, drafts from their own inbox) is *adequate*, not *category-leading*. We sell
  past it to the claim.
- **Pure service/maintenance trades with little insurance work.** A plumbing or HVAC shop
  doing mostly cash repair calls has a small supplement surface. The wedge is sharpest for
  **storm restoration (roofing, then water/fire restoration, then storm-exposed
  exteriors)**. We lead with roofing and expand along the insurance-claim axis, not the
  trade axis.
- **Xactimate itself / Verisk.** We are not replacing the estimating platform. We read its
  output and draft against it. If Verisk ships its own AI supplement-writer inside
  Xactimate, that is the real long-term threat — covered in `COMPETITIVE_DELTA.md`. Our
  defense is being platform-neutral (we also read Symbility) and owning the
  contractor's *evidence + price-list + cadence* layer, which Verisk has no incentive to
  build for the contractor's side of the table.

---

## Why one wedge, not four

The brief offered four candidate wedges: supplement depth, compliance/documentation,
insurance-carrier liaison (COI/ACORD), and follow-up depth. They are not equals.

- **Compliance/documentation** is real but is a *supporting layer* of the supplement
  wedge, not a standalone reason a roofer buys. Nobody buys "EPA RRP record-keeping" as a
  hero product. They buy "get my supplements paid," and the documentation is what makes
  that happen. Fold it in; don't lead with it.
- **Insurance-carrier liaison (COI/ACORD 25)** is a commercial-GC / subcontractor-onboarding
  pain, a *different ICP* (commercial vs. residential storm). It dilutes focus and pulls
  toward the wrong buyer. Park it; it can become a second wedge after roofing proves out,
  and it violates `~/memory/feedback_no_new_verticals_finish_locked.md` to chase now.
- **Follow-up depth (day 3/14/90)** is already shipped as the Estimate-Followup skill
  (`lib/skills/home-services-estimate-followup/`). It is table stakes, not a wedge. Keep
  it; don't headline it.

Per `~/memory/feedback_everything_tells_a_story.md`, a wedge has to be one sharp claim a
buyer can repeat. **"agentplain gets your storm supplements written and paid"** is that
claim. The other three are features inside it.

---

## The honest assessment

- This wedge is **narrower** than "AI for home services." That is the point. A narrow,
  defensible, high-ROI wedge in lower-competitive-density terrain beats a broad fight
  against bundled incumbents. We are choosing a hill we can hold.
- It is **gated on integrations we have not built.** Today the marketplace ships Gmail,
  M365, QuickBooks, HubSpot, DocuSign, Drive, Slack, TaxDome, Karbon
  (`lib/integrations/marketplace.ts`, status `available`). It ships **no** Xactimate,
  Symbility, EagleView, CompanyCam, AccuLynx, JobNimbus, or FSM connector — those are all
  `planned` only (`lib/verticals/home-services/content.ts:298-315`, window Q4 2026). The
  Supplement agent is correctly marked `rooting`, not `live`
  (`content.ts:67-73`). **The wedge is a build commitment, not a repositioning.**
  `PRODUCT_SPEC.md` sequences that build by value × effort, and identifies the smallest
  first slice that delivers the wedge without waiting on a full FSM integration.
- It does **not** require touching the no-outbound rule. That is the cleanest part of the
  story: our highest-value play is also our most architecturally native one.

**The recommendation: commit to the supplement wedge, concede speed-to-lead, and build
the claims-to-cash workspace roofing-first.**
