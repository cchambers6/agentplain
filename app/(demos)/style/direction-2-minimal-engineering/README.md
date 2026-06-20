# Direction 2 — Minimal Engineering

A parallel design exploration for the agentplain marketing surface. One of five
directions; this one is the **dark-mode-first, technical-but-warm** lane.

**Live route:** `/style/direction-2-minimal-engineering`
**Lineage:** Linear · Stripe · Vercel · Rauno Freiberg · Notion Calendar · Read.cv

---

## Philosophy

The product is software that runs your back office and writes an audit log for
every action. Direction 2 makes the marketing surface *feel like that product*:
restrained, instrumented, dense without being noisy. The page is the demo.

Five rules drive every decision here:

1. **Dark by default.** Near-black floor (`#0A0A0A`), layered surfaces
   (`#14171F` → `#181C26`), a faint engineering grid washed across the page.
   Dark mode reads as "serious software" to a technical audience — and it lets a
   single accent do all the signaling.
2. **One accent, used like a status LED.** A sharp signal-green (`#34D17E`)
   carries every "this is live / this is good / act here" cue. It only ever
   appears where there's meaning — never as decoration.
3. **Hairlines, not shadows.** Structure comes from 1px borders and tonal steps.
   The two soft gradients on the page (hero underglow, featured price card) are
   the *only* depth cues — everything else is flat and edged.
4. **Tabular and typographic.** Inter everywhere with tight tracking
   (`-0.011em`) and tabular numerals; JetBrains Mono for anything machine-like
   (timestamps, labels, run IDs, keycaps). Numbers line up because alignment
   reads as precision.
5. **Crisp motion, no theatre.** Fast easing (`cubic-bezier(.22,1,.36,1)`),
   120–200ms transitions, a micro-interaction on every clickable. The dashboard
   tabs switch with zero JavaScript (CSS-only radio peers).

### On the accent — "try both" resolved

The brief asked to test heritage forest `#1F3D2E` against a sharper modern green.
Both ship, each doing the job it's actually good at:

- **`#34D17E` (sharp signal-green)** is the *interactive* accent — links, focus,
  active state, the pulsing status dot. On a `#0A0A0A` floor it has the contrast
  to function as a signal.
- **`#1F3D2E` (forest)** is the *deep tone* — panel grounds and the featured
  price-card gradient. It carries the heritage-brand DNA but reads as mud as a
  foreground color on near-black, so it's used as ground, not signal.

This keeps the direction in-family with the canonical brand while giving the
dark surface a green that can actually pop.

### Plaino, geometric

Plaino is rendered as a **geometric icon mark** — a rounded square enclosing a
bracketed "signal" glyph — and never illustrated. The four status states
(`sit` / `fetch` / `herd` / `sleep`) are minimal monochrome stroke icons that
light to the accent on hover. This is deliberately the opposite of the canonical
8-bit/illustrated Plaino: in this direction the mark behaves like a build
artifact, not a mascot.

---

## When this direction wins

**The tech-credible SMB owner who wants to look serious.** The accountant who
runs a tight firm and evaluates software the way an engineer would; the operator
who already lives in Linear, Stripe, and a terminal; the buyer for whom "looks
like real infrastructure" is a trust signal, not a turn-off.

It wins specifically when:

- The audience equates **dark, dense, instrumented** with **trustworthy**.
- The product story is **auditability and control** — and the UI needs to *show*
  the log, the thresholds, the run output, not just describe them.
- We're selling to people who will **read the dashboard before the headline**.

It is the wrong call for a warm, mainstream, "small-business-next-door" audience
— that's what the paper/clay/serif canonical brand (and the other directions)
are for. Direction 2 trades approachability for credibility on purpose.

CPA is the showcase vertical here precisely because the engineering-credible
aesthetic plays best where the buyer values precision (reconciliation rates,
tabular cash positions, immutable working papers).

---

## What's in the demo

All seven required sections, single page:

| Section | What it demonstrates |
|---|---|
| **Hero** | Status-line motif, tight display type, `Continue` / `Read the docs` voice, `⌘K` keycap |
| **How it works** | Three-primitive grid, mono step numbers, 1px-gridded cards, geometric glyphs |
| **Vertical block (CPA)** | A real-looking run log — timestamps, status tags, machine output as the hero visual |
| **Dashboard widget** | Tabular metrics, status pills, an inline SVG sparkline, **CSS-only tab switching** |
| **Pricing tier** | Flat-fee three-up; featured card is the only place a gradient + glow is allowed |
| **Plaino moment** | Geometric mark, four monochrome status states, a console/chat exchange |
| **Footer** | Dense column grid, mono section labels, an "all systems operational" status row |

---

## Implementation notes

- **Fully scoped.** Every style lives in [`styles.css`](./styles.css) under
  `.d2-root`. No `:root` variables, no global element selectors — this file
  cannot leak into the rest of the app, and it does not touch the canonical
  brand tokens in `lib/brand/tokens.ts`.
- **Chromeless route.** The page sits in the `app/(demos)` route group, whose
  layout deliberately omits the real `Header` / `Footer` / Plaino widget so the
  direction can be evaluated as a complete, self-contained frame. Route groups
  don't change the URL, so it still resolves at
  `/style/direction-2-minimal-engineering`.
- **No JavaScript required.** It's a React Server Component. The dashboard tabs
  use hidden radio inputs + sibling selectors; everything else is CSS `:hover`
  / `:focus`. Fonts reuse the app's existing `--font-sans` (Inter),
  `--font-mono` (JetBrains Mono), and `--font-display` (Fraunces, used only for
  the one editorial serif line).
- **`noindex`.** Internal evaluation surface, not a public landing page.
- **Accessibility.** Honors `prefers-reduced-motion`; accent green on the
  near-black floor clears AA for the text sizes it's used at; the tab radios
  remain keyboard-focusable.
