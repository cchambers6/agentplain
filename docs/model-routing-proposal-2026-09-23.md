# Model routing proposal — Haiku through Fable

**Status: UNRATIFIED. Nothing here takes effect on merge.**
**Read ref: `origin/main` @ `ef3e4e0` (2026-09-23), after fetch.**

Two routing systems, kept separate: **in-product** (which model serves a customer
workload) and **fleet** (which model does which job in our own build process).

---

## Part 1 — What is actually true today

### 1.1 The code implements neither plan

There **is** a routing layer, and it is not what the plans describe.

**In-product routing is three hardcoded constants.** `lib/llm/model-tiers.ts`
pins `MODEL_OPUS = 'claude-opus-4-7'`, `MODEL_SONNET = 'claude-sonnet-4-6'`,
`MODEL_HAIKU = 'claude-haiku-4-5-20251001'`. Those are imported by **33 files**
with **169 usages** (71 OPUS / 54 SONNET / 44 HAIKU). That is the entire
effective routing.

**There is a dynamic router, and it is switched off.**
`lib/llm/routing-provider.ts` holds a second, inlined `surface → model` table
and is composed into the provider chain at `lib/llm/index.ts:150` — but behind
`LLM_MODEL_ROUTING`, which defaults to off and is **not present in the Vercel
production environment** (verified against `vercel env ls production`). With the
flag unset the wrapper is a documented pure pass-through. So in production it
does nothing, and the two tables have been free to drift.

**Eleven distinct model-id strings are in the tree** (~142 literals across
`lib/`, `app/`, `scripts/`), including retired models (`claude-opus-4-0`,
`claude-sonnet-4-5`, `claude-opus-4-6`), date-suffixed forms that are not the
API's canonical ids (`claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20251001`),
and one malformed `claude-fable-5.`. **Zero** occurrences of `claude-opus-5` or
`claude-fable-5-1` — the codebase is entirely previous-generation.

### 1.2 The plans — and a scope correction

**The ratified 2026-07-19 plan is FLEET routing only.** This matters, because
the brief for this work treated it as the in-product tier tree. Its own
propagation record says plainly:

> `docs/skill-model-routing-2026-05-29.md` — PRODUCT runtime per-call routing
> (customer-facing LLM costs), not session routing; **out of plan scope, product
> code untouched.**

So the product code does not implement the 2026-07-19 tree because it was never
meant to. The in-product scheme is the 2026-05-29 wave-8 three-tier design, and
that is what is running.

**The 2026-07-25 revision could not be found.** No routing document dated
2026-07-25 exists in `origin/main`, and no routing memory file carries that
date. The only routing doc in the repo is `docs/skill-model-routing-2026-05-29.md`.
I am recording this as **unresolved**, not as "does not exist" — it may live
somewhere I cannot see. Nothing in this proposal depends on it.

**Where the ratified plan and the code disagree:** the plan's tree names
`claude-fable-5` and `claude-opus-4-8`; both are now previous-generation
(`claude-fable-5-1` and `claude-opus-5` supersede them at identical prices).

### 1.3 The cost inputs are stale, and they disagree with each other

`lib/billing/usage/pricing.ts` (the billing SSOT, rates read 2026-05-28) against
current published pricing:

| Family | SSOT says | Actually | Error |
|---|---|---|---|
| Opus | $15 / $75 | **$5 / $25** | **3× over** |
| Sonnet | $3 / $15 | $2 / $10 (Sonnet 5) | 1.5× over |
| Haiku | $1 / $5 | $1 / $5 | correct |
| Fable | *absent* | $10 / $50 | falls through to Opus rates |

The file's own comment documents the Fable fallthrough as a known defect and
notes `lib/kaizen/pricing.ts` prices Fable at $10/$50 — so **two pricing modules
in the same repo disagree**. A finance-ops doc additionally calls for refreshing
Haiku to $0.80/$4; current published pricing is $1/$5, so that action item is
itself working from a stale number.

**Consequence: no trustworthy cost baseline exists.** Any "spend today" figure
from the internal meter over-reports Opus by 3×.

### 1.4 The cost-architecture discipline (applies unchanged)

Stated verbatim in `docs/products/ai-headmaster/2026-07-10-poc-plan/06-cost-architecture.md`:

> heavy reasoning weekly (Opus), light daily (cheap models); **Haiku triage
> gates Opus**; no polling; daily generation is lazy; aggressive prompt caching;
> per-family token budget with a hard gate; a visible meter.

