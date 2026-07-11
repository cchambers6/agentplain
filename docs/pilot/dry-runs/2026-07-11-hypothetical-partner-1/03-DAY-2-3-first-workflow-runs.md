# Days 2–3 — Tuesday Jul 21 / Wednesday Jul 22, the silent watch

> SAMPLE — not a real partner. See `00-README.md`.

Runbook under rehearsal: `docs/pilot/week-1-runbook/02-DAY-2-3-first-workflow-run.md`. The scenario gives Sarah a real Tuesday night: a Zillow buyer inquiry lands in her Follow Up Boss at 9:41pm.

## What actually happens to the 9:41pm lead (traced through main)

1. **10:00pm** — the hourly FUB sweep fires, sees the lead, runs the production triage skill, and `PrismaLeadTriageApprovalSink` writes a PENDING approval card with a drafted reply. **The catch-and-draft works.** Nineteen minutes of sweep latency is fine against a morning-coffee habit. ✅
2. **10:00pm** — the card lands **silently**. No `notifyApprovalQueued` call on this path, and no channel that could reach Sarah even if there were one (P0-1, established Day 1). The runbook's proactive-touch table has a trigger for exactly this moment (*"the first after-hours lead gets caught and drafted → Conner sends…"*), so **Conner's manual message the next morning is the only notification the premise has.** During week 1 with founder-speed checks, the experience survives. It is not a product yet; it is Conner performing the product.
3. **10:00pm** — the sink writes the card but **no saved-time ledger rows**. Verified: `recordSavedTime` has exactly two production call sites, `lib/skills/persist-artifacts.ts` (inbox chain) and the demo seed — which credits `lead-enrichment` + `drafted-email` by hand, because the production path doesn't. The killer workflow runs and the ledger stays flat. The runbook's own silent-check item 3 names this outcome a **P0 to Engineering today**; the dry-run confirms it fires on the very first lead. **P0-3.**

## The silent checks (8:30am / 5:30pm, the four queries)

All four are answerable from durable rows on main: approval-queue rows per skill ✅, queue opens and decisions with timestamps ✅, connection health + erring runs ✅, spend vs the $5 daily cap via the budget snapshot ✅. The check *discipline* is fully supported by the instrumentation. The check's item 3 (ledger writing on completed actions) turns red on Day 2 morning, exactly as designed — the runbook's monitoring catches the runbook's P0. That is the system working.

## The proactive touches, replayed

- **Wednesday 7:10am** — Conner sends the first-after-hours-lead message: "A lead came in at 9:41 last night — the reply's drafted and waiting in your queue." Sarah opens the queue at 7:40 with her coffee, edits the draft's sign-off, approves. The habit the pilot rides on **forms anyway**, because the morning-coffee contract (Day 1 Segment 5) never depended on the push notification. The runbook's redundancy here is what saves week 1.
- **Wednesday, same day** — per the edit trigger, Conner sends the "that's exactly how it learns your voice" line. Manual, executable. ✅
- One template wording issue: the trigger message says the draft "took [N] minutes of work off your plate." With the ledger flat on this path (P0-3), **there is no honest N to put in that bracket.** Conner either fabricates a number (banned) or rewrites the message without it. The template needs the number made optional until P0-3 closes. Folded into P0-3's fix.

## What Conner watches for (the judgment layer)

- **Draft quality:** readable at n=1 by opening every card. ✅ supported.
- **Edit pattern:** visible via edited-before-approve rows. ✅
- **Time-of-day truth:** Sarah's Tuesday lead was genuinely after hours; the premise holds for the sample. Instrumentation (proposedAt timestamps) supports the check. ✅
- **The notification loop:** the runbook asks "did the after-hours notification actually produce a phone-glance approval?" — for this partner the answer is structurally **no, and cannot be yes** until P0-1. The watch item exists; the thing it watches doesn't.

## End-of-Day-3 internal gate (the three sentences)

Writable from real data:

1. *Approvals to date: 4 approved (1 edited), 0 rejected; the edit says her sign-off is "Sarah C." not "Sarah Caldwell."*
2. *Best moment: 9:41pm lead drafted by 10:00pm, approved 7:42am — but the ledger credits it zero minutes (P0-3) and no notification announced it (P0-1).*
3. *Most likely to stall week 2: the Friday email reports the wrong week (found in Day-4 prep, next file) and the after-hours notification gap turns from founder-covered to visible the first week Conner's morning message is late.*

**Days 2–3 verdict: the workflow works; the *product around* the workflow is being impersonated by the founder.** Sustainable for one partner for a few weeks, which is exactly the window Engineering has to land P0-1 and P0-3.
