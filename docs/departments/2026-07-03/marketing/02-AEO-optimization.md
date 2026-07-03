# AEO for the five pieces — being the quoted answer, not just a ranking

**Baseline (do not rebuild):** technical SEO is done — programmatic `robots.ts`/`sitemap.ts`, canonicals, JSON-LD infrastructure in `lib/seo/structured-data.ts`, direct-answer blocks and 44 FAQs from #286, `/compare` + `/glossary` owning the category vocabulary from #289. These five tactics apply that machinery to the five new pieces. Answer engines quote pages that answer plainly, cite verifiable facts, and read like someone accountable wrote them. Our honesty posture is the AEO strategy; nothing below invents credibility.

---

## Tactic 1 — Direct-answer paragraph first, on all five

Every piece opens with a 40–80 word literal answer to its target query before any narrative, matching the #286 pattern. The two AEO-marked queries get exact-answer treatment:

- Piece 2 opens: the current first-offense fair-housing civil penalty amount, in the first sentence, with the HUD citation in the same paragraph. Answer engines resolving "fair housing penalty first offense amount" want a number, a date, and a source; give all three inside 60 words.
- Piece 4 opens with a literal answer to "how do brokers handle inbound lead triage" as a numbered four-step summary, then the walk-through expands it.
- The three comparisons open with the honest one-liner ("Keep X for A and B. It does not do C; that work is what we draft.") so the extracted snippet carries the where-they-win-first concession. A concession inside the quoted answer is the most credible sentence an engine can lift from us.

## Tactic 2 — Schema markup matched to content type, nothing fabricated

- **FAQPage** on all three comparisons (each ships 4 real FAQ items) and on piece 2.
- **HowTo** on piece 4 (the walk-through is literally steps; captions become step text).
- **Article** with real `datePublished`/`dateModified` on all five; the operator story also carries Organization authorship.
- **Never:** aggregateRating, Review, or any social-proof markup. We have no reviews; fabricated markup is a Truth Wave violation and a penalty risk (deep-dive 02, tactic 2). This stays a hard rule even though rating stars are the most-clicked snippet furniture in the category.

## Tactic 3 — Cited-figure discipline: a number with no source doesn't ship

The pieces carry exactly the numbers we can defend, sourced inline:

- $26,262 (or the current adjusted figure) → the HUD civil-penalty inflation notice, linked. Verify before publish.
- Subscription math → `lib/pricing/tiers.ts` values, stated as our prices.
- ROI framing → only the calculator's own labeled inputs (10 hrs/wk × $100/hr × 4.3), presented as "our calculator's illustrative defaults," never as observed customer results. The home page's unsourced $2,900–$10,600 range (audit dept 1, finding 3) does not appear in any piece.
- Saved-time minutes → absent entirely until the audit-9 writers gap closes.
- Third-party market stats (speed-to-lead response benchmarks etc.) → only with a named source, or the sentence gets rewritten to not need the stat. When in doubt, cut the number; the argument survives on mechanism.

## Tactic 4 — Credibility signals that are true

- Author line: "the agentplain team" until the founder-bio decision clears the Conner queue; the day it clears, pieces 3 and 4 get Conner's byline retroactively, because an operator story with a named operator is strictly stronger. (Decision already queued; not blocking.)
- Honest "Last updated" stamps rendered on-page and matching `dateModified`.
- Piece 3's dogfooding disclosure in paragraph one is itself a credibility signal: engines and readers both discount undisclosed self-reference, and disclosure is what makes the story quotable.
- Each comparison links the target tool's own site once, plainly. Pages that link the thing they compare read as evaluation, not attack.
- No invented personas, no stock experts, no "as seen in."

## Tactic 5 — Own the vocabulary and check whether it's working

- Every piece links its key terms to `/glossary` ("run-for-you," "approval queue," "drafts, never sends") and internally links the other four pieces plus `/real-estate` and `/guarantee`, forming one crawlable RE cluster in a single hop from the vertical page.
- Seed the citation check now instead of waiting for the monthly cadence: on Jul 10 and Jul 17, run the five target queries (one per piece) through the major assistants and log whether we are cited, in the same tracker as the publishing log. Misses feed the next brief cycle after the window. This is the deep-dive's 25-query monthly check, started small and early on exactly the queries the Monday prospects are most likely to ask an assistant.
