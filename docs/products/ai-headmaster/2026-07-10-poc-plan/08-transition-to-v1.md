# AI Headmaster — Transition to V1 (after POC passes acceptance)

What changes when the M6 scorecard is green. Ordered by dependency, not ambition. Nothing here starts before POC acceptance — `feedback_no_new_verticals_finish_locked` applies within the product too: the locked scope (one family, one child, CM, Georgia) finishes first.

## 1. Multi-child (first, because it stresses the core design)

The schema already carries `Child[]` per family; the real work is agent-level: the Headmaster balancing shared blocks (morning basket, nature study together) against per-child lessons, and the Tutor debrief covering two children in one conversation without doubling parent minutes. IntegrationMap grows a `sharedBlocks` concept. This is the first v1 item because it's the strongest test of whether the POC's data model was right — do it before the surface area grows.

## 2. Auth / billing / multi-tenant

- Real auth (passkeys — agentplain's WebAuthn lessons port: `resolveRpId` from request host, PR #171; hints fix, PR #268).
- Stripe subscription at the brief's $25–35/mo B2C price point; trial policy decision deliberately reuses agentplain's ratified frame (CC-at-signup + money-back beats free-trial, PR #262) unless homeschool-market evidence says otherwise.
- RLS graduates from belt-and-suspenders to load-bearing — the POC shipped the policies (doc 02) precisely so this step is a config change plus a CI gate, not a retrofit.
- Per-family budget caps become the unit-economics enforcement at scale; the $10 target gets re-derived from real dry-run + early-cohort `LlmCallLog` data.

## 3. ESA reimbursement rails (AZ/FL/AR/UT)

The revenue kicker from the brief. Sequenced *after* billing because ESA vendors need an entity, invoicing, and per-state vendor registration (ClassWallet/Odyssey/Step Up in the respective states). Registrar grows state packs beyond Georgia the same way philosophy packs swap — `lib/compliance-packs/{ga,az,fl,ar,ut}.ts`. Each state pack is counsel-checked before launch (the agentplain legal-gate discipline).

## 4. Additional philosophy packs (Trivium / CiRCE / Memoria)

The `PhilosophyPack` interface (doc 05) was the swappability seam built for exactly this. Each pack = rhythm rules + lesson-length norms + subject-weighting + report voice. Validation per pack is a re-run of the M0 bake-off with that pack — the rubric is reusable. Packs also become marketing surface (each pack names its tradition truthfully; no invented pedagogy — Truth Wave).

## 5. Curriculum knowledge base — the moat

The POC plans from parent-entered metadata. V1's compounding asset is a **licensed/curated knowledge base of curricula metadata**: scope-and-sequence, pacing norms, known unit-to-unit affinities across publishers, aggregated (anonymized) pacing data from real families. Two hard notes:
- **The core rule survives:** the KB stores *structure and metadata at publisher-license quality*, never lesson content. Publisher partnerships (next item) are what make deeper metadata legal.
- **This is where "does it integrate?" stops being a per-family prompt problem** — cross-curricula affinities become ground truth the Integrator reads instead of infers. If M0 barely passed, this moves up the order.
- Onboarding collapses from type-the-ToC to pick-your-curricula — the ≤20-min ceiling becomes ~5 min.

## 6. Publisher affiliate + partnerships

Once the KB exists, the Integrator's "you own no spine for handwriting — families in this philosophy commonly use X or Y" recommendation slot becomes an affiliate surface. Rules carried from agentplain doctrine: recommendations must be genuinely ranked (no pay-for-placement dressed as advice — `feedback_everything_tells_a_story` cuts both ways), disclosed plainly, and never override philosophy-pack fit.

## 7. B2B co-ops / hybrid academies

Second business line from the brief. A co-op director is a multi-family Headmaster consumer: shared calendar, group blocks, per-family divergence. Deferred to last because it multiplies every surface (roles, permissions, reporting) — and because agentplain's own audit history (portal 0%-activatable, #327) shows what happens when a B2B surface ships before the underlying loop is proven with individuals.

## 8. Child-facing Socratic tutor (logic/rhetoric stages) — the headline vision, gated hardest

The brief's second core rule (parent-only) is a *POC* rule; the vision includes child-facing Socratic dialogue for older stages. This ships **only** behind: (a) a deliberate safety design pass (age-appropriate interaction, parental visibility into every transcript, session caps), (b) counsel review (COPPA — under-13 data collection needs verifiable parental consent even with parental visibility), (c) parent-controlled activation per child, default off, (d) its own eval suite before any live child interaction. The unit economics also change (a chatty 10-year-old is a very different token profile than a 3-minute parent debrief) — re-run doc 06 from scratch for this feature. Nothing about the POC architecture blocks it: the child model, the reference-only content rule, and the per-family budget all carry over.

## Explicitly still out at v1

Native mobile (responsive web holds until daily-loop retention data demands otherwise) · full photo work-analysis (photo *capture* into DailyLog may come earlier as dumb storage; analysis is its own cost/quality project) · any non-US compliance.
