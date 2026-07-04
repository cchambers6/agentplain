# Editorial rhythm — application spec for surfaces not yet on it

**Source-of-truth note:** the brief references `feedback_editorial_rhythm_layout_addendum`; no memory exists under that slug. The canonical sources for the rhythm are `docs/brand/design-mirror-2026-06-19.md` (PR #310) and the kaizen 03-design findings ("tonal flatness" and "even rhythm" as the generic-AI tells; the editorial utilities as the cure). This spec applies those, and the specific rules named in the brief: **heritage.png as a contained figure** and **one visual anchor per block**.

**Verified at `main @ d95d279`.**

---

## 1. The rhythm, stated as rules

1. **One visual anchor per block.** Each `Section` gets exactly one element that carries visual weight — a contained figure, a pull-quote, a ledger card, a drop-cap passage, or a numbered plate. Never zero (tonal flatness), never two (competing anchors). Everything else in the block is quiet type on paper.
2. **heritage.png is always a contained figure.** Hairline `border-rule` frame, `bg-paper-deep` mat, natural aspect (`object-contain`, never cropped), mono `figcaption` in eyebrow tracking. It is never a background, never a bleed, never a texture. The home hero already implements this exactly (`app/(marketing)/page.tsx:~146-161`) — that instance is the reference implementation; copy it, don't reinterpret it.
3. **Uneven block heights on purpose.** Alternate dense blocks (tables, plates) with sparse ones (a single pull-quote on open paper). A page where every Section is the same height reads as templated.
4. **Document grammar for trust content.** `§ 01–09` numbering, dateline kickers, exact citations. This treatment won the CPA/law surfaces (kaizen win 5) and is the right register for a broker evaluating a vendor.
5. **One dateline per page**, under the H1 — the "a person published this on a date" tell.
6. **Persona-aware Plaino prominence** (kaizen friction 9): full presence on general/PM surfaces, neutral on RE, reduced on law/CPA entry surfaces. Placement only; the marks themselves are untouchable.

## 2. Where each surface stands (marker census, verified)

Grep census of editorial utilities (`dateline`, `drop-cap`, `pull-quote`, `field-note`, `ApPullQuote`, `figure`) per marketing page:

| Surface | Markers | State |
|---|---|---|
| `/` (home) | 16 | **On rhythm** — reference implementation, incl. the contained heritage figure |
| `/about` | dense (dateline, drop-cap, pull-quote) | On rhythm |
| `/privacy`, `/aup` | dateline + drop-cap / dateline | On rhythm (document grammar) |
| `/pricing` | 5 | Mostly on — anchors present; see `01-first-impression-surfaces.md` for its fixes |
| `/security` | 3 | Acceptable (document grammar carries it) |
| `/how-it-works` | **0** | **Off rhythm — highest priority** (broker's second click) |
| `/custom` | **0** | Off rhythm |
| `/glossary` | **0** | Off rhythm |
| `/waitlist` | **0** | Off rhythm |
| `/verticals` (index) | 1 | Thin |
| `/compare` | 1 | Thin |
| `/guarantee` | 1 | Thin — and about to receive its first inbound traffic once linked |

`field-note`, `img-heritage`, and `photo-figure` remain unused outside the internal `/style` guide — the utilities shipped in #310 that never found production call sites. This spec gives `field-note` its first real uses; `img-heritage`/`photo-figure` stay parked until the photography hold lifts (see `05-what-design-must-stop.md`).

## 3. Per-surface application spec

Ordered by broker-path priority. All reuse existing utilities and components; zero new components, zero new assets.

### `/how-it-works` (days 6–7)
- Dateline kicker under the H1.
- Five-step loop as numbered plates: `§ 01 Read.` … `§ 05 Draft.` — mono section numbers, hairline rules between plates, matching the trust-vertical grammar. One plate = one anchor; the plates ARE the visual system of the page's core block.
- One contained figure: the existing #312 real-estate 3-step illustration, framed per rule 2's treatment (hairline border, mono caption). Real-estate scene listed first in the per-vertical scene block (beachhead ordering).
- Closing block: sparse — one `pull-quote` carrying the no-outbound promise ("Nothing leaves without your name on it."), then the booking CTA once #355 lands. No other anchor in that block.

### `/guarantee` (day 7 — must be ready when the links land)
- Dateline + document grammar (`§ 01` terms, `§ 02` how walk-away works, `§ 03` the ledger).
- One anchor: the time-savings ledger as `ApPaperCard variant="ledger"` — the guarantee is an accounting promise; set it like one.

### `/custom` (day 8)
- Dateline; one `pull-quote` anchor for the engagement thesis; `field-note` margin annotations for the "what we'd build" examples (first production use of the utility).

### `/verticals` index + `/compare` (day 9)
- One anchor each: verticals index gets the contained-figure treatment on the (existing) hero motif; compare gets a single ledger-set comparison table as its anchor — the rest of the page goes quiet.
- Plaino prominence per rule 6: neutral on the index (it serves all ten personas).

### `/glossary`, `/waitlist` (day 9, timeboxed to a half-day together)
- Dateline + drop-cap on the first long passage. Nothing else — these are low-traffic; the fix is "not templated," not "showcase."

## 4. What "done" looks like

Every marketing page has ≥1 and ≤1 visual anchor per block, exactly one dateline, and any heritage.png instance in the contained-figure treatment. The census table above re-run shows no zeros. Voice-gate and brand-gate stay at 0 new violations (all work is layout + existing utilities; copy changes limited to captions and the FAQ em-dash burn-down specced in `01-first-impression-surfaces.md`).
