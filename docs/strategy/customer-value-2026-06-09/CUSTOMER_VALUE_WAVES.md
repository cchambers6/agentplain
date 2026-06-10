# Customer-Value Mandate — 2026-06-09

**The bar (set by Conner):** every wave answers ONE question — *"Does this make an SMB owner measurably more successful in their business this month?"* Self-score 1–5 on "would an owner with a real $10K/mo problem say holy shit." Below 4 → don't open the PR.

**The thesis (from the pride audit, PR #174):** the fleet's median pride is 1/5 not because the skills are bad but because they're starved — "the port exists, the adapter does not" (42 of 121 agents, near-identical words). The cheapest path to revolutionary is NOT new features. It is: **pick the ONE workflow per vertical an owner would pay $500/mo for, and make it run end-to-end on their real data.**

**Ground rules for every wave:**
- PR title: `cv-<vertical>: <killer-workflow> — owner outcome: <one line>`
- PR body leads with the owner outcome, not the code change
- Playwright/curl proof required; LLM-dependent paths stay flag-gated while `ANTHROPIC_API_KEY` is sentinel-paused, with `[POST-KEY-RESTORE]` verification steps written down
- No-outbound architecture holds: Plaino stages into the owner's own execution path; it never sends

---

## The 10 verticals — one killer workflow each

### 1. General — "Wake up to chased invoices" 🟢 NOT GATED → WAVE FIRED
- **Killer workflow:** overdue-AR chase that runs itself. QuickBooks AR sweep → aging detection → chase email drafted per invoice (tone escalates with age) → `FOLLOW_UP_NUDGE` auto-executes under the bounded-execute allowlist → every chase logged to the value ledger with $ attached.
- **Owner outcome:** "~20 overdue invoices chased every week without you touching them; your weekly digest shows dollars recovered." Average SMB carries $84K in unpaid invoices (industry stat used in our own marketing); even 10% recovery is $8K+/mo — 40× the subscription.
- **Already built:** QuickBooks integration is LIVE (`lib/integrations/quickbooks-mcp/`, real REST verified PR #143). `follow-up-chaser-general` skill exists. `FOLLOW_UP_NUDGE` is ON the bounded-execute reversibility allowlist (`lib/skills/bounded-execute.ts`, estUsd 0). Value ledger seam exists (`lib/measurement/value-impact.ts`, PR #193).
- **Missing:** the four pieces are not wired into ONE loop — chaser doesn't read live QB AR end-to-end, chase outcomes don't write value-impact rows, no owner-visible "$ recovered" surface.
- **Effort:** 1 day. **Gates:** none.

### 2. Real estate — "Every lead gets a first touch in 5 minutes" 🟢 NOT GATED → WAVE FIRED
- **Killer workflow:** FUB lead lands → triage (hot/warm/cold) → first-touch reply drafted and STAGED instantly → owner taps send. Speed-to-lead is the #1 conversion lever in residential RE (5-min response ≈ 21× qualification rate vs 30 min — the stat our own vertical page cites).
- **Owner outcome:** "Zero leads go cold in your CRM. Every inquiry has a ready-to-send personal reply waiting before you've seen the notification."
- **Already built:** Follow Up Boss adapter is LIVE (verified in audit-resolution results 2026-06-07 — "only QuickBooks live" was false, FUB is live too). `lead-triage-realestate` has a `drafts-persister.ts`.
- **Missing:** the sync sweep still drops drafts on the floor — `lib/inngest/functions/follow-up-boss-sync-sweep.ts:156` hardcodes `persister: null` (hubspot and salesforce sweeps have the same hole at :147/:144).
- **Effort:** 0.5–1 day. **Gates:** none (LLM-classified triage flag-gated until key restore; deterministic cue path works today).

### 3. CPA — "Month-end close that assembles itself" 🟡 PARTIAL → WAVE FIRED (non-gated path)
- **Killer workflow:** the close checklist populates from real practice-management data. TaxDome/Karbon read dispatch (both LIVE, read-only, full contract — PR #148) + QuickBooks → checklist seeded with actual client docs received/missing → missing-doc chase drafts staged.
- **Owner outcome:** "The worst week of your month starts 80% done: every client folder shows received vs missing, and the chase emails for the missing ones are already drafted."
- **Already built:** `month-end-close-cpa` skill with real close logic; TaxDome + Karbon dispatch surfaces; QuickBooks live.
- **Missing:** close fetcher defaults to fixture/empty; TaxDome/Karbon read path not wired into it. The Gmail-attachment doc-detector (`GmailCloseFetcher`, pride theme #12) IS gated on Gmail consent — excluded from this wave, noted as the unlock upgrade.
- **Effort:** 1–1.5 days. **Gates:** none for the TaxDome/Karbon path; Gmail consent unlocks the attachment detector later.

### 4. Home services — "No estimate dies unanswered" 🟢 NOT GATED → WAVE FIRED
- **Killer workflow:** every open QuickBooks estimate gets a persistent, polite follow-up cadence until accepted/declined. Estimates are where trades lose silent money — the owner sent a $6K quote and forgot to follow up.
- **Owner outcome:** "Every quote you send gets followed up at day 2, 5, and 10 until the customer answers. Closing even 1 extra $5K job/mo pays for Plaino 25×."
- **Already built:** `home-services-estimate-followup` skill; QuickBooks LIVE (QBO API exposes Estimate objects on the same OAuth we already hold).
- **Missing:** an estimate fetcher on the live QuickBooks seam (today the skill draws from fixture).
- **Effort:** 1 day. **Gates:** none.

### 5. Law — "Never take a conflicted client" 🟢 NOT GATED → WAVE QUEUED
- **Killer workflow:** intake → deterministic conflict screen against the workspace's matter/contact index → clear/flag verdict with cited matches → engagement-letter draft staged on clear.
- **Owner outcome:** "Every new client is conflict-screened in seconds with an audit trail — the thing that takes your paralegal an hour and risks your license when skipped."
- **Already built:** `law-intake-conflict-screen` skill with screening logic.
- **Missing:** real matter-index ingestion path (customer-files import exists as seam); verdict card surface.
- **Effort:** 1 day. **Gates:** none (deterministic matching; LLM disambiguation flag-gated).

### 6. Insurance — "COI in 4 minutes, not 4 hours" 🔴 READY ON UNLOCK: EZLynx/HawkSoft OAuth (partner-gated)
- **Killer workflow:** certificate-of-insurance request email → policy lookup → ACORD 25 drafted + staged same-hour. COI turnaround is the single most-cited service complaint in small-agency reviews.
- **Already built:** `insurance-coi-request` behind `PolicyLookup` port; `ezlynx-mcp` interface layer.
- **Missing:** the live adapter — blocked on EZLynx partner OAuth (Conner gate #2). Wave is WRITTEN (spec in this doc), not fired.
- **Effort on unlock:** 1–2 days.

### 7. Mortgage — "The file chases itself" 🔴 READY ON UNLOCK: Encompass OAuth (partner-gated)
- **Killer workflow:** loan-file missing-conditions sweep → per-borrower document chase drafts with plain-English explanations → staged. LOs spend ~40% of their time chasing docs.
- **Already built:** `mortgage-document-chase` behind `LoanFileLookup`; `encompass-mcp` interface.
- **Missing:** live adapter — Encompass partner program (Conner gate #2). **Effort on unlock:** 1–2 days.

### 8. Property management — "Rent collects itself politely" 🔴 READY ON UNLOCK: Buildium key (self-serve — fastest unlock available)
- **Killer workflow:** rent-roll sweep → late-rent sequence (reminder → notice → owner-escalation) drafted per tenant, compliance-screened by sentinel, staged.
- **Already built:** `property-management-rent-collection-chase` behind `RentRollLookup`; `buildium-mcp` interface; PM compliance corpus.
- **Missing:** Buildium API key — SELF-SERVE signup (Conner gate #1, ~15 min). Highest-leverage unlock on the board. **Effort on unlock:** 1 day.

### 9. Title/escrow — "No closing slips on a missing doc" 🔴 READY ON UNLOCK: Qualia key (self-serve)
- **Killer workflow:** closing-date sweep → per-file missing-doc matrix vs days-to-close → prioritized chase drafts staged.
- **Already built:** `title-escrow-closing-doc-chase` behind `ClosingFileFetcher`; `qualia-mcp` interface.
- **Missing:** Qualia API access (Conner gate #1). **Effort on unlock:** 1 day.

### 10. RIA — "Quarterly client letters, compliance-clean, in one tap" 🔴 READY ON UNLOCK: ANTHROPIC_API_KEY restore
- **Killer workflow:** quarterly update drafts per client household, sentinel-screened against the RIA corpus (perf-claim + testimonial rules), staged for one-tap review.
- **Already built:** `ria-client-update-draft`; RIA sentinel corpus with AUM/marketing rules.
- **Missing:** this one is genuinely LLM-shaped (drafting IS the product) — paused with the key. No custodian feed in V1 (owner pastes holdings summary; that's acceptable for the letter use-case).
- **Effort on unlock:** 1 day + `[POST-KEY-RESTORE]` harness.

---

## Cross-vertical leverage waves (Phase 3 — fire when 5+ verticals READY)

1. **Trust loop / per-workspace autonomy (FIRED EARLY — it gates everything):** bounded-execute (`lib/skills/bounded-execute.ts`) keys policy off fleet-wide `AUTO_EXEC_<KIND>` OpsFlag rows — confirmed on origin/main 2026-06-09. One customer's comfort level becomes every customer's policy. Fix: workspace-scoped policy resolution (scoped flag keys, NO schema migration) + per-workspace settings surface + "what Plaino did autonomously last week" audit view. This is the foundation $-threshold confidence compounds on.
2. **Proof loop:** weekly "what Plaino did for you" digest off `lib/measurement/value-impact.ts` — hours saved + $ influenced per workspace, owner-facing.
3. **Activation loop:** the vertical's killer workflow surfaces as the FIRST Plaino "what next" card (`lib/plaino/next-steps.ts` + `visual-card.ts`) within 10 minutes of onboarding.

## Dropped from this build (below the bar) → FUTURE
- Media/Insights org-chart activation (20 charters, all pride-1): no customer touches them. FUTURE.
- New verticals / new skill categories: violates "finish locked verticals first."
- Visual-asset wiring beyond pre-staged slots: blocked on Conner's ChatGPT P0 sheet paste.

## Conner action queue (unchanged from #198, re-ranked by value-per-minute)
1. **Buildium key (~15 min, self-serve)** → unlocks vertical 8 same-day
2. **Qualia access** → unlocks vertical 9
3. **`ANTHROPIC_API_KEY` restore** → unlocks vertical 10 + every LLM-classified path
4. **Gmail/M365 consent** → upgrades CPA close (attachment detector) + inbox triage
5. **EZLynx/Encompass partner OAuth (slow, start now)** → verticals 6–7
6. **Merge queue:** #196 (copy, zero-risk), #197–#200 (night3), then cv-* PRs as they pass CI
