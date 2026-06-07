# Competitive Deep Dive — Title & Escrow (agentplain)
_Research date 2026-06-06. Live web research; sources cited inline._

## The vertical's AI landscape

Title & escrow is, as of mid-2026, the **opposite** of a thin AI-agent space — it is one of the hottest agentic-AI verticals in proptech. Unlike most local-business verticals where the field is mostly legacy software bolting on AI features, title/escrow has multiple well-funded, purpose-built **agentic** entrants shipping (or claiming) autonomous escrow-officer products. Qualia's CEO Nate Baker calls 2026 "the most consequential transformation the industry has ever experienced" and says "agentic AI will advance faster than any technology the title & escrow industry has ever seen" ([housingwire.com](https://www.housingwire.com/articles/agentic-ai-title-escrow/), accessed 2026-06-06).

The structural reason the field is crowded: an escrow file is ~120 discrete, time-intensive, error-prone, coordination-heavy tasks ([inman.com](https://www.inman.com/2026/06/04/homelight-eva-escrow/) via search snippet, accessed 2026-06-06) — a near-perfect target for agentic automation.

The critical fork — and where agentplain's posture matters most — is **autonomy level**. The headline products (HomeLight EVA, Propy Agent Avery) are built to *autonomously wire funds and make outbound calls*. This collides directly with the industry's defining risk: the FBI logged **$275.1M in real-estate wire-fraud losses in 2025**, BEC drove **$2.77B** of losses, and BEC attacks are up **1,760% since AI tools became widely available** ([certifid.com 2026 State of Wire Fraud](https://www.certifid.com/article/2026-state-of-wire-fraud-report) via search, accessed 2026-06-06). An AI that *executes* the wire is a fraud-surface expansion; an AI that *drafts and advises while the human executes* is the opposite. That is agentplain's structural fit.

Honest caveat: the competitors here are real and shipping, not vaporware. agentplain does **not** win this vertical on "we have AI agents and they don't." It wins on posture (no-send), integrate-not-replace, and service-partnership — and it faces the strongest agentic competition of any vertical studied.

## Top competitors

### 1. Qualia (Qualia Clear / Clear 2.0)
- **What:** The dominant cloud title-production platform, now with **Qualia Clear**, an agentic AI natively built into the production system. Reads messy/handwritten search packages, drafts a preliminary commitment, flags title issues, recommends curative tasks, organizes inboxes, opens orders, drafts/responds to email. Clear has **phone and web agents that call lenders and browse county tax websites** ([qualia.com](https://www.qualia.com/), [blog.qualia.com](https://blog.qualia.com/introducing-qualia-clear-transforming-title-escrow-with-agentic-ai/), accessed 2026-06-06).
- **Pricing:** Not public; contact-sales / quote-based ([getapp.com Qualia](https://www.getapp.com/finance-accounting-software/a/qualia/), [softwareadvice.com](https://www.softwareadvice.com/loan-origination/qualia-profile/), accessed 2026-06-06).
- **Funding:** Late-stage, venture-backed category leader; **acquired RamQuest and E-Closing from Old Republic Title in Jan 2025** ([wisdomstreamai.com](https://wisdomstreamai.com/blog/title-company-automation-software-compared-2026), accessed 2026-06-06). Old Republic Title went live on Qualia as an enterprise standard ([blog.qualia.com](https://blog.qualia.com/old-republic-title-goes-live-on-qualia-marking-a-new-enterprise-standard-for-title-escrow/), accessed 2026-06-06).
- **R-I-A:** **Replace + Augment.** It *is* the production system of record turning into a "system of action."
- **Ships vs. claims:** Largely ships — Clear is GA for Qualia Core/Atlas customers; Clear 2.0 automations rolling through Q2 2026 ([blog.qualia.com Clear 2.0](https://blog.qualia.com/introducing-qualia-clear-2-0-a-giant-step-toward-fully-automated-title/), accessed 2026-06-06). The "automate 80%" headline is aspirational marketing.
- **AI-agent or production software?** Both — genuine agentic ops layer *fused to* the production platform. The most serious competitor.

### 2. HomeLight (EVA)
- **What:** "Industry's first agentic escrow officer," empowered with **80+ tools** to interface with the outside world. Automates order opening (minutes vs. hours), pulls HOA docs, interfaces with lenders, **and wires funds** ([businesswire.com](https://www.businesswire.com/news/home/20260427987061/en/), [inman.com](https://www.inman.com/2026/06/04/homelight-eva-escrow/) via search, accessed 2026-06-06).
- **Pricing:** Per-transaction, roughly **$50–$150 per file** (search-reported, [inman.com](https://www.inman.com/2026/06/04/homelight-eva-escrow/), accessed 2026-06-06).
- **Funding:** **$40M in new debt financing from BlackRock** to scale nationally ([citybiz.co](https://www.citybiz.co/article/837264/), accessed 2026-06-06).
- **R-I-A:** **Replace** — EVA *is* the escrow officer for HomeLight's own files.
- **Ships vs. claims:** Ships, but narrow. HomeLight admits it has "automated about **25%** of the surface area of the escrow process," and **HomeLight is currently the only customer — not licensing EVA to other agencies** ([inman.com](https://www.inman.com/2026/06/04/homelight-eva-escrow/) via search, accessed 2026-06-06). Notably *does* have a human-in-loop escalation philosophy ("I don't know how to handle this, escalating") — but still executes wires within its automated surface.
- **AI-agent or production software?** AI-agent (vertical, captive). Not a sellable competitor to local agencies *today*.

### 3. Propy (Agent Avery)
- **What:** "First AI escrow officer in real estate." Monitors inbound email, opens transactions 24/7, **checks bank accounts, makes outbound calls to lenders and HOAs**. Handles ~70% of a human escrow officer's workflow ([refreshmiami.com](https://refreshmiami.com/news/propys-ai-escrow-officer-could-redefine-how-americans-buy-homes/), [inman.com](https://www.inman.com/2026/05/14/propy-ai-title-companies/) via search, accessed 2026-06-06).
- **Pricing:** N/A — Propy doesn't sell Avery; it **buys title firms and runs them on Avery**.
- **Funding:** **$100M credit facility from Metropolitan Partners Group** (private credit + blockchain DeFi). Targeting acquisition of ~10 title firms (~$10M each), $1B valuation in 18 months ([prnewswire.com](https://www.prnewswire.com/news-releases/propy-raises-100-million-to-reimagine-real-estate-transactions-with-ai-302674035.html), [cnbc.com](https://www.cnbc.com/2026/05/07/startup-propy-real-estate-deals-blockchain.html), accessed 2026-06-06).
- **R-I-A:** **Replace + Acquire** — a roll-up, not a SaaS vendor.
- **Ships vs. claims:** Pilots at acquired firms (Delta South Title AL, Boss Law's title division FL) claim up to 70% lower manual workload ([inman.com](https://www.inman.com/2026/05/14/propy-ai-title-companies/) via search, accessed 2026-06-06). Blockchain framing adds claim-risk.
- **AI-agent or production software?** AI-agent inside an M&A roll-up. Competes for *ownership* of agencies, not for *selling software to* them.

### 4. alanna.ai
- **What:** AI platform purpose-built for title companies. Processes emails/PDFs to prep new orders, generates smart forms, **sends** buyer closing estimates and seller net sheets, 24/7 text support, mass-text marketing ([alanna.ai](https://www.alanna.ai/), accessed 2026-06-06).
- **Pricing:** Contact-sales / demo-gated ([alanna.ai](https://www.alanna.ai/), accessed 2026-06-06).
- **Funding:** Not disclosed; smaller independent vendor.
- **R-I-A:** **Integrate** — works *with* Settlor, SoftPro Select, RamQuest CCE, ResWare ([alanna.ai](https://www.alanna.ai/), accessed 2026-06-06).
- **Ships vs. claims:** Ships; mature comms/intake automation.
- **AI-agent or production software?** Agentic comms/intake layer over existing production software. **Closest architectural analog to agentplain** — but it *sends* client communications autonomously (texts net sheets/estimates), where agentplain holds the no-send line.

### 5. Pythonic.ai
- **What:** "AI Agents Built Exclusively for Title & Escrow." Order-entry agents parse contracts/purchase agreements/lender forms/email, extract data, open files; unhandleable files route to humans pre-filled ([pythonic.ai](https://pythonic.ai/order-entry), accessed 2026-06-06).
- **Pricing:** Not public.
- **Funding:** Not disclosed; early-stage.
- **R-I-A:** **Integrate** — direct API into SoftPro Select and ResWare.
- **Ships vs. claims:** Ships for the narrow order-entry slice; human-routing fallback is honest.
- **AI-agent or production software?** Narrow agentic layer (intake only) over production software.

_Adjacent / not direct competitors:_ **SoftPro** and **RamQuest** are the legacy production platforms agentplain integrates with (RamQuest now under Qualia). **Stavvy / Spruce** are eClosing/RON/notarization infrastructure, not agentic ops. **Doma/States Title** is no longer a standalone competitor — **Opendoor acquired Doma's closing & escrow business in March 2026** ([cbinsights.com](https://www.cbinsights.com/company/states-title) via search, accessed 2026-06-06). **CertifID** is wire-verification (a complement to agentplain's posture, not a rival).

## Competitive matrix

| Competitor | Price | Posture | AI-agent depth | Vertical depth | Threat |
|---|---|---|---|---|---|
| Qualia Clear | Contact-sales | Replace + augment (owns prod. platform) | High (calls lenders, drafts commitments, phone/web agents) | Very high (category leader) | **High** |
| HomeLight EVA | ~$50–150/file | Replace (captive, executes wires) | High (80+ tools) but ~25% surface | High | Medium (not sold to agencies) |
| Propy Avery | N/A (acquires firms) | Replace + roll-up | Medium-high (executes) | High | Medium (buys, doesn't sell) |
| alanna.ai | Contact-sales | Integrate, but **sends** comms | Medium (comms/intake) | High | Medium-high (nearest analog) |
| Pythonic.ai | Not public | Integrate (intake only) | Low-medium (narrow) | Medium | Low-medium |
| **agentplain** | **$99–199/seat** | **Integrate + NEVER send** | Medium (read/categorize/draft/coordinate) | Growing | — |

## agentplain's honest differentiation

1. **No-send is a category of one.** Every serious agentic competitor's headline is *autonomous execution* — EVA wires funds, Avery checks bank accounts and makes outbound calls, alanna sends client texts. agentplain is the only entrant whose hard architectural limit is "drafts and advises; the customer's systems execute." In a vertical defined by **$275M/yr wire fraud and a 1,760% AI-driven BEC surge**, "the AI cannot send or wire" is not a limitation — it is the compliance pitch.
2. **Integrate-not-replace, transparently priced.** agentplain augments Qualia/SoftPro/RamQuest at a flat **$99–199/seat** with the price on the page. Qualia, EVA, Avery, alanna, and Pythonic are all contact-sales or not-for-sale.
3. **Service partnership ("Plaino"), not a tool.** None of the competitors offer a named, accountable service partner — they sell software or buy your firm.

## Where agentplain WINS

- **The independent agency that wants to keep its name and its people.** Propy buys you; HomeLight competes with you; agentplain makes your existing escrow officers faster without replacing the production system they already run.
- **Compliance-conscious / wire-fraud-aware buyers.** The no-send posture turns the single largest industry risk into agentplain's strongest selling point. Competitors that *execute* wires must defend against being a new fraud surface; agentplain has nothing to defend.
- **Price transparency + first-month-free** vs. a wall of "contact sales."
- **Multi-domain "fleet" inside one local business** (email + calendar + docs + production software) rather than a single-function bot (order-entry only, comms only).

## Where agentplain LOSES

- **Raw autonomy / headline automation %.** EVA/Avery claim to *do* the work end-to-end; Qualia claims "automate 80%." agentplain deliberately stops at draft+approve, so on a "how much work does the AI take off my plate without me touching it" demo, it will look less aggressive. This is a positioning problem, not a product flaw — but it is real.
- **Production-platform ownership.** Qualia owns the system of record and is fusing agentic AI into it natively. agentplain rides on top and is only as good as its integration depth into Qualia/SoftPro/RamQuest. Qualia can wall this off.
- **Title-specific depth today.** Pythonic and alanna are title-only and have deep, title-native order-entry/curative workflows. agentplain is a horizontal local-business fleet; it must prove escrow-specific competence (search-package reading, curative tasks, CD/net-sheet logic) to match.
- **Capital.** $40M (HomeLight), $100M (Propy), category-leader balance sheet (Qualia) vs. agentplain. Loud, well-funded competitors will own the airwaves at FORES/TLTA.

## ROI claims (strongest number + source)

- **Qualia Clear: 35%–50% reduction in time to process a file** ([housingwire.com](https://www.housingwire.com/articles/agentic-ai-title-escrow/), accessed 2026-06-06) — the strongest *verified-source* number in the vertical.
- AEGIS Land Title: examiners move **2x faster**, capacity doubled from 10→20 commitments/examiner/day with agentic doc review ([housingwire.com](https://www.housingwire.com/articles/agentic-ai-title-escrow/) via search, accessed 2026-06-06).
- Propy/HomeLight: **~70% of escrow-officer workflow** automated (vendor claims, [inman.com](https://www.inman.com/2026/05/14/propy-ai-title-companies/), accessed 2026-06-06).
- agentplain's own **15–107x ROI vs. $99–199/mo** is competitive *if* it lands escrow-specific time savings near the 35–50% Qualia benchmark; agentplain should anchor its ROI on the verified Qualia file-time number, not on competitors' unverified 70–80% claims.

## Sharpest positioning delta (one sentence)

In a vertical whose flagship AI products are racing to **autonomously wire money** amid a 1,760% AI-driven wire-fraud surge, agentplain is the only fleet whose architecture *cannot* send or wire — turning the industry's defining risk into its single clearest reason to buy.