That doc measures the triage gate as *"the single biggest lever in the system"* —
and notes it **improves quality**, because it keeps the expensive model's context
purely observational. The design below keeps that pattern.

---

## Part 2 — The current lineup

Prices per million tokens (claude-api reference, cached 2026-06-24):

| Model | ID | Ctx | In | Out | Notes |
|---|---|---|---|---|---|
| Fable 5.1 | `claude-fable-5-1` | 1M | $10 | $50 | thinking always on; no forced `tool_choice`; cache reads $0.25 |
| Opus 5 | `claude-opus-5` | 1M | $5 | $25 | thinking **on by default**; fast mode available |
| Sonnet 5 | `claude-sonnet-5` | 1M | $2 | $10 | cheaper *and* newer than Sonnet 4.6 ($3/$15) |
| Haiku 4.5 | `claude-haiku-4-5` | **200K** | $1 | $5 | **rejects `effort`**; uses `budget_tokens` |

Two hard constraints the old scheme did not encode: **Haiku is 200K, not 1M**,
and **Haiku errors if sent `effort`**. Both are now enforced by test.

Sonnet 4.6 is strictly dominated by Sonnet 5 — newer and 33% cheaper. There is
no workload for which 4.6 is the right answer.

---

## Part 3 — In-product routing

### 3.1 Job classes, scored from the work

Four axes, scored from facts, not feel. The bar: hand the scheme a workload
nobody has seen and get a model out without an opinion.

| Axis | Levels |
|---|---|
| **Consequence** | C0 internal/reversible · C1 human reviews it · C2 customer **reads** it · C3 customer **acts** on it, irreversible, or regulated |
| **Reasoning** | R0 answer is in the input · R1 one hop · R2 synthesis/tradeoffs · R3 open-ended plan-and-revise |
| **Context** | X0 <30K · X1 30K–200K · X2 >200K (**excludes Haiku by capability**) |
| **Latency** | L0 person waiting · L1 near-real-time · L2 background · L3 batchable (**Batch API, −50%**) |

The rule (`lib/llm/routing/job-classes.ts`): **reasoning sets the capability bar;
consequence can only raise it.** C3 forces JUDGE regardless of difficulty; R3
escalates even when nobody reads the output, because a model that cannot do the
task returns a confident wrong answer and that costs more than the tokens saved.

> Getting that order backwards was the first bug in the implementation — letting
> consequence drive the bar routed every customer-read one-line summary to a
> synthesis model, which is how a cost-aware scheme quietly stops being one. The
> test suite pins it.

### 3.2 The routing

| Class | Model | Effort | Fallback | Why this is the cheapest that clears the bar |
|---|---|---|---|---|
| **TRIAGE** | Haiku 4.5 | — | Sonnet 5 `low` | Answer is in the input; depth buys nothing |
| **EXTRACT** | Haiku 4.5 | — | Sonnet 5 `low` | Retrieval, not reasoning. Falls back when input >200K |
| **TRANSFORM** | Sonnet 5 | `low` | Opus 5 `low` | Customer may read it → not Haiku. One hop → not deep |
| **COMPOSE** | Opus 5 | `high` | Sonnet 5 `high` ⚠ | Customer reads it. Opus 5 = same price as the Opus 4.7 it replaces |
| **JUDGE** | Opus 5 | `high` | **Fable 5.1** `high` | Customer acts on it. **Falls UP, not down** |
| **FRONTIER** | Fable 5.1 | `high` | Opus 5 `max` | >200K + plan-and-revise. Must stay rare — a class, not a default |

**The deliberate non-move.** COMPOSE on Sonnet 5 `high` would cut that tier's
rate by 60% and is the single largest saving available. **I have not taken it.**
COMPOSE is output the customer reads; downgrading it is a product decision, so it
is offered for ratification below rather than chosen here.

**Fallbacks that degrade customer-visible quality are flagged in the config**
(`fallbackDegradesCustomerOutput`) — COMPOSE and FRONTIER. The runtime must
surface those rather than silently serve a weaker model.

### 3.3 Cost delta — what is certain, and what cannot be computed

**Certain (rate card):**

| Class | Today | Proposed | Δ |
|---|---|---|---|
| TRIAGE / EXTRACT | $1 / $5 | $1 / $5 | 0% — id correction only |
| **TRANSFORM** | $3 / $15 | **$2 / $10** | **−33%, no trade** (newer *and* cheaper) |
| COMPOSE / JUDGE | $5 / $25 | $5 / $25 | 0% price, newer model — free upgrade |
| FRONTIER | $5 / $25 | $10 / $50 | +100%, new class, must stay rare |

