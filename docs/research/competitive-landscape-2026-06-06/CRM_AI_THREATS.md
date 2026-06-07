# CRM-Native AI — The "Good Enough" Threat (agentplain)
_Research date 2026-06-06. Live web research; sources cited inline._

## The "good enough" risk in one paragraph

A local-business owner who already pays for a CRM does not shop for an AI assistant — they get one bundled, billed on the card they already have, inside the tool they already log into. Every CRM in this scope now ships AI: HubSpot Breeze (assistant + autonomous agents), Salesforce Agentforce (autonomous, action-priced), Pipedrive (suggestion-only assistant), Close (AI copilot — call summaries, suggested replies), Attio (research agent + automation actions), and Apollo (AI-assisted email + auto-sending sequences). For routine inside-CRM work — draft this email, summarize this thread, score this lead, suggest the next step — these are genuinely good enough, and they carry the unbeatable advantage of zero new vendor, zero new login, zero new contract. That is the gravity agentplain fights. agentplain's separation is on three axes the CRMs structurally do not cover: (1) **vertical-aware compliance** — every CRM AI here is generic, none ships a real-estate/insurance/mortgage compliance corpus; (2) **no-send control as a guarantee** — the CRMs are racing toward autonomous auto-execution (Agentforce, Breeze Customer Agent, Apollo sequences) where agentplain's hard limit is that it *never* sends, dials, or commits; and (3) **works across ALL the owner's tools** — the CRM AI only sees CRM data, while agentplain reads the email, calendar, CRM, and docs together and is delivered as a done-for-you service with a named partner ("Plaino"), not a copilot the owner has to drive.

## CRMs

### HubSpot Breeze (assistant + agents + Copilot)
- **AI shipped today:** Breeze Assistant/Copilot (drafting, summarizing, reporting) is on every plan including free. Breeze Agents are autonomous "teammates" — Customer Agent (handles support chats), Prospecting Agent (researches leads, writes outreach), Social Media Agent. Breeze Intelligence adds data enrichment. Source: https://vantagepoint.io/blog/hs/how-to-use-breeze-ai-agents-hubspot (accessed 2026-06-06); https://www.onthefuze.com/hubspot-insights-blog/hubspot-breeze-ai-agents-2026 (accessed 2026-06-06).
- **AI pricing:** Agents require Professional plans (from ~$450/mo Sales or Service Hub; ~$800/mo Marketing Hub) or Enterprise ($1,500–$3,600/mo). Usage billed in credits: **$10 per 1,000 credits monthly ($9 annually)**. Customer Agent moved to outcome-based pricing 2026-04-14 — **50 credits ($0.50) per resolved conversation**. Pro Customer Platform includes 5,000 credits/mo; Enterprise 10,000. Sources: https://resolve247.ai/blog/hubspot-ai-agent-pricing/ (accessed 2026-06-06); https://www.eesel.ai/blog/hubspot-ai-pricing (accessed 2026-06-06).
- **Auto-executes?** YES (configurable). The Customer Agent resolves conversations by "performing an action with no handoff to a human," with human handoff as an *option* — i.e., it can run autonomously. Source: https://resolve247.ai/blog/hubspot-ai-agent-pricing/ (accessed 2026-06-06).
- **Vertical-aware?** No. Generic horizontal CRM AI; no per-vertical compliance corpus.
- **Good-enough risk:** HIGH for any owner already on a HubSpot Pro/Enterprise plan — the assistant is free and the agents are one toggle away on the bill they already pay.

### Salesforce Agentforce
- **AI shipped today:** Autonomous AI agents (Service, Sales, SDR, etc.) that "decide what data is needed and what actions are required, then autonomously execute those actions." Supports both autonomous and human-in-the-loop modes; Einstein Trust Layer + low-code guardrails. Source: https://trailhead.salesforce.com/content/learn/modules/agentforce-agents-quick-look/discover-agentforce-agents (accessed 2026-06-06); https://www.salesforce.com/agentforce/ (accessed 2026-06-06).
- **AI pricing:** Multiple models. **$2 per conversation** (original model). **Flex Credits at $500 per 100,000 credits**, i.e. **$0.10 per standard action (20 credits), $0.15 per voice action (30 credits)**. Salesforce Foundations includes 200,000 Flex Credits. The $2/conversation model was widely noted as pricing out SMBs/nonprofits; Flex Credits is the more granular path. Sources: https://ekfrazo.com/resources/blogs/resources-blogs-salesforce-agentforce-pricing-2026/ (accessed 2026-06-06); https://www.saastr.com/salesforce-now-has-3-pricing-models-for-agentforce-and-maybe-right-now-thats-the-way-to-do-it/ (accessed 2026-06-06). (Note: salesforce.com/agentforce/pricing returned HTTP 403 to automated fetch on 2026-06-06; figures from secondary sources.)
- **Auto-executes?** YES — explicitly autonomous; approvals/escalation are optional, risk-configured flows. Source: https://trailhead.salesforce.com/content/learn/modules/agentforce-agent-planning/define-the-agent-guardrails (accessed 2026-06-06).
- **Vertical-aware?** No native local-business compliance corpus; "industry clouds" exist but are enterprise-grade and config-heavy, not local-business turnkey.
- **Good-enough risk:** MEDIUM for local businesses — Agentforce is powerful but enterprise-priced, action-metered, and requires Salesforce, which most local businesses do not run. Higher threat for the larger end of the market.

