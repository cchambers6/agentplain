# Day 0 — Friday Jul 17, the hour after Sarah signs

> SAMPLE — not a real partner. See `00-README.md`.

Runbook under rehearsal: `docs/pilot/week-1-runbook/00-DAY-0-partner-signed.md`.

## 0:00–0:05 — Calendar (runbook §1)

**Executes as written.** Two invites from Conner's calendar: Monday Jul 20 9:00am activation call (Sarah said mornings), recurring Friday 30-minute series starting Jul 24. Manual work, no product surface involved, nothing to break.

**One thing the runbook doesn't say:** the Friday series start date collides with the weekly report email's window problem discovered on Day 4 (see `04-DAY-4-prep.md`). Day 0 is when Conner could still choose to frame week 1's Friday email expectation differently — the welcome message below promises "Friday morning you'll get an email from Plaino showing what it did all week," and on Jul 24 that email will not show that (P0-2). The runbook's own template plants the expectation the product can't yet meet.

## 0:05–0:15 — Welcome message (runbook §2)

**Executes as written**, with one wording landmine flagged:

- The FUB-key ask is right and complete (FUB: Admin → API → Create API Key matches the provider's actual flow).
- The template line *"Friday morning you'll get an email from Plaino showing what it did all week"* — hold this line back for week 1, or reword to "I'll send you the week's picture Friday morning" (Conner, manually) until P0-2 is fixed. Detailed in the P0 list.

## 0:15–0:35 — Prod-key un-pause preflight (runbook §3)

Walked against the real machinery:

1. **Caps on the partner workspace** — ✅ real. The two budget keys exist (`lib/billing/budget.ts`), and better than the runbook assumes: there is an operator surface for them. `/operator/workspaces/[workspaceId]` edits `tokenBudgetUsdMonthly` / `tokenBudgetUsdDaily` through `app/(operator)/operator/workspaces/actions.ts`. Minute 12 of Day 1 is a form, not a database write.
2. **Zero `NO_CAP` among active workspaces** — ✅ queryable (`getFleetBudgetSnapshots`, `budget.ts`). The dry-run's own trap: the **Peachtree Realty Demo workspace is an active workspace** with an installed skill. It needs its explicit minimal caps ($5/$1 per runbook doc 06 §2) or the preflight fails on our own demo. The runbook covers this ("the seeded dry-run/demo workspace") — it works, but only if the operator actually remembers the demo workspace is on the list. Suggest the preflight checklist name it explicitly.
3. **Rotate the key, smoke draft on the seeded workspace** — ✅ the paused-sentinel machinery is real (`lib/llm/paused.ts`, `restore-checklist.ts`), and the demo seed runs the production skill path so a smoke run is genuinely representative. Note: the lead-triage spine is deterministic (zero model calls — seed header), so the smoke draft that proves the *model* path is warm has to come from an inbox-drafts run, not from lead triage. The runbook says "confirm a draft generates end-to-end" without naming which path exercises the model; an operator could smoke-test lead triage, see green, and learn nothing about the rotated key. Small doc fix, listed as P1-6.
4. **Stamp the ops digest** — manual one-liner, fine.

## 0:35–0:50 — Path verification (runbook §4)

- **Signup walk:** the real route is `/app/sign-up?vertical=real-estate` (`app/(product)/app/sign-up/page.tsx` reads the `vertical` search param). The runbook writes it as `/signup?vertical=real-estate` — if Conner types the runbook's URL into a browser on Day 0, he gets a 404 and burns ten minutes doubting the product. The `/real-estate` landing CTA is what Sarah will actually click, so the partner never sees this; the *operator* does. P1-1.
- **FUB connect path:** disclosure screen → api-key form → verify-on-submit exists on main (connector dispatch work, PR #277 lineage). ✅
- **Degraded/paused banner gone post-rotation:** the banner is env-gated (`LLM_DEGRADED_MODE`, PR #276) — verifying it's absent is a config check plus one page load. ✅
- **Discovery handoff sheet into call notes:** manual. ✅

## 0:50–0:60 — Internal wiring (runbook §5)

Folder, case-study file from the template, Day-2 silent check scheduled, scoreboard line. All manual, all executable. The case-study file's "before" section gets its first entries today (see `06-DAY-5-case-study-capture.md` for the file as it looks by Friday).

## Day-0 exit criteria — dry-run verdict

| # | Criterion | Verdict |
|---|---|---|
| 1 | Welcome sent within the hour, FUB instructions in | ✅ executes — **reword the Friday-email promise until P0-2 lands** |
| 2 | Both calls booked | ✅ executes |
| 3 | Preflight green | ✅ executable end-to-end; add "demo workspace gets its $5/$1 caps" and "smoke the model path, not the deterministic path" to the checklist |
| 4 | Signup + FUB paths walked, banner gone | ✅ with the `/signup` URL correction |
| 5 | Folder open, case study started, Day-2 check scheduled | ✅ executes |

**Day 0 verdict: the hour is executable as designed.** Everything that breaks this week breaks later, on surfaces Day 0 can't see — and one of them (the Friday email expectation) gets *planted* today by the runbook's own welcome template.
