# What Design must stop (hold-list enforcement)

The kill list is ratified (2026-07-03). Design enforces these holds on itself and flags any PR that violates them. Each entry names the trigger that lifts the hold — a hold without a release condition becomes a permanent no, and none of these are permanent.

---

## 1. Photography commissions — HELD until first partner signed

The briefs exist (`docs/brand/photography-briefs-2026-06-22.md`, five golden-hour vertical briefs) and the CSS slots are live but empty (`.photo-figure`, `img-heritage`, `.figure-caption` — zero production call sites, verified). They stay empty. Kaizen 03 ranked photography the #1 investment; the kill list overrules it, and the kill list is right: photography is a conversion *amplifier*, and we have not yet proven the conversion exists. Spending on amplification before the first signed partner is design-for-pretty, not design-for-profitable.

**Release trigger:** first design partner signed. First commission on release: the real-estate brief only (beachhead), art-directed per the kaizen guard — standing-and-restraint for the metro broker, not wheat fields.

## 2. Paid ad creative production — HELD

The outbound creative pack (PR #263) exists and paid spend sits behind the marketing plan's 4-condition gate, which is not met. No new static, video, or ad-format creative gets produced this window — including "just mocking up" ad variants, which is production wearing a sketching costume. The founder emails are text; they need landing surfaces, not creative.

**Release trigger:** Marketing's 4-condition paid gate passes.

## 3. New surface area — STOPPED

No new pages, no new routes, no new components. Every spec in this department plan reuses existing utilities (`ApPaperCard`, `ApRootedEmptyState`, `ApRootedLoader`, dateline/drop-cap/pull-quote/field-note, the #312 asset set). The one apparent exception — root `app/not-found.tsx` — is an error boundary for existing routes reusing an existing pattern, not surface area. If a spec of mine can't be built from existing parts, the spec changes.

## 4. Second-tier vertical asset parity — DEFERRED

Kaizen improvement 5 (extend `gen-vertical-scenes.mjs` to insurance, mortgage, home-services, title-escrow, recruiting, RIA) is cheap and proven, and still deferred. The beachhead is real estate; the six second-tier verticals get zero broker-email traffic this window. Parity work is queued behind the RE conversion path, not alongside it.

**Release trigger:** Day-1–5 items in `00-EXECUTIVE-PLAN.md` shipped.

## 5. Heritage-native motion library — DEFERRED

Kaizen investment 3. Three keyframes exist and are sufficient. A motion system is polish on a funnel that currently 308s its second click.

**Release trigger:** revisit at the next department planning cycle, not before.

## 6. Logo, marks, Plaino redraws, brand repositioning — BANNED (standing)

Not a hold; a standing ban (`project_brand_locked`, the kaizen "Do NOT touch" list). No PR from any department touches `Logo.tsx`, `LogoLockup.tsx`, wordmarks, favicons, OG lockups, `PlainoMark`, `public/plaino/**`, the pose set, or the two-family split. Placement and prominence on a page may be tuned; the assets may not. Design reviews any diff that touches these paths as an automatic block.

## 7. New audit and review loops — STOPPED

The July-02 audit produced a synthesis and a top-20 fix table; the kaizen produced a ranked queue; this plan cites both. Per the master-synthesis ruling: fixes only, no new audit loops. Design runs no further review passes until the existing queue is burned down — the critique pipeline terminating at the doc (kaizen friction 2) is the failure mode, and the cure is shipping, not more findings.

---

**Net effect:** this window's design budget is ~zero dollars of new spend and all hours on conversion fixes to existing surfaces. That is what "design for profitable" means when the funnel has verified breaks in it.
