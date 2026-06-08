# Fleet Pride Audit — every agent, every skill

**Date:** 2026-06-07 · **Scope:** 121 agentplain + flatsbo skills/agents (98 agent `SKILL.md` files + 23 executable `lib/skills/` customer skills) · **Method:** one Haiku/Sonnet sub-agent per skill read its own definition + code and answered, in its own voice — *what do I actually deliver today, am I proud (1–5), and what would make me revolutionary for an SMB owner.* Bar set by Conner: *"Would an SMB owner with a $10K/mo problem say 'holy shit, I can't get this anywhere else'?"*

> Third-party marketplace plugins (Zoom, Twilio, Sanity, Figma, the 200+ installed skills) are **out of scope** — "the fleet" means the agents we built.

---

## TL;DR (read this part)

**The fleet is not yet a product an SMB owner could be revolutionized by. It is an exceptionally well-built skeleton waiting for its arteries.**

- **Median pride score: 1 / 5. Mean: 1.49.** Zero skills scored 4 or 5. Only **6 of 121** reached a 3.
- **90 of 121 (74%) self-classified as scaffolding** — they do not run against real customer data. They are charters, prompt definitions, and well-typed seams that default to mock or empty when fired.
- The split is the whole story: **customer-facing skills median 2** (architected, partially alive), **internal/build agents median 1** (mostly org-chart charters that have never fired a cron).
- **The single dominant gap, named by 42 of 121 agents in near-identical words: "the port exists, the adapter does not."** We built the right abstractions everywhere — `PolicyLookup`, `RentRollLookup`, `LoanFileLookup`, `ClosingFileFetcher`, `DraftPersister`, `IResearchSubstratePort` — and wired almost none of them to a real system. Only QuickBooks (invoice-chasing) runs live REST today.

**The honest read:** we have not been building a product. We have been building the *shape* of a product and an org chart of agents to staff it. The architecture is genuinely good (portable, swappable, cold-start-safe — exactly the north star). But an SMB owner can't buy architecture. **The revolutionary value is one layer away — and that layer is integration adapters, not new features.**

**What turns this around is not 121 improvements. It is ~8 adapters and a cron switch.** Wire the real data in behind the ports we already have, and a dozen score-2 skills become the genuinely-can't-get-this-anywhere product Conner is describing. That is the entire thrust of the ratification list below.

---

## Pride scores by discipline

| Discipline | n | Median | Mean | Scaffolding | Histogram 1·2·3·4·5 |
|---|---|---|---|---|---|
| **Customer** | 34 | **2** | 1.94 | 17/34 | 7 · 22 · 5 · 0 · 0 |
| **Legal** | 3 | 2 | 1.67 | 2/3 | 1 · 2 · 0 · 0 · 0 |
| **Knowledge** | 3 | 2 | 1.67 | 3/3 | 1 · 2 · 0 · 0 · 0 |
| **Marketing** | 4 | 1.5 | 1.50 | 3/4 | 2 · 2 · 0 · 0 · 0 |
| **Creative** | 7 | 1 | 1.43 | 6/7 | 4 · 3 · 0 · 0 · 0 |
| **Engineering** | 31 | 1 | 1.45 | 22/31 | 18 · 12 · 1 · 0 · 0 |
| **Sales** | 8 | 1 | 1.25 | 8/8 | 6 · 2 · 0 · 0 · 0 |
| **BizMgr** | 10 | 1 | 1.20 | 8/10 | 8 · 2 · 0 · 0 · 0 |
| **Finance** | 1 | 1 | 1.00 | 1/1 | 1 · 0 · 0 · 0 · 0 |
| **Insights** | 7 | 1 | 1.00 | 7/7 | 7 · 0 · 0 · 0 · 0 |
| **Media** | 13 | 1 | 1.00 | 13/13 | 13 · 0 · 0 · 0 · 0 |
| **FLEET** | **121** | **1** | **1.49** | **90/121** | **68 · 47 · 6 · 0 · 0** |

**Three lines per discipline:**