### Pipedrive (AI Sales Assistant)
- **AI shipped today:** AI Sales Assistant (analyzes deal history, win-probability predictions, next-best-action recommendations), AI Email Writer (OpenAI-powered), AI Email Summarizer, AI marketplace search. Source: https://www.pipedrive.com/en/features/ai-sales-assistant (accessed 2026-06-06).
- **AI pricing:** Pipedrive restructured to 4 plans Feb 2026 from $14/user/mo (Lite, includes basic AI Sales Assistant). Fuller AI in Premium/Ultimate from ~$49/user/mo. Source: https://vantaige.io/ai-tool/pipedrive (accessed 2026-06-06); https://www.pipedrive.com/en/features/ai-sales-assistant (accessed 2026-06-06).
- **Auto-executes?** NO. Explicitly "a suggestion engine, not an agent" — does not auto-send or auto-act. Source: https://vantaige.io/ai-tool/pipedrive (accessed 2026-06-06); WebFetch of pipedrive.com AI page (accessed 2026-06-06).
- **Vertical-aware?** No. Generic.
- **Good-enough risk:** MEDIUM — cheap and bundled, but suggestion-only and CRM-data-only; closest in autonomy posture to agentplain's draft-only stance, but with none of the vertical depth or cross-tool reach.

### Close CRM (AI Copilot)
- **AI shipped today:** AI copilot — post-call summaries, next-step identification, suggested replies, call transcription/recording, CRM auto-update from conversations. Source: https://comparateur-ia.com/en/ai-tools/close-crm (accessed 2026-06-06); https://blog.hubspot.com/sales/crm-with-ai (accessed 2026-06-06).
- **AI pricing:** Paid plans from ~$50/user/mo (annual); AI copilot/transcription on higher tiers and noted as not in the base price. Source: https://marketbetter.ai/blog/close-crm-pricing-2026/ (accessed 2026-06-06).
- **Auto-executes?** Largely NO for outbound content — copilot *suggests* replies and *summarizes*; the human sends. Close does have native dialer/email sequences (those send on schedule), but the AI layer itself is assistive. Source: https://comparateur-ia.com/en/ai-tools/close-crm (accessed 2026-06-06).
- **Vertical-aware?** No. Generic sales-team tooling.
- **Good-enough risk:** MEDIUM — strong for high-velocity inside-sales SMBs; weak for vertical compliance or owner-inbox breadth.

### Attio (Research Agent + Automations)
- **AI shipped today:** AI Research Agent (researches a record from web + internal data, answers questions), Ask Attio, AI attributes (Summarize, Classify), and Automations where Action Blocks can update records, **send email**, or create tasks. Source: https://attio.com/blog/introducing-attio-ai-research-agent (accessed 2026-06-06); https://attio.com/platform/ai (accessed 2026-06-06).
- **AI pricing:** Plans $29–$119+/user/mo. Free (3 users, 250 automation credits/mo); Plus $29 (250k record cap); Pro ~$69 (10,000 credits, Call Intelligence); Enterprise ~$119+. **Research Agent run = 10 credits.** Extra workspace credits from $70/mo per 5,000 (annual). Source: https://checkthat.ai/brands/attio/pricing (accessed 2026-06-06); https://delveant.com/blog/attio-pricing/ (accessed 2026-06-06).
- **Auto-executes?** PARTIALLY — within configured Automations, Action Blocks can auto-send email and trigger downstream actions from research results. The agent itself is research/answer; the *automation* executes. Source: https://attio.com/blog/introducing-attio-ai-research-agent (accessed 2026-06-06).
- **Vertical-aware?** No. Developer-leaning, data-team CRM; generic.
- **Good-enough risk:** LOW–MEDIUM for traditional local businesses (Attio skews tech/startup, not realty/insurance owner-operators).

