# Design-mirror — what makes a brand feel human, not AI (2026-06-19)

**Purpose.** agentplain's visual surface was flagged as feeling "generic-SaaS-AI." This study mirrors 7 brands that read as unmistakably *human* — heritage, made-by-people, rooted — and extracts the specific moves we can borrow into our existing heritage-editorial system. It is item 2 of the 4-part de-AI-fication.

**Method + IP note.** This is **principle extraction, not asset extraction.** Per the IP-protection rule (`memory/project_ip_protection_2026_06_17.md`) and the explicit "don't copy any brand's visual IP" constraint, no brand's CSS, fonts, color values, illustrations, or photography were copied. The findings below describe *patterns and design decisions* — the kind of thing a designer reads off a page and reasons about — drawn from these brands' public sites and published design documentation, mapped to our own already-ratified tokens (`lib/brand/tokens.ts`, `app/globals.css`, `docs/product-design-language-2026-05-17.md`). Where a brand's move conflicts with our locked palette or square-corner rule, we adapt the *principle*, never the asset.

**Headline finding.** Our system is already far more anti-SaaS than the brief assumed: square corners, no shadows, hairline rules, Fraunces + Inter + JetBrains Mono, paper/ink/clay, a no-spinner loader, a named character (Plaino). The "generic AI" smell is **not** in the tokens — it's in three thinner places:
1. **Tonal flatness.** One paper, one accent, charged identically on every block — so the eye never finds an editorial focal point. Human brands modulate *temperature and weight*, not just hue.
2. **Even rhythm.** Every section is the same height with the same header block. Editorial pages breathe unevenly — a tight run of facts, then a full-bleed pause.
3. **No "made-by-a-person" tells.** No drop-cap, no pull-quote, no margin note, no consistent photo grade, no ledger/figure framing. These artifacts are what the eye reads as "a human laid this out," and they're exactly what generative-template SaaS never bothers with.

The token + component work in this PR addresses all three **additively** — nothing existing is restyled.

---

## Per-brand findings

Each brand: **what it does that reads HUMAN**, **the generic-SaaS pattern it refuses**, **what we borrow.**

### 1. Linear — restraint as confidence

**Human tells.**
- One real accent against a near-monochrome field; color is *spent*, not sprayed. The product looks expensive because it withholds.
- Type does the hierarchy — tight tracking on large display, generous line-height on body — rather than boxes, badges, and color blocks.
- Motion is purposeful and short (state changes, not decoration). Nothing pulses or floats for its own sake.
- Crisp 1px keylines define structure instead of drop-shadow "cards floating in space."

**Refuses.** Stock hero illustrations of diverse-people-at-laptops; gradient-blob backgrounds; the 12-card KPI wall; rounded-everything.

**Borrow.** We already hold this discipline — codify it as a *positive* rule, not just a prohibition: **one clay charge per view, hierarchy carried by type weight and rule, not by fills.** Linear validates our existing instinct; the gap is we don't yet have an *editorial focal* device to spend that one charge on. (→ pull-quote + clay-wash band.)

### 2. MUJI — warmth through tonal layering, never shadow

**Human tells.**
- Off-white on off-white. Surfaces separate by a *half-step of warmth/value*, not by a shadow or a border — the page feels like layered paper stock, calm and tactile.
- Enormous, unhurried whitespace; a single object photographed honestly on a neutral ground.
- Product-as-hero photography with one consistent soft, warm grade — no two images fight.
- Near-total absence of accent color; the goods (and the paper) are the palette.

**Refuses.** Glossy gradients; high-saturation CTAs; "lifestyle" stock with smiling models; busy grids.

**Borrow.** A **`paper-bright` raised surface** (a half-step *up* from paper) so a card can lift off the page with zero shadow and zero heavier border — pure MUJI tonal layering, fully compatible with our no-shadow rule. And a **consistent warm photo grade** (`.img-heritage`) so any real photography we ever ship reads as one hand shot it.

### 3. Patagonia — heritage, place, and a real human voice

**Human tells.**
- **Photography of actual places and actual people doing real work** — grainy, weathered, sometimes imperfect. The opposite of a rendered hero.
- Earth palette: stone, slate, ochre, deep forest — colors that exist in dirt and light, not in a Figma swatch picker.
- Long-form, first-person, opinionated copy that trusts the reader. Essays, field notes, a footer that talks like a person.
- Founder presence; the brand has a point of view and a history it references.

**Refuses.** Aspirational SaaS abstraction; "empower your workflow"; faceless corporate neutrality.

