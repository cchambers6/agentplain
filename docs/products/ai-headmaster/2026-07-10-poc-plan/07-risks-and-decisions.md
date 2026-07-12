# AI Headmaster POC — Risks & Conner Decisions

The five biggest risks, each with the decision or test that retires it. Decisions follow the consolidated-decision-queue discipline (`docs/skills-v2/cowork/orchestration/consolidated-decision-queue/SKILL.md`): every item carries a recommendation and a default that fires if unanswered — except where silence is unsafe, which is flagged.

## 1. Chat-first vs lightweight app (Conner decision #1)

**Risk:** we build the wrong surface and the ≤5-min daily loop dies of friction.
**Recommendation: lightweight web app whose daily surface IS a chat thread** (SSE) — not a dashboard with chat bolted on, and not a bare messaging-platform bot. Reasoning in doc 01 §1: Slack is the wrong audience; iMessage has no sanctioned API (a hack there violates runner portability and would be rebuilt for v1 anyway); an owned surface is the only place vendor invisibility and voice are fully ours. The app shell exists because three artifacts genuinely aren't chat: the week view, the child-model view, the compliance export.
**Default if unanswered:** the recommendation.
**Retire-by:** M3 dry-run friction data — if week-2 live parent time exceeds 5 min because of *surface* friction (not conversation length), revisit before v1.

## 2. Which 2–3 curricula for the dry run (Conner decision #2)

**Risk:** curricula choice invalidates the bake-off (too easy: one publisher's matched set integrates trivially; too hard: philosophically incompatible sets fail for reasons that aren't the product's fault).
**Recommendation:** three curricula, **different publishers, one clearly CM-aligned, one neutral** — candidates the target family plausibly owns: *Math with Confidence* (math, CM-compatible), *The Good and the Beautiful Language Arts* (LA, open-and-go), *Exploring Nature with Children* (CM-native). These are candidate names for Conner to confirm — the deciding constraint is **what the live-dry-run family actually owns** (core rule: we plan around owned materials; we don't acquire content).
**Silence-unsafe:** M0 cannot run without this — no default fires. **This is the one decision blocking the first fleet-day.**
**Retire-by:** M0 bake-off inputs assembled.

## 3. Simulated vs live M6 (Conner decision #3)

**Risk:** fully simulated proves nothing about real-parent behavior; fully live burns the one real family's goodwill on unshaken software.
**Recommendation: hybrid.** Week 1 simulated — scripted parent persona, injected disruptions, one "bare-minimum parent" day ("all fine, done") to test the debrief's don't-pad rule. Week 2 live with the real family on real materials. Simulated week finds the crashes; live week measures the acceptance criteria that matter (parent minutes, onboarding time).
**Default if unanswered:** the recommendation.

## 4. The "does the Integrator actually integrate?" bet — THE bet

**Risk:** the product's central claim — one coherent plan across curricula and philosophies — is the one thing no existing pattern proves. If Opus given metadata-only inputs staples three schedules together, the product is a scheduling app with good manners, and the $25–35/mo positioning collapses.
**How we test it before spending weeks (M0, 1 fleet-day, ~$30):**
- Inputs: real ToC metadata for the decision-#2 curricula + CM pack + the doc 03 §1 prompt. Three generations (prompt-varied per run, since sampling params are fixed on Opus 4.8).
- **Stapling rubric (5 points):** (1) ≥2 genuine cross-subject threads with named unit refs and a stated pedagogical reason; (2) all prerequisite orderings honored; (3) ≥1 real conflict surfaced with a tradeoff (zero conflicts on heterogeneous inputs = not looking); (4) daily-load balancing that shows the philosophy pack's rhythm rules (short lessons, variety) rather than uniform slots; (5) zero content reproduction.
- Three blind judge passes score each generation. **Pass: ≥2 of 3 judges at ≥4/5 on the best generation.** One structured iteration allowed on failure (fix the prompt, not the rubric). **Two failures → stop and report** — per kill-list discipline, the restart trigger is a materially different approach (e.g., curriculum knowledge base first — the doc 08 moat — so the model integrates from richer ground truth).
- Judge validity check: a deliberately stapled control output is scored in the same blind batch; any judge scoring the control ≥4 disqualifies that pass.

## 5. The "child model actually compounds" bet — acceptance #3 without cherry-picking

**Risk:** ≥3 plan adjustments "traceable to debrief observations" is trivially gameable by narrative — any plan change can be story-fit to some log line after the fact.
**How the design makes it non-cherry-pickable:**
- **Traceability is schema-enforced, forward-only:** the evidence chain is written at *generation time* (debrief → `ChildModelUpdate.patch.evidence` verbatim quote + `dailyLogId` → `WeeklyPlan.rationale[].modelUpdateIds`), not reconstructed at evaluation time. The Headmaster schema *rejects* uncited adjustments (doc 03 §2), so the set of adjustments = the set of cited adjustments; there is no uncited pool to cherry-pick from.
- **The metric is a fixed SQL query** (doc 02) written now, before the dry run — ≥3 rows, spanning ≥2 distinct weeks and ≥2 distinct observation dates.
- **Counterfactual check (the honest half):** for each claimed adjustment, a reviewer asks "would the Sunday plan plausibly differ absent this update?" — an adjustment that restates the IntegrationMap's existing sequencing doesn't count; the Friday report must also *mention* the pattern (the parent saw the loop close, not just the DB).
- **Negative control:** the simulated week includes 3 observation-free days; if "adjustments" appear citing those days' logs, the extractor is hallucinating signal and M3 reopens.
**Retire-by:** M6 scorecard.

## Standing risks (tracked, not decision-blocked)

| Risk | Mitigation | Owner |
|---|---|---|
| Onboarding >20 min (curricula metadata entry) | unit-table quick entry + defaults (M1); photo-import deferred to v1 | Eng |
| Debrief feels like homework → parent churn from the loop | 3–6 question cap, one-thread rule, bare-minimum-day path (doc 03 §3b); measured per-day in M6 | Product/Design |
| Compliance record wrong (legal exposure) | rules-only generation, golden-set test, Haiku never guesses attendance (doc 03 §4); GA statutory mapping counsel-checked before any customer-facing claim — same gate agentplain applies (`project_legal_head_plan_2026_07_03`) | Product |
| Curriculum-content leak (core rule breach) | no-content schema + Sentinel scan + CI content-gate + M6 manual audit of 20 random outputs | Eng |
| Cost blowout | hard budget gate + degradation ladder + measured meter (doc 06) | Eng |
| Fable/Opus prompt drift between plan and build | prompts are v0 drafts; M0/M2 own iteration; re-baseline against the live API at build time, don't trust the plan's token estimates blindly | Eng |
