# Creative-Asset Skill + MCP Audit — agentplain, 2026-06-06

> **Why this exists.** Dispatch spent 350+ agent turns hand-coding pixel-art logo
> iterations in raw SVG/PNG (Node `zlib`) because no skill or pipeline was wired
> up for "make a brand asset." We hit a craft ceiling and shipped something
> Conner rejected. The fix is system-level: know what tools exist, route each job
> to the right one, and hand brand-defining work to a human. This is the audit.
>
> **Citation discipline (`feedback_no_guesses_no_estimates.md`).** Every access
> claim below is verified against an artifact and dated. Where a skill's body is
> not readable on disk, its job is **inferred from the skill name** and labelled
> as such — never asserted as if read.

---

## The headline finding (verified)

The harness surfaces a **large creative-skill roster** (the `figma:*`,
`adobe-for-creativity:*`, `anthropic-skills:*`, `postiz:*`,
`small-business:canva-creator`, `design:*`, `searchfit-seo:*` entries in the
session's available-skills list — all callable via the `Skill` tool). **But:**

1. **Only 8 plugins are materialized on disk.** Verified against
   `C:\Users\conne\.claude\plugins\installed_plugins.json` (read 2026-06-06):
   `typescript-lsp`, `commit-commands`, `context7`, `security-guidance`,
   `code-review`, `frontend-design`, `github`, `playwright`. **None of the
   creative plugins (figma, adobe-for-creativity, anthropic-skills, postiz,
   small-business, design, searchfit-seo) are installed-to-disk** — their
   `SKILL.md` files cannot be opened, so per-field capability specs can't be
   cited from source.
2. **No design-tool MCP server is connected this session.** Verified against the
   session's connected-MCP list (2026-06-06): present are `computer-use`,
   `context7`, `desktop-commander`, `pdf-viewer`, `playwright`, `Claude_Preview`,
   `Claude_in_Chrome`, `sanity`, `vanta`, `bio-research`, `mcp-registry`,
   `zapier`, `scheduled-tasks`. **Absent:** any `figma`, `adobe`, `canva`, or
   `postiz` MCP. So the MCP-backed design skills are *listed* but have **no live
   backend in this session**.

**What that means in one line:** the **self-contained generation skills**
(`anthropic-skills:*`, `frontend-design`) work *today* with zero auth; the
**pro design-tool skills** (figma/adobe/canva/postiz) are *invocable but
unconfigured* — they need their plugin installed **and** their MCP authenticated
before they produce anything; and **brand-defining craft still belongs to a
human** regardless of tooling (see `JOB_TO_TOOL_MATRIX.md`).

---

## Tier 1 — Self-contained generation skills (usable now, no external auth)

These run inside the harness and emit files locally. They are the **default
reach** for most non-brand-defining jobs and they have **no connection
dependency**. (Bodies not on disk; job column reflects the roster description
where one exists, else the skill name — marked.)

| Skill | Job it solves | Output | Access status | Quality ceiling / notes |
|---|---|---|---|---|
| `anthropic-skills:canvas-design` | Composed visual design on a canvas (posters, social, layout) *(from name)* | PNG/SVG/HTML artifact | **Ready** — self-contained | Strong for laid-out compositions with type + shape. Not a substitute for a designed brand mark. |
| `anthropic-skills:brand-guidelines` | Applies a brand's official colors + typography to an artifact (roster-described) | Styled artifact | **Ready** — self-contained | Built around *Anthropic's* look-and-feel; for **our** brand it's a pattern to adapt, feeding it our `lib/brand/tokens.ts`, not a turnkey agentplain styler. |
| `anthropic-skills:theme-factory` | Generates a cohesive visual theme / palette + type system *(from name)* | Theme tokens / CSS | **Ready** — self-contained | Good for *exploring* a system; our v0 brand is locked (`project_brand_locked`) so use for vertical sub-themes, not the core brand. |
| `anthropic-skills:algorithmic-art` | Generative / algorithmic art + patterns *(from name)* | SVG/PNG/code | **Ready** — self-contained | Backgrounds, textures, generative motifs. **Not** figurative illustration or a mascot. |
| `anthropic-skills:web-artifacts-builder` | Builds interactive web artifacts (HTML/JS) *(from name)* | Self-contained HTML | **Ready** — self-contained | Best for interactive one-pagers / micro-demos; overlaps `frontend-design`. |
| `anthropic-skills:pptx` | Generates PowerPoint decks (roster: pptx) | `.pptx` | **Ready** — self-contained | **The right tool for sales/investor/customer decks.** Real editable PPTX, not screenshots. |
| `anthropic-skills:docx` | Generates Word documents | `.docx` | **Ready** — self-contained | One-pagers / sell-sheets as editable docs. |
| `anthropic-skills:pdf` | Generates / fills PDFs | `.pdf` | **Ready** — self-contained | Print-ish collateral, form fills. Pairs with `pdf-viewer` MCP (connected) for review. |
| `anthropic-skills:xlsx` | Spreadsheets (ROI calculators, models) | `.xlsx` | **Ready** — self-contained | Not visual creative, but the ROI sell-sheet engine. |
| `frontend-design` *(installed)* | High-craft front-end UI/component design | React/Tailwind/HTML | **Ready — installed on disk** | The one creative plugin actually installed. Our reach for landing-page hero **layout** + UI polish (not illustration). |
| `anthropic-skills:web-artifacts-builder` + `canvas-design` together | OG image generation via composed HTML→render | PNG | **Ready** | A viable **OG-image-per-vertical** path that does not need Figma. |

## Tier 2 — MCP-backed design-tool skills (listed, NOT configured this session)

These are the professional design pipelines. Each needs **(a)** its plugin
installed to disk **and (b)** its MCP server authenticated. Neither is true
today. Jobs inferred from skill name; **do not invoke expecting output until the
connection is stood up.**

| Skill | Job it solves *(from name)* | Output | Access status (2026-06-06) | Notes |
|---|---|---|---|---|
| `figma:figma-generate-design` | Generate a Figma design from a prompt | Figma file | **Unconfigured** — no figma MCP connected | The closest thing to a real "design a thing" pipeline. Highest-value Tier-2 reach once connected. |
| `figma:figma-create-new-file` | Create a new Figma file/canvas | Figma file | **Unconfigured** | Scaffolds the workspace a designer (human or agent) then works in. |
| `figma:figma-generate-library` | Generate a component/design-system library | Figma library | **Unconfigured** | Could host the agentplain design system as Figma components. |
| `figma:figma-generate-diagram` | Generate diagrams / flows in FigJam | Figma/FigJam | **Unconfigured** | **Architecture + flow visuals** — our diagram reach once connected. |
| `figma:figma-code-connect` | Wire Figma components to code | Mapping | **Unconfigured** | Design-system ↔ code parity; later-stage. |
| `figma:figma-use` / `figma-use-slides` / `figma-use-figjam` | Operate within an existing Figma file | Figma edits | **Unconfigured** | Manipulation of existing files; needs a populated team. |
| `adobe-for-creativity:adobe-design-from-template` | Rapid template-based design (Adobe Express) | PNG/PDF/social | **Unconfigured** — no adobe MCP | Fast, on-template social/flyer assets. Template-bound (a ceiling and a guardrail). |
| `adobe-for-creativity:adobe-create-social-variations` | Resize/restyle one design into per-channel social variants | PNG set | **Unconfigured** | **Social-variation fan-out** once connected — exactly the "one design → all placements" job. |
| `adobe-for-creativity:adobe-batch-edit-photos` | Batch photo edits | Edited images | **Unconfigured** | Team-headshot / listing-photo batches. |
| `adobe-for-creativity:adobe-resize-photos-and-videos` | Resize media to target dimensions | Resized media | **Unconfigured** | Mechanical resize; pairs with the video stack. |
| `adobe-for-creativity:adobe-retouch-portraits` | Portrait retouching | Retouched images | **Unconfigured** | Team headshots — **edits real photos, does not synthesize faces** (on-brand). |
| `adobe-for-creativity:adobe-edit-quick-cut` | Quick video cut/trim | Video | **Unconfigured** | Overlaps Descript in the video stack. |
| `small-business:canva-creator` | Create designs in Canva | Canva design / PNG | **Unconfigured** — no canva MCP | Template-driven; lowest craft ceiling, fastest turnaround. Fine for internal/low-stakes. |
| `postiz:postiz` | Compose + schedule social posts | Scheduled post | **Unconfigured** — no postiz MCP; also crosses `project_no_outbound_architecture` (scheduling = outbound) | **Compose only, never let it publish** for customers. Internal GTM only, with Conner on the buy. |
| `design:design-system` / `design:design-handoff` | Define a design system / produce a dev handoff spec | Spec docs | **Listed; self-contained-ish** | Process skills — useful to *structure* the work even without the design-tool backends. |
| `searchfit-seo:schema-markup` / `generate-schema` | Generate JSON-LD structured data | JSON-LD | **Listed** | "Creative" only in the SEO sense; real value for OG/SERP. Cross-check with `flatsbo-seo` conventions. |

## Tier 3 — Adjacent skills that touch creative work

| Skill | Role in the creative pipeline |
|---|---|
| `marketing:content-creation`, `marketing:draft-content`, `marketing:brand-review` | Copy + brand QA upstream of any visual. |
| `creative-*` (our own fleet) | The **Creative** discipline *owns* the routing (Creative makes; Media distributes) — see `ARCHITECTURE.md` + `docs/fleet/creative-discipline-2026-06-06.md`. |
| `pdf-viewer:*` (MCP **connected**) | Review/annotate/sign generated PDFs — works today. |
| `Claude_in_Chrome` / `computer-use` (MCP **connected**) | Could drive a browser-based design tool (Canva/Figma web) by hand if the dedicated MCP is absent — slow fallback, last resort. |
| `frontend-design` (installed) | Real UI/landing craft today. |

---

## The video stack is already audited (do not re-derive)

`docs/marketing/campaign-2026-06-06/AI_VIDEO_STACK.md` (shipped) is the
one-tool-per-job ranking for video/motion: **Tella** (talking-head + produced
screen), **Adobe Firefly Generative Extend** (B-roll on real plates — cleanest
licensing), **ElevenLabs** (VO), **Descript** (edit/captions),
**Supademo/Arcade** (interactive demo). Standing rule: **AI for atmosphere +
motion on real plates; never for human faces or product UI.** The video maker
routes there, not to this audit.

---

## What to actually do with this (the recommendation)

1. **Use Tier 1 today.** Decks → `pptx`; one-pagers → `docx`/`pdf`; ROI →
   `xlsx`; landing hero **layout** + UI → `frontend-design`; OG images →
   `canvas-design`/`web-artifacts-builder`; diagrams → (Tier 2 figma once
   connected, else `canvas-design`). **No more raw-SVG improv for these.**
2. **Stand up ONE Tier-2 pipeline deliberately.** Highest leverage:
   **Figma** (`figma-generate-design` + `figma-generate-diagram`) and **Adobe
   Express** (`adobe-design-from-template` + `adobe-create-social-variations`).
   Standing them up = install the plugin **and** authenticate the MCP. Until
   then they are not options — the matrix marks them `[needs-connection]`.
3. **Route brand-defining work to a human** via `CreatorBrief` — no tool in this
   list designs a brand mark, mascot, or hero illustration to our bar. That is
   the whole point of `lib/creative-handoff/` and `/operator/creative-briefs`.
4. **Never let an agent improvise a brand asset in raw SVG/PNG again** —
   codified in `feedback_creative_assets_use_tools_or_humans` and gated by
   `creative-router`.

> **To upgrade this audit from inferred-from-name to cited-from-source:** install
> the creative plugins (so their `SKILL.md` lands under
> `…\plugins\cache\<marketplace>\<plugin>\…\skills\<skill>\SKILL.md`) and connect
> the figma/adobe/canva MCPs, then re-run the audit. The `[needs-connection]`
> rows become verifiable.
