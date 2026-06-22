# Photography briefs — Heritage Plains Editorial

**Date:** 2026-06-22
**Owner decision pending:** these are specs for commissioning, not a commission. No
images are bought or shot until Conner signs off. Nothing in the codebase points at
these frames yet (no broken `<img>` tags were added during the PR #316 rollout).

Companion to the Heritage Plains Editorial rollout (PR #316). Where the rollout
gave every page the cream ground, warm letterpress ink, and forest grounded
bands, photography is the one thing code can't fake: a real, weathered,
golden-hour photograph of the actual work, framed as an editorial plate.

This file specifies the imagery we would commission per vertical so a
photographer (or art buyer) can shoot to a single, coherent brief.

---

## Shared art direction (applies to every frame)

- **Light.** Golden hour only — the last 45 minutes before sunset or the first
  after sunrise. Long, low, warm light. Real window light indoors; no ring
  lights, no flat fluorescent, no studio softbox look.
- **Subject.** The work and the hands that do it. Weathered, lived-in, mid-task.
  Faces optional and usually partial — a forearm, a hand on a ledger, a shoulder
  turned to a window. We are documenting a craft, not casting a brochure.
- **Place.** The actual working environment, with its real clutter. A desk with
  paper on it. A truck bed. A closing table with rings of coffee. Never a swept
  set.
- **Grade.** Match the `.img-heritage` grade already in the stylesheet — a slight
  warm desaturation, gentle contrast, never a hard duotone. One hand should look
  like it shot the whole set.
- **Frame.** Every photo lands inside the `.photo-figure` plate (hairline
  `border-mid-rule` on the paper-deep ground) with a monospace `.figure-caption`
  beneath it. Figure, not background. The image is a plate on the page, never a
  full-bleed watermark behind copy.
- **Aspect.** Shoot wide enough to crop to both a 3:2 landscape figure (vertical
  page hero column) and a 4:5 portrait (mobile stack). Negative space on one side
  for the caption to breathe.
- **Never.** No corporate-handshake. No headset call-center. No laptop-glow
  hero. No stock smiles to camera. No blue-tinted "tech." No AI-rendered scenes.
  No logos or screens showing competitor/vendor UI. Plaino and the wordmark are
  never composited into a photograph — the brand marks keep their own treatment.

---

## Per-vertical briefs

### 1. Real estate
Golden-hour light raking across a kitchen island at a just-sold home — weathered
hands signing the closing packet, a set of keys and a travel mug beside the
paper, a moving box half-packed in the soft-focus background. The agent is a
presence at the edge of frame, not the subject; the subject is the moment a
document becomes a home. Warm wood, paper texture, dust in the light.
*Caption example:* `CLOSING DAY — KENNESAW, GA`. *Used on:* `/real-estate`
hero figure column, home-page day-in-the-life plate.

### 2. CPA / accounting
A small-firm accountant's office in the last light of a long day — a desk lamp
just clicking on against the window's gold, a legal pad of hand-written
reconciliations, a calculator with worn keys, a coffee gone cold. A hand resting
on a stack of folders, mid-thought. The mood is the quiet competence of someone
who has closed a hundred months. No spreadsheets-on-a-monitor cliché; the paper
and the hands carry it.
*Caption example:* `MONTH-END, 6:40 PM`. *Used on:* `/cpa` hero, pricing-page
"a day in the life" plate.

### 3. Law
A solo or small-firm attorney's working table near a tall window at golden hour —
a marked-up contract with a fountain pen laid across it, sticky tabs along the
margin, a worn leather portfolio, law spines blurred behind. A hand flattening a
page mid-review. Gravitas without the mahogany-and-globe stock cliché: real
documents, real annotation, real light.
*Caption example:* `REDLINE — FULTON COUNTY`. *Used on:* `/law` hero, the
compliance/"rooted in reality" plate.

### 4. Home services (trades)
The tailgate of a work truck at the end of a job, golden light low across the
driveway — a weathered, capable hand writing up an estimate on a clipboard
braced on the knee, tools racked behind, a roll of blue tape and a tape measure
in frame. Dust, calluses, a forearm. The dignity of the trade, shot like a
Filson catalog, not a franchise flyer.
*Caption example:* `ESTIMATE, LAST CALL OF THE DAY`. *Used on:* `/home-services`
hero, the value-loop plate.

### 5. Insurance
An independent agent's desk at dusk — a renewal binder open, a hand-annotated
policy schedule, a desk phone and a notepad of client names, the window behind
going gold. A hand on the open binder, pen mid-note. The story is the
relationship book this person has tended for years: paper, margin notes, the warm
clutter of a practice run by one trusted human.
*Caption example:* `RENEWAL SEASON — MARIETTA`. *Used on:* `/insurance` hero,
the "what the fleet knows on day one" plate.

---

## Rollout note

Until commissioned, the existing Plaino illustrations (`/brand/plaino-system/*`)
remain the bold visual per section — they are untouched by the heritage rollout
and are **not** to be replaced by photography. When photography lands, it is
**additive**: a second editorial plate alongside Plaino, never a swap of the
brand mark.
