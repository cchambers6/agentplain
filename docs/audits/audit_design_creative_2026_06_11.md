# Design + Creative Audit — agentplain.com — 2026-06-11

**Auditor lens:** senior brand/product design director. Read-only.
**Evidence basis:** mixed — I had **pixel evidence** (two recent full-page captures `C:\agentplain\sprint-home-desktop-2026-06-09.jpeg` + `mobile-375-home.jpeg`, plus the live brand PNGs `head-icon.png` and `heritage.png` rendered directly) **plus source-of-truth** (component tree + shipped `public/`). I could **not** capture fresh 1440/375 Playwright/Chrome screenshots — the Playwright browser was locked by a parallel session and Chrome's CDP screenshot pipeline timed out repeatedly. Visual-craft judgments below are grounded in the assets I *did* render, never faked.

---

## 0. Standalone vs. second-pass

This is a **standalone first-principles audit.** The parallel file `C:\Users\conne\outputs\design_marketing_audit_2026_06_11.md` did **not exist** at start or at write time (checked twice). No second-pass critique section is included.

It builds on, and re-verifies drift against, the prior `visual_gap_audit_2026_06_07.md` baseline.

---

## 1. Executive summary

agentplain's design **foundation is genuinely strong** — a disciplined token system (warm Paper/Ink/Clay/Moss in `app/globals.css`, zero hardcoded hex, accessible focus rings, skip-to-content, no-shadow hairline cards), a confident lowercase-serif voice, and editorial restraint that reads as *craft*, not *unfinished*. That is rare and worth protecting. The problem is the **top layer**: imagery and brand-character cohesion. The site is ~95% typography-on-paper. The two real raster assets that have landed on production (`head-icon.png`, `heritage.png`) are **off the ratified palette** (full naturalistic brown/tan/black beagle, not the Ink-mostly mark the brand lock specifies), the head-icon ships with a **literal reference-sheet label artifact** ("8. HEAD ICON") baked into the crop, and the in-app Plaino is a completely different, primitive 1.5px stick-dog scaffold whose own comment still says "the metaphor is NEVER disclosed" — directly contradicting the 2026-06-06 public-mark ratification. The result: a buyer who lands on the marketing site sees a warm, handsome illustrated hound, then logs into the product and meets a geometric doodle. **The brand has two faces and they don't know each other.** Critically, the **current working branch (`plan/production-growth-2026-06-03`) does not contain the brand imagery at all** — it still ships the serif-"a" favicon and the stale "independent brokerage" OG copy — so the imagery that *is* live is one rebase away from regressing.

**Overall design/creative lens score: 3 / 5.** Foundation is a 4; imagery/craft/cohesion drags it to 3.

---

## 2. Top 5 issues (severity 1–5; customer-value-block 1–5)

| # | Issue | Sev | Cust-block | Evidence |
|---|-------|-----|-----------|----------|
| 1 | **Two incompatible Plainos.** Marketing = rich naturalistic illustrated hound (`/brand/plaino-system/head-icon.png`, `heritage.png`); in-app = 1.5px geometric stick-dog scaffold (`components/ui/ap/PlainoAvatar.tsx`) whose header still reads "the metaphor is NEVER disclosed to customers." No single character crosses the marketing→product seam. | 5 | 4 | rendered PNG; `PlainoAvatar.tsx:7-13` |
| 2 | **Shipped brand assets are off-palette + carry a crop artifact.** The live `head-icon.png` is a full-color brown/tan/black beagle (brand lock = "mostly Ink, single Clay collar tag") and the crop still includes the sheet caption "8. HEAD ICON" at the bottom edge. `heritage.png` (good) likewise uses naturalistic fur + has a stray frame line on its right edge. | 4 | 3 | rendered both PNGs |
| 3 | **Vertical pages render zero imagery — text wall + stat strip only.** `VerticalHero.tsx` outputs eyebrow→tagline→h1→prose→CTA→3 stats and *no* illustration; the `vertical-*.svg` files are wireframe stubs with the word "PLACEHOLDER" baked in. 10 highest-intent pages open cold. | 4 | 4 | `VerticalHero.tsx:35-78`; rendered placeholder SVG |
| 4 | **Working branch has regressed the brand layer.** `plan/production-growth-2026-06-03` ships serif-"a" `app/icon.svg` + `public/favicon.svg`, only 3 wordmark SVGs in `public/brand/`, and `public/brand/og-image.svg` still says "the agentic operating layer for **the independent brokerage**" — the exact stale realty-only copy flagged 2026-06-07, contradicting locked "local businesses" positioning. No marketing file on this branch references the plaino-system assets. | 4 | 3 | `public/favicon.svg`; `public/brand/og-image.svg`; grep of `app/(marketing)/` |
| 5 | **Header brand is a word, not a face.** On this branch `Header.tsx` imports the wordmark-only `Logo`, not the ratified `LogoLockup` (head-icon + wordmark). Every page's top-left is pure serif text; the dog never greets you in the chrome. | 3 | 3 | `Header.tsx:2,42`; `Logo.tsx` |

