# AI Video Production Stack — agentplain, 2026-06-06

> Research + ranking of the AI video/media tools available now, then a recommended **one-tool-
> per-job** stack for producing the Wave-1 films (SCRIPTS/, STORYBOARDS/).
>
> **Citation discipline (`feedback_no_guesses_no_estimates.md`):** pricing/capability figures
> were verified against vendor pages on **2026-06-06**; anything not vendor-confirmed is marked
> *(secondary)* or *(unverified — last known)*. Confirm the live number before signing a PO.
>
> **Brand bar:** "Intelligence rooted in reality." The enemy is **AI-slop** — the over-glossy,
> uncanny, over-saturated synthetic look. Our rule: **AI for atmosphere and motion on top of
> real plates; never for the human faces or the product UI** (see PRODUCTION.md §2,
> DEMO_INTEGRATION.md). A heritage brand that ships obvious AI-slop contradicts its own thesis.

---

## TL;DR — the recommended stack (one tool per job)

| Job | Pick | Runner-up | Monthly cost (entry that unlocks commercial) |
|---|---|---|---|
| **Talking-head** (founder/operator) | **Tella** (real human, styled screen+cam) | HeyGen (only if scaled/multilingual avatars) | Tella Pro ~$19/mo |
| **B-roll / atmosphere** (storm, time-passage, texture) | **Adobe Firefly — Generative Extend on our real plates** | Runway Gen-4 (image-to-video) / Luma Ray2 | Firefly Std $9.99 / Runway Std ~$12 |
| **Product-motion / screen** | **Tella** (produced capture) + **Supademo/Arcade** (interactive) | Descript (screen + edit) | Tella ~$19 / Supademo Scale ~$38 |
| **AI voice (VO)** | **ElevenLabs** (distinct, grounded voice — not a default) | — | Creator $22/mo (commercial) |
| **Interactive demo** (landing + embeds) | **Supademo** (value) or **Arcade** (polish) | Storylane (enterprise sales) | Supademo Scale ~$38 / Arcade Pro ~$32 |
| **Final edit / captions** | **Descript** (transcript edit + captions) + **Premiere/Firefly** | Captions | Descript Creator ~$24/mo |

**Tools we deliberately avoid for brand-facing work:** Pika (effects-forward, highest slop
risk), Synthesia (most uncanny public avatars — fine for internal training only), and pure
**text-to-video Sora 2** for hero shots (visible moving watermark + glossy "AI-real" aesthetic).
See §"Watermark & licensing flags" — these are ad-compliance facts, not opinions.

**Estimated total stack run-rate:** ~**$120–$160/mo** across Tella + ElevenLabs + Descript +
Firefly + Supademo, plus a Runway/Luma seat (~$12–$30) only during B-roll sprints. Trivial
against the production budget (PRODUCTION.md §3) — the tools are not the cost; the craft is.

---

## Generative video models (text/image-to-video)

### Runway — Gen-4 / Gen-4.5 / Gen-3 Alpha
- **Best at:** the most *directable* cinematic motion — image-to-video, motion brush, camera
  control, Act-One performance capture. You can drive it with your own stills/plates instead of
  pure text, which is exactly how you avoid slop.
- **Cost (runwayml.com/pricing, 2026-06-06):** Free $0 (125 one-time credits, watermarked, no
  Gen-4). Standard **$12/mo annual** (625 cr/mo). Pro **$28/mo annual** (2,250 cr). Max
  **$76/mo annual** (9,500 cr). Credit burn ~25 cr/sec Gen-4.5 *(secondary)*.
- **Can't:** long single takes (5–10s clips, stitch for more); occasional morph/physics
  artifacts; credits drain fast on heavy use.
- **Brand fit:** **GOOD** — among the safest generative options *when fed real footage/stills*.
  Primary B-roll engine alongside Firefly.

### OpenAI Sora 2 / Sora 2 Pro
- **Best at:** physically coherent motion + synchronized native audio; consent-based "cameo"
  likeness. High realism.
- **Cost (help.openai.com + openai.com, 2026-06-06):** included in ChatGPT Plus **$20/mo** and
  Pro **$200/mo**; Sora 2 Pro model needs Pro ($200/mo). API ~$0.10/sec (720p) / Pro
  ~$0.30–$0.50/sec *(secondary)*. **API reported to stop accepting requests 2026-09-24** —
  verify before building on it.
