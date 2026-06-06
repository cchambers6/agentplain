# Horizontal SMB AI-Agent Platforms — Threat Analysis (agentplain)
_Research date 2026-06-06. Live web research; sources cited inline._

## The horizontal threat in one paragraph

The horizontal threat is a class of general-purpose AI-agent builders — Lindy, Relevance AI, Zapier Agents, n8n, Onyx, plus point-tools like Fyxer and 11x — that any SMB *could* point at its own email/CRM/calendar workflows. They are cheaper per seat than agentplain ($16–$50/mo entry vs agentplain's $99–$199/seat), enormously well-distributed (Zapier touches 3.4M companies; n8n is free/open-source), and several already do the read-categorize-draft loop agentplain sells. But they share three structural gaps against agentplain's positioning: (1) they are **build-it-yourself toolkits**, not a **done-for-you service partnership** — the non-technical realtor/CPA/insurance owner has to configure, prompt, and maintain them; (2) almost none carry a **vertical-aware compliance corpus** (RESPA, TILA, E&O, state real-estate/insurance rules); and (3) the most powerful ones (Zapier, n8n, 11x, Relevance) are explicitly designed to **auto-execute outbound** — send the email, dial the lead, push the CRM write — which is exactly the line agentplain refuses to cross and sells as a trust/liability differentiator. The real competitive pressure is not feature parity; it is whether a local-business owner perceives "$30/mo Fyxer plus a Zapier agent" as good-enough and never discovers they needed the vertical service layer.

## Platforms

### 1. Lindy (lindy.ai)
- **What:** No-code AI-agent builder; pre-built "Lindies" for email drafting, meeting scheduling/notes, CRM updates, browser automation across 100+ integrations.
- **ICP:** Solopreneurs, small sales/ops teams, technically-comfortable SMB operators who want to assemble their own assistants.
- **Pricing [https://www.lindy.ai/pricing, accessed 2026-06-06]:** Plus $49.99/mo (up to 2 inboxes), Pro $99.99/mo (3 inboxes, browser/computer use), Max $199.99/mo (5 inboxes, heavy workload), Enterprise custom (SSO, SCIM, HIPAA/BAA, audit logs). 7-day free trial, no permanent free tier on the official page. (Note: third-party sources [https://www.cloudtalk.io/blog/lindy-ai-pricing/, accessed 2026-06-06] describe a credit-based model with $0.19/min voice + $10/mo per phone number — older or usage-overlay pricing; the official page presents flat monthly tiers.)
- **Funding/traction:** ~$50M+ raised per industry reporting; high-visibility consumer-prosumer brand. [unverified exact total]
- **Good at:** Fast assembly of personal email/calendar agents; strong integration breadth; genuinely usable by a determined non-engineer.
- **Can't do for a local-business owner:** No vertical compliance corpus; owner still configures and supervises; no named-partner service relationship; tuning quality drafts to a specific brokerage/firm voice is on the user.
- **Auto-executes?** **Partial / human-gated by design** — official page states "Lindy drafts and proposes; the user controls what gets sent" with approvals built in [accessed 2026-06-06]. This is the closest horizontal to agentplain's no-outbound stance, but it can be configured to auto-send and to place voice calls.
- **Threat level:** **High** — closest functional+philosophical overlap; cheaper; consumer-grade ease.

### 2. Relevance AI (relevanceai.com)
- **What:** "AI workforce" platform — build multi-agent teams ("Bosh" the AI BDR, custom agents) with tools/actions; orchestration-heavy.
- **ICP:** Revenue/ops teams at SMB→mid-market; more technical buyer than Lindy.
- **Pricing [https://relevanceai.com/pricing, accessed 2026-06-06; corroborated https://costbench.com/software/ai-agent-platforms/relevance-ai/, accessed 2026-06-06]:** Free (200 actions/mo, 1 user); Pro $19/mo (10k credits, 2 users); Team $234/mo (35k credits, 5 users); Enterprise custom. Dual-meter since Sept 2025 (Actions + Vendor Credits for model cost).
- **Funding/traction:** $24M Series B led by Bessemer; Insight Partners, King River Capital on cap table [accessed 2026-06-06].
- **Good at:** Multi-agent orchestration, custom tool-building, sales-workforce use cases.
- **Can't do for a local-business owner:** Steeper learning curve; built for builders; no vertical compliance pack; no service partner; credit/vendor-cost model unpredictable for a non-technical owner.
- **Auto-executes?** **Yes** — agents call tools and take actions autonomously (the BDR agent does outreach); human-in-loop is optional, not the default posture.
- **Threat level:** **Medium** — powerful but aimed at a more technical buyer than agentplain's ICP.

### 3. 11x (11x.ai)
- **What:** "Digital workers" — Alice (autonomous outbound AI SDR) and Julian (AI phone agent). Sold as headcount replacement.
- **ICP:** Mid-market/enterprise sales orgs replacing SDR seats — NOT local-business owners.
- **Pricing [https://getbreakout.ai/blog/11x-pricing-ai-sdr-cost-2026 and https://marketbetter.ai/blog/11x-ai-pricing-2026/, accessed 2026-06-06]:** Not publicly listed; ~$5,000/mo per worker billed annually, $50K–$60K first-year minimums, implementation fees $3K+. Enterprise sales-only.
- **Funding/traction:** ~$76M total — $24M from Benchmark (Sep 2024) + $50M Series B from a16z (two months later) [accessed 2026-06-06].
- **Good at:** Fully autonomous high-volume outbound prospecting and AI phone calls.
- **Can't do for a local-business owner:** Wrong price point (10–50x agentplain), wrong buyer, no compliance corpus for regulated verticals; it is the *opposite* product — pure outbound execution.
- **Auto-executes?** **Yes, aggressively** — sends cold email and dials autonomously. This is the antithesis of agentplain's no-outbound rule.
- **Threat level:** **Low** for agentplain's ICP — useful mainly as the contrast case ("outbound robot" vs "trusted inside partner").

### 4. Fyxer AI (fyxer.com)
- **What:** AI email assistant for Gmail/Outlook — auto-sorts inbox (needs-reply / FYI / marketing), drafts replies in your voice, writes meeting notes.
- **ICP:** Individual professionals and small teams drowning in email; very close to agentplain's daily-pain entry point.
- **Pricing [https://www.fyxer.com/pricing, accessed 2026-06-06]:** Starter $30/mo ($22.50 annual) 1 inbox; Professional $50/mo ($37.50 annual) multi-inbox + CRM integration + bespoke onboarding; Enterprise custom (50+). 7-day free trial.
- **Funding/traction:** Widely adopted email tool; [unverified funding total].
- **Good at:** The exact read→categorize→draft loop, with near-zero setup; "open your inbox to find it already sorted."
- **Can't do for a local-business owner:** Email-only — no calendar coordination beyond notes, no CRM workflow agents, no document/compliance reasoning, no vertical corpus, no service partner. Narrow.
- **Auto-executes?** **No for sending** — drafts only, human sends [https://www.fyxer.com/ai-email-assistant, accessed 2026-06-06]; auto-executes inbox *organization*.
- **Threat level:** **Medium-High** as a wedge — a $30/mo "good enough for my inbox" answer that can blunt agentplain's lead-with-email-pain pitch, but it is a feature, not a fleet.

### 5. Onyx (onyx.app)
- **What:** Open-source enterprise-search + AI-assistant platform (RAG over 50+ connectors, agents, actions, MCP).
- **ICP:** Teams of all sizes with internal knowledge to search; technical/IT-led adoption. In production at Netflix, Ramp, UC San Diego.
- **Pricing [https://onyx.app/pricing, accessed 2026-06-06; https://github.com/onyx-dot-app/onyx, accessed 2026-06-06]:** Community $0 (MIT, self-host); Cloud ~$16/seat/mo; Enterprise custom. (Third-party listing also cites Starter $20 / Growth $60 / Scale $200 per user [https://softwarefinder.com, accessed 2026-06-06].)
- **Funding/traction:** 1,000+ orgs in production; open-source momentum on GitHub.
- **Good at:** Searching/answering over company documents and connected apps; self-hostable, no vendor lock-in.
- **Can't do for a local-business owner:** It's a search/chat layer, not a do-the-work fleet; requires hosting/IT; no compliance corpus, no drafting-coordination-scheduling service; non-technical owner cannot stand it up.
- **Auto-executes?** **Limited** — has "Actions," but it is primarily a retrieval/answer assistant, not an outbound executor.
- **Threat level:** **Low** for agentplain's ICP — different job (knowledge search), wrong buyer.

### 6. Zapier Agents (zapier.com/agents)
- **What:** Autonomous AI "teammates" on top of Zapier's 8,000–9,000-app graph — read email, research, and take actions across apps, "on command and while you sleep."
- **ICP:** Zapier's vast installed base (3.4M companies) — ops-minded SMBs already automating.
- **Pricing [https://zapier.com/pricing and https://checkthat.ai/brands/zapier/pricing, accessed 2026-06-06]:** Agents priced as an add-on atop base Zapier; Free ~400 activities/mo, Pro ~1,500 activities/mo; real-world stacks (Copilot + Agents Pro + chatbot) reach $150–$200/mo in add-ons.
- **Funding/traction:** Profitable category leader; 3.4M companies; unmatched distribution.
- **Good at:** Connecting to *anything*; turning existing Zaps into agentic, autonomous workflows; credential handling + audit logging + optional human-in-loop.
- **Can't do for a local-business owner:** Still a build-it-yourself canvas; no vertical compliance corpus; the non-technical owner must design the agent and its triggers; quality/safety is on the user.
- **Auto-executes?** **Yes by default** — designed to take actions autonomously across apps; human approval is opt-in, not the posture.
- **Threat level:** **High** — distribution + breadth means an owner's existing IT/ops contact could assemble a "good enough" agent without ever evaluating agentplain.

### 7. n8n (n8n.io)
- **What:** Open-source workflow-automation platform with native AI-agent nodes (LangChain-style; connects OpenAI, Anthropic, Gemini, local models).
- **ICP:** Developers, technical ops, agencies, MSPs — and the technical advisor *behind* an SMB.
- **Pricing [https://n8n.io/pricing/, accessed 2026-06-06]:** Self-host Community Edition free (you pay only ~$3–7/mo server + LLM API fees); Cloud Starter €24/mo (2,500 executions, 50 AI credits), Pro €60/mo (10k executions), Business ~$800/mo (40k executions). AI nodes incur no separate platform fee.
- **Funding/traction:** Large open-source community; strong 2025–26 momentum as the "Zapier you control."
- **Good at:** Maximum control, no per-action lock-in, run agents that auto-execute against any API; cheapest at scale.
- **Can't do for a local-business owner:** Requires real technical skill (Docker, JSON, API auth); no compliance corpus, no service, no support hand-holding for a non-engineer.
- **Auto-executes?** **Yes, fully** — it will do whatever you wire it to, including send/dial/write.
- **Threat level:** **Medium** — only a threat via a technical intermediary; a solo realtor will never self-host n8n.

### 8. MagicSchool (magicschool.ai) — reference model, not a direct competitor
- **What:** Vertical-specialized AI for K-12 educators — lesson planning, IEPs, feedback, 80+ purpose-built tools tuned to teaching workflows and student-safety/privacy rules.
- **ICP:** Teachers, schools, districts — a single vertical, done deeply.
- **Pricing [https://www.magicschool.ai/pricing, accessed 2026-06-06]:** Free for individual teachers; Plus $8.33/user/mo annual ($12.99 monthly); Enterprise custom (district).
- **Funding/traction:** $65.3M total; $45M Series B led by Valor Equity (Bain Capital Ventures, Adobe Ventures) [accessed 2026-06-06]; 6M+ educators, 10,000+ schools, 160 countries — Q1'25 Series B was 72.5% of all education-AI funding that quarter.
- **Why it's here:** It is the **proof of agentplain's vertical thesis** — a vertical-specialized agent product, with domain-specific safety/compliance built in, crushed horizontal general tools in its category. It is what "vertical done well" looks like at scale.
- **Auto-executes?** N/A (content-generation, human-in-loop by nature).
- **Threat level:** **None directly** — it's a tailwind/validation, and a template agentplain should study (free-teacher land-and-expand → district enterprise; deep vertical tools beat horizontal chat).

## Comparison matrix

| Platform | ICP | Price (entry) | Build-it-yourself or done-for-you? | Auto-executes outbound? | ICP overlap w/ agentplain | Threat |
|---|---|---|---|---|---|---|
| **Lindy** | Solopreneurs, small teams | $49.99/mo | Build-it-yourself (no-code) | Human-gated by default; can auto-send | High | **High** |
| **Relevance AI** | SMB→mid-market revenue/ops | $19/mo (Free tier) | Build-it-yourself (more technical) | Yes | Medium | **Medium** |
| **11x** | Mid-market/enterprise sales | ~$5,000/mo | Done-for-you (but outbound robot) | Yes, aggressively | Low | **Low** |
| **Fyxer** | Individual pros, small teams | $30/mo | Mostly turnkey (email only) | No (drafts only) | High (on email pain) | **Med-High** |
| **Onyx** | Teams w/ internal knowledge; IT-led | $0 / $16 seat | Build/self-host | Limited | Low | **Low** |
| **Zapier Agents** | Zapier's 3.4M-company base | ~$150–200/mo stack | Build-it-yourself | Yes by default | High | **High** |
| **n8n** | Developers, agencies, MSPs | Free self-host / €24 | Build-it-yourself (technical) | Yes, fully | Low (direct) | **Medium** |
| **MagicSchool** | K-12 educators | Free / $8.33 | Turnkey vertical | N/A | None (different vertical) | **None / validation** |

## "Could a realtor / CPA / insurance agent just use Lindy or Zapier instead?" — honest answer

**Technically yes; practically, most won't get the value, and the regulated ones shouldn't.** A motivated, semi-technical owner could stand up Fyxer for email ($30/mo) and a Lindy or Zapier agent for scheduling/CRM and get a real slice of agentplain's value for under $100/mo. That is a genuine competitive floor and agentplain must respect it. **But three things break for the local-business owner:**

1. **Setup and maintenance fall on them.** These are canvases and credit meters, not a partner. The realtor who became a realtor to sell houses has to become a prompt engineer and workflow maintainer. Fyxer is the exception (turnkey) but it is email-only.
2. **No vertical compliance corpus.** None of the horizontals know RESPA/TILA, state real-estate advertising rules, insurance E&O exposure, CPA independence rules, or what must never be auto-sent. A Zapier/n8n agent set to auto-execute outbound in a regulated vertical is a *liability event waiting to happen* — and the most capable horizontals auto-execute by default.
3. **No accountable service relationship.** When the agent drafts something wrong, there is no Plaino, no human owning the outcome — just a support ticket and a credit balance.

So the honest framing: horizontals are a real **"good-enough" threat for the non-regulated, semi-technical solo operator**, and a **non-threat-to-mild-threat for the regulated local business** that needs compliance-aware, accountable, human-gated work. agentplain's moat is narrowest exactly where the owner is technical and unregulated, and widest where they are non-technical and compliance-exposed (its actual target ICP).

## Where agentplain WINS vs horizontals

- **Done-for-you service + named partner (Plaino)** vs build-it-yourself canvas — zero configuration burden on a non-technical owner.
- **Vertical-aware compliance corpus** per industry — none of the horizontals carry RESPA/TILA/E&O/state-rule knowledge.
- **No-outbound as a trust/liability feature** — agentplain *structurally cannot* send/dial/move money; the customer's own systems execute. For regulated verticals this is a selling point, not a limitation; the powerful horizontals (Zapier, n8n, 11x, Relevance) auto-execute and carry the corresponding risk.
- **One fleet, one relationship, one price** ($99–$199/seat) vs stacked add-ons + unpredictable credit/vendor-cost meters (Lindy credits, Relevance dual-meter, Zapier activity stacking).
- **Cold-start-safe, durable-state agents inside the business** vs session/credit-bound automations.

## Where agentplain LOSES vs horizontals

- **Price floor:** $99–$199/seat is 3–6x Lindy/Fyxer/Onyx entry points; a budget-driven owner sees "$30 Fyxer" first.
- **Distribution:** Zapier (3.4M companies), n8n (open-source ubiquity), MagicSchool (6M users) have reach agentplain cannot match yet.
- **Breadth of integrations:** Zapier 8,000+ / n8n any-API beat agentplain's curated vertical connectors on raw count.
- **Self-host / no-lock-in option:** Onyx and n8n offer free, ownable infrastructure; agentplain is a managed service.
- **Auto-execution speed:** For an owner who *wants* the robot to just send it, 11x/Zapier/n8n deliver end-to-end autonomy agentplain deliberately declines — a real loss for the non-regulated, throughput-maximizing buyer.
- **Brand maturity / proof:** Funded, logo-heavy competitors (a16z-backed 11x, Bessemer-backed Relevance, MagicSchool's scale) out-credential an early agentplain.

## Positioning deltas (one sentence per major horizontal)

- **vs 11x:** "11x replaces your SDR with an outbound robot that dials and emails strangers on its own; agentplain is a trusted partner inside your business that drafts and coordinates but never sends without you — the opposite risk profile."
- **vs Lindy:** "Lindy hands you a no-code canvas and a credit meter to build your own assistants; agentplain hands you Plaino and a compliance-aware fleet already doing the work — done-for-you, not do-it-yourself."
- **vs Relevance AI:** "Relevance is an AI-workforce builder for technical revenue teams; agentplain is a vertical, compliance-aware service for the non-technical local-business owner who will never wire up a multi-agent orchestration."
- **vs Zapier Agents:** "Zapier lets your ops person assemble an autonomous agent across 8,000 apps that acts on its own; agentplain gives a regulated local business a managed fleet that knows its industry's rules and keeps the send button in human hands."
