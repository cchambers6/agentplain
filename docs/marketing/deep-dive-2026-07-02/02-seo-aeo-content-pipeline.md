# SEO / AEO content pipeline — keywords, content types, cadence, answer-engine tactics

**Starting point (do not rebuild):** technical SEO is already strong — programmatic `robots.ts`/`sitemap.ts`, canonicals, JSON-LD in `lib/seo/structured-data.ts`, per-vertical OG images, direct-answer blocks + 44 FAQs (#286), `/compare` + `/glossary` owning the service-partner vocabulary (#289). The gap is **cadence and long-tail depth**, not infrastructure (kaizen retro, investment #1).

**Prerequisite (week 1, engineering):** delete the `/how-it-works` redirect in `next.config.mjs` (audit dept 1, P0 — the page is in the sitemap but 308s to a home anchor, which burns crawl trust), and add `/guarantee` to the sitemap once it's linked.

**The thesis:** our moat in search is **specificity and honesty**. Horizontal AI content is a commodity; grounded, vertical-specific, claim-defensible answer content is not. Every piece is written from the ground-truth docs, passes voice-gate and brand-gate, and makes no claim the runtime can't back.

---

## 1. Target keywords — 20 per focus vertical

Notes on the map: "AEO" marks question-shaped queries where the target is being *the quoted answer* in assistant-style engines, not just a ranking. Volume in this niche is thin and long-tail; we deliberately choose buyable intent over volume. No keyword targets a competitor's brand name outside honest comparison pages.

### Real estate (beachhead)

| # | Keyword | Intent | Asset |
|---|---|---|---|
| 1 | ai assistant for real estate agents alternatives | comparison | DIY vs run-for-you pillar |
| 2 | automate real estate lead follow up without auto-send | how | explainer |
| 3 | real estate lead response time statistics | research | data piece (cited sources only) |
| 4 | fair housing compliant ai drafting | trust | compliance explainer |
| 5 | fair housing penalty first offense amount | AEO | compliance explainer |
| 6 | how do brokers handle inbound lead triage | AEO | workflow page |
| 7 | commission invoice follow up template | tool | template + how-we-do-it |
| 8 | transaction coordinator vs ai drafting | comparison | comparison page |
| 9 | what does a virtual assistant for realtors cost | AEO | vs-assistant comparison |
| 10 | follow up boss alternatives for solo agents | comparison | honest alternatives page |
| 11 | boldtrail vs building it yourself | comparison | DIY vs run-for-you |
| 12 | ai for real estate that a human approves | trust | control-loop explainer |
| 13 | broker owner time audit where hours go | pain | pillar |
| 14 | overnight transaction summary for brokerages | workflow | workflow page |
| 15 | real estate back office automation small brokerage | how | pillar |
| 16 | can ai write mls listing descriptions safely | AEO | compliance explainer |
| 17 | qualifying questions for inbound buyer leads | AEO | template |
| 18 | how much admin time does a realtor spend per deal | AEO | data piece |
| 19 | done for you ai for real estate brokerages | category | vertical landing (exists — strengthen) |
| 20 | real estate team monthly report template | tool | template |

### CPA / accounting firms

| # | Keyword | Intent | Asset |
|---|---|---|---|
| 1 | ai for accounting firms that doesn't send anything | trust | control-loop explainer |
| 2 | client document chase email template cpa | tool | template |
| 3 | month end close checklist small firm | tool | template + workflow |
| 4 | taxdome vs doing it manually | comparison | DIY vs run-for-you |
| 5 | karbon alternatives for solo cpa | comparison | honest alternatives |
| 6 | how do cpa firms follow up on missing documents | AEO | workflow page |
| 7 | circular 230 ai drafting rules | AEO | compliance explainer |
| 8 | preparer penalty 6694 amount | AEO | compliance explainer |
| 9 | quickbooks ar aging automated summary | workflow | workflow page (wired today) |
| 10 | tax season capacity planning small firm | pain | pillar |
| 11 | cpa firm client onboarding letter template | tool | template |
| 12 | how many hours do cpas lose to admin in tax season | AEO | data piece |
| 13 | ai assistant for accountants human review | trust | control-loop explainer |
| 14 | accounting practice management vs doing the work | comparison | positioning piece |
| 15 | client status update email examples accounting | tool | template |
| 16 | done for you ai for cpa firms | category | vertical landing (exists — strengthen) |
| 17 | 14 day trial accounting software card required why | AEO | pricing honesty piece |
| 18 | small cpa firm hiring admin vs automation cost | comparison | vs-assistant math |
| 19 | write up client engagement summary faster | how | workflow page |
| 20 | ar follow up cadence for accounting firms | AEO | workflow page |

### Law firms

| # | Keyword | Intent | Asset |
|---|---|---|---|
| 1 | ai for law firms attorney approves everything | trust | control-loop explainer |
| 2 | law firm intake conflict check process | AEO | workflow page |
| 3 | adverse party check checklist | tool | template |
| 4 | clio alternatives for correspondence drafting | comparison | honest alternatives |
| 5 | mycase vs hiring a practice admin | comparison | DIY vs run-for-you |
| 6 | aba rule 1.6 and ai tools | AEO | compliance explainer |
| 7 | can a law firm use ai without uploading client files | AEO | data-posture explainer |
| 8 | client status update letter template law firm | tool | template |
| 9 | document request follow up email legal | tool | template |
| 10 | how much associate time goes to routine correspondence | AEO | data piece |
| 11 | small law firm admin burden statistics | research | data piece |
| 12 | legal practice management vs drafting help | comparison | positioning piece |
| 13 | intake follow up cadence for law firms | AEO | workflow page |
| 14 | ai drafting with attorney sign off | trust | control-loop explainer |
| 15 | law firm client confidentiality ai vendor questions | AEO | trust checklist |
| 16 | done for you ai for law firms | category | vertical landing (exists — strengthen) |
| 17 | filevine vs small firm reality | comparison | honest alternatives |
| 18 | solo attorney drowning in email what to do | pain | pillar |
| 19 | malpractice risk of auto send legal tools | trust | compliance explainer |
| 20 | 3 attorney firm growth without hiring | pain | pillar |

### Property management

| # | Keyword | Intent | Asset |
|---|---|---|---|
| 1 | late rent notice that is firm but professional | tool | template |
| 2 | owner update email template property management | tool | template |
| 3 | appfolio vs hiring an admin | comparison | DIY vs run-for-you |
| 4 | buildium alternatives for small portfolios | comparison | honest alternatives |
| 5 | doorloop vs doing the correspondence yourself | comparison | DIY vs run-for-you |
| 6 | delinquency follow up cadence rental | AEO | workflow page |
| 7 | fair housing rules for tenant emails | AEO | compliance explainer |
| 8 | how many hours per door does property management take | AEO | data piece |
| 9 | ai for property managers human approval | trust | control-loop explainer |
| 10 | property management admin burden per unit | research | data piece |
| 11 | maintenance request acknowledgment template | tool | template |
| 12 | monthly owner statement cover note examples | tool | template |
| 13 | small property manager scaling without hiring | pain | pillar |
| 14 | tenant communication log best practices | AEO | workflow page |
| 15 | move out notice checklist landlord | tool | template |
| 16 | done for you ai for property managers | category | vertical landing (exists — strengthen) |
| 17 | pm software per unit pricing vs per seat | comparison | pricing piece |
| 18 | rent collection follow up email sequence | tool | template |
| 19 | property manager evening email backlog | pain | pillar |
| 20 | lease renewal reminder cadence | AEO | workflow page |

### General (all local businesses)

| # | Keyword | Intent | Asset |
|---|---|---|---|
| 1 | ai for local business that you approve | trust | control-loop explainer |
| 2 | chatgpt vs a service that runs it for you | comparison | `/compare` (exists — deepen) |
| 3 | hiring an assistant vs ai for small business cost | comparison | `/compare` (exists — deepen) |
| 4 | what is done for you ai | AEO | glossary + pillar |
| 5 | ai that drafts but never sends | category | control-loop explainer |
| 6 | small business email backlog help | pain | pillar |
| 7 | ai with human approval workflow | AEO | explainer |
| 8 | local business admin time statistics | research | data piece |
| 9 | ai service partner meaning | AEO | glossary |
| 10 | how to use ai without it embarrassing your business | pain | compliance/voice piece |
| 11 | ai that remembers your business between sessions | feature | memory explainer (two-bucket rules apply) |
| 12 | connect gmail outlook quickbooks ai drafting | how | integrations page (live truth only) |
| 13 | ai monthly service review what to expect | service | how-we-work explainer |
| 14 | free trial ai service card at signup why | AEO | pricing honesty piece |
| 15 | 14 day money back guarantee ai service | trust | `/guarantee` (exists — link it) |
| 16 | ai agency vs productized service | comparison | `/compare` (exists — deepen) |
| 17 | small business owner 60 hour week admin | pain | pillar |
| 18 | what should never be automated in a small business | AEO | editorial POV |
| 19 | approval queue for ai drafts | category | product explainer |
| 20 | affordable ai for one person business | category | pricing piece |

**The other five verticals** (insurance, mortgage, title & escrow, recruiting, home services, RIA) keep their existing landing pages and FAQs; they enter this pipeline in Q4 unless a design partner shows up in one first. Page-one of the site still names all ten (mission rule) — this map is about where *new* content effort goes.

---

## 2. Content types (the four we produce)

1. **Pillar page** (1 per vertical per quarter, 2,000+ words). The vertical's admin-burden story: where the hours go, what the fleet drafts, what stays human. Internal-links to every workflow page and template in its cluster.
2. **Comparison page** (the `/compare/[alt]` pattern extended per vertical). Always names where the alternative wins first. DIY vs run-for-you is the spine; named-competitor pages follow the rules in `01-competitive-positioning.md`.
3. **How-we-work explainer** (workflow pages). One real workflow per page, told concretely: what the fleet reads, what it drafts, where the human approves. These double as sales collateral. Degraded-mode honesty applies: cadence language ("drafts land in your queue"), never live-magic language.
4. **Per-vertical case-study skeleton** (built now, filled later). The template ships with slots for: partner name + permission status, the workflow, the before-state in the customer's words, the measured saved-time figure (from the product's own ledger, not an estimate), and a pull-quote. **Publication is gated on a permissioned design partner and a real number.** Until then the only production story we tell is our own brokerage dogfooding. Templates + honest "tool" content (checklists, email templates) carry the cluster in the meantime — they earn links without requiring customers.

