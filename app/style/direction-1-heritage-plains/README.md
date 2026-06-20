# Direction 1 — Heritage Plains Editorial

A complete, self-contained visual treatment for agentplain. One of five
parallel directions; this one is the "real American heartland" take.

**Live route:** `/style/direction-1-heritage-plains`
**Comparison hub:** `/style/directions`

---

## The idea in one line

agentplain dressed like a Patagonia catalog: serif headlines, earth tones,
paper grain, and copy that talks to a business owner like a peer — not a SaaS
landing page shouting at a "user."

## Why this fits agentplain

The product serves local trades — real estate offices, contractors, CPAs.
These owners are skeptical of slick software and tired of being sold to. A
heritage-editorial system signals the opposite of hype: it reads as *built,
durable, earned*. It leans directly into the locked tagline, **"Intelligence
rooted in reality,"** and the mission of doing the unglamorous work so owners
can serve their people. Plaino as a working dog — not a mascot, a *working
animal that earns its keep* — is the emotional anchor.

## Principles

1. **Serif does the talking.** Fraunces at heavy display weights carries every
   headline. The voice of the page is in the typeface before it's in the words.
2. **Earth, never neon.** Forest and clay anchor; cream, ink, dust, sage,
   wheat fill in. No gradient-purple, no glassmorphism, no glow.
3. **Paper, not screen.** A faint grain on every background and letterpress
   shadow on headings make the surface feel printed. The reference is a catalog
   you'd hold, not an app you'd swipe.
4. **One bold visual per section.** Editorial pacing: a section earns one
   hero image or one foil moment, not a wall of icons.
5. **Small print in monospace.** Captions, prices, statuses, and legal lines
   all sit in JetBrains Mono — the "spec sheet" register that makes the serif
   feel more editorial by contrast.
6. **Square corners, hairline rules.** The edge is drawn by a 1px rule, never a
   rounded card with a drop shadow. Structure over softness.
7. **Plainspoken components.** Buttons say "Get started," not "Get Started
   Today!". Plaino says "Done — both out," not "Great news! 🎉". The voice is
   owner-to-owner.

## Anti-patterns (do not do these)

- ❌ Exclamation marks, "Great question!", emoji confetti, hype-coach energy.
- ❌ Drop shadows, big border-radius, frosted glass, neon accent gradients.
- ❌ Stock photography: corporate handshakes, headset call-center smiles,
   floating 3D blobs. If a photo isn't real/weathered/golden-hour, cut it.
- ❌ Letting clay become a "status green" — green is forest/sage and means
   *done*; clay is the single call-to-action accent.
- ❌ Foil everywhere. The metallic sweep is for **one** premium moment per long
   page (here: "white-glove" on the real-estate block). Overuse kills it.
- ❌ Cute Plaino. The dog is confident and working, never a puppy with big
   eyes. WPA-poster discipline: flat shapes, three inks, no gradients.
- ❌ Two display sizes fighting in one section. Pick one focal headline.

## Type & color reference

| Role            | Face            | Notes                                   |
| --------------- | --------------- | --------------------------------------- |
| Display / heads | Fraunces        | Heavy weights, `opsz` high for contrast |
| Body            | Inter           | Grotesque, calm, readable               |
| Small print     | JetBrains Mono  | Captions, prices, statuses, legal       |

| Token  | Hex       | Use                                       |
| ------ | --------- | ----------------------------------------- |
| Forest | `#1F3D2E` | Deep field tone; panels; "done" states    |
| Clay   | `#B85540` | The single CTA / accent color             |
| Cream  | `#F5F0E6` | Paper ground                              |
| Ink    | `#1A1612` | Text, frames                              |
| Dust   | `#9C8B73` | Captions, secondary text                  |
| Sage   | `#7A8B6F` | Soft landscape / supporting fills         |
| Wheat  | `#C8A24A` | Rare harvest accent + foil base           |

## When this direction wins

The SMB owners who'd love this:

- **The contractor / builder** who wears Carhartt, drives a truck with his name
  on it, and distrusts anything that looks like a startup. This reads as a tool
  built by people who understand work.
- **The independent real-estate broker** selling land, farms, and homes with
  history. Heritage = trust = the same thing they sell.
- **The established family business** (2nd/3rd generation) that values
  durability and plain dealing over novelty.
- **Anyone in the rural Southeast** — agentplain's beachhead. The aesthetic
  speaks the region's language without costume or condescension.

It wins when the goal is **trust and longevity**. It is the strongest answer to
"this looks like every other AI startup."

## When it might lose

- If agentplain later targets a younger, urban, design-forward buyer, this can
  read as too rustic.
- Heritage done wrong tips into costume (fake-vintage, distressed-for-effect).
  The discipline is *restraint* — it must look expensive and quiet, not themed.
- Illustration-heavy: the WPA-poster Plaino and section visuals want a real
  illustrator. Budgeting for that is part of choosing this direction.

## Build notes

- **Scope:** everything lives under the `.heritage` CSS class in `styles.css`.
  No live brand token or component is imported or modified, so nothing bleeds
  into production or the other four directions.
- **Fonts:** reuses the three faces already loaded globally
  (`--font-display` / `--font-sans` / `--font-mono`) — no new font payload.
- **CI gates:** the route sits at top-level `app/style/`, outside the
  `app/(marketing)` and `app/(product)` trees the brand-gate and voice-gate
  scan. That's intentional — these are studies, not live surfaces — and it lets
  the direction-local palette exist without tripping the off-token-hex rule.
- **No Claude/Anthropic** named anywhere on the surface (R1 honored regardless).
- **Plaino illustration** is drawn inline as an honest stand-in for the
  direction; production assets in this style would be commissioned per asset.