---

## 3. Per-page / per-surface findings

**`/` home** (pixel evidence: `sprint-home-desktop-2026-06-09.jpeg`). Strong typographic hierarchy — mono eyebrow → large serif mission h1 → body, consistent rhythm across ~12 stacked `Section` blocks. But it is a **long scroll of near-identical text blocks**; the only visual relief is the heritage banner (live) + 2-3 small dog marks + the ROI calculator + the stat panel. At desktop the line-length on body copy is well controlled; the page's weakness is *monotony*, not chaos — every section looks like the last one. The "$199 → $99" / "143 / 43 / 10 / 12" stat panel reads as the single most "designed" moment and it's a wall of numbers with no visual support. **Score 3/5.**

**`/` home @ 375px** (pixel evidence: `mobile-375-home.jpeg`). Reflows cleanly, no horizontal scroll, the `<details>` mobile menu is a sound no-JS pattern. Same monotony issue, amplified — on a phone the all-text scroll is *very* long. Headlines scale down sensibly (`text-4xl md:text-6xl`). **Score 3.5/5** (responsive mechanics are good; the content density is punishing on mobile).

**`/pricing`.** Three-tier cards (Regular/Partner/Max) + ROI + comparison. Clear, honest, well-structured. Hero references `pricing-hero.svg` — still a placeholder. The seat-ladder table is information-dense but legible. **Score 3.5/5.**

**`/[vertical]` ×10 (real-estate etc.).** `VerticalHero` renders no art; the page is hero-text → value-loop → JTBD tables → ROI → claims grid → pricing banner → integrations → CTA, all type/table. Lead vertical (`/real-estate`) opens on "Built for independent real-estate brokerages" with no image. Highest-intent, lowest-craft surface. **Score 2.5/5.**

**`/about`, `/custom`, `/verticals`, `/inquiry-received`.** Text-only, on-brand-minimal, placeholder scenes never generated. Appropriate restraint for legal-adjacent copy but `/about` and `/custom` are exactly where a heritage scene would earn trust. **Score 3/5.**

**`/privacy` `/terms` `/security`.** Correctly sparse. Fine as-is. **Score 4/5.**

**`app.agentplain.com` (in-app).** Every Plaino is the `PlainoAvatar` geometric scaffold across dashboard, talk, approvals, onboarding, fleet. Token discipline carries over (same Paper/Ink system), so the *layout* feels consistent — but the *character* is a primitive line-doodle that looks nothing like the marketing hound. This is the cohesion break a paying customer feels every day. **Score 2.5/5.**

---

## 4. Strategic gaps

1. **No single canonical Plaino.** The brand has a heritage register (good), an 8-bit register (specced, not consistently shipped), AND a geometric-scaffold register (in-app) — three different dogs. Pick ONE master illustration and derive every size/pose from it. The 2026-06-06 ratification + the human-pixel-artist commission is the right plan; the gap is *execution discipline* — assets are landing piecemeal and off-spec.
2. **Trust is carried entirely by typography.** For a product that ingests a business's email, CRM, and financials, the site never *looks* like a secure system of record — there's no visual "vault/ledger/handled" motif, no proof imagery, no faces of the team or customers. Heritage-WPA is a strong trust vehicle; it's only deployed once.
3. **Marketing↔product visual contract is undefined.** No shared illustration system spans the seam. The token system spans it; the character system does not.
4. **Motion is entirely absent.** No transitions, no scroll reveals, no micro-interaction on the CTAs. For the minimalist style this is *defensible*, but it means the one lever that could relieve the text-wall monotony is unused.

---

## 5. Quick wins (≤1h each)

