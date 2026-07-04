# Handoff Matrix — every "what I need from X", placed — 2026-07-03

Source: the `what-i-need-from-other-heads` docs of all ten head plans (PRs #356–#365).

**Legend:**
- ✅ acknowledged — the receiving head's plan already contains matching work on a compatible date
- ⚠️ unacknowledged — the ask exists in the sender's plan but appears nowhere in the receiver's plan; the plan-of-record assigns it
- 🔁 duplicate — the same ask made by two or more heads; deduped to one row, earliest deadline wins
- ⚡ conflict — heads disagree on owner, date, or number; resolution in `02-conflicts-requiring-conner.md`

## Summary grid (asks FROM row TO column)

| from \ to | Eng | Product | Design | Mktg | Sales | CS | Fin-Ops | Legal | Data | Fleet | Conner |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Engineering | — | 4 | 0 | 0 | 0 | 0 | 3 | 0 | 3 | 5 | 3 |
| Product | 7 | — | 4 | 4 | 0 | 0 | 0 | 0 | 3 | 0 | 2 |
| Design | 4 | 3 | — | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| Marketing | 4 | 4 | 3 | — | 4 | 0 | 0 | 0 | 0 | 0 | 4 |
| Sales | 3 | 3 | 2 | 3 | — | 0 | 0 | 0 | 0 | 0 | 1 |
| CS | 4 | 3 | 0 | 0 | 3 | — | 0 | 0 | 3 | 0 | 1 |
| Finance-Ops | 8 | 0 | 0 | 0 | 1 | 0 | — | 0 | 4 | 0 | 3 |
| Legal | 4 | 3 | 0 | 4 | 0 | 0 | 0 | — | 0 | 0 | 4 |
| Data | 4 | 3 | 0 | 0 | 2 | 0 | 3 | 0 | — | 0 | 3 |
| Fleet-Ops | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | — | 3 |

---

## Inbox: Engineering (heaviest-loaded receiver — 34 raw asks, ~22 after dedup)

| From | Ask | Due | Status |
|---|---|---|---|
| Product | Verify api-key Connect fix (#355) on main day 1; land before anything else if missing | Jul 3 | ✅ merge train days 1–2 |
| Product 🔁 Design | Land #355 whole before Monday (Design: cherry-pick redirect deletion if not) | Jul 4 | ✅ merge train |
| Product | Route Connect CTAs through #306 disclosure; resolve stranded data-min branch | week 1 | ✅ days 6–9 connector disclosure routing — ⚡ Product wants it days 1–3; plan-of-record: tile routing lands with merge-train follow-up by Jul 5, stranded-branch ruling same sitting |
| Product | Trial/card truth from `lib/billing/facts.ts` (needs Conner 1-line ruling) | Jul 6–7 | ✅ (Eng inert-controls/truth pass) |
| Product 🔁 CS 🔁 Sales 🔁 Fin-Ops 🔁 Data | `recordSavedTime` writers on all 7 calibrated actions; cron in human-review until landed. Five heads ask for the same fix | Jul 4 (Eng's own date — earliest) | ✅ Eng days 1–2. Deduped: one build satisfies all five |
| Product | Honest-state chips (customer vocab, degraded Paused copy) | days 4–7 | ✅ inert-controls truth pass window |
| Product | Approval-loop closure (notify, pagination, reject-with-reason) | days 8–14 | ✅ |
| Product 🔁 Sales | Demo→live cutover pre-verification so un-pause day is a switch-flip | by Jul 10–11 | ✅ Eng un-pause readiness Jul 11 |
| Design | Same-day review window for Day-1 fix PRs (contrast, guarantee links, 404) | Jul 4–5 | ⚠️ not in Eng plan — assigned: reviewer on call Fri/Sat |
| Design | Brand-gate + voice-gate promoted to blocking CI (+ vendor-name check) | by Jul 17 | ✅ CI floor covers; gate-scope widening (dunning email, weekly report, global-error) ⚠️ added to CI-floor scope |
| Marketing | Truth confirmations (Connect path state, saved-time gating, demo runs on paused key) — answers, not builds | Fri Jul 4 | ⚠️ not in Eng plan — assigned: one reply doc Fri |
| Marketing | Thin article surface: 3 entries in `/compare/[alt]` registry | Jul 9 | ⚡ tension with new-surface freeze — resolution in `02` C5 (recommend: allow, existing route) |
| Marketing 🔁 Data | Analytics adapter + goal events (Marketing 4 events) / `lib/analytics/track.ts` + 5 call sites (Data) | Jul 10–11 | ⚡ overlapping builds, three event lists — one contract, `02` C4 |
| Sales | Production verification sweep, 5 URLs, pass/fail note to Conner | Sun Jul 5 | ⚠️ not in Eng plan — assigned Sun Jul 5 (hours, not days) |
| CS | [gate] Per-workspace budget cap wired + tested; defined at-cap behavior | day 3 | ⚡ date conflict (CS day 3 vs Eng Jul 8–11 vs Fin-Ops day 14) — `02` C1 |
| CS | [gate] Workspace-scoped un-pause mechanism, smoke-tested | day 3 | ⚡ same bundle, `02` C1 |
| CS | Day-3 activation alert cron (zero approvals in 72h → notify); skip if >1 day of work but say so | week 1 | ⚠️ not in Eng plan — assigned with CS's skip-clause intact |
| Fin-Ops | Session-stamp protocol + GHA backstop; Librarian merge-inbox executor + cron; `weekToDate` window | day 3–7 | ✅ Eng telemetry v1 days 3–5 |
| Fin-Ops | BREACH alert severity; $25/day fleet breaker; Haiku rate refresh $1/$5→$0.80/$4; `LLM_MODEL_ROUTING` verification | day 14 / pre-un-pause | ✅ cost-governor completion days 6–9 + days 10–14 |
| Legal | Portal deletion/RLS invariant tests into CI | Jul 17 | ✅ portal flag-off + RLS days 3–5 feeds it; CI wiring added to CI-floor scope |
| Legal | Implement P1 branch (delete tickets on close OR soften the published right) | Jul 10 | ⚠️ depends on Product's Jul 8 decision — scheduled Jul 9–10 |
| Legal | Account-deletion end-to-end check; Neon PITR verification (5 min) | Jul 17 / this week | ⚠️ PITR check not in Eng plan — assigned this week (5 minutes) |
| Data | Booking-link `ref` pass-through (XS) | before Jul 6 | ⚠️ not in Eng plan — assigned to the Sun Jul 5 sweep |
| Fleet-Ops | E1: close the 17-day dispatch gap (reconnect MCP or land GHA bridge); confirm governor VM exposes dispatch tools | **before Jul 7** | ⚠️ **not in Eng plan — the largest unacknowledged ask in the matrix.** Assigned: confirmation by Jul 5, fix or bridge by Jul 7 |
| Fleet-Ops | E2: blessed mint→push→PR wrapper (wrap the two existing minters) | fortnight | ✅ `fleet-ship.mjs` days 10–14 |
| Fleet-Ops | E3: CI floor / 41 red tests (standing, on paper only) | — | ✅ baseline-ratchet, already Eng's plan |

## Inbox: Product

| From | Ask | Due | Status |
|---|---|---|---|
| Engineering | Degraded-at-cap copy (vendor-invisible, one paragraph + banner string) | Jul 8 | ⚠️ not in Product plan — accepted, feeds honest-state work already scheduled days 4–7 |
| Engineering | Portal-off page copy ruling (visible line vs silence; silence = invisible) | Jul 5 | ⚠️ default stands if silent |
| Engineering | Inert-controls ruling (soften vs wire, per control; silence = defaults) | Jul 7 | ⚠️ default stands if silent |
| Engineering | Guarantee human-review window length | — | ⚠️ default: one full Day-7 cycle spot-checked |
| Design | Demo mode ON by default for fresh RE trial workspaces (default-flip, not build) | before Jul 6 | ✅ Product item 4 |
| Design | Accept shell P1 batch (loading.tsx, silent-null → notFound, 44px primitives) | next sprint | ✅ acknowledged as post-window |
| Design 🔁 (needs Conner) | `/how-it-works` closing CTA ruling: booked call vs trial signup — one target | window close | ⚡ routed to Conner queue (batch ruling) |
| Marketing | Real screenshots, two sets (own workspace + demo runtime, labeled) | Jul 8 | ⚠️ not in Product plan — assigned; demo capture is deterministic, any day |
| Marketing | Article surface (see Engineering row) | Jul 9 | 🔁 same item |
| Sales | Named demo state, verified weekly (URL, seeded, LLM-free, reset path) | Sun Jul 5 + weekly | ✅ partial (demo-mode work); the *weekly re-verify + reset path* is new — accepted |
| Sales | Demo beat scripted (draft → edit → approve on screen-share) | first booked call | ✅ 02 §4 |
| CS | [gate] Onboarding-path dashboard states verified against runbook; dry-run P0s outrank everything else | day 4 | ✅ honest-state model days 4–7; priority rule accepted |
| CS | Friday weekly report sanity-checked on dry-run workspace | week 1 | ⚠️ not in Product plan — assigned alongside 1.6 |
| CS | Portal stays dark on every partner-visible surface (standing) | standing | ✅ ratified kill list |
| Legal | P1: support-ticket deletion direction — delete on close OR soften the published right (BLOCKING) | **Wed Jul 8** | ⚠️ **not in Product plan — assigned as a dated decision, Jul 8** |
| Legal | AI-disclosure line on draft surfaces (spec this cycle) | this cycle | ⚠️ accepted as spec-only |
| Legal | Clickwrap acceptance capture spec | pre-self-serve | ✅ spec handed, ship later |
| Data | Ratify five events + property schema as the activation contract | this week | ⚡ three event lists — `02` C4 |
| Data | "How did you hear about us" signup field (copy through voice gate) | week 1 | 🔁 Marketing asks the same — one build |
| Data | `dataGaps` honesty convention for customer-facing numbers (standing) | standing | ✅ consistent with Truth Wave |

## Inbox: Design

| From | Ask | Due | Status |
|---|---|---|---|
| Product | Demo-mode first impression polish (runtime hero + demo label + Connect card as one arc) | week 1 | ✅ days 10–14 dashboard first-render — ⚡ Product wants send-week; plan-of-record: demo label + Connect card pass pulled to days 3–5 |
| Product | Chip/status-line family, PlainoStatus icons only | days 4–7 | ✅ |
| Product | 44px touch-target pass on activation CTAs | week 1–2 | ✅ shell P1 batch |
| Product | #306 disclosure screen as trust asset, broker vocabulary | week 1–2 | ✅ |
| Marketing | Five visual treatments for five pieces, Heritage tokens, one OG each | Jul 6–16 staggered | ✅ editorial-rhythm workstream absorbs it |
| Marketing 🔁 Sales | LinkedIn banner + invite thumbnail via creative-router (Sales says by Jul 13; Marketing says Fri Jul 4) | **Jul 4 EOD** (earliest wins) | ✅ 🔁 deduped |
| Marketing | Screenshot dressing for pieces 3–4 (demo-data labels part of the figure) | Jul 14 | ✅ |
| Sales | One-pager layout (print-clean, attach-clean) | Thu Jul 9 | ⚠️ not in Design plan — assigned with Marketing's copy |

## Inbox: Marketing

| From | Ask | Due | Status |
|---|---|---|---|
| Product | Outreach + landing alignment: emails link `/real-estate`, hero states the killer-workflow promise verbatim | Jul 4–6 | ✅ (Design agrees; Conner ratifies destination in batch ruling) |
| Product | Verify `/how-it-works` unshadowed on production with curl, not memory | hours | 🔁 = Sales' sweep ask to Eng; folded into 0.8 |
| Product | Replace or substantiate the $2,900–$10,600/mo ROI card | Monday | ⚡ `02` C3 |
| Product | De-orphan `/guarantee` + reconcile 14-day money-back vs Day-7 walk-away on one page | week 1 | ✅ Design Day-1 links; copy reconciliation ⚠️ assigned to Marketing |
| Sales | One-pager, sendable form, claims traced | Thu Jul 9 | ✅ collateral workstream |
| Sales | Case-study carrot: one-screen template mock (no fabricated numbers/logos) | Jul 13 | ⚠️ not in Marketing plan — assigned |
| Sales | Recorded product walkthrough (synthetic runtime, disclosure on screen, <15 min) | end of week 2 | ⚠️ not in Marketing plan — assigned; routes via creative-router |
| Legal | Apply `/security` softening ruling verbatim | Mon Jul 6 | ⚠️ **not in Marketing plan** — assigned to the Day-1 fix PR (with Design) |
| Legal | 7-item vendor-name scrub (4 in home page, 3 in FAQ) | same week | ⚠️ assigned — the PR #354 scrub targets are still unapplied |
| Legal | Claims audit on anything Conner sends (standing); `/terms` version+date visible | Jul 10 | ✅ claims spot-check exists; terms stamp ⚠️ assigned |

## Inbox: Sales

| From | Ask | Due | Status |
|---|---|---|---|
| Marketing | Prospect-to-stack map (CRM, team size, the pain) for the named five | Fri Jul 4 | ✅ document 01 carries the shortlist; map is a Fri sitting with Conner |
| Marketing | UTM discipline: paste tagged links, don't hand-build | continuous | ✅ |
| Marketing 🔁 Data | Reply intelligence / reply logging in `/operator/outreach` within 24h with disposition | continuous | ✅ 🔁 one habit satisfies both |
| Marketing | Call-booked trigger: attach piece 4 as pre-read; tell Marketing same-day | continuous | ✅ |
| CS | [gate] Handoff sheet template by day 5; filled within 24h of any call; promises in writing | day 5 | ✅ CS+Sales co-write days 4–7 |
| CS | Signed short letter before onboarding is booked (standing) | standing | ✅ |
| CS | Call-ownership split: discovery/convert = Sales; weekly pilot + support = CS; nobody sells on a support call | standing | ✅ |
| Fin-Ops | Flag the pilot workspace BEFORE key un-pauses so caps go on first | 1-message lead time | ✅ preflight step 1 |

## Inbox: Customer Success

No head filed asks TO CS this window. CS is intake: its gates are asks on Engineering, Product, Data, and Sales (placed above). Matrix note: CS's five explicit [gate] items are the most deadline-dense in the matrix — all land days 3–5.

## Inbox: Finance-Ops

| From | Ask | Due | Status |
|---|---|---|---|
| Engineering | Ratify default caps ($40/mo + $4/day proposed); one number back or the proposal stands | Jul 8 | ⚡ vs CS's $50/mo — `02` C1 |
| Engineering | Prod DB P3009 cleared via `migrate resolve` (NOT resume-Neon) before the un-pause window | pre-Jul-11 | ✅ known recipe; 🔁 Data flags the same |
| Engineering | Fleet spend as a line item in the monthly view Conner sees | ~Jul 9+ | ✅ digest day 7 |
| Data | Monthly spend rollup with one owner (invoice + infra + GTM stack) | day 14 | ✅ fixed-cost ledger |
| Data | Confirm the fixed-cost line for contribution math | day 7–14 | ✅ |

## Inbox: Legal

| From | Ask | Due | Status |
|---|---|---|---|
| (Marketing, flag) | If the analytics vendor processes visitor data, `/privacy` subprocessor update through the counsel packet before events flow | before Jul 11 | ⚠️ new — added to Batch 2 |
| (Design, flag) | `/security` redaction: the line naming Conner as sole prod-access holder | window close | ⚠️ folded into the Day-1 fix PR; Legal confirms wording |

## Inbox: Data

| From | Ask | Due | Status |
|---|---|---|---|
| Engineering | Spend-stamp schema ratification (owner-of-record sign-off) | Jul 5 | ✅ instrumentation plan owns the schema |
| Engineering | Scoreboard instrumentation from CRM-lite stages; decide YAML read vs page vs manual count | Jul 8 | ✅ dashboard 1 |
| Engineering | Margin-ledger consumer (cost-per-workspace vs tier price, monthly) — claim it or it becomes a Fin-Ops ask | — | ⚠️ unclaimed — plan-of-record assigns to Data (monthly, with Fin-Ops rollup) |
| Product | Five activation-funnel events + TTFDV | Jul 10 | ⚡ `02` C4 (one contract) |
| Product | Approval-latency measurement from existing exhaust | week 2 | ✅ |
| Product | Saved-time ledger weekly read-back assert (producer-without-consumer tripwire) | week 2 | ⚠️ assigned — one weekly query |
| CS | Activation timestamps queryable per workspace (SQL file is fine at n=1) | day 7 | ✅ |
| CS | Approvals-per-week per workspace query | day 7 | ✅ |
| CS 🔁 Fleet-Ops 🔁 Fin-Ops | Spend-per-workspace / cost-stamp visibility (three heads, one wire) | week 2 | 🔁 deduped into 0.12 — **build owner: Engineering; schema owner: Data** (see ownership note below) |
| Fin-Ops | Finance panel atop weekly retro output | day 7 | ⚡ minor date mismatch (Data plans spend telemetry days 8–14) — plan-of-record: panel v1 Jul 10 with whatever rows exist |
| Fin-Ops | Fixed-cost ledger home in `memory/data/` | day 7 | ✅ |
| Fin-Ops | `/operator/finance` spec (spec only; build gates on first partner) | day 14 | ✅ |
| Fleet-Ops | D1 cost stamp at loop-pass close-out + scheduled-task completion | fortnight | 🔁 same wire as above |
| Fleet-Ops | D2 deliverable-conversion query (backlog cards filed vs consumed) | fortnight | ✅ |

**Ownership note — the cost stamp.** Four plans reference `stampSessionCost` wiring and each assigns it outward: Fin-Ops → Engineering (day 3), Fleet-Ops → Data (D1), Data → Engineering (day 14), Engineering → Data (schema) + Fleet-Ops (dispatch call site). Plan-of-record: **Engineering wires all call sites by Jul 5** (earliest stated deadline governs), **Data ratifies the schema Jul 5**, **Fleet-Ops verifies loop-pass close-out stamps post-Jul-7**, **Fin-Ops consumes in the Jul 10 digest.** No head should wait on another for this again.

## Inbox: Fleet-Ops

| From | Ask | Due | Status |
|---|---|---|---|
| Engineering | Dispatch overlap check (wave briefs declare file-sets; refuse or serialize overlaps) | Jul 10 | ✅ consistent with loop-governor work — accepted |
| Engineering | Mandatory 2-line retro-write field in the wave template | fortnight | ✅ memory-hygiene workstream |
| Engineering | Spend stamp in dispatch parent | with 0.12 | ✅ |
| Engineering | Label bakeoffs (name the judge or it's a dispatch bug) | fortnight | ✅ |
| Engineering | Merge-train discipline: open-PR cap ~6 enforced at dispatch time; ready PRs merge within 24h | standing | ✅ |

## Inbox: Conner

All 20+ asks on Conner from all heads are deduped and ranked in `03-consolidated-conner-queue.md`.

---

## Matrix findings (what coordination itself surfaced)

1. **Two hard unacknowledged asks:** Fleet-Ops→Engineering E1 (dispatch gap, before Jul 7 — the governor is dormant without it) and Legal→Product P1 (ticket-deletion direction, Jul 8 — blocks the ToS/Privacy batch). Both now dated in the plan-of-record.
2. **Five-way duplicate:** saved-time writers (Product, Sales, CS, Fin-Ops, Data all ask Engineering). Already first on Engineering's own list — one build closes five asks. No coordination needed beyond not re-asking.
3. **Three-way event-schema fork:** Marketing (4 goal events), Data (5 funnel events), Product (5 activation events). One contract required before anyone builds — `02` C4.
4. **Four-way ownership tangle on the cost stamp** — resolved above; Engineering builds, Data owns schema.
5. **Legal's Marketing asks were invisible:** the `/security` softening and vendor-name scrub are ratified rulings (PR #354) that no executing plan had picked up. Now in the Day-1 fix PR scope.
6. **CS asks nothing of Marketing/Design and nobody asks CS for anything** — correct for n=0, and a useful sanity check that the matrix reflects the actual shape of the fortnight.
