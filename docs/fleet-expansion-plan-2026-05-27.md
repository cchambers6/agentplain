# Premium fleet expansion plan — 2026-05-27

**Author.** `b2b-eng-tech-lead` (this doc) acting on Conner's directive of 2026-05-27.
**Status.** DRAFT — awaiting Conner sign-off. Doc-only. No feature code. No site copy. Strand 3 builds against this plan once approved.

**Anchors.**

- Baseline audit — `docs/agent-interviews/00-MASTER.md` (PR #103/#104/#105/#106/#107 — synthesis of the four `docs/agent-interviews-*` and `docs/fleet-roster-*` branches). Headline truth at audit close: **1** customer-data-firing agent (`office-admin`), 15 demo-only runtime skills, 7 charter-only realty ICs, 8 staged-not-installed vertical heads, 13 silent org/eng/insights agents, 9 active connectors in the marketplace catalog (Gmail, Outlook, Teams, OneDrive/SharePoint, Excel, DocuSign, Google Drive, Slack, QuickBooks — `lib/integrations/marketplace.ts:71-271`).
- Brand & claims discipline — `docs/brand-and-claims.md` §10 (honesty grading, no overclaim until wired).
- Architecture rails (non-negotiable; this plan does not bend any of them):
  - **No-outbound** — `project_no_outbound_architecture.md`. Agents read/categorize/coordinate/schedule/draft; the customer system executes outbound. No Twilio, SendGrid, dialers, ad-platform `send` scopes.
  - **MCP-first** — every external system enters through a workspace-scoped MCP endpoint at `/api/integrations/<slug>-mcp/{workspaceId}` (`lib/integrations/marketplace.ts:6-9`).
  - **Adapter pattern + no silent vendor lock** — `feedback_runner_portability.md`, `feedback_no_silent_vendor_lock.md`. New provider capability = new adapter behind the interface; two-implementation rule before any UI surface claims it.
  - **Hierarchical approval chain** — every draft and queued outbound surfaces in `WorkApprovalQueueItem` for the operator's review.
  - **Service-partnership positioning** — Plaino is the named service partner (`project_plaino_named_agent.md`); every new agent inherits the same voice, not its own brand.
- Conner's verbatim direction: *"We need all of the plug-ins and connections and agents we have and probably more. We need more analytics and researchers and legal and marketing help for all of these verticals. And in order to do this we need to build and find open-source skills to have the most capable and holistic fleet available so our business owners get a premium tier product with a few clicks."*

---

## 1. Disciplines list

The customer-facing fleet collapses into **8 disciplines** every local-business owner needs an operator-grade answer to. Two more (Engineering, Product Management) stay internal — they're the dogfood layer that builds agentplain itself, not capabilities we sell.

1. **Analytics & reporting.** Premium = the owner walks into the dashboard and the same numbers a $5K/mo fractional COO would surface are already there, cited to source-system rows: pipeline conversion, days-on-market or days-to-fund or claim-cycle-time, AR aging, agent or producer productivity, leakage by channel, top-3 things to fix this week. Not a chart library — a *running interpretation* with the weekly pulse already drafted.

2. **Research.** Premium = the owner asks "what did the new GA escrow rule change for us?" or "what is XYZ Realty doing differently in our zip code?" and a researcher delivers a cited, dated brief by morning — pulling public records, vendor docs, MLS feeds, secretary-of-state corporate filings, competitor sites, industry reg feeds. Pairs with Analytics to explain *why* the numbers moved.

3. **Legal & compliance.** Premium = first-pass review of every contract before it leaves the firm; a living compliance corpus per vertical (Fair Housing + RESPA + TILA + state license rules for realty; Reg BI + IA Act for RIA; HIPAA for the home-health adjacency; UPL screens for law-firm intake) that runs in middleware on every draft; conflict checks; e-signature orchestration. Counsel still signs — the fleet does the load-bearing pre-flag work that makes counsel's hour cost half what it costs today.

4. **Marketing.** Premium = SEO audits, landing-page content drafts, monthly newsletter, social calendar, brand-voice enforcement across every customer-facing surface, ad-platform campaign analytics (read-only — agents *plan and report*; the owner or the agency *posts*), competitive-positioning briefs. Stays inside the no-outbound rule by drafting, not sending.

5. **Sales enablement.** Premium = inbound lead triage and routing (already half-built in the realty skill), CRM hygiene (dedup, missing-field fill, last-touch recency), pre-call briefs that pull every signal from email + CRM + public records, post-call summary + next-step draft, pipeline-state classification, deal-stage drift alerts. **Note the no-outbound rule:** we never *send* outbound on the owner's behalf; we draft + queue.

6. **Customer success & support.** Premium = inbound message triage by intent + urgency, draft response from the knowledge base, escalation alerts when sentiment turns or SLAs slip, monthly customer-health digest, ticket-to-runbook pattern surfacing. For verticals where this maps to client retention (RIA, PM, CPA, law, insurance), it doubles as the renewal/retention engine.

7. **Finance & accounting.** Premium = invoice generation + chase, AR aging, AP review + categorize, monthly close support, variance analysis vs. plan, journal-entry prep, bookkeeper handoff packages, simple financial-statement drafts. Read + draft against the customer's QuickBooks/Xero — no money movement.

8. **Operations.** Premium = process documentation (capture-from-actions, not capture-from-interview), runbooks, status reports, capacity plans, vendor reviews, change-request management, the day-to-day "I need this written down so a new hire can do it" engine. This is where the bulk of `process-doc-drafter-general`'s value lives.

**Internal-only (dogfood, not sold):** Engineering, Product Management. The plugins exist — `engineering` and `product-management` from the knowledge-work marketplace — but they consume capacity for the fleet that builds agentplain, not for customer workspaces.

**Why no Design or HR as standalone disciplines?** Design folds into Marketing (collateral drafting via Canva/Figma adapters) for the customer surface; standalone Design is internal. HR folds into Recruiting (the vertical) and Operations (onboarding/offboarding runbooks) — not a separate customer-facing surface today. Both can graduate later if a vertical demands.

---

## 2. Open-source skill inventory

Two sources are in scope and verifiable today; **everything else is tagged `[UNVERIFIED]`** until we can ground it in a maintainer + last-update signal.

### 2A. Anthropic `knowledge-work-plugins` marketplace (PRIMARY — locally installed)

Source: `marketplace_01QRn9XAjzzeAokB5nPWVMxP` ("knowledge-work-plugins") under `C:\Users\conne\AppData\Roaming\Claude\local-agent-mode-sessions\…\rpm\plugin_*`. 31 plugins installed. Maintained by Anthropic (first-party). Trust signal: production marketplace, fresh install timestamps 2026-05-27. Each plugin ships:

- A set of `skills/<name>/SKILL.md` files (the agent definitions).
- A `commands/` set (the slash-command surface).
- A `CONNECTORS.md` enumerating the placeholder MCP categories the skill expects (`~~chat`, `~~CRM`, `~~e-signature`, etc.) — by design the plugin is tool-agnostic and works with **any** MCP server in that category. Installable defaults are pre-wired in `.mcp.json`.

Plugin-by-discipline skills inventory (each row = a skill that already exists, ready to install + vertical-wrap):

| Discipline | Plugin | Skills available (verbatim from skill list) |
|---|---|---|
| **Analytics** | `data` | `explore-data`, `statistical-analysis`, `write-query`, `data-context-extractor`, `analyze`, `create-viz`, `sql-queries`, `build-dashboard`, `validate-data`, `data-visualization` |
| **Analytics** | `bigdata-com` | `quick-take`, `company-brief`, `peer-comparables`, `sector-analysis`, `sector-playbook`, `earnings-digest`, `earnings-preview`, `earnings-reaction`, `earnings-quality-screen`, `valuation-snapshot`, `risk-assessment`, `moat-governance-review`, `scenario-analysis`, `variant-perception`, `thematic-research`, `catalyst-monitor`, `cross-sector`, `country-analysis`, `country-sector-analysis`, `g7-comparison`, `regional-comparison`, `investment-memo`, `financial-research-analyst` |
| **Analytics** | `product-tracking-skills` | `product-tracking-model-product`, `instrument-new-feature`, `implement-tracking`, `generate-implementation-guide`, `audit-current-tracking`, `design-tracking-plan`, `business-case` |
| **Research** | `enterprise-search` | `search`, `search-strategy`, `source-management`, `knowledge-synthesis`, `digest` |
| **Research** | `brightdata-plugin` | `competitive-intel`, `data-feeds`, `seo-audit`, `scrape`, `search`, `scraper-builder`, `scraper-studio`, `design-mirror`, `agent-onboarding`, `bright-data-best-practices`, `python-sdk-best-practices`, `brd-browser-debug` |
| **Research** | `bio-research` | `scientific-problem-selection`, `single-cell-rna-qc`, `scvi-tools`, `nextflow-development`, `instrument-data-to-allotrope`, `start` (cluster — niche; only home-services-clinic / pharmacy adjacencies if those ever land) |
| **Research** | `common-room` (also Sales) | `account-research`, `contact-research`, `prospect`, `weekly-prep-brief`, `call-prep`, `compose-outreach` |
| **Legal** | `legal` | `compliance-check`, `brief`, `legal-response`, `legal-risk-assessment`, `meeting-briefing`, `review-contract`, `signature-request`, `triage-nda`, `vendor-check` |
| **Marketing** | `marketing` | `seo-audit`, `performance-report`, `email-sequence`, `draft-content`, `content-creation`, `competitive-brief`, `campaign-plan`, `brand-review` |
| **Marketing** | `brand-voice` | `discover-brand`, `brand-voice-enforcement`, `guideline-generation`, `enforce-voice` |
| **Marketing** | `searchfit-seo` | `content-strategy`, `content-brief`, `broken-links`, `content-translation`, `ai-visibility`, `technical-seo`, `seo-audit`, `schema-markup`, `keyword-clustering`, `internal-linking`, `on-page-seo`, `create-content`, `create-topic`, `generate-schema`, `keyword-cluster`, `seo-check`, `translate-content` |
| **Marketing** | `adspirer-ads-agent` | `campaign-performance`, `keyword-research`, `ad-campaign-best-practices` |
| **Marketing** | `sanity-plugin` | `deploy-schema`, `review`, `sanity`, `typegen`, `portable-text-conversion`, `content-modeling-best-practices`, `portable-text-serialization`, `content-experimentation-best-practices`, `seo-aeo-best-practices`, `sanity-best-practices` |
| **Marketing** | `postiz` | `postiz` (social scheduler skill) |
| **Marketing** | `figma` | `figma-generate-library`, `figma-create-new-file`, `figma-use-slides`, `figma-code-connect`, `figma-use-figjam`, `figma-generate-diagram`, `figma-use`, `figma-generate-design` |
| **Sales** | `sales` | `pipeline-review`, `forecast`, `draft-outreach`, `daily-briefing`, `create-an-asset`, `competitive-intelligence`, `call-summary`, `call-prep`, `account-research` |
| **Sales** | `apollo` | `enrich-lead`, `sequence-load`, `prospect` |
| **Sales** | `common-room` | (shared with Research) `account-research`, `contact-research`, `prospect`, `weekly-prep-brief`, `call-prep`, `compose-outreach`, `generate-account-plan`, `weekly-brief` |
| **Customer success** | `customer-support` | `ticket-triage`, `kb-article`, `draft-response`, `customer-research`, `customer-escalation` |
| **Customer success** | `intercom` | `intercom-analysis` |
| **Customer success** | `slack-by-salesforce` | `channel-digest`, `draft-announcement`, `find-discussions`, `standup`, `summarize-channel`, `slack-search`, `slack-messaging` |
| **Finance** | `finance` | `journal-entry`, `close-management`, `audit-support`, `sox-testing`, `reconciliation`, `financial-statements`, `journal-entry-prep`, `variance-analysis` |
| **Operations** | `operations` | `process-doc`, `compliance-tracking`, `vendor-review`, `change-request`, `status-report`, `capacity-plan`, `risk-assessment`, `runbook`, `process-optimization` |
| **Operations** | `productivity` | `memory-management`, `update`, `task-management`, `start` |
| **Operations** | `engineering` *(internal)* | `testing-strategy`, `tech-debt`, `system-design`, `standup`, `documentation`, `incident-response`, `code-review`, `deploy-checklist`, `architecture`, `debug` |
| **Operations** | `product-management` *(internal)* | `synthesize-research`, `roadmap-update`, `stakeholder-update`, `sprint-planning`, `write-spec`, `product-brainstorming`, `metrics-review`, `competitive-brief`, `brainstorm` |
| **HR** *(latent)* | `human-resources` | `comp-analysis`, `draft-offer`, `interview-prep`, `people-report`, `policy-lookup`, `org-planning`, `onboarding`, `performance-review`, `recruiting-pipeline` |
| **Design** *(folds into Marketing)* | `design` | `user-research`, `research-synthesis`, `design-system`, `design-critique`, `design-handoff`, `accessibility-review`, `ux-copy` |
| **Comms cross-cutting** | `zoom-plugin` | `phone`, `zoom-mcp`, `scribe`, `meeting-sdk`, `webhooks`, `general`, `virtual-agent`, `team-chat`, `contact-center`, `rest-api`, `cobrowse-sdk`, `setup-zoom-mcp`, `build-zoom-meeting-app`, `build-zoom-bot`, `plan-zoom-integration` |
| **Comms cross-cutting** | `pdf-viewer` | `annotate`, `fill-form`, `open`, `sign`, `view-pdf` |

**Total: 31 plugins, ~210 skills.** Anthropic-maintained, first-party trust, last refreshed 2026-05-27.

### 2B. External open-source sources (verifiable today)

Each entry below names a source we can point at; anything we cannot ground gets `[UNVERIFIED]`.

| Source | URL | What it is | Trust / maintenance signal |
|---|---|---|---|
| `modelcontextprotocol/servers` | github.com/modelcontextprotocol/servers | Anthropic + community reference MCP servers — Filesystem, Git, GitHub, Postgres, SQLite, Slack, Brave Search, Puppeteer, Sentry, Time, Google Drive, others | Anthropic-stewarded, active maintenance (releases ongoing through 2026). The canonical place to look for first-party MCP server implementations. |
| `anthropics/anthropic-cookbook` skill examples | github.com/anthropics/anthropic-cookbook | Reference patterns for tool-use, prompt-caching, agent loops — *not* installable skills but copy-the-pattern reference | Anthropic-maintained. |
| `awesome-mcp-servers` | github.com/punkpeye/awesome-mcp-servers `[UNVERIFIED maintainer rigor]` | Community catalog of third-party MCP servers across domains (CRM, ERP, vertical SaaS) | Community-maintained list; treat as discovery surface, **not** as a trust seal. Each entry must be re-vetted before install. |
| Vendor-published MCP servers (per-product) | Various — e.g., Stripe, Cloudflare, Linear, Notion, Atlassian, HubSpot all publish official MCP endpoints `[UNVERIFIED — confirm each via vendor docs at install time]` | First-party vendor MCP wrappers | Stronger trust than community wrappers; weaker than first-party Anthropic plugins. Verify per-vendor at install. |

**Honest framing.** The plugin marketplace gives us ~210 first-party skills covering 8 of the 8 customer-facing disciplines. The external open-source surface is significant but mostly *MCP-server* shaped, not *skill* shaped — meaning external surface adds **connectors**, not **agent logic**. Most agent logic we'll need comes from the Anthropic marketplace or we'll build it.

---

## 3. Discipline × Vertical matrix

10 verticals: `general`, `real-estate`, `mortgage`, `insurance`, `property-management`, `title-escrow`, `recruiting`, `home-services`, `cpa`, `law`, `ria`. Each cell tags the recommendation per `INSTALL` (the named plugin + the vertical wrapping), `BUILD-NEW` (gap with one-line spec), `USE-AS-IS` (existing capability covers), or `NONE-NEEDED` (the vertical doesn't need this discipline yet).

Read the matrix down-the-column to see what each vertical needs end-to-end; read across-the-row to see how a discipline lands across the portfolio.

### Analytics & reporting

| Vertical | Cell |
|---|---|
| general | **INSTALL** `data:build-dashboard` + `data:analyze` wrapped with workspace-scoped warehouse adapter. The dashboard is the surface every other vertical's analytics lands on. |
| real-estate | **INSTALL** `data:build-dashboard` + **BUILD-NEW** `realty-production-reporter` connector (already chartered in `lib/verticals/real-estate/content.ts`) — KPIs: GCI per agent, listings taken vs. listings sold, days-on-market by price-band, lead-to-appointment rate, by-source attribution. |
| mortgage | **INSTALL** `data:analyze` + **BUILD-NEW** loan-pipeline dashboard — KPIs: pull-through rate, cycle time, conditions outstanding per loan, locked-but-not-funded aging. Wraps Encompass LOS adapter. |
| insurance | **INSTALL** `data:analyze` + **BUILD-NEW** book-of-business analytics — premium per renewal cycle, retention by carrier, loss-ratio by class, cross-sell opportunities. Wraps EZLynx/HawkSoft. |
| property-management | **INSTALL** `data:build-dashboard` + **BUILD-NEW** rent-roll/delinquency analytics. Wraps AppFolio/Buildium. |
| title-escrow | **INSTALL** `data:analyze` + **BUILD-NEW** closing-pipeline dashboard — files opened/closed, average days-to-close, doc-package age buckets. Wraps SoftPro/Qualia. |
| recruiting | **INSTALL** `data:analyze` + **BUILD-NEW** ATS funnel analytics — applications → screens → onsites → offers → accepts; time-in-stage. Wraps Greenhouse/Lever. |
| home-services | **INSTALL** `data:analyze` + **BUILD-NEW** job-pipeline + revenue-per-tech dashboards. Wraps ServiceTitan/AccuLynx/Jobber. |
| cpa | **INSTALL** `data:analyze` + **BUILD-NEW** firm-utilization analytics — billable hours vs. budget per engagement, WIP aging, realization rate. Wraps Karbon/Canopy + QuickBooks (firm books). |
| law | **INSTALL** `data:analyze` + **BUILD-NEW** matter-economics analytics — realization rate, AR aging by matter, originating attorney attribution. Wraps Clio. |
| ria | **INSTALL** `data:analyze` + **BUILD-NEW** AUM/flows/performance dashboard. Wraps Orion/Black Diamond + Redtail. |

### Research

| Vertical | Cell |
|---|---|
| general | **INSTALL** `enterprise-search:search` + `enterprise-search:digest` + `brightdata-plugin:competitive-intel` + `bigdata-com:quick-take`. |
| real-estate | **INSTALL** `enterprise-search:search` + **BUILD-NEW** MLS-feed adapter (FMLS/GAMLS) + GA secretary-of-state corporate-filings reader + **BUILD-NEW** zip-level comp-pull skill. |
| mortgage | **INSTALL** `bigdata-com:catalyst-monitor` (Fed/rate moves) + **BUILD-NEW** investor-guideline tracker (FNMA/FHLMC bulletins). |
| insurance | **INSTALL** `enterprise-search:search` + **BUILD-NEW** state-DOI bulletin tracker per state + **BUILD-NEW** carrier-appetite delta watcher. |
| property-management | **INSTALL** `enterprise-search:search` + **BUILD-NEW** city/county landlord-ordinance tracker (especially eviction-pause + rent-stabilization moves). |
| title-escrow | **INSTALL** `enterprise-search:search` + **BUILD-NEW** county recorder + tax-assessor public-records adapter (search-only, per-county). |
| recruiting | **INSTALL** `common-room:account-research` + `common-room:contact-research` + `apollo:enrich-lead` for candidate enrichment. |
| home-services | **INSTALL** `brightdata-plugin:competitive-intel` (local-trade competitor pricing/availability scrape) + **BUILD-NEW** permit-data adapter (per-municipality). |
| cpa | **INSTALL** `enterprise-search:search` + **BUILD-NEW** IRS-pub + state-tax-bulletin watcher. |
| law | **INSTALL** `enterprise-search:search` + **BUILD-NEW** court-docket + opinion-feed adapter (PACER + state court systems via existing scrapers; vendor: CourtListener `[UNVERIFIED — confirm API terms]`). |
| ria | **INSTALL** `bigdata-com:earnings-digest` + `bigdata-com:thematic-research` + **BUILD-NEW** SEC-filing tracker (8-K/13F deltas on holdings the firm owns). |

### Legal & compliance

| Vertical | Cell |
|---|---|
| general | **INSTALL** `legal:review-contract` + `legal:triage-nda` + `legal:vendor-check` + `legal:compliance-check`. |
| real-estate | **INSTALL** `legal:review-contract` + **BUILD-NEW** the GA-only V1 rule corpus for `realty-compliance-sentinel` (Fair Housing federal + GA + NAR Article 12/16 + GREC + FMLS + GAMLS + CAN-SPAM + TCPA + RESPA + TILA — per `docs/realty-fleet-binding-2026-05-22.md` and item 12 in the audit Tier ii). |
| mortgage | **INSTALL** `legal:compliance-check` + **BUILD-NEW** TRID + RESPA + ECOA fair-lending rule pack; flag UDAAP triggers in any draft communication. |
| insurance | **INSTALL** `legal:review-contract` + **BUILD-NEW** state-by-state agent-disclosure rule pack (replacement-form requirements, illustration disclosures). |
| property-management | **INSTALL** `legal:review-contract` + **BUILD-NEW** state-specific lease-statute rule pack + fair-housing inquiry triage. |
| title-escrow | **INSTALL** `legal:compliance-check` + **BUILD-NEW** RESPA Section 8 vetting on referral-arrangement docs; ALTA best-practices conformance checks. |
| recruiting | **INSTALL** `legal:review-contract` (offer letters, MSAs) + `legal:triage-nda` + **BUILD-NEW** EEO compliance pack (ban-the-box, pay-transparency by state). |
| home-services | **INSTALL** `legal:review-contract` (sub agreements) + **BUILD-NEW** state contractor-license + lien-rights compliance pack. |
| cpa | **INSTALL** `legal:review-contract` (engagement letters) + **BUILD-NEW** Circular 230 enforcement gate. |
| law | **INSTALL** `legal:review-contract` + **BUILD-NEW** UPL screen on intake messages + per-state Model Rule 1.7/1.9 conflict-check enrichment over the existing `law-intake-conflict-screen`. |
| ria | **INSTALL** `legal:compliance-check` + **BUILD-NEW** Reg BI + IA Act + state notice-filing compliance pack + Form ADV change-trigger detector. |

### Marketing

| Vertical | Cell |
|---|---|
| general | **INSTALL** `marketing:draft-content` + `marketing:seo-audit` + `marketing:email-sequence` + `brand-voice:enforce-voice` + `searchfit-seo:on-page-seo`. |
| real-estate | **INSTALL** marketing core + **BUILD-NEW** listing-marketing pack (single-property site copy, just-listed/just-sold social cards via Canva/Figma adapter, MLS-syndication-aware copy that doesn't violate MLS rules). |
| mortgage | **INSTALL** marketing core + `searchfit-seo:content-strategy` + **BUILD-NEW** referral-partner monthly-rate-update template (drafted, never sent — per no-outbound). |
| insurance | **INSTALL** marketing core + **BUILD-NEW** renewal-letter drafter + cross-sell campaign-plan (e.g., umbrella to high-asset auto clients). |
| property-management | **INSTALL** marketing core + **BUILD-NEW** vacancy-listing copy + photo-pack drafter; owner-acquisition landing-page templates. |
| title-escrow | **INSTALL** `marketing:competitive-brief` + **BUILD-NEW** lender/realtor referral-partner one-pager generator. |
| recruiting | **INSTALL** marketing core + **BUILD-NEW** employer-brand JD rewriter (DEIB-conformant, plain-English, per-role) + sourced-candidate sequence drafter (drafted only). |
| home-services | **INSTALL** marketing core + `adspirer-ads-agent:campaign-performance` (read-only — agents report; the owner posts) + **BUILD-NEW** seasonal campaign-plan templates per trade. |
| cpa | **INSTALL** marketing core + **BUILD-NEW** seasonal client-communication packs (year-end planning, extension deadline, Q1 reminders). |
| law | **INSTALL** marketing core + `searchfit-seo:schema-markup` (LegalService schema) + **BUILD-NEW** practice-area landing-page generator. |
| ria | **INSTALL** marketing core + **BUILD-NEW** quarterly-letter drafter (with compliance-pack gating before send-queue). |

### Sales enablement

| Vertical | Cell |
|---|---|
| general | **INSTALL** `sales:pipeline-review` + `sales:call-prep` + `sales:call-summary` + `sales:account-research` + `common-room:weekly-prep-brief` + `apollo:enrich-lead`. |
| real-estate | **INSTALL** sales core + **USE-AS-IS** `realty-buyer-inquiry-router` (already chartered) + **BUILD-NEW** showing-feedback-summary skill. |
| mortgage | **INSTALL** sales core + **BUILD-NEW** loan-officer pre-call brief (pulls credit + assets + employment from LOS). |
| insurance | **INSTALL** sales core + **BUILD-NEW** quote-comparison summary + cross-sell-opportunity flagger. |
| property-management | **INSTALL** sales core + **BUILD-NEW** owner-acquisition pipeline reviewer; tenant-application triage already covered under `customer-success`. |
| title-escrow | **INSTALL** `sales:pipeline-review` + **BUILD-NEW** lender/realtor-partner-rank weekly briefing. |
| recruiting | **INSTALL** sales core + `common-room:prospect` + **BUILD-NEW** candidate-status-update drafter (`recruiting-candidate-status-update` already chartered; needs ATS adapter). |
| home-services | **INSTALL** sales core + **BUILD-NEW** estimate-followup drafter (`home-services-estimate-followup` already chartered) + win/loss analysis on bid outcomes. |
| cpa | **NONE-NEEDED** for inbound-sales surface; cpa relationships are referral-driven. **INSTALL** `sales:account-research` for partner-firm research only. |
| law | **NONE-NEEDED** for traditional sales; **INSTALL** `sales:account-research` + **BUILD-NEW** intake-conversion analyzer (intake form → consult → engagement). |
| ria | **INSTALL** `sales:account-research` + **BUILD-NEW** referral-source ROI analyzer. |

### Customer success & support

| Vertical | Cell |
|---|---|
| general | **INSTALL** `customer-support:ticket-triage` + `customer-support:draft-response` + `customer-support:customer-escalation` + `intercom:intercom-analysis`. |
| real-estate | **NONE-NEEDED** standalone — buyer/seller-inquiry routing already covered under Sales. |
| mortgage | **INSTALL** customer-support core + **BUILD-NEW** borrower-status-update drafter (`mortgage-document-chase` already chartered; this is the inbound side). |
| insurance | **INSTALL** customer-support core + **BUILD-NEW** claims-status-update drafter + COI-request triage (extends `insurance-coi-request`). |
| property-management | **INSTALL** customer-support core + **BUILD-NEW** maintenance-request triage + tenant-communication drafter; vendor-coordination drafter. |
| title-escrow | **INSTALL** customer-support core + **BUILD-NEW** closing-doc-status drafter (extends `title-escrow-closing-doc-chase`). |
| recruiting | **INSTALL** customer-support core + **BUILD-NEW** candidate-experience pulse + hiring-manager weekly-update drafter. |
| home-services | **INSTALL** customer-support core + **BUILD-NEW** appointment-confirmation drafter + post-job NPS-followup drafter. |
| cpa | **INSTALL** customer-support core + **BUILD-NEW** client-request-tracker + missing-document chaser (extends `cpa-doc-chase`). |
| law | **INSTALL** customer-support core + **BUILD-NEW** client-update drafter per matter; intake follow-up. |
| ria | **INSTALL** customer-support core + **BUILD-NEW** client-status-update drafter (extends `ria-client-update-draft`) + RMD/required-distribution reminder pack. |

### Finance & accounting

| Vertical | Cell |
|---|---|
| general | **INSTALL** `finance:reconciliation` + `finance:variance-analysis` + `finance:financial-statements` + `finance:journal-entry-prep` + `finance:close-management`. |
| real-estate | **INSTALL** finance core + **USE-AS-IS** `invoice-chasing-realestate` (already chartered) + QuickBooks adapter for commission AR. |
| mortgage | **INSTALL** finance core + **BUILD-NEW** broker-shop P&L per loan officer. |
| insurance | **INSTALL** finance core + **BUILD-NEW** commission-statement reconciliation (carrier statements ↔ AMS). |
| property-management | **INSTALL** finance core + **BUILD-NEW** trust-account reconciliation (state-regulated) + owner-statement generator. |
| title-escrow | **INSTALL** finance core + **BUILD-NEW** escrow trust-account reconciliation (highly regulated — needs careful boundary). |
| recruiting | **INSTALL** finance core (firm books) + **BUILD-NEW** placement-fee tracker. |
| home-services | **INSTALL** finance core + **USE-AS-IS** existing QuickBooks adapter + **BUILD-NEW** job-costing reporter. |
| cpa | **INSTALL** finance core — **but** firm-books only; client-books are the *output*, not the *target*, of the firm. **USE-AS-IS** `month-end-close-cpa`. |
| law | **INSTALL** finance core + **BUILD-NEW** trust/IOLTA accounting gate (state-bar-regulated; cannot ship without bar-review). |
| ria | **INSTALL** finance core + **BUILD-NEW** advisor-fee billing reconciliation against custodian feeds. |

### Operations

| Vertical | Cell |
|---|---|
| general | **INSTALL** `operations:process-doc` + `operations:runbook` + `operations:status-report` + `operations:vendor-review` + `operations:risk-assessment` + `productivity:task-management`. **USE-AS-IS** `process-doc-drafter-general` (already chartered). |
| real-estate | **INSTALL** ops core + **BUILD-NEW** transaction-checklist runbook generator (per state + per transaction type). |
| mortgage | **INSTALL** ops core + **BUILD-NEW** loan-condition-clearing runbook. |
| insurance | **INSTALL** ops core + **BUILD-NEW** renewal-cycle runbook per LOB. |
| property-management | **INSTALL** ops core + **BUILD-NEW** turn-and-list runbook + annual-inspection runbook. |
| title-escrow | **INSTALL** ops core + **BUILD-NEW** closing-checklist runbook. |
| recruiting | **INSTALL** ops core + **BUILD-NEW** new-hire-onboarding runbook generator (extends `human-resources:onboarding`). |
| home-services | **INSTALL** ops core + **BUILD-NEW** dispatch-runbook + tech-onboarding runbook. |
| cpa | **INSTALL** ops core + **BUILD-NEW** tax-season-staffing capacity plan. |
| law | **INSTALL** ops core + **BUILD-NEW** matter-opening + matter-closing runbooks. |
| ria | **INSTALL** ops core + **BUILD-NEW** quarterly-review prep runbook + ADV-update cadence runbook. |

**Counts.** 8 disciplines × 11 verticals (10 + general) = 88 cells. Roughly **half** are `INSTALL` (lean on the marketplace skill plus vertical wrapping, no new agent logic); the other half are `BUILD-NEW` and almost always shaped as **adapter + vertical preset + rule pack** — *not* greenfield agent invention.

---

## 4. Connectors to add (MCP-first)

Today's marketplace (`lib/integrations/marketplace.ts:71-271`) ships 9 active + 3 coming-soon connectors. To make the matrix above real, we add the following — every one of them an MCP server at `/api/integrations/<slug>-mcp/{workspaceId}` per the existing architecture, every one with a marketplace tile, every one read-then-draft (never `send`):

### Per-discipline new connectors

**Analytics & reporting**
- **BI / data warehouse** — `metabase`, `looker-studio` (read-only). Plus shared `postgres` connector for owners running their own warehouse `[UNVERIFIED — pick on demand-signal first]`.
- **Product analytics** — `amplitude`, `mixpanel`, `google-analytics-4`.
- **Spreadsheets warehouse** — `google-sheets` (companion to existing `excel`).

**Research**
- **MLS feeds** — `fmls`, `gamls` (RESO Web API). State-by-state expansion.
- **Public records** — `secretary-of-state-ga`, `county-recorder-*` (per-target-county).
- **Web research** — `brave-search`, `perplexity-search`, `brightdata-scrape` (vendor MCP — `[UNVERIFIED — confirm at install]`).
- **Industry regs feeds** — `irs-pubs`, `state-doi-bulletin-*`, `finra-feed`, `sec-edgar`.

**Legal & compliance**
- **Practice management** — `clio`, `mycase`, `practice-panther`.
- **E-discovery / docs** — `relativity` `[UNVERIFIED — enterprise SKU]`.
- **Compliance corpus storage** — internal pgvector substrate (already chartered under `agentplain-knowledge-architect`).

**Marketing**
- **CMS** — `webflow`, `wordpress`, `contentful`, `sanity` (the plugin already exists).
- **Social schedulers** — `postiz` (the plugin already exists; wrap as MCP for owner workspaces) + `buffer` `[UNVERIFIED]`.
- **Ad platforms** *(read-only — agents report performance; the owner posts)* — `meta-ads`, `google-ads`, `linkedin-ads`.
- **SEO** — `ahrefs`, `semrush`, `google-search-console`.
- **Design** — `canva` (already coming-soon in marketplace; promote to active), `figma` (plugin exists).
- **Email marketing** — `mailchimp`, `klaviyo` (read + draft; the owner sends).

**Sales enablement**
- **CRM** — `hubspot` (already coming-soon — promote to active), `salesforce`, `pipedrive`. Vertical-CRM: `follow-up-boss`, `kvcore`, `lofty`, `boomtown`, `sierra-interactive`, `redtail`, `wealthbox`.
- **Data enrichment** — `apollo` (plugin exists; wrap as MCP), `clay`, `zoominfo` `[UNVERIFIED — enterprise SKU]`.
- **Conversation intelligence** — `fireflies`, `gong`, `chorus`.

**Customer success & support**
- **Help-desk** — `intercom` (plugin exists), `zendesk`, `freshdesk`, `hubspot-service`.
- **Knowledge base** — `notion`, `confluence`, `guru`.

**Finance & accounting**
- **Accounting** — `xero`, `freshbooks` (complement existing `quickbooks`). Vertical-trust-accounting: `cosmolex`, `trustbooks` `[UNVERIFIED]`.
- **Payroll** — `gusto`, `rippling`, `adp` (where the operator-dashboard category demands).

**Operations**
- **ITSM/Project** — `linear`, `jira`, `asana`, `monday`.
- **Workflow** — `airtable`.

**Vertical-system connectors (cluster from §3 BUILD-NEW lines)**
- realty: `follow-up-boss`, `kvcore`, `lofty`, `boomtown`, `sierra-interactive`, `skyslope`, `dotloop`, `brokermint`, `fmls`, `gamls`.
- mortgage: `encompass`, `floify`.
- insurance: `ezlynx`, `hawksoft`, `nowcerts`.
- property-mgmt: `appfolio`, `buildium`, `rent-manager`.
- title-escrow: `softpro`, `qualia`, `ramquest`.
- recruiting: `greenhouse`, `lever`, `workable`, `bullhorn`.
- home-services: `servicetitan`, `acculynx`, `housecall-pro`, `jobber`.
- cpa: `karbon`, `canopy`, `lacerte`, `proconnect`.
- law: `clio`, `mycase`, `practice-panther`.
- ria: `orion`, `black-diamond`, `redtail`, `wealthbox`.

**Comms**
- **Calendar** — `google-calendar`, `m365-calendar` (sub-scopes of existing M365 + Google OAuth; needed to unlock `chief-of-staff-scheduler`).
- **Video** — `zoom-plugin` already installed; expose to operator workspaces.
- **Forms** — `typeform`, `google-forms`.

**Aggregate net-new connector count (excluding `[UNVERIFIED]` and vertical-CRM enumeration):** ~45 connectors over the existing 9 active + 3 coming-soon. Phase across waves (§6). Every one observes the no-outbound rule.

---

## 5. Premium "few-clicks" UX requirements

For the owner's experience to feel like one product (not a 200-skill kit), the customer surface needs the following — non-negotiable for premium positioning. Feeds Strand 2 (UX re-eval) directly.

1. **One Connect tile per connector.** `lib/integrations/marketplace.ts` is already the seam (`listIntegrations()`). Every new connector lands here. Status tags: `available` / `beta` / `coming-soon`. Waitlist on `coming-soon` already routes through `/custom?type=integration-waitlist&id=<id>` — keep.
2. **Per-discipline activation per workspace.** A simple Discipline panel under `/app/workspace/[id]/settings`: 8 toggles (Analytics, Research, Legal, Marketing, Sales, CS, Finance, Ops). Each toggle:
   - **Off** by default in V1 except whatever the vertical preset declares as core.
   - **On** activates every skill in that discipline mapped to the workspace's vertical (per §3 matrix).
   - Surfaces the dependency: "Activating Marketing requires Canva and Mailchimp connected; HubSpot recommended" — with the click-through Connect tiles.
3. **Vertical presets.** First-run picks a vertical → the right disciplines flip on with the right skills + the right connector recommendations + a vertical-tuned `vertical-preset.json`. The preset is the seam between "we sell `agentplain`" and "you bought `agentplain-for-real-estate`."
4. **Approval queue grouped by discipline + agent.** Today `WorkApprovalQueueItem` is a flat list. Premium: facet by discipline first, then agent. Filter chips: "Show me only Legal flags", "Show me only Marketing drafts". Existing rendering in `app/(app)/workspace/[id]/approvals/*` needs the facet seam; one schema column (`discipline`) on `WorkApprovalQueueItem`.
5. **A "what's working / what's drafting / what needs me" dashboard.** Single landing page at `/app/workspace/[id]` answering, for the owner walking in cold:
   - **Working for you right now** — count of agents firing on a schedule against this workspace, with last-fire timestamps and a clickable surface to the artifacts produced.
   - **Drafted, waiting for your call** — count of items in `WorkApprovalQueueItem` grouped by discipline.
   - **Needs you specifically** — high-urgency or compliance-flagged items (UPL, fair-housing, TCPA, etc.) elevated above the queue.
6. **Skill-card honesty discipline (in-product).** Every agent card on `/app/workspace/[id]/agents` shows the live runtime status that matches reality, per the audit's Tier (i) re-grading (`runtime: "rooting"` + `rootingNote` until the caller and the connector are both real). No new agent surfaces as `live` until the integration acceptance bar (`feedback_integration_acceptance_is_functional.md`) is met.
7. **First-run "few-clicks" flow.** Pick vertical → connect the 3 core connectors for that vertical (e.g., real-estate: email + calendar + FUB) → all matching discipline skills flip on → first artifact lands in approval queue within the hour. Target: **5 clicks to first artifact**.
8. **Discipline-tile copy template.** Inside Plaino's voice. The card name = the discipline; the description = "what your service partner handles in this category" — no skill enumeration, no agent-naming-theater. The detail page is where the agent enumeration lives, *and only the live ones get cards*.

---

## 6. Rollout sequence (waves)

Ordered by *speed-to-truth × leverage*, with hard dependencies on the self-serve readiness work for prod OAuth creds. Each wave is a deliverable that can ship and stand on its own — no half-builds.

### Wave 0 — Truth alignment (concurrent with this plan landing)

Tier (i) of the audit. Re-grade overclaims; doc-only. No new code surface. **Owner:** `b2b-eng-tech-lead` + `flatsbo-capability-builder`. **Dependency:** none.

### Wave 1 — Unlock the demo skills + general discipline activations *(highest leverage)*

The single move that flips the most claims from "rooting" to "true":

1. **`chief-of-staff-scheduler` wired to real M365 + Google Calendar** + Inngest cron (audit Tier ii item 8). Flips the most-replicated overclaim (11 verticals) at once.
2. **3 `/general` runtime skills to production callers** (audit Tier ii item 9) — `inbox-triage-general`, `follow-up-chaser-general`, `process-doc-drafter-general` against the already-built Gmail/M365 adapters.
3. **INSTALL the marketplace skill packs for the general workspace**: `data:build-dashboard` + `enterprise-search:search` + `legal:review-contract` + `marketing:draft-content` + `customer-support:ticket-triage` + `finance:reconciliation` + `operations:process-doc` — all wrapped as agentplain skills in `lib/skills/<slug>/` against the existing connectors.
4. **Discipline panel + first-run vertical preset** shipped on the operator dashboard (UX §5.2 + §5.3).
5. **Promote 3 coming-soon connectors to active**: `hubspot`, `paypal`, `canva` (existing prod creds gap — depends on self-serve readiness).

**Dependency:** self-serve readiness prod creds. **Honesty gate:** no card claims `live` until two-implementation rule + integration-acceptance bar met.

### Wave 2 — Real-estate vertical end-to-end (the lead pilot)

Realty is the only vertical with an installed-and-firing owner today; finish it.

1. **Realty connector triad** (audit Tier ii item 10): QuickBooks (commission AR), Follow Up Boss (lead/CRM), Skyslope or dotloop (transaction).
2. **`realty-compliance-sentinel` corpus + middleware** (audit Tier ii item 12) — GA-only V1 + counsel review.
3. **`realty-buyer-inquiry-router`, `realty-showing-scheduler`, `realty-listing-coordinator`** V0 checklists closed (audit Tier iii item 16).
4. **Realty Analytics dashboard** — `data:build-dashboard` + `realty-production-reporter` BUILD-NEW work from §3.
5. **Realty Legal pack** — `legal:review-contract` + GA rule corpus (extends item 2).
6. **Realty Marketing pack** — listing-marketing + Canva/Figma adapters from §3.

**Dependency:** Wave 1 ships first; first design-partner brokerage has signed connect-in-a-click.

### Wave 3 — Vertical-system connectors (11 verticals' core adapters)

Per audit Tier ii item 11; expand to cover the §3 BUILD-NEW vertical-system list. Sequence: highest-LTV-vertical first. Order: `cpa` → `law` → `ria` → `insurance` → `mortgage` → `home-services` → `property-management` → `title-escrow` → `recruiting`. Each vertical, on landing, flips the analytics + customer-success + finance + operations disciplines to `live` for that vertical (the 4 disciplines that don't need a vertical-specific compliance pack to be useful).

### Wave 4 — Compliance corpora per vertical (legal discipline maturation)

Per vertical, the BUILD-NEW compliance rule pack from §3 Legal row. Each pack needs counsel sign-off before activation; the work to draft the pack happens in parallel with Wave 3. Activation lags one vertical-pilot per pack.

### Wave 5 — Research + Marketing depth packs

The "ambient intelligence" tier — public-records adapters, MLS-feed adapters, regulatory-bulletin feeds, ad-platform read-only adapters. Comes after Waves 2-4 because owner perception of "real-time research" is high-value but only believable once the basics work.

### Wave 6 — Org/insights dogfood activation (audit Tier iii items 13-18)

The internal dogfood: install staged b2b heads, rebuild b2b-eng SKILL.md set, activate the insights department, ship platform-eng's missing primitives. Customer-invisible but the dogfood claim on the about-page becomes defendable end-to-end.

### Wave 7 — HR + Design as standalone disciplines (gated on demand)

If the recruiting vertical or the home-services vertical signal that HR or standalone Design needs a customer-surface tile, activate. Otherwise stay folded into Marketing + Operations.

**Cross-cutting dependency map.**

- **prod credentials** (every wave from Wave 1) ← self-serve readiness work (already in flight).
- **counsel review** (Waves 2 + 4) ← Conner + outside counsel coordination via `flatsbo-attorney-firstpass` first-pass + then real counsel.
- **`agentplain-knowledge-architect` installed** (Wave 5+) ← audit Tier iii item 13 — required for the compliance corpus storage + retrieval substrate.
- **platform-eng primitives** (audit Tier iii item 18) — prompt-caching wrapper, Sentry, KMS, live-fixture allowlist guard. **Move to Wave 1**: these are upstream of everything else and 27 days overdue per the audit.

---

## 7. Honesty discipline reaffirmed

Every new agent, connector, and capability in this plan respects the integration-truth rules locked in `docs/brand-and-claims.md` §10 and `feedback_integration_acceptance_is_functional.md`. Stated as durable constraints on Strand 3 (the build):

1. **No customer-facing copy changes until the agent fires on real customer data.** Marketing pages (`app/(marketing)/[vertical]/page.tsx`), the operator dashboard, the agents page, the integrations page — none of them mention a new agent, vertical, or capability ahead of the integration-acceptance bar (read + categorize + coordinate + schedule + draft on a real connected workspace). PR #102 (`fix(marketing): honest INTEGRATES claims`) is the pattern; this plan extends it.

2. **No new connectors named in customer copy until they have prod creds + a green webhook + a real `WorkApprovalQueueItem` produced from a real customer mailbox.** The `MARKETPLACE_ENTRIES` array stays the only enumeration of what we offer; pages read from `listIntegrations()`, never from a hand-rolled list.

3. **The `runtime: "live"` semantic on agentRoster cards** stays per `lib/verticals/types.ts:196-211`. Until the audit Tier (i) re-grading lands, no new card ships at `live` — every new card opens at `rooting` with an explicit `rootingNote` citing the actual blocker (connector pending / corpus drafting / cron unwired).

4. **The no-outbound rule applies to every new connector.** Ad-platform tiles are read-only ("we report performance; you post"). CRM tiles are read + draft ("we keep contacts clean and draft replies; you send"). Email-marketing tiles are read + draft ("we draft the newsletter; you send"). No `send` scope on any new entry. The marketplace's existing scope hygiene (`lib/integrations/marketplace.ts:79-243`) is the template.

5. **No silent vendor lock-in for any newly-installed marketplace skill.** Each `INSTALL` from §3 enters through `lib/<discipline>/` behind an interface. Two implementations before any UI tile claims the discipline is `live`. Adapter pattern, per `feedback_runner_portability.md` + `feedback_no_silent_vendor_lock.md`.

6. **Dogfood at the end of every cycle.** The plan is built in part to give the agentplain fleet itself a bigger toolkit — capability-builder, insights-* skills, b2b-eng-* skills all consume the same Anthropic plugin marketplace. Each wave's retrospective documents which of *our* internal-build steps used which of these skills; that's the strongest evidence that the about-page dogfood claim is true.

7. **Plan, not promise.** This doc is the plan; Strand 3 ships it. The site says *zero* about this plan until each Wave's deliverables land and the integration-acceptance bar is met. No "coming Q3" or "we're building" copy.

---

## 8. Open questions for Conner

1. **HR & Design as standalone disciplines** — keep folded into Marketing + Operations + Recruiting (current plan), or surface as customer-facing tiles in Wave 7?
2. **Wave 3 vertical order** — cpa → law → ria → insurance → mortgage → home-services → property-management → title-escrow → recruiting reflects pure-LTV order. Override if a design-partner signal points elsewhere.
3. **`[UNVERIFIED]` vendor MCPs** — should the plan commit to specific external MCPs (Clio, Salesforce, ServiceNow, etc.) or stay tool-agnostic until install time? Current draft does the latter.
4. **Standalone insights surface for customers** — the insights-* sub-agents today are internal. Worth exposing a customer-facing "monthly business review" generated by `b2b-client-service-director` once the four service-partnership deliverables exist (audit Tier iii item 15)?
5. **Wave 1 inclusion of platform-eng primitives** — explicit move from "later" (audit Tier iii item 18) to Wave 1 here on the basis of 27-days-overdue + 90% LLM cost reduction. Confirm.

---

**End of plan.** Awaiting Conner sign-off; Strand 3 then sequences against Wave order above.
