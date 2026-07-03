# Georgia RE content pipeline — 5 pieces in 14 days, all in service of the send

**Rule for every piece:** written from `docs/marketing/CREATIVE_PACK_GROUND_TRUTH.md` and `lib/verticals/real-estate/content.ts`; trial facts from `lib/billing/facts.ts`; passes voice-gate + brand-gate + the pre-ship checklist in `deep-dive-2026-07-02/05-brand-voice-do-and-dont.md`; every number carries a source or it doesn't ship. Competitors are named only on these comparison surfaces and every comparison opens with where the incumbent wins first.

**Why these five:** the Monday prospects run these exact tools. A first-touch email that links "here is our honest take on the tool you already pay for" outperforms one that links a home page, and it proves we did the homework before asking for their time. Keywords are drawn from the ratified map in `deep-dive-2026-07-02/02-seo-aeo-content-pipeline.md` (RE rows 1, 4, 5, 10, 11, 14).

**Publishing surface:** the three comparisons extend the existing `/compare/[alt]` pattern (#289); the operator story and the demo write-up need one thin article surface from Product (ask filed in `04-what-i-need-from-other-heads.md`). If the article surface slips, both publish as long-form sections on `/real-estate` rather than slipping the dates.

---

## Piece 1 — "Keep Follow Up Boss. We do the work around it."
- **Publish:** Monday Jul 6, 8am ET, before the send. Linked in the first-touch emails to any prospect running FUB.
- **Type / keyword:** comparison; "follow up boss alternatives for solo agents" (map row 10).
- **The argument:** FUB wins first at pipeline of record, lead routing, and drip at volume; keep it. What it cannot do is the work between the records: the 9pm two-sentence replies, the commission-invoice chase, the recap nobody writes. The fleet drafts that work beside the CRM; you approve and send. Not an alternative. The layer around it.
- **Claims whitelist:** live integration story is email + calendar + QuickBooks (+ DocuSign/Drive on the realty stack). FUB itself is works-alongside, not wired. Say exactly that.
- **Structure:** direct-answer paragraph, where-FUB-wins-first section, the between-the-records list, the control line, honest FAQ (4 items), CTA to `/real-estate` and the booking link.

## Piece 2 — "A $26,262 typo"
- **Publish:** Wednesday Jul 8.
- **Type / keyword:** compliance explainer doubling as the BoldTrail comparison; "fair housing penalty first offense amount" (AEO, map row 5) + "boldtrail vs building it yourself" (row 11).
- **The argument:** $26,262 is the first-offense fair-housing civil penalty (cite the current HUD inflation-adjustment notice; verify the figure against HUD before publish, and if it has been adjusted since the ground-truth doc was written, print the current number). BoldTrail-class automation wins first at scale: drips, nurture, lead scoring. But its automation *sends*. Ours drafts, a compliance review reads the draft against the fair-housing corpus, and a person approves. For real estate this is the whole ballgame, and it is the piece most likely to get quoted by an answer engine because it answers a dollar-figure question plainly with a citation.
- **Claims whitelist:** the live fair-housing scanner covers real estate (`BASELINE_LIVE_VERTICALS`) — this is the one vertical where we may say it plainly. Do not generalize to other verticals.
- **This is the strongest piece in the pipeline.** It carries a cited number, a named fear every broker has, an AEO query with a literal answer, and our structural differentiator in one story.

## Piece 3 — "We run it on our own brokerage. Here is an honest week."
- **Publish:** Friday Jul 10. Referenced in the Jul 12 touch-2 follow-ups.
- **Type:** operator story. The only production story that is true today, told concretely for the first time: what the fleet reads inside our own brokerage workspace, what landed in the approval queue across one real week, what a person edited before sending, and what stayed unsent. Real internal screenshots (Product ask #1), real dates, no customer anywhere in the frame.
- **Truth handling:** we name it as dogfooding in the first paragraph. We do not publish saved-time minutes (writers gap, audit dept 9). Counts of drafts shown in a screenshot are fine because the screenshot is the source. Degraded-mode honesty applies: cadence language, drafts land in the queue, nothing live-magic.
- **Why it earns its slot:** every prospect on Monday's list will ask some version of "does anyone actually use this?" This is the honest answer, and it reads nothing like the case-study slop they are used to. It is also the piece a skeptical broker forwards to their partner.

## Piece 4 — "From new lead to drafted first touch: the five-minute walk-through"
- **Publish:** Tuesday Jul 14. Armed for week-2 discovery calls: it is the pre-read Sales attaches when a call books.
- **Type / keyword:** killer-workflow demo write-up; "how do brokers handle inbound lead triage" (AEO, row 6) + "overnight transaction summary for brokerages" (row 14) as the secondary section.
- **The argument:** a screenshot-level walk-through of the real-estate killer workflow from the demo runtime (PR #303): inbound lead arrives, the fleet drafts a qualifying first touch, the draft waits in the approval queue with the compliance pass visible, the broker approves. Labeled **demo data** in the opening paragraph and in every caption. The demo runtime exists precisely so we can show the product truthfully without a customer; this piece is that capability in public.
- **Claims whitelist:** LLM-free deterministic demo, synthetic data, so nothing here depends on the paused key. Never imply the screenshots are a customer workspace.

## Piece 5 — "Sierra builds the storefront. Who answers the door?"
- **Publish:** Thursday Jul 16.
- **Type / keyword:** comparison; Sierra vs run-for-you ("ai assistant for real estate agents alternatives", row 1).
- **The argument:** Sierra wins first at IDX websites coupled to CRM: if the pain is "my site doesn't capture leads," start there. The gap is the same between-the-records gap as FUB, plus the auto-send distinction from piece 2. Closes the comparison set so that by week 2 all three tools the Georgia prospect pool actually runs have an honest page we can link in any follow-up.

---

## Pipeline mechanics

- Order of operations per piece: brief frozen (today) → draft against ground truth → voice-gate + brand-gate + claims check → publish → log in the tracker (`docs/marketing/content-calendar-90-days.md` gains a status column, per the deep-dive) → UTM-clean URL handed to Sales same day.
- All five briefs are frozen now; no new briefs enter the window. If a Monday reply surfaces a better question than one of these, the answer becomes a follow-up email from Conner first and a piece only after the window closes. Replies outrank the calendar, but the calendar does not churn mid-window.
- Non-RE content: none. The other verticals' pages stay as they are until 2 RE pilots are live (kill list).
