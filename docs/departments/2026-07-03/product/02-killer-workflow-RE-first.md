# THE killer workflow for real estate: after-hours lead triage

**The pick: lead-triage** — an after-hours buyer lead is caught the moment it lands, enriched, answered with a personalized draft and two showing windows, and logged in the CRM, all waiting for one approve.

## 1. Why lead-triage, and why the other two lose

| Candidate | Verdict | Reason |
|---|---|---|
| **Lead-triage** | **THE ONE** | Already built and canonical: `lib/workflows/verticals/real-estate.ts` + the locked registry headline ("Every lead gets a first touch in 5 minutes", `lib/plaino/killer-workflow.ts`). Deterministic, ~0 LLM calls — legal under the "no LLM-dependent features while the key is paused" kill rule. The pain is universal (every broker loses deals to slow first response), the trigger is frequent (~2 after-hours leads/day assumed in the story's `runsPerTrial: 14`), and the value math clears $199/mo without straining (§3) |
| Listing-copy | Rejected | Drafting listing descriptions is an LLM-shaped task with no deterministic fallback — it cannot demo or run honestly against a paused key. Building it now violates kill rule #5. Revisit as an expansion workflow post-un-pause |
| Offer-comparator | Rejected | Doesn't exist in the runtime, the registry, or the synthetic datasets — it is new surface area, banned outright. Also lower frequency (offers arrive weekly, leads daily): a killer workflow must fire often enough during a trial to build a habit |

The deeper principle: **the killer workflow was chosen by the codebase and ratified by the mandate months ago.** Re-picking it every planning cycle is the drift this loop is supposed to kill. This document's job is to make the existing pick *provably worth $199/mo*, not to relitigate it.

## 2. The workflow, specified

**Trigger:** a new lead event from Follow Up Boss (the `unlockedBy` provider) landing outside the broker's response window — evenings, weekends, mid-showing.

**Inputs**
| Input | Source | Required? |
|---|---|---|
| Lead record (name, contact, inquiry text, property of interest) | FUB api-key connection (customer's own key — BYO rule) | Yes — the unlock |
| Broker's open calendar windows | Google/M365 calendar if connected | No — degrades to "propose two windows for the broker to confirm" |
| Listing context (address, status, price) | The inquiry payload itself; MLS enrichment explicitly out of scope (kvCORE/FMLS are frozen, 05) | Payload only |
| Per-action minute calibration | `ACTION_MINUTES` in `lib/workflows/runtime.ts` | Yes — the honesty substrate |

**Steps** (the shipped story, `realEstateStory()`): catch (read, 2 min) → enrich (5 min) → draft first-touch (draft-email, 10 min) → propose two showing times (schedule, 6 min) → log to CRM (update-record, 4 min). **27 calibrated minutes saved per lead.**

**Outputs**
1. A drafted, personalized first-touch reply in the **Approvals queue** — the broker approves, and their own system sends (no-outbound architecture).
2. Two proposed showing windows attached to the draft.
3. A CRM update draft (lead tagged, next step set, thread filed).
4. A **saved-time ledger entry** via `recordSavedTime` — this writer MUST fire on this path (audit 09 P0-1); the workflow that sells the product cannot be the one that undercounts it.
5. An approval **notification** (push/email) — the after-hours premise collapses if the broker only discovers the draft next morning by accident.

## 3. The $199/mo case (why this is profitable by design)

**Cost side — near-zero COGS.** The triage pipeline is deterministic: ~0 LLM calls in the shipped runtime (personalization comes from templated composition over the lead payload today; richer drafting upgrades transparently when the key un-pauses). Modeled marginal runtime cost ≈ $0; the Stripe fee is the largest COGS line (CEO 01). At $199 Regular, contribution ≈ $185/seat. **Every incremental seat is ~93% contribution — the workflow scales without a single cost conversation.**

**Value side — two independent justifications, either alone clears the price:**
1. **Time, calibrated:** 27 min/lead × ~2 after-hours leads/day ≈ 54 min/day ≈ **~27 hours/month** of coordination work, counted by the conservative per-action table, not vibes. At any defensible hourly value for a licensed agent's time, that is several times $199. The trial's saved-time counter shows this number accruing from real runs — the renewal case writes itself into the ledger.
2. **Speed-to-lead, the industry's own obsession:** brokers already believe (and repeat to each other) that response speed decides which agent gets the client. We don't need to assert a conversion statistic we can't source (Truth-Wave rule) — the pitch is structural: *your leads currently wait until morning; with this they never wait past the next approval glance.* One incremental closed transaction a year — one commission — pays for the subscription many times over. The broker does that math themselves; the product just has to make the mechanism visible.

**Guarantee coupling:** because every run writes calibrated minutes, the walk-away guarantee evaluates against real accrual — the workflow funds the guarantee's honesty instead of leaking refunds (audit 09 P0-1 inverted into margin defense).

## 4. Demo state (works today, paused key and all)

- **When:** `isDemoMode(pendingApprovals=0, handoffs=0)` — every fresh workspace (`lib/demo/demo-mode.ts`).
- **What:** the runtime player autoplays `realEstateStory()` on the synthetic RE dataset (Marcus Pope, 418 Peachtree Way) — trigger, five steps with live step details, saved-time counter ticking calibrated minutes. Zero LLM, zero I/O, works in an airplane-mode demo on a discovery call.
- **Honesty affordances:** labeled as a demonstration on sample data; the counter says what it counts ("minutes a person would have spent, per action"); the story ends on the Connect card, converting the demo into the activation ask.
- **Sales use:** this IS the discovery-call demo named in the sales plan (deep-dive 00 §3.3, PR #303). Product commits to keeping it demoable offline — it is the only proof asset that requires zero customers.

## 5. Live state under the paused key (design-partner window)

Between connect and prod-key un-pause, the workflow runs its deterministic spine honestly: leads are caught, logged, and queued with template-composed drafts; the dashboard shows **Watching / Working** truthfully (03) and the degraded notice says drafting quality upgrades when the pilot starts. No feature on this path may silently require the key (kill rule #5); anything that does is out of scope until un-pause.

## 6. Demo→live cutover (the moment that must not fumble)

When Conner books the first discovery call, the un-pause decision fires (CEO 04, decision 3, recommendation B). Product-side readiness, verified in advance: (a) FUB credential verify green on a real key, (b) first real lead event produces an approval + notification + saved-time entry end-to-end on a staging workspace, (c) demo mode steps aside automatically the moment the first real approval exists (already the `isDemoMode` contract). A signed design partner stalled at activation is the most expensive failure this product can produce — this checklist is the insurance.
