# Post-Jul-7 model transition — the exact procedure

**The situation:** Fable 5 is plan-included until **2026-07-07**
(`reference_claude_fable_5_back_2026_06_28`); after that it bills at usage-credit
rates. Loop v3 removed the stop condition — the window close is a **model knob**, not
a stop (RUNBOOK § Model switch). The trap, named in the v3 failure table: if nobody
acts, passes keep firing Fable at $10/$50 per MTok by default. This doc makes the
switch a two-line edit with a default that fires even on silence.

Internal doc — model names and rates allowed. Rates cited from the Claude API model
catalog (2026-06): Fable 5 $10/$50 per MTok · Opus 4.8 $5/$25 · Sonnet 4.6 $3/$15 ·
Sonnet 5 $3/$15 with intro $2/$10 through 2026-08-31 · Haiku 4.5 $1/$5.

## Until Jul 7: Fable-max (ratified)

Marginal Fable cost is ~$0 through the window. Fleet-ops actions: governor scheduled
**today** (it has never ticked — every un-fired pass is discarded free capacity),
`pass_model: claude-fable-5`, all nine tracks unpaused, and the 4h stall-replacement
doing its job. Target ≥ 8 completed passes before the window closes.

## Track-by-track assignment from Jul 7

| Track | Weight | Post-Jul-7 | Why |
|---|---|---|---|
| `ceo` | 20% | **Opus 4.8** | Owns the definition of "profitable" and cross-track steering; judgment-dense; perpetual queue item |
| `chief-of-staff` | 15% | **Opus 4.8** | Sequencing + Conner decision queue; the surface Conner actually consumes |
| `product-owner` | 15% | **Opus 4.8** | Produces merge-ready fix specs; a wrong spec costs a fleet session, dwarfing the model delta |
| `l1-journey` | 15% | **Pause** (queue intact) | Coverage map is fresh from the Fable window; deepening resumes when the fleet consumes the current backlog |
| `l2-profitability` | 10% | **Sonnet 4.6** | Re-scoring existing rows against schema + billing facts is structured work; the full v2 quality gate catches schema drops |
| `tab-audit` | 10% | **Sonnet 4.6** | Route walking against the 2026-07-02 audit baseline is verification-shaped; keep/fix/merge/delete calls are gate-checked |
| `agent-audit` | 5% | **Pause** | Needs the per-pass cost stamps (`01-…monitoring.md`) to exist before keep/fix/retire calls are evidence-based; running it now produces guesses |
| `business-model` | 5% | **Pause** | Proposals-only track; pricing is locked and every output needs Conner ratification anyway — batch it for when he has decision bandwidth post-outreach |
| `vertical-priority` | 5% | **Pause** | Sales strategy is ratified (RE/GA beachhead, CPA/law closed till 2 RE pilots); nothing to re-decide until pilot signal exists |
| L3 governor | — | **Haiku 4.5 (unchanged)** | Process control only; never escalates |
| Librarian / Watchdog / autofire / brief | — | **Unchanged** | Already on cheap models within caps (~$44/day cap total, actuals lower) |

Sonnet note: the task frame names Sonnet 4.6 ($3/$15). Sonnet 5 is the same sticker
with $2/$10 intro pricing through 2026-08-31 and is the stronger model; if the first
gated Sonnet pass is clean either id is legal for the knob — the schema takes any
model id. Default to `claude-sonnet-4-6` as specified; note the intro-priced upgrade
as a free swap.

## Cost math

Per-pass calibration from the v2 RUNBOOK (Fable card-rate equivalent ~$2.50–3.25 per
journey map, ~$1.50–2.10 per L2 vertical; lens tracks at or under the L2 shape —
call it **$4–6 per Fable pass** all-in). Scaling by input/output rates:

| Model | Rate vs Fable | Per pass | Config | Passes/day | Daily |
|---|---|---|---|---|---|
| Fable 5 (do nothing) | 1.0× | $4–6 | 9 tracks, ~10 passes | ~10 | **$40–60 — the default trap** |
| Opus 4.8, all 9 tracks | 0.5× | $2–3 | RUNBOOK Option A | ~10 | $25–40 |
| **Recommended split** | — | — | 3 tracks Opus (≈2–4 passes), 2 tracks Sonnet (≈1–2 passes), 4 paused | ~3–6 | **$6–14** |
| Strategic-only (Option B) | — | — | ceo + chief-of-staff on Opus | ~2–4 | $4–10 |

Business context for the number: cash-breakeven is 3–9 customers and one Regular
customer is $99/mo (CEO Pass 1; `lib/billing/facts.ts`). The recommended split costs
roughly $200–400/mo — one to two customers' revenue. That is defensible while the
loop's fix specs are being consumed and indefensible if they shelf; the consumption
signal in `01-…monitoring.md` is the review trigger. First measured week of
`pass_records` + cost stamps replaces these card-rate estimates.

## The exact switch procedure (runs Jul 6, effective Jul 7)

1. **Edit `memory/data/loop/state.yaml`** (operator edit, reviewed or direct per the
   state-file convention — it is an inert path):
   - `pass_model: claude-opus-4-8`
   - `tracks`: set `paused: true` on `l1-journey`, `agent-audit`, `business-model`,
     `vertical-priority`; set `pass_model_override: claude-sonnet-4-6` on
     `l2-profitability` and `tab-audit` **if** the schema has a per-track override
     field — it does not today, so phase the Sonnet step: run everything unpaused on
     Opus first, and add the per-track override as a small schema-v3.1 PR before
     un-pausing the Sonnet tracks. Day one is therefore: Opus for ceo /
     chief-of-staff / product-owner / l2-profitability / tab-audit, four pauses.
   - Append a dated note: `model_switch: {date, by, from: claude-fable-5, to: …}`.
2. **No governor change.** It reads `pass_model` on the next fire (RUNBOOK Option A
   mechanics); ticks are idempotent; nothing restarts.
3. **Verify:** next fired pass's session shows the new model; its close-out and gate
   verdict land normally; cost stamp reflects Opus rates.
4. **Quality watch:** the governor's gate is model-blind. If Sonnet-track passes draw
   `accepted-with-nudges`/`rejected` at a visibly higher rate in week one, flip those
   tracks to Opus — a one-line revert. Gate verdicts are the arbiter, not vibes.
5. **Reversal:** everything above is a state.yaml edit; un-pause restores any track
   with its queue intact (v3 design guarantee).

## The default (fires on silence)

If Conner has made no call by **2026-07-06 18:00 ET**, fleet-ops applies step 1 as
written (Opus + four pauses) and logs it. The Librarian's N4 deadline nudge
(`02-Librarian-evolution.md`) surfaces the decision with this default attached on
Jul 5 and Jul 6; the CoS track carries it in the Conner decision queue. Silence gets
the safe plan, not the $40–60/day trap.
