# What CS must STOP (or never start) — the discipline half of the plan

Design-for-profitable means CS's cost line stays at ~$0 cash and single-digit founder-hours while the first partners activate. Every item below is something we are tempted to do because it's *good CS practice at scale* — and wrong at n=0–5 because it consumes the only two scarce inputs (fleet capacity, Conner's hours) that the activation path needs. Each has a **restart trigger** so nothing is killed forever; it's parked with a tripwire.

---

## 1. No support surface for non-RE customers — ratified kill, restated as CS policy

No CPA/law/general onboarding, no vertical support templates beyond the one waitlist reply (`03-support-playbook…` §5), no non-RE trial hand-holding, no exceptions for a friendly CPA who "just wants to try it." The playbook's five-vertical machinery (day-1 emails ×5, per-vertical touch cadences) is written and parked — we run exactly one vertical's worth of it.
**Restart trigger:** 2 RE pilots activated and the sales plan reopens CPA/law lanes (sales deep-dive doc 01).

## 2. Client portal stays off — and CS never speaks of it

Ratified kill. Audit 6: 5 P0s — owner edits silently discarded, cross-tenant upload injection, degraded mode eating client messages, blind approvals, uploads whose bytes are discarded behind "received." A broker who hears "your clients get a branded portal" and then watches it eat a client's message would be a reference-killer, not a reference. CS does not demo it, mention it on calls, or include it in any recap email.
**Restart trigger:** PRs #327/#330 land AND a design partner asks for it unprompted AND Product re-scopes it. All three.

## 3. No self-serve knowledge base / help center build-out

Zero customers have asked zero questions. A KB written now documents guesses; every real answer we give a partner IS the KB accruing in the ticket store and the Friday synthesis — with question frequency attached. Writing 40 articles today is fleet capacity spent making the empty theater look staffed.
**Restart trigger:** the same question answered 3× across ≥2 customers → that answer (and only it) becomes the first article.

## 4. No support tooling purchases — Plain, Intercom, Zendesk, ProductBoard, churn tools

Kaizen 06's investment analysis stands (buy the mailroom, keep our brain) — but its own decision rule was "decide when the first Max design partner signs." Nobody has signed anything. The folder scheme + hand-ticket rule costs $0 and 20 min/day, and — decisively — it keeps every early support interaction in front of the founder's eyes, which at this stage is a feature, not a limitation.
**Restart trigger:** >10 support emails/day, or the first Max customer, or Conner misses the triage ritual 3 days running (`03` §7).

## 5. No CS automation ahead of its data — health score, NPS/CSAT surveys, expansion triggers, win-back sequences

All spec'd (research-engine §1/§4, playbook §3.5/§4.4), all correctly ranked by kaizen — and all pointless before there is a customer to score, survey, expand, or win back. Worse than pointless: a health score tuned on zero customers is fiction with a dashboard, and surveying partner #1 with a form instead of asking on the weekly call would actively damage the founder-access promise. At n≤3, the weekly call is the survey; Conner's daily 10-minute check is the health score; the save-motion in `02` is the churn model.
**Restart trigger:** n≥5 paying-or-pilot customers, or the first week Conner's manual check misses something a cron would have caught.

## 6. No new CS strategy documents, audits, or retros

The CEO kill list (#348) kills new audit/retro loops company-wide; CS complies enthusiastically. We have a playbook (v1), a research-engine spec (v1), a kaizen retro, and now this pack. The next CS document worth writing is **the case study** — which requires a partner, not a planning cycle. This pack itself commits to producing no successor until a partner is activated or 30 days pass, whichever comes first.
**Restart trigger:** partner #1's week-4 review — one page, written from real usage data, replaces speculation with evidence.

## 7. No CS hours on flatsbo

flatsbo stays live (kill #3 overridden) but is explicitly not a CS priority. No flatsbo support playbooks, no flatsbo inbox ritual, no flatsbo onboarding work from this seat. Inbound flatsbo mail gets forwarded, not worked (`03` §5).
**Restart trigger:** Conner reprioritizes explicitly. Not before.

## 8. No published SLA numbers on channels we can't measure

The 24h promise lives in code for in-app tickets only. hello@ has no ingestion and therefore no measurement, so its promise stays verbal ("same business day") and unpublished. Do not put response-time numbers on the marketing site, in onboarding emails, or in the partner letter beyond what `lib/support/tickets/sla.ts` can actually observe and enforce (kaizen 06, fix 1 + fix 2's "don't market it until we've measured a month of keeping it").
**Restart trigger:** inbound ingestion exists and one month of measured attainment says we keep the promise we want to print.

---

## The point, in one line

Every hour CS doesn't spend on items 1–8 is an hour available for the only work that moves the profit equation this quarter: **making the first partner's first month so good they'll say so on the record.**
