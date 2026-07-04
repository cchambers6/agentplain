# Head of Data & Analytics — 14-day executive plan (2026-07-03 → 2026-07-17)

**Mandate:** design data FOR profitable. The CEO lever is five design-partner emails going out Monday (2026-07-06). The profit equation this quarter is decided by four numbers — sends, replies, discovery calls, signed partners — and one cost line. My job is that every one of those numbers is truthful, attributable, and reviewed weekly, and that no paid dollar moves until the measurement gate (`04-measurement-gates-for-paid-ads.md`) is green.

**The honest starting position** (verified in the kaizen 9/10 retro, `docs/kaizen/2026-07-02/09-data-analytics.md`, and the marketing measurement plan, `docs/marketing/deep-dive-2026-07-02/06-measurement.md`):

- Zero product analytics exist. No event layer anywhere in `lib/` or `app/` — activation, connector usage, and workflow runs are unmeasured.
- Zero marketing analytics exist. The site has no tracking scripts at all.
- The fleet's own spend telemetry is a built engine with an empty tank: `stampSessionCost` has zero call sites, the Librarian roll-up has no scheduled executor, all six `memory/data/*.yaml` files have never held a row, and `budget-state.yaml` is frozen at the 2026-06-15 week.

We are not fixing broken instruments; we are installing instruments for the first time. That is an advantage: we get to install only the ones that feed a decision.

---

## The three dashboards, in priority order

Priority follows the money: the outbound funnel decides whether revenue exists, activation decides whether revenue survives, spend decides whether revenue is profit.

1. **Outbound funnel** — sends → replies → discovery calls booked → partners signed. Source of record: the CRM-lite pipeline (`/operator/outreach`, PR #355 send-path wave) on the sales deep-dive doc-06 stages. Must be live **before Monday's send**.
2. **Activation funnel** — sign-up → workspace created → connector added → first workflow run → first save-motion. Sources: events per `01-instrumentation-plan.md`. Live by day 10; matters the moment the first prospect starts a trial.
3. **Spend telemetry** — fleet session costs + product token spend vs. the $8,670/wk budget caps. Fix is the kaizen retro's #1+#2 pair (wire `stampSessionCost` at dispatch completion; give the Librarian an executor). Live by day 14.

Full specs in `03-first-3-dashboards-spec.md`.

## 14-day schedule

**Days 1–2 (Fri–Sat, before the send):**
- Verify PR #355's `/operator/outreach` is merged and each of the 5 prospects has a row. If the PR has not landed, the fallback of record is a committed tracking table — a funnel with no ledger is a guess.
- Confirm the three must-fire events are wired (see below). Booking link (`NEXT_PUBLIC_BOOKING_URL`) carries a per-prospect `ref` parameter; sign-up captures UTM + "how did you hear about us."
- Publish the UTM convention (in `02-attribution-model.md`) — founder outreach links carry UTMs too.

**Days 3–7:**
- Friday scoreboard #1 (2026-07-10): sends / replies / calls booked — truthful counts, "not instrumented" stated where true (opens, until the outbound tool tracks them; we never report a guessed open rate).
- Engineering lands the five activation events per `01-instrumentation-plan.md` (thin first-party event table, no third-party scripts — consent framing inside).

**Days 8–14:**
- Activation dashboard v1: deterministic script over the events table, weekly markdown scorecard, same pattern as `scripts/run-kaizen-retro.ts` (offline, recomputable, `dataGaps` honesty built in).
- Spend telemetry: `stampSessionCost` wired at every dispatch completion call site + Librarian roll-up scheduled. Acceptance: the 2026-07-12 weekly kaizen run reports `sessions analyzed > 0` for the first time ever.
- Friday scoreboard #2 (2026-07-17): full three-dashboard review; measurement-gate status for paid ads formally assessed.

## The three events that MUST fire before Monday's send

These are the ones that cannot be backfilled — a reply can be counted from the inbox later; an unattributed booked call is lost forever:

1. **`outbound.sent`** — a CRM row per email at send time: prospect, date, template variant, booking-link ref.
2. **`discovery.booked`** — a booked call that carries the prospect ref back from the booking link, so the call ties to the specific send.
3. **`signup.attributed`** — sign-up captures UTM/referrer + the "how did you hear about us" self-report, so any trial born from this wave has a known source.

## What I will not do

- No third-party analytics vendor decision inside this 14-day window; the homegrown first-party table covers everything the three dashboards need (vendor pick, if ever, goes through the adapter seam and the `/privacy` subprocessor process).
- No metric without a named decision attached — the marketing plan's rule, adopted department-wide.
- No paid-ads measurement work beyond the gate spec; the gate is deliberately upstream of any spend.
- No new audit or retro loops (kill list, ratified 2026-07-03). This plan wires existing designs; it does not re-study them.

## Dependencies

Engineering, Product, and Finance-Ops asks are enumerated in `05-what-i-need-from-other-heads.md`. What data collection must stop is in `06-what-data-must-stop.md`. The department's line to profit is in `07-profit-contribution.md`.
