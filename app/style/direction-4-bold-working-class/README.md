# Direction 4 — Bold Working-Class

> A design exploration for agentplain. High-contrast, work-boots-and-coffee
> energy. Tools that feel like tools. One of five parallel directions.

**Live route:** `/style/direction-4-bold-working-class`

---

## The philosophy

Most B2B software for local businesses looks like it was made for a venture
deck, not for the person actually running the shop. Soft gradients, rounded
everything, lavender mascots, copy that's allergic to a period. It reads as
*precious* — and precious is the opposite of how a property manager, a roofer,
or a bookkeeper sees their own work.

This direction throws all of that out. It borrows from the brands that earn
trust through **conviction, not polish**: Yeti, Carhartt, Heinz, vintage
Coca-Cola, the pro-shop catalog, the NASCAR sponsor board. The shared signal is
*this thing is built to be used and it isn't going to apologize for it.*

The bet: the owner who's been burned by three overpolished SaaS tools doesn't
want a fourth that looks the same. They want something that looks like it
respects the job. Bold reads as **confident**. Confident reads as **competent**.
Competent is what gets the credit card out.

## The system

| Element | Decision |
|---|---|
| **Display type** | Anton — ultra-bold condensed, uppercase, set tight. Impact headlines. |
| **Body type** | Archivo — an industrial workhorse sans. Clean, sturdy, no character flaws. |
| **Stamp / spec type** | JetBrains Mono — for badges, tags, file numbers, the spec-sheet feel. |
| **Color** | Black `#0A0A0A` + white `#FFFFFF` + one **ALARM** orange `#FF6B1F` that punches. Forest `#1F3D2E` as a quiet secondary (verified states only). |
| **No gradients** | Ever. Flat, confident blocks of color. |
| **Borders** | Heavy — 3–4px solid black. Hard edges. Industrial signage, not soft cards. |
| **Shadows** | Hard offset shadows (`5px 5px 0`), never blurred. Buttons physically *press* on click. |
| **Motif** | The ink **stamp** (rotated circular badge) and the **spec tag** (rectangular label). FACT / CLAIM framing throughout. |
| **CAPS** | Used for impact, not for everything. Body copy stays sentence-case and readable. |

## Voice of the components

Buttons say what they do, not what a form does:

- `RUN IT` — not "Submit"
- `PUT IT TO WORK` — not "Get started"
- `SEE THE WORK` — not "Learn more"
- `BOOK A CALL` — not "Contact sales"

Microcopy is direct. "Done. Next." energy. Confident bordering on cocky — but
**never bro, never irreverent**. The audacity is in the *design*, not in the
attitude. We're a serious tool for serious operators; we just refuse to be
boring about it.

## Plaino in this direction

Plaino shows up as **bold pictograms**, not a soft illustration — high-contrast,
badge-like, one orange accent each. The four work states read as a pose sheet:

- **SIT** — ready for the next job
- **FETCH** — brings back what you ask for
- **HERD** — drives the busywork into order
- **SLEEP** — off the clock, work's done

> These pictograms are the bold visual language for *this* exploration. They are
> not the canonical Plaino brand mark and don't replace it.

## When this direction wins

Pick Bold Working-Class when the target customer is:

- An owner-operator who has **been burned by overpolished SaaS** and distrusts
  anything that looks too slick to be real.
- In a **trades / blue-collar / operations** vertical — property management, home
  services, contractors — where the brand needs to feel like it belongs on a
  job site, not in a co-working space.
- Motivated by **proof over promise**. The FACT/CLAIM framing, the hard numbers,
  and the "nothing leaves without your sign-off" guarantee do the selling.

When it loses: premium-advisory verticals (RIA, law, high-end CPA) where the
buyer reads bold as cheap and wants quiet authority instead. For those, a more
restrained direction carries more trust.

## Scope & isolation

Fully self-contained and safe to drop in or delete:

```
direction-4-bold-working-class/
├── layout.tsx            # loads Anton / Archivo / JetBrains Mono, scopes the .d4 root
├── page.tsx              # the full one-page showcase
├── plaino-pictograms.tsx # SIT / FETCH / HERD / SLEEP + mark, as bold SVG
├── styles.css            # the scoped design system — every selector under .d4
└── README.md             # this file
```

- **Every CSS selector is namespaced under `.d4`** — this sheet cannot touch the
  main brand tokens, `globals.css`, or any other route.
- Fonts are loaded locally in this route's `layout.tsx`, so it does not depend on
  the global brand fonts.
- The route is set `robots: noindex` — it's an internal design showcase.

## Sections on the page

Hero → How it works → Property Management vertical → Pricing tiers → Dashboard
widget → Plaino moment → CTA strip → Footer.

Pricing numbers are **sample tiers for this exploration**, flagged inline — not a
live price sheet.