## 3. Publishing cadence

- **2 pieces per week, sustained** (8–9/month). Realistic for one writer (human or agent) with the gates and ground-truth docs doing quality control. Bursts are explicitly worse than rhythm.
- **Weekly slot A (Tuesday):** real-estate cluster (beachhead — matches the design-partner motion so content and outreach compound).
- **Weekly slot B (Thursday):** rotates CPA → law → PM → general.
- **Pipeline per piece:** brief (keyword + intent + asset type from the map above) → draft against `CREATIVE_PACK_GROUND_TRUTH.md` + the vertical's `content.ts` → voice-gate + brand-gate + claims check → publish → log in the tracker (drafted / gated / published / measured).
- **The 90-day calendar** (`docs/marketing/content-calendar-90-days.md`) becomes the tracker of record with a status column; reviewed in the weekly kaizen loop.

## 4. Answer-engine (AEO) tactics

Answer engines quote pages that answer plainly, cite verifiable facts, and look like they were written by someone accountable. Our honesty posture is an AEO advantage; lean into it.

1. **Direct-answer paragraph first.** Every AEO-marked page opens with a 40–80 word literal answer to the query, before any narrative. (The #286 direct-answer blocks are the pattern; extend it to every new piece.)
2. **Schema on everything.** FAQPage for question clusters, HowTo for workflow pages, Organization + Service sitewide (infrastructure exists in `lib/seo/structured-data.ts`). No aggregateRating or review markup anywhere — we have no reviews and fabricated markup is a Truth Wave violation and a penalty risk.
3. **Citable numbers with sources.** Answer engines prefer pages with concrete, attributed figures. Compliance penalty amounts (HUD, §6694) cited to the authority; our own ROI math cited to the calculator's stated inputs; third-party statistics only with a named source. **A number with no source doesn't ship.**
4. **Credibility signals that are true:** author attribution ("the agentplain team" until the founder bio clears the Conner decision queue), dated pages with honest "last updated" stamps, the About page's what-we-are-not section, the subprocessor-transparent privacy page. No invented authors, no stock-expert personas.
5. **Own the category vocabulary.** `/glossary` already defines the service-partner terms; every new piece links its key terms there. The goal is that "done-for-you AI" and "run-for-you" queries resolve to our definitions.
6. **No AI-tell prose.** Answer engines increasingly de-rank generic AI cadence, and our voice-gate bans it anyway (families A–D, `docs/brand/voice-guidelines-2026-06-19.md`). The de-AI-fied voice is an AEO tactic, not just a brand rule.
7. **Monthly citation check** (part of the measurement cadence in `06-measurement.md`): run the 25 highest-value AEO queries through the major assistants, log whether we're cited, feed misses back into the brief queue.

## 5. What this pipeline never does

- Publish a claim the runtime can't back (live-compliance claims outside `BASELINE_LIVE_VERTICALS`, integration claims beyond email/calendar/QuickBooks/DocuSign/Drive).
- Publish saved-time or customer-count figures without a ledger row or a permission slip behind them.
- Keyword-stuff, spin up doorway pages, or buy links. Thin-niche long-tail rewards depth; we have exactly one domain and its trust is a brand asset.
- Name the model vendor in any piece (subprocessor disclosures on legal pages are the sole exception, and this pipeline doesn't touch those).