**An absolute dollar delta would be fiction, for three reasons.** (1) Production
has not deployed since 2026-06-17, so there is no current traffic. (2) There are
no active clients. (3) The meter that would measure it over-reports Opus by 3×.
I am not going to manufacture a number from a broken baseline.

**Larger levers than model choice:**

1. **Routing is off in production.** The repo's own unit-economics doc estimates
   ~$0.30–0.40/customer/month from enabling it (their figure, not mine).
2. **Batch API −50%** for L3 work — TRIAGE, EXTRACT, TRANSFORM are marked eligible.
3. **Prompt caching** — reads at ~0.1× input.
4. ⚠ **Caches are model-scoped.** A fine-grained cascade *forfeits cache reuse
   across its models.* For a hot shared prefix, one model at lower effort can beat
   two models with a cold cache. The old three-tier scheme never accounted for
   this; per the API guidance, **measure the simpler alternative first** — the
   capable model at lower effort — before adding a model to the cascade.

### 3.4 For ratification

- **A.** Adopt the job classes and the routing in 3.2. *(Recommended.)*
- **B.** Enable `LLM_MODEL_ROUTING` in production. *(Recommended — currently
  dead code.)*
- **C.** Move COMPOSE to Sonnet 5 `high`: −60% on the largest tier, on output the
  customer reads. **Your call. I have not assumed it.**
- **D.** Fix `lib/billing/usage/pricing.ts`: Opus $15/$75 → $5/$25, add a Fable
  family at $10/$50, reconcile with `lib/kaizen/pricing.ts`. *(Should land before
  any cost measurement is believed.)*

---

## Part 4 — Fleet routing

Standing rule: **Fable plans, Opus executes, the auditor is never the builder.**

⚠ **This diverges from the repo's `CLAUDE.md`**, whose 2026-07-19 tree routes
*both* planning and shipping code to Fable, with Opus 4.8 only for 1M-context or
fallback. The standing rule is the better economics and I recommend it — but the
two disagree today and `CLAUDE.md` needs updating on ratification.

The principle that makes it coherent: **pay the premium where tokens are few and
leverage is high.** Planning is short and decides everything downstream; execution
is token-heavy and benefits more from a capable-but-half-price model.

| Fleet job | Model | Effort | Why |
|---|---|---|---|
| Plan / architecture / synthesis | Fable 5.1 | `high` | Few tokens, highest leverage — worth $10/$50 |
| Ship code requiring judgment | **Opus 5** | `xhigh` | Token-heavy; `xhigh` is the documented sweet spot for coding/agentic work |
| Merge, config, bounded brief | Sonnet 5 | `medium` | Scope is given; no exploration needed |
| Watchdog, curl, triage, decision gate | Haiku 4.5 | — | One-shot, deterministic |
| Audit / review | Fable 5.1 | `high` | **Never the session that built the thing** |
| Genuinely 1M context | any except Haiku | — | Haiku is 200K |

### 4.1 Session scope — evidence from this session

This session ran ~270 turns across production forensics, six PRs, six merges, and
this design. It is direct evidence that one session should carry less:

- Two claims had to be walked back — "auto-deploy isn't firing" (the instrument,
  `vercel ls`, was lying) and "the only working deploy path" (inferred, never executed).
- A diagnostic I ran **silenced both production deploy alarms** for two days. I
  found it by chance while verifying something else. **An auditor session would
  have caught it by design** — the builder checking its own work is exactly the
  failure mode the standing rule exists to prevent.

**Proposed additions to the fleet rule:**

1. **One mission per session.** Forensics, build, and merge are three sessions.
2. **A session that shipped does not certify its own shipping.** Post-merge
   verification belongs to a different session.
3. **Budget by artifacts, not turns** — when a session has produced more than
   ~3 merge-ready artifacts, hand off. The degradation is in carried context,
   not in wall-clock.

---

## What this PR does and does not do

**Does:** puts routing behind one config seam — `lib/llm/routing/job-classes.ts`
(the axes) and `lib/llm/routing/policy.ts` (the table). `model-tiers.ts` becomes a
back-compat shim deriving its three constants from the policy, so all 169 call
sites keep working unchanged.

**Does not:** change a single model call. `ACTIVE_POLICY = POLICY_CURRENT`, which
encodes today's pinned ids byte-for-byte, and a test asserts it. **Ratification is
a one-line change** to `ACTIVE_POLICY`. A proposal that takes effect on merge is
not a proposal.
