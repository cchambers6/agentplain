# Head of Design — 14-day plan (2026-07-03 → 2026-07-17)

**Mandate:** design for profitable. The CEO lever is 5 Georgia real-estate broker emails going out Monday 2026-07-06. Every design hour in this window serves one number: the rate at which a skeptical GA broker who clicks a link in one of those emails ends up booking a call.

**Verified against:** `origin/main @ d95d279` (2026-07-03). Every claim below was re-checked against this commit, not carried forward from June reviews.

---

## The situation in three sentences

The visual system is strong and the brand is locked — Heritage Plains holds across the estate, the two-family Plaino icon system is correctly deployed (see `02-plaino-status-icons-verification.md`), and no generic-SaaS drift exists. The failures are conversion failures, not aesthetic ones: the #1 nav destination for "what does it do?" is unreachable (a stale redirect), the primary CTA fails WCAG contrast, the one "proof" number on the home page has no source, and the strongest risk-reversal page (`/guarantee`) has zero inbound links. A broker can love the brand and still bounce, because the path from first glance to booked call has four verified breaks in it.

## Priority stack (in order; nothing below starts before the item above is done or handed off)

### Days 1–2 (Fri–Sat, before the Monday sends) — the four conversion breaks

| # | Fix | Evidence | Owner | Size |
|---|---|---|---|---|
| 1 | Delete the `/how-it-works` → `/#how` redirect | `next.config.mjs:22` still shadows the standalone page on main; header nav 308s every click. PR #355 (send-path wave) contains this fix but is unmerged — **land it, don't rebuild it** | Engineering (merge) | merge |
| 2 | CTA contrast: `.btn-confident`/`.btn-primary` `text-paper` → `text-white` on `bg-clay` | `app/globals.css:167,188` — 4.19:1, fails WCAG AA; portal buttons already use `text-white` (4.76:1). One word, verified still live at d95d279 | Design PR | one line |
| 3 | Link `/guarantee` from home closing CTA, footer Company column, FAQ answer; add to sitemap | Audit 01 finding 5: zero inbound hrefs, absent from `app/sitemap.ts`. The 14-day money-back promise is spoken but never shown | Design PR | ~4 links |
| 4 | The `$2,900–$10,600/mo` proof card: cite it or cut it | `lib/marketing/home-content.ts` — no derivation exists in code; the card labeled "ROI math, not vibes" is the one untraceable number on the page | Marketing decides, Design executes | copy |

Items 2–3 are docs-only-PR-exempt work I will queue as a separate follow-up PR; this department PR ships no code per the brief.

### Days 3–5 — first-impression pass on the two pages the emails land on

- **`/real-estate`** is the recommended email destination (see `06-profit-contribution.md` for why, `04-what-i-need-from-other-heads.md` for the Marketing decision). It already carries top-tier assets from #312 (hero scene, 3-step illustrations, social card, OG). Pass: first-viewport claim hierarchy, booking CTA placement once #355's `NEXT_PUBLIC_BOOKING_URL` lands, mobile 375px render.
- **Marketing home** second-viewport: the ROI numbers are the flattest block on the page while the foil moment is spent on mission copy (kaizen friction 10). Move the premium visual weight to the proof block using the existing exhibit/ledger idiom (`ApPaperCard variant="ledger"`), no new components.

### Days 6–9 — editorial rhythm application

Full spec in `03-editorial-rhythm-application.md`. Headline: `/how-it-works` — the second click in the broker's path — has **zero** editorial markers (verified: no dateline, no figure, no anchor per block) while home has 16. It reads as the template page on a site whose whole differentiator is not reading like a template. Apply dateline + one contained figure + step-plate treatment. Then `custom`, `glossary`, `waitlist` (also at zero), and thicken `verticals` index, `compare`, `guarantee` (at one marker each).

### Days 10–14 — the trial's first render

- Dashboard first-render (`overview-view.tsx`) is well-designed and PlainoStatus-correct. The gap is what a day-0 trial broker sees before any work exists: demo mode must lead (the seam exists — `demoStory` prop) so first render shows the fleet working on synthetic realty data, not an empty state.
- Shell P1s from audit 03 that are design-adjacent: sub-44px touch targets shell-wide, missing `loading.tsx` on Connections/Reports hubs (Product/Engineering own; I supply the copy + `ApRootedLoader` usage).
- Root `app/not-found.tsx` (audit 01 finding 4): deep mistyped links currently render Next's unbranded 404 — the worst possible first impression for a stale inbound link. Reuse `ApRootedEmptyState`.

## What this plan deliberately does not contain

Photography commissions, paid ad creative, new pages, new components beyond reuse, second-tier vertical asset parity, motion library, any logo/mark/Plaino work. Rationale and enforcement in `05-what-design-must-stop.md`.

## Definition of done for the 14 days

1. All four Day-1 conversion breaks closed on production.
2. `/real-estate` and home pass a 375px + desktop first-viewport review against the spec in `01-first-impression-surfaces.md`.
3. `/how-it-works` on the editorial rhythm (dateline, contained figure, one anchor per block).
4. A trial workspace's first render leads with demo-mode work, not an empty state.
5. Zero new surface area shipped; zero held spend released.
