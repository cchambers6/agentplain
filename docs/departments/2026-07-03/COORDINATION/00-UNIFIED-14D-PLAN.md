# Unified 14-Day Plan-of-Record — 2026-07-03 → 2026-07-17

**Status:** Plan-of-record, pending Conner ratification of the items in `02-conflicts-requiring-conner.md`.
**Sources:** the ten department head plans (PRs #356–#365), CEO Pass 1 (PR #348), Chief-of-Staff Pass 1 (PR #352), planning direction check (PR #350). Nothing here re-litigates a ratified ruling; where two plans disagreed, the resolution is recorded in `02-conflicts-requiring-conner.md`.

---

## The frame (one paragraph)

The single lever this fortnight is Conner sending five design-partner emails to named Georgia real-estate prospects on Monday 2026-07-06. Every department plan independently anchors to that send. The unified plan therefore has one gate structure: **Phase 0 clears the send path (Jul 3–5), Phase 1 protects the send and handles replies (Jul 6–10), Phase 2 converts a reply into a signed, activated design partner (Jul 11–17).** Work that does not serve one of those three phases is on the freeze list and does not run.

The week-1 gate is binary: **five sends logged in `/operator/outreach` at FIRST-TOUCH-SENT by end of Monday Jul 6.** Sales' rule stands: the block never blocks — if any pre-send item slips, the send still happens Monday with the stated fallbacks (links point at `/` and `/pricing`; replies get manually proposed times).

---

## Phase 0 — Clear the send path (Thu Jul 3 – Sun Jul 5)

Critical-path items are marked ★.

| # | Item | Owner | Due | Serves |
|---|------|-------|-----|--------|
| ★0.1 | Merge train: land the open decision stack #348–#355 sequentially (CEO pass, loop v3 dormant, direction check, CoS pass, outreach kit, kills, send-path wave). #355 carries the `/how-it-works` unshadow, booking CTA, `/contact`, api-key Connect fix, and `/operator/outreach` | Engineering | Jul 4 EOD | Everything. Design's rule applies: if #355 can't land whole, cherry-pick the redirect deletion — it's the P0 |
| ★0.2 | Day-1 conversion fixes: CTA contrast (`text-white` on `bg-clay`), `/guarantee` linkage (~4 links + sitemap), root `not-found.tsx` | Design | Jul 4 EOD | The exact path the five emails traverse |
| ★0.3 | Piece 1 (Follow Up Boss comparison) drafted, gates passed | Marketing | Jul 4 | Publishes Mon 8am, before the send |
| ★0.4 | Monday-send collateral pack to Conner: tagged UTM links, prospect-to-stack map (with Sales), LinkedIn banner + invite thumbnail via creative-router | Marketing + Sales + Design | Jul 4 EOD | The send itself |
| ★0.5 | Conner: set `NEXT_PUBLIC_BOOKING_URL`, enter the 5 prospects in `/operator/outreach`, confirm the named five | Conner | Jul 4 | Warm replies need somewhere to land; the funnel dashboard reads what the CRM holds |
| ★0.6 | Design-partner short-form drafted and routed to counsel as Batch 1, item 1; `/security` softening applied verbatim (ruling in PR #354); claims spot-check on outreach kit | Legal + Marketing | before Jul 6 | Yes-to-signature in under 48 hours; prospects read `/security` the week outreach starts |
| ★0.7 | Three must-fire events wired: `outbound.sent`, `discovery.booked`, `signup.attributed`; booking-link `ref` pass-through verified (an unattributed booked call is lost forever) | Data + Engineering | before Jul 6 | Outbound funnel dashboard live before the send |
| ★0.8 | Production verification sweep: `/how-it-works` resolves, `/contact` renders, booking CTA appears, CRM-lite persists rows. One pass/fail note to Conner Sunday night | Engineering | Sun Jul 5 | Sales' pre-send gate. Known: main fails 41 pre-existing tests — do not re-diagnose |
| 0.9 | Guarantee leak interim: Day-7 walk-away cron flipped to human-review; `recordSavedTime` writers wired on the 7 calibrated actions | Engineering | Jul 4 | The only recurring dollar leak; case-study measurement from pilot week 1 |
| 0.10 | CI floor PR (`pr-checks.yml`) merged; Conner branch-protection click | Engineering + Conner | Jul 5 | Every later guarantee is only as strong as its gate |
| 0.11 | Loop v3 lands dormant (PR #349); `agentplain-loop-governor` scheduled task created; first manual pass verified; Engineering confirms the scheduled-task environment exposes dispatch tools | Fleet-Ops + Engineering | Jul 5 | Governor must not be N1-dormant on arrival; hard check before Jul 7 |
| 0.12 | `stampSessionCost()` wired at fleet session-completion + dispatch parent; Librarian rollup executor; exit test `session-costs.yaml` rows > 0. Data ratifies the stamp schema as owner-of-record | Engineering + Data + Fleet-Ops | Jul 5 | Ends the NULL-spend state; feeds Fin-Ops day-7 digest |
| 0.13 | Demo state named and verified: killer-workflow runtime (PR #303) URL/workspace, seeded RE workflow, runs without prod key, reset path; demo-mode ON by default for fresh RE trial workspaces | Product | Sun Jul 5, then weekly | THE demo for any booked call; a Monday-send broker never sees an empty first render |

## Phase 1 — Send week (Mon Jul 6 – Fri Jul 10)

| # | Item | Owner | Due | Serves |
|---|------|-------|-----|--------|
| ★1.1 | **The Monday block: Conner sends 5, logs 5 CRM rows same sitting (60–90 min)** | Conner | Mon Jul 6 | The lever. Week-1 gate |
| ★1.2 | Reply handling: warm reply → booking reply within 4 business hours. No new outreach, no new assets | Conner (fleet drafts) | Tue–Fri | Reply → call conversion |
| ★1.3 | Prod-key un-pause ratified: trigger, scope, cap (bundle in `02-conflicts…` C1) | Conner | Jul 7 | Without it, the onboarding call is a demo of a resting product |
| 1.4 | Model transition executed (Option B-plus default fires on silence Jul 7 18:00 ET) | Fleet-Ops + Conner | Jul 7 | Fable window closes; passes must not keep firing at usage-credit rates by default |
| 1.5 | Pieces 2–3 publish (BoldTrail/$26,262 Wed; operator story Fri); real screenshots from Product/Eng by Jul 8 | Marketing | Jul 8 / Jul 10 | Fresh material for the day-5/12/21 follow-up chain |
| 1.6 | CS dry-run of the onboarding runbook end-to-end on a seeded RE workspace; exit test = one approved draft screen-recorded; breakages filed as P0s and prioritized by Product | CS + Product | Jul 9 | Onboarding-path states verified (customer vocabulary, three call-killing moments honest) |
| 1.7 | One-pager in sendable form (claims traced, design-partner terms) | Marketing + Design | Thu Jul 9 | First artifact a warm-yes reply receives |
| 1.8 | Per-workspace budget cap wired and tested against the ratified number; workspace-scoped un-pause mechanism smoke-tested; degraded-at-cap copy from Product | Engineering + Product | Jul 10 | `budget.ts` returns NO_CAP when unset — unsafe on un-pause day |
| 1.9 | Counsel Batch 1 dispositioned (short-form + ToS/Privacy deltas); Product's ticket-deletion direction decided (P1, Wed Jul 8); discovery→onboarding handoff sheet template (5 fields) | Legal + Product + CS + Sales | Jul 8–10 | Signature path and onboarding config |
| 1.10 | First non-zero ops digest with real spend rows; three Conner finance inputs collected; fixed-cost ledger baselined | Finance-Ops + Conner | Jul 10 | Runway model gets real numbers or named blockers |
| 1.11 | Activation events land (single ratified contract per C4 in `02-conflicts…`); activation timestamps queryable per workspace; approvals-per-week query | Engineering + Data + Product | Jul 10 | TTFDV measured before the first prospect arrives; "where is partner X stuck" in one query |
| ★1.12 | **Friday scoreboard #1: sends / replies / discovery calls booked — truthful counts, "not instrumented" stated where true. 15-min Conner review** | Data + Sales | Fri Jul 10 | The three numbers the whole company runs on |

## Phase 2 — Convert week (Sat Jul 11 – Fri Jul 17)

| # | Item | Owner | Due | Serves |
|---|------|-------|-----|--------|
| ★2.1 | Un-pause go/no-go one-pager: every checklist item checked or has a dated owner; Conner confirms proceed or names blockers | Engineering + Finance-Ops | Jul 11 | The switch must be a 5-minute act when the trigger fires |
| ★2.2 | If a discovery call books: 20-min playbook + briefing template prepped day before; handoff sheet filled within 24h; **signed short letter before onboarding is booked**; onboarding call within 48h; success = one approved draft live on the call + weekly call scheduled | Sales → CS | on demand | First partner activated |
| ★2.3 | Entity decision executed the moment a signature is in sight — every draft carries `[ENTITY]` placeholders until then (see C2 in `02-conflicts…`) | Conner + Legal | before first signature | No document invents an entity name |
| 2.4 | Monday block #2: replies first, then day-5/12 follow-up touches, then new first touches only if load allows (5-touch cap) | Conner + Sales | Mon Jul 13 | Cadence |
| 2.5 | Pieces 4–5 publish (demo write-up Jul 14, Sierra comparison Jul 16); case-study carrot mock (Jul 13); recorded walkthrough (by Jul 17) | Marketing + Design | Jul 13–17 | Pre-read for booked calls; async alternative for non-bookers |
| 2.6 | Cost-governor completion: BREACH alerts, $25/day fleet breaker, Haiku rate refresh, `LLM_MODEL_ROUTING` verification; un-pause preflight executable in under an hour | Engineering + Finance-Ops | Jul 14–17 | Margin un-losable before real spend starts |
| 2.7 | Approval-loop closure (notify on all creation paths, queue count + pagination, reject-with-reason); Friday weekly report sanity-checked against the dry-run workspace | Engineering + Product | Jul 17 | The partner's daily rhythm and retention heartbeat |
| 2.8 | Portal deletion/RLS invariant tests in CI; account-deletion end-to-end check; Neon PITR verification | Engineering + Legal | Jul 17 | Data-rights sentences stop being untested prose |
| 2.9 | Fleet hygiene: dispatch gap closed (or GHA bridge landed), token mint/push wrapper (`fleet-ship.mjs`), Librarian hydration, memory rule files, WORKING_STATE prune | Engineering + Fleet-Ops | Jul 17 | Silent non-execution is the fleet's dominant failure mode |
| ★2.10 | **Jul 17 readback: scoreboard #2 (full three-dashboard review), CS Friday synthesis, marketing readback with decisions attached to every number, loop restart check** | All heads | Fri Jul 17 | Pre-decided next steps: goal met → cadence unchanged, prospects 6–15 researched; zero replies → follow-up chain + 5 fresh names; sends didn't happen → direct conversation on founder-led motion feasibility |

---

## Department swimlanes (one line each)

| Department | 14-day mission | Week-1 gate item |
|---|---|---|
| Engineering | Land the merge train, plug the guarantee leak, floor CI, wire the meters, certify un-pause | Merge train by Jul 4; verification sweep Sun Jul 5 |
| Product | Make the first five minutes convert: Connect fix verified, demo-first render, honest states, TTFDV measured | Demo state verified by Sun Jul 5 |
| Design | Fix the four conversion breaks on the exact email path before Monday | All four live on production by Mon 8am |
| Marketing | Piece 1 live before the send; five GA-RE pieces across the window; measurement before traffic | Piece 1 by Mon 8am; collateral pack Fri Jul 4 |
| Sales | Protect the Monday block; 5 sends / 2+ replies / 1 call booked by Jul 17 | 5 CRM rows Monday |
| Customer Success | Verify runway (days 1–3), rehearse the onboarding hour (days 4–7), execute on demand (days 8–14) | Dry-run exit test by Jul 9 |
| Finance-Ops | End the NULL-spend state; publish first real numbers; certify the governor | Digest with real rows Jul 10 |
| Legal | Short-form counsel-ready before Monday; Batch 1 dispositioned by Jul 10; placeholder discipline absolute | Short-form to counsel before Jul 6 |
| Data | Outbound funnel dashboard live before the send; one event contract; Friday scoreboards | Three must-fire events before Jul 6 |
| Fleet-Ops | Governor scheduled and verified; model transition by decision not default; zero manual re-fires | Governor live + dispatch confirmed by Jul 7 |

---

## Dependency register (the handoffs that gate other heads' dates)

Full placement in `01-handoff-matrix.md`. The load-bearing ones:

1. **#355 on main (Eng, Jul 4)** → Design's booking-CTA styling, Marketing's link targets, Sales' verification sweep, Data's CRM dashboard.
2. **Booking URL + 5 prospects entered (Conner, Jul 4)** → Marketing UTM tagging, Data attribution, Sales reply handling, Design invite asset.
3. **Prospect-to-stack map (Sales, Jul 4)** → Marketing's piece-per-prospect matching (wrong link is worse than no link).
4. **Un-pause ratification (Conner, Jul 7)** → Engineering cap wiring target, CS runway verification, Finance preflight.
5. **Cap number ratified (Conner/Fin-Ops, Jul 8)** → Engineering un-pause item 1 (silence = the Finance-Ops proposal stands).
6. **Spend-stamp schema ratified (Data, Jul 5)** → Engineering telemetry v1 (Jul 5–9) → Finance digest (Jul 10) → Fleet-Ops post-Jul-7 cost table.
7. **Dispatch environment confirmation (Eng → Fleet-Ops, before Jul 7)** → governor is not dormant on arrival.
8. **Dry-run P0s (CS, Jul 7–9) → Product prioritizes those fixes over everything else** (CS gate, day 4).
9. **Handoff sheet + signed short letter (Sales+Legal)** → CS runs zero onboarding calls on a handshake.
10. **Entity decision (Conner)** → every signature; placeholders until then.

---

## Standing rules (already ratified — restated so no plan drifts)

- **Definition of done:** merged to main + read back on `origin/main` + reachable + measured. Merged ≠ shipped.
- **Freeze list holds:** no new audits/retros/planning layers, no new verticals or surfaces, no LLM-dependent features against the paused key, portal stays dark, paid media held behind its 4-condition gate, GTM = Georgia real estate only.
- **No fabricated numbers:** modeled figures labeled modeled; gaps labeled gaps; scoreboards report actual counts with "not instrumented" stated where true.
- **Silence executes defaults:** every Conner decision in `03-consolidated-conner-queue.md` carries a default and the date it fires — except the un-pause cap, where silence is not safe (NO_CAP) and an explicit ratification is required.
- **The block never blocks:** no fleet task, however red, delays the Monday send.