- **Customer (best of the fleet, still only median 2):** This is the actual product. The skills are vertical-aware and well-tested in the abstract — invoice-chasing knows a title company from a cooperating broker; lead-triage, month-end-close, mortgage-chase, COI-request all have real drafting logic. *Every one of them is starved of live data.* They draft against JSON imports or empty fetchers, so the owner sees a demo, not their business.
- **Legal / Knowledge:** Compliance, contracts, attorney-firstpass, market-research, listing-coordinator have genuine domain logic and the compliance corpus is real. They flag and draft but don't *act* — they stop one step short of staging the fix into the owner's workflow.
- **Engineering (31 agents, median 1):** Overwhelmingly area-owner and pod charters (`flatsbo-area-*`, `b2b-eng-*`) describing a role rather than doing work. The B2B eng pod has zero shipped code. These are the most honest 1s in the audit.
- **Sales / BizMgr / Finance:** Internal operator agents — CEOs, directors, sales reps, finance. They produce memos for Conner, not artifacts for customers, and most have never fired their cron. Useful as scaffolding for *running the business*; not product.
- **Insights / Media (n=20, every single one a 1):** Pure org chart. 13 media platform specialists + 7 insights analysts, all charters, none operational, none customer-facing. This is the clearest "we modeled a department before we needed it" signal in the fleet.

---

## Top 20 improvement themes (ranked by agents asking × customer impact ÷ effort)

🟥 = **revolutionary** (creates capability no other SMB tool has) · 🟧 = high-impact enabler · 🟨 = hygiene/activation

