# agentplain — logo iteration set v0

Ten hand-coded SVG candidates for the agentplain logo, each pairing the same wordmark + tagline with a different tiny pictorial mark. All marks are rooted in the plains (prairie, horizon, soil, growth) per the brand lock — none aerial, none sleek-tech.

Open `preview.html` in a browser to compare. The page is self-contained — no build step.

## Files

| # | File | Mark | Construction |
|---|------|------|--------------|
| 01 | `01-horizon.svg` | Single horizon line | One 2.2px stroke, x=166→234 at y=42 |
| 02 | `02-roots.svg` | Plant with visible roots | Stem + 2 leaves above, taproot + 4 branches below a thin ground line |
| 03 | `03-wheat.svg` | Three wheat stalks | 3 stalks with kernel detail; center tallest, outer pair leaning |
| 04 | `04-tree.svg` | Lone tree on horizon | Trunk + lobed organic canopy (filled), anchored to horizon |
| 05 | `05-sunrise.svg` | Sunrise over horizon | Outlined half-disc + horizon + inner chord (suggests daybreak) |
| 06 | `06-seedling.svg` | Seedling breaking ground | Stem + cotyledons above dashed soil line; seed husk + emerging root below |
| 07 | `07-silo.svg` | Grain silo | Vertical body + shallow dome + 3 ribbed bands + horizon |
| 08 | `08-furrows.svg` | Plowed field rows | 5 furrows converging on vanishing point at horizon |
| 09 | `09-rootsystem.svg` | Root system cross-section | Soil line up top; taproot + 4 primary + 5 secondary hair roots below |
| 10 | `10-bigsky.svg` | Big sky with cloud | Low horizon + small filled cloud upper-left of horizon |

All ten share:
- viewBox `0 0 400 220`
- Paper background `#F7F4ED`
- Wordmark: Source Serif 4, weight 500, size 52, letter-spacing -0.8, centered at y=135
- Tagline: JetBrains Mono, weight 500, size 9.5, letter-spacing 3.6, centered at y=175
- Foreground via `style="color:#1A1A1F"` + `currentColor` so CSS can override to moss or clay
- No drop shadows, no gradients, no filters, no external font loading

## Scale notes (from drawing each one)

**Works at every scale (hero → 24px favicon mark):**
- `01-horizon` — a single stroke survives anywhere
- `04-tree` — strong silhouette, lobed canopy is filled so it holds
- `07-silo` — chunky vertical mass; bands disappear at favicon but body still reads
- `08-furrows` — geometric perspective is scale-independent
- `10-bigsky` — filled cloud mass survives squash; horizon is a single stroke

**Hero and small only (loses detail at favicon):**
- `02-roots` — root branches collapse at 24px; the stem + leaves still read but the root system blurs
- `03-wheat` — kernel slashes are below the threshold at 24px; reads as three lines
- `06-seedling` — seed husk and dashed ground both collapse at 24px
- `09-rootsystem` — the secondary hair roots blur at 24px; primary roots survive

**Conditional:**
- `05-sunrise` — outlined half-disc reads at favicon size but loses the inner chord; that&rsquo;s probably fine — the chord is a hero-only nuance

## Trade-offs noticed during drawing

- **Roots designs (02, 09)** carry the tagline most literally but compete with the wordmark&rsquo;s baseline weight. The mark is heaviest below the implicit center-line, which pulls the eye downward. Works because the wordmark below provides counter-weight. If the mark were used standalone (no wordmark), it would feel bottom-heavy.
- **Filled vs. stroked marks (04 tree, 10 cloud filled; everything else stroked).** Filled marks pop more at small scales but read &ldquo;heavier&rdquo; — they shift the tone from precise/architectural to grounded/organic. Stroked marks pair more cleanly with the editorial wordmark.
- **The wheat (03) and sunrise (05)** are pretty — but they&rsquo;re &ldquo;decorative&rdquo; in a way the others aren&rsquo;t. They evoke prairie, but they don&rsquo;t carry the brand thesis the way the rooted/horizon marks do. Worth showing for completeness; probably not the winners.
- **Silo (07)** is the most &ldquo;heartland industry&rdquo; — and the most divisive. It reads as a real piece of infrastructure (which is good) but also reads as agriculture-specific (which may narrow how the mark feels across the 10 verticals). Strong, but verticals like CPA, law firms, RIAs may find it tonally off.
- **Sunrise (05)** without inner chord would read as a hill (which would still be on-brand) — keep the chord at hero scale, accept it disappears at favicon.

