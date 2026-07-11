# Regression-testing a philosophy-pack update

The pack is data the agents steer by. A bad pack edit doesn't throw — it
quietly produces generic plans. So a pack change is tested at three layers:
internal invariants, drift against the serialized form, and a behavioral
diff on the Integrator.

## 1. Invariants — `npm run pack:verify`

Run on every pack edit (and in CI once chiron has a pipeline). Fails on:

- `pack.json` drifted from the TS modules (regenerate with `npm run pack:build`)
- a citation `rule_ref` pointing at a pack path that no longer exists
- a citation id referenced in any module (in `cite` arrays or inline
  `[vol1-...]` markers) that is missing from `citations.ts` — and the
  reverse: registered citations nothing references
- quotes longer than the short-quote limit (public-domain or not, we never
  carry paragraphs of source text)
- vendor-invisibility violations in any pack string (the pack surfaces
  verbatim in parent-facing reasoning traces)
- fewer than 40 citations, or minute caps that stop being monotonic by age

## 2. Serialization — `npm run pack:build`

`pack.json` is generated, never hand-edited. Any PR that touches a pack
module must include the regenerated `pack.json`; `pack:verify` enforces it.

## 3. Behavioral diff — the stub-pack swap

The question a pack update must answer: **does the Integrator's output
actually move when the pack moves?** If it doesn't, the pack is decoration.

Method (manual for M2, scriptable once the Integrator route lands):

1. **Fixture family**: use the seeded Hartfield demo (Anna, 6, grammar
   stage, SOTW1 + MUS Primer + ETC1).
2. **Baseline run**: call the Integrator with the full pack; save the
   `IntegrationMap` JSON.
3. **Stub run**: swap in a stub pack — same shape, neutered values
   (`max_block_minutes_by_age` all 60, empty `weekly_rhythms`, generic
   `variety_rule`, `daily_question_style` unchanged). Keep the stub in
   `__fixtures__/stub-pack.json`; never let it near production config.
4. **Assert measurable deltas** between the two maps. At minimum:
   - **Block trimming**: with the full pack, every block for a 6-year-old
     has `estMinutes <= 15`; the stub run should show untrimmed blocks.
     If both runs look the same, `lesson_shape` is not being honored.
   - **Standing rhythms**: the full-pack `weeklyRhythm` contains
     nature-walk / picture-study / composer-study blocks; the stub run
     contains none.
   - **Afternoon emptiness**: full-pack day plans place no book lessons
     after the midday boundary; the stub run may.
   - **Variety ordering**: in the full-pack run, no two disciplinary-kind
     subjects are adjacent in any day's sequence.
   - **Conflicts language**: a workbook-heavy curriculum in the inputs
     yields a philosophy-fit conflict entry under the full pack, not under
     the stub.
5. **Trace citations**: every rationale entry that invokes a pack rule must
   name a real pack path (e.g. `lesson_shape.max_block_minutes_by_age`).
   Spot-check that the paths resolve — `pack:verify`'s resolver is the
   same logic.

A pack PR that can't demonstrate at least the block-trimming and
standing-rhythms deltas should not merge: it means the new fidelity is not
reaching the plan.

## Provenance discipline (Truth Wave)

Every rule stated as Mason's carries a citation into the Home Education
Series or the printed PNEU time-tables. Anything that is our modern
application (trivium-stage bridge, six-week habit default, per-age minute
interpolation, seasonal menus, craft-age ladder) is listed in
`interpretation_notes` and labeled `modern-application` where it appears.
When editing: never add a "Mason said X" claim without a verbatim-checked
citation; if it's our call, put it in `interpretation_notes` instead.
