# Competitive Deep Dive — CPA / Accounting (agentplain)
_Research date 2026-06-06. Live web research; sources cited inline._

## The vertical's AI landscape

Small CPA / tax / accounting firms are the most contested AI-agent vertical in this study. Two structural forces drive it: (1) a documented CPA labor shortage that vendors universally cite as their wedge, and (2) the work is unusually automatable — tax returns, bookkeeping entries, and document sorting are rule-bound and high-volume. The result is a market that has moved past "copilot/chatbot" framing into explicit **autonomous execution** language. Canopy literally markets an "execution layer… unlike chatbots that only answer questions or copilots that only provide suggestions" ([cpapracticeadvisor.com, accessed 2026-06-06](https://www.cpapracticeadvisor.com/2026/05/02/canopy-launches-canopy-coworker/182621/)); Black Ore markets ">98% touchless" return prep ([cpapracticeadvisor.com, accessed 2026-06-06](https://www.cpapracticeadvisor.com/2026/04/29/black-ore-launches-tax-autopilot-for-broad-availability/182311/)).

Two distinct competitive bands exist:
- **Incumbent practice-management suites bolting on AI** — TaxDome (15,000+ firms), Canopy, Karbon. These own the firm's system of record and are adding AI inside it. agentplain's "integrate-not-replace" pitch competes most directly here, but these vendors ARE the system agentplain would integrate with — they are platform risk as much as competitor.
- **Purpose-built AI-native point solutions** — Black Ore (tax prep), Truewind (bookkeeping/close), Anchor (billing/collections), Materia (research, now Thomson Reuters). These go deep on one workflow with heavy autonomy.

Crucially, the leading CPA products are racing toward the exact behavior agentplain forbids: Black Ore prepares returns touchless, Anchor moves money autonomously, Canopy Coworker triggers actions and sends follow-ups under "supervised autonomy." agentplain's draft-only / customer-executes posture is a genuine differentiator here — but also a feature-gap the market may read as "less automated."

## Top competitors

### 1. Black Ore — Tax Autopilot
- **What:** AI-native, end-to-end tax-return preparation for CPA firms. Ingests W-2s/1099s/K-1s/brokerage statements, extracts and reconciles data, prepares federal + state returns with workpapers, and delivers "review-ready returns directly into existing firm workflows" via integration with major tax software ([cpapracticeadvisor.com, accessed 2026-06-06](https://www.cpapracticeadvisor.com/2026/04/29/black-ore-launches-tax-autopilot-for-broad-availability/182311/)).
- **Pricing:** Not published; enterprise/sales-led ([blackore.ai, accessed 2026-06-06](https://blackore.ai/)). [pricing unverified]
- **Funding:** $60M raised; investors include Oak HC/FT, a16z, Founders Fund, General Catalyst, Khosla Ventures, Trust Ventures, plus angels (Tom Glocer, Max Levchin, Gokul Rajaram, Jason Gardner) ([accountingtoday.com / search corpus, accessed 2026-06-06](https://www.accountingtoday.com/news/black-ore-spotlights-tax-and-ai-at-nasdaq)).
- **Read–Interpret–Act:** Full R + I + heavy A (prepares the return). Stops at filing — "Firm professionals remain the final authority for sign-off."
- **Ships vs claims:** SHIPS. Generally available April 2026 after 2-year early access; 75 firms onboarded from a ~4,000 waitlist, including 40% of the Top 20 CPA firms; claims >99% accuracy across "tens of thousands of returns" ([cpapracticeadvisor.com, accessed 2026-06-06](https://www.cpapracticeadvisor.com/2026/04/29/black-ore-launches-tax-autopilot-for-broad-availability/182311/)). Accuracy claims are vendor-reported [unverified independently].
- **Auto-executes?** Prepares returns autonomously (">98% touchless"); does NOT e-file — review/sign-off stays human.

### 2. Canopy — Canopy Coworker
- **What:** Practice-management suite (CRM, docs, client portal, workflow, billing) with "Canopy Coworker," marketed as an **autonomous execution layer** that plans, executes, monitors, and escalates multi-step processes — auto-triggers folder creation, questionnaire/welcome sequences on client creation, flags scope creep, identifies missing docs and **drafts follow-ups**. Plus "Smart Prep" tax prep via a Filed integration ([cpapracticeadvisor.com, accessed 2026-06-06](https://www.cpapracticeadvisor.com/2026/05/02/canopy-launches-canopy-coworker/182621/)).
- **Pricing:** Standard $74, Plus $109, Premium $149 /user/mo billed annually; Enterprise custom. Coworker is bundled into core plans (not a separate add-on); some AI like Smart Intake is consumption-priced from "$11 credit/client" ([getcanopy.com/pricing, accessed 2026-06-06](https://www.getcanopy.com/pricing/)).
- **Funding:** Well-capitalized established vendor (prior raises >$100M historically) [exact 2026 figure unverified].
- **R-I-A:** Full R + I + A under "supervised autonomy."
- **Ships vs claims:** Coworker launched May 2026 — newly shipped; depth in production [unverified]. Core suite is mature and widely deployed.
- **Auto-executes?** YES — "automatically triggering actions like folder creation, questionnaire delivery, and workflow adjustments," humans manage exceptions. Closest competitor to an agentic posture, but it OWNS the system of record (does not integrate into yours).

### 3. TaxDome — TaxDome AI
- **What:** End-to-end practice-management platform for tax/bookkeeping/accounting firms (15,000+ firms, 3M+ clients). AI auto-tags, categorizes, and renames client documents (detects 1099s, engagement letters), auto-routes to client/folder, plus AI-powered reporting and smart search ([taxdome.com, accessed 2026-06-06](https://taxdome.com/); [taxdome.com/blog/best-ai-software-accounting, accessed 2026-06-06](https://taxdome.com/blog/best-ai-software-accounting)).
- **Pricing:** Pro $1,000/user/yr; Business $1,200/user/yr; both billed annually upfront. Seasonal seats $500/4-month term on Business ([search corpus via taxdome.com/pricing & checkthat.ai, accessed 2026-06-06](https://taxdome.com/pricing)).
- **Funding:** Private; no recent public round disclosed [unverified].
- **R-I-A:** Strong R + I (document understanding, reporting); A is workflow automation (job stage movement, task assignment, engagement-letter/invoice sending) configured by the firm.
- **Ships vs claims:** SHIPS — document AI and automation are live across a large base.
- **Auto-executes?** Partially — its automations send engagement letters/invoices and move jobs, but these are firm-configured rule automations, not an autonomous agent drafting-and-deciding. AI layer itself is mostly organize/summarize.

### 4. Karbon — Karbon AI / Kai
- **What:** Practice-management platform with AI for email triage (summarize threads, draft/quick replies, compose from task data), work summaries, suggested task assignment, and missed-time-entry flagging. "Kai AI Coworker" and "Agentic Workflows" are in early access; full AI Agents (data entry, follow-ups, onboarding) slated for **early 2026** ([karbonhq.com/feature/ai, accessed 2026-06-06](https://karbonhq.com/feature/ai/); [getuku.com search corpus, accessed 2026-06-06](https://getuku.com/articles/karbon-review/)).
- **Pricing:** Team $59, Business $89 /user/mo (annual); Enterprise custom. AI included at no extra cost currently ([karbonhq.com/pricing, accessed 2026-06-06](https://karbonhq.com/pricing/)).
- **Funding:** Established; no fresh 2026 round surfaced [unverified].
- **R-I-A:** R + I today; A (agentic execution) still landing — "Coming soon / Early Access."
- **Ships vs claims:** Core AI ships (draft-for-review). The autonomous "Agents" are CLAIMED for early 2026, partly not yet GA — the gap agentplain can exploit on timing.
- **Auto-executes?** NO today — explicitly draft-for-review ("fully editable suggestions"). This is the competitor whose CURRENT posture most resembles agentplain's, but inside its own suite and with auto-execute agents on the roadmap.

### 5. Anchor — Autonomous Billing & Collections
- **What:** Autonomous billing/collections — interactive proposals, e-signed agreements, pre-approved payment methods, automatic invoice generation per terms, auto-charge and reconciliation. Integrates with QuickBooks Online ([sayanchor.com, accessed 2026-06-06](https://www.sayanchor.com/)).
- **Pricing:** Free software; flat $5 fee per transaction, no subscription ([search corpus, accessed 2026-06-06](https://www.sayanchor.com/)).
- **Funding:** $20M Series A (Jan 2025), led by Mosaic General Partnership ([prnewswire.com, accessed 2026-06-06](https://www.prnewswire.com/news-releases/anchor-lands-20-million-in-series-a-funding-to-eliminate-invoicing-and-payment-inefficiencies-for-small-to-medium-accounting-firms-302364348.html)).
- **R-I-A:** Full A in the money-movement lane — generates invoices and collects payment with no human in the loop.
- **Ships vs claims:** SHIPS — live, mature, claims revenue loss cut from >5% to <1%.
- **Auto-executes?** YES — autonomously bills AND moves money. This is the exact line agentplain refuses to cross; a clean philosophical contrast for positioning (and an integration partner, not a head-to-head rival, for an agentplain billing workflow).

_Note: **Materia** (gen-AI research/document-analysis assistant, $6.3M raised, Spark Capital) was **acquired by Thomson Reuters** and folded into TR's agentic tax/audit stack — now an incumbent feature, not a standalone small-firm buy ([prnewswire.com, accessed 2026-06-06](https://www.prnewswire.com/news-releases/thomson-reuters-acquires-materia--a-specialist-in-agentic-ai-for-the-tax-audit-and-accounting-profession-302282041.html)). Lower direct threat to agentplain's small-firm ICP; excluded from the top-5 detail._

## Competitive matrix

| Competitor | Price | Posture | Auto-executes? | Vertical depth | Threat |
|---|---|---|---|---|---|
| **Black Ore** | Sales-led / undisclosed | AI-native tax-prep autopilot | Prepares returns touchless (no e-file) | Very deep (tax only) | **High** |
| **Canopy Coworker** | $74–$149/user/mo + custom | Suite + autonomous execution layer | Yes (supervised autonomy; sends/triggers) | Deep (full PM + tax + bookkeeping) | **High** |
| **TaxDome AI** | $1,000–$1,200/user/yr | Suite + document AI / automation | Partial (firm-configured automations) | Deep (full PM, 15k firms) | **Med-High** |
| **Karbon AI / Kai** | $59–$89/user/mo | Suite + draft-for-review AI; agents coming | Not yet (draft-for-review today) | Deep (full PM) | **Medium** |
| **Anchor** | Free + $5/txn | Autonomous billing & collections | Yes (auto-bills + moves money) | Narrow (billing) | **Med (adjacent)** |
| **agentplain** | $99–$199/seat/mo | Draft/advise fleet, customer executes | **No — by design** | Vertical-aware compliance; integrate-not-replace | — |

## agentplain's honest differentiation

1. **Read-everything, decide-nothing-final.** agentplain spans the whole firm's surface (email, calendar, practice-mgmt, docs) and coordinates across it, but never sends, files, charges, or commits. Competitors are either deep-but-narrow (Black Ore = tax only; Anchor = billing only) or suite-bound (Canopy/Karbon/TaxDome AI only acts inside its own walls).
2. **Integrate-not-replace.** agentplain augments Karbon/TaxDome/Canopy rather than asking the firm to rip-and-replace its system of record. The suite vendors' AI is a reason to STAY on their platform, not a portable layer.
3. **Service partnership + named partner (Plaino).** Competitors sell software seats; agentplain sells an ongoing relationship with one accountable named partner. No CPA competitor here offers a human-feeling service layer.
4. **Vertical-aware compliance corpus** — relevant given tax/audit liability; positions the draft-only stance as a feature (firm retains professional sign-off), not a limitation.

## Where agentplain WINS

- **Firms that want help across the whole practice, not one workflow.** Black Ore prepares returns and Anchor bills, but neither triages the inbox, coordinates the calendar, and chases documents. agentplain's fleet spans the day.
- **Firms wary of autonomy/liability.** A profession built on sign-off and personal license risk is a natural buyer for "drafts everything, you approve and send." The draft-only line is a trust feature in a vertical where a wrong auto-filed return or a wrong auto-charge is a regulatory event.
- **Firms already locked into a PM suite.** agentplain layers on top; it doesn't force migration off TaxDome/Karbon/Canopy.
- **Price-sensitive small firms.** $99–$199/seat undercuts TaxDome ($1,000+/user/yr ≈ $83+/mo for the suite alone, before AI value) and sits near Canopy/Karbon while adding a service layer.

## Where agentplain LOSES

- **Depth of the marquee workflow.** Black Ore's touchless return prep and Truewind's GL-ready close entries are deeper, more automated, and more measurably ROI-positive on the single task a CPA most wants gone. agentplain "drafts/advises" where Black Ore "does."
- **The autonomy expectation.** The CPA market's own vendors now sell "execution layer" and ">98% touchless." Against that messaging, "we draft and you send" can read as less automated / more manual — agentplain must reframe this as control, not limitation.
- **System-of-record gravity.** TaxDome (15k firms), Canopy, and Karbon own the data and the daily UI; their bundled, free-or-included AI removes the reason to add a separate vendor. agentplain is an extra integration to justify.
- **Capital and proof.** Black Ore ($60M, 40% of Top 20 firms) and the incumbents vastly out-resource a small entrant; agentplain has no comparable public proof in CPA yet [unverified — no agentplain CPA case studies surfaced].
- **Money-movement and filing are off-limits by design** — so any buyer who specifically wants auto-billing (Anchor) or auto-filing must use someone else for that step.

## ROI claims (strongest number + source)

Strongest competitor number: Black Ore claims **"up to 98% time savings per preparation"** and **"up to 80% lower costs per return,"** with a high-net-worth multi-K-1 return dropping from "several days" to "minutes" ([cpapracticeadvisor.com, accessed 2026-06-06](https://www.cpapracticeadvisor.com/2026/04/29/black-ore-launches-tax-autopilot-for-broad-availability/182311/)) — vendor-reported. Anchor claims revenue leakage cut from >5% to <1% and profits +30% ([sayanchor.com search corpus, accessed 2026-06-06](https://www.sayanchor.com/)). agentplain's 15–107x-vs-$99–$199/mo framing is competitive on a total-cost basis, but agentplain lacks a CPA-specific, single-task time-savings stat as crisp as Black Ore's "days to minutes" [agentplain CPA ROI unverified].

## Sharpest positioning delta (one sentence)

In a CPA market now selling ">98% touchless" return prep and software that auto-bills and moves money, agentplain is the only fleet that works across the *entire* firm yet never files, sends, or charges anything itself — selling licensed professionals control and a named service partner instead of unattended autonomy.
