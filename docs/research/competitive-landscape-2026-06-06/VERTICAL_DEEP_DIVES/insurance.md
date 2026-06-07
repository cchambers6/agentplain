# Competitive Deep Dive — Insurance (agentplain)
_Research date 2026-06-06. Live web research; sources cited inline. Every price/funding/feature/customer claim carries a URL accessed 2026-06-06; unverifiable items are marked [unverified]._

## The vertical's AI landscape

The independent P&C / benefits agency stack is being reshaped by AI on three distinct fronts, and they are NOT the same product:

1. **AMS-embedded AI (incumbent gravity).** Applied Systems and Vertafore are baking AI into the systems agencies already run (Applied Epic, AMS360). Applied's 2026 releases — Applied Recon (AI reconciliation), Epic AutoFill, Applied Epic Bridge (Outlook add-in that auto-summarizes email into Epic activity notes), Book Builder — are read/extract/summarize tools that live inside the AMS. Source: https://www1.appliedsystems.com/en-us/blog/posts/insurance-industry-transformation-ai-technology/ (accessed 2026-06-06); https://www.globenewswire.com/news-release/2026/05/20/3298522/27604/en/Applied-Systems-Builds-on-AI-Reconciliation-Momentum-with-New-Financial-Operations-Innovation.html (accessed 2026-06-06).
2. **Enterprise agentic platforms (carrier/big-broker skew).** Roots Automation's **Bevaya** is the flagship here — an agentic platform for "carriers, brokers, and TPAs," powered by InsurGPT, with human-in-the-loop gating. It is real and shipping, but its proof points are top-5 carriers and top-10 brokers, not 5-seat Main Street agencies. Source: https://www.prnewswire.com/news-releases/roots-automation-inc-launches-bevaya-its-new-flagship-ai-agent-platform-for-insurance-302783940.html (accessed 2026-06-06).
3. **Voice / auto-execute front office (the opposite of agentplain).** Liberate, Insurvoice, Dialora and others put AI on the phones — answering AND placing calls, quoting, booking, and syncing to the AMS *without human approval*. This is the fastest-growing and most-hyped corner, and it is the cleanest contrast with agentplain's no-outbound design. Source: https://www.liberateinc.com/ (accessed 2026-06-06); https://insurvoice.ai/ (accessed 2026-06-06).

Demand signal: ReSource Pro research cited across the trade press claims **98% of insurance agencies plan AI investments in 2026** [unverified — secondary citation only; primary ReSource Pro report not directly accessed]. Source: https://www.resourcepro.com/blogs/why-ai-in-insurance-agencies-is-defining-2026 (accessed 2026-06-06).

Two seed names were validated as MISFITS for agentplain's exact ICP and were replaced: **Eleos** is community-based-care / embedded-life-insurance (healthcare RCM + white-label life binding), not independent P&C agency ops — https://eleos.health/ and https://www.insurtechny.com/eleos-life/ (accessed 2026-06-06). **Sixfold** is carrier-side *underwriting* AI ($265B GWP across insurer deployments), not agency-side — https://www.sixfold.ai/ (accessed 2026-06-06). **AgentSync** is producer licensing/compliance (~$100K/yr, Salesforce-dependent), adjacent not competing — https://agentsync.io/ (accessed 2026-06-06). Replaced with: Liberate, Insurvoice, and Tarmika (the point-tool rater), alongside the validated Bevaya and Applied.

## Top competitors

