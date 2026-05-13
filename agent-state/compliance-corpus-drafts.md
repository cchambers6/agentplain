# Compliance corpus drafts — counsel review log

**Status:** DRAFT (pre-counsel) — every per-vertical bundle ships with `status: 'DRAFT'` and `counselReviewer: null`.

**Drafted by:** Claude (agent fleet), 2026-05-12
**PR:** `feat/agentplain-vertical-compliance-corpus-drafts`

## Why this exists

Sentinel (the compliance-check agent under `lib/agents/sentinel/`) needs a per-vertical corpus of literal regulatory text to score skill-chain drafts against. Real-estate's Fair Housing HUD-literal corpus already lives in flatsbo; the other 9 active verticals had nothing. Per `feedback_no_quick_fixes.md`, sentinel can't ship pretend-it-knows-the-rule summaries — it needs literal text with citations.

Per `project_counsel_engaged.md`, every drafted corpus is pre-counsel-review; counsel red-lines DRAFT, then the corpus flips to `COUNSEL_REVIEWED` and `counselReviewer` is filled in. Sentinel is allowed to use DRAFT corpora, but customer-visible flags will show the DRAFT badge until red-line.

Per `project_no_outbound_architecture.md`, sentinel never blocks customer sends — it flags compliance risk in DRAFTS that the customer's own system ultimately decides on.

## What was drafted

All 10 active verticals now have a compliance corpus directory at `lib/agents/sentinel/corpus/<slug>/`. Each contains:

- `_metadata.ts` — `{ verticalSlug, lastReviewedAt, counselReviewer: null, status: 'DRAFT', openQuestions: [...] }`
- `index.ts` — typed `CorpusBundle` export
- one `*-literal.ts` file per rule, each exporting a `ComplianceRule` with `ruleId`, `title`, `summary`, `citation: { source, url, accessedAt }`, `literalText`, and optional `unverified: true` flag

Total: **45 ComplianceRule entries across 10 verticals.**

### Per-vertical breakdown

| Vertical | Rules | Verified literal text | Marked `[UNVERIFIED — needs counsel]` |
|---|---|---|---|
| real-estate | 1 | 1 | 0 |
| mortgage | 5 | 2 | 3 |
| insurance | 4 | 0 | 4 |
| property-management | 4 | 0 | 3 (+ 1 cross-reference) |
| title-escrow | 4 | 1 | 2 (+ 1 cross-reference) |
| recruiting | 6 | 5 | 1 |
| home-services | 4 | 1 | 3 |
| cpa | 6 | 0 | 6 |
| law | 7 | 5 | 2 (+ 1 cross-reference / routing) |
| ria | 6 | 1 | 5 |

"Verified literal text" means the drafter pulled the canonical published text and is confident in the wording. "Unverified" means the drafter included the substantive scope or quoted from recollection and flagged the entry for counsel red-line.

### Sentinel integration

`lib/agents/sentinel/index.ts` exposes:

```ts
loadCorpusFor(verticalSlug: string): CorpusBundle | null
listCorpusVerticals(): string[]
```

Skill-chain callers (`lib/skills/*`) consume the corpus to score drafts.

### Test coverage

`tests/compliance-corpus.test.ts` enforces:

1. Every active vertical has a corpus (matches `lib/verticals/index.ts`).
2. `loadCorpusFor()` returns `null` for unknown slugs (no silent fall-through).
3. Every corpus ships with `status: 'DRAFT'` + `counselReviewer: null` + non-empty `openQuestions`.
4. Every rule has non-empty `ruleId`, `title`, `summary`, `literalText`, plus `citation.source`, `citation.url` (must start with `http`), and `citation.accessedAt` (ISO date).

402 assertions, all passing.

## Conner-action checklist

- [ ] **Send to counsel.** Hand over `lib/agents/sentinel/corpus/` as a drop. Counsel reviews each `_metadata.ts` `openQuestions` list first — those are the drafter's flagged uncertainties.
- [ ] **SLA estimate.** Counsel review will take 8-15 hours per vertical (more for law / ria where the corpus is largest, less for the GA-only state-law verticals). At a counsel rate of $400-$600/hr, expect $40k-$80k for the full first-pass red-line. Recommend phasing by vertical priority:
  1. Real estate (already partially done in flatsbo — counsel just confirms the agentplain port)
  2. Law + RIA (highest regulatory-risk verticals, longest literal-text dependencies)
  3. Mortgage + title-escrow + insurance (financial-services cluster, RESPA / state insurance overlap)
  4. Recruiting + CPA + home-services + property-management (lowest single-rule-mistake exposure)
- [ ] **After each vertical's counsel pass:** counsel red-lines literals → drafter (or counsel directly) flips `_metadata.status` to `COUNSEL_REVIEWED`, fills `_metadata.counselReviewer` with name + bar#, and clears the `[UNVERIFIED]` flags on the rules whose literals counsel confirmed.

## What's NOT in this PR (intentionally deferred)

- **HUD-literal trigger list port from flatsbo.** The real-estate corpus here contains the statutory anchor (FHA § 804(c) + 24 CFR § 100.75) but does NOT port the 40+ literal trigger phrases or the `findHudLiteralMatches` pattern-matcher helper. Those are matching-logic, not corpus content, and ship in a follow-up PR.
- **State portability.** All state-law rules cover Georgia only. Hooks are present in the type system (`CorpusScope = { kind: 'state', state: string }`) for adding states.
- **Companion rules counsel will likely want to add:** noted inline in each rule's `drafterNotes`. Examples:
  - RESPA § 8 implementing rule (12 CFR § 1024.14)
  - FCRA pre-adverse / adverse action (15 USC § 1681b(b)(3))
  - Title VII / Bostock interpretive expansion
  - ABA Model Rules 1.7, 1.9, 8.4 (additional law-vertical companion conflicts / misconduct rules)
  - SEC Safeguarding Rule (proposed amendment to Custody Rule, pending finalization)

## What to do if a vertical's corpus is later judged insufficient

If counsel signals that the initial drafted corpus for a vertical doesn't cover the operational risk surface (e.g. counsel says "law needs trust-account / IOLTA rules" or "insurance needs claims-handling rules"), do NOT block the vertical from shipping. Instead:

1. Add the missing rule(s) as new `*-literal.ts` files in the corpus directory.
2. Append them to the bundle's `index.ts`.
3. Note the gap in `_metadata.openQuestions` so future passes have context.
4. Sentinel keeps using the partial corpus in the interim — `loadCorpusFor()` returning a bundle with fewer rules is still safer than returning `null` (which would mean no compliance scoring at all).

Per `feedback_no_new_verticals_finish_locked.md`: depth before breadth. A vertical with a partial-but-honest corpus is fine; what we won't do is pretend a corpus is comprehensive when it isn't.
