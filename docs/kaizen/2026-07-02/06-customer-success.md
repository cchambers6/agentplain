# Kaizen — Customer Success / Support Retro

**Date:** 2026-07-02
**Paying customers:** 0 — this retro grades the CS machinery we've pre-built, not live outcomes.
**Method:** code inspection on `origin/main` (f928400), merged-PR history, `docs/customer-success/playbook.md` + `research-engine.md` (both v1, 2026-06-14), and the 2026-07 audit memory files (audits 6, 9, 10).
**Memory note:** `feedback_customer_vocab_not_engineer` was read and is reflected below. Two memory files named in the task brief — `feedback_conner_time_max_tier_only` and `feedback_dashboard_feedback_loop` — **do not exist** in the memory index. Their substance is recoverable from artifacts: the Conner-time rule is codified in `docs/customer-success/playbook.md` §0/§5 ("Conner-time is Max/Custom only"), and the dashboard/feedback-loop thinking lives in `docs/customer-success/research-engine.md` §3–4. Cited from those artifacts, not from memory.

> Every claim below cites a file, PR, or audit memory. Nothing is invented.

---

## 10 things we've built for CS

1. **A first-response SLA that lives in code, not copy.** `lib/support/tickets/sla.ts` defines P0 1h / P1 4h / P2 24h / P3 48h, computes per-ticket deadlines, detects breach (`isSlaBreached`), and tests the customer-facing promise string *verbatim* so it can't drift. One source of truth for the load-bearing promise.

2. **A real internal ticket lifecycle with Plaino L1 triage.** `lib/support/tickets/` (classify → create → routing → notify via `pageHuman`, Prisma-backed store) plus the customer surface at `app/(product)/app/workspace/[id]/support/{new,tickets}`. The support-handler skill drafts replies **into the approvals queue** (`lib/support/resolve-reply.ts`, `lib/inngest/functions/support-handler-on-create.ts`) — Plaino answers first, a human approves, and it signs as Plaino, never claiming to be human.

3. **The approvals queue as the activation home base.** Rebuilt in PR #243 (`app/(product)/app/workspace/[id]/approvals/*` with discipline filtering). The playbook's single activation metric — one approved draft in 48h — is measurable directly off `WorkApprovalQueueItem`.

4. **Self-serve onboarding with a first-fire watch and a welcome tour.** The wizard fires picked skills immediately on submit (`lib/inngest/functions/onboarding-first-fire.ts`) so the customer watches real drafts land, backstopped by `onboarding-backfill-pick-skills.ts`; PR #281's spotlight tour (`components/onboarding/WelcomeTour.tsx`, `lib/onboarding/tour-steps.ts`) is non-blocking by design.

5. **Proof-of-value surfaces on a cadence.** Daily briefings (`briefings-generator-sweep.ts`, ~9am ET workdays, mutable per workspace) and the Friday "here's what Plaino did for you this week" ROI email (`weekly-customer-report-sweep.ts`) — retention surfaces built before there's anyone to retain.

6. **Trial and billing lifecycle automation already running.** `trial-expiration-warnings.ts` (7/3/1-day warnings, double-fire-guarded), `stripe-dunning-sweep.ts`, `stripe-abandoned-signup-sweep.ts`, and `unsupported-vertical-refund-sweep.ts` — the mechanical churn causes (card decline, forgotten trial, wrong-vertical signup) have automated handling.

7. **A guarantee with teeth.** PR #300's walk-away (`lib/guarantee/`: saved-time tracking, day-7 walk-away offer, auto-refund, and `delete-customer-data.ts` for clean exits). Refund-without-argument is codified, not aspirational. (Known defect — see gap 10.)

8. **Degraded-mode honesty as a product feature.** PR #276's universal Plaino-resting banner (`lib/plaino/degraded-mode.ts` + the talk surface) tells customers the truth when the LLM is down, and the playbook builds the entire design-partner expectation-setting on it (§0: "set this expectation *before* signup").

9. **A closed feedback loop on the richest signal.** `customer-feedback-drift-sweep.ts` aggregates draft-edit corrections weekly into `CapabilityProposal` rows *and* shows the customer "what we learned from your feedback" in their briefing. This is exactly the signal `research-engine.md` §2 calls the richest data source — and it's already mined.

10. **A written, tier-respecting CS operating system.** `docs/customer-success/playbook.md` (touch cadence, churn-defense sequences, Max-only Conner-time, CS↔Sales handoff) and `research-engine.md` (survey cadence, feedback schema, health-score spec, advisory-council rules) — v1 before customer #1, so the first design partner gets a rehearsed motion, not improvisation.

