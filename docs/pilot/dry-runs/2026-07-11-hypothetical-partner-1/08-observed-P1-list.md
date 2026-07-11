# Observed P1 list — real friction, not partner-losing

> From the SAMPLE dry-run. Same verification standard as the P0 list; these are the items that cost minutes or polish, not the relationship. Unordered within tiers of roughly equal weight.

1. **Runbook URL drift: `/signup?vertical=real-estate` doesn't exist.** The real route is `/app/sign-up?vertical=real-estate` (`app/(product)/app/sign-up/page.tsx`). The partner never sees this (the `/real-estate` CTA carries the right link) but the operator walking Day-0 verification from the runbook's literal text hits a 404. Fix: correct the runbook string, or add the marketing-path redirect. ~15 min.

2. **The first-lead touch template has an unfillable bracket.** Doc 02's trigger message includes "took [N] minutes of work off your plate" — with P0-3 open there is no honest N for lead work. Make the clause optional in the template until the ledger writer lands (folded into P0-3's fix, but the doc edit shouldn't wait for the code).

3. **Approvals queue count + pagination (unified plan 2.7) still open.** Week 1's queue is small enough not to hurt; by week 3 an unpaginated queue with no count is a daily-habit tax on the exact surface the habit lives on. Confirmed still pending on main. Keep it on the 2.7 wave, due before week 3 of a real pilot.

4. **Reject-reason is optional, and the weekly report renders its absence as "No reason given."** The reason field exists and persists (`decisionReason`); a partner who rejects without typing produces a report line that reads like a shrug. Either nudge for a reason at reject time on design-partner workspaces, or render reasonless rejections as a plain count. ~2h either way.

5. **Day-0 preflight checklist should name the demo workspace explicitly.** "Zero `NO_CAP` actives" fails on the Peachtree Realty Demo workspace unless it gets its $5/$1 caps — the runbook's language covers it generically; the checklist item should name it so a hurried Day 0 doesn't stall diagnosing our own fixture. Doc-only.

6. **The Day-0 smoke test should name which path exercises the model.** Lead triage is deterministic (zero model calls — the seed's own header), so a lead-triage smoke proves nothing about the rotated key. The checklist should say "smoke an inbox-draft run" explicitly. Doc-only.

7. **The hourly-sweep latency should be reflected in partner-facing wording.** Until P0-4 lands, anything that says leads are caught "within minutes" should say "within the hour." The demo script's 9:14→9:16 beat is true of the demo (backdated fixture) and of webhook-fed paths, not of the hourly FUB poll. Audit the welcome email, Day-1 script, and `/real-estate` claims for this one clock. ~1h audit.

8. **Demo-to-real transition on the Today tab is unrehearsed.** Demo mode renders the story for fresh RE workspaces (`lib/demo/demo-mode.ts`); what Sarah sees on Day 2 — when real cards exist but the demo story may still be present — wasn't verifiable from code reading alone in this dry-run. **VERIFY** on the seeded workspace: connect a real source, confirm the demo story yields cleanly. If it lingers alongside real data, that's a confusing second week and gets promoted.

9. **No operator affordance for the manual FUB sweep fire.** The P0-4 interim workaround (fire the sweep's trigger event) lives in nobody's muscle memory and no doc. One runbook paragraph with the exact event name + payload. Doc-only, 30 min, and it de-fangs P0-4 for the first call even if the code fix slips.
