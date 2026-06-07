# Competitive Deep Dive — Mortgage (agentplain)
_Research date 2026-06-06. Live web research; sources cited inline. Every price/funding/feature claim carries a URL + "accessed 2026-06-06." "[unverified]" flags anything not confirmable live._

## The vertical's AI landscape

Mortgage in mid-2026 is the most aggressively "agentic" of agentplain's target verticals. The vendor narrative has shifted in the last 9 months from "AI-assisted document processing" to **autonomous agents that plan and execute multi-step origination workflows** — credit pulls, pricing checks, compliance verification, underwriting memos — "without human instruction at each step" (capacity.com / industry framing, accessed 2026-06-06: https://capacity.com/blog/ai-in-lending/). Tavant claims 12x underwriter productivity; the ABA's own banking journal ran an April 2026 piece on AI "reshaping the lending lifecycle" (https://bankingjournal.aba.com/2026/04/ai-in-mortgages-reshaping-the-lending-lifecycle/, accessed 2026-06-06).

Two structural facts shape the competitive map:

1. **The incumbents own the rails.** The dominant players are LOS/POS platforms (Blend, Tavant, Floify, Maxwell). Their agents run *inside* their own origination stack. agentplain is an integrate-not-replace overlay on top of whatever LOS/CRM the broker already runs — a fundamentally different posture from "buy our platform AND our agents."

2. **The compliance fault line is auto-execution.** The single sharpest dividing line is whether the AI **sends/dials/locks/discloses on its own**. National Mortgage News ran a 2026 piece specifically on "AI voice agents stir TCPA compliance debate" (https://www.nationalmortgagenews.com/news/ai-voice-agents-stir-tcpa-compliance-debate, accessed 2026-06-06). TCPA exposure is **$500–$1,500 per violation per message/call** — a single non-compliant 1,000-text blast is $500K–$1.5M of liability (empowerlo.com, accessed 2026-06-06: https://empowerlo.com/blog/mortgage-compliance-marketing). RESPA Section 8 and TILA add that "any output touching loan terms or product recommendations requires broker review before delivery" (sayvo.ai, accessed 2026-06-06: https://sayvo.ai/insights/tcpa-compliance-mortgage-ai-2026). **This is exactly the liability agentplain refuses to touch and transfers to the customer's systems.**

Notably, even the most aggressive incumbent (Blend) has *retreated* to gating its riskiest actions — validating agentplain's thesis that auto-execution is the part nobody actually wants to own.

## Top competitors

### 1. Blend (Autopilot MCP) — the credible heavyweight, and the one that proves agentplain's point
**What:** Public company (NYSE: BLND). In May 2026 launched **Autopilot MCP**, a Model Context Protocol server giving authorized AI agents "secure, programmatic access to the full Blend platform" across the origination lifecycle — application intake, credit, pricing, underwriting support, compliance, closing (businesswire via globalfintechseries, accessed 2026-06-06: https://globalfintechseries.com/banking/blend-launches-autopilot-mcp-server-opening-its-lending-platform-to-fi-built-ai-agents/).
**Pricing:** Not published; enterprise/FI sales-gated. [unverified — no public price]
**Funding/traction:** Public company; institutional lender base. (Crunchbase/StockTitan BLND coverage, accessed 2026-06-06: https://www.stocktitan.net/news/BLND/blend-launches-autopilot-mcp-server-opening-its-lending-platform-to-4m4r4oljcl5i.html)
**R-I-A:** **REPLACE** at the platform layer (you must be on Blend's LOS/POS), then it *opens* to agents. Not an overlay on an arbitrary broker's existing stack.
**Ships vs claims:** Ships — the MCP server is announced and live as of May 2026.
**Auto-sends?** Designed to, but **deliberately gated.** Direct quote: "Destructive operations (rate locks, credit pulls, disclosure delivery) are gated until a lender is ready to enable them" (accessed 2026-06-06, same source). Every agent action is logged with a full audit trail; access is lender-controlled; the system "shuts down access if a control layer is unreachable." **This is the strongest external validation of agentplain's no-outbound thesis: the most advanced incumbent chose to gate the send/lock/disclose actions.**

### 2. Tavant — TOUCHLESS / MAYA — the enterprise auto-execution maximalist
**What:** TOUCHLESS AI Mortgage Origination Suite (launched Oct 2025), with MAYA agentic assistant, AI-assisted underwriting, and (Feb 2026) a servicing portal with a 24/7 agentic borrower self-service assistant (businesswire, accessed 2026-06-06: https://www.businesswire.com/news/home/20251020910653/en/Tavant-Launches-Transformative-TOUCHLESS-AI-Mortgage-Origination-Suite).
**Pricing:** Not published; enterprise sales-gated. Claims **$1,000 cost reduction per loan** and **77% lower processing/underwriting cost** (housingwire, accessed 2026-06-06: https://www.housingwire.com/articles/touchless-lending-from-tavant-reduces-the-processing-and-underwriting-costs-of-originating-a-loan-by-77/). [unverified pricing]
**Funding/traction:** Established enterprise vendor; named deployments at PRMI and Northpointe Bank (businesswire/fintechfutures, accessed 2026-06-06).
**R-I-A:** **AUGMENT/REPLACE** — markets modules to "upgrade existing LOS and POS," but is a heavyweight enterprise suite, not a small-broker overlay.
**Ships vs claims:** Mix. Named customers ship; "12x underwriter productivity / 60% cost cut" are pilot claims (businesswire, accessed 2026-06-06).
**Auto-sends?** **Yes — built for autonomy.** Markets a 24/7 borrower-facing self-service agent and "from manual to autonomous." This is the maximal-autonomy end of the spectrum; the borrower-comms liability sits with Tavant's customer either way, but the *agent itself* talks to borrowers.
**RESPA/comms angle:** A 24/7 borrower-facing agent answering loan questions is exactly the "output touching loan terms" zone that requires broker review per RESPA/TILA — a surface agentplain deliberately keeps in draft-and-approve.

### 3. Maxwell — fulfillment-as-a-service for small/mid lenders (agentplain's closest ICP overlap)
**What:** Mortgage fulfillment-as-a-service platform (founded 2016) for **community/small-and-mid-sized lenders** — POS, underwriting, closing, fulfillment, BI (softwareadvice/getapp, accessed 2026-06-06: https://www.getapp.com/finance-accounting-software/a/maxwell/).
**Pricing:** Not publicly listed; quote-based. [unverified — no public price]
**Funding:** **$16.3M Series B** (Fin VC, TTV Capital; prior $5M Series A June 2020) (housingwire, accessed 2026-06-06: https://www.housingwire.com/articles/digital-mortgage-startup-maxwell-lands-16m-in-series-b/). Targets the segment = ~50% of the $4T US mortgage market; claims loans close 50% faster than national average (crunchbase, accessed 2026-06-06: https://www.crunchbase.com/organization/maxwell-financial-labs-inc).
**R-I-A:** **REPLACE** — it's a full POS + fulfillment stack and partly a *service* (humans do the fulfillment), not an overlay.
**Ships vs claims:** Ships — established platform with real lender base.
**Auto-sends?** Partly automated borrower document collection/POS flows; humans-in-the-loop on fulfillment. Closest competitor on *who they sell to* (small lenders), furthest on *posture* (replace the stack vs. augment it).

### 4. Capacity — knowledge-base + conversational AI overlay (closest on POSTURE)
**What:** AI knowledge platform that "works in parallel to Loan Origination Systems" — instant access to GSE guidelines (Fannie/Freddie/FHA/VA/USDA), 24/7 borrower support, lead capture/routing, LO and ops support (capacity.com/mortgage, accessed 2026-06-06: https://capacity.com/mortgage/). Named customer: PRMG.
**Pricing:** Not published; "Create an Account / Book a Demo." [unverified — no public price]
**Funding/traction:** Established vendor; PRMG deployment cited.
**R-I-A:** **AUGMENT/INTEGRATE** — explicitly runs *in parallel to the LOS*, not replacing it. Architecturally the closest competitor to agentplain's integrate-not-replace stance.
**Ships vs claims:** Ships — live mortgage product with named customer.
**Auto-sends?** **Yes — partially.** Markets "24/7 automated support for borrowers" and "AI-driven conversations to capture and route new leads" (accessed 2026-06-06). It *does* talk to borrowers directly. So it shares agentplain's overlay posture but **not** the no-outbound discipline — Capacity will auto-respond to borrowers; agentplain drafts and hands to the human.

### 5. TrustEngine (MortgageCoach + Sales Boomerang) — LO advisory/borrower-intelligence layer
**What:** Borrower Intelligence Platform; merged MortgageCoach + Sales Boomerang. May 2026 added "Borrower AI" — an assistant embedded in LO presentations that answers borrower questions, runs what-if scenarios, and **sends the LO a summary of what the borrower asked + recommended next steps** (trustengine.com, accessed 2026-06-06: https://trustengine.com/trustengine-announces-ai-powered-enhancements-to-mortgagecoach-transforming-how-loan-officers-build-borrower-presentations/). Avg presentation build time: 30 seconds.
**Pricing:** Not published; sales-gated. [unverified]
**Funding/ownership:** Controlled by **LLR Partners** (PE, bought stakes early 2022) (housingwire, accessed 2026-06-06: https://www.housingwire.com/articles/mortgage-coach-and-sales-boomerang-unify-launch-trustengine-platform/).
**R-I-A:** **AUGMENT** — a presentation/engagement layer over the LO's relationship, not an LOS.
**Ships vs claims:** Ships — AI enhancements announced May 2026 and live.
**Auto-sends?** Partially — Borrower AI engages borrowers directly in presentations, but routes a summary + next-steps back to the LO (a draft-and-notify pattern closer to agentplain's, though still borrower-facing).

_(Floify and Bunker considered and de-prioritized: Floify is a POS with "Dynamic AI" doc collection — a REPLACE-the-POS play, pricing now sales-gated [unverified], named to HousingWire Tech100 2026; https://floify.com/, accessed 2026-06-06. "Bunker" returned no credible live 2026 mortgage-AI-agent signal — replaced by Blend as the more credible heavyweight.)_

## Competitive matrix

| Competitor | Price (live, 2026-06-06) | Posture | Auto-sends / auto-executes? | Vertical depth | Threat |
|---|---|---|---|---|---|
| **Blend (Autopilot MCP)** | Sales-gated [unverified] | REPLACE platform, then open to agents | Built to — but **gates** rate-locks/credit-pulls/disclosure | Very deep (full LOS/POS) | **High** |
| **Tavant TOUCHLESS/MAYA** | Sales-gated; $1K/loan savings claim | AUGMENT/REPLACE (enterprise) | **Yes** — 24/7 borrower-facing agent | Very deep | **Medium-High** (enterprise, not small-broker ICP) |
| **Maxwell** | Quote-based [unverified] | REPLACE (POS + fulfillment service) | Partial; human fulfillment | Deep; small/mid lender ICP | **Medium-High** (same ICP) |
| **Capacity** | Sales-gated [unverified] | AUGMENT/INTEGRATE (parallel to LOS) | **Yes** — auto borrower support + lead routing | Medium | **Medium** (same posture, no no-outbound) |
| **TrustEngine** | Sales-gated [unverified] | AUGMENT (LO advisory) | Partial; borrower-facing + LO summary | Medium | **Medium** |

## agentplain's honest differentiation

1. **The no-outbound architecture is now externally validated.** The market's most advanced agent platform (Blend) *chose* to gate disclosure delivery, credit pulls, and rate locks behind human enablement. agentplain made that the architecture, not a setting — it never sends/dials/locks/discloses, full stop, and transfers TCPA/RESPA/TILA liability to the customer's own systems. Given $500–$1,500-per-message TCPA exposure, that's a feature CFOs and compliance officers buy.
2. **Integrate-not-replace on the broker's *existing* stack.** Capacity is the only seed competitor that shares this posture — and even Capacity auto-responds to borrowers. Everyone else (Blend, Tavant, Maxwell, Floify) makes you adopt *their* origination platform.
3. **Service partnership, one named partner ("Plaino"), transparent self-serve pricing.** Every competitor is enterprise/demo-gated with opaque pricing. agentplain publishes $199→$99/seat, first month free, month-to-month, 1–99 seats — a posture none of these vendors offer.
4. **Vertical-aware compliance corpus** (GSE/RESPA/TILA) baked into draft generation, like Capacity's guideline KB — but feeding *drafts the human approves*, not auto-answers.

## Where agentplain WINS

- **Liability story.** The only architecture that structurally cannot trigger a TCPA/RESPA violation because it never performs the outbound act. Direct counter to the live "AI voice agents stir TCPA debate" (nationalmortgagenews, accessed 2026-06-06).
- **The small independent broker / small LO.** Blend, Tavant are enterprise; Maxwell/Floify want you on their platform. agentplain rides on top of whatever the broker already runs, priced for a 1–10 seat shop with a free first month and no annual contract.
- **Pricing transparency + speed-to-value.** Self-serve $99–$199/seat vs. universal demo-gating.
- **Augment, don't rip-and-replace.** No LOS migration; lower switching cost and risk.

## Where agentplain LOSES

- **Depth of origination automation.** Tavant's 12x-underwriter and Blend's full-lifecycle credit/pricing/underwriting execution are far deeper into the *origination mechanics* than a read-categorize-draft overlay. A lender wanting touchless underwriting buys Tavant/Blend, not agentplain.
- **The "agentic" arms race optics.** Buyers primed on "autonomous agents that execute without human instruction" may read draft-and-approve as *less* capable. agentplain must reframe "human approves" as compliance-grade control, not as a limitation.
- **Funding/brand/proof.** Blend is public; Maxwell has $16.3M+ Series B; Tavant has marquee named lenders (PRMI, Northpointe). agentplain has no comparable public mortgage logos or war chest [agentplain traction unverified here].
- **Borrower-facing 24/7 self-service.** Capacity and Tavant answer borrowers around the clock; agentplain deliberately won't auto-respond — a real capability gap for lenders who want instant borrower deflection.
- **Deep LOS-native data execution.** Competitors living *inside* the LOS can pull credit and check pricing natively; agentplain reads and drafts, then a human acts in the LOS.

## ROI claims (with strongest number + source)

- **agentplain's own:** 15–107x ROI vs $99–$199/mo per seat (internal positioning; not third-party verified).
- **Strongest external anchor for the category (use carefully — these are *competitor* numbers, cite as market context not agentplain's):**
  - **Tavant: 77% reduction in processing/underwriting cost, ~$1,000 saved per loan** (housingwire, accessed 2026-06-06: https://www.housingwire.com/articles/touchless-lending-from-tavant-reduces-the-processing-and-underwriting-costs-of-originating-a-loan-by-77/) — against a >$10,000 average origination cost.
  - **TCPA exposure avoided: $500–$1,500 per message/call; a single 1,000-message misfire = $500K–$1.5M** (empowerlo.com, accessed 2026-06-06: https://empowerlo.com/blog/mortgage-compliance-marketing). This is agentplain's *sharpest* ROI number — one avoided violation pays for years of seats. Lead with this, not the 15–107x.

## Sharpest positioning delta (one sentence)

Every credible mortgage AI agent is racing to *send, dial, lock, and disclose on the borrower's behalf* — and the smartest one (Blend) just gated exactly those actions; agentplain is the only platform that makes "never performs the outbound act" the architecture, turning a $500–$1,500-per-message TCPA liability into the customer's own controlled human approval step.