### 1. Bevaya (Roots Automation) — the credible agentic platform
- **What:** AI agent platform "built exclusively for insurance," covering underwriting (submission intake, ACORD/loss-run extraction), claims (FNOL/FROI, indexing, medical-bill extraction), and policy servicing (endorsements, COI creation, premium audit). Powered by InsurGPT, an ensemble trained on 300M+ proprietary insurance documents. Launched May 28, 2026 as Roots Automation's flagship. Source: https://www.prnewswire.com/news-releases/roots-automation-inc-launches-bevaya-its-new-flagship-ai-agent-platform-for-insurance-302783940.html (accessed 2026-06-06).
- **Pricing:** Not published; enterprise/custom [unverified — no public price]. https://www.bevaya.ai/ (accessed 2026-06-06).
- **Funding:** Roots Automation raised $22.2M Series B (Sept 2024, led by Harbert Growth Partners; Liberty Mutual Strategic Ventures, MissionOG, Vestigo participating). Source: https://www.prnewswire.com/news-releases/roots-automation-raises-22-2-million-to-unlock-the-value-held-within-unstructured-data-across-insurance-with-ai-302250212.html (accessed 2026-06-06).
- **R-I-A:** Mostly **Replace-the-task / Integrate** at enterprise scale; pushes into downstream systems (Guidewire, policy admin) after gate.
- **Ships vs claims:** SHIPS. 115+ production deployments, $100M+ realized customer value in 2025, 3 of top-5 P&C carriers. Source: https://www.bevaya.ai/ (accessed 2026-06-06).
- **Auto-sends?** **No — human-in-the-loop.** "No extractions proceed to downstream systems without human approval… before anything touches downstream systems." Source: https://www.bevaya.ai/platform/human-in-the-loop (accessed 2026-06-06). This is the competitor most architecturally similar to agentplain's approve-before-execute model — but aimed up-market.

### 2. Liberate — autonomous voice + back office (agentplain's mirror image)
- **What:** "AI-powered System of Action for insurance." Flagship voice agent "Nicole" handles inbound AND **outbound** calls to sell policies / service requests; reasoning agents connect to insurer systems and execute end-to-end (quoting, endorsements, claims) "without human intervention," across SMS and email. Source: https://www.liberateinc.com/ and https://techcrunch.com/2025/10/15/liberate-bags-50m-at-300m-valuation-to-bring-ai-deeper-into-insurance-back-offices/ (accessed 2026-06-06).
- **Pricing:** Not public [unverified]. https://www.liberateinc.com/ (accessed 2026-06-06).
- **Funding:** $50M Series B at $300M post-money (Oct 2025, led by Battery Ventures; Canapi, Redpoint, Eclipse, Commerce); $72M total. Source: https://techcrunch.com/2025/10/15/liberate-bags-50m-at-300m-valuation-to-bring-ai-deeper-into-insurance-back-offices/ (accessed 2026-06-06).
- **R-I-A:** **Replace-the-human** for the phone/quote/service loop.
- **Ships vs claims:** SHIPS at scale — 1.3M monthly resolutions (from 10K), claims +15% sales / -23% cost. Source: same TechCrunch URL (accessed 2026-06-06).
- **Auto-sends?** **YES — fully autonomous outbound calls, SMS, and email.** This is the exact behavior agentplain forbids by design, and the customer carries the TCPA / communication liability themselves.

### 3. Insurvoice — voice receptionist for independent agencies (closest ICP, auto-execute)
- **What:** "AI receptionist" 24/7 for independent agencies: answers inbound, **places outbound reactivation calls to dormant CRM contacts**, quote intake, FNOL, renewals, endorsements, transfers/books to producer calendars. Native AMS integrations (HawkSoft, EZLynx, AMS360, Applied Epic). Source: https://insurvoice.ai/ (accessed 2026-06-06).
- **Pricing:** **$299/mo** Growth (up to 1,500 calls); Enterprise custom. Source: https://insurvoice.ai/ (accessed 2026-06-06).
- **Funding:** None disclosed [unverified].
- **R-I-A:** **Replace** the front-desk / phone function.
- **Ships vs claims:** Shipping but small/unproven; marketing claims "95% answer rate, 3x more leads, 20+ hours saved/mo." Source: https://insurvoice.ai/ (accessed 2026-06-06).
- **Auto-sends?** **YES — qualifies, books, places outbound calls, and syncs to AMS without manual approval.** Site explicitly waves at "TCPA-compliant with consent verification" — i.e., it keeps the comms-liability surface on its own platform, the opposite of agentplain's transfer-to-customer-systems posture.

