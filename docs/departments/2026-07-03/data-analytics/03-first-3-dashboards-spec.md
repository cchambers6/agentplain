# The first three dashboards — spec, owner, cadence

**Form factor, all three:** a deterministic offline script per dashboard (the `scripts/run-kaizen-retro.ts` pattern — zero API spend, recomputable for any window, `--json` and markdown modes) writing a weekly markdown scorecard. Operator-facing pages come later if the scripts prove their keep; a script that runs beats a page that's planned. Every dashboard prints its own `dataGaps` block — "DATA MISSING" over invented numbers, the one discipline the kaizen engine got right from day one.

**The standing rule on every scorecard:** a metric with no decision attached gets deleted. Each row below names its decision.

---

## Dashboard 1: Outbound funnel (live before Monday 2026-07-06)

| | |
|---|---|
| **Reads from** | CRM-of-record `/operator/outreach` (PR #355, doc-06 stages); booking-link refs; `signup.attributed` events |
| **Read by** | Conner (the Friday scoreboard is his), plus the weekly kaizen loop |
| **Cadence** | Friday, weekly, folded into the existing kaizen review — no new meeting |

| Metric | Decision it feeds |
|---|---|
| Sends this week (target: 5) | Is the #1 channel running? 0 sends = the only red that matters; everything else on all three dashboards is downstream of this row |
| Replies + disposition mix | Template/segment learning for next Monday's five; a 0/10 reply rate after two weeks changes the pitch, not the plan |
| Discovery calls booked | Prod-key unlock trigger (policy: market-ready AND actively prospecting — recommended trigger is first booked call, CEO doc 04) |
| Calls held → QUALIFIED | Discovery playbook working? Feeds the sales doc-04 script revisions |
| Partners signed (CLOSED-WON) | Proof-asset pipeline start; also gate condition #3 for paid ads |
| Opens | **Reported as "not instrumented"** until the outbound tool tracks them honestly. The column exists so its absence stays visible, not to be filled with a guess |

## Dashboard 2: Activation funnel (live by day 10, 2026-07-13)

| | |
|---|---|
| **Reads from** | `AnalyticsEvent` table — the five events in `01-instrumentation-plan.md` |
| **Read by** | Product (funnel shape), Conner (the one activation number), CS once customers exist |
| **Cadence** | Same Friday scorecard; per-cohort view monthly once there are cohorts to compare |

| Metric | Decision it feeds |
|---|---|
| Sign-ups, with % source-known (target >80%) | Instrumentation health — below 80% means the attribution chain is leaking, fix before scaling sends |
| Sign-up → connector added | The known first-value cliff (the customer-journey work found the path dies at the Connect button); this row proves whether the send-path fixes actually fixed it |
| Connector → first workflow run | Is the product delivering the moment the marketing promises? Near-zero here = stop acquisition work, the bottleneck is product (marketing doc 06's day-30 tripwire) |
| First workflow → first save-motion | The guarantee depends on this write (audit 9: missing writers = wrongful walk-away refunds); doubles as the activation moment the whole story depends on |
| Time-to-first-save-motion (median) | The "first 5 minutes" promise, measured; feeds onboarding priorities |

**Stated on the scorecard face:** save-motion coverage is 3/7 calibrated actions until Engineering closes the writer gap — the funnel's last step undercounts, and says so.

## Dashboard 3: Spend telemetry (live by day 14, 2026-07-17)

| | |
|---|---|
| **Reads from** | `memory/data/session-costs.yaml` + `budget-state.yaml` via the typed readers (`lib/memory/data-readers.ts`) — populated at last by wiring `stampSessionCost` at dispatch completion and scheduling the Librarian roll-up (kaizen fixes #1+#2, which only work as a pair) |
| **Read by** | Finance-Ops (budget enforcement), Conner (the cost line under the revenue lines), the weekly kaizen judgment layer |
| **Cadence** | Same Friday scorecard; `canSpend()` enforces caps continuously in code |

| Metric | Decision it feeds |
|---|---|
| Fleet spend week-to-date vs. $8,670/wk caps | Throttle/tier decisions; today this reads $0 against a frozen week — a measurement failure wearing a spend fact's clothes |
| Per-orchestrator cost + outcome | `analyzeModelEfficiency` routing hints (cheaper-model candidates) — the detectors already exist, they've just never been fed |
| Per-workspace token spend (once partners exist) | Per-seat contribution — the ~$185/RE-seat model becomes a measured number; directly prices the tiers |
| Estimated vs. billed reconciliation (monthly) | Keeps the "ESTIMATES from token counts" label honest against the invoice |

**Acceptance test:** the 2026-07-12 Sunday kaizen run reports `sessions analyzed > 0` for the first time since the loop shipped. That single line is the definition of done.

---

## Where they live

Scripts in `scripts/analytics/` (`outbound-funnel.ts`, `activation-funnel.ts`, spend rides the existing kaizen retro script); scorecards committed weekly to `docs/scorecards/<ISO-week>.md` so history is diffable and the numbers are citable by PR. One page, three sections, every Friday. If a Friday scorecard is ever reported with no decision taken, that is the standing definition of failure (marketing doc 06) — the review exists to move something, not to admire the instruments.
