# Direction 5 — Editorial Newsroom

A design exploration that renders agentplain as **a publication you would
subscribe to**, not a SaaS landing page. One of five parallel directions.

Route: `/style/direction-5-editorial-newsroom`

---

## Philosophy

Most software pages are control panels wearing a marketing hat — a gradient
hero, a three-column feature grid, a wall of KPI tiles. They say *here are our
features*. A publication says *we have something to say*, and then it earns your
attention paragraph by paragraph.

This direction takes the second posture. It borrows from the design language of
**The New York Times Magazine, Stripe Press, The Atlantic, The Pudding, and the
Pitchfork redesign**: a statement serif, a restrained newsprint palette, layout
used as a narrative tool, and photography treated as editorial — captioned,
framed, graded by a single hand.

The thesis: an agentic product is fundamentally a *story about trust* — the
fleet does the work, but stops at your name. Stories are what publications are
built to tell. So the page is structured as an **issue**:

| Section | Editorial treatment |
| --- | --- |
| Hero | A feature front — masthead, nameplate, dateline, cover headline, byline, full-bleed photo |
| How it works | **No. 1 — a feature report** with a drop-cap lede and three numbered chapters, each a captioned documentary photo |
| Vertical (Law) | **No. 2 — a profile**: "A firm of three, and the night shift it never had to hire," in a two-column magazine set with a rule-bordered sidebar |
| Pricing | **No. 3 — a rate card**: a printed price list with double-rule borders, not a SaaS pricing grid |
| Dashboard widget | **No. 4 — The Morning Ledger**: the product shown as a ruled box-score figure, three numbers and a list |
| Plaino moment | **No. 5 — The Portrait**: Plaino documented as a recurring photographic subject on a forest panel |
| Footer | A **colophon** — staff box, standing matter, subscribe-to-begin |

### Plaino as a character

Plaino is not a glowing corner mascot. He is photographed through the issue like
a recurring subject — *"Plaino on the maintenance route," "Plaino at the firm,"
"Plaino at the close."* Warmth comes from posture, never from a face. Every
appearance is a captioned figure, graded with the same warm documentary
treatment so one hand looks like it shot everything.

### Voice of the components

Buttons speak like a publication, function second: **"Begin reading,"
"Begin the trial edition," "Subscribe — begin,"** **"Read more."** Captions are
italic with a mono figure label. Microcopy is editorial throughout — *"the work
is the proof,"* *"you hold the only pen."*

---

## Visual system

- **Type** — Display: **Fraunces** (the ratified brand display serif, loaded
  here with its optical-size axis so big heads render in the high-contrast
  broadsheet cut). Body: **Newsreader**, a workmanlike magazine text serif with
  a genuine italic for decks, captions, and pull-quotes. Labels/datelines:
  **JetBrains Mono** (the brand mono).
- **Palette** — newsprint cream `#F5F1E8`, ink `#1A1612`, a single editorial
  red `#B7282E` spent once per article (the pull-quote rule, the one number that
  needs a decision), forest `#1F3D2E` as the brand anchor for the Plaino portrait
  and footer. Mostly black and white.
- **Texture** — generous whitespace, hairline rules between sections, double
  rules under the masthead and around the rate card, italic photo captions,
  rule-bordered sidebars, drop caps on long sections, numbered chapters, a
  "continued on…" feel.
- **Layout** — a magazine grid: asymmetric feature columns, multi-column running
  text where it earns it, full-bleed feature photography.

---

## When this direction wins

**The SMB owner who reads The Atlantic.** The buyer who wants the brand to feel
like a publication they would subscribe to — considered, literate, unhurried,
confident enough to tell a story instead of shouting a feature list.

It wins when:

- The category is crowded with identical gradient-and-tile SaaS pages, and
  *looking like a magazine* is itself the differentiation.
- Trust is the actual product. Editorial design signals editorial judgment —
  exactly the "we stop at your name" promise the fleet makes.
- The vertical skews toward professionals who respect craft — **law, CPA,
  RIA/wealth, title & escrow** — where a printed-rate-card seriousness reads as
  competence, not quirk.
- Long-form is an asset: founder essays, vertical deep-dives, and case profiles
  all have a native home in this system.

It is the **wrong** call when the audience wants a fast, scannable, conversion-
optimized funnel, or when the brand needs to feel like cheap-and-easy software
rather than a considered service. Those audiences are better served by the
lighter, more utilitarian directions.

---

## Scoping & safety

- **Fully scoped.** Every style rule is namespaced under `.ed5`
  (`editorial.css`). The editorial palette lives only as local CSS custom
  properties inside that wrapper.
- **No shared infrastructure touched.** Fonts are loaded *locally* in
  `page.tsx` via `next/font`, not in `app/layout.tsx`. `lib/brand/tokens.ts`,
  `app/globals.css`, and `tailwind.config.ts` are untouched — main brand tokens
  are unchanged.
- **noindex.** Internal reference, not a customer surface.
- Reuses existing local Plaino assets under `public/brand/plaino-system/` and
  the law illustration under `public/brand/illustrations/law/`. No fabricated
  press logos, no Claude/Anthropic naming on the surface.

## Files

- `page.tsx` — the demo (server component; local scoped fonts; noindex metadata)
- `editorial.css` — the scoped stylesheet, all under `.ed5`
- `README.md` — this file
