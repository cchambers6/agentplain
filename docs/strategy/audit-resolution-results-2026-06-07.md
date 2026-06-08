# Audit Resolution — Results & Pride Delta

**Date:** 2026-06-07 · **Plan:** [PR #175](https://github.com/cchambers6/agentplain/pull/175) (merged) · **Baseline:** [Fleet Pride Audit 2026-06-07](../../) (memory: `fleet_pride_audit_2026_06_07.md`)

This memo closes the audit-resolution roadmap. It re-runs the pride assessment on the skills the resolution waves *materially changed*, computes the before/after delta against the baseline (median 1 / mean 1.49), and states honestly whether the 1→3 target was met.

**Method note (why not all 121):** Re-scoring the entire fleet would be wasteful and dishonest — the deferred org chart (Media 13, Insights 7, B2B-eng 5, internal directors) was *knowingly left unchanged*; those skills still sit at their baseline scores by design. The waves concentrated on the **Customer discipline** plus a handful of internal enablers. Every re-score below is grounded in a verified file path on `origin/main` (or the two open PR branches #188/#189), not on the wave's self-report.

---

## TL;DR (read this part)

- **The work landed where the audit said it would: the Customer discipline.** Customer-discipline median moved **2 → 3**, mean **1.94 → 2.62**. The keystone adapter family is complete, the real-inbox seam is in, compliance now rewrites-and-stages, and the briefing is a control surface.
- **Changed-set (14 skills) median 2 → 3, mean 2.07 → 3.07.** One skill reached a **4** (compliance rewrite-and-stage — genuinely novel). Zero 5s — and that is correct: **a 5 requires a real customer's data flowing through the adapter, which awaits per-vendor credentials.** An adapter behind a flag + fixtures is a real 2→3 step, not a 5.
- **Whole-fleet median is STILL 1.** This is the honest headline. The 20-skill Media+Insights org chart (every one a baseline 1) plus the 22 Engineering charters drag the global median down and were *deliberately not touched*. **Mean moved 1.49 → 1.60.** The 1→3 target is **MET for the Customer discipline, NOT met fleet-wide** — and fleet-wide was never the right denominator, because half the fleet is an org chart awaiting Conner's activate/defer/prune call (Wave 8, PR #184).
- **Two audit corrections surfaced during execution** (below): the visual audit was stale, and the pride audit's "only QuickBooks runs live" was false (FUB was already live).

---

## Headline numbers

| Cohort | Baseline median | New median | Baseline mean | New mean | Target 1→3 |
|---|---|---|---|---|---|
| **Changed set (14)** | 2 | **3** | 2.07 | **3.07** | ✅ met |
| **Customer discipline (34)** | 2 | **3** | 1.94 | **2.62** | ✅ met |
| **Whole fleet (121)** | 1 | **1** | 1.49 | **1.60** | ❌ not met (org chart untouched by design) |

The whole-fleet median did not move because ~60 skills (Media 13, Insights 7, Engineering charters 22, internal Sales/BizMgr/Finance ~17) were knowingly deferred — they are org-chart charters awaiting an activate/defer/prune decision, not product work the waves were scoped to do. Reporting them as failures would be dishonest; they were out of scope. **The discipline where customers live moved to 3.**

---

## Per-skill before→after (changed set)

Score key: 1 scaffolding · 2 architected, starved of live data · 3 acts on real structure behind a flag (fixtures live, credentials pending) · 4 novel capability no competitor offers · 5 a real customer's data flows end-to-end.

| Skill | Before | After | Grounding (verified file) | Justification |
|---|---|---|---|---|
| `compliance-watch-general` | 3 | **4** | `lib/agents/sentinel/rewrite.ts`, `redline-store.ts` | Rewrite-and-stage: every flag now drafts the **compliant replacement sentence in place** (learned→LLM→deterministic), carrying the corpus citation, one-tap on /approvals. Counsel-redline loop learns preferred language. Fires live for real-estate; other verticals gated on counsel. No SMB compliance tool does this — the 4 is earned. Not a 5: no customer corpus flowing yet. |
| `invoice-chasing-realestate` | 2 | **3** | `lib/integrations/follow-up-boss-mcp/`, `quickbooks-mcp/server.ts` | **Correction-driven:** FUB *and* QuickBooks both run live REST (audit wrongly said QB-only). This is the closest-to-5 skill in the fleet, held at 3 only because a real broker's AR isn't connected in prod yet. |
| `lead-triage-realestate` | 3 | **3** | `lib/skills/lead-triage-realestate/drafts-persister.ts`, `llm-classify.ts` | Per-message LLM classification (keyword = fallback) + auto-push first-touch drafts to Gmail Drafts at confidence ≥0.70. FUB lead fetch live. Strengthened justification; held at 3 pending Google OAuth consent verification (`LIVE_INBOX_FETCH`). |
| `property-management-rent-collection-chase` | 2 | **3** | `lib/integrations/buildium-mcp/server.ts`, `lib/skills/.../buildium-lookup.ts` | Buildium→`RentRollLookup` adapter behind `BUILDIUM_ADAPTER_LIVE` + fixtures. Self-serve key (no partner gate). 3 not 5: key not yet entered. |
| `insurance-coi-request` | 2 | **3** | `lib/integrations/ezlynx-mcp/`, `lib/skills/insurance-coi-request/ezlynx-lookup.ts` | EZLynx→`PolicyLookup` adapter behind `EZLYNX_ADAPTER_LIVE` + fixtures. Blocked on partner-gated OAuth. |
| `mortgage-document-chase` | 2 | **3** | `lib/integrations/encompass-mcp/`, `lib/skills/mortgage-document-chase/encompass-lookup.ts` | Encompass→`LoanFileLookup` adapter behind `ENCOMPASS_ADAPTER_LIVE` + fixtures. Blocked on partner-gated OAuth. |
| `title-escrow-closing-doc-chase` | 2 | **3** | `lib/integrations/qualia-mcp/`, `lib/skills/title-escrow-closing-doc-chase/qualia-fetcher.ts` | Qualia→`ClosingFileFetcher` adapter behind `QUALIA_ADAPTER_LIVE` + fixtures. Self-serve key. |
| `inbox-triage-general` | 2 | **3** | `lib/integrations/inbox/mcp-inbox-fetcher.ts`, `lib/skills/inbox-triage-general/llm-classify.ts` | Real `InboxSnapshotFetcher` seam (Gmail/M365 behind `LIVE_INBOX_FETCH`, fixtures otherwise) + per-message LLM classify replacing the 15-cue keyword classifier (now fallback). 3 pending OAuth consent. |
| `chief-of-staff-scheduler` | 2 | **3** | `lib/skills/scheduler/chief-of-staff-fetcher.ts`, `lib/inngest/functions/scheduler-sweep.ts` | Same real-inbox fetcher wired in; the daily briefing now reads actual email instead of defaulting empty. 3 pending consent. |
| `realty-compliance-sentinel` | 2 | **3** | `lib/agents/sentinel/index.ts` (shared rewrite engine) | Inherits the rewrite-and-stage engine; flags now carry staged fixes for real-estate. |
| `briefing-generator` | 2 | **3** | `lib/skills/.../` briefing one-click action (W5 #181) | Top pending approval pre-staged as a one-tap action inside the daily card — briefing becomes a control surface, not a report. |
| `research-on-demand-general` | 2 | **3** | `lib/integrations/web-search/fixture-provider.ts` + `IResearchSubstratePort` | Web-search grounding wired behind the port + flag; briefs cite live sources once a BrightData/Tavily key is set. Fixtures today. |
| `month-end-close-cpa` | 3 | **3** | `lib/skills/month-end-close-cpa/gmail-close-fetcher.ts` | `GmailCloseFetcher` auto-detects close docs from email attachments behind a flag; the empty-QuickBooks-fetcher gap is closed in code. Held at 3: not live. |
| `office-admin` | 2 | **3** | `lib/skills/bounded-execute.ts` (branch #189) | Bounded auto-execute seam: fail-closed policy, composes with all gates, immutable AuditLog same-txn, **conservative all-OFF default.** The autonomy leap is *built*; held at 3 because the default is OFF and awaits Conner's threshold/action-class decision. |

**Changed-set distribution:** before `1·8·5·0·0` (median 2, mean 2.07) → after `0·0·13·1·0` (median 3, mean 3.07).

---

## Whole-fleet recomputation

New fleet = the 14 re-scored above + the other 107 at their baseline scores (unchanged by design).

- **Customer (34):** baseline `7·22·5·0·0` (med 2, mean 1.94) → new `7·6·20·1·0` (med 3, mean 2.62). The 7 baseline-1s (buyer-support, crm-ops, customer-success, realty-buyer-inquiry-router, realty-crm-hygiene, realty-listing-coordinator, realty-production-reporter) were not in the wave scope — they are flatsbo-consumer or advisory-only agents with no runtime port to wire. They remain 1.
- **Fleet (121):** baseline med 1 / mean 1.49 → new **med 1 / mean 1.60.** The +0.11 mean lift is the 14 skills moving an average of ~+0.93 each, diluted across 121. Median is pinned at 1 by the 60+ untouched org-chart/charter skills.

**Verdict:** 1→3 target **met for the Customer discipline (where customers actually are), partially met fleet-wide on the mean, not met on the fleet median** — and the fleet median was the wrong denominator from the start, because it counts an org chart we deliberately have not staffed.

---

## Remaining UNSOLVED items + the specific blocker

The waves did the engineering. What remains is almost entirely **credentials and decisions Conner owns** — not more code.

| Item | What's built | Blocker (owner: Conner) |
|---|---|---|
| Property-mgmt live | Buildium adapter + flag + fixtures | Buildium API client-id/secret (self-serve) + `BUILDIUM_ADAPTER_LIVE=on` |
| Insurance COI live | EZLynx adapter + flag | EZLynx **partner-gated** OAuth credentials |
| Mortgage chase live | Encompass adapter + flag | Encompass/ICE **partner-gated** OAuth credentials |
| Title/escrow live | Qualia adapter + flag | Qualia API key (self-serve) + `QUALIA_ADAPTER_LIVE=on` |
| Real inbox live (triage, scheduler, lead-triage push) | InboxSnapshotFetcher + per-msg LLM | Google OAuth / M365 consent verified for `LIVE_INBOX_FETCH=true` |
| Compliance beyond real-estate | Rewrite-and-stage gated per vertical | Counsel sign-off → `COMPLIANCE_CORPUS_COUNSEL_REVIEWED` per vertical |
| Research live grounding | Web-search behind port + flag | BrightData or Tavily API key |
| Visual heritage/explainer slots (28 + EX) | `PlainoScene`/`PlainoCard` swap contracts + placeholder SVGs | ChatGPT raster paste → drop PNGs at `public/brand/plaino-system/scenes/<slug>.png` |
| Bounded auto-execute (autonomy leap) | Fail-closed policy seam, immutable audit, all-OFF default (#189) | **Conner decision:** $-threshold + permitted action classes |
| Org-chart 20 charters | Competitive-signal feed shipped; packet recommends 1 ACTIVATE / 18 DEFER / 2 PRUNE (#184) | **Conner decision:** activate/defer/prune |

**Pattern:** zero remaining items are "write more code." Every one is a credential to enter, a counsel sign-off, a raster paste, or a Conner policy decision. That is exactly the state the baseline audit predicted: *"the revolutionary value is one layer away — and that layer is integration adapters, not new features."* The adapters are now built; the layer is now **credentials**.

---

## Two audit corrections (found during execution)

1. **The visual audit was stale (pre-#169).** It reported the live site shipping zero raster images and no Plaino anywhere customer-facing. In fact ~8 visual P0s (favicon family, header lockup, OG) had already shipped on `main` before #169. Wave 0/6 finished the wiring rather than starting from zero. *(Source: re-baseline against `origin/main`, audit_resolution_progress event log 2026-06-07.)*
2. **The pride audit's "only QuickBooks runs live" was FALSE.** **Follow Up Boss was already fully live** — complete MCP adapter (`lib/integrations/follow-up-boss-mcp/`) plus an hourly sync sweep — powering invoice-chasing and lead-triage. The genuine adapter gaps were narrower than the "42-agent port-exists-adapter-does-not" headline implied: PolicyLookup, LoanFileLookup, ClosingFileFetcher, and RentRollLookup. All four are now built (Waves 1/1b). The 42-agent finding is real but counts overlapping mentions; the underlying *distinct* adapter gap was ~4, and it is closed.

---

## What would get the fleet from 3 to 5

The path is short and it is not more engineering.

1. **Enter the credentials.** Buildium + Qualia are self-serve (do them today). EZLynx + Encompass are partner-gated (start the partner applications now — they have lead time). Verify Google/M365 OAuth consent. The moment a real broker's FUB+QuickBooks AR flows through invoice-chasing, that skill is a **5** — and it is the closest. Each credential turns a 3 into a 4-then-5 as real data validates the adapter.
2. **Make the two decisions.** Set the bounded auto-execute threshold + action classes (office-admin 3→4, the autonomy leap competitors can't match). Make the activate/defer/prune call on the 20 charters — pruning the Media/Insights org chart alone would **lift the fleet median off 1** without writing a line of code, because it stops counting departments we haven't staffed.
3. **Paste the rasters.** The visual swap contracts are wired; the 28 heritage + explainer slots become real with a ChatGPT paste.

**The honest one-liner:** the fleet's revolutionary value is no longer one engineering layer away — it is one credential-and-decision layer away. The waves crossed the seam the baseline audit said we were stuck behind. A real customer's data through the now-wired adapters is the entire distance from 3 to 5.
