# Observed P0 list — ranked by dollars of broken partner relationship

> From the SAMPLE dry-run in this folder. Every finding verified against `origin/main @ 4565a7b` (call-site greps and cron expressions cited inline in files 01–05). Ranking logic: the pilot's currency is the partner's trust and the reference it becomes; a P0's "dollar" cost is how much of that it burns, times how often, times how invisible it is until it fires.

**Four P0s. Combined smallest-fix estimate: 14–23 engineering hours.** All four are fixable before convert week produces a real Day 0.

---

## P0-1 — The after-hours notification never reaches the partner

- **What broke:** the promise made twice on the Day-1 call ("you'll get a notification that a reply is drafted and waiting") is structurally undeliverable. Two stacked gaps: (a) the lead-triage approval path (`PrismaLeadTriageApprovalSink`, fed by the hourly FUB sweep) never calls `notifyApprovalQueued` — its only call site is the inbox chain in `lib/skills/persist-artifacts.ts`; (b) the only channel `notifyApprovalQueued` has is mobile push to registered device tokens, and the mobile app has never shipped (EAS blocked, PR #167). There is no email fallback. A design partner cannot receive an approval notification by any means.
- **Where in the runbook:** Day-1 doc 01, Segment 3 config row ("Approval notifications: On, to their phone/email, and tested") and success criterion 2; doc 02's entire notification-loop watch; Segment 5's planted expectation.
- **Why it matters:** this is the sold premise. Week 1 survives on Conner's manual morning messages (doc 02's trigger table), which means the founder is impersonating the product — sustainable for one partner, invisible to her, and a silent lie the first morning he's late. Day-1 success criterion 2 is unmeetable as written, so the runbook's own gate fails on every activation until this lands.
- **Smallest fix:** an email notification on approval-queued, reusing the existing transactional email seam (`lib/email`, Resend provider): one `notifyApprovalQueued`-shaped call that sends "a reply is drafted and waiting" to the broker-owner's email, invoked from **both** creation paths (persist-artifacts and the lead-triage sink). Push stays as a future channel; email is the one the partner actually has. Respect quiet hours by sending immediately (the premise IS the after-hours ping — the owner chooses phone-glance or morning coffee, per Segment 5).
- **Estimated hours:** 6–10 (notify seam + two call sites + template in report-email style + tests).

## P0-2 — The first Friday report tells the partner nothing happened

- **What broke:** the weekly customer report (cron `0 12 * * 5`, ≈8am ET Friday) reports the **prior completed Mon–Sun week** (`resolveReportedWeek`). For any partner activated on a Monday — the runbook's canonical calendar — the first email reports the pre-activation week: the honest quiet-week render, sent (the sweep sends `isEmpty` weeks; it does not skip them). Sarah approves drafts all week, then Plaino's first-ever email to her says the week was quiet.
- **Where in the runbook:** Day-0 welcome template plants the promise ("Friday morning you'll get an email showing what it did all week"); Day-4 prep item 2 discovers it; the Day-5 call opener ("is it lying?") detonates it.
- **Why it matters:** the weekly email is the ratified retention heartbeat (unified plan 2.7) and the artifact the Friday call runs on. Its first beat contradicting the partner's lived week is a trust own-goal at the exact moment the reporting relationship is born — and it recurs for **every** future partner's week 1, forever, until fixed.
- **Smallest fix:** a first-report gate in `sendWeeklyReportForWorkspace`: skip until one full Mon–Sun week post-activation has completed (activation timestamp is queryable, unified-plan item 1.11), and the runbook's Day-4 prep sends Conner's manual week-1 note instead — template already exists (`docs/sales/weekly-report-2026-07-11/03-golden-examples.md`). Bigger alternative (activation-to-date window for the first report) is better product but is not the smallest fix.
- **Estimated hours:** 3–4 (gate + skip-reason counter + test), plus one runbook line making the manual week-1 note standard.

## P0-3 — The killer workflow writes no saved-time ledger rows

- **What broke:** `recordSavedTime` has exactly two production call sites: the inbox chain (`lib/skills/persist-artifacts.ts`) and the demo seed — which credits `lead-enrichment` + `drafted-email` **by hand**, because the path it demonstrates doesn't. In production, every FUB-sweep lead-triage run produces a draft and credits zero minutes. The Friday counter, the weekly report's hours figure, the Day-7 guarantee math, and case-study field 5 all undercount the exact workflow the partner was sold.
- **Where in the runbook:** doc 02's silent-check item 3 names this outcome "a P0 to Engineering today"; doc 03's data-walk gut-check makes it partner-visible; the capture framework's rule 4 forces a permanent asterisk (doc 06 of this dry-run shows the asterisk in situ).
- **Why it matters:** the saved-time number is the first number the partner ever scrutinizes and the spine of the eventual case study. Undercounting is the survivable direction (we're honest, we say so) — but "our headline number omits our headline workflow" is only tellable once, and the case study cannot lead with an asterisk in month 3.
- **Smallest fix:** in the lead-triage persistence path (sink or sweep, wherever the run is durably confirmed), call `recordSavedTime` for `lead-enrichment` and — when a first-touch draft exists — `drafted-email`, with `source` = the FUB event/lead id (the idempotency key the ledger already supports), mirroring exactly what the seed does by hand. The seed then stops hand-crediting and exercises the production writer, closing the demo/prod divergence the seed's own header warns about.
- **Estimated hours:** 3–5 (two write calls + idempotent source + tests; the calibration entries already exist).

## P0-4 — Nothing syncs Follow Up Boss at connect time

- **What broke:** the first lead-triage fire after Sarah pastes her key waits for the **hourly** cron (`FOLLOW_UP_BOSS_SYNC_CRON = '0 * * * *'`). No connect-time sync: the onboarding first-fire handler runs at wizard step 4 (before FUB is connected in the call's order) and has no lead-triage runner in its map regardless. Connect at 10:37, first fire 11:00 — the Day-1 script's "watch the first fire land, live" beat lands in dead air more often than not.
- **Where in the runbook:** Day-1 Segment 3 (the live fire) and Segment 4 (queue seeding). The inbox path masks it on the call — which is why it ranks fourth, not first.
- **Why it matters:** the activation call is unrepeatable, and its designed peak (the partner's own lead flow appearing in the product) currently depends on the clock cooperating. There is a manual workaround (fire the sweep's trigger event from the operator side), but it is undocumented and Conner-only.
- **Smallest fix:** on successful FUB key verification, enqueue the sweep's existing trigger event scoped to that workspace. One event emit at the end of the connect route; the sweep already tolerates per-workspace runs.
- **Estimated hours:** 2–4 (emit + scope handling + test). Interim zero-code mitigation: document the manual event fire in the runbook's call-morning checklist.

---

## Sequencing note

P0-2 and P0-3 are prerequisites for wiring the weekly-report narrative writer (`docs/sales/weekly-report-2026-07-11/00-README.md`, wiring gate). P0-1 is the largest and the only one that adds a new customer-facing surface (an email template) — it should go through the voice-gate like any other customer copy. All four fit inside one focused engineering wave before convert week's first real Day 0.
