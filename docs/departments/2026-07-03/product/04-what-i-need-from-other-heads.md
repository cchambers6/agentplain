# What Product needs from the other heads (14-day window)

Every ask is scoped to the activation path (01), the killer workflow (02), or the honest-state model (03). If an ask doesn't serve one of those three, it isn't in this document. Ordered by urgency inside each section.

## Engineering

| # | Ask | Why / lineage | Size |
|---|---|---|---|
| E1 | **Verify on main, day 1:** the api-key Connect fix (FUB/Sierra tiles → credential form) recorded in the send-path wave (PR #355). If not merged, land it before anything else — it is the activation keystone | audit 05 P1-5; journey `activation.connect.1`; kaizen read-back rule | Verify: hours. Land: S |
| E2 | Route tile + killer-workflow-card Connect CTAs through the #306 disclosure page; resolve the stranded `feat/data-minimization-positioning-2026-06-18` branch (merge or kill — one sitting, already the kaizen's decision #3) | audit 05 P0-2 / P0-3 | S–M |
| E3 | Trial/card truth: all buy-moment surfaces consume `lib/billing/facts.ts`; delete the hardcoded "no card required" and the 30d/7d contradiction (needs Conner's one-line trial ruling) | audit 10 P1-10/11; profitability `consideration.evaluate.2` | S |
| E4 | `recordSavedTime` writers on all 7 calibrated actions + sweep persist paths; bound Day-7 guarantee candidates to the age window. Until it lands, guarantee cron runs in human-review mode | audit 09 P0-1 — the only recurring dollar leak | S |
| E5 | Honest-state chips per 03: derive from runtime reads, wire the degraded-mode Paused copy, kill any remaining engineer-vocab labels on Today/Connections | PR #249 ratified mapping | S–M |
| E6 | Approval-loop closure: notify on all ~8 approval-creation paths (centralize at creation), queue count + pagination past 50, web reject-with-reason | audit 04 F-1/F-2/F-3 | M |
| E7 | Demo→live cutover pre-verification per 02 §6 (staging FUB key, end-to-end lead→approval→notification→saved-time), so un-pause day is a switch-flip, not a debug day | sales plan gate; CEO 04 decision 3 | S |

## Design

| # | Ask | Why | Size |
|---|---|---|---|
| D1 | Polish the demo-mode first impression: the runtime player autoplaying on Today as the hero of a fresh workspace, with the demonstration label and the closing Connect card composed as one arc (everything tells a story — the ratified rule) | 01 §5; 02 §4 | S |
| D2 | Chip + status-line visual family for the five states using PlainoStatus icons only (never PlainoMark); moss/clay/flag/muted badge mapping per 03 §2 | PR #232 two-family split; PR #249 | S |
| D3 | 44px touch-target pass on the activation path CTAs and the Today/Approvals shell — this persona activates and approves from a phone | audit 03 F4 | S |
| D4 | The disclosure screen (#306) designed as a trust asset in broker vocabulary — two-bucket story (pass-through vs account-lifetime memory), no vendor names (sole exception stays /privacy + /security subprocessor list) | audit 05 P0-2; ratified two-bucket positioning | S–M |

Constraint reminder: no improvised SVG/PNG — assets route through the creative pipeline or existing component families (ratified rule).

## Data

| # | Ask | Why | Size |
|---|---|---|---|
| DA1 | Five activation-funnel events: `signup`, `workspace-created`, `demo-viewed` (runtime completed), `connect-started`, `first-draft-queued` — with timestamps so **TTFDV is a measured number** before the first prospect arrives. Today the marketing+product surface has zero tracking (audit 1) | 00 §2 — the plan's one metric | M |
| DA2 | Approval-latency measurement (created → decided) from existing exhaust — the retention metric for the daily rhythm | profitability `expansion.champion.2` | S |
| DA3 | Saved-time ledger read-back check: a weekly assert that every calibrated action fired ≥1 writer (the producer-without-consumer tripwire, so audit-09 P0-1 can't silently return) | kaizen friction 3 | S |

(The spend pipeline / `stampSessionCost` wiring stays with Finance/Ops per the kaizen master plan — noted here only because TTFDV events should ride the same telemetry seam rather than invent a second one.)

## Marketing

| # | Ask | Why | Size |
|---|---|---|---|
| M1 | Outreach + landing alignment: Monday's five emails link to `/real-estate`, whose hero states the killer-workflow headline verbatim ("Every lead gets a first touch in 5 minutes") — one promise from email → landing → demo → product card. No second promise on the path | 01 min 0:00; locked registry copy | S |
| M2 | Verify `/how-it-works` is truly unshadowed on production (the 308 was reported fixed in the send-path wave — confirm with a curl, not a memory) and that it shows the RE story first | audit 01 P0-1; read-back rule | hours |
| M3 | Replace or substantiate the $2,900–$10,600/mo ROI card using the calibrated 27-min/lead derivation from 02 §3 — the only ROI math we can defend line by line | audit 01 P1-2; Truth-Wave | S |
| M4 | De-orphan `/guarantee` (footer + sitemap + one CTA) and reconcile the 14-day money-back vs Day-7 walk-away on a single page — skeptical brokers will read it the week outreach starts | audit 09 P1-4/5 | S |

## What Product owes them back

A frozen surface (05) so none of the above competes with new features; the activation-path spec (01) as the single source for copy and design decisions on that path; and prospect-feedback deltas within 48h of every discovery call so all four departments re-rank from the same real data.
