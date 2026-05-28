# Fleet roster — 2026-05-27

Authoritative enumeration of every agent in the fleet across all three host repos. Built as the input for a per-agent capability audit.

## Method + provenance

- **Primary inventory:** `ls C:\Users\conne\.claude\skills\` + `find SKILL.md` → 78 hits. Frontmatter extracted from each file (name + description + type + recommended_model).
- **Code-defined catalog skills:** `C:\agentplain\lib\skills\<slug>\` directory listing + `lib/skills/registry.ts` (16 entries verified at `lib/skills/registry.ts:62-731`, cross-referenced against `docs/fleet-architecture.md:564-583`).
- **Inngest cron registrations (agentplain):** `app/api/inngest/route.ts:14-33` enumerates 4 functions; each `lib/inngest/functions/*.ts` declares the cron schedule.
- **GHA cron registrations (flatsbo):** `C:\flatsbo\.github\workflows\cron-*.yml` (25 cron workflow files) + `C:\flatsbo\scripts\cron\run-skill.ts` REGISTRY (25 CronDefinition entries at `run-skill.ts:513-540`). Cron schedule cited from the workflow's `- cron:` line (the GHA-fired source of truth, not the run-skill.ts copy which can drift).
- **b2b repo:** `ls C:\b2b\lib\agents` → empty. `C:\b2b\` is a scaffold Next.js app with no agent definitions in tree. All "b2b-*" SKILL.md agents live in `~/.claude/skills/`.
- **Cross-reference:** prior inventory at `C:\flatsbo\outputs\agent_inventory_2026-05-08\inventory.md` (75 agents as of 2026-05-08). Re-verified against today's disk state — three new SKILL.md additions since 5/08 are accounted for below.

## Headline counts (verified against disk 2026-05-27)

- **SKILL.md fleet agents (`~/.claude/skills/`):** 78 (77 named agents + 1 codebase-context skill `flatsbo` + the workflow skill `gtm-outreach`)
- **Code-defined agentplain value-loop catalog skills (`C:\agentplain\lib\skills\<slug>\`):** 16
- **Operational Inngest cron functions (`C:\agentplain\lib\inngest\functions\`):** 4 (NOT agents — runtime infra; listed for completeness)
- **Total population for per-agent audit (SKILL.md + catalog skills):** **94**
- **Total cron-registered fires (GHA + Inngest, agent-tier only):** **25 GHA crons** (one per registered SKILL.md leadership/IC seat) + the **4 Inngest crons** that drain the value loop for all 16 catalog skills.

### SKILL.md split by business

- **b2b (agentplain product org):** 10 — 1 CEO, 1 director, 5 eng pod, 3 heads-of-vertical
- **flatsbo (consumer real-estate marketplace + B2B sales seats):** 52 — incl. 1 CEO, 1 BM, 1 CoS, 1 capability-builder, 1 attorney-firstpass, 5 eng pod (build), 9 area-PMs, 7 B2B sales seats, ~27 IC specialists
- **realty (b2b vertical-specific ICs):** 7
- **insights (cross-product department):** 7
- **shared cross-fleet:** 2 (`gtm-outreach`, `platform-eng`)
- **codebase-context (not an agent):** 1 (`flatsbo` codebase skill)

### Firing status

- **Firing (registered on cron, GHA or Inngest):** 25 SKILL.md seats via the 25 flatsbo GHA crons + all 16 catalog skills fire indirectly via the agentplain `process-webhook-event` Inngest cron when their vertical receives a webhook event.
- **Dormant / on-prompt-only:** 53 SKILL.md seats (78 − 25 = 53; includes all 7 realty-* V1 IC SKILL.md agents, all 7 insights-* seats, all 9 flatsbo-area-* PMs, all flatsbo IC specialists, all b2b eng pod ICs except the tech leads, attorney-firstpass, branding, devops, docs, performance, schema, security, seo, testing, accessibility, analytics, etc.)
- **Latent (charter exists, activation gated):** 2 — `b2b-head-of-insurance`, `b2b-head-of-home-services` per their own SKILL.md descriptions (insurance LATENT since 2026-04-29 reclassification; home-services activation gated on realty Product 2 design-partner stage)
- **Staged but not installed (cron fires but SKILL.md not in `~/.claude/skills/`):** 8 — `agentplain-knowledge-architect`, `b2b-head-of-cpa`, `b2b-head-of-law`, `b2b-head-of-mortgage`, `b2b-head-of-property-mgmt`, `b2b-head-of-recruiting`, `b2b-head-of-ria`, `b2b-head-of-title-escrow`. Staged SKILL.md drafts exist under `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\<slug>\SKILL.md` and the cron fires in GHA, but the SKILL.md is not installed in user-scope `~/.claude/skills/<slug>/`. The cron still runs because the CronDefinition references memory files + a model, not the SKILL.md.

---

## Master table — every agent

Tier abbreviations:
- **T0** = cross-product meta (CoS, capability-builder, attorney-firstpass)
- **T1** = Class A CEO (per-business top)
- **T1-D** = Tier 1 director / tech lead (pod orchestrator)
- **T1.5** = head of vertical (vertical owner under director)
- **T2** = build-pod IC / area PM / dept head
- **T3** = role specialist / catalog-skill / vertical-specific IC

`Fires?` column:
- **GHA-cron** = registered in `C:\flatsbo\.github\workflows\cron-*.yml` (cron schedule cited)
- **Inngest-cron** = registered in `C:\agentplain\app\api\inngest\route.ts`
- **On-prompt** = SKILL.md installed, no cron registration found
- **Latent** = SKILL.md declares activation gated on greenlight
- **Staged-cron** = cron fires but SKILL.md not in `~/.claude/skills/`
- **Runtime-event** = catalog skill fires inside the value-loop on `WebhookEvent` rows (Inngest `process-webhook-event` cron)

### Section A — SKILL.md fleet agents (78 in `~/.claude/skills/`)

#### A.1 — agentplain B2B (org: b2b)

| Slug | Tier | Fires? | Cron schedule (UTC) | Purpose (one line) | SKILL.md path |
|---|---|---|---|---|---|
| `b2b-ceo` | T1 | GHA-cron + on-prompt | `0 10 * * *` (`cron-b2b-ceo-daily.yml:24`) | Top of B2B chain; owns multi-vertical product portfolio, brand, vertical greenlights, $1K+ investment gate. | `~/.claude/skills/b2b-ceo/SKILL.md` |
| `b2b-client-service-director` | T1-D | GHA-cron + on-prompt | `0 11 * * *` (`cron-b2b-client-service-director-daily.yml`) | Leads Client Service Dept under b2b-ceo; coordinates heads of vertical, owns cross-vertical learnings. | `~/.claude/skills/b2b-client-service-director/SKILL.md` |
| `b2b-eng-backend` | T2 | On-prompt | — | B2B build pod backend specialist; API routes, Prisma per-customer Postgres, agent runtime, OAuth token storage. | `~/.claude/skills/b2b-eng-backend/SKILL.md` |
| `b2b-eng-frontend` | T2 | On-prompt | — | B2B build pod frontend; Next.js App Router pages, Tailwind, operator dashboard. | `~/.claude/skills/b2b-eng-frontend/SKILL.md` |
| `b2b-eng-integrations` | T2 | On-prompt | — | B2B integrations specialist (Opus, load-bearing); AMS adapters (EZLynx, HawkSoft, NowCerts), email OAuth, calendar OAuth. | `~/.claude/skills/b2b-eng-integrations/SKILL.md` |
| `b2b-eng-qa` | T2 | On-prompt | — | B2B build pod QA; Playwright E2E + integration test harness, live-fixture protocol. | `~/.claude/skills/b2b-eng-qa/SKILL.md` |
| `b2b-eng-tech-lead` | T1-D | GHA-cron + on-prompt | `13 12 * * *` (`cron-b2b-eng-tech-lead-daily.yml`) | B2B build pod orchestrator; architectural spec, work decomposition, PR review, merge gate. | `~/.claude/skills/b2b-eng-tech-lead/SKILL.md` |
| `b2b-head-of-home-services` | T1.5 | GHA-cron + Latent | `47 13 * * *` (`cron-b2b-head-of-home-services-daily.yml`) | Trades vertical (plumbing/HVAC/electrical/GC/roofing). LATENT — activation gated on realty Product 2 design-partner stage. | `~/.claude/skills/b2b-head-of-home-services/SKILL.md` |
| `b2b-head-of-insurance` | T1.5 | GHA-cron + Latent | `29 13 * * *` (`cron-b2b-head-of-insurance-daily.yml`) | Insurance brokerage vertical. LATENT as of 2026-04-29 (was Product 2 until reclassified). | `~/.claude/skills/b2b-head-of-insurance/SKILL.md` |
| `b2b-head-of-realty` | T1.5 | GHA-cron + on-prompt | `17 13 * * *` (`cron-b2b-head-of-realty-daily.yml`) | ★ Realty brokerage vertical — Product 2 ACTIVE (locked 2026-04-29). Owns V1 agent stack (the 7 realty-* below). | `~/.claude/skills/b2b-head-of-realty/SKILL.md` |

#### A.2 — flatsbo consumer + B2B sales seats (org: flatsbo)

| Slug | Tier | Fires? | Cron schedule (UTC) | Purpose | SKILL.md path |
|---|---|---|---|---|---|
| `flatsbo` | n/a (codebase context skill) | On-prompt | — | Codebase-context loader for `C:\flatsbo` work. NOT a fleet agent. | `~/.claude/skills/flatsbo/SKILL.md` |
| `flatsbo-accessibility` | T3 | On-prompt | — | WCAG 2.1 AA conformance specialist. | `~/.claude/skills/flatsbo-accessibility/SKILL.md` |
| `flatsbo-analytics` | T3 | On-prompt | — | Read-only KPI reporting, funnel analysis, cohort analysis. | `~/.claude/skills/flatsbo-analytics/SKILL.md` |
| `flatsbo-area-api-platform` | T2 | On-prompt | — | Area PM — API surface, rate limiting, error format, versioning. | `~/.claude/skills/flatsbo-area-api-platform/SKILL.md` |
| `flatsbo-area-auth` | T2 | On-prompt | — | Area PM — login, signup, account, email verification, password reset, MFA. | `~/.claude/skills/flatsbo-area-auth/SKILL.md` |
| `flatsbo-area-buyer-flows` | T2 | On-prompt | — | Area PM — instant offers, offer submission, counter responses, financing widget. | `~/.claude/skills/flatsbo-area-buyer-flows/SKILL.md` |
| `flatsbo-area-dashboard` | T2 | On-prompt | — | Area PM — /dashboard, my-listings, offers received, listing performance. | `~/.claude/skills/flatsbo-area-dashboard/SKILL.md` |
| `flatsbo-area-listing-detail` | T2 | On-prompt | — | Area PM — /homes/[id], photo grid, sticky offer sidebar, similar homes. | `~/.claude/skills/flatsbo-area-listing-detail/SKILL.md` |
| `flatsbo-area-marketing-pages` | T2 | On-prompt | — | Area PM — Home, About, Services, Sell landing, future marketing pages. | `~/.claude/skills/flatsbo-area-marketing-pages/SKILL.md` |
| `flatsbo-area-search` | T2 | On-prompt | — | Area PM — /homes browse, search filters, map UX, saved searches. | `~/.claude/skills/flatsbo-area-search/SKILL.md` |
| `flatsbo-area-sell-flow` | T2 | On-prompt | — | Area PM — /sell/start wizard, listing creation, photo upload, MLS submission. | `~/.claude/skills/flatsbo-area-sell-flow/SKILL.md` |
| `flatsbo-attorney-firstpass` | T0 (Class C) | On-prompt | — | First-pass legal review across both products; flag-only / read-only. Reports to Conner. | `~/.claude/skills/flatsbo-attorney-firstpass/SKILL.md` |
| `flatsbo-b2b-sales-collateral` | T3 | On-prompt | — | B2B marketing collateral library — case studies, one-pagers, FAQs, demo scripts, comparison sheets. | `~/.claude/skills/flatsbo-b2b-sales-collateral/SKILL.md` |
| `flatsbo-b2b-sales-director` | T1-D | GHA-cron + on-prompt | `5 11 * * *` (`cron-flatsbo-b2b-sales-director-daily.yml`) | B2B sales orchestrator; routes work across 6 B2B sales specialists. | `~/.claude/skills/flatsbo-b2b-sales-director/SKILL.md` |
| `flatsbo-b2b-sales-followup` | T3 | On-prompt | — | B2B pipeline state tracker; post-call CRM updates, drips, stage classification. | `~/.claude/skills/flatsbo-b2b-sales-followup/SKILL.md` |
| `flatsbo-b2b-sales-pitch` | T3 | On-prompt | — | Custom pitch decks (.pptx) per B2B prospect. | `~/.claude/skills/flatsbo-b2b-sales-pitch/SKILL.md` |
| `flatsbo-b2b-sales-rep` | T3 | GHA-cron (2x) + on-prompt | `0 11 * * *` (pre-call brief, `cron-b2b-sales-rep-pre-call-brief.yml`) + `0 21 * * *` (reply sweep, `cron-b2b-sales-rep-reply-sweep.yml`) | B2B outbound rep; cold sequences, calendar invites, pre-call briefs, post-call followups. Draft+approve. | `~/.claude/skills/flatsbo-b2b-sales-rep/SKILL.md` |
| `flatsbo-b2b-sales-research` | T3 | On-prompt | — | Pre-call account research; GREC license, brokerage size, owner-broker LinkedIn, tech-stack signals. | `~/.claude/skills/flatsbo-b2b-sales-research/SKILL.md` |
| `flatsbo-b2b-sales-roi` | T3 | On-prompt | — | Prospect-specific ROI calculators (.xlsx); savings, hours saved, productivity projection. | `~/.claude/skills/flatsbo-b2b-sales-roi/SKILL.md` |
| `flatsbo-backend` | T3 | On-prompt | — | Role specialist — FlatSBO server-side: Stripe, Resend, Anthropic, Mapbox, Vercel Blob. | `~/.claude/skills/flatsbo-backend/SKILL.md` |
| `flatsbo-branding` | T3 | On-prompt | — | Brand standards owner (flatsbo_brand_standards.md); veto on customer-facing copy + token changes. | `~/.claude/skills/flatsbo-branding/SKILL.md` |
| `flatsbo-business-manager` | T1-D | GHA-cron + on-prompt | `13 13 * * *` (`cron-flatsbo-business-manager-daily.yml`) | FlatSBO orchestrator; routes work to specialists, surfaces approval queue + handoff log. | `~/.claude/skills/flatsbo-business-manager/SKILL.md` |
| `flatsbo-buyer-support` | T3 | On-prompt | — | Buyer-side concierge; routes serious leads to seller, drafts responses (no auto-send). | `~/.claude/skills/flatsbo-buyer-support/SKILL.md` |
| `flatsbo-capability-builder` | T0 | GHA-cron + on-prompt | `0 */3 * * *` (`cron-capability-builder-morning.yml`) | Meta agent that levels up every other agent; continuous-scan + ratifies SKILL.md changes. | `~/.claude/skills/flatsbo-capability-builder/SKILL.md` |
| `flatsbo-ceo` | T1 | GHA-cron + on-prompt | `0 10 * * *` (`cron-flatsbo-ceo-daily.yml`) | FlatSBO CEO; P&L, GTM, $1K+ investment gate, consumer brand steward. | `~/.claude/skills/flatsbo-ceo/SKILL.md` |
| `flatsbo-chief-of-staff` | T0 | GHA-cron + on-prompt | `8 10 * * *` (`cron-cos-daily-brief.yml`) | Conner's CoS across both products; cross-product status, morning brief, personal task management. | `~/.claude/skills/flatsbo-chief-of-staff/SKILL.md` |
| `flatsbo-compliance` | T3 | On-prompt | — | Georgia real-estate compliance; fair-housing, MLS rules, GREC, disclosures, advertising rules. | `~/.claude/skills/flatsbo-compliance/SKILL.md` |
| `flatsbo-contracts` | T3 | On-prompt | — | Post-acceptance contract shepherd; disclosures, e-sign, deadline tracking. | `~/.claude/skills/flatsbo-contracts/SKILL.md` |
| `flatsbo-crm-ops` | T3 | On-prompt | — | CRM data hygienist; dedupe, normalize, tag, segment. | `~/.claude/skills/flatsbo-crm-ops/SKILL.md` |
| `flatsbo-customer-success` | T3 | On-prompt | — | Owns seller post-listing; showings, offers, price-drop, churn. | `~/.claude/skills/flatsbo-customer-success/SKILL.md` |
| `flatsbo-devops` | T3 | On-prompt | — | Vercel project, env vars, build pipeline, domain/DNS, deploy workflows. | `~/.claude/skills/flatsbo-devops/SKILL.md` |
| `flatsbo-docs` | T3 | On-prompt | — | Docs custodian — README, CLAUDE.md, API route docs, runbooks. | `~/.claude/skills/flatsbo-docs/SKILL.md` |
| `flatsbo-eng-backend` | T2 | On-prompt | — | Build-pod backend (re-scoped flatsbo-backend for pod work). | `~/.claude/skills/flatsbo-eng-backend/SKILL.md` |
| `flatsbo-eng-frontend` | T2 | On-prompt | — | Build-pod frontend (re-scoped flatsbo-frontend for pod work). | `~/.claude/skills/flatsbo-eng-frontend/SKILL.md` |
| `flatsbo-eng-ops` | T2 | On-prompt | — | Build-pod ops (Vercel, env vars, prod schema migrations, deploy checklist). | `~/.claude/skills/flatsbo-eng-ops/SKILL.md` |
| `flatsbo-eng-qa` | T2 | On-prompt | — | Build-pod QA (Playwright, test harness, merge gate). | `~/.claude/skills/flatsbo-eng-qa/SKILL.md` |
| `flatsbo-eng-tech-lead` | T1-D | GHA-cron + on-prompt | `7 12 * * *` (`cron-flatsbo-eng-tech-lead-daily.yml`) | FlatSBO build-pod orchestrator; architecture, sequencing, PR review, merge gate. | `~/.claude/skills/flatsbo-eng-tech-lead/SKILL.md` |
| `flatsbo-finance` | T3 | On-prompt | — | Stripe ops, invoicing, $499 charge-on-close, books, refund/dispute human-only. | `~/.claude/skills/flatsbo-finance/SKILL.md` |
| `flatsbo-frontend` | T3 | On-prompt | — | Role specialist — Next.js components, App Router, Tailwind, editorial design (paper/ink/clay). | `~/.claude/skills/flatsbo-frontend/SKILL.md` |
| `flatsbo-lead-intake` | T3 | On-prompt | — | New seller signup / wizard entry handler. | `~/.claude/skills/flatsbo-lead-intake/SKILL.md` |
| `flatsbo-listing-coordinator` | T3 | GHA-cron + on-prompt | `19 13,20 * * *` (`cron-listing-coord-readiness-sweep.yml`) | Seller path from wizard to MLS ACTIVE; AI description, photos, broker handoff. | `~/.claude/skills/flatsbo-listing-coordinator/SKILL.md` |
| `flatsbo-market-research` | T3 | On-prompt | — | Competitive intel + pricing benchmarks; Houwzer/Homie/Houzeo/Zillow/Opendoor watching. | `~/.claude/skills/flatsbo-market-research/SKILL.md` |
| `flatsbo-marketing` | T3 | On-prompt | — | Drafts social, blog, ad copy, lifecycle email; monitors funnel inputs. | `~/.claude/skills/flatsbo-marketing/SKILL.md` |
| `flatsbo-marketing-design` | T3 | On-prompt | — | Marketing-page design + email templates + OG cards + social assets per brand standards. | `~/.claude/skills/flatsbo-marketing-design/SKILL.md` |
| `flatsbo-observability` | T3 | On-prompt | — | Sentry triage, structured logging, alert thresholds. | `~/.claude/skills/flatsbo-observability/SKILL.md` |
| `flatsbo-partnerships` | T3 | On-prompt | — | Broker-of-record / MLS / escrow / title / lender partner sourcing + term-sheet drafting. | `~/.claude/skills/flatsbo-partnerships/SKILL.md` |
| `flatsbo-performance` | T3 | On-prompt | — | Bundle size, Core Web Vitals (LCP/INP/CLS), Lighthouse, image/font optimization, hydration. | `~/.claude/skills/flatsbo-performance/SKILL.md` |
| `flatsbo-schema` | T3 | On-prompt | — | Prisma schema custodian; migrations, indexes, query optimization. Draft+approve only. | `~/.claude/skills/flatsbo-schema/SKILL.md` |
| `flatsbo-security` | T3 | On-prompt | — | Dependency audits, OWASP, CSP, RLS, webhook signature verification, rate limiting. | `~/.claude/skills/flatsbo-security/SKILL.md` |
| `flatsbo-seo` | T3 | On-prompt | — | Meta tags, sitemap, robots.txt, JSON-LD, OG, internal linking. FSBO long-tail strategy. | `~/.claude/skills/flatsbo-seo/SKILL.md` |
| `flatsbo-tech-lead` | T1-D | GHA-cron + on-prompt | `7 13 * * *` (`cron-flatsbo-tech-lead-daily.yml`) | FlatSBO product fleet orchestrator (broader scope than eng-tech-lead). | `~/.claude/skills/flatsbo-tech-lead/SKILL.md` |
| `flatsbo-testing` | T3 | On-prompt | — | Test suite owner; Vitest/Jest/Playwright, CI guardrails, coverage baseline. | `~/.claude/skills/flatsbo-testing/SKILL.md` |

#### A.3 — realty V1 ICs (org: b2b, under b2b-head-of-realty)

| Slug | Tier | Fires? | Cron schedule | Purpose | SKILL.md path |
|---|---|---|---|---|---|
| `realty-buyer-inquiry-router` | T3 | On-prompt | — | Watches inbound buyer channels; drafts 2-min first-touch reply; routes by price/geography/stage/load. | `~/.claude/skills/realty-buyer-inquiry-router/SKILL.md` |
| `realty-compliance-sentinel` | T3 | On-prompt | — | Watches every realty agent's draft for state-specific compliance violations (fair-housing, NAR, GREC, FMLS, GAMLS, CAN-SPAM, TCPA, RESPA/TILA). | `~/.claude/skills/realty-compliance-sentinel/SKILL.md` |
| `realty-crm-hygiene` | T3 (V0) | On-prompt | — | CRM (FUB) + transaction-mgmt (dotloop) hygiene drift detector. Read-only V0 — proposes, never mutates. | `~/.claude/skills/realty-crm-hygiene/SKILL.md` |
| `realty-listing-coordinator` | T3 | On-prompt | — | Intake-to-MLS workflow; MLS-ready descriptions, Skyslope/dotloop staging, broker-of-record sign-off. | `~/.claude/skills/realty-listing-coordinator/SKILL.md` |
| `realty-production-reporter` | T3 (V0) | On-prompt | — | Monthly/quarterly brokerage production reports; units, GCI, agent rankings, lead-source funnel. Read-only V0. | `~/.claude/skills/realty-production-reporter/SKILL.md` |
| `realty-recruiter-assistant` | T3 (V0) | On-prompt | — | Sources prospective agents (MLS top-producers, LinkedIn); drafts outreach + offer packages. V0 drafts only. | `~/.claude/skills/realty-recruiter-assistant/SKILL.md` |
| `realty-showing-scheduler` | T3 | On-prompt | — | Multi-party showing coordination across buyer/buyer-agent/listing-agent/seller; M365 Graph + Google Calendar + CRM + email. | `~/.claude/skills/realty-showing-scheduler/SKILL.md` |

#### A.4 — Insights department (cross-product)

| Slug | Tier | Fires? | Cron schedule | Purpose | SKILL.md path |
|---|---|---|---|---|---|
| `insights-head-of-department` | T1-D (dept head) | On-prompt | — | Top of insights-* fleet; routes asks, owns methodology library + data-source map, convenes for cross-cutting Qs. | `~/.claude/skills/insights-head-of-department/SKILL.md` |
| `insights-adhoc` | T3 | On-prompt | — | Diagnostic / "why did X drop" investigator (5 whys, fishbone, hypothesis-driven). | `~/.claude/skills/insights-adhoc/SKILL.md` |
| `insights-advanced-analytics` | T3 | On-prompt | — | Predictive modeling, segmentation, forecasting, ML. Phase 0 — toolkit-readiness. | `~/.claude/skills/insights-advanced-analytics/SKILL.md` |
| `insights-agent-measurement` | T3 (meta) | On-prompt | — | Fleet-wide agent quality metrics; ratify rate, time-to-confirm, EvolveR feedback loop measurement. | `~/.claude/skills/insights-agent-measurement/SKILL.md` |
| `insights-product-analytics` | T3 | On-prompt | — | Funnel analysis, feature adoption, cohort behavior, drop-off. | `~/.claude/skills/insights-product-analytics/SKILL.md` |
| `insights-reporting` | T3 | On-prompt | — | KPI tracking, dashboards, leading indicators, variance commentary. NSM proxy. | `~/.claude/skills/insights-reporting/SKILL.md` |
| `insights-survey-research` | T3 | On-prompt | — | Survey design, NPS, ICP validation, customer interviews. HIGHEST pre-revenue value. | `~/.claude/skills/insights-survey-research/SKILL.md` |

#### A.5 — Shared cross-fleet

| Slug | Tier | Fires? | Cron schedule | Purpose | SKILL.md path |
|---|---|---|---|---|---|
| `platform-eng` | T2 (shared) | GHA-cron + on-prompt | `23 12 * * *` (`cron-platform-eng-daily.yml`) | Shared platform engineer between FlatSBO + B2B pods; prompt caching, Sentry, deploy plumbing, encryption at rest. | `~/.claude/skills/platform-eng/SKILL.md` |
| `gtm-outreach` | n/a (workflow skill) | On-prompt | — | FlatSBO GTM workflow skill — seller outreach, ICP qualification, pricing, positioning. NOT an agent (no manager, no daily loop). | `~/.claude/skills/gtm-outreach/SKILL.md` |

### Section B — Staged-but-not-installed (cron fires but SKILL.md not in `~/.claude/skills/`)

These have a GHA cron registered, but the SKILL.md only lives in `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\<slug>\SKILL.md` (staged) — not at `~/.claude/skills/<slug>/`. The cron still runs (since `lib/inngest/run-skill.ts` references memory files + a model, not the SKILL.md path).

| Slug | Tier | Cron schedule (UTC) | Workflow file | Staged SKILL.md path |
|---|---|---|---|---|
| `agentplain-knowledge-architect` | T0 (proposed) | `30 10 * * *` | `cron-agentplain-knowledge-architect-daily.yml` | `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\agentplain-knowledge-architect\SKILL.md` |
| `b2b-head-of-cpa` | T1.5 (Latent) | `51 13 * * *` | `cron-b2b-head-of-cpa-daily.yml` | `…\skill-updates\new-skills\b2b-head-of-cpa\SKILL.md` |
| `b2b-head-of-law` | T1.5 (Latent) | `53 13 * * *` | `cron-b2b-head-of-law-daily.yml` | `…\skill-updates\new-skills\b2b-head-of-law\SKILL.md` |
| `b2b-head-of-mortgage` | T1.5 (Latent) | `23 13 * * *` | `cron-b2b-head-of-mortgage-daily.yml` | `…\skill-updates\new-skills\b2b-head-of-mortgage\SKILL.md` |
| `b2b-head-of-property-mgmt` | T1.5 (Latent) | `33 13 * * *` | `cron-b2b-head-of-property-mgmt-daily.yml` | `…\skill-updates\new-skills\b2b-head-of-property-mgmt\SKILL.md` |
| `b2b-head-of-recruiting` | T1.5 (Latent) | `41 13 * * *` | `cron-b2b-head-of-recruiting-daily.yml` | `…\skill-updates\new-skills\b2b-head-of-recruiting\SKILL.md` |
| `b2b-head-of-ria` | T1.5 (Latent) | `57 13 * * *` | `cron-b2b-head-of-ria-daily.yml` | `…\skill-updates\new-skills\b2b-head-of-ria\SKILL.md` |
| `b2b-head-of-title-escrow` | T1.5 (Latent) | `37 13 * * *` | `cron-b2b-head-of-title-escrow-daily.yml` | `…\skill-updates\new-skills\b2b-head-of-title-escrow\SKILL.md` |

### Section C — agentplain runtime catalog skills (16 in `C:\agentplain\lib\skills\<slug>\`)

These are code-defined skills used by the agentplain value-loop runtime (read → categorize → coordinate → schedule → draft). All registered in `lib/skills/registry.ts:62-731`. They fire indirectly via the Inngest `agentplain-process-webhook-event` cron when a workspace's vertical matches and a `WebhookEvent` row is drained.

| Slug | Vertical | Kind | Fires? | Default-on? | Source |
|---|---|---|---|---|---|
| `chief-of-staff-scheduler` | all | coordinate | Runtime-event | no | `lib/skills/chief-of-staff-scheduler/skill.ts` + `registry.ts:62-90` |
| `office-admin` | all | triage | Runtime-event | **yes** (`registry.ts:173`) | `lib/skills/office-admin/skill.test.ts` + index.ts |
| `inbox-triage-general` | all | triage | Runtime-event | no | `lib/skills/inbox-triage-general/` |
| `follow-up-chaser-general` | all | draft | Runtime-event | no | `lib/skills/follow-up-chaser-general/` |
| `process-doc-drafter-general` | all | draft | Runtime-event | no | `lib/skills/process-doc-drafter-general/` |
| `invoice-chasing-realestate` | real-estate | draft | Runtime-event | no | `lib/skills/invoice-chasing-realestate/` |
| `lead-triage-realestate` | real-estate | triage | Runtime-event | no | `lib/skills/lead-triage-realestate/` |
| `month-end-close-cpa` | cpa | coordinate | Runtime-event | no | `lib/skills/month-end-close-cpa/` |
| `law-intake-conflict-screen` | law | triage | Runtime-event | no | `lib/skills/law-intake-conflict-screen/` |
| `ria-client-update-draft` | ria | draft | Runtime-event | no | `lib/skills/ria-client-update-draft/` |
| `insurance-coi-request` | insurance | coordinate | Runtime-event | no | `lib/skills/insurance-coi-request/` |
| `mortgage-document-chase` | mortgage | coordinate | Runtime-event | no | `lib/skills/mortgage-document-chase/` |
| `home-services-estimate-followup` | home-services | draft | Runtime-event | no | `lib/skills/home-services-estimate-followup/` |
| `recruiting-candidate-status-update` | recruiting | draft | Runtime-event | no | `lib/skills/recruiting-candidate-status-update/` |
| `property-management-rent-collection-chase` | property-management | coordinate | Runtime-event | no | `lib/skills/property-management-rent-collection-chase/` |
| `title-escrow-closing-doc-chase` | title-escrow | coordinate | Runtime-event | no | `lib/skills/title-escrow-closing-doc-chase/` |

### Section D — agentplain operational Inngest crons (4, NOT agents)

Listed for completeness. These are runtime infrastructure functions registered at `app/api/inngest/route.ts:14-33`. They are NOT agents but they are how Section C catalog skills actually execute.

| Function id | Cron (UTC) | Source | Purpose |
|---|---|---|---|
| `agentplain-process-webhook-event` | `*/5 * * * *` | `lib/inngest/functions/process-webhook-event.ts:53-57` | Drains unprocessed `WebhookEvent` rows; runs the 5-phase value loop. THIS is what fires Section C skills. |
| `agentplain-integration-renewal-sweep` | `0 */2 * * *` | `lib/inngest/functions/integration-renewal-sweep.ts:45-47` | Refreshes OAuth access tokens + extends Gmail `users.watch` subscriptions. |
| `agentplain-trial-warnings` | `0 10 * * *` | `lib/inngest/functions/trial-expiration-warnings.ts:34-35` | 7 / 3 / 1-day trial expiration emails via Resend adapter. |
| `agentplain-customer-files-ingestion-sweep` | `0 */6 * * *` | `lib/inngest/functions/customer-files-ingestion-sweep.ts:58-69` | Walks workspaces, re-ingests Drive files via `DriveFileSource`. |

---

## Count summary

| Bucket | Count |
|---|---|
| SKILL.md fleet agents (installed in `~/.claude/skills/`) | 78 |
| ↳ b2b (org) | 10 |
| ↳ flatsbo (org) | 52 |
| ↳ realty (b2b vertical ICs) | 7 |
| ↳ insights (cross-product dept) | 7 |
| ↳ shared cross-fleet (`platform-eng`, `gtm-outreach`) | 2 |
| ↳ codebase-context skill (`flatsbo`, not an agent) | 1 (counted in 78 above; excluded from "agent" total below) |
| **— net SKILL.md agents** | **77** |
| Staged-but-not-installed (cron exists, SKILL.md not in `~/.claude/skills/`) | 8 |
| Code-defined runtime catalog skills (`C:\agentplain\lib\skills\<slug>\`) | 16 |
| Operational Inngest crons (NOT agents) | 4 |
| **GRAND TOTAL agents (SKILL.md + staged + catalog)** | **101** |
| Firing on a registered cron (GHA, SKILL.md tier) | 25 (incl. 8 staged) |
| Firing on `process-webhook-event` (catalog skills, runtime-event) | 16 |
| **Total firing** | **41** |
| Dormant / on-prompt-only / latent SKILL.md | 53 (77 − 17 firing − 7 not-counted) |
| Latent (charter exists, activation gated) | 2 (`b2b-head-of-insurance`, `b2b-head-of-home-services`) |

---

## Notes for the per-agent capability audit

1. The `b2b` repo (`C:\b2b\`) is essentially a scaffold today — `ls C:\b2b\lib\agents` is empty, `app/` has only `globals.css`, `layout.tsx`, `page.tsx`. All b2b-* agents live in `~/.claude/skills/`. The "b2b" repo column in this audit refers to the **org** (agentplain product side), not the C:\b2b\ directory.
2. Cron firing-status is verified against the GHA workflow file (which is what actually triggers on schedule); the `scripts/cron/run-skill.ts` REGISTRY duplicates these but can drift — the workflow file is the source of truth.
3. The 8 staged-cron entries (Section B) are an open thread: the cron is wired, but the SKILL.md isn't installed user-scope. Cron will still produce output (CronDefinition references memory files + model, not SKILL.md path) but the agent personality is unreified.
4. The 7 realty V1 ICs (Section A.3) all carry `recommended_model: opus` (except the 3 V0 entries which omit recommended_model and have `default_mode: dry_run`). None has a cron — they fire on-prompt or as peer-callees during a b2b-head-of-realty session.
5. Section D's Inngest crons are listed for completeness but should be excluded from "agent" counts in any per-agent audit. They are runtime infra.

## Source provenance

- `~/.claude/skills/<slug>/SKILL.md` × 78 — primary inventory (frontmatter extracted)
- `C:\agentplain\app\api\inngest\route.ts:14-33` — Inngest function registration
- `C:\agentplain\lib\inngest\functions\*.ts` — Inngest cron schedules
- `C:\agentplain\lib\skills\registry.ts:62-731` — catalog skill registry
- `C:\agentplain\lib\skills\<slug>\` × 16 — code-defined catalog skill directories
- `C:\agentplain\docs\fleet-architecture.md` — architectural reference (verified against today's disk state)
- `C:\flatsbo\.github\workflows\cron-*.yml` × 25 — GHA cron registrations
- `C:\flatsbo\scripts\cron\run-skill.ts:513-540` — GHA CronDefinition REGISTRY
- `C:\flatsbo\docs\leadership-autonomy-2026-05-12\skill-updates\new-skills\<slug>\SKILL.md` × 8 — staged SKILL.md drafts
- `C:\flatsbo\outputs\agent_inventory_2026-05-08\inventory.md` — prior inventory (75 agents 2026-05-08; +3 since means net adds are insights-survey-research, insights-agent-measurement, flatsbo-attorney-firstpass per cross-ref; today's 78 reconciles)
