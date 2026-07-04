# Head of Marketing — 14-day plan (2026-07-03 → 2026-07-17)

**Frame (ratified 2026-07-03, do not re-litigate):** the CEO lever is five Georgia real-estate design-partner emails sent by Conner on Monday, 2026-07-06. Marketing exists these 14 days to make that send land better and to make week-2 discovery calls book. Paid media is HELD until the first partner signs (kill list, PR #354). Ad-creative production is HELD. Content is Georgia real estate ONLY until 2 pilots are live. Every line item below either ships content or sets up measurement. Zero paid dollars.

**Sources:** `docs/marketing/deep-dive-2026-07-02/` (all 7 files), `docs/audits/full-audit-2026-07-02/agentplain/01-marketing-home.md`, `docs/kaizen/2026-07-02/04-marketing.md`, `docs/ceo/2026-07-02/` (branch `ceo/pass-1-2026-07-02`), `docs/planning/2026-07-02/` (branch `planning/direction-check-2026-07-02`), outreach kit (PR #353, `docs/outreach/`), send-path wave (PR #355).

---

## What changed since the deep-dive (2 days ago)

The deep-dive's week-1 blockers are closing: the `/how-it-works` redirect is deleted, `/contact` exists, the booking CTA reads `NEXT_PUBLIC_BOOKING_URL`, and a CRM-lite pipeline exists at `/operator/outreach` (send-path wave, PR #355). The outreach kit (PR #353) gives Conner seven founder-send documents on a 5/12/21-day chain. What has NOT changed: zero sends ever, zero analytics on the site, zero proof assets, and the booking URL env var is still unset. This plan takes those as the starting line.

## The two workstreams (nothing else)

### Workstream A — ship content that supports the Monday send
Five Georgia-RE pieces published inside the window, each matched to what the five prospects actually run (see `01-RE-content-pipeline.md`). The first piece is live before Conner hits send Monday morning so the first-touch email links to something specific, not to the home page. Follow-up touches on the 5/12/21 chain each get a fresher piece to reference than the touch before.

### Workstream B — set up measurement before anyone arrives
The site has no analytics at all (audit dept 1, verified). Fixing that before the send is worth more than any headline we could write, because Monday is the first time this business has ever had traffic worth attributing. Scope is the deep-dive's week-1-2 instrumentation plan, unchanged: privacy-respecting analytics behind the adapter seam, four goal events, one UTM convention, and the "how did you hear about us" self-report field. Detail and ownership asks in `04-what-i-need-from-other-heads.md`.

---

## Day-by-day

| Date | Item | Workstream | Done when |
|---|---|---|---|
| Thu Jul 3 | This plan lands; briefs for all 5 pieces frozen (01) | A | PR open |
| Fri Jul 4 | Piece 1 (Follow Up Boss comparison) drafted + gated; Monday-send collateral pack delivered to Conner (03) | A | gates pass, collateral in Conner's hands |
| Sat–Sun Jul 5 | Analytics + UTM convention PR opened; UTM-tagged links handed to Sales for the five first-touch emails | B | PR open, links in the send drafts |
| **Mon Jul 6** | **Piece 1 published by 8am ET. Conner sends 5. Nothing marketing does today matters more than staying out of the way.** | A | live URL in first-touch emails |
| Wed Jul 8 | Piece 2 published (the $26,262 fair-housing piece / BoldTrail comparison) | A | live, gated |
| Fri Jul 10 | Piece 3 published (operator story: our own brokerage, told honestly); week-1 scoreboard read | A | live; scoreboard has 3 numbers |
| Sat Jul 11 | Self-report field + goal events verified firing | B | events visible in analytics |
| Sun Jul 12 | Touch-2 follow-ups go out on the chain; each references piece 3 | A | Sales confirms links embedded |
| Tue Jul 14 | Piece 4 published (killer-workflow demo write-up, labeled demo data) | A | live, gated |
| Thu Jul 16 | Piece 5 published (Sierra comparison) | A | live, gated |
| Fri Jul 17 | 14-day readback: sends, replies, calls booked, source-known %, pieces live. Decisions attached to every number or the number gets cut. | A+B | readback doc in the weekly kaizen loop |

## Scoreboard (read Fridays, three numbers plus two health checks)

1. **Sends** (target: 5 on Jul 6; touch-2s on chain by Jul 12) — owner: Conner, tracked in `/operator/outreach`.
2. **Replies** — whatever they are. First market data this business has ever collected. No target; a baseline.
3. **Discovery calls booked** — the week-2 number this whole plan serves.
4. Health: pieces published passing gates (target: 5 by Jul 17, never a zero week).
5. Health: % of site visits with a known source once analytics is live (target: >80%).

## Standing constraints (unchanged, enforced)

- Truth Wave: no fabricated customers, counts, quotes, or saved-time figures. The dogfooding brokerage is the only production story we tell, and the demo runtime is always labeled demo data.
- No saved-time numbers anywhere until the guarantee writers close the 4-of-7 gap (audit dept 9). A wrong number on the proof shelf is worse than an empty shelf.
- Vendor invisible on customer surfaces; subprocessor lists on `/privacy` and `/security` are the sole exception.
- Trial facts verbatim from `lib/billing/facts.ts`: 7-day trial, card at signup, 14-day money-back. Pricing from `lib/pricing/tiers.ts`. Design partners get 3 months free; the phrase "pilot pricing" stays banned.
- Competitors named only on comparison surfaces, always with the honest where-they-win-first beat.
- Everything passes voice-gate and brand-gate before it ships. No HUSKY=0 on marketing copy.

## What this plan does not contain

No paid spend, no ad-creative production, no photography commissioning, no non-RE content, no new positioning documents, no new analysis layers. The full stop list with restart triggers is `05-what-marketing-must-stop.md`.
