# AI Headmaster POC — Cost Architecture

Target: **≤ ~$10/family/month inference.** Result at recommended architecture: **point estimate $5.76/mo, 80% interval $4.50–$9.00.**

Rules applied verbatim from agentplain's AI-cost-architecture discipline: heavy reasoning weekly (Opus), light daily (cheap models); Haiku triage gates Opus; no polling — everything fires on an event or a cron, and daily generation is lazy (skip a school day, spend zero); aggressive prompt caching; per-family token budget with a hard gate; a visible meter.

## Pricing basis (Claude API, 2026-07; from the claude-api reference, cached 2026-06-24)

| Model | Input $/MTok | Output $/MTok |
|---|---|---|
| Opus 4.8 (`claude-opus-4-8`) | 5.00 | 25.00 |
| Sonnet 5 (`claude-sonnet-5`) | 3.00 (intro 2.00 through 2026-08-31) | 15.00 (intro 10.00) |
| Haiku 4.5 (`claude-haiku-4-5`) | 1.00 | 5.00 |

Cache reads ≈ 0.1× input price; cache writes 1.25× (5-min TTL). Math below uses **sticker prices** (no intro discount) — the intro pricing is upside, not plan.

Calendar: 4-day school week → **17.3 school days/mo**; **4.33 weeks/mo**.

## Per-call math

### Curriculum Integrator — Opus, ~2 runs/mo (onboarding + one change)
Input ~20K (profile + curricula metadata + CM pack + instructions), output ~8K.
`20K × $5/M = $0.100` + `8K × $25/M = $0.200` → **$0.30/run × 2 = $0.60/mo**
Caching: none expected to hit (runs are days apart; 5-min TTL). Not worth engineering.

### Headmaster — Opus, weekly ×2
**Sunday plan:** input ~30K (system+pack ~10K, IntegrationMap ~6K, child model+updates ~4K, 2 wks logs ~8K, instructions ~2K), output ~6K.
`30K × $5 = $0.150` + `6K × $25 = $0.150` → **$0.30/run**
**Friday report:** input ~25K, output ~3K → `$0.125 + $0.075` = **$0.20/run**
Weekly $0.50 × 4.33 = **$2.17/mo**. Caching across the week doesn't hit (TTL), but the **retry path** does: a schema-validation retry within the same run re-reads the whole prefix at 0.1× (~$0.02 instead of ~$0.15). Cache breakpoint after the stable prefix (system+pack+map).

### Tutor-Advisor — the daily loop (the cost battleground)

**Morning brief — Haiku, lazy:** input ~6K, output ~0.8K.
`6K × $1 = $0.006` + `0.8K × $5 = $0.004` → **$0.010/day**

**Debrief — Sonnet, ~6 turns (3 agent turns typical):** growing transcript over a shared prefix (system+DayPlan+child model ≈ 8K).
- Turn 1: write 8K prefix (`8K × 1.25 × $3 = $0.030`) + fresh ~1K + output 1K (`$0.015`) ≈ $0.048
- Turns 2–3: read ~9–10K cached (`× $0.30/M ≈ $0.003`) + fresh turn ~1K (`$0.003`) + output ~1K (`$0.015`) ≈ $0.021 each
Total ≈ **$0.090/day**; long-debrief days (~8 turns) ≈ $0.13. Plan at **$0.105/day** blended.

**Extraction triage — Haiku, every closed debrief:** input ~5K (transcript + rubric), output ~0.3K → `$0.005 + $0.0015` ≈ **$0.007/day**

**Extraction deep pass — Opus, gated:** fires only on `rich` verdict, planned **40% of days** (≈7/mo). Input ~10K (rich spans + current model + rules), output ~1.5K.
`10K × $5 = $0.050` + `1.5K × $25 = $0.038` → $0.088/fire × 7 ≈ **$0.61/mo**
This gate is the single biggest lever in the system: ungated (Opus on all 17.3 days) extraction alone would be $1.52/mo, and worse, it would *invite* prompt growth. The gate also improves quality — Haiku applying trivial completion patches itself keeps Opus's context purely observational.

**Registrar — rules code $0; Haiku edge cases ~2/mo × $0.009 ≈ $0.02/mo**

## Monthly roll-up

