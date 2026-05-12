# Homepage narrative audit — 2026-05-12

**Branch:** `fix/agentplain-homepage-narrative-rebuild`
**Surface audited:** `app/(marketing)/page.tsx` (entire file, top → bottom) + adjacent customer-facing chrome (`components/Header.tsx`, `components/Footer.tsx`, `components/FAQ.tsx`) + `app/(marketing)/about/page.tsx`.
**Rule set applied:**
- `~/.claude/projects/C--agentplain/memory/feedback_everything_tells_a_story.md` (locked 2026-05-11; canonical story-arc + banned-element list)
- `~/.claude/projects/C--agentplain/memory/project_agentplain_mission_and_positioning.md` (locked 2026-05-11; banned framings: agent counts, pilot, V0, AI assistant, realty-only)
- Conner's verbatim frustration 2026-05-11: *"How many agents do we have? Why are we saying anything about V0 that means nothing to consumers... You aren't leading with the information people most need to see... Everything is part of telling a story and everything needs to have a purpose"*

## Canonical story arc (from `feedback_everything_tells_a_story.md` §"The story arc")

1. **Q1 What is this?** → Wordmark + tagline + one-line locked mission
2. **Q2 Is this for me?** → 10-vertical chip row
3. **Q3 What does it do?** → REPLACE / INTEGRATE / AUGMENT framing
4. **Q4 How does it work?** → 3-step value loop + concrete per-vertical example
5. **Q5 Why believe?** → "Rooted in reality" proof section
6. **Q6 Pricing → "Affordable access to enterprise-grade tools"**
7. **Q7 Vision** — locked vision line
8. **Q8 CTA** — "Start free trial"

## Up-front finding (the "stat block" Conner referenced)

The stat block `"AGENTS IN THE FLEET: 7 / PILOT LENGTH: 30 days / VERTICALS AT V0: Realty"` is **not present in the current `main`** source tree — see `git log f33629a..66460b3 -- "app/(marketing)/page.tsx"` (commit `feat/agentplain-ux-polish-customer-surfaces` rewrote the homepage on 2026-05-11). What Conner is seeing on live `agentplain.com` is a stale Vercel deployment of a pre-polish commit. The new banned-string regression test in this PR will prevent the stat block from coming back, and the Vercel preview for this branch will reflect the cleaned-up state. **No "full rebuild" needed — the homepage structure already matches the story arc; remaining violations are narrow `v0` text bleeds + footer status strip that survived the polish pass.**

Sources confirming the stat block is gone from `main` (read 2026-05-12):
- `git grep -n "AGENTS IN THE FLEET"` → no matches in `app/`, `components/`, `lib/`
- `git grep -n "PILOT LENGTH"` → no matches in `app/`, `components/`, `lib/`
- `git grep -n "VERTICALS AT V0"` → no matches anywhere
- `git grep -n "See the pilot"` → only `outputs/marketing_truth_audit_2026-05-11/audit.md:77` (prior audit doc, not customer surface)
- `git grep -n "brokerages keep deferring"` → only `outputs/marketing_truth_audit_2026-05-11/audit.md:86` (prior audit doc)

## Element-by-element audit — `app/(marketing)/page.tsx`

Every section/widget/element in page order. `KEEP` = passes story-arc test as-is; `REWRITE` = intent advances arc but execution violates a banned-framing rule; `DELETE` = doesn't advance arc; `MOVE` = belongs elsewhere.