**Borrow.** This is our nearest cousin (plains/heritage/service-partner, the locked mission line is already first-person and opinionated). Two concrete pulls: a **deep `forest` field tone** (#1F3D2E — names the directive's "forest") for a grounded full-width pause band, and the **field-note device** — a margin-set, mono-labelled aside that reads like a person annotated the page (→ `.field-note`). Plaino is our "founder presence"; lean on the heritage photo, graded.

### 4. Stripe (early, ~2014–2017) — engineering credibility through precision

**Human tells.**
- Obsessive alignment and a real baseline grid; everything sits on a system, and you can feel it.
- Code samples and real numbers shown as *figures* — monospace, framed, captioned — treated as first-class editorial objects, not afterthoughts.
- Restrained palette, one indigo accent, generous quiet; documentation that respected the reader's intelligence.
- Diagrams drawn by hand-of-a-designer, specific to the actual product, never generic clip-art.

**Refuses.** Marketing fluff over substance; decorative iconography; "AI magic" hand-waving.

**Borrow.** The **figure/ledger frame**: a `.ledger` card variant that frames a stat, a draft, or a code line as a captioned monospace figure with a hairline header — Stripe's "we show you the real thing" credibility, in our paper/ink language. We have JetBrains Mono and the no-outbound architecture full of real artifacts (PENDING rows, confidence scores) begging to be shown as figures, not prose.

### 5. Mailchimp (pre-Intuit, ~2018) — weird, warm, hand-made

**Human tells.**
- **Hand-drawn illustration** with visible imperfection — wonky line, off-register fill. A human clearly drew Freddie; no two illustrations are vector-perfect clones.
- A real, idiosyncratic secondary palette (Cavendish yellow) deployed sparingly and confidently against a near-black/cream base — odd, ownable, *not* a SaaS blue.
- Generous, asymmetric, editorial layout — text set in a real measure, big confident headlines, room to breathe.
- Voice with personality and humor (the "Voice & Tone" guide is itself a landmark of human brand-writing).

**Refuses.** Vector-perfect "corporate Memphis" illustration; safe blue/teal; symmetrical centered everything.

**Borrow.** Two pulls. First, the **idiosyncratic warm accent**: a heritage **`wheat`** harvest gold (#C8A24A) as a *rare* second accent — the agentplain equivalent of Cavendish yellow, used once per long page at most (a harvest eyebrow, a single marker). Flag for Conner; clay stays primary. Second, the **drop-cap** — a single human typographic flourish at the head of a long editorial passage (→ `.drop-cap`), the cheapest "a person set this type" signal there is.

### 6. Heritage Americana — Filson / Pendleton / Yeti / REI / Coors Banquet

**Human tells.**
- **Materials and provenance**: waxed canvas, wool plaid, the year founded stamped on the label. The design references a craft and a place.
- Earthy, slightly desaturated palettes — buffalo-plaid red, harvest gold, forest, stone, denim. Warm, not neon.
- Serif/slab wordmarks, letterpress textures, badge/seal lockups, "est. 18xx" mono datelines. The typography itself is a heritage artifact.
- Real photography of land, tools, weather, hands — never abstract.

**Refuses.** Gradients, glow, gloss, sans-everything minimalism stripped of warmth, "tech startup" sterility.

**Borrow.** This is the visual heart of our positioning and we under-use it. Pulls: the **dateline / seal device** (a mono "est." or "rooted in reality" stamp treatment we can apply in chrome and the style guide), the **earth-tone support palette** (forest + wheat + clay-wash, all desaturated and dirt-real), and confidence in **warm desaturation** as the photo grade rather than clean-bright. The plaid/wax texture itself we keep as *restraint* — a hairline and a warm ground evoke it without literal texture.

### 7. Robot-dog precedents — Boston Dynamics / Sony Aibo

**Human tells.**
- Boston Dynamics shows Spot **doing real work in real, slightly messy environments** (a construction site, a factory floor) — credibility through reality, not a render on a white cyclorama.
- Aibo's legacy charm: the character is given **honest, restrained personality** — a pose, a tilt of the head, a moment of rest — not anthropomorphized into a cartoon with a face full of expression. The warmth comes from *behavior and posture*, not googly eyes.
- Captioned, documentary framing — "here is the machine, here is what it does."

**Refuses.** The "AI orb" / glowing-brain mascot; the over-cute cartoon orb that pulses in the corner.

**Borrow.** Direct validation of the Plaino system (`docs/brand/plaino-system.md`): personality through **pose**, not expression — standing-watch, fetching, resting. The pull is to **use Plaino's poses as functional persona moments**, especially the one place we currently fall back to a generic device: **loading.** A resting/scouting Plaino beside the hairline loader strip turns a dead spinner-slot into a character beat (→ `ApPlainoLoader`). And keep the documentary caption discipline (our hero already does this — `<figcaption>` mono caption).

---

## Common patterns across all seven

What the human brands share, stated as rules:

1. **Spend color, don't spray it.** One charged accent per view; everything else is substrate. (Linear, MUJI, Stripe, Patagonia)
2. **Separate surfaces by warmth/value, not by shadow.** Tonal layering reads as paper stock; shadow reads as Material/SaaS. (MUJI, heritage)
3. **Earth, not neon.** The support palette comes from dirt, wheat, and forest light — desaturated, warm. (Patagonia, heritage, Mailchimp)
4. **Show the real thing as a figure.** Real photos graded consistently; real numbers framed in mono and captioned. Credibility over abstraction. (Stripe, Patagonia, Boston Dynamics)
5. **Leave a human fingerprint.** Drop-cap, pull-quote, margin note, hand-drawn mark, an odd confident accent — one artifact per page that a template would never produce. (Mailchimp, Patagonia, heritage)
6. **Uneven rhythm.** Editorial pacing — tight fact runs, then a full-bleed pause band. Not N identical section blocks. (all)
7. **Character through posture, not a face.** Restraint is what makes warmth credible. (Aibo, Boston Dynamics — and our own Plaino rule §10.3)

---

## To-borrow list → what ships in this PR

All additive. Nothing existing is restyled; new tokens registered through the canonical channel (`tokens.ts` → `globals.css` → `tailwind.config.ts` → `brand-gate.mjs`) so CI stays green.

| # | Borrowed from | Ships as | Type |
|---|---|---|---|
| 1 | Patagonia / heritage | `forest` #1F3D2E deep-field tone | new token |
| 2 | Mailchimp / heritage | `wheat` #C8A24A rare harvest accent (Conner-gated) | new token |
| 3 | MUJI | `paper-bright` #FCFAF4 raised surface (no-shadow lift) | new token |
| 4 | Mailchimp / Linear | `clay-wash` #F3E7E0 highlight-band tint | new token |
| 5 | heritage | `mid-rule` #D9D5C7 stronger hairline (already gate-known; now tokenized) | new token |
| 6 | MUJI / Patagonia | `.img-heritage` consistent warm photo grade | utility |
| 7 | Mailchimp | `.drop-cap` editorial initial | utility |
| 8 | Linear / Mailchimp | `ApPullQuote` clay-wash editorial pull-quote | component |
| 9 | Patagonia | `.field-note` margin-set mono aside | utility |
| 10 | Stripe | `ApPaperCard` `variant="ledger"` figure frame | component variant |
| 11 | heritage | `ApHeritageButton` `size="lg"` confident CTA + `tone="wheat"` | component variant |
| 12 | Aibo / Boston Dynamics | `ApPlainoLoader` — pose-led loading persona moment | component |
| 13 | all | `/style` guide — tokens + components + "Generic SaaS does X, we do Y" | surface |

**Spacing / rhythm.** No token churn needed — our 8px scale and the Wave-A3 `py-16/md:py-24` cadence are correct. The fix for "even rhythm" is *usage*, demonstrated on `/style`: alternate `tone="deep"`, `forest` full-bleed pauses, and clay-wash bands between fact runs rather than restyling `Section`. Documented, not enforced, so existing pages are untouched.

**Typography.** Fraunces + Inter + JetBrains Mono stay. The refinement is exploiting Fraunces' `opsz` axis we already load (broadsheet display vs. readable small) plus the new `.drop-cap` and pull-quote — surfacing range we paid for but never used.

---

## What we deliberately did NOT borrow

- **No gradients, glow, glassmorphism** (Linear/Stripe modern era flirt with subtle versions — off-limits per design-language §5.1).
- **No literal plaid/wax/letterpress texture** — heritage *evoked* by warm ground + hairline + mono dateline, not a texture asset (keeps payload light, keeps the square/flat discipline).
- **No rounded corners** even where MUJI/Mailchimp soften — our square rule is load-bearing brand equity.
- **No second display face** — one idiosyncratic accent (wheat) is enough fingerprint; a second font would dilute, not distinguish.
- **No mascot face / AI orb** — Plaino's restraint (pose, not expression) is the whole point; confirmed by the robot-dog precedents.

---

## Changelog
- 2026-06-19 — v1. Seven-brand mirror; 13-item to-borrow list; ships alongside the additive token + component work in the same PR. Author: de-AI-fication wave, item 2 of 4.
