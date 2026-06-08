# Explainer + Journey + Retention Visual System

**Date:** 2026-06-07
**Author:** explainer-visuals wave (fleet)
**Branch:** `docs/explainer-visual-system-2026-06-07`
**Status:** inventory + briefs + production prompts/specs — ready to fan out to a wiring wave

> **What this is — and what it is NOT.** This is the inventory of visuals that **do work**: they answer a question a real owner asks at a specific moment in the journey, so the answer is a picture instead of a paragraph. It is the complement to the **brand-asset visual gap audit (PR #173)**, which inventoried *brand slots* — hero/OG/favicon/avatar art. Where a visual here overlaps a brand slot in #173 (e.g. homepage heritage hero art, header head-icon), this doc **defers to #173** and references it; it does not re-spec the asset.

> **The thesis (Conner, verbatim 2026-06-07):** *"visuals that help explain what we do and how it works and how we help. Selling the ROI and the way of working. And even more materials once you sign up so you know we have you covered. That way when someone asks Plaino, what do I do next, there is not only readable material but visual explanations that help our users be successful and retain them."*

Every moment in the journey where a prospect or customer asks a **visual-shaped question** — a *what* or *how* better answered by a diagram, comparison, before/after, decision tree, dashboard, or process map than by prose — should have a visual answer. Missing visuals = friction = churn. This doc maps those moments, briefs each visual, and ships production-ready prompts (illustrations) or build specs (code/React).

---

## 0. Constants every brief inherits

### Brand tokens (source: `lib/brand/tokens.ts`, ratified 2026-05-10)

| Token | Hex | Use |
|---|---|---|
| paper | `#F7F4ED` | base background |
| paper-deep | `#EDE9DE` | card-on-card, header strips |
| ink | `#1A1A1F` | primary text, line work |
| ink-soft | `#2E2E33` | secondary text |
| **clay** | `#B65D3A` | **primary accent** (the one warm pull) |
| clay-deep | `#9A4D2F` | clay hover |
| moss | `#3F5C3F` | **verified / passed states ONLY — never decorative, never primary** |
| flag | `#B43A3A` | compliance flag / error utility ONLY |
| mute | `#726A5E` | captions, citations, secondary |
| rule | `#E0DAC9` | hairline rules |

**Type:** Source Serif 4 (display/headlines) · Inter (sans/body) · JetBrains Mono (eyebrows, labels, code).

**Plaino** is the named service partner — an 8-bit robot dog on an 8-bit plain (the metaphor is public per `project_brand_public_robot_dog_ratified_2026_06_06`). The in-app `Plaino` component (`components/ui/ap/`) renders states: `standing-watch / sitting-alert / herding / fetching / scouting / guarding / resting / head-icon / 8bit / heritage`. Reuse these states; do not invent new poses.

### Global hard-NOs (apply to every illustration prompt)

- NO rounded corners (the system is square-cornered, hairline-ruled)
- NO drop shadows, glows, bevels, or glossy 3D
- NO gradients (flat fills only; tonal steps via the paper/paper-deep pair)
- NO neon, no generic SaaS blue/purple, no "AI" sci-fi tropes (glowing brains, circuit boards, holograms, orbs)
- NO stock-photo humans, NO clip-art robots other than Plaino
- NO baked-in body text that must stay legible (labels minimal; real copy lives in HTML next to the asset)
- NO Anthropic/Claude logos; when referencing Claude, complementary never adversarial (`project_sbm_wrapper_positioning_2026_06_06`)
- Aesthetic target: **heritage, calm, agrarian-modern. Hairline line-work on warm paper. Lowercase. Intelligence rooted in reality — not pixie dust.**

### The 9 questions every surface must answer (source: `project_agentplain_mission_and_positioning`)

Q1 why exist · Q2 what is it (then verticals) · Q3 what does the app do / who · Q4 what's unique · Q5 how easy · Q6 why believe · Q7 ROI · Q8 future of work · Q9 why now. Each visual below tags which question(s) it answers.

### Production-path legend

- **ILLUSTRATION** → ChatGPT-ready prompt in this doc; output is a raster/SVG handed back to Conner, committed as a placeholder with a `CONNER ACTION:` note.
- **CODE-SVG** → a Wave subagent writes a deterministic SVG generator or inline JSX SVG; build spec in this doc.
- **REACT** → an interactive/data-bound component; props + data source + mount point in this doc.

---

## 1. Journey map — every stage, every visual-shaped question

| Stage | Surface(s) | Visual-shaped questions (owner's voice) |
|---|---|---|
| **0 · Cold / pre-trial** | `app/(marketing)/*` | "What even is this?" · "How does it actually work?" · "How is this different from Claude / from doing it myself / from hiring someone?" · "Will it work for MY business?" · "What's the ROI?" · "Does it send stuff on its own?" · "How do you protect my data?" · "Why should I believe you?" · "What's the future-of-work pitch?" |
| **1 · Trial signup / commit** | signup, `/pricing`, confirmation | "What am I committing to?" · "What happens after I sign up?" · "How long until I see anything useful?" |
| **2 · First-hour onboarding** | `app/(product)/app/workspace/[id]/onboarding` | "What should I do first?" · "Did I set this up right?" · "What's covered now that I'm in?" · "What happens to my data when I connect Gmail?" |
| **3 · First week** | overview, `/fleet`, day-3 email | "What is Plaino doing for me right now?" · "What should I expect this week?" · "Is this thing actually working?" |
| **4 · Steady state (activated)** | overview, `/approvals`, `/compliance`, `/briefings`, weekly email | "What did Plaino do for me this week?" · "What's queued / waiting on me?" · "What's being protected?" · "Am I getting my money's worth?" · "What else could it do that I'm not using?" |
| **5 · Plaino chat 'what next' (cross-cutting)** | `/talk`, support chat | "What should I do next?" · "Can you do X?" · "Show me what you did / what's the status?" · "Where do I find X?" |

The retention insight: **Stage 5 is not a stage, it's a layer that rides every other stage.** The conversational front door is where an activated customer re-asks the cold-prospect questions ("can you also…?", "what next?"). Answering those with visuals — not walls of text — is the retention lever (Section 4).

---

## 2. P0 visuals — the top 10 highest-leverage (ship first)

These ten cover the journey end-to-end and unblock the most friction per unit of effort. IDs reference the per-stage catalog in Section 3.

| # | ID | Visual | Question answered | Type | Surface |
|---|---|---|---|---|---|
| 1 | **V01** | The value loop | "What even is this?" | CODE-SVG | homepage + `/how-it-works` |
| 2 | **V02** | Build-it-yourself vs run-for-you | "How is this different from Claude SBM / DIY?" | CODE-SVG | homepage "why pay vs free" + `/pricing` |
| 3 | **V04** | Vertical value-loop selector | "Will it work for MY business?" | REACT | homepage vertical band + vertical pages |
| 4 | **V05** | ROI value-stack | "What's the ROI?" | REACT (enhances `RoiCalculator`) | `/pricing` + vertical `RoiAnchor` |
| 5 | **V06** | Draft-then-approve control loop | "Does it send things on its own?" | CODE-SVG | homepage uniques + `/how-it-works` + connect step |
| 6 | **V07** | Trust architecture | "How do you protect my data?" | CODE-SVG | `/security` + connect step |
| 7 | **V13** | Onboarding roadmap (5 steps) | "What happens after I sign up?" | CODE-SVG / REACT stepper | signup confirmation + first onboarding screen |
| 8 | **V17** | "We have you covered" coverage map | "What's covered now I'm in?" | REACT | post-signup welcome + overview |
| 9 | **V22** | Weekly digest dashboard | "What did Plaino do for me this week?" | REACT + email | in-app weekly view + briefing email |
| 10 | **V27** | Plaino "what next" card | "What should I do next?" | REACT (chat) | `/talk` + support chat — **retention payload** |

---

## 3. Per-stage visual catalogs

### Stage 0 — Cold / pre-trial (marketing)

---

#### V01 — The value loop · **P0** · CODE-SVG
- **Question:** "What even is this? What does agentplain actually do?" (Q2)
- **Moment:** homepage, just under the hero; reused as the spine of `/how-it-works`.
- **Reading time:** 30s scan.
- **Build spec.** A horizontal **closed loop** of five nodes on paper, hairline `rule`-stroked, square nodes, mono labels:
  1. **your tools** (email · calendar · CRM · docs) →
  2. **the fleet reads** →
  3. **categorize · draft · schedule · coordinate** →
  4. **your approval queue** (clay-accented — this is where the human sits) →
  5. **your tools send** → (arrow loops back to node 1)
  - One clay annotation under node 4: *"nothing leaves until your name is on it."*
  - Plaino `herding` mark sits beside node 3.
  - File: `components/explainers/ValueLoopDiagram.tsx` returning inline `<svg>` (no raster dep; renders in node:test like the existing `Plaino` component — plain markup, NOT next/image). viewBox ~ `0 0 960 280`. Pure, prop-less, server-rendered.
  - Mount: new `<Section>` on `app/(marketing)/page.tsx` after hero; reuse on `/how-it-works` (create if missing — see V33).
- **Why code, not illustration:** the five labels are load-bearing product truth (must match the no-outbound architecture) and must stay localizable/editable.

#### V02 — Build-it-yourself vs run-for-you · **P0** · CODE-SVG
- **Question:** "How is this different from Claude for Small Business / from doing it myself?" (Q4)
- **Moment:** homepage "why pay vs free" section + `/pricing` comparison.
- **Reading time:** 30s.
- **Build spec.** Two-column comparison, hairline divider. LEFT = **"Claude for Small Business (do it yourself)"**, RIGHT = **"agentplain (run for you)"**. Five rows pulled **verbatim** from `lib/marketing/home-content.ts` → `chatbotContrast` (`free` vs `us`): waits-for-prompt vs works-overnight · starts-blank vs pre-trained-on-your-vertical · text-to-copy-paste vs lands-in-approvals · you-wire-the-tools vs partner-installs · no-memory vs rooted-in-your-systems. RIGHT cells carry a single `moss` check (verified-good signal only). Header note (clay, small): *"built on Claude, configured by us."*
- **Guardrail:** complementary framing only — never "compete/replace/instead-of/alternative-to Claude" (`project_sbm_wrapper_positioning_2026_06_06`).
- File: `components/explainers/DiyVsRunForYou.tsx`, data imported from `home-content.ts` (single source of truth — do NOT re-type the rows). Mount: replace/augment the existing `ContrastRow` block on the homepage; embed on `/pricing`.

#### V03 — Do-nothing / hire / generic-AI / agentplain quadrant · **P1** · CODE-SVG
- **Question:** "Why not just hire an assistant, or use a generic AI tool, or keep doing it myself?" (Q4, Q7)
- **Moment:** `/how-it-works` + homepage objection band.
- **Reading time:** 30s.
- **Build spec.** Four-column cost-vs-coverage table: **do nothing** / **hire an assistant** (~$3–5k/mo, one person, no compliance) / **generic AI** (cheap, blank, you wire it) / **agentplain** ($99–199/seat, pre-trained, compliance-first, you stay in control). Rows: monthly cost · setup effort · vertical knowledge · compliance · who stays in control · scales with your book. agentplain column clay-bordered. Anchor costs to `home-content.ts` `ladderBands` + the hire benchmark in `project_pricing_value_anchor`. File: `components/explainers/AlternativesMatrix.tsx`.

#### V04 — Vertical value-loop selector · **P0** · REACT
- **Question:** "Will this actually work for MY business?" (Q2→verticals, Q3) — asked by every non-realtor who lands on page one.
- **Moment:** homepage vertical band (so a CPA/lawyer/insurance broker isn't lost on page one) + top of each vertical landing page.
- **Reading time:** 2-min explore.
- **Build spec (REACT).** A vertical picker (10 verticals + general on-ramp) that, on select, swaps in **3 real end-to-end workflows** that vertical's fleet runs — sourced from `lib/verticals/{slug}/content.ts` `valueLoopExample` (scenario/before/after/outcome) + the top 3 `jtbdTables` rows (job · today · with agentplain). Each workflow renders as a mini before→after strip reusing the V01 loop motif. No new data — binds to existing `getVerticalContent(slug)`.
  - Props: `{ initialSlug?: VerticalSlug }`. Pulls from the vertical registry at build/render.
  - File: `components/explainers/VerticalValueLoop.tsx`. Mount: homepage (default `general`), and each `app/(marketing)/[vertical]/page.tsx` (default = that vertical, picker collapsed).
- **Highest-leverage discovery visual** — it's the answer to "is this for me" for nine verticals at once.

#### V05 — ROI value-stack · **P0** · REACT (enhances existing `RoiCalculator`)
- **Question:** "What's the actual return?" (Q7)
- **Moment:** `/pricing` + each vertical page's `RoiAnchor`.
- **Reading time:** 10s glance (static stack) → 2-min (interactive).
- **Build spec.** `components/RoiCalculator.tsx` already exists (inputs → multiplier). Add a **value-stack bar** beside it: a stacked vertical bar showing the three value sources — (a) hours saved × hourly rate, (b) deals advanced × commission, (c) violations a draft-then-approve loop kept from sending — totalling the `$2,900–$10,600/mo` band, with a thin clay baseline marking the `$99–$199/mo` subscription. The visual punch: subscription is a sliver against the stack. Cite `project_pricing_value_anchor` (15×–50× per workflow). Outputs update live with the calculator inputs.
  - File: extend `components/RoiCalculator.tsx` + new `components/explainers/RoiValueStack.tsx`. Keep the "typical 15×–50×" framing (NOT the retired 15–107×, per `agentplain-roi-soften` branch lineage).

#### V06 — Draft-then-approve control loop · **P0** · CODE-SVG
- **Question:** "Does this thing send emails / move money on its own?" (Q4 control, Q6)
- **Moment:** homepage uniques ("you stay in control") + `/how-it-works` + reused at the integration connect step (V18).
- **Reading time:** 10s glance.
- **Build spec.** A short left-to-right strip: **fleet drafts** → **lands in YOUR queue** (clay, with approve/edit/reject glyphs as hairline squares) → **only then your system sends**. A `flag`-free, calm composition. Big mono caption: *"drafts and proposes — never auto-sends, never moves money, never makes commitments."* This is `project_no_outbound_architecture` made visible. File: `components/explainers/ControlLoopDiagram.tsx`.

#### V07 — Trust architecture · **P0** · CODE-SVG
- **Question:** "How do you protect my data?" (Q6)
- **Moment:** `/security` (primary) + reused at the connect step (V18).
- **Reading time:** 30s.
- **Build spec.** A layered diagram (boxes, hairline, no lock-icon clichés beyond a single restrained square padlock glyph if needed):
  - your connected tools → **read scope only** →
  - **per-workspace isolation** (one tenant can't see another) →
  - **encrypted at rest** (the chat/payload crypto seam) →
  - **our API keys, not yours** →
  - **your data is never used to train models** →
  - **every action audit-logged** →
  - **you approve every send** (ties to V06).
  - Verify each claim against code before committing labels: `lib/security/payload-crypto`, RLS policies, the no-outbound architecture, model-provider config. Do NOT assert a control the code doesn't back (`feedback_no_guesses_no_estimates`).
  - File: `components/explainers/TrustArchitecture.tsx`. Mount: `app/(marketing)/security/page.tsx`.
- **Overlap note:** PR #173 owns the `/trust` brand *hero art*; this diagram is functional, not a brand slot — in scope here. Coordinate the page so the diagram sits below #173's hero.

#### V08 — "Rooted in reality" proof panel · **P1** · ILLUSTRATION
- **Question:** "Why should I believe you?" (Q6)
- **Moment:** homepage proof section, beside the `proof[]` cards.
- **Reading time:** 10s glance (it's mood + credibility, copy lives in HTML).
- **ChatGPT prompt:**
  > A calm, heritage editorial illustration on a warm cream paper background (#F7F4ED). Subject: a small-town main-street storefront at dawn — a single independent business (no signage text) — with a faithful 8-bit pixel-art robot dog (terracotta #B65D3A and ink #1A1A1F, blocky, friendly, NOT cute-cartoon, NOT chrome/sci-fi) sitting watchfully on the sidewalk in front. Behind, a flat open plain meeting a wide sky, drawn in fine hairline ink linework. Flat color fills only — terracotta clay #B65D3A as the single warm accent, deep ink #1A1A1F linework, moss green #3F5C3F used sparingly for foliage. NO gradients, NO drop shadows, NO glow, NO neon, NO chrome, NO lens flare, NO text/letters, NO rounded-corner UI, NO generic blue tech palette. Mood: dependable, grounded, pre-dawn quiet — "intelligence rooted in reality," a partner who showed up before the owner did. Square-ish editorial crop. Output 1600×1000.
  - Commit a placeholder `public/explainers/proof-rooted.svg` + `CONNER ACTION:` note. Mount: homepage proof band.

#### V09 — The ratio inversion (future of work) · **P1** · CODE-SVG
- **Question:** "What's the future-of-work pitch — does AI replace me?" (Q8)
- **Moment:** homepage vision section + `/about`.
- **Reading time:** 10s glance.
- **Build spec.** A before/after pair of horizontal bars. BEFORE: "today" — ~65% admin (mute) / ~35% relationship & judgment (clay). AFTER: "with agentplain" — inverted. Caption: *"AI doesn't replace the owner. It changes which part of the job they spend the day on."* Anchor the ratio to the mission rule's Q1 framing (60–70% systematic work). File: `components/explainers/RatioInversion.tsx`.

#### V10 — A week with agentplain · **P1** · ILLUSTRATION
- **Question:** "What does living with this actually feel like?" (Q5, Q8)
- **Moment:** homepage "how it works" lead-in + `/how-it-works`.
- **Reading time:** 30s.
- **ChatGPT prompt:**
  > A horizontal heritage editorial strip illustration, warm cream paper background (#F7F4ED), fine hairline ink linework (#1A1A1F), single warm accent terracotta #B65D3A, moss #3F5C3F sparingly. Three connected vignettes left-to-right showing one quiet narrative: (1) night — a faithful 8-bit pixel-art robot dog (terracotta + ink, blocky, friendly, not chrome, not sci-fi) working under a moon over a flat plain, small stacked "paper" drafts beside it; (2) dawn — the same drafts neatly stacked at a desk by a window; (3) morning — a coffee cup beside the stack, one draft marked with a small terracotta check, as if just approved. Flat fills only. NO gradients, shadows, glow, neon, chrome, text/letters, rounded UI, blue tech palette, NO human faces (suggest presence via the coffee cup and desk, not a depicted person). Mood: calm, dependable, "it worked while you slept." Output 1800×600.
  - Placeholder `public/explainers/week-in-the-life.svg` + `CONNER ACTION:`.

#### V11 — The 10-vertical map · **P1** · REACT (+ optional ILLUSTRATION hero per #173)
- **Question:** "Do you serve businesses like mine?" (Q2→verticals)
- **Moment:** homepage vertical band + `/verticals`.
- **Reading time:** 10s glance.
- **Build spec.** A grid of all 10 verticals + the `general` on-ramp, each a square hairline card with the vertical name, its `missionSubject`, and a Plaino motif. Binds to the vertical registry (`lib/verticals/index.ts`). Ensures no vertical is lost on page one. File: `components/explainers/VerticalMap.tsx`. **Any decorative hero art for this band defers to PR #173.**

---

### Stage 1 — Trial signup / commit

---

#### V12 — "What am I committing to" card · **P1** · REACT
- **Question:** "What am I actually signing up for — what does it cost, am I locked in?" (Q7)
- **Moment:** signup screen + `/pricing` summary.
- **Reading time:** 10s.
- **Build spec.** A single clarity card: per-seat ladder (from `ladderBands`), "billed monthly per seat," "what's included" (install + config + reviews on a cadence — the service-partnership), "no long-term contract." No 3-column tier comparison (banned per `project_stripe_both_surfaces`). File: `components/explainers/CommitmentCard.tsx`.

#### V13 — Onboarding roadmap (5 steps) · **P0** · CODE-SVG / REACT stepper
- **Question:** "What happens after I sign up? What's the path?" (Q5)
- **Moment:** signup confirmation + the first screen of `app/(product)/app/workspace/[id]/onboarding`.
- **Reading time:** 30s.
- **Build spec.** A 5-node horizontal stepper: **pick your vertical → connect your first tool (60s) → see the fleet's first drafts (minutes) → review & approve → steady rhythm**. On the onboarding page it doubles as a **progress indicator** (current step highlighted clay) bound to `onboardingState` + `INPUT_STEPS` (`lib/onboarding/steps.ts`). Static SVG variant for the signup confirmation email/page. File: `components/explainers/OnboardingRoadmap.tsx` (accepts `currentStep?` to light up progress).

#### V14 — Time-to-value timeline · **P1** · CODE-SVG
- **Question:** "How long until I see anything useful?" (Q5)
- **Moment:** signup confirmation + onboarding sidebar.
- **Reading time:** 10s.
- **Build spec.** A thin horizontal timeline: `0:00 connect → ~1 min first read → minutes first drafts → day 1 first approvals → week 1 rhythm`. Anchors to the first-5-min-value work (`lib/onboarding/`, FirstFireWatch). File: `components/explainers/TimeToValue.tsx`.

---

### Stage 2 — First-hour onboarding

---

#### V15 — "Do this first" next-action spotlight · **P0** · REACT
- **Question:** "What should I do first?" (Q5)
- **Moment:** `onboarding/page.tsx`, top of the right pane.
- **Reading time:** 10s.
- **Build spec.** A single, unmissable next-action card: the one highest-value step the owner hasn't done (usually "connect Gmail / your CRM"). Derives from connected-integration set + `resolvePickableSkills`. Pairs with the existing `FirstFireWatch` — once the first fire happens, the card flips to "your fleet just drafted its first item → review it." One action at a time; no wall of options. File: `components/onboarding/DoThisFirst.tsx`.

#### V16 — Setup-health checklist · **P0** · REACT
- **Question:** "Did I set this up right?" (Q5)
- **Moment:** onboarding page + persists on overview until complete.
- **Reading time:** 10s glance.
- **Build spec.** A checklist with status glyphs (moss check = done, hairline square = todo): vertical picked · first tool connected · schedule window set · at least one preference captured · first draft reviewed. Reuses `ApHairlineList` primitive. Binds to `onboardingState`, connected integrations, `WorkspacePreference`. File: `components/onboarding/SetupHealth.tsx`.

#### V17 — "We have you covered" coverage map · **P0** · REACT
- **Question:** "Now that I'm in — what's actually covered? What is Plaino watching and handling for me?" (Q3, Q6)
- **Moment:** post-signup welcome screen + a persistent panel on overview. **Conner named this one explicitly** ("so you know we have you covered").
- **Reading time:** 30s scan.
- **Build spec (REACT).** A coverage map across the **8 disciplines** (from `PlainoCapabilitySnapshot.disciplines`): for each, show what the fleet now **watches / drafts / handles** for this workspace, with an honest status badge per item:
  - `active` (moss) — wired + firing for this vertical
  - `ready` (ink) — available, connect a tool to light it up
  - `drafted` (mute) — compliance corpus drafted, awaiting counsel (per the real-estate-only fires reality in `home-content.ts`)
  - Binds to `buildCapabilitySnapshot(workspaceId)` + the vertical's `agentRoster` + corpus status. **Honesty is the point** — never show "covered" for something the runner can't do (`reference_product_claims_vs_reality`, `feedback_no_guesses_no_estimates`).
  - File: `components/coverage/CoverageMap.tsx`. Mount: new welcome screen + overview panel.
- This is the assurance/retention visual: it makes "we have you covered" literal and auditable.

#### V18 — Connect-time trust micro-diagram · **P1** · CODE-SVG (reuses V07/V06)
- **Question:** "What happens to my data when I connect Gmail / my CRM?" (Q6)
- **Moment:** the integration connect modal (`integrations/page.tsx`).
- **Reading time:** 10s.
- **Build spec.** A compact inline strip: "we read [scope] · we never send without your approval · encrypted at rest · you can disconnect anytime." A miniature of V07 + V06 sized for a modal. File: reuse `TrustArchitecture` with a `compact` prop.

---

### Stage 3 — First week

---

#### V19 — Live fleet status · **P1** · REACT
- **Question:** "What is Plaino doing for me right now?" (Q3)
- **Moment:** overview + `/fleet` (FleetMap/ActivityStream exist).
- **Reading time:** 10s glance.
- **Build spec.** A glanceable status row: running now · ran today · queued for you · next scheduled fire. Binds to skill-fire feed + scheduler window. Complements the existing `ActivityStream`/`SkillFiresFeed` with a single summarizing visual. File: `components/fleet/FleetStatusStrip.tsx`.

#### V20 — Week-1 expectations timeline · **P1** · CODE-SVG
- **Question:** "What should I expect this week?" (Q5)
- **Moment:** overview banner (first 7 days) + the welcome email.
- **Reading time:** 30s.
- **Build spec.** A day-by-day strip (Mon→Fri): "drafts start landing · first morning briefing · first compliance scan · your preferences start shaping the work · first weekly digest." Dismissible after week 1. File: `components/explainers/WeekOneTimeline.tsx`.

#### V21 — First-week proof snapshot · **P1** · REACT
- **Question:** "Is this thing actually working?" (Q6)
- **Moment:** overview (days 3–7) + a day-3 email.
- **Reading time:** 10s glance.
- **Build spec.** A mini stat trio: items drafted · est. hours saved · flags caught. Conservative, honest counts from the activity/approval tables. Precursor to the steady-state digest (V22). File: `components/proof/FirstWeekSnapshot.tsx`.

---

### Stage 4 — Steady state (activated)

---

#### V22 — Weekly digest dashboard · **P0** · REACT + email
- **Question:** "What did Plaino do for me this week?" (Q3, Q6, Q7) — **the recurring retention proof.**
- **Moment:** an in-app weekly view + the weekly digest email (build on `lib/skills/briefing-generator/`).
- **Reading time:** 30s scan.
- **Build spec.** A one-screen dashboard: **drafted** (n) · **approved/sent by you** (n) · **est. hours saved** · **deals/matters advanced** · **flags caught** · **what's queued for you now** · **one suggested next step**. Two render targets from one data builder: (a) React component on a `/app/workspace/[id]/digest` view; (b) HTML email via the existing email adapter (`lib/email/`), mirroring `notifyBriefingReady`. Cron: extend the briefings sweep or add a weekly sweep (Inngest). Numbers must be real + conservative (`feedback_no_guesses_no_estimates`).
  - Files: `lib/digest/build-weekly-digest.ts` (pure builder, shared) · `components/digest/WeeklyDigest.tsx` (in-app) · `lib/digest/email.ts` (email render). Ties to the margin/ROI thesis — the digest is where lived ROI shows up (`project_production_growth_plan_2026_06_05`).

#### V23 — Approvals overview · **P1** · REACT
- **Question:** "What's queued / waiting on me?" (Q3)
- **Moment:** overview + `/approvals` header.
- **Build spec.** A summary band over `ApprovalsList`: count by kind, oldest-waiting age, one-click "review the oldest." Binds to the approval queue. File: `components/approvals/ApprovalsSummary.tsx`.

#### V24 — Compliance coverage dashboard · **P1** · REACT
- **Question:** "What's being protected / watched?" (Q4, Q6)
- **Moment:** `/compliance` + an overview tile.
- **Build spec.** Active sentinel rules for this vertical · flags caught this period · per-vertical corpus status (active / drafted-awaiting-counsel). Binds to `lib/agents/sentinel/` corpus status (`project_compliance_corpus_lives_in_sentinel`). Honest: only real-estate fair-housing fires live today; show the rest as "drafted." File: `components/compliance/ComplianceCoverage.tsx`.

#### V25 — Running value ledger · **P1** · REACT
- **Question:** "Am I getting my money's worth?" (Q7)
- **Moment:** overview + `settings/billing`.
- **Build spec.** A cumulative line: hours + $ value delivered vs subscription paid, since signup. The lived version of V05. Conservative inputs. Binds to activity/approval history + the budget seam (`lib/billing/budget.ts`). File: `components/value/ValueLedger.tsx`.

#### V26 — Unused-capability nudge · **P2** · REACT
- **Question:** "What else could the fleet do that I'm not using?" (Q3, expansion)
- **Moment:** overview + marketplace.
- **Build spec.** Surfaces 1–2 high-value capabilities the workspace hasn't enabled, with a one-line "what it'd do for you." Drives expansion + retention. Binds to capability snapshot `availableButUnconnected`. File: `components/coverage/UnusedCapabilityNudge.tsx`.

---

### Stage 5 — Plaino chat "what next" (cross-cutting) — see Section 4 for the full pattern

---

#### V27 — Plaino "what next" card · **P0** · REACT (chat) — **RETENTION PAYLOAD**
#### V28 — Capability answer card · **P1** · REACT (chat)
#### V29 — Work-status progress card · **P1** · REACT (chat)
#### V30 — Workspace navigation card · **P2** · REACT (chat)

These four are specified in depth in Section 4.

---

### Email twins (render targets of in-app visuals)

#### V31 — Welcome email "here's what's covered" · **P1** · email render of V17
- **Moment:** the post-signup welcome email. HTML-coded (table layout), mirrors the CoverageMap. File: `lib/onboarding/welcome-email.ts`.

#### V32 — Weekly digest email · **P0** (twin of V22) · email render
- Covered by V22's `lib/digest/email.ts`.

---

## 4. The Plaino chat "what next" pattern — the retention lever

This is the payload. Today, Plaino's replies render as **plain text** in `ChatBubble` (`talk-view.tsx:97-105`) with a small mono `PlainoFooter` for citations / instruction state / named gaps. When an owner asks *"what should I do next?"*, they get a paragraph. **A paragraph is the wrong shape for a next-step question.** The fix: Plaino's reply carries an optional **visual card** rendered beneath the text — actionable tiles, a queue glance, a status progress bar — without changing the 5-path dispatcher logic and without a new approval kind.

### 4.1 The carrier — zero schema change

`PersistedChatMessage.metadata` is already `Record<string, unknown> | null` (`lib/plaino/types.ts:151`) and is persisted per message. The card is **additive metadata** on the existing Plaino reply — no migration, no new table, no new approval kind (same discipline that kept the chatbot clean in `project_plaino_chatbot_two_surfaces`).

Add an optional, validated field to the reply metadata:

```ts
// lib/plaino/visual-card.ts  (new)
export type PlainoCard =
  | { type: 'next-steps'; steps: NextStep[]; queue?: QueueGlance }   // V27
  | { type: 'capability'; verdict: 'yes' | 'not-yet' | 'roadmap';
      detail: string; namedGap?: string; connect?: ConnectCta }      // V28
  | { type: 'work-status'; state: InstructionState; approvalId: string;
      discipline: string | null }                                    // V29
  | { type: 'nav'; destinations: NavTarget[] };                      // V30

export interface NextStep {
  label: string;                 // "review 3 drafts waiting on you"
  href: string;                  // deep link into the workspace
  weight: 'primary' | 'normal';  // primary = clay
  why?: string;                  // one-line rationale
}
export interface QueueGlance { drafts: number; flags: number; oldestAgeHrs: number; }
// ConnectCta / NavTarget / InstructionState analogous; InstructionState reuses talk-view's union.
```

`PlainoTurnOutput` already exposes everything a card needs (`instructionApprovalId`, `classification.namedGap`, `targetDiscipline`, `citations`) plus the `PlainoCapabilitySnapshot`. The dispatcher attaches a `card` to the reply's metadata when the turn warrants one.

### 4.2 When a card is attached (per dispatch path)

| Path | Trigger | Card |
|---|---|---|
| **ANSWER** | message matches a "what next / what should I do / where do I start" intent | `next-steps` (V27): builds 2–4 steps from live workspace state — drafts waiting, flags open, setup gaps, an unused high-value capability — + a `QueueGlance`. |
| **ANSWER** | "can you do X / do you support X" intent | `capability` (V28): `yes` + how, or `not-yet` + the connect CTA, derived from the capability snapshot. |
| **INSTRUCT** | any work hand-off | `work-status` (V29): upgrades the existing text `InstructionTile` to a progress card (drafting → awaiting review → approved), deep-linking to `/approvals?focus=`. |
| **DECLINE_HONESTLY** | a `namedGap` exists | `capability` (V28) with `verdict:'not-yet'` + `namedGap` + (if connectable) a connect CTA — turns a dead-end "I can't" into a path forward. |
| **REGISTER / PREFERENCE** | — | no card (text + existing footer is right). |

The **next-steps builder** is a pure function reading durable workspace state on every fire (`feedback_cold_start_safe_agents`):

```ts
// lib/plaino/next-steps.ts (new) — pure, cold-start safe
buildNextSteps(snapshot, approvalState, onboardingState, complianceState): NextStep[]
// priority order: setup gaps → oldest drafts waiting → open compliance flags →
// one unused high-value capability. Cap at 4. Each step is a real deep link.
```

### 4.3 Rendering — additive, accessible

`ChatBubble` keeps rendering `message.body` (the prose answer is **always** present — the card never replaces text, it follows it). Below the body, if `metadata.card` is present, render `<PlainoCardView card={card} workspaceId={...} />`:

- File: `components/plaino/PlainoCardView.tsx` — square hairline tiles, clay for the primary step, mono labels, deep links. Reuses `ApPaperCard` / `ApHairlineList` / `ApHeritageButton`.
- **Accessibility:** the text answer is the source of truth; the card is an enhancement. Each tile is a real `<a>`/`<button>` with a text label (screen-reader complete without the visual). No information lives only in the card.
- **Degraded mode:** if metadata is absent or malformed, render text only — no throw (mirrors the degraded-mode discipline already in `dispatcher`).
- **Both surfaces:** the same `PlainoCardView` renders in `/talk` (`talk-view.tsx`) and in the in-app support chat (`components/support/PlainoSupportChat.tsx`), since both ride the one backbone.

### 4.4 Test seam

Pure builders (`buildNextSteps`, the card attachers) + a DB-free `PlainoCardView` render → unit-testable exactly like the existing `talk-view` states (`tests/customer-talk.test.tsx`). Add fixtures for each card type. No live LLM needed: the dispatcher attaches cards deterministically from state, not from model free-text.

### 4.5 Why this is the retention lever

The activated owner's most common chat is *"what now?"* / *"what next?"* / *"can you also…?"*. Answered as prose, it's a chore to parse and easy to bounce off. Answered as **a glance at the queue + two tappable next steps**, it pulls the owner back into the loop every time — the conversational front door becomes a re-engagement surface, not a Q&A dead-end. It also makes the DECLINE path *generative* (named gap → connect CTA) instead of a churn cue.

---

## 5. Wiring plan — surface → visuals

| Surface (file) | Visuals to mount |
|---|---|
| `app/(marketing)/page.tsx` (homepage) | V01 value loop · V02 DIY-vs-run · V04 vertical selector (default general) · V09 ratio inversion · V11 vertical map · V08/V10 illustrations |
| `app/(marketing)/how-it-works` (create if missing — see V33 note) | V01 · V03 alternatives · V06 control loop · V10 week-in-the-life · V13 roadmap (static) |
| `app/(marketing)/pricing/page.tsx` | V02 · V05 ROI value-stack · V12 commitment card |
| `app/(marketing)/[vertical]/page.tsx` | V04 (default = that vertical) · V05 in `RoiAnchor` |
| `app/(marketing)/security/page.tsx` | V07 trust architecture (below #173 hero) |
| `app/(marketing)/about/page.tsx` | V09 ratio inversion |
| `app/(marketing)/verticals/page.tsx` | V11 vertical map |
| signup confirmation | V13 roadmap · V14 time-to-value · V12 commitment |
| `onboarding/page.tsx` | V13 (as progress) · V15 do-this-first · V16 setup-health · V17 coverage map · V18 connect-time trust |
| welcome screen / email | V17 / V31 coverage · V20 week-1 timeline |
| overview (`workspace/[id]/page.tsx`) | V17 coverage panel · V19 fleet status · V21 first-week snapshot · V22 digest entry · V23 approvals summary · V25 value ledger · V26 unused-capability nudge |
| `/fleet` | V19 fleet status |
| `/approvals` | V23 approvals summary |
| `/compliance` | V24 compliance coverage |
| `/digest` (new) + weekly email | V22 / V32 |
| `settings/billing` | V25 value ledger |
| `/talk` + support chat | V27 next-steps · V28 capability · V29 work-status · V30 nav (via `PlainoCardView`) |
| integration connect modal | V18 |

#### V33 — `/how-it-works` master explainer (note)
If `/how-it-works` does not yet exist, the wiring wave should create it as the single scrollable end-to-end story stitching V01 → V06 → V10 → V13. P1. REACT page composing the above components; optional scroll-reveal (no heavy animation lib — CSS only).

---

## 6. Inventory summary

**34 visuals** across the journey:

- **ILLUSTRATION (ChatGPT → Conner):** V08, V10 (+ any V11 hero art deferred to #173) → **2 net new prompts** in this doc (others defer to #173).
- **CODE-SVG (deterministic, Wave-buildable):** V01, V02, V03, V06, V07, V09, V13, V14, V18, V20 → **10**.
- **REACT (interactive / data-bound):** V04, V05, V11, V12, V15, V16, V17, V19, V21, V22, V23, V24, V25, V26, V27, V28, V29, V30, V33 → **19** (V05 enhances existing; V11 has a code core).
- **EMAIL render targets:** V31, V32 → **2** (twins of V17/V22).
- **DEFERRED to PR #173 (brand slots):** homepage heritage hero art, header head-icon, OG, favicon, in-app avatar.

**Top 10 P0:** V01, V02, V04, V05, V06, V07, V13, V17, V22, V27.

**Retention payload:** the Plaino "what next" pattern (V27–V30, Section 4) — visual cards carried on existing chat-reply metadata, zero schema change, additive + accessible, making the conversational front door a re-engagement surface.

---

*Cross-references: `project_agentplain_mission_and_positioning` (9 questions) · `project_sbm_wrapper_positioning_2026_06_06` (V02 guardrails) · `project_no_outbound_architecture` (V06) · `project_pricing_value_anchor` (V05/V25) · `project_plaino_chatbot_two_surfaces` (Section 4 carrier) · `project_compliance_corpus_lives_in_sentinel` (V24) · `feedback_no_guesses_no_estimates` (every count honest) · PR #173 visual gap audit (brand slots — deferred).*