1. **Re-crop `head-icon.png`** to remove the "8. HEAD ICON" caption bleed. Pure embarrassment-removal; it's the favicon/avatar source.
2. **Fix `public/brand/og-image.svg` copy** — replace "the agentic operating layer for the independent brokerage" with the locked local-businesses line. Every link-share currently broadcasts stale realty-only positioning. (Same fix in `app/opengraph-image.tsx` if it duplicates.)
3. **Wire `LogoLockup` into `Header.tsx`** on this branch (it's already the ratified default elsewhere) so the dog appears in the chrome on every page.
4. **Replace the serif-"a" `app/icon.svg` + `public/favicon.svg`** on this branch with the 8-bit Plaino (assets exist on main) — stop shipping the placeholder tab icon.
5. **Update the `PlainoAvatar.tsx` header comment** — delete "the metaphor is NEVER disclosed to customers" (factually wrong since 2026-06-06) so the next engineer doesn't preserve a contradicted constraint.
6. **Trim the home stat panel** — the 4-number block (143/43/10/12) is the weakest "designed" moment; either give it a supporting motif or cut two stats.

## 6. Deep work (>1d, high impact)

1. **Commission/finish ONE canonical Plaino master in the ratified palette** (Ink-mostly body, single Clay collar tag, robot read present) and regenerate the full size/pose set from it — head-icon, 8-bit favicon family, in-app avatar (replace the scaffold), heritage hero. This single act closes issues #1, #2, and #5 and unifies the two faces. The human-pixel-artist commission is the right path; gate it on palette compliance.
2. **Give the 10 vertical pages real hero art** (the `vertical-*.svg` placeholders → real heritage vignettes from the per-vertical cheat-sheet already written in the 2026-06-07 audit). These are the highest-intent pages and currently the lowest-craft.
3. **Replace the in-app `PlainoAvatar` scaffold** with cropped poses from the canonical master, killing the marketing↔product character break — the cohesion fix that paying customers feel.
4. **Break home-page monotony** — introduce 2-3 heritage section scenes (crew/knowledge/future, prompts already written) so the long scroll has visual cadence instead of 12 identical text blocks.

## 7. What I'd cut

- **The naturalistic brown/tan fur** on the shipped dog assets — it breaks the palette discipline that makes everything else feel crafted. Recolor to Ink-mostly.
- **The `PlainoAvatar` geometric scaffold** entirely, once the canonical avatar lands — don't let two dog systems coexist.
- **Two of the four home stat-panel numbers** — the block is filler-shaped; fewer, supported stats read as more confident.
- **The 10 abandoned `logo-iterations/*.svg`** + the wireframe `placeholder` SVGs once real art lands — dead weight in `public/`.
- **Nothing structural.** Resist the urge to add gradients, shadows, or stock photography to "fix" the minimalism — the restraint is an asset; the fix is *character + a few scenes*, not more chrome.

---

## Appendix — findings below the customer-value bar (<4)

These are real but a $10K/mo-problem owner would not feel them as a blocker:
- **Brand asset crop artifacts** (sev 4 craft, cust-block 3) — embarrassing to a designer, invisible to most buyers until pointed out.
- **Stale OG copy** (cust-block 3) — only seen on social shares, not the primary funnel.
- **Header has no mark** (cust-block 3) — buyers don't bounce over a missing logo icon; it's a polish gap.
- **Working-branch regression** (cust-block 3) — an internal/process risk, not a customer-facing defect *today* (production is fine).
- **Motion absence** (cust-block 2) — a taste call, not a blocker; the style justifies it.

The two findings that genuinely clear the bar (cust-block 4): the **two-Plainos cohesion break** (erodes trust in a data product) and the **imageless vertical pages** (highest-intent surfaces open cold).

---

## Post-audit drift check (2026-06-11 EOD — main@47237e0, prod cabf36f)

The brand wave (#227–#234, merged 2026-06-10/11) materially changed this lens's picture:
- **FIXED:** Issue 2 (crop artifact + off-crop assets) — #231 re-cropped the full asset family (icons, apple-icon, mobile assets). Issues 1/5 (two incompatible Plainos, "NEVER disclosed" comment) — #232 shipped the ratified two-family system (PlainoMark for brand surfaces, PlainoStatus for live-state; `docs/brand/icon-families.md`); `PlainoAvatar` is now a deprecated shim delegating to PlainoStatus. Issue 4 (working-branch regression) — moot; main deploys again and carries the brand layer. Stale OG SVG copy — gone. Placeholder SVGs renamed/replaced as `motifs` (#234, brand-gate ZERO).
- **STILL OPEN:** Issue 3 — `VerticalHero.tsx` still renders no imagery (verified: zero motif/img references today); the 10 highest-intent pages still open cold. Homepage monotony (12 stacked text blocks) unchanged. The canonical heritage-register master illustration (Ink-palette) remains uncommissioned.

## Estimated effort to clear backlog
- **Quick wins:** mostly already landed via #227–#234 (~0h remaining).
- **Deep work:** vertical-page hero art 2–3d via creative-router (per the creative-assets rule — no improvised SVG); 2–3 heritage scenes for homepage cadence 1–2d; canonical master commission = external lead-time.
- **Total: 1 creative wave + 1 commission.** Lens moves 3 → ~4 once vertical heroes land; the brand-cohesion half of the gap is already closed.
