# Day 4 — Thursday Jul 23, prep day

> SAMPLE — not a real partner. See `00-README.md`.

Runbook under rehearsal: `docs/pilot/week-1-runbook/03-DAY-4-5-first-check-in.md` §Day 4. Thursday is where the dry-run's biggest find surfaces, because the runbook's own checklist item 2 says: *"Confirm the Friday weekly report email fires to the partner Friday morning… Verify Thursday, not Friday 8am."* We verified Thursday. Here is what verification finds.

## The call brief (item 1)

Buildable from real rows: approvals by day ✅, every lead-triage run with latency ✅ (proposedAt vs the lead's receive time), edits digest ✅, breakage log ✅. **Except the saved-time line:** the week's ledger total contains only the inbox chain's minutes — every lead-triage run credits zero (P0-3). The brief's own instruction ("if the ledger disagrees with visible activity, fix or flag before the call") fires correctly: the number Sarah would see Friday **must** carry the asterisk, and the brief says so out loud. The discipline works; the writer gap it catches is the P0.

## Item 2 — confirm the Friday email fires. It fires. That's the problem.

Traced on main:

- The sweep (`weekly-customer-report-sweep.ts`) runs **Fridays 12:00 UTC ≈ 8am ET** — the morning fire the runbook and the Day-5 call opener depend on. ✅
- But `resolveReportedWeek` (`lib/measurement/weekly-digest-data.ts`) reports the **prior completed Mon–Sun week**. On Friday Jul 24 it reports **Jul 13–19**. Sarah's workspace was created **Monday Jul 20**.
- So the first email Sarah ever receives from Plaino reports a week in which she was not a customer: zero drafts, zero approvals — the honest quiet-week render (`isEmpty`), sent (the sweep counts `emptyWeekEmails`; it does not skip them).
- Friday's call is scripted to open: *"You got Plaino's report this morning — is it lying?"* The honest answer is **yes** — it says nothing happened, while she approved four drafts, edited one, and had a 9:41pm lead caught. The retention heartbeat's first beat is an own-goal, planted by the Day-0 welcome email's promise and detonated by the call's opening question. **P0-2.**

**Thursday recovery (what the dry-run's Conner does):** suppress or intercept the Friday-morning send for Sarah's workspace (opt-out gate exists per-workspace), and send a manual week-1 note instead — the narrative writer's golden-example shape (`docs/sales/weekly-report-2026-07-11/03-golden-examples.md`) is exactly this note. The runbook's Thursday-verification rule is what makes the recovery possible at all; a runbook without item 2 ships the own-goal.

## Item 3 — the week-2 proposal

One concrete adjustment, drafted from the week: *encode Sarah's sign-off ("Sarah C.") as a standing preference so drafts arrive pre-corrected.* Executable — her edit is durable data, and preference encoding is a real seam. ✅

## Item 4 — case-study capture prep

The "before" fields from Day 1 sit beside the week's numbers; consent line ready. ✅ (File as it stands: `06-DAY-5-case-study-capture.md`.)

**Day 4 verdict: prep is fully executable, and its verification step is load-bearing — it caught the week's worst break with 18 hours to spare.** A runbook that finds its own product's failure before the partner does is doing its job.
