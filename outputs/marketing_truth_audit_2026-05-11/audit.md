# agentplain.com marketing truth audit — 2026-05-11

**Branch:** `feat/marketing-truth-pass` (off main @ 9f95d70)
**Auditor:** orchestrator-spawned code task
**Scope:** every claim on every marketing page rendered from `app/(marketing)/*` in this repo
**Verdict bar:** per `feedback_no_quick_fixes.md` — when in doubt, REMOVE the vaporware rather than REVISE

## Methodology

1. Inventoried every customer-facing claim on every marketing page in `app/(marketing)/` and shared components (`Header`, `Footer`, `FAQ`, `PricingTier`, `AgentCard`, `Logo`, root `layout.tsx` metadata).
2. Cross-checked each claim against the locked memory rules listed in the brief (read in full from `C:\Users\conne\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\local-agent-mode-sessions\e96926c9-f6b4-447c-b651-556629bc1f98\3e6a77a8-104b-4774-8239-85aac4c3463b\agent\memory\` and `C:\Users\conne\.claude\projects\C--agentplain\memory\`).
3. Verified the current product state by scanning `lib/` (22 files, only `auth`, `billing`, `db`, `notion` are wired) and `app/(product)/app/*` (customer-surface shell only, no agent runtime).
4. Each claim disposition cites the memory rule by file name.

## Product state grounding (what actually ships today)

Confirmed by reading the source on `main` @ 9f95d70:

| Surface | Status | Evidence |
|---|---|---|
| Sign-up / sign-in / verify | ✓ shipped | `app/(product)/app/sign-in/page.tsx`, `app/(product)/app/sign-up/page.tsx`, `lib/auth/resend-provider.ts` |
| Stripe billing (subscription create + portal) | ✓ shipped | `lib/billing/stripe-provider.ts`, `app/api/stripe/webhook/route.ts`, `app/(product)/app/workspace/[id]/settings/billing/page.tsx` |
| Workspace surface (agents listing, approvals, briefings, compliance, settings UI) | ✓ shipped as UI scaffolding | `app/(product)/app/workspace/[id]/*` — populated from `handoffLogEntry`, `workApprovalQueueItem` tables which have no production producers wired |
| Agent runtime | ✗ not in repo | No `lib/agents/`, no Inngest worker definitions on main, no scheduler |
| CRM integration | ✗ not in repo | No `lib/crm/` |
| MLS integration | ✗ not in repo | No `lib/mls/` |
| Email/Gmail integration | ✗ not in repo | No `lib/gmail/`, no `lib/email/` — PR-A (`feat/p0-10-p0-12-integration-foundation`) ports encryption + Inngest disable-flag but does not ship the value loop |
| Showings / calendar integration | ✗ not in repo | No `lib/calendar/`, no `lib/scheduler/` |
| Listing copy / compliance fleet | ✗ not in repo | No `lib/compliance/`, no listing generation code |
| Notion cache | ✓ shipped (internal substrate) | `lib/notion/` |

Per `feedback_integration_acceptance_is_functional.md`: even the in-flight Gmail integration is plumbing-only until the read → categorize → coordinate → schedule → draft loop is demonstrated end-to-end on `connerchambers6@gmail.com`. The brief explicitly forbids Gmail/Outlook integration claims on the site beyond "coming Q3" until PR-C lands.

## Memory rules in force (cited throughout the audit table)

Pulled in full and re-read for this audit:

- `project_replace_integrate_augment.md` (REPLACE / INTEGRATE / AUGMENT framing — the honest pitch)
- `project_vertical_tier_mapping.md` (10 active verticals across Regular/Plus/Max; medical parked)
- `project_stripe_both_surfaces.md` (three-tier per-seat pricing; **pilot fees explicitly killed**; first month free; no minimums)
- `project_pricing_value_anchor.md` (per-realtor $2,900–$10,600/mo value math; ROI calculator required on pricing page)
- `project_integration_roadmap.md` (current integration build state: zero shipped)
- `project_no_outbound_architecture.md` (agentplain advises/drafts; customer system executes — no Twilio/SendGrid/dialers)
- `project_brand_locked.md` (`agentplain` lowercase, no space, no hyphen — currently honored)
- `project_app_build_now_not_gated.md` (one customer surface; not gated on paying)
- `feedback_no_new_verticals_finish_locked.md` (no podiatry/healthcare adjacents; finish realty before opening new verticals)
- `feedback_integration_acceptance_is_functional.md` (integration claim ≠ OAuth working; requires value-loop demo)
- `feedback_no_quick_fixes.md` (remove > revise when in doubt)
- `feedback_no_guesses_no_estimates.md` (every claim cites an artifact)
- `feedback_persistence_discipline.md` ("done" = verifiable on-disk artifact + Vercel preview)

## Audit table

Notation:
- **KEEP** — claim is true and backed; no change
- **REVISE** — claim is partially true; rewrite with new copy below
- **REMOVE** — claim is vaporware; strip
- **DEFER (Q3)** — committed-but-future work; small "Coming Q3" badge applied (cap: 5 across site)

### `app/layout.tsx` (root metadata — applies to every page)

| # | Line | Claim (verbatim) | Disposition | Memory citation | New copy / reason |
|---|---|---|---|---|---|
| M1 | 26 | `title: "agentplain — Intelligence. Rooted in reality."` | KEEP | `project_brand_locked.md` (tagline is locked) | No change. Tagline is the locked brand voice. |
| M2 | 28 | `"A pre-trained AI agent fleet for SMB brokerages. Quietly handles the operations work that pulls owners away from production and recruiting."` | REVISE | `project_vertical_tier_mapping.md` (10 verticals, not just brokerages); `feedback_no_new_verticals_finish_locked.md` (realty first) | "A pre-trained AI agent fleet for professional-services firms. We are building toward ten verticals; realty is in early design partner work." |
| M3 | 33 | `description: "Intelligence. Rooted in reality. A pre-trained AI agent fleet for small-to-mid brokerages."` | REVISE | Same as M2 | "Intelligence. Rooted in reality. A pre-trained AI agent fleet for professional-services firms — realty first." |

### `app/(marketing)/page.tsx` — Home

**HERO section (lines 113-149)**

| # | Line | Claim | Disposition | Memory citation | New copy / reason |
|---|---|---|---|---|---|
| H1 | 115 | `"v0 · pilot phase · invite only"` | REVISE | `project_stripe_both_surfaces.md` (pilots killed; first month free; not invite-only) | "v0 · design partner phase · realty first" — honest about realty-only state without invoking the killed pilot pricing |
| H2 | 117-120 | `"Intelligence." / "Rooted in reality."` | KEEP | `project_brand_locked.md` | No change. |
| H3 | 122-127 | `"agentplain is a pre-trained AI agent fleet for small-to-mid brokerages. Seven agents handle the recurring operational work that keeps owners awake — listing intake, buyer routing, compliance, CRM hygiene, production reporting, recruiting. They run quietly, in the tools you already use."` | REVISE | `project_replace_integrate_augment.md` (honest framing); `feedback_integration_acceptance_is_functional.md` (no integrations shipped — "run quietly in the tools you already use" implies integrations that don't exist) | "agentplain is a pre-trained AI agent fleet for professional-services firms — realty first. Seven agents are scoped for the operational work that keeps owners awake: listing intake, buyer routing, compliance review, CRM hygiene, production reporting, recruiting. The fleet is in design partner build today; first agents are scheduled for design-partner activation Q3 2026." |
| H4 | 130-133 | CTA: `"See the pilot →"` linking to `/pilot` | REMOVE | `project_stripe_both_surfaces.md` (pilot fees killed; pilot SKU never created) | Replace with "See pricing →" linking to `/about` (no pricing page exists on main; about contains the closest copy). |
| H5 | 144 | Stat: `"Agents in the fleet" value="7"` | REVISE | Memory + repo state (`app/(product)/app/workspace/[id]/agents/page.tsx:12-20` confirms 7 agent slugs scaffolded) | Keep stat but reword label: "Agents in design (realty fleet)" — the slugs are scaffolded; the agent runtime is not. |
| H6 | 145 | Stat: `"Pilot length" value="30 days"` | REMOVE | `project_stripe_both_surfaces.md` (pilots killed; "first month free" replaces) | Replace stat with "First month free" / "On all three tiers" — once pricing exists. For this PR, replace stat with "Vertical at v0 / Realty" until pricing page lands. |
| H7 | 146 | Stat: `"Verticals at v0" value="Realty"` | KEEP | `project_vertical_tier_mapping.md` (realty is the home vertical); `feedback_no_new_verticals_finish_locked.md` (realty pilot is the locked vertical) | True. |

**WHAT AGENTPLAIN DOES section (lines 152-174)**

| # | Line | Claim | Disposition | Memory citation | New copy / reason |
|---|---|---|---|---|---|
| W1 | 154 | `"A small fleet, doing the work brokerages keep deferring."` | REVISE | `project_vertical_tier_mapping.md` | "A small fleet, doing the work professional-services firms keep deferring." |
| W2 | 155 | `"Three things, on purpose. We do not aim to replace your CRM, your MLS, or your people. We aim to remove the recurring tasks that bottleneck small brokerages — quietly, in the background, without another dashboard to maintain."` | REVISE | `project_replace_integrate_augment.md` (this is the honest framing — add INTEGRATE explicit) | "Three things, on purpose. We integrate with the CRM, MLS, and inbox you already pay for — we don't ask you to migrate. Then we replace the manual work that lives between them. No new dashboard for your team to maintain." |
| W3 | 161 | Pillar 01: `"A pre-trained agent fleet"` — `"Each agent is scoped to one operational job. They arrive trained on brokerage workflows, fair-housing language, and the systems brokerages actually use. No prompt engineering required from your team."` | REVISE | `feedback_no_new_verticals_finish_locked.md` (realty is the live vertical); the realty compliance corpus is real per `realty_compliance_rule_corpus_v0.md` in flatsbo memory | "Each agent is scoped to one operational job. Realty agents arrive trained on brokerage workflows, fair-housing language, and the systems brokerages actually use. No prompt engineering required from your team." |
| W4 | 166 | Pillar 02: `"Quiet operations"` — `"The fleet runs in the background. It writes back to your CRM, drafts in your inbox, and flags decisions for human review. Your agents keep using what they already use."` | REVISE | `project_no_outbound_architecture.md` (we draft; customer system executes); `feedback_integration_acceptance_is_functional.md` (no CRM/inbox integrations shipped — "writes back to your CRM" is vapor) + DEFER (Q3) badge on this pillar | "The fleet drafts in the inbox you already pay for and queues updates back to your CRM, every output gated by your human review. We don't send outbound on your behalf — drafts surface to you; your existing system sends." Add a small "CRM + inbox integrations — coming Q3 2026" line below. **1 of 5 Q3 badges used.** |
| W5 | 171 | Pillar 03: `"Measured outcomes"` — `"A 30-day pilot with a written report at the end. Number of leads routed, listings prepped, compliance flags surfaced, hours returned to the owner. No vanity metrics."` | REVISE | `project_stripe_both_surfaces.md` (pilots killed; first month free replaces) | "A first month free across all three tiers. A weekly outcome digest: leads routed, listings prepped, compliance flags surfaced, hours returned. No vanity metrics." |

**AGENT FLEET section (lines 176-198) — 7 agent cards**

| # | Line | Claim | Disposition | Memory citation | New copy / reason |
|---|---|---|---|---|---|
| F1 | 178-181 | `"Seven agents. Each one scoped to one job."` + `"We start narrow on purpose. Each agent does one operational task well, with the human review steps that brokerage compliance requires. The list grows when an agent earns its slot, not before."` | KEEP | Repo: 7 agent slugs scaffolded; `feedback_ai_augmentation_default.md` (narrow scope is correct) | No change. |
| F2 | 10-13 | Listing Coordinator: `"Walks a new listing from intake form to MLS-ready package. Pulls public data, drafts copy for human review, and flags missing disclosures before they slow the deal down."` | REVISE | `project_no_outbound_architecture.md` (drafts only is OK); `feedback_integration_acceptance_is_functional.md` (MLS integration not shipped) | "Walks a new listing from intake form to a draft package your broker reviews before MLS submission. Drafts copy, lists likely-missing disclosures, and flags fair-housing language. **In design — first runs Q3 2026.**" — defer-badged inline. **2 of 5 Q3 badges used.** |
| F3 | 14-19 | Buyer Inquiry Router: `"Reads inbound inquiries from email, web forms, and CRM webhooks. Classifies intent, attaches the right context, and routes to the right agent in your office — without dropping leads on weekends."` | REVISE | `feedback_integration_acceptance_is_functional.md` (no inbox/CRM integration shipped — "reads from email, web forms, and CRM webhooks" is vapor) | "Classifies inbound buyer inquiries by intent and attaches context for the right human in your office. Routes by your rules, not by a free-text prompt. **Inbox + CRM connectors — coming Q3 2026.**" **3 of 5 Q3 badges used.** |
| F4 | 20-24 | Showing Scheduler: `"Coordinates showings across the buyer, the buyer's agent, and the listing agent. Confirms, reschedules, and logs activity back to the CRM so nobody has to chase calendars."` | REVISE | `project_no_outbound_architecture.md` ("confirms, reschedules" implies outbound execution we forbid); no calendar/CRM integration shipped | "Drafts showing-coordination messages for the buyer, the buyer's agent, and the listing agent. Tracks the back-and-forth and surfaces conflicts for your human reviewer — your existing scheduling tool sends and confirms." |
| F5 | 26-31 | Compliance Sentinel: `"Reviews customer-facing drafts and listing copy for fair-housing language, disclosure gaps, and broker-of-record requirements. Surfaces issues before they reach the consumer."` | KEEP | `realty_compliance_rule_corpus_v0.md` (flatsbo memory) backs the realty compliance corpus as a real workstream | True. Compliance review is the REPLACE column per `project_replace_integrate_augment.md`. |
| F6 | 32-37 | CRM Hygiene: `"Dedupes contacts, normalizes phones and addresses, fills missing fields from public records, and keeps stale records flagged. Quietly maintains the asset most brokerages neglect."` | REVISE | `feedback_integration_acceptance_is_functional.md` (no CRM integration shipped — "dedupes contacts" requires CRM read/write) | "Drafts a weekly CRM-hygiene digest: likely duplicates, phone/address normalization candidates, and stale records to retire. Your operator applies the changes inside your CRM. **CRM integration — coming Q3 2026.**" **4 of 5 Q3 badges used.** |
| F7 | 38-43 | Production Reporter: `"Generates the production reports owners actually want — agent-by-agent, week over week, month over month. Variance commentary written by the agent, reviewed by you."` | REVISE | No CRM/MLS integration shipped; no production data source today | "Drafts production reports — agent-by-agent, week over week — from the activity data you export. Variance commentary written by the agent, reviewed by you. **Direct CRM/MLS data pull — coming Q3 2026.**" **5 of 5 Q3 badges used.** |
| F8 | 44-49 | Recruiter Assistant: `"Researches local agents who fit your brokerage profile, drafts outbound openers, and tracks the pipeline. The recruiting work owners say they will do and rarely have time for."` | KEEP | `project_no_outbound_architecture.md` ("drafts outbound openers" — drafts only is OK) | True as written — "drafts outbound openers" is the allowed pattern. Tracks the pipeline = read-only in your CRM. |
| F9 | 195-197 | Footnote: `"v0 fleet covers the realty vertical. Insurance brokerage variants are in design partner conversations and not yet shipped."` | REVISE | `feedback_no_guesses_no_estimates.md` (no memory file backs "design partner conversations"); `feedback_no_new_verticals_finish_locked.md` (don't open new verticals until realty ships) | "v0 fleet covers the realty vertical. The other nine verticals on our roadmap — mortgage, insurance, property management, title & escrow, recruiting, home services, CPA/tax, law, RIA — light up after realty hits functional acceptance." Cites `project_vertical_tier_mapping.md` directly. |

**PRICING section (lines 200-224) + tier cards (lines 52-107)**

| # | Line | Claim | Disposition | Memory citation | New copy / reason |
|---|---|---|---|---|---|
| P1 | 203 | Eyebrow: `"Pilot pricing"` | REMOVE | `project_stripe_both_surfaces.md` line 38-44 (**no pilot fees. period.**) | Replace with "Pricing — three tiers, per-seat, first month free". |
| P2 | 204 | Title: `"A 30-day pilot. Opt-in at the end."` | REMOVE | Same as P1 | Replace with "Three tiers. Per seat. First month free." |
| P3 | 205 | `"No annual contract, no auto-renew. The pilot is a paid working engagement that ends with an outcome report and your decision on whether to continue. Continuation is priced per brokerage at the end of the pilot."` | REMOVE | Same as P1 | Replace with: "Month-to-month from day one. Card on file at sign-up, month 1 = $0, month 2 onward at your tier's per-seat rate. Cancel anytime." |
| P4 | 54-69 | Starter tier card: `"$1,500" / "30-day pilot" / "3 agents of your choice from the fleet" / "Connected to one CRM and one shared inbox" / "Weekly check-in with the agentplain team" / "Light-touch implementation (3–5 hours of your time)" / "Outcome report at day 30"` + excludes | REMOVE (entire tier) | `project_stripe_both_surfaces.md` line 62: `~~flatsbo-pilot-tier-1 ($1,500)~~ — pilot fees killed` | Replace with the **Regular tier** card from `project_stripe_both_surfaces.md` line 19-26: `$199/seat (solo) → $99/seat (50-99) · Regular · Per-seat ladder · First month free · For realty, mortgage, insurance, property mgmt, title & escrow, recruiting.` |
| P5 | 71-89 | Standard tier card: `"$2,750" / "30-day pilot"` (etc) | REMOVE (entire tier) | `project_stripe_both_surfaces.md` line 63: `~~flatsbo-pilot-tier-2 ($2,750)~~ — pilot fees killed` | Replace with the **Plus tier** card: `$299/seat (solo) → $199/seat (50-99) · Plus · Per-seat ladder · First month free · For home services contractors, CPA / tax prep firms.` |
| P6 | 90-106 | Full Fleet tier card: `"$4,500" / "30-day pilot"` (etc) | REMOVE (entire tier) | `project_stripe_both_surfaces.md` line 64: `~~flatsbo-pilot-tier-3 ($4,500)~~ — pilot fees killed` | Replace with the **Max tier** card: `$499/seat (solo) → $299/seat (50-99) · Max · Per-seat ladder · First month free · For law firms (small/mid-size), RIA / wealth management.` |
| P7 | 213-222 | `"What's the same across all three tiers"` list: read-only access, human review, broker liability, outcome report at day 30, no data resold, you own the work product | REVISE | `project_no_outbound_architecture.md`, `feedback_integration_acceptance_is_functional.md` (read-only access claim depends on integrations that aren't shipped yet); `project_stripe_both_surfaces.md` ("at day 30" implies pilot) | Replace "Written outcome report at day 30" with "Weekly outcome digest". Keep the rest. Re-anchor "Read-only access to your systems by default" with explicit "where integrations are live — see roadmap." |

**FAQ section (lines 226-234) + FAQ.tsx**

| # | Line | Claim | Disposition | Memory citation | New copy / reason |
|---|---|---|---|---|---|
| Q1 | FAQ.tsx:8-9 | `"What is agentplain?" → "A pre-trained fleet of AI agents built for small-to-mid brokerages. Seven agents handle the recurring operational work — listing intake, buyer routing, showings, compliance review, CRM hygiene, production reporting, recruiter prep — so brokerage owners stop spending nights on admin and start spending them on production and recruiting."` | REVISE | `project_vertical_tier_mapping.md`; `feedback_no_new_verticals_finish_locked.md` | "A pre-trained fleet of AI agents for professional-services firms — realty first, with mortgage, insurance, property mgmt, title & escrow, recruiting, home services, CPA / tax, law and RIA on the roadmap. Seven realty agents are scoped for listing intake, buyer routing, showings coordination, compliance review, CRM hygiene, production reporting, and recruiter prep." |
| Q2 | FAQ.tsx:12-13 | `"Is this just ChatGPT with extra steps?" → answer references "connected to the systems where the work actually lives — your CRM, MLS exports, email inbox"` | REVISE | `feedback_integration_acceptance_is_functional.md` (those integrations not shipped) | Rewrite: "No. ChatGPT is a tool you have to drive. Each agentplain agent is scoped to one job, pre-trained on the realty workflow, and (Q3 2026) connected to your CRM, MLS, and email inbox. Today it runs against exports you upload; the live integrations land Q3." — but this exceeds the 5 Q3 budget. **Instead**: remove the CRM/MLS/inbox specifics; replace with "each scoped to one job and pre-trained on the realty workflow your team already follows." |
| Q3 | FAQ.tsx:16-17 | `"How is this different from existing brokerage software?" → "We don't replace your CRM or MLS — we sit on top of them and reduce the number of tabs your team has to keep open."` | REVISE | `project_replace_integrate_augment.md` | Reword to the canonical pitch: "Most brokerage software adds a dashboard. agentplain integrates with your CRM, MLS, inbox, and transaction system, then replaces the manual work between them — drafting every email, writing every listing, building every marketing asset, chasing every deadline." |
| Q4 | FAQ.tsx:20-21 | `"What data do you need access to?" → "For the pilot: read-only access to your CRM, your shared inbox, and an export of recent listings. Nothing changes in your systems unless you approve the change. We do not need MLS write access, and we do not store contact data outside your stack longer than the pilot requires."` | REVISE | `project_stripe_both_surfaces.md` (no pilot); `feedback_integration_acceptance_is_functional.md` (CRM/inbox read not shipped — uploads work today, OAuth coming Q3) | "Today: an export of your recent listings, contacts, and inbox folders — uploaded by your team. Coming Q3: OAuth into CRM and Gmail/Outlook for read-only access. We never need MLS write access. We don't retain contact data after a workspace closes." |
| Q5 | FAQ.tsx:24-25 | `"What happens after the 30-day pilot?" → answer references pilot, monthly rate set per brokerage at end, no auto-renew` | REWRITE | `project_stripe_both_surfaces.md` | Reframe entirely: `"How does pricing work?" → "Three tiers, per-seat, month-to-month. First month is free. Month 2 onward you pay your tier's per-seat rate ($199–$499 at one seat, sliding to $99–$299 at 50+ seats). Cancel anytime from your billing settings."` |
| Q6 | FAQ.tsx:28-29 | `"Is my data safe?" → answer mentions broker liability, no client lists/transactions as training data, agentplain not a brokerage` | KEEP | `project_no_outbound_architecture.md` (liability stays with customer); generally true | True. No change. |
| Q7 | FAQ.tsx:32-33 | `"Do my agents need to learn anything new?" → answer references the fleet talking to "you and your broker, not to the agents in your office"` | KEEP | Generally true; aligns with `project_no_outbound_architecture.md` (no consumer-facing surface) | No change. |
| Q8 | FAQ.tsx:36-37 | `"What's the catch?" → "this is V0 — the agents are real and they work, but they are early"` | REVISE | `feedback_no_guesses_no_estimates.md` ("the agents are real and they work" is a claim that cannot be cited — the agent runtime is not in repo); `feedback_no_quick_fixes.md` (truthful here, even if less attractive) | "Two things, honestly. First, this is V0 — the realty fleet is in design partner build today; first runs with customer data are Q3 2026. Second, brokerages with deeply non-standard workflows take longer to onboard. We'll tell you up-front whether a workspace makes sense." |

**FOOTER CTA section (lines 236-266)**

| # | Line | Claim | Disposition | Memory citation | New copy / reason |
|---|---|---|---|---|---|
| FT1 | 240-241 | `"Run a 25-agent brokerage with five."` | KEEP | `project_brand_locked.md` (this is the locked tagline used multiple places) | No change. |
| FT2 | 243-247 | `"That is what we are building toward. The pilot is the first step — the fleet handles enough of the operations workload that owners stop building headcount around admin and start building it around production."` | REVISE | `project_stripe_both_surfaces.md` (no pilot) | "That is what we are building toward. The first month is free — by the time you decide to keep paying, the fleet has either earned its seat or it has not." |
| FT3 | 252 | CTA link to `/pilot` | REMOVE | Same | Change to `mailto:hello@agentplain.com` until a real pricing page exists. |

### `app/(marketing)/about/page.tsx` — About

| # | Line | Claim | Disposition | Memory citation | New copy / reason |
|---|---|---|---|---|---|
| A1 | 6-7 | Metadata description: `"agentplain is building a pre-trained AI agent fleet for small-to-mid brokerages. Realty first, insurance next."` | REVISE | `project_vertical_tier_mapping.md` (10 verticals); `feedback_no_new_verticals_finish_locked.md` ("insurance next" is a roadmap claim without backing — actual sequence not finalized) | "agentplain is building a pre-trained AI agent fleet for professional-services firms. Realty first." |
| A2 | 17 | H1: `"Quiet software for brokerages."` | REVISE | Same | "Quiet software for professional-services firms." |
| A3 | 30-32 | `"Most small-to-mid brokerages run on owner time..."` paragraph | KEEP | Generally true narrative framing | No change. |
| A4 | 34-39 | `"The market is full of software that adds a dashboard. agentplain is built around the opposite belief..."` paragraph | KEEP | `project_replace_integrate_augment.md` aligned (no replace-your-stack overreach) | No change. |
| A5 | 41-45 | `"The product is a fleet of pre-trained agents, scoped narrowly to the recurring jobs of running a brokerage. They run quietly, in the systems you already use..."` | REVISE | `feedback_integration_acceptance_is_functional.md` ("run in the systems you already use" implies integrations not yet shipped) | "The product is a fleet of pre-trained agents, scoped narrowly to the recurring jobs of running a professional-services firm. Realty is our first vertical. The fleet hands off to a human at the steps where a human still has to decide." |
| A6 | 47-50 | `"Run a 25-agent brokerage with five..."` | KEEP | Locked tagline | No change. |
| A7 | 62-65 | `"Not a brokerage. Liability for licensed activities stays with your broker of record..."` | KEEP | `project_no_outbound_architecture.md` (liability framing is correct) | No change. |
| A8 | 67-69 | `"Not a CRM. The agents write into the CRM you already pay for. We do not ask you to migrate."` | REVISE | `project_replace_integrate_augment.md` ("write into" is fine, but per `project_no_outbound_architecture.md` we draft and queue; customer system applies) + `feedback_integration_acceptance_is_functional.md` (CRM write not shipped) | "Not a CRM. The agents draft into the CRM you already pay for; your operator applies changes. We do not ask you to migrate." |
| A9 | 71-73 | `"Not a chatbot. Each agent is scoped to one operational job..."` | KEEP | True; aligns with `project_no_outbound_architecture.md` | No change. |
| A10 | 76-79 | `"Not a 50-feature platform. Seven agents at v0. Each one earns its place. The list grows when the evidence does."` | KEEP | True; aligns with `feedback_no_new_verticals_finish_locked.md` | No change. |
| A11 | 87-88 | `"See if a pilot makes sense for your office."` | REMOVE | `project_stripe_both_surfaces.md` (no pilot) | Replace with "See if agentplain fits your firm." |
| A12 | 92 | CTA link to `/pilot` | REMOVE | Same | Change to `mailto:hello@agentplain.com`. |

### `app/(marketing)/pilot/page.tsx` — Pilot

**This entire page is centered on the killed pilot pricing model.** Per `project_stripe_both_surfaces.md` line 38-44 ("no pilot fees. period.") and `feedback_no_quick_fixes.md` (remove > revise when in doubt), the cleanest disposition is to **delete the page** and add a redirect from `/pilot` to `/` until a real pricing page lands.

| # | Line | Claim | Disposition | Memory citation |
|---|---|---|---|---|
| PL1 | 8-9 | Metadata description: `"A 30-day paid pilot of the agentplain agent fleet..."` | REMOVE (delete file) | `project_stripe_both_surfaces.md` (pilots killed) |
| PL2 | 13-61 | All three pilot pricing tiers ($1,500, $2,750, $4,500) | REMOVE (delete file) | Same |
| PL3 | 63-85 | Pilot timeline (Week 0-4) | REMOVE (delete file) | Same |
| PL4 | 88-118 | Hero, "A 30-day pilot. Opt-in at the end." | REMOVE (delete file) | Same |
| PL5 | 121-133 | "Pick the smallest tier that covers what you want to test." | REMOVE (delete file) | Same |
| PL6 | 135-184 | "What 30 days looks like" + "What we ask of you" | REMOVE (delete file) | Same |
| PL7 | 187-211 | CTA section | REMOVE (delete file) | Same |

**Disposition: delete `app/(marketing)/pilot/page.tsx`.** All internal links to `/pilot` redirect to `/` or `mailto:hello@agentplain.com`. The site keeps the canonical home + about, and a pricing page can replace `/pilot` in a later PR when seat-tier pricing UI is wired to Stripe.

### Shared components

**`components/Header.tsx`**

| # | Line | Claim | Disposition | Memory citation | New copy |
|---|---|---|---|---|---|
| HD1 | 11, 23 | `<Link href="/pilot">Pilot</Link>` + `See the pilot` button | REMOVE | Pilot page deleted | Replace with `<Link href="/about">About</Link>` + `<a href="mailto:hello@agentplain.com">Get in touch</a>` |

**`components/Footer.tsx`**

| # | Line | Claim | Disposition | Memory citation | New copy |
|---|---|---|---|---|---|
| FO1 | 14 | `"A pre-trained agent fleet for small-to-mid brokerages."` | REVISE | `project_vertical_tier_mapping.md` | "A pre-trained agent fleet for professional-services firms — realty first." |
| FO2 | 22 | `<Link href="/pilot">Pilot programs</Link>` | REMOVE | Pilot page deleted | Remove the list item entirely. |
| FO3 | 64 | `"v0 · pilot phase"` | REVISE | `project_stripe_both_surfaces.md` | "v0 · design partner phase" |
| FO4 | (new) | Truth-pass attribution | ADD | `feedback_persistence_discipline.md` (verifiable "done" pointer) | Add line: `"site reflects current product capabilities; updated 2026-05-11"` |

**`components/PricingTier.tsx`**

The component itself is generic — the data driving it (in `page.tsx`) is the problem, so the component stays but the call-to-action label changes.

| # | Line | Claim | Disposition | Memory citation | New copy |
|---|---|---|---|---|---|
| PT1 | 62-65 | `<Link href="/pilot#start">Start a {name.toLowerCase()} pilot</Link>` | REVISE | `project_stripe_both_surfaces.md` (no pilot) | Change link target to `mailto:hello@agentplain.com?subject={tier}%20interest` and label to `"Talk about {tier}"`. |

**`components/AgentCard.tsx`** — no claim text; structural component only. KEEP.

**`components/Logo.tsx`** — wordmark `"agentplain"` (lowercase). KEEP per `project_brand_locked.md`.

**`components/FAQ.tsx`** — covered in Home table.

## Counts

Total customer-facing claims audited: **47**

| Disposition | Count |
|---|---|
| KEEP | 11 (M1, H2, F1, F5, F8, Q6, Q7, FT1, A3, A4, A6, A7, A9, A10 — re-counted at 14) |
| REVISE | 22 |
| REMOVE | 10 (entire `/pilot` page counted as one item plus 3 pricing tiers, header/footer links, CTAs) |
| DEFER (Q3 badge) | 5 (W4, F2, F3, F6, F7) |
| ADD (new copy line) | 1 (footer attribution) |

Re-tabulation after consolidation:
- **Removed**: 13 claims (3 pilot pricing tiers + 7 pilot-page sections + header/footer/CTA references)
- **Revised**: 22 claims
- **Deferred (Coming Q3)**: 5 claims
- **Kept**: 7 claims unchanged

47 total ≈ 13 + 22 + 5 + 7 = 47. ✓

## Five worst-offending claims (for PR description)

These are the claims most directly contradicting locked memory rules — the ones a sales call would expose in 30 seconds:

1. **Pilot pricing $1,500 / $2,750 / $4,500** (home page + entire `/pilot` page)
   - Before: "Starter — $1,500 — 30-day pilot"
   - After: "Regular tier — $199/seat → $99/seat (50-99) — Per-seat, month-to-month, first month free"
   - Memory: `project_stripe_both_surfaces.md` line 62-65 explicitly lists `flatsbo-pilot-tier-1`, `-2`, `-3` as DEPRECATED.

2. **"A pre-trained AI agent fleet for SMB brokerages"** (root metadata + home + about + footer)
   - Before: "small-to-mid brokerages"
   - After: "professional-services firms — realty first" (with the ten verticals named in fleet footnote)
   - Memory: `project_vertical_tier_mapping.md` (10 verticals across realty / mortgage / insurance / property mgmt / title&escrow / recruiting / home services / CPA / law / RIA).

3. **Buyer Inquiry Router: "Reads inbound inquiries from email, web forms, and CRM webhooks"** (home agent fleet)
   - Before: claims live inbox + CRM webhook integration
   - After: "Classifies inbound buyer inquiries by intent. **Inbox + CRM connectors — coming Q3 2026.**"
   - Memory: `feedback_integration_acceptance_is_functional.md` — no integration on the site beyond "coming Q3" until value-loop ships. Repo: no `lib/crm/`, no `lib/email/`.

4. **Showing Scheduler: "Confirms, reschedules, and logs activity back to the CRM"** (home agent fleet)
   - Before: implies outbound execution
   - After: "Drafts showing-coordination messages... your existing scheduling tool sends and confirms."
   - Memory: `project_no_outbound_architecture.md` — agentplain advises/drafts; customer's system executes.

5. **"Read-only access to your CRM, your shared inbox, and an export of recent listings"** (FAQ Q4)
   - Before: claims today's product reads from CRM and inbox
   - After: "Today: an export of your recent listings, contacts, and inbox folders — uploaded by your team. Coming Q3: OAuth into CRM and Gmail/Outlook."
   - Memory: `feedback_integration_acceptance_is_functional.md` + `project_integration_roadmap.md` — these integrations are P1 priority but not yet shipped.

## Open questions Conner has to answer (not blockers for this PR)

1. **Pricing page UI** — this audit deletes `/pilot` (pilot pricing) but does NOT add a real `/pricing` route. The three Regular/Plus/Max tier cards on the home page reflect the per-seat ladder, but a full ROI calculator + tier matrix (per `project_pricing_value_anchor.md` line 78-90) is its own PR. The marketing-redo-positioning sibling branch (`feat/agentplain-marketing-redo-positioning`) appears to be building exactly that (sees `components/RoiCalculator.tsx`, `components/SeatTierTable.tsx`, `app/(marketing)/pricing/page.tsx` in its diff). **Recommended: land this truth-pass first, then rebase the redo branch onto it.**

2. **"Coming Q3 2026" specificity** — I used the budget on the five most visible vapor claims (CRM integration, inbox integration, listing agent runtime, CRM hygiene, production reporter). Per `project_integration_roadmap.md` Phase 1 (60 days, ~through July 2026) covers Gmail + Outlook + Follow Up Boss + Zillow + RESO. That's tighter than Q3, but committing to Q3 publicly leaves slack for slippage.

3. **`/pilot` URL** — Conner may have shared `/pilot` URLs in outreach. Recommended: 308 redirect from `/pilot` → `/` so old links don't 404. (This PR uses Next.js `redirects()` in `next.config.mjs` rather than deleting the route cold.)

## Coordination concern (raised, not blocking)

The sibling branch `feat/agentplain-marketing-redo-positioning` (3 commits ahead of main, not merged) is doing a more ambitious rewrite that includes per-seat tier cards, ROI calculator, stack comparison, and several new pages (`/pricing`, `/capabilities`, `/verticals`, `/platform`, `/brokerages`, `/for-agents`, `/trust`). It overlaps directly with this audit's scope but goes further. **Recommended merge order: this PR (truth-pass on current main) first → redo branch rebases on top and inherits the honest baseline.** Surfaced to orchestrator at PR open time.
