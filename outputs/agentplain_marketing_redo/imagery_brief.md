# agentplain marketing — imagery & visual asset brief

Branch: `feat/agentplain-marketing-redo-positioning`
Owner: Conner (final approval) · production by named agents below

This brief lists every visual asset the redone marketing site can/should
carry, what blocks each one, and who can produce it. The live site is
intentionally text-first and hairline-rule-driven — Cormorant + JetBrains
Mono + signal moss accent — so we are not chasing stock photography. What
we *do* need is honest UI screenshots, a small set of architectural
diagrams, and a handful of marks for OG/social.

Per `feedback_quality_before_clients`: we will not ship placeholder
graphics, mockup-style "AI brain" illustrations, or stock photos of
people pointing at laptops. Anything that goes onto agentplain.com has
to be either real product UI or a deliberate, on-brand piece of
geometry/typography.

---

## 1 · UI screenshots — gated on Phase 1 deploy being live

Phase 1 customer surface (`/app/*`) merged to main as PR #1 (`9f95d70`)
and is hours from production deploy. Once it is live and we can sign in
to a real workspace, the following screenshots become unblocked.

| Asset | Where it lives | Capture instruction | Producer |
| --- | --- | --- | --- |
| Workspace overview | `/platform` (capability `Catalog agents`) | Sign in, capture `/app/workspace/[id]` overview at 1440×900. Crop to the agent list + recent activity panel. | flatsbo-frontend / b2b-eng-frontend |
| Agent detail page | `/platform` (capability `Custom-built agents`) | Capture `/app/workspace/[id]/agents/[slug]` for one realty agent (e.g. `listing-coordinator`). Show the activity feed and version pin. | b2b-eng-frontend |
| Approvals queue | `/platform` (rail `Human review on customer-facing outputs`) | Capture `/app/workspace/[id]/approvals` with at least one pending item visible. | b2b-eng-frontend |
| Compliance log | `/trust` (control `Per-workspace audit log`) | Capture `/app/workspace/[id]/compliance` with a few rows visible. | b2b-eng-frontend |
| Briefings inbox | `/for-agents` (use case `Inbox triage`) | Capture `/app/workspace/[id]/briefings`. | b2b-eng-frontend |
| Billing settings | `/pricing` (small inset, optional) | Capture `/app/workspace/[id]/settings/billing`. Mask any real Stripe IDs. | b2b-eng-frontend |
| Sign-in page | `/about` (small inset, optional) | Capture `/app/sign-in` clean state. | b2b-eng-frontend |

**Blockers / scope:**
- Production deploy of Phase 1 must be live (hours away).
- Captures must come from a seeded demo workspace, not a real
  customer's. Conner sets up the seed.
- Mask any real PII, real Stripe customer IDs, real email addresses
  before exporting.
- Format: PNG, 2x for retina. Store under
  `public/screenshots/<page>-<slug>.png` and reference via Next
  `<Image>`.

---

## 2 · Architectural diagrams — producible now

These do **not** depend on Phase 1 being deployed. They describe how the
platform is shaped and can be drawn from the spec. Best produced as SVGs
generated from Mermaid (so they version in git as text) or hand-built in
Figma using the existing brand tokens.

| Diagram | Where it lives | Content | Producer |
| --- | --- | --- | --- |
| Two-surface diagram | `/` (between hero and capabilities) | Two boxes: `Brokerage tier` and `Self-serve tier`, both feeding into a shared `agent platform` core (catalog agents, custom agents, integrations, rails). | figma skill (or Mermaid) · Conner approves |
| Capability stack | `/platform` (top of capabilities section) | Vertical stack: catalog agents · custom agents · data integrations · email integrations · server integrations — sitting on a `platform rails` plinth (review, audit, isolation, billing). | figma skill |
| Engagement flow | `/platform` (`How an engagement flows`) | Five-node horizontal: Scope → Build → Observe → Run → Report. Currently rendered as text cards; a one-line SVG version would carry better in OG previews. | figma skill |
| Workspace isolation | `/trust` (control `Workspace isolation`) | Two workspaces fenced by RLS, with a single audit-logged operator path between them. Show what *cannot* happen. | figma skill |
| Vertical fan-out | `/verticals` (top of page) | Single platform core fanning to N verticals, with `Realty (Pin 1, in pilot)` highlighted and roadmap verticals as outlined ghosts. | figma skill |
| Agent lifecycle | `/about` (operating model section, optional) | Catalog candidate → run on real work → version + ship → custom build → catalog promotion. | figma skill |

**Blockers:** none. Each is producible from the platform spec and brand
tokens (`paper`, `ink`, `signal`, `rule` from
`tailwind.config.ts:7-18`). Output as SVG at 1200×600 for OG-friendly
aspect.