## Recommended top three

### 1. **`01-horizon`** — the reduction

A single stroke. It&rsquo;s the only candidate that achieves the &ldquo;Helvetica&rdquo; level of restraint — the brand mark is the gesture, not an illustration. Pairs naturally with the editorial Source Serif wordmark because both are reductive type/line forms. The mark **is** the brand thesis: a flat horizon — the plains — under which everything we say is grounded. Survives every scale by definition. Most likely to feel right ten years from now.

**Risk:** At favicon size it can be mistaken for a hyphen or a divider. Mitigated because a favicon is always in a context (browser tab, app icon) where it sits next to text — and the wordmark uses it as a visual signature element already at the top of the mark area, not the middle.

### 2. **`08-furrows`** — the work

Five converging perspective lines. Reads as plowed field, runway-of-work, and a deliberate &ldquo;guiding lines&rdquo; metaphor. Geometric structure means it survives any scale. The most active of the candidates without being decorative.

**Risk:** Some viewers may read it as a road/highway vanishing point — which is still on-brand (heartland) but loses the specifically-agricultural feel. If we want to lean into &ldquo;the path of work,&rdquo; this is the strongest.

### 3. **`04-tree`** — the durable thing

A lone tree on the horizon. The most emotionally legible. Carries &ldquo;rooted, growing, durable, alone but enduring&rdquo; — the right tone for a tool serving owner-operators. Lobed canopy avoids the lollipop-tree look. Filled mark means it holds at favicon size.

**Risk:** Trees are common in tech branding (less so in plains-themed tech, but still common). Less &ldquo;ownable&rdquo; than `01-horizon`. Most likely candidate to feel dated in 5–7 years.

## Honorable mentions

- **`02-roots`** is the most literally tagline-faithful but the most visually complex; probably better in display-only contexts (printed materials, billboards) than as a favicon.
- **`10-bigsky`** is the prettiest at hero scale — quiet, atmospheric, distinctly American-plains — but the cloud + horizon combination needs the full mark area to breathe.

## Next step

1. Conner picks a winner (or two — a mark for everyday, a more illustrative one for hero contexts).
2. Spawn the refinement task. That task:
   - Locks the final mark geometry (single source of truth in `lib/brand/marks.tsx` or similar)
   - Generates `public/brand/wordmark-light.svg` (paper bg + ink mark+wordmark)
   - Generates `public/brand/wordmark-inverted.svg` (ink bg + paper mark+wordmark)
   - Generates `public/favicon.svg` (square crop, mark-only, optimized for 16/24/32/48)
   - Generates `public/brand/og-image.svg` updated with the mark
   - Wires through `components/marketing/site-header.tsx` and `app/layout.tsx` favicon link
   - Adds a test that snapshots the brand SVGs so any future drift is caught

3. The current placeholder wordmark stays in place until step 2 lands.

## Caveats

- These files are **candidates only** — `app/layout.tsx` and the marketing components still use the placeholder wordmark from `public/brand/wordmark-light.svg`. Nothing here is wired in.
- The favicon test in `preview.html` uses SVG `<image>` with a cropped viewBox to render a mark-only thumbnail. Some browsers (notably Safari) may render cropped-`<image>`-of-SVG differently; if a candidate looks wrong in the preview, render the candidate SVG directly at small sizes to confirm.
- The fonts referenced (Source Serif 4, Inter, JetBrains Mono) are not loaded by `preview.html` — it uses local fallbacks (Georgia / system-ui / ui-monospace). The candidate SVGs themselves declare the brand fonts with fallbacks. Open a candidate in a context that loads Source Serif 4 (e.g. the marketing site) to see the wordmark in its intended type.
