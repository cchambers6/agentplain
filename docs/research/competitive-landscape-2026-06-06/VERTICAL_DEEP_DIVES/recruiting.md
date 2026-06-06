# Competitive Deep Dive — Recruiting / Staffing (agentplain)
_Research date 2026-06-06. Live web research; sources cited inline._

## The vertical's AI landscape

Recruiting is the most crowded, most AI-saturated vertical agentplain touches — and the one where its core posture (draft/advise, never send) cuts hardest against the grain. The dominant product pattern in recruiting AI is **autonomous candidate contact**: tools that auto-source from billion-profile graphs, then auto-text, auto-call, and auto-screen candidates 24/7 with no human in the loop per message. Paradox, Sense, and Juicebox all ship explicit "runs in the background / auto-email / real-time AI phone calls" features. This is the opposite of agentplain's hard limit.

That contrast is now a live legal liability, not a philosophical one. In **Mobley v. Workday**, a California federal court in **February 2026** authorized class notice on claims that Workday's AI screening filtered applicants by age, race, and disability — and treated the **software vendor as an "agent" of the employer**, meaning the employer cannot deflect liability to the tool ([Akerman/HR Defense, accessed 2026-06-06](https://www.hrdefenseblog.com/2025/11/ai-in-hiring-emerging-legal-developments-and-compliance-guidance-for-2026/); [HR C-Suite, accessed 2026-06-06](https://hrcsuite.com/the-legal-implications-of-ai-driven-hiring-decisions/)). The EEOC's renewed disparate-impact focus means "automated rejections without any human review are the fastest way to trigger discrimination claims" ([Sanford Heisler Sharp, accessed 2026-06-06](https://www.sanfordheisler.com/blog/2025/12/ai-bias-in-hiring-algorithmic-recruiting-and-your-rights/)). A small staffing agency that buys an auto-screen/auto-message tool inherits that exposure. agentplain's human-approval gate is, in 2026, a compliance feature — not just a brand value.

The downside: agentplain has **zero recruiting-vertical depth today**. None of these competitors integrate with an ATS the way agentplain would need to (Bullhorn, JobAdder, Crelate) at the level Paradox or hireEZ do. agentplain is a horizontal "local business" fleet; these are purpose-built recruiting stacks with billion-profile candidate graphs agentplain does not have and would not build.

## Top competitors

### Paradox (Olivia) — the high-volume auto-contact leader
- **What:** Conversational AI recruiter ("Olivia") that screens via knockout questions, schedules interviews by syncing recruiter calendars, and answers candidate FAQs via SMS/chat 24/7 in 100+ languages ([paradox.ai, accessed 2026-06-06](https://www.paradox.ai/)).
- **Pricing:** Starts ~$1,000/mo; real implementations from ~$15K/yr scaling to $50K–$500K+/yr for enterprise. No free trial; sales-gated ([Index.dev review, accessed 2026-06-06](https://www.index.dev/blog/paradox-ai-recruitment-chatbot-review)).
- **Funding:** Well-funded category leader (Chipotle, GM, 7-Eleven as named customers).
- **R-I-A:** Reads job data + candidate replies; **Acts** autonomously — texts, screens, schedules without per-message approval.
- **Ships vs claims:** Ships. Named enterprise outcomes (Chipotle 75% faster hiring, GM ~$2M/yr saved).
- **Auto-messages candidates? YES** — core product. Direct opposite of agentplain.

### Sense — orchestration + Voice AI that calls candidates
- **What:** Recruiting orchestration platform: automated outreach, matching, scheduling, chatbot, plus **Voice AI that makes real-time intelligent phone calls** to prequalify candidates and book interviews ([sensehq.com/product/voice-ai, accessed 2026-06-06](https://www.sensehq.com/product/voice-ai)).
- **Pricing:** From $500/mo per module; full orchestration tier ~$2,000/mo; enterprise ~$7,000/mo ([Capterra, accessed 2026-06-06](https://www.capterra.com/p/180547/Sense/)).
- **Funding:** Established (raised >$50M historically; specific 2026 round not verified — [unverified]).
- **R-I-A:** Reads candidate/ATS data; **Acts** — autonomous texting and AI voice calls.
- **Ships vs claims:** Ships; strong in healthcare/logistics/retail high-volume staffing.
- **Auto-messages candidates? YES** — including autonomous voice calls. Hardest contrast for agentplain's no-dial limit.

### hireEZ — agentic sourcing built ON your ATS
- **What:** "Agentic AI recruiting platform built on your ATS" — sourcing, outreach, screening agents layered over existing ATS data ([hireez.com, accessed 2026-06-06](https://hireez.com/)).
- **Pricing:** ~$169–$250+/user/mo billed annually; median annual contract ~$13K, deals $6.6K–$48K ([Vendr, accessed 2026-06-06](https://www.vendr.com/marketplace/hireez); [Pin, accessed 2026-06-06](https://www.pin.com/blog/hireez-pricing/)).
- **Funding:** $26M Series B (Conductive Ventures, 2022, when it rebranded from Hiretual); newer rounds [unverified].
- **R-I-A:** Integrate-and-Act — closest competitor philosophically to agentplain's "augment your ATS" pitch, but it auto-outreaches.
- **Ships vs claims:** Ships; Agentic AI launched March 2025, ResumeSense Nov 2025.
- **Auto-messages candidates? YES** — agentic outreach is the headline.

### SeekOut — talent intelligence + agentic "Spot" service
- **What:** Talent-intelligence sourcing platform (1B+ profiles, DEI filters, technical-profile depth via GitHub/patents). **SeekOut Spot** is an agentic service delivering "interview-ready candidates in 14 days" with AI agents sourcing/outreaching/screening, guided by SeekOut's own recruiters ([seekout.com, accessed 2026-06-06](https://www.seekout.com/)).
- **Pricing:** Professional $149/mo ($1,788/yr) annual upfront; enterprise $1,200–$1,999+/mo; median annual contract ~$20K ($5.8K–$54.9K) ([MindHunt, accessed 2026-06-06](https://mindhuntai.com/blog/seekout-review)).
- **Funding:** $189M raised, ~$1.2B valuation (Tiger Global, Madrona, Mayfield) ([Juicebox/SeekOut pricing analysis, accessed 2026-06-06](https://juicebox.ai/blog/seekout-pricing)).
- **R-I-A:** Read-heavy (sourcing intelligence) + agentic Act in the Spot tier.
- **Ships vs claims:** Ships; 750+ customers. Spot is a managed-service blend — notably the one model that, like agentplain, pairs AI with humans (theirs, not the customer's).
- **Auto-messages candidates? YES** in Spot tier; core platform is sourcing/intelligence.

### Juicebox (PeopleGPT) — natural-language sourcing + auto-email agents
- **What:** AI-native sourcing across 800M+ profiles via natural-language search ("describe who you need"); an **AI Agent add-on runs searches 24/7 and can be set to auto-email or auto-shortlist** ([juicebox.ai/pricing, accessed 2026-06-06](https://juicebox.ai/pricing)).
- **Pricing:** Free $0; Starter $139/seat/mo; Growth $199/seat/mo (up to 5 seats); Business custom. **Agents add-on $199/agent/mo** with unlimited email credits ([juicebox.ai/pricing, accessed 2026-06-06](https://juicebox.ai/pricing)).
- **Funding:** $36M total incl. $30M Series A led by Sequoia; >$10M ARR in first year ([TechFundingNews, accessed 2026-06-06](https://techfundingnews.com/juicebox-lands-30m-to-revolutionise-hiring-with-ai-powered-recruitment-tool-peoplegpt/)).
- **R-I-A:** Read (sourcing) + optional autonomous Act (auto-email agent).
- **Ships vs claims:** Ships; fastest-growing self-serve entrant, price overlaps agentplain almost exactly ($139–$199/seat).
- **Auto-messages candidates? YES (optional)** — auto-email is a toggle, not forced. The most agentplain-like in that the human *can* keep the gate, but the default product sells autonomy.

_Note: **Moonhub** (the "world's first AI Recruiter," $14.4M raised, Khosla/GV-backed) was **acquired by Salesforce** and folded toward Agentforce ([Yahoo Finance, accessed 2026-06-06](https://finance.yahoo.com/news/salesforce-acquires-moonhub-ai-recruiting-133125174.html)) — no longer a standalone option for small agencies. **Findem** remains a relevant talent-intelligence/attribute-search player but skews enterprise; not a small-agency fit._

## Competitive matrix

| Competitor | Price | Posture | Auto-messages? | Vertical depth | Threat |
|---|---|---|---|---|---|
| Paradox (Olivia) | ~$15K–$500K/yr | Autonomous contact | YES (text/chat/schedule) | Very high (high-volume) | High |
| Sense | $500–$7K/mo | Autonomous + voice | YES (text + AI calls) | High (staffing) | High |
| hireEZ | ~$169–$250/user/mo | Agentic-on-ATS | YES (auto-outreach) | High (sourcing) | High |
| SeekOut | $149/mo–$54K/yr | Intelligence + agentic service | YES (in Spot tier) | High (sourcing/DEI) | Medium |
| Juicebox (PeopleGPT) | $139–$199/seat + $199 agent | Sourcing + optional auto-email | OPTIONAL (toggle) | Medium-high | Medium-high |
| **agentplain** | **$99–$199/seat** | **Draft/advise, never send** | **NO (hard limit)** | **None yet (horizontal)** | — |

## agentplain's honest differentiation

agentplain is the only entrant whose architecture **structurally cannot auto-contact a candidate**. Every other tool's value prop is "the AI reaches out so you don't have to." agentplain's is "the AI does the reading, categorizing, drafting, and coordinating; you approve and your systems send." In a vertical now defined by Mobley-era vendor-as-agent liability, that's a defensible wedge for the *compliance-anxious, relationship-driven* small agency — not the high-volume req mill.

## Where agentplain WINS
- **Liability posture.** Post-Mobley (Feb 2026), the human-approval gate means the agency keeps a human decision-maker on every candidate touch — the single best defense against disparate-impact claims ([Sanford Heisler, accessed 2026-06-06](https://www.sanfordheisler.com/blog/2025/12/ai-bias-in-hiring-algorithmic-recruiting-and-your-rights/)).
- **Integrate-not-replace + service partnership.** A named partner (Plaino) sitting across email/ATS/calendar, not a bolt-on bot the recruiter still has to babysit. Only SeekOut Spot pairs humans+AI, and those are *SeekOut's* recruiters, not the customer's.
- **Price floor for the smallest agencies.** $99–$199/seat undercuts Paradox (~$15K/yr entry) and Sense ($500+/mo/module) decisively; matches Juicebox.
- **No per-candidate-volume metering.** Most competitors meter contact/export credits.

## Where agentplain LOSES
- **No candidate graph.** Competitors search 800M–1B+ profiles. agentplain has none; it works the agency's *existing* pipeline. For pure net-new sourcing, agentplain simply does not compete.
- **No recruiting-vertical depth.** No Bullhorn/JobAdder/Crelate-grade ATS integration shipped; no recruiting-specific workflow (req intake → shortlist → submittal). This is a build gap, not a positioning one.
- **Speed-to-fill story is weaker.** Paradox's "75% faster," SeekOut Spot's "14 days," Sense's voice prequalification all promise throughput. agentplain's draft-gate is *slower per touch* by design — a hard sell to a high-volume desk.
- **The no-send limit reads as a missing feature** to buyers who *want* automation and don't yet fear the liability.

## ROI claims (strongest number + source)
Competitors own the strongest hard numbers: **Paradox — GM ~$2M/yr saved; Chipotle 75% faster hiring** ([Index.dev, accessed 2026-06-06](https://www.index.dev/blog/paradox-ai-recruitment-chatbot-review)). agentplain's own ROI frame (15–107x vs $99–$199/mo) is credible at the admin-time layer but unproven in recruiting specifically — agentplain should claim *liability-avoidance ROI* (one avoided EEOC settlement, e.g. the $365K AI-hiring settlement cited in [CloudApper, accessed 2026-06-06](https://www.cloudapper.ai/talent-acquisition/ai-hiring-discrimination-lawsuits-reshaping-recruitment/)) rather than compete on speed-to-fill it will lose.

## Sharpest positioning delta (one sentence)
Every recruiting-AI competitor sells "the AI contacts your candidates for you"; in the post-Mobley vendor-as-agent era, agentplain sells the opposite — "the AI does everything except contact your candidates, so a human (and your liability shield) stays on every touch."