| # | Theme | Agents | Tag |
|---|---|---|---|
| 1 | **Wire the real integration adapters behind the existing ports** (FUB, EZLynx/HawkSoft, Encompass/LendingPad, AppFolio/Buildium, SoftPro/Qualia, dotloop/Skyslope). The ports exist; the adapters don't. | 42 | 🟥 |
| 2 | **Ingest real customer data** — QuickBooks AR, MLS comps, CRM stage, site traffic — so skills act on the owner's business, not a fixture. | 45 | 🟥 |
| 3 | **Wire real inbox (Gmail / M365)** into inbox-triage + chief-of-staff so drafts fire on actual email instead of defaulting empty. | 36 | 🟧 |
| 4 | **Activate dormant agents** — most internal agents are charters with no cron; flip the daily-loop switch and make them fire. | 83* | 🟨 |
| 5 | **Auto-execute bounded actions without owner approval** under a $-threshold (book the call, push the draft, cancel the trial, send the reminder). | 13 | 🟥 |
| 6 | **Per-message LLM classification** replacing 15-cue keyword classifiers (inbox-triage, lead-triage urgency). | 26 | 🟧 |
| 7 | **One-click action embedded in the briefing/approval card** — turn the daily briefing from a backward-looking read into a do-it-now surface. | 31 | 🟧 |
| 8 | **Draft publish-ready artifacts, not outlines** — full email bodies, captions, redline clauses, replacement sentences — staged for one-tap send. | ~20 | 🟧 |
| 9 | **Compliance rewrite-and-stage** — when the sweep flags a violation, draft the compliant replacement sentence in place, not just a flag. | 5 | 🟥 |
| 10 | **Auto-push first-touch drafts to Gmail Drafts** for hot/warm leads (remove hardcoded `persister:null`). | 4 | 🟧 |
| 11 | **Real web-search grounding** (BrightData/Tavily) behind `IResearchSubstratePort` so research briefs cite live sources. | 3 | 🟧 |
| 12 | **GmailCloseFetcher** — auto-detect month-end docs from client email attachments instead of an empty QuickBooks fetcher. | 2 | 🟧 |
| 13 | **Confidence-scored price-adjustment drafts** with real MLS pulls for stalled listings, auto-sent under threshold. | 2 | 🟥 |
| 14 | **Counsel-feedback redline loop** — learn from 5+ counsel red-lines and embed alternative clause language in future contracts. | 1 | 🟥 |
| 15 | **Pre-call brief cron** — auto-generate a 5-bullet personalized brief 30 min before every sales call. | 1 | 🟧 |
| 16 | **Land the creative-asset backend (PR #168)** — job matrix, CreatorBrief store, operator UI to production. | 3 | 🟨 |
| 17 | **Ship the first 3 brokerage dashboard surfaces** (Inbox / Activity / Agents) with a11y + responsive gates — give B2B customers visibility. | 2 | 🟨 |
| 18 | **Real competitive-signal feed** for vertical heads instead of quarterly watch memos. | 2 | 🟨 |
| 19 | **Schema-drift auto-heal** in pre-push (parse + patch baseline) to kill the `HUSKY=0` jailbreak. | 1 | 🟨 |
| 20 | **Field the seller ICP survey + interview guide (n=10)** so product decisions rest on evidence, not intuition. | 1 | 🟨 |

\* The "83" for theme #4 counts every YAML mentioning *cron/activate/daily-loop*; it overlaps the others. It's an enabler, not a feature — activation only matters once #1–#3 give the agents real data to act on.

**The pattern across all 20: almost nothing here is "build a new capability." It is "connect the capability we already built to the real world."** That is the cheapest possible path to revolutionary — and the reason the median is a 1 today.

---

## 10 ratification candidates (file to capability_inbox)

Ranked for leverage: each is concrete, cites a real port/file, and converts ≥1 score-2 skill into something an SMB owner genuinely can't get elsewhere. **The first is the keystone — it alone lifts most of the Customer discipline.**

1. **🟥 KEYSTONE — Wire the real vertical adapters behind existing ports.** Today only QuickBooks runs live (`lib/integrations/quickbooks-mcp/server.ts`). Wire **Follow Up Boss** (invoice-chasing, lead-triage), **EZLynx/HawkSoft** (insurance-COI behind `PolicyLookup`), **Encompass/LendingPad** (mortgage-chase behind `LoanFileLookup`), **AppFolio/Buildium** (rent-collection behind `RentRollLookup`), **SoftPro/Qualia** (title-escrow behind `ClosingFileFetcher`), **dotloop/Skyslope** (listing-coordinator). *Impact:* the entire Customer layer stops drafting against fixtures and starts acting on the owner's actual business. *Effort:* M per adapter, but they share the MCP/OAuth seam — sequence them, don't fan out.
2. **🟥 Bounded auto-execute under a $-threshold** (office-admin). Confirm email verification, complete a password reset, one-tap cancel a trial via browser agent — for pre-approved action classes below a dollar/risk line. *This is the autonomy leap from "drafts work" to "does work."* No competitor lets an SMB owner safely delegate the boring 80%. *Effort:* M.
3. **🟧 Real inbox into chief-of-staff-scheduler + inbox-triage** (Gmail/M365 behind the fetcher seam). Two arms currently default to empty. *Impact:* the daily briefing becomes real. *Effort:* M (auth exists).
4. **🟧 Per-message LLM classification** (inbox-triage). Replace the 15-cue keyword classifier with the existing `LlmProvider` seam unconditionally. *Impact:* urgency/intent detection an owner trusts. *Effort:* S.
5. **🟧 Auto-push first-touch drafts to Gmail Drafts** for hot/warm leads (lead-triage; remove `persister:null` in `run-for-event.ts`). *Impact:* the owner wakes up to ready-to-send replies. *Effort:* S.
6. **🟥 Compliance rewrite-and-stage** (compliance-watch-general). On a flagged match, draft the compliant replacement sentence in place. *Impact:* turns a liability alert into a fix — no SMB compliance tool does this. *Effort:* M.
7. **🟧 GmailCloseFetcher for month-end-close** — auto-detect received docs from client email attachments so the close stops returning empty. *Impact:* the CPA's most painful week runs itself. *Effort:* M.
8. **🟧 Real web-search grounding** (research-on-demand behind `IResearchSubstratePort`, BrightData/Tavily). *Impact:* briefs cite live sources instead of model memory. *Effort:* S–M.
9. **🟧 One-click action in the briefing card** (briefing-generator). Pre-stage the top pending approval as a one-tap action inside the daily card. *Impact:* briefing becomes a control surface, not a report. *Effort:* S.
10. **🟧 Daily pre-call brief cron** (b2b-sales-rep). Auto-generate a 5-bullet personalized brief 30 min before each intro call. *Impact:* every call starts prepared without operator effort. *Effort:* S.

**If only three land:** #1 (keystone adapters), #2 (bounded auto-execute), #6 (compliance rewrite-and-stage). Those three are the ones that earn the word *revolutionary*.

---

## What this audit says about the business

Conner asked whether this is a product the fleet is proud of. **Honestly: not yet — and the fleet said so itself, 90 times.** But the reason is the opposite of demoralizing. We did not build junk. We built the hard part — a portable, well-typed, cold-start-safe agent architecture with the right seams in the right places — and then stopped at the seam instead of crossing it. The work to become revolutionary is unusually concentrated: a handful of adapters and the courage to let agents *act* under a threshold. The org-chart agents (Media, Insights, internal directors) can wait; they're modeling departments we don't staff yet and they dilute the median. **Cut the audit's attention to the Customer layer, wire the data, and ship bounded autonomy — that's the whole game.**

---

## Appendix — per-skill reflections

All 120 per-skill YAML reflections (one agent had a write collision) live under:
`~/.claude/projects/C--agentplain/memory/fleet_pride_audit/<Discipline>/<skill>.yml`

Each contains the agent's own-voice `delivers`, `proof_files`, `pride_rationale`, and three `improvements` with `customer_impact` + `effort_estimate`. Full canonical report: `~/.claude/projects/C--agentplain/memory/fleet_pride_audit_2026_06_07.md`.
