# GTM — how home-services marketing changes with the supplement wedge

**Date:** 2026-06-06
**Depends on:** `WEDGE.md`. The wedge is supplement & claims-documentation depth, roofing
first. Everything here re-points the existing `/home-services` surface at that wedge.

All copy below obeys the locked rules: brand voice is heritage/calm, not chirpy
(`~/memory/project_plaino_named_agent.md`); banned framings (V0, agent counts, "pilot",
"realty-only") stay out (`~/memory/feedback_everything_tells_a_story.md`); audience is
"local businesses" / "trades operations," never "SMB"
(`~/memory/project_agentplain_mission_and_positioning.md`); ROI claims cite the audit
(`~/memory/feedback_no_guesses_no_estimates.md`).

---

## The positioning shift, in one line

**From:** "An agentic fleet for the residential trades operation" — a broad, 9-card
roster where the supplement is one card among nine
(`lib/verticals/home-services/content.ts:122-131`).

**To:** "agentplain gets your storm supplements written and paid." — supplement depth is
the hero; the rest of the roster is supporting cast.

The current hero leads with "REPLACES the lead-source juggle and the insurance-supplement
scramble" (`content.ts:129-131`) — it bundles lead-juggle and supplement as co-equals.
The shift is to **demote the lead-juggle clause and lead with the supplement**, because
that's the square we win (`WEDGE.md`) and the lead square is the one we concede.

---

## New hero copy (proposed, for `lib/verticals/home-services/content.ts`)

> **Eyebrow:** Built for storm & restoration trades
> **Headline:** Get your supplements written, evidenced, and paid.
> **Value prop:** agentplain reads the adjuster's scope line by line, drafts the
> supplement the carrier owes you — every line backed by your photos, your measurements,
> and the code cite — and keeps it moving until it's approved. You sign and send from
> your own systems. It also routes your leads and runs your estimate follow-ups, but the
> money is in the claim.

This keeps the existing INTEGRATES honesty (Outlook, Gmail, QuickBooks ship today;
everything else is roadmap — `content.ts:123-131`, `lib/integrations/marketplace.ts`) and
the no-outbound truth ("sign and send from your own systems").

---

## New JTBD framing — lead with the back office

The current JTBD tables (`content.ts:137-266`) put Owner first but spread attention across
Owner / Sales rep / Dispatcher / Service technician / Office manager. The supplement wedge
**re-orders to lead with the two roles that live in the claim**: the Office Manager /
Production role and the Owner. Dispatcher / technician tables stay (they read for
FSM-shop visitors) but move below the fold.

### Hero JTBD table — Office manager / production (the supplement owner)

| Job | When | Today | With agentplain |
| --- | --- | --- | --- |
| Read the adjuster's scope and prepare the supplement | Storm-season default — **30–60% of back-office time** | Hand-drafted in Word, faxed or emailed | Supplement agent reads the scope, drafts the line-item rebuttal with code + measurement + photo evidence on every line |
| Assemble evidence for each supplement line | Per claim | Hunt through CompanyCam / Drive / EagleView reports manually | Evidence agent binds the photo + measurement + code cite to each line item |
| Re-submit denied / partially-approved lines | Per claim, repeatedly | Re-draft from scratch, often dropped | Cadence agent drafts the re-submission on denied lines with stronger evidence |
| Draft close-out compliance docs | Job completion | Form-letter or skipped | Docs agent drafts lien waiver, cert of completion, EPA RRP, warranty language (state-specific) |

The "30–60% of back-office time" figure is already in the product
(`content.ts:253`) and is the single most quotable stat for this wedge.

### Owner table — re-pointed to claim P&L

| Job | When | Today | With agentplain |
| --- | --- | --- | --- |
| See dollars left on the table across open claims | Continuous through storm season | Gut feel | Claims view — every open claim with the supplement opportunity and its status |
| Sign off on supplement submissions | Continuous | Manually drafted in Word | Sign the drafted line-item supplement; route to the carrier from your own system |

---

## New ROI claim (sharpened, same citation)

Keep the audited number; lead with it instead of burying it.

> **$50,000+ per year in recovered supplement revenue at a storm-heavy shop** — the single
> line item that pays for agentplain many times over.
> *Source: `b2b_vertical_opportunity_analysis_2026-04-27.md` §3.3, cited at
> `lib/verticals/home-services/content.ts:271-275`. ~14x against a single Partner-tier
> seat ($299/mo).*

Sharpen the framing from "14x ROI" (abstract) to "**recovers $6–7K on a typical hail
job**" (concrete, from the value-loop demo in `PRODUCT_SPEC.md` Slice 1). One concrete
job beats a multiplier for a roofer reading the page.

---

## Persona targeting — narrow the ICP

**Old ICP (implied):** "5–25 crew residential trades operation" across roofing / HVAC /
plumbing / electrical / GC (`content.ts:5-10, 31`). Broad.

**New ICP (sharp):** **storm/restoration roofing shops doing $3–25M/yr with a heavy
insurance-claim revenue mix** — owner-operator or small partnership. This is the audit's
roofing pick: "highest deal size + insurance-supplement workflow + lower competitive
density" (`docs/agent-interviews/02-vertical-agents.md:183`).

- **Primary persona:** the **owner who lives and dies on supplement approval** — knows
  exactly how much each storm leaves on the table, currently relies on one overloaded
  supplement specialist or a third-party supplementing service taking a cut.
- **Secondary persona:** the **supplement specialist / production manager** — the person
  spending 30–60% of their week reading scopes. agentplain is their leverage, not their
  replacement.
- **De-prioritize:** pure service/maintenance HVAC & plumbing (small claim surface — they
  can still buy for lead-routing + follow-up, but they are not the wedge ICP).

Expansion axis is the **insurance-claim axis** (roofing → water/fire restoration →
storm-exposed exteriors), not the trade axis. Per
`~/memory/feedback_no_new_verticals_finish_locked.md`, prove roofing before widening.

---

## GTM motion (consistent with prior planning)

The vertical head already pre-drafted a **door-knock + ride-along** motion, distinct from
the owner-broker email motion used for realty
(`docs/agent-interviews/02-vertical-agents.md:185`: "trades-specific brand voice
(jobsite-aware, work-focused)… coordinate door-knock + ride-along GTM"). The supplement
wedge sharpens that: the demo is **bring a real denied/short adjuster scope, watch
agentplain draft the supplement live.** That single demo is the entire pitch — it shows
recovered dollars on the prospect's own claim. No abstract feature tour.

Channel content (for `media-*` skills, draft-and-propose, no ad spend per
`~/memory/project_media_discipline.md`):

- **Hero asset:** "The $6,800 the carrier didn't pay you" — a real (anonymized) short
  scope → supplement walkthrough.
- **Top-of-funnel:** "11 line items adjusters miss on every hail roof" — educational, SEO
  for "roofing supplement," "Xactimate supplement," "insurance scope short."
- **Proof:** before/after supplement-recovery dollars per storm.

---

## What changes in the codebase (copy only, for a later PR — not this one)

This doc is strategy. The implementing copy changes land in a separate feature PR:
- `lib/verticals/home-services/content.ts` — hero, JTBD re-order, ROI sharpening, ICP
  language.
- `lib/skills/prompts/home-services.ts` — `draftToneGuidance` already correct (plain,
  defer price/time); add supplement-specific framing when Slice 1 ships.
- Meta title/description (`content.ts:133-136`) — re-point to "storm & restoration
  supplements" for SEO.

None of those are in scope for this doc-only strategy PR.
