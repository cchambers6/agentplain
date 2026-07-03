# 06 — Pipeline stages, forecasting, and the weekly review

**Design intent:** stages fitted to a service partnership sold by a founder — not a cargo-culted SaaS funnel. Few stages, hard entry criteria, next-action dates on every row, and a forecast that counts what we actually need (design partners now, MRR later). Lives in the CRM of record (document 03); this file is the schema and the operating manual.

---

## 1. Stages

| # | Stage | Entry criterion (hard — no vibes) | Exit to next | Weight |
|---|---|---|---|---|
| 0 | **LIST** | On the prospect list (doc 01 spec), enriched, lane open | First touch sent | — |
| 1 | **FIT** | First touch sent; not disqualified | Replied with interest OR booked | 5% |
| 2 | **DISCOVERY** | Discovery call booked or held | Call held + qualified (04 §4) + agreed to hear program terms | 20% |
| 3 | **DP-TALK** | Program terms presented on a call; prospect engaging with the asks (weekly call, testimonial, case study) | Verbal yes to terms incl. asks | 40% |
| 4 | **AGREEMENT** | Verbal yes; agreement/letter out for signature; kickoff date proposed | Signed + kickoff booked | 75% |
| 5 | **ACTIVATION** | Signed; stack check underway (Google/M365 + QBO connected, prod key live, measurement verified writing) | First drafts in their queue + first weekly call held | 90% |
| ✓ | **ACTIVE PILOT** | Drafts flowing, weekly cadence running | → CONVERTED (paid) or PARTED at month 3 | 100% of a partner slot |
| ✕ | **NOT-YET / LOST** | Named blocker + revisit date / clean no + verbatim reason | Re-enters at FIT on the revisit date | 0% |

Rules: a row can only skip forward on evidence (warm referral may enter at DISCOVERY). Every non-terminal row has a **next action + date** — a row without one is by definition stuck. Weights are prior guesses; from week 3, replace with observed conversion between stages and say so in the review notes.

## 2. Forecasting — two ledgers, kept separate

**Ledger A — partner forecast (the one that matters through day 90):**
`expected partners = Σ (stage weight) across rows at DISCOVERY or later.`
Target trajectory per 00 §2: ~1.0 by day 30 → ~2.5 by day 60 → 3–5 signed by day 90. If expected-partners is below trajectory two Fridays running, the fix is at the *top* (more sends, warmer paths) — not more pressure on mid-stage rows.

**Ledger B — weighted MRR-equivalent (reporting only until conversions start):**
Each row carries its tier-fit estimate from the discovery call (Regular/Partner seat count → monthly value at published pricing; **compute from `lib/pricing/tiers.ts` figures via the pricing page — never restate a price table in the CRM**). `weighted MRR = Σ (stage weight × tier-fit monthly value)`, with design partners counted at their *post-conversion* value and a conversion haircut (start at 60% pilot→paid; replace with observed). Report it, don't steer by it — through day 90 it is a sanity check that the pipeline is worth money at all, roughly $2.0–2.5k weighted by day 90 if the partner ledger is on track.

**What is never forecast:** revenue before a signed conversion exists; pipeline value from rows that haven't had a discovery call; anything derived from open rates or "sentiment."

## 3. Weekly review — Friday, 15 minutes, same six numbers

1. Sends this week (target: 5) and cumulative
2. Replies + calls booked (and observed FIT→DISCOVERY rate vs the 1-in-5 prior)
3. Stage movements (rows advanced / newly stuck / lost — with reasons verbatim)
4. Expected partners (Ledger A) vs day-30/60/90 trajectory
5. Rows with no next-action date (must be zero by end of review)
6. One learning fed back into docs 01/04 (ICP note, objection, agenda change) — the review isn't done until something was learned or explicitly nothing was

Monday's fleet run consumes the review's output: new prospects to research, follow-ups due, revisit dates arriving.

## 4. Stuck definitions + unstick plays

| Stage | "Stuck" means | The unstick play |
|---|---|---|
| FIT | T+21 sequence exhausted, no reply | Close to NOT-YET with source noted; do **not** extend the sequence — 4 touches is the designed maximum; recycle only on a new warm path or real trigger event |
| DISCOVERY | Booked call no-showed ×2, or "interested" but won't book for 14 days | One rebook with the recorded walkthrough offered as the async alternative ("15 minutes, watch it whenever") — then NOT-YET with a date |
| DP-TALK | Engaged but won't accept the asks (testimonial/case-study reluctance) | Name the trade plainly: the free pilot *is* payment for proof. Offer standard trial at published pricing as the no-asks alternative (`lib/billing/facts.ts` mechanics) — a paying customer who won't be referenced is a fine outcome, just not a partner slot |
| AGREEMENT | Verbal yes, unsigned for 10+ days | The blocker is almost always the paper or the calendar: offer the short-letter path (02 §4 interim), propose two kickoff dates. If still unsigned at 21 days, back to DP-TALK honestly |
| ACTIVATION | Signed but stack not connected for 14+ days | Founder does the connection *with* them on a screen-share as that week's call; if the blocker is on our side (prod key, connector), say so, give a date, and stop the pilot clock — their 3 free months start at activation, not signature |
| ACTIVE PILOT | Weekly call missed ×2 or approval rate collapsing | The call is the product's heartbeat at this stage: async Loom + written check-in once, then a direct "is this still worth your time?" conversation. A pilot going quiet is a case study dying — treat it as the week's top priority |

## 5. Reporting format (board/investor-safe, monthly)

One page, five lines, every number traceable to the CRM or instrumentation:

1. **Partners:** signed N of 3–5 target · active pilots N · expected partners (Ledger A) N.N
2. **Motion:** sends N (vs 5/wk plan) · discovery calls held N · observed stage-conversion rates vs priors
3. **Proof:** case studies in flight N (fields actually filling) · on-record quotes held N
4. **Money:** weighted MRR-equivalent (Ledger B, method stated) · actual MRR (will be $0 until ~day 90–120 — print the zero; the zero is the honest baseline the later numbers stand on) · GTM stack cost this month (doc 03)
5. **Learned:** the 2–3 verbatim market facts from lost/not-yet reasons and the §7 playbook log — the qualitative line investors actually remember

Banned from this report: open rates, impressions, "conversations started," un-dated "verbal commitments," any pipeline value from pre-discovery rows, and rounded-up anything. If a number would embarrass us when a partner reads it, it doesn't ship — the reporting discipline is the same honesty spine the product sells.
