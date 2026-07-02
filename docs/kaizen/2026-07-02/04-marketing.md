# Kaizen Retro — Marketing

**Date:** 2026-07-02
**Scope:** voice-gate coverage · Truth-Wave posture · content strategy · distribution motion · per-vertical positioning · brand-narrative coherence · SEO/AEO baseline · comparison story · ad-platform readiness · waitlist framing
**Baseline reviewed:** `origin/main` @ `f928400` (post-#316/#320 Heritage rollout)
**Method:** Read the marketing surface (`app/(marketing)/*`, `lib/marketing`, `lib/verticals`, `docs/marketing/*`, `docs/brand/*`), the enforcement gates (`tools/brand/*`, `.husky/pre-push`, `.github/workflows/*`), and the ratified positioning canon in project memory. Every claim below cites a file, PR, or memory rule. Nothing is estimated.

---

## Where the marketing motion stands (one paragraph)

Marketing has moved from "write copy" to "run a truth-and-voice production system." In the last month it shipped and **merged** a full Truth Wave (#290), an executable voice/brand-gate (#309), a de-AI content sweep (#308), a distinctive visual system (#310), and a full Heritage Plains editorial rollout (#316/#320), on top of an already-strong SEO baseline that the team correctly re-pointed toward AEO (#286/#289). The positioning is locked and load-bearing. The gaps are no longer *quality of assets* — they are **enforcement that survives `HUSKY=0`, distribution that actually publishes, and a handful of high-liability truth claims still rendered while their engineering backing is an open gap.**

---

## 10 Wins — what the motion is doing right

1. **Truth-as-brand is now a repeatable motion, not a one-off.** The Truth Wave (#290, merged `00a8e15`) audited ~120 claims across every surface and fixed drift in 27 files; it followed #261 (claim-by-claim alignment audit) and #262 (trial-policy truth). Honesty is the stated moat in the content thesis (`docs/marketing/content-calendar-90-days.md`: "the most honest voice in a category full of hype") and the surface now largely earns it.

2. **Brand standards are executable code, not a style PDF.** `tools/brand/brand-gate.mjs` (owns HYPE — supercharge/seamless/leverage) and `tools/brand/voice-gate.mjs` (owns LLM-ese families A–D) are zero-dependency lints wired into `.husky/pre-push` as Layer 1.5. The voice audit found the buzzword war already won — vocab/antithesis/scaffolding score **zero** on rendered surfaces; the residual "AI smell" was correctly diagnosed as *cadence* (em-dash spam), not vocabulary (`project_voice_guidelines_de_ai_2026_06_19`).

3. **De-AI-fication was diagnosed correctly and fixed additively.** #310 identified the generic-AI smell as tonal flatness + even rhythm + no made-by-a-person tells — not the tokens — and fixed it with editorial utilities (drop-cap, pull-quote, field-note, dateline) rather than a restyle. The system was already anti-SaaS; the wave sharpened it.

4. **The brand has a chosen, coherent identity.** Conner picked Heritage Plains Editorial (#316) and it rolled out full-surface (#320, merged `008bc03`) as a *system-level retune* — ~85% flowed from shared workhorses (`lib/brand/tokens.ts` → `globals.css` → components), not a per-page rebuild. Logo constraint honored (zero changes to `public/`, `components/brand/`).

5. **SEO baseline was already strong and the team spent budget on the real gap.** Rather than re-doing technical SEO (programmatic `robots.ts`/`sitemap.ts`, canonical+hreflang, full JSON-LD in `lib/seo/structured-data.ts`), the wave went to **AEO**: per-vertical direct-answers + 44 FAQs (#286) and `/compare` + `/glossary` owning the service-partner vocabulary (#289, both merged). Correct diagnosis, correct allocation.

6. **Positioning is locked, load-bearing, and defends against supplier-as-competitor.** Mission/vision/tagline are ratified (`project_agentplain_mission_and_positioning`), and the SBM-wrapper frame ("the service layer that makes Claude for Small Business usable — not a competitor") is the durable answer to Anthropic shipping Claude SBM (`project_sbm_wrapper_positioning_2026_06_06`). The category-defining thesis ("intelligence rooted in reality") is a real differentiator from pixie-dust AI.

7. **The comparison story is honest — rare in the category.** `/compare` + `/compare/[alt]` cover diy / chatgpt / hiring-an-assistant / agency and explicitly name **where the alternative wins first** (#289). Objection-busting is a named content pillar. This builds more trust than a rigged feature grid.

8. **Ad-platform readiness exists as paste-ready assets.** `docs/marketing/ad-platform-copy/{google,meta,linkedin,reddit}.md` carry real per-platform field structure and character limits, synthesized from per-vertical `ad-materials/` (google/meta/linkedin/youtube × 5 verticals) plus a retargeting doc. The creative *briefs* are done.

9. **Per-vertical depth is real and mission-compliant.** Ten rich vertical landing pages (`lib/verticals/<slug>/content.ts` via `app/(marketing)/[vertical]/page.tsx`) carry per-vertical OG, ROI math, FAQ, and direct-answers; all ten verticals appear on page one per the mission rule ("don't lose a CPA on page one because the hero said realtors").

10. **Waitlist and lead capture are truthful by construction.** `/waitlist` reuses the existing `LeadCapture` → `/api/leads/capture` pipeline with **no** fabricated "weekly newsletter" cadence — the cadence promise was dropped because the no-outbound architecture makes it untrue (`project_marketing_surface_launch_2026_06_16`). Distribution honesty is baked into the plumbing, plus a 90-day content calendar and design-partner outreach packets for 5 verticals.

---

## 10 Friction Patterns

1. **The brand/voice gates live in `pre-push` only — not CI — so they are bypassable and have been bypassed.** `.husky/pre-push` runs brand-gate (Layer 1.5) and voice-gate, but `.github/workflows/` has **no** brand/voice job (it has `connector-dispatch-coverage.yml`, `schema-drift.yml`, `auth-tests.yml`, `e2e-nightly.yml` — proving the CI-gate pattern exists, just not for marketing). Multiple memories document pushing with `HUSKY=0` / `--no-verify` to get past gates on *other people's* files (#308, #309). A local-only truth gate is not a gate.

2. **The "never name the model/vendor" rule is uncodified and the canon contradicts itself.** There is **no** `feedback_model_vendor_invisible_on_customer_surfaces` memory file. Meanwhile `project_sbm_wrapper_positioning_2026_06_06` prescribes "built on Claude, configured by us" on **all 10 vertical hero subheads**, while `project_marketing_surface_launch_2026_06_16` states the mission constraint is stricter: **never name Claude/Anthropic on a customer surface.** `lib/verticals/types.ts:333-338` still carries the old "built on Claude" guidance in a comment. Rendered surfaces are currently clean (only necessary subprocessor disclosures name Anthropic), but the rule survives on discipline, not on a gate or a single source of truth. See the bake-in section below.

3. **Truth-Wave residual: the highest-liability `/security` claims are still rendered with open engineering gaps behind them.** #290 explicitly *flagged for Conner but did not change* the infra absolutes. They are still live today: `app/(marketing)/security/page.tsx` renders "returns zero rows regardless of how it's constructed" (L76, RLS), "no agent and no admin can rewrite history" (L116, audit log), a "24 hours" containment SLA (L161), and "no-training" (L152) — all called open hardening gaps in `project_production_growth_plan_2026_06_05`. Truth Wave fixed the easy drift; the *load-bearing* absolutes are the ones still exposed.

4. **Subprocessor disclosure gap on the OpenAI embedding path.** `lib/knowledge/index.ts:53-55` selects `OpenAIEmbeddingProvider` whenever `OPENAI_API_KEY` is set, POSTing knowledge-doc bodies to OpenAI. `/privacy` and `/security` describe vector-embedding *isolation* but never name OpenAI as a subprocessor (privacy lists Anthropic/Neon/Stripe/Resend/Sentry). #261 flagged this; it is unresolved. If that path is enabled in prod, the subprocessor list is incomplete — a legal/trust exposure, not a copy nit.

5. **The ratified two-bucket data positioning is dark — `/data` and `/dpa` are not on main.** `project_two_bucket_data_positioning_2026_06_18` is load-bearing and ratified ("Your data is yours. Plaino is your partner."), with a single source of truth at `lib/marketing/data-commitments.ts` — but the PR (`feat/data-minimization-positioning-2026-06-18`) was left "pending a fresh fleet token" and never merged. Both routes are **missing** on main. The confidentiality pitch that closes CPA/Law (client data never lands on our servers) is written and unshipped.

6. **Present-tense compliance overclaim keeps re-emerging every content wave.** Only real-estate fires the live scanner (`BASELINE_LIVE_VERTICALS = new Set(["real-estate"])`, `lib/agents/sentinel/index.ts`), yet vertical `content.ts` has repeatedly implied live compliance on the other 9 (#261's most-egregious RED; #290 softened it again). It recurs because content authors don't see the runtime truth — there's no structural guard, only a manual audit each cycle. Worst prior case: property-management claiming the RE-only fair-housing scanner fires on tenant comms.

7. **Marketing↔runtime drift is caught by audits, not prevented by architecture.** The recurring failures are structural: price hand-typed $10 low ($269 vs canonical $279, #290); "first-month-free" surviving in ~15 places because #262 touched checkout but not home/about/verticals/FAQ. The durable fix pattern exists — `tierLadderBands()` derives every price ladder from one constant (#290) — but it has only been applied to pricing. Trial length, compliance status, and connector availability are still asserted in copy rather than read from the runtime.

8. **The "flagged for Conner" queue is a growing, un-triaged backlog that stalls the motion.** Founder bio (held since the SEO wave, #289), the `/security` absolutes (#290), the 1-seat-vs-volume-50 headline-price decision (#262/#290), color-token approval (wheat, #310), and voice-catalog sign-off (#309) are all parked on one person with no review cadence or SLA. Marketing keeps generating decisions faster than they clear.

9. **Distribution is single-channel, manual, and unmeasured — assets ≠ distribution.** The #1 channel is founder-led design-partner outreach (`project_money_gtm_pack_2026_06_14`). No paid spend is live; the paste-ready ad copy has never been deployed; there is no attribution/measurement wired; and the 90-day content calendar shows no published-cadence tracking. The team is excellent at *producing* marketing and has not yet *shipped it to an audience at cadence.*

10. **There is no living competitive-intel pipeline.** The SBM-wrapper positioning is a point-in-time response to one Anthropic launch (2026-06-06), and `/compare/[alt]` is static content. Nothing recurringly scans Claude SBM's feature changes, competitor moves, or category shifts. The durable "why not just use Claude?" answer needs a monitored feed feeding `/compare` and the positioning memory — otherwise the moat argument silently ages.

*(Bonus friction — cross-cutting:)* **No single "marketing canon" index.** Truth for new copy is spread across `docs/marketing/CREATIVE_PACK_GROUND_TRUTH.md`, `lib/marketing/data-commitments.ts`, `docs/brand/voice-guidelines-2026-06-19.md`, and the mission memory — with overlapping authority and no map of which wins. A new author (human or agent) can't tell which of five files is source of truth.

---

## Top 5 Process Improvements

1. **Promote the truth/voice/vendor gates from `pre-push` to a required CI status check — and add a claims gate.** Move brand-gate + voice-gate into `.github/workflows/` as required checks (the `connector-dispatch-coverage.yml` pattern already proves this works), so `HUSKY=0` can no longer land drift on main. Extend with two machine checks: (a) a **vendor-invisible** regex that fails on "Claude"/"Anthropic" outside an allowlisted subprocessor block (see bake-in), and (b) a **claims linter** that fails when `content.ts` asserts a live compliance scanner for a vertical not in `BASELINE_LIVE_VERTICALS`. This converts three recurring manual audits into standing gates.

2. **Institute a per-vertical content review tied to runtime truth.** Before any vertical copy ships, require a cross-check against the runtime sources (`BASELINE_LIVE_VERTICALS`, the connector registry, `lib/pricing/tiers.ts`) and the mission memory's 9 questions. Codify the checklist and, where possible, back it with the claims linter above so the check is enforced, not remembered. This kills friction #6 and #7 at the source.

3. **Turn the 90-day calendar into an operating cadence with an owner and a published-state tracker.** The calendar exists as a plan; make it a rhythm — a weekly ship target, an owner, and a status column (drafted / gated / published / measured), folded into the existing Kaizen weekly retro loop (#273). The gap is publishing discipline, not ideas.

4. **Run a weekly "flagged-for-Conner" decision queue with batching and an SLA.** Consolidate the scattered founder approvals (bio, `/security` absolutes, headline pricing, tokens, voice catalog) into one triaged list reviewed on a fixed cadence, so marketing stops stalling on ad-hoc asks. Decisions that don't clear in N cycles get an explicit "hold" state so the surface can hedge the claim honestly in the meantime.

5. **Stand up a monthly competitive-intel pipeline feeding `/compare` and the SBM positioning.** A recurring scan (Claude SBM changelog + named competitors + category shifts) that updates `/compare/[alt]` and `project_sbm_wrapper_positioning`. Use standing it up as the forcing function to **resolve the canon contradiction** (friction #2) — decide once whether "built on Claude" ever appears, and encode it.

---

## Top 3 Investments

1. **A sustained SEO/AEO content pipeline (not more one-off waves).** The technical + AEO baseline is built; the missing asset is *cadence*. The moat per the content thesis is specificity — grounded, vertical-specific answer content beats horizontal AI slop. Fund a repeatable pipeline: brief → draft against ground-truth → voice-gate → publish → measure, running continuously against the 10 verticals' long-tail intent. This is the compounding distribution asset.

2. **Per-vertical hero photography — commission it.** The Heritage identity ships with `.img-heritage` / `.photo-figure` utilities and **five golden-hour photography briefs** (`docs/brand/photography-briefs-2026-06-22.md`) — but **no production photo exists** (flagged in both #310 and #320 memories). For a brand whose entire thesis is "intelligence *rooted in reality*," real photography of real operators is the single strongest "made by real people" proof, and it's the one gap the design system can't fill itself.

3. **Ad-creative production + a first measured paid test.** The ad *copy* is paste-ready; there is no static/video creative and zero paid spend. Fund production for the strongest vertical (realty, per the money-GTM pack) and a small first paid test with attribution wired, to convert ready assets into a *measured* channel and validate CPA before scaling. This directly attacks friction #9 (assets ≠ distribution).

---

## Bake-in: `feedback_model_vendor_invisible_on_customer_surfaces`

**This is a load-bearing rule that is currently enforced only by human discipline and is contradicted by older canon. Codify it.**

**The rule (ratified in practice 2026-06-11, shipped 2026-06-16):** the model/vendor is **invisible on every customer-facing surface.** No customer page, vertical hero, FAQ, comparison, ad, email, or in-app copy names "Claude," "Anthropic," "Opus/Sonnet/Haiku," or any model/provider. The value we sell is the *service* — pre-built skills, agents, memory management, done-for-you (`project_sbm_wrapper_positioning`). The model is the commodity underneath and stays invisible.

**The one allowed exception:** **legal subprocessor disclosure.** `/privacy` and `/security` name Anthropic (and must name every real subprocessor, including OpenAI on the embedding path — see friction #4) because subprocessor transparency is a compliance obligation, not marketing. This exception is narrow: subprocessor lists only, never in a value/positioning claim.

**Current state vs the rule:**
- ✅ Rendered marketing surfaces are clean — a scan of `app/(marketing)`, `lib/marketing`, `lib/verticals`, `components/marketing` finds the model named only in the two subprocessor disclosures (`privacy/page.tsx:154`, `security/page.tsx:65,153`).
- ⚠️ **Canon conflict:** `project_sbm_wrapper_positioning_2026_06_06` still prescribes "built on Claude, configured by us" on all 10 vertical hero subheads, and `lib/verticals/types.ts:333-338` still documents that framing. This is the exact drift that will reappear the next time someone writes a hero subhead from the SBM memory instead of the shipped surface.

**Actions to make it real (ordered):**
1. **Write the memory file.** Create `feedback_model_vendor_invisible_on_customer_surfaces` as a standalone load-bearing feedback memory (done alongside this retro) so the rule has a single home and every content agent recalls it.
2. **Resolve the contradiction.** Amend `project_sbm_wrapper_positioning` and the `lib/verticals/types.ts` comment: the *positioning* ("we run Claude for Small Business for you") stays; the *literal string "built on Claude"* comes out of customer-rendered subheads. One decision, encoded once.
3. **Gate it.** Add the vendor-invisible regex to the CI truth gate (improvement #1): fail on `\b(Claude|Anthropic|Opus|Sonnet|Haiku)\b` in `app/(marketing)`, `lib/marketing`, `lib/verticals`, `components/marketing` — with an allowlist scoped to the subprocessor blocks only. Discipline becomes enforcement.

---

## Verify

- **Path:** `docs/kaizen/2026-07-02/04-marketing.md`
- **Top friction patterns:** (1) truth/voice gates are pre-push-only, not CI, and have been bypassed with `HUSKY=0`; (2) the vendor-invisible rule is uncodified and the SBM canon contradicts it; (3) the highest-liability `/security` absolutes flagged in #290 are still rendered over open engineering gaps.
- **Top improvements:** (1) promote the gates to required CI checks + add vendor-invisible & claims linters; (2) per-vertical content review bound to runtime truth; (3) turn the 90-day calendar into a tracked publishing cadence.
- **Every claim cites** a file/PR/memory; no fabricated metrics or customer counts.