- **Can't:** escape the provenance signals (below); waitlist/guardrails on likeness/IP.
- **Max:** up to ~1080p, ~20s (Pro ~25s *(secondary)*).
- **Brand fit / AD FLAG:** **CAUTION.** Standard output carries a **visible moving watermark +
  C2PA provenance**. The visible mark is a real problem for paid ads, and the aesthetic leans
  glossy. Use only for non-hero ideation, if at all.

### Google Veo 3 / 3.1 (Flow / Gemini / Vertex)
- **Best at:** native audio + dialogue, strong prompt adherence, clean 1080p.
- **Cost (developers.googleblog.com, 2026-06-06):** API **Veo 3 $0.40/sec, Veo 3 Fast
  $0.15/sec**; consumer Google AI Pro **$19.99/mo**, Ultra **$249.99/mo** *(secondary)*.
- **Can't:** ~8s per generation (chain for longer); credit-metered.
- **AD FLAG:** **every** Veo output carries an **invisible SynthID watermark** (automatic,
  non-removable). No *visible* mark, so less brand-damaging than Sora — but disclose-if-asked.
- **Brand fit:** MODERATE — clean but can read synthetic; usable for controlled B-roll.

### Kling 2.x/3.0, Pika 2.2, Luma Dream Machine (Ray2)
- **Kling (Kuaishou):** top-tier raw human motion/physics; tiers ~$6.99–$180/mo *(secondary,
  unverified)*; data-residency/governance considerations; **distinct hyper-smooth "Kling look" —
  moderate-to-high slop risk.** Use sparingly, tightly art-directed.
- **Pika 2.2:** fast, fun, effects-driven social clips; prices *(unverified — last known ~$8/$28/
  $76 bands)*. **High slop risk — AVOID for this brand.**
- **Luma Ray2:** smooth, natural *camera motion* + 4K upscale path; **Plus $30/mo unlocks
  commercial use** (free tier is non-commercial); Pro $90, Ultra $300. **Brand fit: GOOD** —
  naturalistic camera work; the runner-up B-roll engine to Runway.

---

## AI avatars / talking-head

### HeyGen
- **Best at:** realistic talking-head avatars, custom avatars, 175+ language dubbing with
  lip-sync — i.e. scaled/personalized/multilingual video.
- **Cost (heygen.com, 2026-06-06):** Free (3 videos, watermark). Creator **$29/mo** (unlimited
  videos, 200 cr — but premium avatar minutes are credit-limited, ~10 min Avatar IV/mo). Pro
  **$99/mo**. Business **$149/mo + $20/seat** (4K). **Creator+ = commercial, no watermark.**
- **Brand fit:** MODERATE — improving but can read "corporate AI presenter." Use only if we need
  avatars at scale or in multiple languages; **prefer a real human (Tella) as the brand face.**

### Synthesia
- **Best at:** enterprise L&D/training at scale (SCORM, SSO, governance), 240+ avatars.
- **Cost (synthesia.io, 2026-06-06):** Free (10 min, watermark). Starter **$29/mo** (~10 min).
  Creator **$89/mo** (30 min). Enterprise custom.
- **Brand fit:** **POOR for public-facing heritage work** — the most clearly-synthetic
  presenters of the avatar tools. Internal training only.

### Captions / Mirage (captions.ai)
- **Best at:** mobile-first short-form talking-head + AI editing + auto-captions + voice clone.
- **Cost (captions.ai, 2026-06-06):** Free (lifetime credits). Pro **$9.99/mo** (no generative
  AI — editing only). Max **$24.99/mo** (AI avatars + clone). Scale **$69.99/mo**.
- **Brand fit:** MODERATE — social-creator aesthetic; useful for P5 Reels captioning, not hero.

---

## AI voice — ElevenLabs (the pick)
- **Best at:** best-in-class TTS realism + voice cloning + multilingual dubbing.
- **Cost (elevenlabs.io, 2026-06-06):** Free 10k cr (~10 min, **non-commercial**). Starter
  **$5/mo** (commercial). Creator **$22/mo** (100k cr, pro cloning). Pro **$99/mo**.
- **Brand fit:** **BEST voice pick.** The risk is the recognizable "default ElevenLabs narrator"
  timbre — kill that risk by **selecting or cloning one distinctive, grounded voice** (per the VO
  guides in SCRIPTS/: warm, dry, regional, unhurried) and using it consistently as the brand
  voice. Creator tier for commercial rights.

