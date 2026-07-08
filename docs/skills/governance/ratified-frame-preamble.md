# Ratified-frame preamble

**Domain:** governance · **Kind:** paste-in preamble · **Seeded by:** the "Ratified frame" block that opens every 2026-07 orchestrator pass — CEO (`docs/ceo/2026-07-02/`), Chief-of-Staff (`docs/chief-of-staff/2026-07-02/`), the department heads (`docs/departments/2026-07-03/*/00-EXECUTIVE-PLAN.md`), the COORDINATION plan (`docs/departments/2026-07-03/COORDINATION/00-UNIFIED-14D-PLAN.md`), and the loop tracks (`docs/loop/prompts/TRACKS.md`).

## Why it exists

Every orchestrator or track pass operates **inside a set of standing decisions**. If a pass doesn't restate them, it re-litigates settled questions, drifts audience/positioning, or proposes work that's already been killed. The fix the fleet converged on: **paste the same ratified frame at the top of every orchestrator prompt** so the model reasons inside the guardrails instead of rediscovering them.

## When to use — trigger phrases

- "dispatch a Head of {X}" / "run a CEO/CoS/planning pass" / "fire a loop track"
- any prompt that asks an agent to plan, prioritize, cut, or decide
- Rule of thumb: **if the pass produces decisions, it gets the preamble.**

## The preamble (paste verbatim, update the dated facts)

> ⚠️ Keep the *structure* stable; refresh the bracketed facts from memory + the live kills/rulings before each dispatch. Every fact below traces to a ratified memory or a committed doc — do not invent new standing rules here.

```md
## RATIFIED FRAME — you operate inside these standing decisions. Do not re-litigate them.

### Model default
- Orchestrator and worker passes run on **Opus** (claude-opus-4-8). The Fable window
  (weekly-plan-limit period) is over — "back to opus." The L3 heartbeat *conductor*
  may stay cheap (Haiku), but *worker* passes are Opus. [feedback_back_to_opus_2026_07_08]

### CEO's biggest lever this week
- The single lever is **the first 5 Georgia real-estate design-partner sends** and the
  replies/call they produce. Cash-breakeven is 3–9 customers; ~$10K MRR ≈ founder-inclusive
  profitability. Everything competes with that lever for priority.
  [docs/ceo/2026-07-02/02-biggest-lever-this-week.md]

### Kill list (RATIFIED 2026-07-03 — do not propose killed work)
- **KILL #1** — no new audit / retro / planning / deep-dive loops. Restart trigger: the
  MASTER-SYNTHESIS top-20 fix table is burned down.
- **KILL #2** — no GTM outside Georgia real-estate. Restart: 2 RE design partners live.
- **KILL #3** — flatsbo waitlist-dark: **OVERRIDDEN by Conner. flatsbo stays live.**
- **KILL #4** — client portal as a funded workstream. Restart: first design partner asks for it.
- **KILL #5** — no LLM-dependent feature shipping against the paused production key.
  [docs/kills/2026-07-03/RATIFIED.md]

### Load-bearing positioning overrides (never drift)
- Audience is **"local businesses."** Never "SMB," "knowledge workers," "teams."
  [project_agentplain_mission_and_positioning]
- We are a **service layer ON TOP OF Claude's agentic capability**, not a competitor.
  BANNED words: compete / replace / instead-of / alternative-to (re: Claude/Anthropic).
  [project_sbm_wrapper_positioning_2026_06_06]
- **Model/vendor invisible** on every customer-rendered surface. Sole exception: the
  /privacy and /security subprocessor lists. [feedback_model_vendor_invisible_on_customer_surfaces,
  docs/copy-rulings/2026-07-03/model-vendor-invisibility.md]
- Customer vocabulary, not engineer labels ("Setting up" / "Working" / "Watching").
  [feedback_customer_vocab_not_engineer]
- **agentplain is THE priority**; flatsbo waits on license + counsel. [project_agentplain_is_priority]
- Plaino is the named service partner. Pricing = three tiers (Regular/Partner/Max) + Custom;
  "pilot pricing" is banned. No-outbound architecture (agents draft; the customer's system sends).
- No quick fixes — best fixes only. [feedback_no_quick_fixes]

### Output discipline
- Decisions, not narrative. Every claim carries a signal ref or is marked `todo-real-signal`.
- Cite the real artifact (PR # / file path). No fabrication — Truth Wave. [project_truth_wave_2026_06_16]
- End with ≥1 concrete deliverable ({design-decision | fix-spec | action}), or the pass is `drift`.
```

## Guardrails

- **Refresh the dated facts, keep the shape.** The kills, the lever, and the model default all change over time. Pull the current values from `docs/kills/`, `docs/copy-rulings/`, the CEO lever doc, and the `feedback_*` memories before pasting. Do **not** hand-edit the *rules* to suit a desired outcome.
- **Don't add new standing rules here.** This preamble reflects ratified decisions; a pass that wants a new rule proposes it as a deliverable for Conner, it does not smuggle it into the frame.
- **One source of truth per fact.** If the kill list and a runbook disagree (e.g. the Fin-Ops $4/day vs runbook $5/day daily-cap split, per the 2026-07-03 coordination pass), flag the conflict for Conner's ruling — don't silently pick one.

## Worked example

The COORDINATION unified 14-day plan (`docs/departments/2026-07-03/COORDINATION/00-UNIFIED-14D-PLAN.md`) opens with exactly this frame, which is why all ten department head plans it reconciled stayed inside the same kills, the same audience, and the same "first-5-sends" lever without ten separate re-derivations. Any head plan that had drifted (e.g. proposing CPA/law GTM) was caught against KILL #2 at coordination time rather than after a PR shipped.
