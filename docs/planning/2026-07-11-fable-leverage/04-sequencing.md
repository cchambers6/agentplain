# The Two-Week Fable Sequence — Mon 2026-07-13 → Sun 2026-07-26

**Pairing principle:** Fable's cost is dominated by loading context; its value is what it does while holding it. Every day below pairs items that share a context load (same worktree, same corpus, same prompt files) so one cache-warm session does two jobs. Item codes reference `01-…` (A*) and `03-…` (C*).

## Week 1 — Jul 13–19

| Day | Fable session | Paired because | Sonnet 5 in parallel |
|---|---|---|---|
| **Mon 13** | **A1 pilot-week rehearsal + A2 weekly-report writer.** Load: demo seed (PR #377) + CS runbook (PR #366) + approval spine. Rehearse the week, then write the report prompt against the rehearsal's own data. *(Conner's Monday block — replies first, day-5/12 touches — runs independently.)* | The rehearsal produces exactly the workspace state the report's golden examples need. | Fix the P0s the rehearsal files, in ranked order. |
| **Tue 14** | **C1 M3 prompt suite, day 1** — brief + debrief prompts, schemas, mocks. Load: CM pack (PR #385) + M2 integrator (PR #383) + catalog. **C4 cache pass in the same sitting** (same `prompt.ts`/`cache.ts` files). | C4 is a restructure of the exact prefix C1's prompts will copy. | Start M3 wiring: routes, SSE, DailyLog write paths against C1's schemas as they land. |
| **Wed 15** | **C1 day 2** — Child.model extractor prompt + triage gate + smoke script. **C5 conflict-surfacing rubric in the same sitting** (Integrator context already loaded). | Extractor and conflict rubric are both "codify the judgment call" work over the same agent files. | Finish M3 wiring; run the smoke script; PR the milestone. |
| **Thu 16** | **C6 CM Logic+Rhetoric extension, day 1** — source pull (AO vols, PNEU), lesson-shape + narration modules for Forms III–IV. | Corpus load is the expensive part; keep it hot across both days. | Chiron repo-move prep if Conner has click-created `cchambers6/chiron`; else agentplain P0 burn-down. |
| **Fri 17** | **C6 day 2** — Forms V–VI, citations to the ≥40 floor, `pack:verify` green, PR. *(Jul 17 readback — unified plan ★2.10 — is Data/Sales' scoreboard, not a Fable deliverable; Fable attends nothing.)* | — | Verify pack build; voice-gate run. |
| **Sat/Sun** | **C3 stapling-rubric retro-judgment** (half-session; Fable authors judge prompt + judges once; two Opus 4.8 passes for independence). Buffer otherwise. | Small, self-contained, needs M2 output only. | — |

**Event-driven overrides, week 1:** a warm prospect reply fires **A3 (pricing-response tree)** same-day, displacing whatever is scheduled — reply latency beats everything on the agentplain side. A booked discovery call promotes A1's P0 fixes to the top of Sonnet's queue.

## Week 2 — Jul 20–26

| Day | Fable session | Paired because | Sonnet 5 in parallel |
|---|---|---|---|
| **Mon 20** | **C2 M4 Headmaster prompts, day 1** — Sunday WeeklyPlan generation + disruption replan. Load: M3 suite (now merged) + IntegrationMap seams. *(Conner Monday block #3 runs independently.)* | Builds directly on C1's merged schemas. | M4 cron + `vercel.json` wiring; plan/report surfaces. |
| **Tue 21** | **C2 day 2** — Friday report prompt + rationale-citation enforcement + golden examples. Same session revisits A2's report prompt if partner data has arrived — the two reports share editorial judgment. | Same "reads like a colleague" bar, same week, one editorial calibration. | Traceability SQL check (acceptance #3 query returns rows). |
| **Wed 22** | **C7 parent-facing voice pass** — /plan vision, wizard microcopy, Chiron voice guide, voice-gate extension. | Written against real C1/C2 output, which now exists. | Apply copy across surfaces; gate runs. |
| **Thu 23** | **C8 catalog-pipeline design + A4 prospect-pipeline design in one session.** | Identical shape: Fable writes the extraction template, rubric, and cheap-model prompts; Sonnet/Haiku will run both later. Designing them together halves the framework cost. | M5 Registrar build (rules + golden set) from the POC plan spec — no Fable needed. |
| **Fri 24** | **Buffer / spillover.** First call on this slot: anything a signed partner needs (A3 branches, onboarding fixes). Second call: C2 or C6 spillover. | — | M6 dry-run scaffolding (`docs/dry-run/` observation templates, cost snapshots). |
| **Sat/Sun** | Idle by default. If M6 week-1 simulated transcripts exist by Sunday, **C9 narration-quality calibration** fires here; otherwise it parks to the following week. | C9 is gated on transcripts, not on calendar. | — |

## What is deliberately NOT in the fortnight

- **C10 packs, C11 ESA-AZ, A5 workflow #2, A6 marketing pass** — all gated on triggers stated in their queue entries. Scheduling gated work by date is how ghost tasks get refired.
- **F1 (flatsbo remediation copy)** — one half-session, deliberately unscheduled: it slots into any buffer, and putting it on the critical path would overstate its urgency. If both buffer slots survive to Fri 24, F1 takes one.

## Dependency spine

```
A1 ──produces──▶ A2 goldens          (Mon 13, one session)
PR#383 + PR#385 ──▶ C1+C4 ──▶ C5     (Tue–Wed)
C1 merged ──▶ C2 ──▶ C7              (week 2)
PR#385 shape ──▶ C6                  (Thu–Fri wk 1, independent of C1)
M6 transcripts ──▶ C9                (earliest Sun 26)
real reply ──▶ A3 (event-driven, any day)
```
