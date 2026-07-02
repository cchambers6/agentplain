# Kaizen retro — Design (2026-07-02)

**Scope:** visual coherence, Heritage Plains adherence post-#320, design-system health,
component-library reuse, brand-gate effectiveness, per-vertical visual quality, Plaino
visual identity (no logo work — see "Do NOT touch").

**Evidence base:** `docs/brand/*` (design-mirror, brand-gate, plaino-system, icon-families,
photography-briefs), the four `docs/reviews/heritage-rollout-*-2026-06-22.md` review passes,
PRs #310 / #312 / #316 / #320, and fresh verification against `main@f928400` (gates re-run,
stale-hex greps re-checked on 2026-07-02 — findings below cite what is true *today*, not
what the June reviews said).

---

## 10 wins

1. **The Heritage rollout was a retune, not a rebuild.** Because #310 shipped the
   forest/wheat/clay-wash tokens and editorial utilities globally, the full-surface
   rollout (#320) was 36 files, with the shared workhorses (`Section`, `Footer`,
   `globals.css`, tokens) doing ~70% of the work automatically. That is what a healthy
   design system looks like: one change at the foundation re-skins the estate.
2. **Perfect 3-way token lockstep at ship time.** All 18 heritage hexes verified
   identical across `lib/brand/tokens.ts`, `tools/brand/brand-gate.mjs` `CANONICAL_HEX`,
   and `app/globals.css` — including removing a stale duplicate. The known lockstep trap
   was managed, not tripped.
3. **The logo constraint held under pressure.** A 36-file brand pass touched zero marks:
   no change to `Logo.tsx`, `LogoLockup.tsx`, Plaino marks/status icons, favicons, or OG
   lockups — verified independently by the brand-consistency review. The one
   `components/plaino/` file in the diff (PlainoCardView) was token hygiene on a
   decorative glyph, correctly distinguished from a mark change.
4. **Contrast discipline was designed in, not bolted on.** `mute` deliberately held at
   its WCAG-AA value with an explanatory comment; `dust`/`sage` documented decorative-only
   and *actually never used as text* (verified — zero `text-dust`/`text-sage`); the forest
   band re-tones its eyebrow to wheat and intro to `paper/75` precisely to clear contrast.
5. **"Document grammar" won the trust verticals.** `§ 01–09` numbering, dateline kickers,
   exact citations (IRC §6694, ABA Rule 1.6), and letterpress restraint read as the
   professional register of CPAs and lawyers. The customer-eyes review called /security
   "the single most effective surface" for the CPA buyer — authority achieved by format.
6. **Deterministic, regenerable asset pipeline.** #312's 35 per-vertical assets (hero
   scenes, how-it-works illustrations, social cards) all generate from
   `tools/brand/gen-vertical-scenes.mjs` using brand tokens only — no stock, no improvised
   art, honoring the tools-or-humans creative rule. The in-place motif overwrite meant
   every consuming surface picked up new art with zero code or test changes.
7. **The dual-gate architecture is honest and green.** brand-gate (hype, vendor names,
   token drift, geometry) and voice-gate (LLM-ese) both pass in ratchet mode today
   (11 and 31 baseline, 0 new). The voice review verified the baselines were *not* gamed —
   no re-baselining or allowlisting to fake a pass.
8. **No generic-SaaS drift detected anywhere.** The reviews scanned every touched and
   untouched marketing page for `rounded-lg/xl`, `shadow-*`, and gradient regressions:
   none. Untouched pages inherit tokens + grain + letterpress from the base layer, so
   even "partial" pages don't regress to default-SaaS.
9. **Accessibility infrastructure is genuinely in place.** All animations gate on
   `prefers-reduced-motion`; focus-visible with suppression of mouse focus; skip-link;
   heading hierarchy preserved through the `Section` primitive; descriptive alt text on
   every real image. The a11y review's findings were value-tuning, not missing systems.
