# First-impression surfaces — audit + spec

**Scope:** marketing home (`/`), `/how-it-works`, `/pricing`, dashboard first render. For each: what it says at first glance today (verified at `main @ d95d279`), what breaks the impression, and the spec. All copy specs are voice-gate compliant (no LLM-ese families A–D, em-dashes under threshold) and model-vendor invisible (no provider named outside the `/privacy` + `/security` subprocessor blocks).

**The reader we design for:** a Georgia broker-owner who got a cold founder email, is deciding in under 30 seconds whether this is real, and has seen a hundred "AI for real estate" pitches. Skepticism is the default; the design's job is to look like a firm, not a template.

---

## 1. Marketing home (`/`)

### First glance today
Locked mission line as hero, correct tagline from `lib/brand/tokens.ts:141`, ten vertical chips, heritage illustration as a properly contained figure (hairline border + mono caption, `page.tsx:~151`), Heritage Plains tokens throughout, zero vendor names, zero SaaS idiom. Structurally this is the strongest page on the site.

### What breaks it
| Break | Evidence | Severity |
|---|---|---|
| Proof card claims `$2,900–$10,600/mo value` with no source anywhere in code | `lib/marketing/home-content.ts`; audit 01 finding 3. `RoiCalculator.tsx` computes ~$4,300/mo from its defaults; the floor/ceiling exist nowhere | P1 — the card labeled "ROI math, not vibes" is the page's one untraceable number, aimed at exactly the buyer who checks |
| Primary CTA fails WCAG AA | `.btn-confident` in `app/globals.css:188`: `text-paper` on `bg-clay` = 4.19:1 | P0 (standing since 2026-06-22) — the button we want clicked is the hardest text to read |
| "14-day money-back guarantee" spoken in closing CTA, `/guarantee` page orphaned | audit 01 finding 5: zero inbound hrefs, not in sitemap | P1 — risk reversal is the #1 objection-handler for a cold-email recipient and it's invisible |
| FAQ carries 7 baselined em-dash-cadence lines | `faq-items.ts:38,50,66,71,95,99` + `page.tsx:287` | P2 — residual machine cadence on the highest-traffic surface |
| ROI numbers are the flattest block; foil (the one premium moment) spent on mission copy | kaizen 03 friction 10 | P2 — premium visual weight is on the thesis, not the evidence |

### Spec
1. Fix CTA contrast (`text-white`, matching portal buttons).
2. Proof card: replace the range with the calculator's own labeled default ("about $4,300/mo at 10 saved hours a week — run your numbers") and let the interactive calculator carry the claim, or cite a ratified derivation if Marketing produces one. Never render an unsourced dollar figure on this page again.
3. Link `/guarantee` from closing CTA + FAQ answer + footer; sitemap entry.
4. Re-set the proof block in the exhibit idiom: `ApPaperCard variant="ledger"`, mono figures, hairline rules — the "schedule/exhibit" treatment that gives numbers document-grade weight. Move foil to the guarantee/proof moment.
5. Rewrite the 7 baselined FAQ lines to one em-dash maximum each (burns down voice-gate baseline; no meaning change).

## 2. `/how-it-works`

### First glance today
Nobody sees it. `next.config.mjs:22` 308-redirects the route to `/#how`, so the standalone page (shipped PR #283: five-step loop, per-vertical scenes, claims-whitelist copy, own OG image) has never rendered for a visitor. The header's "How it works" — the #2 question in the visitor story arc — lands on a home anchor. Because the redirect is `permanent`, returning visitors' browsers have the 308 cached.

### What breaks it
- The redirect itself (P0, audit 01 finding 1). The fix exists in unmerged PR #355 — the ask is a merge, not a build.
- Once reachable: the page has **zero** editorial markers (verified — no dateline, no figure, no drop-cap, no pull-quote) against home's 16. The five-step loop renders as plain stacked cards. For the broker's second click, the page that explains the product is the least designed page on the path.
- Post-merge hygiene: the footer targets `/#how` while the header targets `/how-it-works` — same label, two destinations. Point both at the page.

### Spec
1. Land #355; verify the sitemap 0.8-priority entry stops 308ing (cached-redirect caveat: expect returning visitors to bounce for a while; nothing further we can do client-side).
2. Apply the editorial rhythm (full spec in `03-editorial-rhythm-application.md`): dateline kicker under the H1; the five steps as numbered plates (`§ 01–05` document grammar — the treatment that won the trust verticals per kaizen win 5); one contained figure (existing #312 real-estate 3-step illustration — no new art); the real-estate scene listed first among the per-vertical scenes since RE is the beachhead.
3. End the page with the booking CTA once `NEXT_PUBLIC_BOOKING_URL` lands (#355), not a bare trial link — the CEO lever is a booked call, and this page is where conviction peaks.

## 3. `/pricing`

### First glance today
Correct and honest: three tiers rendered from the canonical ladder (`tierLadderBands` from `lib/pricing/tiers.ts` — cannot drift from billing), story-arc structure documented in the page header, shared-guarantees list including "Liability for licensed activities stays with you" (exactly the sentence a broker needs), dateline present (5 editorial markers). No "pilot pricing" language. Regular $199→$99, Partner $299→$199, Max quoted — matches the ratified three-tier model.

### What breaks it
- The same P0 CTA contrast class renders the tier buttons.
- Trial guarantee is listed but `/guarantee` is unlinked here too.
- The intro-pricing strikethrough ($199→$99) has no expiry or reason on the page; a skeptical buyer reads unexplained discounts as fake urgency. One clause fixes it ("introductory pricing while we grow the first partner cohort" — truthful per the ratified tier memory).

### Spec
1. CTA contrast fix (inherited from the class change).
2. Link the guarantee line to `/guarantee`.
3. Add the one-clause honesty note on the strikethrough pricing. No other copy changes — this page already tells the story in the right order.

## 4. Dashboard first render (workspace overview)

### First glance today
`overview-view.tsx` is the strongest product surface: eyebrow + computed headline naming what just happened, handoff feed left, approval queue right, no KPI-grid theater, PlainoStatus (not the brand mark) carrying live state, customer vocabulary on every status chip. Audit 03 found 0 P0s across the shell.

### What breaks it
- **Day-0 emptiness.** A trial broker signs up Monday afternoon, connects nothing yet, and the fleet has done nothing. The `demoStory` seam exists precisely for this (killer-workflow runtime on synthetic data, PR #303) but the first-render experience for the RE trial must *lead* with it — the broker should watch a listing-inquiry thread get read, categorized, and drafted within the first minute, on synthetic data, clearly labeled.
- Shell chrome: touch targets below 44px (audit 03 F4), Connections/Reports hubs missing `loading.tsx` (F1/F2) — a click that gives zero feedback reads as broken to a first-time user.
- `settings/page.tsx:46` silent `return null` renders a blank pane instead of the designed error boundary (F3).

### Spec
1. Demo mode defaults ON for a fresh RE trial workspace until the first real handoff exists, with the existing synthetic-data labeling (Product owns the toggle logic; design contract: the first render is never an empty void).
2. Fix F1/F2 with `ApRootedLoader` + contextual copy ("Reading your connected tools…" / "Tallying what Plaino did for you…" — copy already written in audit 03).
3. Bump button primitives to clear 44px (kaizen improvement 4d) so every consumer inherits the fix.

---

*All findings re-verified 2026-07-03 against `d95d279`; nothing in this document is carried forward untested from the June reviews.*