### Apollo.io (AI sequences + agents)
- **AI shipped today:** AI-assisted email writing, agentic/AI workflows (account research, lead scoring, message generation, next-step recs), and **auto-sending sequences** (A/B-tested, automated follow-ups, ~250 emails/day fair-use). Source: https://www.apollo.io/pricing (accessed 2026-06-06); https://salesmotion.io/blog/apollo-pricing (accessed 2026-06-06).
- **AI pricing:** Free $0; Basic $49/user/mo (annual); Professional $79 (adds AI-assisted email writing, dialer); Organization $119. AI Assistant currently free as an intro offer across paid plans. Source: https://marketbetter.ai/blog/apollo-io-pricing-breakdown-2026/ (accessed 2026-06-06); https://salesmotion.io/blog/apollo-pricing (accessed 2026-06-06).
- **Auto-executes?** YES — sequences auto-send outbound email on schedule; this is core product behavior. Source: https://www.apollo.io/pricing (accessed 2026-06-06).
- **Vertical-aware?** No. Generic outbound prospecting.
- **Good-enough risk:** MEDIUM — but Apollo is outbound-prospecting-first, the *opposite* of agentplain's no-outbound stance; overlaps least on philosophy, most on "AI writes your emails."

## What they ship vs what agentplain ships

| Capability | HubSpot Breeze | Agentforce | Pipedrive | Close | Attio | Apollo | **agentplain** |
|---|---|---|---|---|---|---|---|
| Drafts emails/replies | Yes | Yes | Yes | Yes (suggest) | Yes | Yes | **Yes** |
| Summarizes / categorizes | Yes | Yes | Yes | Yes | Yes | Yes | **Yes** |
| Next-step / scheduling recs | Yes | Yes | Yes | Yes | Yes | Yes | **Yes (drafts + schedules to approve)** |
| Auto-SENDS outbound | Yes (agent) | Yes (agent) | No | Sequences | Via automation | Yes (sequences) | **NEVER (hard limit)** |
| Sees beyond the CRM (email/cal/docs) | Limited | Limited | No | No | No | No | **Yes — all owner tools** |
| Vertical compliance corpus | No | No | No | No | No | No | **Yes (RE/insurance/mortgage)** |
| Delivered as done-for-you service | No (self-serve) | No | No | No | No | No | **Yes (named partner "Plaino")** |
| Pricing model | Credits/conversation | Per-action/conversation | Per-seat | Per-seat | Per-seat + credits | Per-seat | **$199→$99/seat flat, 1st mo free** |

## Where agentplain WINS vs CRM-native AI

1. **Vertical-aware compliance.** Every CRM AI here is generic. None ships a real-estate / insurance / mortgage compliance corpus. For a regulated local business, "draft an email" without compliance awareness is a liability, not a feature.
2. **No-send control as a guarantee, not a setting.** The CRMs are racing toward autonomous auto-execution (Agentforce, Breeze Customer Agent, Apollo sequences). agentplain's hard limit — never sends, dials, moves money, or commits — is a trust posture an owner can stand behind. The owner's own system executes.
3. **Whole-business visibility.** CRM AI only sees CRM data. agentplain reads the email, calendar, CRM, *and* docs together — it catches the deal sitting in the owner's inbox that never made it into the CRM.
4. **Integrate-not-replace.** agentplain augments the CRM the owner already runs (FUB, Sierra, etc.) instead of demanding migration; the CRM-native AI implicitly requires you to live in *their* CRM.
5. **Done-for-you service + flat pricing.** A named partner does the work, on a flat $199→$99/seat with the first month free — versus metered credit/per-action models that punish heavy use and require the owner to drive the tool themselves.

## Where agentplain LOSES vs CRM-native AI

1. **"It's already in the tool I pay for."** This is the decisive disadvantage. Zero new vendor, login, or contract beats every feature argument for a busy owner.
2. **Real-time, in-context inside the CRM UI.** Breeze/Pipedrive/Close/Attio AI live *on the record* the owner is looking at; agentplain is adjacent, not embedded in the CRM screen.
3. **Auto-execution speed where the owner WANTS it.** For owners who actually want autonomous send/resolve (support deflection, outbound at volume), Agentforce/Breeze/Apollo do it; agentplain deliberately will not.
4. **Brand trust + enterprise muscle.** Salesforce/HubSpot carry incumbency, integrations, and procurement comfort agentplain has to earn.
5. **Self-serve instant-on.** CRM AI flips on with a toggle; agentplain's service-partnership model is higher-touch to start.

## Positioning deltas

- **HubSpot Breeze:** "Breeze is great inside HubSpot — but it only sees HubSpot, it has no idea what compliance your vertical demands, and its agents send on their own; agentplain reads everything the owner runs, knows the rules, and never sends without you."
- **Agentforce:** "Agentforce is enterprise-grade autonomy metered per action and locked to Salesforce — agentplain is flat-priced, vertical-aware, works with the CRM you already use, and guarantees a human sends every message."
- **Apollo:** "Apollo auto-blasts outbound at volume; agentplain is the opposite — it does the inbound, coordination, and compliance work and hands every draft to you to send, so your business never auto-fires a message in your name."
