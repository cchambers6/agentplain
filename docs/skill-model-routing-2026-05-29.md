# Per-skill model routing audit — 2026-05-29

**Audited by:** wave-8 cost-control sweep.
**Calibration (load-bearing, from Conner):** "I don't want to sacrifice product
performance for our customers assuming the API usage will remain a very small
impact on margin." Translation: keep **Opus** on every surface customers READ.
Only downgrade to Sonnet/Haiku where the work is internal classification,
routing, or parsing where Haiku/Sonnet reach the same answer.

**Today's baseline:** `lib/llm/anthropic-provider.ts` ships with
`DEFAULT_MODEL = 'claude-sonnet-4-5'`. The `ANTHROPIC_MODEL` env var overrides
the default globally. No production skill file currently passes a `model:`
override per call — every skill runs whatever the global default resolves to.

This audit fixes that by setting per-call `model:` overrides at each LLM call
site, so each surface gets the model that matches its job.

## Model tier reference

| Tier | Model ID | When |
|---|---|---|
| Opus | `claude-opus-4-7` | Customer reads output — quality matters more than cost |
| Sonnet | `claude-sonnet-4-6` | Customer-adjacent, moderate reasoning |
| Haiku | `claude-haiku-4-5-20251001` | Internal classifier — binary or narrow categorical decision |

Rough cost ratio (per public pricing 2026-05): Opus ≈ 5× Sonnet ≈ 5× Haiku.

## Per-skill routing

| Skill | Call site (file:line) | Current | Recommended | Customer reads? | Reasoning difficulty | Rationale |
|---|---|---|---|---|---|---|
| Plaino dispatcher classifier | `lib/plaino/dispatcher.ts:148` | global default | **Haiku** | No — internal routing only | Low — discrete categorical (`ANSWER` / `REGISTER` / `INSTRUCT` / `PREFERENCE` / `DECLINE_HONESTLY`) | Narrow classifier — Haiku reaches the same answer at ~25× lower cost than Opus |
| Plaino memory-extract | `lib/plaino/memory/extract-from-conversation.ts:137` | global default | **Sonnet** | No (memory) — but feeds future Opus calls | Medium — needs to parse a chat turn into a structured FEEDBACK rule | Sonnet handles structured extraction reliably; Opus is overkill for this seam |
| Inbox-triage LLM-refine | `lib/skills/inbox-triage-general/llm-refine.ts:105` | global default | **Sonnet** | Customer-adjacent (category labels surfaced + tone-matched) | Medium — feedback-rule override on heuristic | Customer sees the category but not the reasoning; Sonnet keeps quality and saves ~5× vs Opus |
| Lead-triage-realestate LLM-refine | `lib/skills/lead-triage-realestate/llm-refine.ts` | global default | **Opus** | Yes — drafted triage notes show up in CRM | High — judgement on lead quality | Customer reads the triage note + decision; quality trumps cost |
| Follow-up chaser refine | `lib/skills/follow-up-chaser-general/...` (no .complete in lib/skills/follow-up-chaser) | n/a — heuristic only | n/a | n/a | n/a | No LLM call today; if one is added later, Sonnet |
| Process-doc drafter refine | `lib/skills/process-doc-drafter-general/llm-refine.ts` | global default | **Opus** | Yes — SOP body lands in the workspace | High — narrative quality matters | SOP is customer-facing prose; keep on Opus |
| Chief-of-staff scheduler refine | `lib/skills/chief-of-staff-scheduler/llm-refine.ts` | global default | **Sonnet** | Customer-adjacent (proposal generation, not final picks) | Medium — slot proposal tone-match | Customer sees the proposed slot; Sonnet keeps proposal quality while saving ~5× |
| Office-admin classifier | `lib/skills/office-admin/classifier.ts:65` | global default | **Haiku** | No — internal routing only | Low — bin into one of 9 ADMIN_* kinds | Narrow classifier path; Haiku matches Opus on bin-selection |
| Categorize core | `lib/skills/categorize.ts:47` | global default | **Haiku** | No — internal routing into vertical kind | Low — enum-bound output | Narrow classifier; one of N kinds |
| Coordinate core | `lib/skills/coordinate.ts:63` | global default | **Sonnet** | No — but feeds Draft (which is Opus) | Medium — extracts entities from message thread | Sonnet handles entity extraction at much lower cost than Opus |
| Schedule core | `lib/skills/schedule.ts:51` | global default | **Sonnet** | Customer-adjacent (proposed slots) | Medium — slot enumeration + ranking | Sonnet handles slot-picking; Opus is overkill |
| Draft core | `lib/skills/draft.ts:60` | global default | **Opus** | YES — drafted message lands in customer's review queue | High — tone, accuracy, brand voice | THE customer-facing surface; keep on Opus |
| Support-handler skill | `lib/skills/support-handler/skill.ts` | global default | **Opus** | YES — customer-facing draft reply | High — empathetic + accurate response | Customer reads this directly; Opus |
| Research-on-demand | `lib/skills/research-on-demand-general/skill.ts` | global default | **Opus** | YES — research brief landed in workspace | High — synthesis quality | Customer reads the report; Opus |
| Finance-pulse | `lib/skills/finance-pulse-general/skill.ts` | global default | **Opus** | YES — weekly finance pulse narrative | High — analytical narrative | Customer reads the pulse; Opus |
| Compliance-watch | `lib/skills/compliance-watch-general/skill.ts` | global default | **Opus** | YES — flagged-events digest | High — judgement on what merits a flag | Customer reads + acts on the flags; Opus |
| Content-calendar drafter | `lib/skills/content-calendar-drafter-general/skill.ts` | global default | **Opus** | YES — drafted social/content calendar | High — voice + brand match | Customer reads + publishes; Opus |
| Analytics-weekly pulse | `lib/skills/analytics-weekly-pulse-general/skill.ts` | global default | **Opus** | YES — weekly briefing prose | High — analytical narrative | Customer reads the pulse; Opus |
| Briefing generator | `lib/skills/briefing-generator/index.ts` | global default | **Opus** | YES — daily briefing in product | High — synthesis across signals | Customer reads the daily briefing; Opus |
| Instruction handler | `lib/plaino/instruction-handler.ts` | global default | **Opus** | YES — customer-facing draft instructions | High — multi-step plan | Customer reads + reviews the plan; Opus |