### 4. Applied (Indio / Epic AI + Tarmika) — the incumbent AMS gravity
- **What:** AI inside the systems agencies already pay for. Applied Recon (AI reconciliation native to Epic), Epic AutoFill, Applied Epic Bridge (Outlook add-in auto-summarizing email into Epic notes), Book Builder. Tarmika (acquired by Applied, Aug 2022) is a commercial comparative rater spanning ~31-35 carrier APIs (BOP, WC, GL, commercial auto, cyber, PL). Source: https://www1.appliedsystems.com/en-us/blog/posts/insurance-industry-transformation-ai-technology/ and https://www.tarmika.com/ (accessed 2026-06-06).
- **Pricing:** Applied Epic is enterprise-priced and opaque; third-party estimates run into the thousands/mo per agency [unverified — no official list price]. https://www.softwareadvice.com/insurance/applied-epic-profile/ (accessed 2026-06-06).
- **Funding:** Applied Systems is PE-owned (Hellman & Friedman / others); not a startup raise. [unverified specifics].
- **R-I-A:** **Integrate / augment** inside the AMS.
- **Ships vs claims:** SHIPS — Applied Recon early adopters claim ~8 hrs/week reconciliation saved. Source: https://www.globenewswire.com/news-release/2026/05/20/3298522/27604/en/Applied-Systems-Builds-on-AI-Reconciliation-Momentum-with-New-Financial-Operations-Innovation.html (accessed 2026-06-06).
- **Auto-sends?** Mostly No — these are extract/summarize/populate tools, human acts. But they are LOCKED to Applied's ecosystem (the EZLynx/Epic stack agentplain integrates with).

### 5. AgentSync — adjacent, not a front-office competitor
- **What:** Producer licensing & compliance management. Source: https://agentsync.io/ (accessed 2026-06-06).
- **Pricing:** ~$100K/yr average, peaks ~$140K; requires Salesforce. Source: https://www.softwareadvice.com/insurance/agentsync-profile/ (accessed 2026-06-06).
- **Funding:** $161M total over 5 rounds; ~$1.2B valuation. Source: https://tracxn.com/d/companies/agentsync (accessed 2026-06-06).
- **R-I-A / Auto-sends:** Compliance system-of-record; not a drafting/servicing agent. Listed for completeness — does not compete with agentplain.

## Competitive matrix

| Competitor | Price | Posture (R-I-A) | Auto-sends? | Vertical depth | Threat |
|---|---|---|---|---|---|
| Bevaya (Roots) | Enterprise/custom [unverified] | Replace-task / Integrate (gated) | No — human-in-loop | Very high (P&C, InsurGPT, 300M docs) | **High** (most architecturally similar; up-market today) |
| Liberate | Not public [unverified] | Replace-human (voice+back office) | **Yes — outbound calls/SMS/email** | High (carriers + agencies) | **High** (well-funded, opposite philosophy) |
| Insurvoice | $299/mo | Replace front-desk | **Yes — outbound + AMS sync** | Medium (indie agency ICP, voice only) | Medium (same ICP, narrow product, unproven) |
| Applied (Epic AI/Indio/Tarmika) | Enterprise, opaque [unverified] | Integrate/augment in-AMS | Mostly no | Very high (owns the AMS) | Medium-High (incumbent gravity, ecosystem lock) |
| AgentSync | ~$100K/yr | Compliance system-of-record | No | High (licensing only) | Low (adjacent) |

## agentplain's honest differentiation