---

## 3 · Brand & social marks — partial, gated on logo work

We already have the inline SVG mark in `components/Logo.tsx` and a
favicon at `public/favicon.svg`. The pieces below are net new.

| Asset | Where it lives | Spec | Producer |
| --- | --- | --- | --- |
| OG image, default | every page (default `metadataBase`) | 1200×630, paper bg, ink tagline `Intelligence. Rooted in reality.`, mark in top-left, `agentplain.com` in bottom-right. | flatsbo-marketing-design |
| OG image, brokerages | `/brokerages` | 1200×630, ink bg, paper text `Run a 25-agent brokerage with five.`, signal moss underline. | flatsbo-marketing-design |
| OG image, for-agents | `/for-agents` | 1200×630, paper bg, `The same fleet. Sized for one.` | flatsbo-marketing-design |
| OG image, verticals | `/verticals` | 1200×630, vertical fan-out diagram (item 2 above) re-cropped. | flatsbo-marketing-design |
| OG image, trust | `/trust` | 1200×630, `How we handle your data.` with a single workspace-isolation glyph. | flatsbo-marketing-design |
| Apple touch icon | `app/layout.tsx` icons | 180×180 from existing mark on paper bg. | flatsbo-marketing-design |
| Brand sheet (internal) | `outputs/agentplain_marketing_redo/brand_sheet.png` (not on site) | One-pager: tokens, type, mark, social cards. For sales decks. | flatsbo-marketing-design |

**Blockers:** none for OG and touch icon — pure brand work using
existing tokens. Brand sheet can be produced after the OG cards land.

---

## 4 · Customer testimonials & logos — gated on first pilot brokerage

| Asset | Where it lives (when ready) | Spec | Blocker |
| --- | --- | --- | --- |
| Brokerage logo strip | `/brokerages` (between hero and pricing) | 4–6 brokerage marks at 60px height, paper bg, monochrome ink. | First paying pilot signed; rights to display logo. |
| Pull-quote | `/` (between operating model and FAQ) | One quote, named, with title. Cormorant set, 32px on desktop. | First pilot's mid-engagement check-in (~day 14) where there is real material to quote. |
| Case study card | `/brokerages` (under timeline) | Headline outcome, 3 stats, link to written case study. | First pilot's day-30 outcome report; permission to publish. |
| Founder/team photo | `/about` (optional) | One real photo, paper bg, ink-and-rule frame. | Conner's call. Currently the about page is text-only and that is on-brand. |

**Blockers:** real customer in pilot with permission to attribute. We
will not invent quotes or generic-photo "people" placeholders. Until a
real pilot is signed and complete, these slots stay empty rather than
filled with stock.

---

## 5 · Demo video — gated on Phase 1 deploy + recordable customer flows

| Asset | Where it lives | Spec | Blocker |
| --- | --- | --- | --- |
| Hero video, 30 sec | `/` (above the fold, optional) | Screen recording of: sign-in → workspace overview → agent detail → approvals queue → done. Voice-over plain, no music. | Phase 1 deploy live; a seeded demo workspace; an approval flow that completes in <30s of UI interaction. |
| Platform walkthrough, 90 sec | `/platform` (under hero) | Same flow at slower pace, narrated. | Same blockers. |
| Brokerage pilot explainer, 60 sec | `/brokerages` | Conner on camera explaining the 30-day pilot. | Conner's recording session. No deploy blocker. |

**Blockers:** as listed. Demo videos should not ship before the
underlying flow is real and stable.

---

## 6 · Iconography — producible now, low priority

The current site uses zero icons by design (hairlines + numerals). If we
do introduce iconography later, the rule is: thin-stroke geometric
glyphs, ink color only, no filled shapes. Not blocking the relaunch.

---

## Production order — what to ship first

1. **Architectural diagrams (item 2)** — unblocks the visual hierarchy
   on `/`, `/platform`, `/verticals`, `/trust`. Producible today.
2. **OG / social cards (item 3)** — every shared link looks better
   instantly. Producible today.
3. **UI screenshots (item 1)** — the day Phase 1 production deploy
   ships. Highest credibility win.
4. **Customer testimonials (item 4)** — when the first pilot has
   material to quote.
5. **Demo video (item 5)** — after item 1.

---

## What is *not* on this list, on purpose

- AI-themed illustration (robot heads, glowing brains, neural-net
  graphics). Off-brand and dishonest.
- Generic stock photography of "agents shaking hands" or "office
  workers pointing at laptops." Off-brand.
- Pre-rendered "fake UI" mockups. We have a real product surface
  shipping in hours; we wait and screenshot the real thing.
- "Coming soon" or "image goes here" placeholders. Per
  `feedback_quality_before_clients`, an empty hairline rule is better
  than a filler image.
