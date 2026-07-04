# What marketing needs from the other heads — 14-day window

Every ask is scoped to the five pieces and the Monday send. Nothing here is a nice-to-have; if an ask slips, the fallback is stated so the calendar holds anyway.

---

## From Product / Engineering

1. **Real screenshots, two sets, by Jul 8.**
   (a) Our own brokerage workspace for the operator story (piece 3): the approval queue across one real week, a draft open with the compliance pass visible, the overnight recap. Real data from our own workspace is fine to show; scrub any third-party personal contact info in-frame before handoff.
   (b) The demo runtime (PR #303) walking the real-estate killer workflow for piece 4, captured at each step. These must be labeled demo data in the piece; Product's job is only to confirm the demo runtime is the source so the caption is true.
   *Fallback:* piece 3 slips to the back half of the window before piece 4 does; the demo runtime is deterministic and can be captured any day.
2. **One thin article surface, by Jul 9.** The three comparisons extend the existing `/compare/[alt]` registry (add `follow-up-boss`, `boldtrail`, `sierra` entries). Pieces 3 and 4 need one simple long-form route with Article JSON-LD and a last-updated stamp; smallest possible implementation, no CMS. *Fallback:* both publish as sections on `/real-estate` and move to their own URLs later.
3. **Truth confirmations, by Fri Jul 4 (answers, not builds):** exact current state of the FUB/Sierra api-key connect path post-#355, so the comparisons describe reality; confirmation that saved-time surfacing is still gated (audit 9), so no piece or collateral leaks a minutes number; confirmation the demo runtime runs clean on the paused key.
4. **Measurement seam, by Jul 11:** the four goal events (sign-up reached, sign-up completed, lead-capture submitted, guarantee-page view) emitted wherever the analytics adapter can read them, and the "how did you hear about us" self-report field at signup. Marketing supplies the six option labels. This is deep-dive 06 scope, unchanged; it is on the profit path because Monday creates the first traffic worth attributing. *Flag:* if the analytics vendor processes visitor data, `/privacy` needs a subprocessor update through the counsel packet before events flow.

## From Sales

1. **The prospect-to-stack map, by Fri Jul 4.** For each of the five named Georgia prospects: which CRM/platform they run (FUB, Sierra, BoldTrail, other), team size, and the one pain that made them worth picking. This decides which piece each first-touch links (FUB shop gets piece 1; automation-heavy shop gets piece 2; the skeptic gets piece 3). Wrong link is worse than no link.
2. **UTM discipline on every send.** Links in first-touches and follow-ups carry the convention from the measurement PR (`utm_source=founder&utm_medium=outreach&utm_campaign=ga-re-dp&utm_content=<prospect-slug>`). Marketing supplies the tagged URLs; Sales pastes, doesn't hand-build.
3. **Reply intelligence, continuously.** Every reply, objection, and silence pattern lands in `/operator/outreach` notes within a day. Replies are the first customer research this company has ever had; they reprioritize the post-window content queue better than any keyword map. Marketing reads the pipeline weekly and will not ask twice.
4. **Call-booked trigger:** when a discovery call books, Sales attaches piece 4 as the pre-read and the one-pager to the confirmation, and tells marketing same-day so the Jul 17 readback ties bookings to sources.

## From Design

1. **Five pieces, five visual treatments, within Heritage tokens, staggered Jul 6–16.** Editorial layout per the design system (drop-cap, pull-quote, field-note where earned), one OG image per piece from the existing per-vertical OG pipeline. No new photography (held by kill list); no improvised illustration — anything beyond the existing component set routes through creative-router.
2. **The two collateral assets from `03-outbound-support-collateral.md`** (LinkedIn banner, invite thumbnail) via creative-router by Fri Jul 4 EOD. Specs and final copy are in that file; Plaino usage follows the two-family icon rule (identity mark only, no status icons in brand surfaces).
3. **Screenshot dressing for pieces 3 and 4:** consistent frame treatment and caption style for real-product screenshots so demo-data labels are visually part of the figure, not fine print. This is a truth requirement, not decoration.

## From Conner (routed via the decision queue, not new asks)

Already queued, listed here only because they touch this window: set `NEXT_PUBLIC_BOOKING_URL` (blocks the invite asset), enter the five prospects in `/operator/outreach`, upload the LinkedIn banner, and the founder-bio decision (upgrades pieces 3–4 with a byline whenever it clears; not blocking).