---

## Edit / screen / product-motion

### Tella (the screen+cam pick)
- **Best at:** beautiful, brand-styled **screen + camera** video (backgrounds, layouts, zoom),
  AI filler-word removal, 4K. Records a *real* person and a *real* screen with tasteful styling.
- **Cost (tella.com, 2026-06-06):** no free plan (7-day trial). Pro **$19/mo annual** (unlimited,
  4K). Premium **$49/mo** (custom branding/domain).
- **Brand fit:** **EXCELLENT / most grounded.** This is our talking-head AND produced-screen
  tool — a real founder/operator and the real product, on-brand, zero uncanny risk.

### Descript (the edit/caption pick)
- **Best at:** edit-by-transcript, filler removal, overdub, multitrack, captions.
- **Cost (descript.com, 2026-06-06):** Free (1 hr/mo). Hobbyist **$16/mo**. Creator **$24/mo**.
  Business **$50/mo**. *(Sept-2025 switch to "media minutes" makes bills less predictable.)*
- **Brand fit:** NEUTRAL/safe — it's an editor, not a generator. Pairs with Premiere + Firefly
  Generative Extend for finishing.

### Adobe Firefly Video — Generative Extend (the safest generative move)
- **Best at:** **lengthening our own real clips 2–5s** and Adobe-ecosystem generation, inside
  Premiere.
- **Cost (adobe.com, 2026-06-06):** Firefly Standard **$9.99/mo** (2,000 cr). Pro **$19.99/mo**.
  Premium **$199.99/mo**. Video burn 20 cr/sec (540p) → **100 cr/sec (1080p)**.
- **AD STRENGTH:** trained on **licensed/Adobe Stock data → commercially-safe, indemnified
  output**, all carrying **Content Credentials (C2PA)** — the **cleanest licensing posture** of
  any generative model here. Generative Extend on *our real plates* is the single most
  heritage-brand-safe generative technique in this whole list. **Primary B-roll/finishing move.**

---

## Interactive product demos

> These capture the **real agentplain UI** as a clickable walkthrough — inherently grounded,
> zero slop risk. Used two ways (DEMO_INTEGRATION.md): embedded as motion inside the films, and
> as the `/promo/[slug]` landing-page CTA ("click through the actual product").

- **Supademo (value pick)** — Free (5 demos); Pro **$27/user/mo**; Scale **$38/creator/mo**
  (unlimited, custom branding, AI voiceover); Growth **$350/mo** (HTML). *(supademo.com, 2026-06-06)*
- **Arcade (polish pick)** — Free (3 demos); Pro **$32/user/mo**; Growth **$297.50/mo (5 seats)**.
  Best AI features + polish. *(arcade.software, 2026-06-06)*
- **Storylane (enterprise sales)** — Starter **$40/user/mo**; Growth **$500/mo**; Premium
  **$1,200/mo** (Lily AI). *(secondary — storylane.io, 2026-06-06)*. Only if sales-led with demo
  analytics; overkill for Wave 1.
- **Loom (Atlassian)** — async screen capture; Business **$15/user/mo**, +AI **$20–$24/user/mo**.
  *(atlassian.com, 2026-06-06)*. Fine for quick internal/dev captures; less produced than Tella.

---

## Watermark & licensing flags (ad-compliance — read before generating any frame)

| Tool | Provenance / watermark | Commercial use | Implication for our ads |
|---|---|---|---|
| **Sora 2** | **Visible moving watermark** + C2PA on standard output | via ChatGPT plans | Visible mark is disqualifying for hero shots — avoid |
| **Veo 3/3.1** | **Invisible SynthID on ALL output** (non-removable) | API/consumer tiers | Usable; disclose AI origin if asked |
| **Firefly Video** | Content Credentials (C2PA) | **Indemnified, commercially-safe training data** | Cleanest posture — preferred generative tool |
| **Runway / Luma** | Watermark on free tier only | paid tiers (Luma needs Plus+) | Pay for the tier; drive with real plates |
| **HeyGen / ElevenLabs / Tella / Descript / demos** | No watermark on paid | paid tiers commercial | Clean for ad use |

**Standing rule:** no human face and no product screen is ever AI-generated. AI touches weather,
texture, time-passage, and motion-on-real-plates only. That keeps every brand claim — and the
brand thesis — literally true.