agentplain is the only player whose **hard architectural limit is the value proposition**: it READS email/calendar/AMS/CRM/docs, categorizes, drafts, schedules, and coordinates — and then STOPS. It never sends, dials, moves money, or commits the agency itself; the customer's own systems execute. Bevaya is the only major competitor that also gates on human approval, but Bevaya targets carriers and top-10 brokers, prices as enterprise, and pushes into downstream systems after the gate. Liberate and Insurvoice — the products actually aimed at independent agencies' day-to-day — do the opposite: they auto-execute outbound communication and keep TCPA/insurance-communication liability on their own surface. agentplain transfers that liability to the customer by never being the actor.

Other true differentiators: one named service partner ("Plaino") = a relationship, not a SaaS login; a vertical-aware compliance corpus; integrate-not-replace across EZLynx/HawkSoft/NowCerts/Applied; and one simple price ($199→$99/seat, first month free, 1-99 seats) vs the opaque enterprise quotes of every credible competitor.

## Where agentplain WINS
- **Liability-by-design.** For a compliance-anxious P&C/benefits owner, "the AI never sends and never dials — your staff approves and your systems execute" is a cleaner risk story than any auto-execute voice bot. Liberate/Insurvoice put TCPA exposure on the table; agentplain removes it.
- **Price transparency + SMB fit.** $99-$199/seat with a free first month vs. enterprise-opaque (Bevaya, Liberate, Applied) or $100K/yr (AgentSync). A 5-seat agency can self-serve.
- **Integrate-not-replace.** Augments the AMS the agency already runs; doesn't ask them to rip out Epic/EZLynx or adopt a new system-of-record.
- **Breadth of the front-and-back office** across email/calendar/AMS/CRM/docs vs. point tools (Tarmika = rater only; Insurvoice = phone only).
- **Service-partnership model (Plaino).** Sells like hired help, not software — strong for relationship-driven Main Street agencies.

## Where agentplain LOSES
- **Proof and scale.** Bevaya has 115+ production deployments, 3 of top-5 carriers, $100M+ realized value; Liberate has 1.3M monthly resolutions and $72M raised. agentplain's insurance track record is early/[unverified] by comparison — a real credibility gap on enterprise calls.
- **No autonomous phone coverage.** The single hottest 2026 agency-AI category is voice-answers-and-dials. agentplain deliberately won't place calls — so for an owner whose actual pain is "the phone rings and nobody answers at 6pm," Insurvoice/Liberate solve the felt problem and agentplain does not.
- **Domain-model depth.** InsurGPT (300M+ insurance docs) and Tarmika's 31-35 carrier rating APIs are moats agentplain can't match on raw insurance-specific extraction/rating accuracy today.
- **Incumbent gravity.** Applied is shipping "good-enough" AI free inside the AMS agencies already pay for (Recon, AutoFill, Bridge). "It's already in Epic" is a hard objection.
- **Funding asymmetry.** Competing against $72M (Liberate) and $161M (AgentSync) war chests on a self-funded basis.

## ROI claims (strongest number + source)
Strongest verified competitor ROI: Roots/Bevaya claims **"3-4× capacity gains, 98%+ accuracy"**, claims indexing cut from 5 days to under an hour, and a published case study citing **246% ROI / 99% straight-through processing** on a claims deployment. Source: https://www.roots.ai/case-studies/insurance-claims-automation-ai-agent-straight-through-processing and https://www.bevaya.ai/ (accessed 2026-06-06). Liberate claims +15% sales / -23% cost — https://techcrunch.com/2025/10/15/liberate-bags-50m-at-300m-valuation-to-bring-ai-deeper-into-insurance-back-offices/ (accessed 2026-06-06). agentplain's own 15-107x ROI vs $99-$199/mo is structurally consistent with these task-level capacity numbers but is positioned at the SMB price point none of them serve.

## Sharpest positioning delta (one sentence)
The independent-agency AI products that actually win the phone (Liberate, Insurvoice) auto-dial, auto-quote, and keep TCPA liability on their own platform — agentplain is the only one that drafts and coordinates everything but never sends or dials, putting the action (and the liability) back in the agency's own approved hands.