10. **The bake-off process worked.** Design-mirror (7-brand, IP-safe principle
    extraction) → 5 built directions (#314–#318) → one clear winner (#316 Heritage
    Plains) → full-surface rollout (#320), with losing directions closed cleanly and the
    decision recorded. Repeatable method for the next big visual call.

---

## 10 friction patterns

1. **The gate's scan-scope blind spot is the rollout's headline gap — and it is still
   open.** `buildSurfaceFiles()` scans marketing/product/components plus a hardcoded list
   of exactly 6 email files. Everything outside — `app/api/**`, `app/portal/**`,
   `app/global-error.tsx`, and ~8 other `lib/**` HTML-email generators — kept the OLD cool
   palette when the tokens moved. Verified today on main: `lib/reports/weekly-report-email.ts`
   (sent to every active workspace), `lib/billing/dunning.ts` (a money moment), and
   `app/global-error.tsx` still hardcode `#F7F4ED`/`#1A1A1F`. The gate reports 0 new
   violations *because it never looks there*.
2. **Review findings don't automatically become work.** Four rigorous review passes on
   2026-06-22 produced prioritized action queues, including one P0 (primary CTA fails
   WCAG AA at 4.19:1 — a one-word fix) and two High items. Ten days later, none have
   shipped: `.btn-primary`/`.btn-confident` still render `text-paper` on `bg-clay`.
   The critique pipeline currently terminates at the doc.
3. **Both gates are local-pre-push only.** No GitHub Actions workflow runs brand-gate or
   voice-gate; `HUSKY=0` pushes (a sanctioned recipe in fleet ops memory) and GitHub-web
   merges bypass them entirely. The audit-queue-seeder only *observes* gate signals.
4. **The palette documentation drifted.** `docs/brand/brand-gate.md` still lists the
   pre-heritage hex set (`#F7F4ED` paper / `#1A1A1F` ink / `#B65D3A` clay) as "ratified" —
   a fourth hand-kept palette copy that was never included in the lockstep rule. Anyone
   reading the doc today gets the wrong canonical colors.
5. **One logical value, many literals.** The portal accent default is split between old
   and new clay across `lib/portal/config.ts:84`, two portal page files, a setup-route
   example string, and the component fallbacks — an incomplete sweep of a *single value*
   because it is hardcoded in six places instead of read from `tokens.colors.clay.hex`.
   Same root cause as pattern 1: color literals outside the token channel.
6. **The token system has no contrast contract.** The a11y misses all cluster where
   tokens meet small text or dark grounds: clay as small text (4.19:1), mute on
   paper-deep (4.25:1), foil stops on cream (1.3–2.1:1), `paper/45` footer micro-copy
   (3.9:1), clay focus ring on forest (2.5:1). Every pairing is re-derived by hand per
   review; nothing machine-checks "which text token is allowed on which ground."
7. **Per-vertical visual quality is two-tier.** 5 of 11 verticals (RE, CPA, law, PM,
   general) got #312's distinctive hero scenes, 3-step illustrations, social cards, and
   programmatic OG. The other 6 (insurance, mortgage, home-services, title-escrow,
   recruiting, RIA) still run the generic placeholder-scene idiom, and
   `VerticalHowItWorks` is gated to the 5 slugs — a visible quality cliff between
   verticals sold on the same /verticals index.
8. **The editorial system shipped without its imagery.** `.photo-figure`/`img-heritage`
   are exercised only in the internal `/style` guide; the "editorial publication" promise
   currently rests on type + one mascot illustration. The photography briefs were written
   2026-06-22 and remain uncommissioned ten days later — the system's centerpiece slot
   is still empty.
9. **Mascot and imagery placement is persona-blind.** Plaino is the only picture a
   first-time visitor sees on the highest-gravitas surfaces. The customer-eyes review
   found this an *asset* for general/PM, neutral for RE, and an active gravitas leak for
   law and CPA — yet no placement rule exists anywhere in the brand docs. (Placement is
   a layout decision, not a logo change.)
10. **Mobile micro-typography and touch targets sit at the floor.** 69 instances of
    10–11px uppercase mono at 375px; `mid-rule` card borders at 1.77:1 nearly invisible
    where cards stack on mobile; `.btn-primary` ~40px and portal buttons ~36px against
    the 44px target. None are new regressions, but the brand pass recolored every one of
    these elements without taking the natural opportunity to fix their geometry. Related:
    the one premium visual moment per page (foil) was spent on mission copy while the ROI
    numbers — the converting element — remain the flattest block on every vertical page.

---

## Top 5 design-system improvements

1. **Make `tokens.ts` the single runtime source — kill hand-kept copies.**
   Export an email-safe palette object from `lib/brand/tokens.ts` and route every HTML
   generator (`weekly-report-email`, `dunning`, `budget-alerts`, `guarantee-*`,
   `integration-health-sweep`, `global-error`, unsubscribe route, portal config default)
   through it. Then invert the lockstep burden: have brand-gate *import* the canonical
   set from `tokens.ts` (or a generated JSON) instead of maintaining its own
   `CANONICAL_HEX`, and regenerate the palette table in `docs/brand/brand-gate.md` from
   the same source. Four hand-synced copies become one. This retires friction patterns
   1, 4, and 5 at the root, not per-file.
2. **Promote the gates from pre-push to blocking CI, and widen the scan.**
   A `brand-gates.yml` workflow running both gates on every PR closes the `HUSKY=0` /
   web-merge bypass. Widen `buildSurfaceFiles()` to `app/api/**` HTML responses,
   `app/portal/**`, `app/global-error.tsx`, and all `lib/**` email generators (glob, not
   a hardcoded 6-file list) so the next token move cannot silently strand a customer
   surface. While in there, make baseline keys line-independent (content-hash match, not
   `rule|file|LINE`) so edits near baselined violations stop re-flagging them.
3. **Encode a contrast contract into the token system.**
   Declare allowed text-on-ground pairings in `tokens.ts` (each token already carries
   WCAG notes as prose — make them data), and add a gate rule that *computes* WCAG
   contrast for declared pairings and for the `.btn-*`/focus-ring classes. Ship the
   standing P0 immediately as the first proof: `text-white` on clay (4.76:1, exactly what
   the portal buttons already do) or resting `clay-deep` (5.99:1). Then the clay-CTA
   class of miss becomes impossible by construction instead of caught per-review.
4. **Close the component-library gaps the reviews exposed.**
   (a) A **proof/exhibit figure** component — bordered plate + mono caption, the
   "schedule/exhibit" treatment — so ROI multipliers and dollar figures get the premium
   visual weight instead of the thesis line. (b) A **dark-ground focus-ring** variant
   (wheat/paper ring on `bg-forest`/`bg-forest-deep`). (c) A single **closing-band**
   component that resolves the home (forest-deep, invisible seam) vs about (`bg-ink`)
   divergence one way, with a hairline at the CTA→footer seam. (d) Bump the button
   primitives to clear 44px so every consumer inherits the fix.
5. **Vertical asset parity plus a written imagery-placement rule.**
   Extend `gen-vertical-scenes.mjs` to the remaining 6 verticals (deterministic, cheap,
   already the proven idiom) and un-gate `VerticalHowItWorks`. Alongside it, write the
   persona-aware placement rule into `docs/brand/plaino-system.md`: Plaino full-presence
   on general/PM surfaces, reduced prominence on law/CPA entry surfaces where the
   document-grammar carries the authority. Placement guidance only — the marks themselves
   are untouchable.

---

## Top 3 investments

1. **Commission the photography.** The briefs exist
   (`docs/brand/photography-briefs-2026-06-22.md`, 5 golden-hour vertical briefs) and the
   CSS system (`.photo-figure`, `img-heritage`, `.figure-caption`) is live but empty.
   Art-direct persona-aware: *standing and restraint* for RE/law/CPA (polished
   independent-practice worlds, not wheat fields — the customer-eyes review flagged the
   agrarian read as the metro-broker risk), *warmth* for general/PM. Forward guards from
   the a11y review: real alt text required, and keep `.figure-caption` off `paper-deep`
   grounds (drops below AA).
2. **Illustration commissions for the 6 second-tier verticals and for proof moments.**
   The deterministic SVG pipeline is the floor, not the ceiling. Route commissioned work
   through creative-router per the tools-or-humans rule: hero scenes for insurance,
   mortgage, home-services, title-escrow, recruiting, RIA, plus exhibit-style
   illustrations for the ROI/proof blocks that improvement 4a gives a home to.
3. **A small heritage-native motion library.** Today's motion inventory is three
   keyframes (`ap-rooted-loader`, `ap-paper-sheet-in`, `ap-sheet-up`). Build a compact,
   token-driven set — duration/easing as design tokens, paper-and-print metaphors,
   Plaino pose transitions for loaders and status shifts — reduced-motion-gated by
   construction like the existing three. This deepens the "made by a person" feel the
   design-mirror identified as the differentiator, without importing a generic animation
   framework.

---

## Do NOT touch

Per Conner's standing ban — none of the above authorizes changes to:

- **Logos:** `components/brand/Logo.tsx`, `components/brand/LogoLockup.tsx`,
  `public/brand/wordmark-*.svg`, favicons/`app/icon*`/`apple-icon*`, OG image lockups.
- **The Plaino mark:** `PlainoMark`, `public/plaino/**` (including the canonical source
  JPEG), the 8-bit robot-dog public mark, all 10 poses.
- **Plaino Status icons:** the two-family split (PlainoMark identity vs PlainoStatus
  product-state, PR #232) stays exactly as ratified; brand-gate R5 enforces it.

Placement and prominence of these assets on a page may be tuned (improvement 5);
redrawing, restyling, recoloring, or regenerating any mark may not.

---

*Retro method note: findings verified against `main@f928400` on 2026-07-02 — gates re-run
locally (brand-gate 11 baseline / 0 new; voice-gate 31 / 0 new), stale-hex and CTA-class
claims re-grepped rather than trusted from the June reviews. No code changed in this PR;
document only.*