| Line | $/mo |
|---|---|
| Integrator (Opus × 2) | 0.60 |
| Headmaster Sunday (Opus × 4.33) | 1.30 |
| Headmaster Friday (Opus × 4.33) | 0.87 |
| Morning briefs (Haiku × 17.3) | 0.17 |
| Debriefs (Sonnet × 17.3) | 1.82 |
| Extraction triage (Haiku × 17.3) | 0.12 |
| Extraction deep (Opus × ~7) | 0.61 |
| Registrar edge (Haiku × ~2) | 0.02 |
| Disruption replans (Opus × ~1) | 0.25 |
| **Total** | **5.76** |

**80% interval $4.50–$9.00.** Upside: intro Sonnet pricing, fewer rich days, shorter debriefs (→ ~$4.50). Downside drivers, each bounded: chatty debriefs (10+ turns ≈ +$1.00/mo), rich-rate 70% (+$0.65), 2 disruptions/wk (+$0.75), retries (+$0.30) → ~$9.00 before the hard gate intervenes. Structural breach (>$10) requires either daily-Opus regression or a prompt-bloat regression — both blocked by the gates below.

## Prompt-caching strategy per agent

Prefix rule (from `shared/prompt-caching.md` discipline): stable → volatile, breakpoint at the stability boundary, **nothing timestamped/random in the prefix**.

| Agent | Cached prefix (breakpoint after) | Volatile suffix | Where it pays |
|---|---|---|---|
| Debrief (Sonnet) | system + DayPlan + child model (~8K) | transcript turns | every turn 2+, the same day — the workhorse; ~55% of naive debrief cost eliminated |
| Triage (Haiku) | rubric/system (~1.5K) | transcript | marginal (near floor of cacheable size) — take it for free, don't engineer |
| Headmaster (Opus) | system + pack + IntegrationMap (~16K) | logs, updates, calendar | retry path + Friday-after-Sunday never hits (5-day gap) — sized honestly: this one mostly *doesn't* pay, and the plan doesn't pretend it does |
| Integrator (Opus) | — | — | not cached; runs are rare and far apart |

Implementation: `lib/llm/caching.ts` places `cache_control` breakpoints; `LlmCallLog` records `cacheReadTokens`/`cacheWriteTokens` so cache efficacy is *measured* in the dry run, not assumed (`usage.cache_read_input_tokens` per call — if it reads zero on debrief turn 2, a silent invalidator crept into the prefix and CI has a regression test for prefix byte-stability).

## The Haiku-triage-gates-Opus pattern (spelled out)

```
debrief closes
  └─ Haiku triage ($0.007): routine | rich?
       ├─ routine (≈60%): Haiku itself emits completion patches. Opus never fires.
       └─ rich (≈40%): Opus deep pass ($0.088) over ONLY the quoted rich spans.
```

Same conductor shape as agentplain's L3 governor (`docs/loop/00-DESIGN.md`): *the cheap layer does process control and never escalates itself into judgment work; the expensive layer does all judgment and is only ever fired, never polling.* Triage misclassification risk (routine-but-actually-rich) is checked in the dry run by re-running deep extraction over a 20% sample of "routine" days and diffing — if the miss rate is material, the triage prompt gets tuned, not the gate removed.

## Budget enforcement + meter

- **`FamilyBudget` hard gate** (port of agentplain budget seam PR #146 + `canSpend()` from PR #265): every provider call checks `spentCents + estCost ≤ monthCents` *before* firing. POC cap $10.
- **Degradation ladder, never silent:** over 80% → morning brief coaches shorter debriefs and deep-extraction gate tightens to "exceptional only"; at 100% → daily loop falls back to structured-form logging (no LLM), Headmaster weekly run requires a parent-visible "run anyway" (POC: Conner) — mirroring agentplain's degraded-mode banner discipline (PR #276): the state is *shown*, not hidden.
- **Meter:** `LlmCallLog` aggregates to a month-to-date line visible on an internal `/ops` page (per-agent breakdown). Parent-facing surfaces show nothing about tokens/models (vendor invisibility) — the meter is an operator surface.
- Every call logs to `LlmCallLog` at call time with cost computed from `lib/llm/prices.ts` — the dry run's acceptance criterion 5 is read straight off this table (no estimates; `feedback_no_guesses_no_estimates`).