### Skills with no live LLM call (heuristic-only or out-of-scope)

- `lib/skills/follow-up-chaser-general/` — heuristic-only today
- `lib/skills/home-services-estimate-followup/`, `insurance-coi-request/`, `invoice-chasing-realestate/`,
  `law-intake-conflict-screen/`, `mortgage-document-chase/`, `property-management-rent-collection-chase/`,
  `recruiting-candidate-status-update/`, `ria-client-update-draft/`, `title-escrow-closing-doc-chase/`,
  `month-end-close-cpa/` — vertical workflow scaffolds; per-vertical LLM call routes through Draft (Opus)
- `lib/skills/scheduler/` — Inngest sweep, not an LLM caller

## Summary by tier

| Tier | Count of LLM call sites |
|---|---|
| Opus (keep customer quality) | 11 |
| Sonnet (customer-adjacent or feeds Opus) | 5 |
| Haiku (internal classifier) | 3 |

## Estimated cost impact

Assuming a steady fleet workload of roughly equal call volume across the 19
call sites (a rough order-of-magnitude — we don't have telemetry split by call
site yet), today every call runs on the global default (~Sonnet 4.5). Applying
the routing:

- **3 sites move to Haiku** — ~5× cheaper per call vs Sonnet → savings on those sites
- **5 sites move to Sonnet** — same as today's baseline → no change
- **11 sites move to Opus** — ~5× MORE expensive than today's Sonnet baseline → cost increase on those sites

Net direction depends on call-volume mix. The point of this audit per Conner's
calibration is **not** to minimize cost — it is to put the right model on each
job so customer-facing quality is unambiguously protected while internal
classifiers stop paying premium prices. Expect **net cost up modestly** because
most call volume is customer-facing (and currently underspending on quality).

If telemetry later shows the 11 Opus sites are running hot, the SkillConfig
override per workspace gives Conner an escape hatch to step a specific skill
back to Sonnet without code churn.

## Application plan (Phase 3 of wave 8)

For each call site above:
1. Add `model: 'claude-opus-4-7'` / `'claude-sonnet-4-6'` /
   `'claude-haiku-4-5-20251001'` to the `complete({...})` request
2. Update the corresponding test to assert the model passed through (or just
   pin the customer-facing Opus invariant with a registry-style test)

Test pins added in Phase 3:
- Dispatcher classifier on Haiku still produces correct path for 5 representative inputs
- Memory extract on Sonnet still produces structured FEEDBACK rules for 3 representative chat turns
- Audit-by-config invariant: every customer-reads-this skill still requests Opus

## Open follow-up

The global `DEFAULT_MODEL` in `lib/llm/anthropic-provider.ts` is still
`claude-sonnet-4-5`. Once every call site sets `model:` explicitly, that
default becomes dead code; bump it to `claude-opus-4-7` as a safety net in a
follow-up PR (so a future call site that forgets to set `model:` defaults to
the customer-quality tier, not the cheapest one). Not part of wave 8 — out of
scope, but flagged here so it doesn't get lost.
