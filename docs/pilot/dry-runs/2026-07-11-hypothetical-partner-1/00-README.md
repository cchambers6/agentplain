# Pilot week-1 dry-run — hypothetical partner #1

> **SAMPLE — not a real partner.** "Sarah Caldwell" is a fictional Georgia broker-owner invented for this rehearsal, run against the **Peachtree Realty Demo** fixture shapes (PR #377, `lib/demo/peachtree-dataset.ts`). No real broker, brokerage, lead, or address appears in this folder. Per `docs/case-studies/framework-2026-07-08/05-anti-fabrication-rules.md` rule 7, nothing in these files may ever appear on an external surface.

**Written 2026-07-11 (Fable audit #387, item A2-b). Docs only.** This is the week-1 runbook (PR #366, `docs/pilot/week-1-runbook/`) executed end-to-end on paper against what is actually on `origin/main @ 4565a7b` — every claim about what works or breaks below was verified against the code, not assumed. The point is to find the breaks now, while the partner is fictional and the fix costs hours, instead of during convert week (Jul 11–17, unified plan Phase 2) when the partner is real and the fix costs the reference.

## The scenario

- **Partner:** Sarah Caldwell (SAMPLE), broker-owner, 4-agent shop, metro Atlanta. Discovery answers: named pain = evening leads waiting until morning; email = Gmail; no QuickBooks pain named; named daily operator = Sarah herself; morning-email person.
- **Timeline:** signs the short letter **Friday Jul 17** (the unified plan's convert-week target). Day 1 activation call Monday Jul 20. Days 2–3 = Jul 21–22. Day 4 prep Thursday Jul 23. Day 5 Friday check-in Jul 24.
- **Assumed ratified before Day 0** (the runbook's own preconditions, not re-litigated here): prod-key un-pause trigger fired (signed partner), caps ratified at $40/$5, BREACH alert + fleet breaker green.

## What's in here

| File | What it covers |
|---|---|
| `01-DAY-0-signed.md` | The hour after the signature — what executes as written, what doesn't |
| `02-DAY-1-activation-call.md` | The 90-minute call, segment by segment, against the real surfaces |
| `03-DAY-2-3-first-workflow-runs.md` | The silent-watch days — where the premise holds and where it can't yet |
| `04-DAY-4-prep.md` | Thursday prep — where the Friday own-goal gets discovered |
| `05-DAY-5-check-in.md` | The first Friday call |
| `06-DAY-5-case-study-capture.md` | The capture framework (PR #374) applied to the fake arc |
| `07-observed-P0-list.md` | **The deliverable.** Ranked breaks, each verified against main, with smallest fix + hours |
| `08-observed-P1-list.md` | Polish and friction — real but not partner-losing |
| `09-what-the-runbook-got-right.md` | The honest other half — this was a validation exercise, and much of it validated |

## Method note (so the findings can be trusted)

Every "this breaks" claim in files 01–05 cites the artifact: a file on main, a cron expression, a call-site grep. Where something could not be verified from the code, it is labeled **VERIFY** rather than asserted — per `feedback_no_guesses_no_estimates`, an unverified break is not a finding, it's a question. The four P0s all survived verification.