Also on main and CS-relevant: the customer portal (#299), team layer (#301), and voice layer (#304) expand the surface area — but see gap 9 before counting the portal as an asset.

---

## 10 gaps that will bite when we DO have customers

*(The task brief assumed "no ticketing" — false: an internal ticket lifecycle with SLAs exists (built #1–2 above). The real gaps are sharper.)*

1. **hello@ is a one-way street.** Nothing ingests inbound email — no inbound-parse, no IMAP, nothing (verified: zero hits repo-wide). A customer who *replies* to any CS email lands in a personal inbox outside the ticket store, where `isSlaBreached` can't see the message. The 24h promise is only enforceable for tickets filed in-app.

2. **No human live-chat channel.** Plaino chat (`talk/`) is product-scoped; when Plaino escalates, the only human channel is async email. There is no human-takeover surface, so a frustrated customer mid-crisis has nowhere synchronous to go — fine per the tier rules for Regular/Partner, fatal for a Max design partner promised "same-day."

3. **No NPS/CSAT — the surveys are specs.** The week-1 / week-4 / month-3 survey cadence in `research-engine.md` §1 has no implementation; the only "CSAT" in the codebase is an internal team-member performance metric (`lib/team/performance.ts`). We'd have zero systematic sentiment signal from customer one.

4. **No per-customer health score or churn-risk detection.** `research-engine.md` §4 is a complete spec — six weighted components, G/Y/R thresholds, alert rules — with zero implementation. Every input already exists in Prisma (`WorkApprovalQueueItem`, `IntegrationHealthCheck`, `Subscription`, ticket store). Spec'd 2026-06-14, untouched since.

5. **No activation alerting.** The playbook's day-3 "stuck?" nudge and the zero-approvals-in-7-days alert (§4.1 calls it "the strongest predictor") have no cron. We'd learn a trial went dark by reading the database by hand.

6. **No reactivation/win-back motion.** Playbook §4.4 defines it; nothing implements it. `workspace-teardown-sweep.ts` tears down, no cancel-exit survey is wired into cancellation, and nothing re-engages at day 30 or when a waitlisted vertical goes live.

7. **No expansion motion.** §3.5's triggers — seat-count-vs-tier, second-workflow surfaced, Max-upsell ask — have no detection anywhere. Expansion revenue would depend entirely on Conner noticing.

8. **No customer-facing changelog or "you asked, we shipped" notes.** 289 PRs merged in 60 days and zero customer-visible release notes. `research-engine.md` §3.4 calls closing the loop "the highest-retention action available to us"; the drift sweep closes it for draft edits only — shipped features have no mechanism.

9. **No feedback landing store.** The §3.1 `Feedback` schema (source/theme/verbatim/severity/roadmap-link) was never stood up in Linear, Notion, or anywhere. Ticket verbatims, survey answers, and cancel reasons have no shared home, so the ≥3-customers-across-≥2-accounts roadmap rule cannot run.

10. **Two CS-critical surfaces shipped with known P0s.** The portal (#299) is 0%-activatable with owner edits silently discarded, blind approvals, and upload bytes dropped — and its tables sit outside RLS, deletion coverage, and CI (audits 6 & 10; fixes in PRs #327/#330). The guarantee's saved-time math has no writer for 4/7 calibrated actions, so sweeps read 0 minutes and can trigger **wrongful walk-away refunds**, and the 7-day walk-away vs 14-day money-back is unreconciled (audit 9, PR #328). First customers inherit both unless those PRs land first.

---

## Top 5 process fixes to bake in BEFORE the first paying customer

1. **Make hello@ a triaged queue with a stated cadence.** Until inbound ingestion exists (investment 1): twice-per-business-day triage ritual; every inbound reply gets logged into the matching ticket thread by hand so SLA tracking sees it. Publish the 24h promise only on channels the ticket system can actually observe.

2. **Wire SLA breach escalation and measure attainment.** A daily sweep over `isSlaBreached` → `pageHuman` for P0/P1, task for P2/P3; a weekly SLA-attainment line in the kaizen loop. We built the promise; nothing yet notices when we break it. Don't market "24h response" until we've measured a month of keeping it.

3. **Institute the Friday synthesis as a standing ritual.** `research-engine.md` §3.2 already prescribes it: read the week's drift-sweep proposals, weekly-report tapes, and ticket log; write the one-paragraph "what we heard / what it means / what we're doing" to the memory inbox. Design partners each get one personal line from their own tape. This is the weekly touchpoint — async, tier-clean, and it starts the feedback muscle before there's volume.

4. **Codify escalation criteria and refund authority.** What pages Conner *now*: P0/P1 tickets (classifier exists), integration dark >72h, any guarantee/refund event. What waits for next business day: everything else. And until audit 9's saved-time writers land, **auto-refund runs in human-review mode** — a wrongful automatic refund on customer #1 is an unforced error.

5. **Stand up the feedback-to-product loop for real.** Create the `Feedback` store per §3.1 (Linear — engineering already lives there), route ticket/cancel/survey verbatims into it from day one, and enforce the ≥3-customers-across-≥2-accounts rule at roadmap triage. The drift sweep proves the loop pattern works; extend it beyond draft edits.

---

## Top 3 investments

1. **Plain (or Intercom) for the support front-door — buy the inbound, keep our system-of-record.** This closes gaps 1 and 2 in one move: shared inbox with real email ingestion (fixes the hello@ one-way street) plus a chat widget with human takeover for Max-tier moments. Per the living-portable rule, it feeds `lib/support/tickets/` via a webhook adapter rather than replacing it — our SLA code, Plaino L1 triage, and approvals-queue drafting stay the brain; the vendor is the mailroom. Plain's API-first shape fits the adapter pattern better; Intercom wins if we want the widget + help-center bundle. Decide when the first Max design partner signs.

2. **ProductBoard-lite = Linear + the §3.1 schema, not a new tool.** The feedback store, the ≥3-customer roadmap rule, and close-the-loop notes need a database and a ritual, not a $12k/yr platform at 0 customers. Linear custom fields cover the schema; the Friday synthesis (process fix 3) is the triage motion; the "you asked, we shipped" note (gap 8) falls out of `roadmap_link` + `status=closed-loop-sent`. Graduate to ProductBoard when feedback volume outgrows a weekly human pass.

3. **Churn detection: implement the health score we already spec'd — build, not buy.** `research-engine.md` §4 as a daily Inngest sweep: all six weighted components map to tables already on main, following the exact pattern of `integration-health-sweep.ts`. G/Y/R badge on an internal ops view, plus the two hard alerts (zero-approvals-7d, integration-dark-72h) routed as CS tasks. A churn-prediction vendor has nothing to model at n<10 customers; our own usage signals are the whole story.

---

*Revisit this retro when customer #1 converts: the gaps ranked here are ordered by "bites first," and that ordering is a guess until real customers order it for us.*
