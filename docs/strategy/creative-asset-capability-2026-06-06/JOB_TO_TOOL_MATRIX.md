# Job → Tool Routing Matrix — agentplain creative assets, 2026-06-06

> **The rule this table enforces:** an agent picks the **right tool** for a
> creative job, or routes it to a **human creator** — it does **not** improvise
> the asset in raw SVG/PNG (`feedback_creative_assets_use_tools_or_humans`).
> Every creative request goes through `media-creative-router`, which reads this
> matrix.
>
> **Status legend:**
> `[ready]` self-contained skill, works today · `[installed]` plugin on disk ·
> `[needs-connection]` listed but no MCP/plugin connected this session (see
> `SKILL_AUDIT.md`) · `[human]` brand-defining — goes to `CreatorBrief` ·
> `[external]` a named SaaS in the video stack, not a harness skill.

---

## The 20 jobs

| # | Job | Primary tool | Fallback | Status | Output | Notes |
|---|---|---|---|---|---|---|
| 1 | **Brand mark / logo / app icon** | **Human creator** | `figma-generate-design` for *exploration only* | `[human]` | SVG/PNG/ICO | The job that caused this whole effort. Brand-defining → `CreatorBrief` kind `BRAND_MARK`. Agents may scout directions; the deliverable is a human's. |
| 2 | **Mascot illustration (Plaino poses)** | **Human creator** | `algorithmic-art` for pixel-grid *studies* | `[human]` | SVG/PNG | Character consistency is brand-defining → `CreatorBrief` `MASCOT_ILLUSTRATION`. The 8-bit pipeline (`tools/brand/gen-8bit.mjs`) can *place* an approved sprite; it cannot *design* a new pose to bar. |
| 3 | **Vertical landing-page hero illustration** | **Human creator** | `canvas-design` if abstract/atmospheric only | `[human]` | SVG/PNG/WebP | Figurative hero = brand-defining → `CreatorBrief` `HERO_ILLUSTRATION`. Abstract texture/pattern hero may go to `algorithmic-art`. |
| 4 | **Landing-page hero *layout* (type + UI)** | `frontend-design` | `canvas-design` | `[installed]` | React/Tailwind | The *composition + UI* around the hero — agent territory. Distinct from the illustration in it. |
| 5 | **OG image per vertical** | `canvas-design` → PNG | `web-artifacts-builder` HTML→render; `adobe-create-social-variations` | `[ready]` | PNG 1200×630 | Templated, type-driven, repeatable. No human needed unless it embeds a hero illustration (then job #3 feeds it). |
| 6 | **Diagram / architecture visual** | `figma-generate-diagram` | `canvas-design`; mermaid in-repo | `[needs-connection]` → `[ready]` fallback | Figma / SVG/PNG | Figma is the bar once connected; `canvas-design` is the today-answer. |
| 7 | **Sales / investor / customer deck** | `anthropic-skills:pptx` | `figma-use-slides` | `[ready]` | `.pptx` | Real editable deck. **Never** screenshot slides. Content from `marketing:*` / `sales:create-an-asset`. |
| 8 | **One-pager / sell-sheet** | `anthropic-skills:docx` or `pdf` | `adobe-design-from-template` | `[ready]` | `.docx`/`.pdf` | Editable doc; print path via `pdf`. |
| 9 | **ROI calculator / model** | `anthropic-skills:xlsx` | `flatsbo-b2b-sales-roi` skill | `[ready]` | `.xlsx` | Numbers real or labelled (`feedback_no_guesses_no_estimates`). |
| 10 | **Social post — single (LinkedIn/IG/X)** | `adobe-design-from-template` | `canvas-design`; `small-business:canva-creator` | `[needs-connection]` → `[ready]` fallback | PNG | Copy from `media-copywriter-*`. Compose only — **do not auto-publish** (`project_no_outbound_architecture`). |
| 11 | **Social variations (one design → all placements)** | `adobe-create-social-variations` | `adobe-resize-photos-and-videos`; manual `canvas-design` | `[needs-connection]` | PNG set | The per-placement fan-out. High-value once Adobe connected. |
| 12 | **Email template** | `frontend-design` (HTML email) | `marketing:email-sequence` for copy | `[installed]` | HTML | Render/lint for email clients. Sending is **customer-side**, never ours. |
| 13 | **Marketing video / sizzle / cutdowns** | Video stack (Tella/Firefly/Descript) | `adobe-edit-quick-cut` | `[external]` | MP4 | Routes to `AI_VIDEO_STACK.md` via `media-video-producer`. No AI faces/UI. |
| 14 | **AI voiceover** | ElevenLabs (distinct cloned voice) | — | `[external]` | audio | `media-voice-producer`. Commercial tier only. |
| 15 | **Interactive product demo** | Supademo / Arcade | Tella produced capture | `[external]` | embed/HTML | Captures the **real** UI — zero slop. `DEMO_INTEGRATION.md`. |
| 16 | **Product UI mockup** | `frontend-design` | Figma once connected | `[installed]` | React/HTML | Build the real thing, screenshot it — never AI-generate UI. |
| 17 | **Screenshot annotation** | `Claude_in_Chrome` / `Claude_Preview` capture → `canvas-design` markup | `pdf` annotate | `[ready]` | PNG/PDF | Capture real product, annotate. |
| 18 | **Team headshots / photo retouch** | `adobe-retouch-portraits` / `adobe-batch-edit-photos` | photographer (`PHOTOGRAPHY_DIRECTION` brief) | `[needs-connection]` / `[human]` | JPEG/WebP | **Edits real photos; never synthesizes a face.** New shoot = `CreatorBrief` `PHOTOGRAPHY_DIRECTION`. |
| 19 | **Print collateral (flyer, event banner)** | `adobe-design-from-template` | `anthropic-skills:pdf`; `[human]` for hero pieces | `[needs-connection]` / `[human]` | PDF/X | Brand-defining print (e.g. a booth) → `CreatorBrief` `PRINT_COLLATERAL`. |
| 20 | **Motion ident / logo animation** | **Human creator** | Firefly on approved mark | `[human]` | MP4/Lottie | Animating the brand mark is brand-defining → `CreatorBrief` `MOTION_IDENT`. |
| 21 | **SEO structured data (JSON-LD / OG meta)** | `searchfit-seo:schema-markup` / `flatsbo-seo` | `generate-schema` | `[ready]` | JSON-LD | Bonus row — the machine-readable side of "creative." |
| 22 | **Vertical visual sub-theme** | `theme-factory` | `anthropic-skills:brand-guidelines` adapted to our tokens | `[ready]` | tokens/CSS | Core brand is locked; this is for *within-brand* vertical accents only. |

---

## The brand-defining set → `CreatorBrief`

Six job-kinds are **always** human, mapped 1:1 to `CreatorBriefKind`
(`prisma/schema.prisma`):

| Job | `CreatorBriefKind` |
|---|---|
| Brand mark / logo / app icon | `BRAND_MARK` |
| Hero illustration (figurative) | `HERO_ILLUSTRATION` |
| Mascot illustration (Plaino) | `MASCOT_ILLUSTRATION` |
| New photography shoot direction | `PHOTOGRAPHY_DIRECTION` |
| Motion ident / logo animation | `MOTION_IDENT` |
| Brand-defining print (booth, signage) | `PRINT_COLLATERAL` |
| anything else that's brand-defining | `OTHER` |

For these, the router calls `createDraftBrief(...)` (`lib/creative-handoff`),
which assembles the brand tokens + references + delivery spec + acceptance
criteria into a portable packet and lands a `DRAFT` at
`/operator/creative-briefs`. **No agent renders the final asset.**

---

## The decision the router runs (in order)

1. **Is the job brand-defining?** (mark, mascot, figurative hero, new shoot,
   motion ident, hero print) → **`[human]` → `CreatorBrief`.** Stop.
2. **Is there a `[ready]` self-contained skill for it?** → use it. (decks,
   docs, OG, layout, ROI, schema, sub-themes, screenshot markup.)
3. **Is the right tool `[needs-connection]`?** → either **(a)** stand up the
   connection (install plugin + auth MCP) if the job recurs, or **(b)** use the
   listed `[ready]` fallback for a one-off. **Never** silently fall through to
   raw-SVG improv.
4. **Is it video/voice/demo?** → route to the **video stack** via the
   respective `media-*` maker.
5. **Still no tool meets the bar?** → `CreatorBrief` with
   `routedReason: "no-tool-meets-bar"`. A human decides, not a `zlib` loop.