| # | Lines | Element | Story-arc Q answered (or function) | Verdict | Rule citation | Action |
|---|---|---|---|---|---|---|
| 1 | 22–41 | `tierTeasers` const (Regular / Plus / Max prose) | Q6 pricing | KEEP | `project_stripe_both_surfaces.md` per-seat ladder locked 2026-05-09 | none |
| 2 | 46–67 | `uniques` const (5-card differentiator: Vertical-aware / Control / Integrates / Built-BY-agents / Compliance-first) | Q4 unique | REWRITE | `feedback_everything_tells_a_story.md` §"Banned in copy" (`v0` ban) | Card 4 ("Built BY agents") line 61 says *"…running ~35 cron-fired agents on daily ops is the v0 we productized."* Replace `the v0 we productized` → `the working precursor we productized` (no version literal) |
| 3 | 71–92 | `proof` const (4-card "Why believe" with citation) | Q5 believe | REWRITE | same | Card 1 ("Eat our own cooking") line 74 says *"…in production today is the v0 of this model — the pattern is real, not theoretical."* Replace `the v0 of this model` → `the working precursor of this model` |
| 4 | 103–167 | **HERO** — tagline + locked mission as H1 + product definition + Conner's first-pass mission supporting line + 10-vertical chip row + dual CTAs (Start free trial / See how it works) | Q1 + Q2 + part of Q3 + Q8 | KEEP | mission rule §"The tagline" + §"All 10 verticals on page 1" + `project_app_build_now_not_gated.md` (Start free trial CTA correct) | none |
| 5 | 170–200 | **Section: "Why we exist"** — status-quo vs. inversion two-column | Q1 (why exist) | KEEP | mission rule §Q1 | none |
| 6 | 203–227 | **Section: "How it works"** — 3-step (Pick vertical / Connect tools / Fleet drafts) | Q3 + Q5 (ease) | KEEP | mission rule §Q3 + §Q5 | none |
| 7 | 230–245 | **Section: "What makes us different"** — 5-card | Q4 unique | KEEP (card 4 rewritten per row #2 above) | mission rule §Q4 | rewrite the one card per row #2 above |
| 8 | 249–299 | **Section: "A day in the life"** — Sarah/realty concrete example + cross-vertical CTA | Q4 narrative + Q2 cross-vertical | KEEP | story-arc rule §"Concrete over abstract" (the canonical example shape) + cross-vertical link prevents realty-only feel | none |
| 9 | 301–312 | **Section: "Rooted in reality"** — 4 proof cards | Q5 believe | KEEP (card 1 rewritten per row #3 above) | mission rule §Q6 | rewrite per row #3 above |
| 10 | 314–354 | **Section: "Pricing + ROI"** — interactive calculator + 3-tier teaser grid + shared-across-tiers list | Q6 pricing + Q7 ROI | KEEP | mission rule §Q6 + `project_pricing_value_anchor.md` | none |
| 11 | 357–381 | **Section: "Where we're going"** — locked vision line as title + Q8 future-of-work card + Q9 why-now card | Q7 vision (locked line) + Q8 future-of-work + Q9 why-now | KEEP | mission rule §Vision + §Q8 + §Q9 | none |
| 12 | 384–391 | **Section: FAQ** | Long-tail Q2/Q3/Q4/Q5 | KEEP (FAQ item rewritten — see Q6 row below in adjacent-surfaces audit) | mission rule | rewrite FAQ item per separate row below |
| 13 | 394–426 | **Closing CTA** — tagline + locked mission line again + "first month free" + Start free trial + "See all ten verticals" | Q8 CTA | KEEP | mission rule + `feedback_everything_tells_a_story.md` §"What do I do now? → Start free trial" | none |

## Element-by-element audit — adjacent customer-facing chrome

| # | File:line | Element | Story-arc Q (or function) | Verdict | Rule citation | Action |
|---|---|---|---|---|---|---|
| 14 | `components/Header.tsx:13–60` | Top nav (Verticals / How it works / Pricing / About / Sign in / Start free trial) | Functional (navigation) | KEEP | story-arc rule §"functional purpose" | none |
| 15 | `components/Footer.tsx:20–114` | 4-column footer (brand / Verticals / Product / Company) | Functional (navigation + brand reinforcement) | KEEP | functional | none |
| 16 | `components/Footer.tsx:116–125` | **Bottom strip:** © 2026 agentplain · `{tokens.version}` · 10 verticals · 3 tiers · `status: build · last updated 2026-05-11` | NONE — internal product metadata surfaced to visitors who don't know what an agent is yet | DELETE the version + status segments | `feedback_everything_tells_a_story.md` §"Stat blocks of internal/product-development numbers... Banned" + §"V0 / Phase 0 / MVP / pre-pilot / alpha — internal product-development language that means nothing to customers. Banned." | Keep © line. Replace middle segment (`{tokens.version} · 10 verticals · 3 tiers`) → `10 verticals · 3 per-seat tiers · first month free`. Delete right segment (`status: build · last updated …`) entirely (internal build status — no story-arc role). Drop the unused `LAST_UPDATED` constant. |
| 17 | `components/FAQ.tsx:49` | FAQ answer to "Why should anyone believe you?" — `"…running ~35 cron-fired agents is the v0 of what we sell."` | Q5 believe | REWRITE | `feedback_everything_tells_a_story.md` §"Banned in copy" (`V0` ban) | Replace `the v0 of what we sell` → `a working precursor of what we sell` |
| 18 | `app/(marketing)/about/page.tsx:97` | About — "Built BY agents" prose: `"…CRM hygiene, recruiting — is the v0 of this model. We've been running…"` | Q5 believe (about) | REWRITE | same | Replace `is the v0 of this model` → `is the working precursor of this model` |

## Dispositions tally

- **Total elements audited:** 18
- **KEEP as-is:** 11
- **REWRITE (in-place, no structural change):** 5 (rows #2, #3, #12, #17, #18 — all `v0` text bleeds)
- **DELETE:** 1 (row #16 — footer version + build-status segments)
- **MOVE:** 0
- **Full rebuilds needed:** 0 — the homepage structure already matches the canonical story arc; the polish pass landed the structure, this PR removes the last narrative-violating bleeds.

## What this PR does NOT touch (and why)

- `tests/brand.test.ts` line 38, 56–57 — internal test file; `tokens.version` value (`"v0"`) is an internal field. The fix is to stop *surfacing* `tokens.version` to customers (row #16), not to delete the brand token (which still anchors typography spec history).
- `lib/brand/types.ts` line 30, 46 — internal code comments. Not customer-facing.
- `lib/brand/tokens.ts` lines 3, 73 — internal code. The `version: "v0"` value itself is fine; the bug was rendering it in the footer.
- `lib/verticals/*/content.ts` "Phase 0 product_spec.md" comments (lines 5–9 in each file) — code comments, not rendered.
- `lib/verticals/real-estate/content.ts:151` `"FMLS + GAMLS (read-only feed for any Georgia pilot)"` — "pilot" used in the rollout-cohort sense, not the pricing sense, on the realty vertical page (already realty-scoped); leaving for a follow-up sweep but flagging here as deferred.
- `README.md:111` `"The 7-agent fleet copy is V0..."` — internal docs.
- `tests/billing-providers.test.ts:23` `"Pilot tier 1 — 30 days"` — internal test fixture, not rendered.
- `app/(product)/app/workspace/[id]/settings/billing/page.tsx:100` `"First 30 days are on us"` — phrased as "first month free" elsewhere; this string mentions 30 days as a duration, NOT a "30-day pilot" framing. Leave.

## Regression test plan (Step 3 of PR work)

Add `tests/marketing-banned-strings.test.ts` reading every file under `app/(marketing)/**`, `components/Header.tsx`, `components/Footer.tsx`, `components/FAQ.tsx`, asserting **none** contain (case-insensitive, full-word):

- `AGENTS IN THE FLEET`
- `PILOT LENGTH`
- `VERTICALS AT V0`
- `\bV0\b` / `\bv0\b` / `\bMVP\b` / `\bPhase 0\b` / `\bpre-pilot\b` / `\bbeta-pilot\b`
- `30-day pilot` / `pilot length` / `pilot fee` / `See the pilot`
- `\b\d+ agents?\b` / `\b\d+-\d+ agents?\b` / `all 7 agents` / `the seven agents`
- `AI assistant` / `AI magic` / `intelligent automation` / `smart insights` / `AI-powered`
- `brokerages keep deferring` / `A small fleet, doing the work brokerages`

This pins the post-surgery state and lets any future PR that reintroduces a banned framing fail in CI rather than fail in front of Conner.
