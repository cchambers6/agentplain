# Competitive Deep Dive — RIA / Wealth (agentplain)
_Research date 2026-06-06. Live web research; sources cited inline._

## The vertical's AI landscape

The independent-RIA AI market has, in the last 12 months, completed what the Ezra Group / WealthTech Today 2026 buyer's guide calls "The Great Bifurcation": the category leaders are no longer pitching "AI meeting notetakers" — they have "rebranded as Agentic Operating Systems that sit above the entire advisor tech stack and orchestrate work across it," and now "open accounts, harvest tax losses, identify wallet share, and detect referral-ready moments — all from the meeting transcript" (https://wealthtechtoday.com/2026/05/08/ai-notetakers-financial-advisors-2026/, accessed 2026-06-06).

This is the strategically important fact for agentplain: the leaders are racing **toward** auto-execution, not away from it. Generative-AI adoption among advisors "jumped eleven points in twelve months," and the T3/Inside Information survey went from tracking one AI notetaker a year ago to fourteen products in 2026 (same source, accessed 2026-06-06). Capital has flooded in — Jump and Zocks alone "raised more than $170 million combined" (same source). Meanwhile incumbents (Wealthbox, Altruist's Hazel, Advisor360) are shipping native AI defensively inside their own platforms.

The vertical is regulated under SEC Advisers Act Rule 206(4)-1 (the Marketing Rule), Rule 204-2 (books-and-records), and Exchange Act Rule 17a-4 archiving — and the SEC has proposed amending 17a-3/17a-4/204-2 to require advisers to document use of "covered technologies," conflicts, testing, and **technology overrides** (https://www.skadden.com/insights/publications/2024/09/how-and-when-sec-recordkeeping-rules-may-apply, accessed 2026-06-06; https://www.smarsh.com/regulations/sec-rule-17a-4-records-preservation/, accessed 2026-06-06). Every advisor communication must be archived in a complete, human-readable, supervised form. This regulatory weight is exactly where a draft-and-approve, human-in-the-loop posture is a feature, not a limitation.

## Top competitors

### 1. Jump (jump.ai) — category leader
- **What:** "AI Operating System for financial advisors" — notetaker + CRM sync + pre-meeting prep + follow-up emails + scheduling + (Operate tier) AI intake forms, document intelligence, email assistant (https://jump.ai/pricing, accessed 2026-06-06).
- **Pricing:** Meet tier $100/advisor/mo standard, $75 for "ramping" advisors; up to 20% off annual; free trial. Grow and Operate tiers are "contact sales" (https://jump.ai/pricing, accessed 2026-06-06).
- **Funding:** $20M Series A (Feb 2025, Battery Ventures); $80M Series B (Feb 19 2026, led by Insight Partners; F-Prime, Allianz Life Ventures, TIAA Ventures, Citi Ventures). Total ~$105M (https://finance.yahoo.com/news/jump-raises-80-million-series-140800400.html, accessed 2026-06-06).
- **R-I-A:** Yes — purpose-built for RIAs/financial advisors. Claims ~1 in 10 U.S. advisors; "27,000+ advisors" (https://www.insightpartners.com/portfolio/jump-advisor-ai/, accessed 2026-06-06).
- **Ships vs claims:** Ships at scale. Notetaker + CRM sync are mature and widely deployed. Compliance posture: commits not to train on customer data, end-to-end encryption, can flag required disclosures.
- **Auto-executes?** Partially. Follow-up emails are "generated automatically"; post-meeting "structured data straight into your CRM." The pricing page does not state emails require approval — drafting-vs-auto varies by feature (https://jump.ai/pricing, accessed 2026-06-06).

### 2. Zocks (zocks.io) — best-funded challenger, most aggressive auto-execution
- **What:** "Privacy-first" AI assistant — meeting prep, notes, intake/account-opening forms, tailored client emails, document processing; turns conversations into structured data (https://www.zocks.io/, accessed 2026-06-06).
- **Pricing (transparent — rare in this set):** Essentials $67/user/mo, Professional $117 ("most popular"), Ultimate $184, Enterprise custom (annual billing; monthly is $80/$140/$220). Admin assistant seats +$25/mo (https://www.zocks.io/pricing, accessed 2026-06-06).
- **Funding:** $13.8M Series A (Mar 2025); $45M Series B (Jan 2026, co-led Lightspeed + QED; Motive Partners, Illuminate Financial). Total ~$65M (https://www.zocks.io/press/zocks-raises-45m-series-b-to-accelerate-ai-powered-automation-for-financial-advisors, accessed 2026-06-06). 5,000+ firms.
- **R-I-A:** Yes — advisor-native.
- **Ships vs claims:** Ships. Compliance archiving integrations are real: Smarsh, Proofpoint, Global Relay; audit logs, PII redaction, citation/explainer traceability, no recordings stored (https://www.zocks.io/pricing, accessed 2026-06-06).
- **Auto-executes? YES — and this is the sharpest contrast with agentplain.** Ultimate tier "Automatically writes replies to client emails in your tone of voice"; Professional+ tiers "Automatically update CRM notes, profiles, tasks & workflows." Lower tiers are draft-for-review (https://www.zocks.io/pricing, accessed 2026-06-06).

### 3. Zeplyn (zeplyn.ai) — agentic redesign, early
- **What:** AI Meeting Assistant for wealth managers; 2026 relaunch "Agent Nexus" — an agentic platform (https://www.zeplyn.ai/, accessed 2026-06-06; https://www.wealthmanagement.com/artificial-intelligence/with-agent-nexus-zeplyn-is-throwing-down-an-agentic-gauntlet, accessed 2026-06-06).
- **Pricing:** [unverified] — Agent Nexus pricing stated as being finalized in Q1 2026; no public per-seat number found.
- **Funding:** $3M seed (Leo Capital, Converge). Founded 2022, NYC (https://www.zeplyn.ai/blogs/zeplyn-raises--3m-seed-funding, accessed 2026-06-06).
- **R-I-A:** Yes.
- **Ships vs claims:** Notetaker ships; "Agent Nexus" agentic claims are new/early — more claim than proven at scale.
- **Auto-executes?** Marketed agentic (CRM updates, workflows); depth [unverified].

### 4. FinMate AI (finmate.ai) — value notetaker
- **What:** "Agentic co-pilot" notetaker — in-person/virtual/phone capture, pre-meeting notes, form pre-fill; integrates Redtail/Salesforce/Wealthbox + Zoom/Teams/Meet (https://finmate.ai/, accessed 2026-06-06; https://smartasset.com/advisor-resources/ai-note-taker-for-financial-advisors, accessed 2026-06-06).
- **Pricing:** ~$76–$120/mo, enterprise available (https://smartasset.com/advisor-resources/ai-note-taker-for-financial-advisors, accessed 2026-06-06).
- **Funding:** [unverified] — no disclosed institutional round found; positions as advisor-built, bootstrapped-feel.
- **R-I-A:** Yes. SOC 2 Type 2; does not train on meeting data.
- **Ships vs claims:** Ships as a focused notetaker; "agentic" framing is aspirational.
- **Auto-executes?** Primarily draft/pre-fill + clean handoff; not an auto-sender.

### 5. Conquest Planning (conquestplanning.com) — adjacent: AI planning engine, not a notetaker
- **What:** AI-powered financial-planning engine + co-planning; "compliance-first AI"; opening Conquest data to LLMs/agents via MCP (https://conquestplanning.com/media/conquest-planning-previews-next-chapter-of-compliance-first-ai-innovation, accessed 2026-06-06).
- **Pricing:** [unverified] — enterprise/institutional, not public per-seat.
- **Funding:** ~$137M total (https://pitchbook.com/profiles/company/403962-49, accessed 2026-06-06).
- **R-I-A:** Yes, but sells largely to institutions/banks/enterprises, not the small independent RIA agentplain targets.
- **Ships vs claims:** Planning engine ships and is integrated (e.g. Advisor360); MCP/agent features previewed for April 2026.
- **Auto-executes?** It generates plans; it is not an inbox/CRM auto-actor. Different layer of the stack — potential integration target, not a head-to-head.

(Saturn / saturnos.com — UK/EU-leaning, ~$15M / €12.9M Series A — and Powder / powderfi.com — $5M seed, proposal-generation co-analyst, 20 RIAs $1B–$100B AUM — are credible but narrower; not in the top-5 head-to-head for agentplain's small-RIA ICP. Sources: https://www.international-adviser.com/tech-firm-saturn-raises-15m-to-develop-ai-tools-for-advisers/ and https://www.wealthmanagement.com/financial-technology/wealthtech-startup-powder-raises-5m-in-seed-funding, both accessed 2026-06-06.)

## Competitive matrix

| Competitor | Price (per seat/mo) | Posture | Auto-executes? | Vertical depth | Threat |
|---|---|---|---|---|---|
| Jump | $75–$100 (Meet); higher undisclosed | Agentic OS | Partial — auto follow-up emails + CRM sync | Very high (RIA-native, ~1 in 10 advisors) | **High** |
| Zocks | $67–$184 | Agentic OS, privacy-first | **Yes — auto-replies (Ultimate) + auto CRM update (Pro+)** | Very high (5,000+ firms) | **High** |
| Zeplyn | [unverified] | Agentic (Agent Nexus, new) | Marketed yes; depth unverified | High | Medium |
| FinMate AI | ~$76–$120 | Notetaker / pre-fill | No (draft + handoff) | High | Low–Medium |
| Conquest Planning | [unverified], enterprise | AI planning engine | No (plan generation) | High but institutional | Low (adjacent) |

## agentplain's honest differentiation

agentplain is **not** another advisor notetaker. It is a fleet of AI partners that read across email/calendar/CRM/custodial docs, categorize, draft, schedule, and coordinate — across the whole practice, not just the meeting — with a **named service partner (Plaino)** and a vertical compliance corpus. The hard line: agentplain **never sends, dials, trades, moves money, or commits the firm itself**; the customer's own systems execute after a human approves. In a vertical where Zocks Ultimate now auto-replies to clients and Jump auto-sends follow-ups, agentplain's deliberate refusal to auto-execute is the differentiator, because under SEC Rule 206(4)-1 and proposed 204-2/17a-4 amendments (documenting covered-technology use, conflicts, and overrides), an auto-sent AI email is a supervised advertisement/communication the firm is on the hook for. agentplain keeps the human as the supervisory checkpoint by design.

## Where agentplain WINS

- **Compliance-by-construction.** The competitor trend is toward auto-send/auto-update; agentplain's draft-and-approve gate maps cleanly onto the SEC Marketing Rule's required review-and-approval process (https://archiveintel.com/thought-leadership/sec-marketing-rule-206-4-1/, accessed 2026-06-06) and onto the proposed "technology override" recordkeeping (Skadden, accessed 2026-06-06). agentplain is the safe answer to "what did the AI send my client?"
- **Whole-practice scope, not just meetings.** Jump/Zocks/Zeplyn/FinMate are anchored on the meeting transcript. agentplain reads the inbox, calendar, CRM, and custodial docs and coordinates — a broader surface than "great notes."
- **Integrate-not-replace + one named partner.** Augments Redtail/Wealthbox rather than asking the firm to switch systems of record; Plaino is a service partnership, not a SaaS seat.
- **Price + ROI for the small independent RIA.** $99–$199/seat with first month free undercuts Zocks Ultimate ($184–$220) and Jump's undisclosed Grow/Operate tiers, with no enterprise gatekeeping.

## Where agentplain LOSES

- **Category mindshare and capital.** Jump (~$105M, ~27,000 advisors) and Zocks (~$65M, 5,000+ firms) own the "AI for advisors" search term and the analyst guides. agentplain is not yet in the T3/Ezra Group comparison set.
- **Notetaker maturity.** These tools have years of advisor-tuned transcription, CRM field-mapping, and form pre-fill. If a prospect's #1 felt pain is "I hate writing meeting notes," the incumbents win that demo.
- **"Auto-execute is a feature" buyers.** A meaningful segment WANTS the AI to send the email and update the CRM unattended. agentplain deliberately won't — and will lose those buyers to Zocks Ultimate / Jump on raw automation speed.
- **Native CRM AI.** Wealthbox/Altruist Hazel embedding AI for free inside the system of record is a zero-marginal-cost competitor for the lightest use cases.

## ROI claims (strongest number + source)

Strongest defensible number: advisors report saving **5–10 hours/week** with Jump, and **10+ hours/week** with Zocks (https://jump.ai/, accessed 2026-06-06; https://www.zocks.io/, accessed 2026-06-06). At a conservative blended advisor value of ~$150/hr, 8 hrs/week ≈ $1,200/week ≈ ~$5,000/mo of recovered capacity against agentplain's $99–$199/seat — i.e. a ~25–50x return, comfortably inside agentplain's stated 15–107x band, using competitors' own time-savings figures.

## Sharpest positioning delta (one sentence)

While Jump and Zocks now race to *auto-send the client email and auto-update the CRM unattended*, agentplain wins the regulated RIA by doing the same upstream work — read, categorize, draft, schedule, coordinate across the whole practice — and then deliberately stopping at the human-approval line, turning the SEC Marketing Rule from a constraint into a reason to buy.
