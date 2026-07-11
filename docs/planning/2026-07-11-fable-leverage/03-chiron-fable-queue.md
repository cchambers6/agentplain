# Chiron — Fable Work Queue (2026-07-11)

**State:** M1 shipped (PR #381 — schema with no curriculum-content column, 36-curriculum catalog, /onboard + /today, tiered routing + cost meter). M2 shipped ready-for-review (PR #383 — Integrator prompt with real cache breakpoint, Zod schemas, content-gate, IntegrationMap + /plan, ~$0.13 first run, 72–82% cache on steady state). CM pack full-fidelity shipped (PR #385 — 48 citations, pack:verify gate). Next milestones per the POC plan (`docs/products/ai-headmaster/2026-07-10-poc-plan/04-milestone-sequencing.md`): M3 daily loop, M4 Headmaster weekly cycle, M5 Registrar, M6 dry run.

Chiron is the densest Fable surface in the portfolio right now: it is a *prompt-engineering product*. The moat is the quality of five production prompts and the philosophy corpus behind them. That is Fable's exact profile.

## Ranked queue

### C1. M3 daily-loop prompt suite — morning brief, debrief, Child.model extractor (L effort; #1 overall)

The three prompts every family runs every school day, for `chiron/lib/agents/tutor/`:

- **Morning brief** (lightweight tier, Haiku): today's blocks from the WeeklyPlan, child-aware framing, ≤5-min parent read. Cheap model, so the prompt must carry the quality — exactly where careful prompt design pays most.
- **Debrief conversation** (conversational tier, Sonnet 5): the evening chat that extracts how the day actually went without interrogating a tired parent. Voice-critical: Chiron first-person, warm, plain, unhurried (rule 6 of the Integrator prompt carries over).
- **Child.model update extractor** (heavy tier, gated by Haiku triage per the L3-conductor shape, PR #380 doc 06): reads the debrief transcript, emits append-only `ChildModelUpdate` rows carrying **verbatim evidence** — the anti-cherry-pick design behind acceptance criterion 3's SQL query. The judgment call ("Anna processes new information by inventing playful details" vs. noise) is the hardest prompt in the product.

Deliverable: `prompt.ts` (stable prefix built via `lib/ai/cache.ts`, nothing timestamped before the breakpoint), `schema.ts` (Zod), content-gate coverage on every output string, mock fixtures passing the same schema+gate as live (the PR #383 discipline), smoke script with metered cost. Sonnet wires routes/SSE; Fable authors the prompts, schemas, and fixtures.

**Why #1:** it gates M4 and M6, it's run daily (quality compounds), and it carries the product's second-biggest bet — "the child model compounds" — which M6 measures.

### C2. M4 Headmaster weekly-cycle prompts (M effort)

Sunday WeeklyPlan generation from the IntegrationMap (`adjustments_from` and `combine_group` seams already in the schema, PR #383), the mid-week disruption replan (remaining days only), and the **Friday report** — whose explicit bar is "reads like a colleague" with rationale rows citing real ChildModelUpdate ids (acceptance criterion 3, milestone doc M4). The Friday report is the retention artifact of the whole product; same writing discipline as agentplain's weekly report (queue item A2) — do them within the same fortnight so the editorial judgment transfers.

**Depends on C1 merged** (rationale rows cite ChildModelUpdate ids that M3 produces).

### C3. Retro-run the M0 stapling rubric on live M2 output (S effort, half-session)

M1/M2 shipped without the M0 bake-off the plan gated them on. Cheap to close honestly: run the 3-blind-judge, 5-point stapling rubric (POC plan doc 07 §4) against real M2 output from the Hartfield seed, including a stapled control. If ≥2 of 3 judges score ≥4/5, the integrate-vs-staple bet is retro-settled for ~$10; if not, that's a finding worth far more than the session cost — per kill-list discipline, two failures = stop and rework the Integrator prompt before M3 builds on it. Fable serves as judge-prompt author and one of the judges (multi-source judgment); the other two judge passes can run on Opus 4.8 for independence.

### C4. M2 prompt-cache optimization pass, 72–82% → target >90% (S effort, pair with C1)

The current stable prefix is role + pack markdown + catalog JSON (~4.2K tokens, `chiron/lib/agents/integrator/prompt.ts`). The miss share is mostly the volatile family snapshot + output-spec riding in the user message, and first-call cache writes. Concrete moves for a Fable pass: (a) split a second breakpoint so the family-stable material (curricula list, philosophy binding, school days — changes only when the family edits setup) is cached separately from the truly per-run material (child model, week number), using up to 4 breakpoints; (b) confirm the JSON serialization of catalog entries is deterministic (a re-ordered key silently zeroes the cache); (c) mind the minimum cacheable prefix (4096 tokens on Opus 4.8 — a split that drops a segment below the floor silently stops caching it); (d) verify with `cache_read_input_tokens` in the meter, not by eyeball.

Honest sizing: at ~$0.30–0.35/family/mo for the Integrator, pushing 82%→90% saves cents per family. It matters at 1,000 families, not 1. **Do it inside the C1 session** (same files, same context) rather than as a funded line item — it also sets the caching pattern C1/C2 prompts will copy, which is the real payoff.

### C5. Conflict-surfacing decision framework (S effort, pair with C1 or C2)

Rule 2 of the Integrator prompt — surface high-stakes conflicts as parent choices, decide low-stakes ones silently — is currently one prose paragraph. Author the explicit stakes rubric: force a choice when (reversibility is low ∨ cost is real ∨ philosophies genuinely conflict ∨ the child model gives no signal); decide-and-note otherwise, with worked examples per class (pacing-model clash = choice; duplicate copywork = decide). Lands as both prompt text and a short `docs/products/ai-headmaster/` design note so M4's Headmaster applies the same rubric. This is judgment codified — small, but it's the product's trust surface with parents (a silently wrong call breaks trust; an over-asked parent churns).

### C6. CM pack extension — Logic + Rhetoric stages (M/L effort; top-3 overall, see 00)

Extend `chiron/lib/philosophies/charlotte-mason/` past Grammar: Forms III–VI lesson caps and minute ladders, written-narration and exam expectations, living-books progression, nature study/handicrafts age extensions, weekly rhythms for older children. Same machinery as PR #385: ≥40 new citations against AO `/cm/volN` (download + grep, Mozilla UA — WebFetch loses the page markers), PNEU primaries, `modern-application` interpretation notes for anything not provably Mason, `pack:verify` green, stub-swap behavioral diff per `TESTING.md`. Fire before onboarding any family with a child over ~9.

### C7. Parent-facing voice pass — /plan vision, onboarding microcopy, Chiron voice guide (S effort)

The `/plan` vision paragraphs (WeeklyPlan.vision, PR #383), the 7-step onboarding wizard microcopy (PR #381), and a one-page Chiron first-person voice guide (analogous to agentplain's PR #309 but for a homeschool parent audience: warm, unhurried, never edu-jargon, never vendor-visible — voice-gate already scans `chiron/lib/philosophies`, extend it to the new surfaces). One session; do it after C1/C2 exist so the guide is written against real agent output, not hypothetical.

### C8. Curriculum catalog 36 → 100+ — design the pipeline, don't hand-grind it (S effort for Fable)

The catalog (`chiron/lib/catalog/catalog.json`, built by `scripts/build-catalog.mjs` from research YAML) needs breadth eventually, but bulk scope-and-sequence extraction is exactly the "Fable designs, cheaper models run" shape. Fable's session: extraction template per curriculum (unit table, lesson counts, minutes, pairings/conflicts, philosophy notes), a QA rubric, the Haiku/Sonnet extraction prompts, and a verification sampling plan (spot-check N entries against publisher ToCs). The 64+ actual extractions then run on Sonnet/Haiku at a fraction of the cost. **Trigger:** a real family owns a curriculum not in the 36 — until then the Hartfield seed covers the POC.

### C9. Narration-quality signal calibration (S effort, GATED on M6 transcripts)

The subtle version of C1's extractor problem: tuning what counts as a *quality* signal in narration ("invents playful details" = engagement pattern worth recording; "said it was fine" = nothing). This calibration is only honest against **real debrief transcripts**, which don't exist until the M6 dry run (week 1 simulated, week 2 live). Scheduling it earlier produces confident rules with no evidence — exactly what `feedback_no_guesses_no_estimates` bans. Park until M6 week 1 output exists; then it's a high-value half-session reading every transcript in one context and diffing the extractor's calls against its own.

### C10. Trivium / Memoria / Circe philosophy packs (L effort each, GATED)

Full-fidelity packs cost 1–2 corpus-heavy sessions each (PR #385 calibration). The POC family is CM; no demand signal exists for the others. Building all three now is vertical-expansion-by-another-name — the kill-list discipline (finish locked things first) applies. **Trigger:** a second design family (or a concrete prospect conversation) names a philosophy. Then build exactly that one, copying the PR #385 shape and `pack:verify` gate. Trivium is the likely first (classical demand skews largest), but let demand pick.

### C11. ESA vendor packet for Arizona (M effort, GATED — last)

v1.5 territory per the POC plan's transition doc. Real Fable work eventually (legal + product synthesis: ESA program rules, vendor registration, pricing presentation), but it presumes the POC passed M6 and Conner greenlit a second state's compliance surface. Scheduling it now would violate both the milestone gate and the spirit of KILL #2. **Trigger:** M6 acceptance scorecard passes + explicit Conner decision on AZ.

## Not-Fable within Chiron

Repo move to `cchambers6/chiron` (mechanical, `MOVE-TO-DEDICATED-REPO.md` is the script), route/SSE wiring for M3/M4, cron plumbing (`app/api/cron/headmaster`), Registrar M5 (rules code + golden set — Sonnet with the spec), AO volume downloads, migrations. See `06-not-for-fable.md`.
