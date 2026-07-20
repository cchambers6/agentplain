# Loop tracks — the 9 design lenses (v3, 2026-07-03)

**The loop's objective: design agentplain into a profitable business.** Every
pass, on every track, exists to move the design of the business toward
profitability — not to describe the business. One pass = one track's lens
applied to one queue-item scope. The L3 governor picks the track by weighted
rotation (see `L3-haiku-heartbeat.md` § STEP 2); this file defines what each
track designs, where it writes, and what "done" looks like. Internal doc —
model names allowed; nothing here ships to a customer surface. Model routing:
passes run on `pass_model` (`claude-fable-5` — judgment tier), governor on
Haiku, per `project_model_routing_plan_2026_07_19`.

**The deliverable rule (hard, every track):** the 2026-07-02 audit + kaizen +
deep-dive cycle produced the analysis; the CEO Pass 1 kill list explicitly
cut "more analysis layers." No pass may produce another audit, retro,
synthesis, or deep-dive. Every pass MUST end with at least one deliverable:

- **(a) design decision** — a specific, ratifiable choice ("connectors page
  drops api-key tiles; Connect always routes through the #306 disclosure"),
- **(b) fix spec** — merge-ready: files, seams, acceptance criteria, sized so
  one fleet session can pick it up cold, or
- **(c) action** — a specific step the fleet or Conner can take today, with
  owner and default.

Declare each deliverable in state.yaml `last_pass_deliverables`
(`{type, ref}`). A pass that ends without one is gated as **drift** by the
governor and the next pass on that track inherits a corrective nudge.
Reading and evidence-gathering are means; the deliverable is the output.

Every track's pass shares the same skeleton:

1. Read `memory/data/loop/state.yaml` (schema v3). Confirm your scope matches
   the queue item the governor fired you with; you are pass `pass_number + 1`.
2. Address every pending `corrective_nudges` entry targeting your track (or
   `all`), marking each `status: consumed`.
3. Do the track's design work (below). Truth Wave applies: every claim
   carries a signal ref (audit finding, kaizen, code path, doc, memory slug)
   or is marked `todo-real-signal`. No fabricated numbers, customer counts,
   or quotes — directional judgments must say they are directional.
4. Close out state.yaml per the pass-writer rules in
   `memory/data/loop/schema.yaml` (v3): remove your queue item, stamp your
   track's `last_completed_at`, increment `pass_number`, write
   `last_pass_deliverables`, append any follow-up queue items for YOUR track
   only (per-track open-item cap: 5).
5. `npm run voice-gate` on your files, commit directly to main — allowed
   paths for your track only (table below) — with message
   `loop: pass {N} [{track}] — {scope-short}`. Push. No PR.

| # | Track slug | Weight | Writes to (allowed commit paths, + `memory/data/loop/`) |
|---|---|---|---|
| 1 | `ceo` | 20% | `docs/ceo/<date>/` |
| 2 | `chief-of-staff` | 15% | `docs/chief-of-staff/<date>/` |
| 3 | `product-owner` | 15% | `docs/product-owners/<date>/` |
| 4 | `l1-journey` | 15% | `docs/journeys/` (per L1 prompt) |
| 5 | `l2-profitability` | 10% | `docs/profitability/`, `docs/loop/backlog/` (per L2 prompt) |
| 6 | `tab-audit` | 10% | `docs/tab-audit/<date>/` |
| 7 | `agent-audit` | 5% | `docs/agent-audit/<date>/` |
| 8 | `business-model` | 5% | `docs/business-model/<date>/` |
| 9 | `vertical-priority` | 5% | `docs/vertical-priority/<date>/` |

---

## 1. `ceo` — design the shortest path to a profitable business (perpetual)

The queue always contains exactly one `ceo` item — the pass re-enqueues it on
completion, and the governor re-inserts it if it is ever missing. First pass
fired manually 2026-07-02 (`docs/ceo/2026-07-02/`); read the newest prior CEO
output before writing, and check execution against it before re-deciding
anything (Pass 1's own rule: verify execution before re-analyzing).

**Reads:** state.yaml (all tracks' latest), newest outputs from every other
track, `memory/MEMORY.md` index + load-bearing rules, `lib/billing/facts.ts`.

**Designs (`docs/ceo/<date>/`):** decisions, not narrative — (a) the current
critical-path order to profitability, updated only where evidence changed;
(b) the single biggest lever right now, with the action that pulls it;
(c) what to cut or stop, extending the ratified kill list; (d) cross-track
steering via `corrective_nudges` (target tracks by slug). Deliverables are
typically type `design-decision` and `action`. The CEO track owns the
working definition of "profitable" the other tracks design against (Pass 1:
cash-breakeven at 3–9 customers; ~$10K MRR ≈ founder-inclusive
profitability) — refine it with evidence, don't re-derive it.

## 2. `chief-of-staff` — design the execution sequence

First pass fired manually 2026-07-02 (`docs/chief-of-staff/2026-07-02/`).

**Reads:** open PRs and branches, worktree sprawl, the Conner-queue items
scattered across prior syntheses, other tracks' deliverables.

**Designs (`docs/chief-of-staff/<date>/`):** (a) the sequenced execution
plan — what lands next, in what order, unblocked-by-whom, each item a
deliverable someone can pick up; (b) kill/merge/land calls on duplicate or
zombie work-in-flight (type `action`, one per item); (c) the Conner decision
queue: each open decision with a recommended default so silence has a plan.
Deliverables: `action` and `design-decision`. No status reports — if an item
changes nothing about what anyone does next, it doesn't belong in the output.

## 3. `product-owner` — design each piece to be profitable

Each queue item names ONE piece. The piece inventory (extend as pieces ship):
**verticals** (real-estate, cpa, law, property-management, general),
**surfaces** (marketing home, workspace dashboard/Today, sell wizard,
connectors page, offers/approvals, reports, settings/account, customer
portal), **killer workflows** (one per vertical), **agents** (Plaino,
support-handler pipeline, per-connector agents such as Buildium / Follow Up
Boss / TaxDome, sentinel/compliance).

**Designs, per piece:** the profitable version of this piece. Start from the
two owner questions — is it delivering customer value (journey-map verdicts,
audit findings, shipped code paths) and is it profitable to run (runtime
cost shape, support burden, tier fit per `lib/billing/facts.ts`) — then
produce the redesign: the one fix that most raises value per unit cost
(type `fix-spec`), or the decision to simplify, merge, or cut the piece
(type `design-decision`). A verdict with no redesign attached is drift.

**Output (`docs/product-owners/<date>/<piece-slug>.md`).**

## 4. `l1-journey` — design the journey the customer would pay for

Per vertical × persona × stage → micro-moments → wants → delivering
yes/partial/no. Full method: `docs/loop/prompts/L1-journey-mapper.md`.
An `l1-journey` queue item runs L1 then L2 back-to-back in the same session
(the pass is the unit; L2's close-out rules apply). The map is the evidence
base; the pass's deliverables come from its L2 stage (backlog cards = type
`fix-spec`; classification calls = type `design-decision`) — a mapping pass
that files no card and changes no classification must say which existing
deliverable its evidence strengthens, or it is drift.

## 5. `l2-profitability` — design the margin

Per undelivered want → cost to deliver, price capture, margin band,
classification. Full method: `docs/loop/prompts/L2-profitability-lens.md`.
Standalone `l2-profitability` queue items re-score existing rows (fleet
shipped fixes, verdicts changed, cross-vertical roll-ups) without a new L1
stage. Deliverables: backlog cards (`fix-spec`), classification changes and
do-not-build calls (`design-decision`).

## 6. `tab-audit` — design every route to earn its place

Each queue item names a route group. Walk every route in the group as a
customer would land on it — the 2026-07-02 audit findings are the evidence
baseline (verify, never re-derive).

**Designs, per route:** keep / fix / merge / delete. A kept route gets the
one fix that makes it deliver its wants (type `fix-spec`, citing want ids
where maps exist); a redundant route gets a merge-or-delete decision (type
`design-decision`). Route-by-route description without verdicts is drift.

**Output (`docs/tab-audit/<date>/<route-group>.md`).**

## 7. `agent-audit` — design a fleet that pays for itself

Each queue item names an agent or agent family.

**Designs:** keep / fix / retire, decided against evidence — value verifiably
delivered (artifacts, merged output — cite them), cost per run (model tier,
token shape, human review time), position on the revenue path, and whether a
cheaper model or plain code does the same job (compose-order and budget-seam
rules apply). Retire calls and model-downgrade calls are `design-decision`;
rewire specs are `fix-spec`.

**Output (`docs/agent-audit/<date>/<agent-slug>.md`).**

## 8. `business-model` — design the pricing that captures the value

**Proposals only. `lib/billing/facts.ts` is SSOT and is NEVER edited by a
loop pass — a business-model pass that touches it fails its quality gate.**
Locked tier structure (Regular $199→$99 / Partner $299→$199 / Max sales-led
+ Custom) is the baseline; "pilot pricing" stays banned.

**Designs:** where tier promises and delivered value diverge, the honest
correction (deliver, re-scope, or re-price); add-on packaging from L2
`sell-as-add-on` rows that doesn't hollow out a tier promise; alternative
structures (per-vertical bundles, services-led onboarding fee, usage-based
components) only where they beat the ladder on margin AND simplicity.

**Output (`docs/business-model/<date>/`):** one change proposal per idea —
current state (quoting facts.ts), proposed state, margin reasoning
(directional, no fabricated dollar figures), risks, explicit "requires
Conner ratification" flag. Every proposal is a `design-decision`
deliverable; proposals flow to the Conner queue via the chief-of-staff
track.

## 9. `vertical-priority` — design where the focus goes

**Reads:** coverage_map gap counts, L2 roll-ups, sales deep-dive
(`docs/sales/deep-dive-2026-07-02/` — RE/GA beachhead, CPA/law closed till
2 RE pilots), product-owner verdicts per vertical.

**Designs:** the double-down / hold / cut call per vertical (type
`design-decision`, evidence-cited); the next focus-week pick with its top-5
landing list (type `action`); the cut-evidence threshold per vertical,
defined before it is needed so the future cut call is mechanical. Ratified
sales strategy is the prior; departures from it are proposals for Conner,
not decisions.

**Output (`docs/vertical-priority/<date>/`).**

---

## Quality gate per track (what the governor checks mechanically)

**First, every track: the design-for-profit gate** — `last_pass_deliverables`
non-empty, each entry typed (design-decision / fix-spec / action) with a
`ref` that exists. Fails → verdict `drift` + corrective nudge (no re-queue).
Then: l1-journey/l2-profitability items get the full v2 gate
(schema/coverage/voice-gate/want-count/dupes); all other tracks get the
light gate — (1) promised files exist under the track's allowed paths;
(2) voice-gate clean; (3) commit touched no path outside the track's allowed
list + state.yaml; (4) state close-out happened (queue item removed,
`last_completed_at` stamped). Failures → `accepted-with-nudges` or
`rejected` exactly as in the v2 gate.
