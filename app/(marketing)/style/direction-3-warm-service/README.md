# Direction 3 — Warm Service Partnership

A self-contained design exploration for the agentplain marketing surface. One of
five parallel directions. Live at **`/style/direction-3-warm-service/`**.

> Everything in this folder is sandboxed. The page is styled entirely through
> `warm.module.css` (a CSS module — class names are hashed at build time), so it
> cannot leak into or override the ratified brand tokens in
> `lib/brand/tokens.ts` / `app/globals.css`. No shipping page is touched. Delete
> the folder and nothing else changes.

## The feeling

> "I trust this team to take care of me."

Soft, warm, generous whitespace, a little playful, hand-felt. The opposite of a
cold enterprise dashboard shouting metrics at you. Closer to walking into a small
shop where the owner already knows your name.

**Mood references:** MUJI, pre-Intuit Mailchimp, Notion, Cron-era Calendar,
Linear's friendlier cousin, IDEO.

## The bet — who this wins

This direction is built for **the local-business owner who is nervous about AI.**

They've heard the horror stories. They don't want a black box firing off emails
in their name. They want to feel *taken care of* — by a team and a tool that are
patient, transparent, and clearly on their side. For that person, warmth isn't
decoration; it's the conversion lever. Trust is the whole funnel.

It plays especially well for the **General SMB** audience (used as the vertical
block here) — owners who wear every hat and just want their evenings back. The
friendliness reads as "human-staffed," which is exactly our service-layer moat.

**It loses** for a buyer who wants to feel they're getting an enterprise-grade,
high-performance machine — that buyer reads warmth as lightweight. (That buyer is
better served by a more precise, editorial, or technical direction.)

## How the look is built

| Lever | Choice |
| --- | --- |
| **Serif headlines** | Fraunces at light/regular weight (standing in for Tiempos). Warmth from humanist letterforms, never from bolding. |
| **Body / UI** | Inter (standing in for Söhne). Generous 1.65 line-height. |
| **Mono** | JetBrains Mono, reserved for eyebrows + small labels only. |
| **Color** | Warm cream paper `#FDF8F2`, soft ink `#2A2622`, desaturated forest `#1F3D2E` + clay `#B85540`, with dusty-rose `#DEB6A8` and sky `#C2D4E0` as gentle accents. Pastel-adjacent, never infantile. |
| **Shape** | Rounded corners (8–20px), diffuse multi-layer soft shadows, pill buttons. |
| **Texture** | Hand-drawn underline + arrow SVGs, radial paper washes, one-color spot illustrations. |
| **Layout** | Asymmetric columns (hero is 1.35 : 1; vertical block 1.2 : 1). Lots of air. Never a templated stock grid. |
| **Plaino** | A friendly **illustrated robot dog** drawn inline as one-color SVG (early-Mailchimp-Freddie spirit) with `watch / fetch / herd / sleep / sit` poses. Lives in card corners and the footer — never the main hero slab. Friendly but **credible**: a real little machine with posture, not a googly cartoon. |
| **Voice** | Buttons say "Let's go" and "Start my free week," not "Submit." Loading is "Plaino's setting up your weekly summary," not "Loading…". Microcopy talks like a person who has your back. |

The three font families are the ones already loaded app-wide
(`--font-display`, `--font-sans`, `--font-mono`), so this exploration adds **zero**
new font payload.

## What's on the page

The full marketing arc, in the warm treatment:

1. **Hero** — friendly serif headline with a hand-drawn underline, a reassuring
   lede, a "Let's go" CTA, and a warm "first hello" card from Plaino.
2. **How it works** — three rounded step cards joined by hand-drawn arrows.
3. **Vertical block (General SMB)** — "you started this to do the thing you love"
   + a real-feeling owner testimonial card.
4. **Pricing tier** — one calm, soft-shadowed tier card with a "Most popular"
   tag and reassuring footnotes.
5. **Dashboard widget** — a calm "Today" glance: what's ready, what's waiting,
   and a live "Plaino's setting things up" status (animated, reduced-motion
   safe).
6. **Plaino moment** — the four working-dog poses with warm captions.
7. **Footer** — forest ground, conversational columns ("We're here," "Talk to a
   human"), Plaino tucked in the corner, the locked tagline.

## Guardrails honored

- Does **not** touch main brand tokens (scoped CSS module).
- Does **not** break or modify any existing page (purely additive route).
- `noindex` — internal design reference, not a customer landing page.
- Plaino stays **friendly but credible** — never childish.
- No mention of any underlying model vendor on a customer-facing surface.
- Accessible: semantic landmarks, labeled SVGs, AA-contrast text, and a
  `prefers-reduced-motion` fallback for the one animation.

## Compare the five

Open `/style/direction-1-…` through `/style/direction-5-…` side by side and pick
the world agentplain should live in. This one is the answer to: *"What if the
brand's whole job was to make a nervous owner feel taken care of?"*
