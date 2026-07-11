# 04 — CPA discovery playbook (adapted from the RE 20-minute kit)

**Lineage:** `docs/sales/discovery-2026-07-08/` is the parent; its structure, standing rules, close language, and the model-vendor-invisibility crib sheet apply **unchanged** — this file only swaps the vertical-specific parts: the three discovery questions, the demo, and five CPA-specific objections. Where a topic isn't covered here, the parent kit's answer is the answer. The RE objection library's trust and pricing sections (solo founder, will-you-exist, monthly billing, cancel terms) transfer verbatim.

**Timebox unchanged:** frame 0–2 · three questions 2–6 · demo 6–12 · pricing + offer 12–16 · objections 16–18 · close 18–20. Recorded with stated consent. Vendor invisibility governs. Zero named accounting customers, said plainly — the sanctioned proof substitute at activation time: our first design partners are Georgia real-estate brokerages, running weekly (never named on a call without their written OK).

**One CPA-specific frame note for minute 0–2:** to this buyer, the approval gate isn't a feature, it's their professional obligation made visible. Land the sentence early: *"Nothing reaches a client or a filing without someone at your firm approving it — you keep the pen, which is what Circular 230 already expects of you."* Say "Circular 230" once, correctly, and stop — the prospect knows the rest; overexplaining their own rules reads as selling.

---

## The three discovery questions (memorize, verbatim)

**Question 1 — the pain:**

> "Walk me through your last month-end close — or the last week of a filing season, your pick. Where did the days actually go?"

*Their answer is the case-study "before" in their own words. Listen for the chase: missing documents, unanswered client emails, status requests. A partner who says "my staff handles all that and it runs fine" with no named residue = no recurring draft-shaped work = no pilot. The seasonal double-barrel matters: month-end pain means year-round value; season-only pain shapes the seasonal-pricing objection you'll get at minute 16.*

**Question 2 — the activation gate in disguise:**

> "What runs the practice — practice management, tax software, email, books, e-sign? And the client chasing specifically: who actually types those emails today?"

*Pilotable this month: Gmail or Outlook/M365, QuickBooks Online, DocuSign. Honest not-yet: a firm whose entire client communication loop lives inside TaxDome or Karbon and who expects us to read it — the connect step for both is coming-soon, not live (`lib/integrations/marketplace.ts`), and we say the word "roadmap" out loud. Tax software (Drake, Lacerte, UltraTax) is never a gate — we don't touch return prep at all, and saying so early defuses the integration objection before it forms. The "who types" half names the operator the pilot will train.*

**Question 3 — the risk story:**

> "Has anything ever gone out to a client — or into a filing — that shouldn't have? What happened?"

*The CPA version of the RE fair-housing question. Their own story sells the approval gate better than our copy: a preparer-penalty scare, a client who got another client's numbers, a staff email with the wrong entity's figures. Whatever they tell you scripts the demo narration two minutes later. If nothing surfaces, the fallback probe: "when a client emails at 9pm during the season asking where their return stands — what happens before 9am?"*

## Minute 6–12 — the demo

**The recommended killer workflow: client-doc-chase-with-context.**

Why this one and not the tax-return-status-batch-updater (the other candidate):

1. **It's already the codebase's own story.** The CPA vertical's value-loop example (`lib/verticals/cpa/content.ts`) is exactly this scene: March 17, eight days to deadline, 23 clients missing documents; the fleet drafts 23 individualized chase emails citing the specific missing items, skips the 4 on extension, queues everything for partner review — 6 hours of evening work becomes 35 minutes of reviewing.
2. **It matches the ratified ROI math.** The doc chase consuming ~25% of staff hours for 8 weeks a season is the cited anchor behind the CPA ROI block. Demoing the workflow the math is built on keeps the minute-13 value conversation on one set of rails.
3. **It's honest about today's connectors.** A status-batch-updater needs to read practice-management or tax-software state — exactly the TaxDome/Karbon surface that's coming-soon. The doc chase runs from what's live: the inbox thread, the calendar, QuickBooks, the document folder.

**Honesty notes for the demo, load-bearing:**

- Same rule as RE: **"This is a demonstration workspace running on synthetic data — the real product, not your data and not anyone else's."** Never demo on any firm's real client data; with this vertical the demo data itself must contain no plausible-looking SSNs or EINs.
- The demo runtime that autoplays today is the RE lead-triage story (Peachtree seed). **A CPA doc-chase demo story does not exist yet** — building it is the one flagged build item on the activation checklist (doc 09). Until it ships, the honest bridge: demo the live approval queue on synthetic inbox drafts and narrate the doc-chase scene from the vertical page's own example — never imply the CPA workflow is running live in front of them if it isn't.
- The CPA agent roster on `/cpa` says it honestly: doc-chase is *rooting* pending portal connects; Client Inbound and Chief of Staff are the live cards. The pilot-scope version of the doc chase runs email-native (inbox + QBO + Drive/OneDrive state). Scope claims to that on the call.

**Narrate the same three beats as RE:** the trigger (a client's missing-items list, assembled), the edit (change one word — it learns the firm's tone), the approve ("your staff approves it, and it goes out through *your* email, under *your* name — the fleet never sends anything; that's architecture, not a setting").

If their Question-3 story was a wrong-client or wrong-numbers scare: lean the narration on the review pass — *"this is where that email would have been caught, and then it still waits for you."* Do **not** claim the CPA compliance checklist is live — the compliance sentinel activates after counsel review and the roster says so; the human gate is the live compliance story.

## Minute 12–16 — pricing + offer (deltas from RE only)

- The value model: use the CPA anchor honestly labeled — *"the way we model it, the chase-and-draft work in a season costs a firm your size roughly $10,000 per staff seat in loaded hours — that's a model, not a customer result, and I'll be straight that no accounting firm has attested a number yet."*
- Tier at conversion: **Partner** — $299/seat solo, sliding to $199 — because the weekly-review cadence fits tax-season rhythm. Same clarity line as RE: the weekly *founder* call is a design-partner benefit; conversion is normal price, normal support.
- Trial mechanics if asked: CPA firms get a 14-day trial (extended for this vertical), card at signup, 14-day money-back — but the design-partner offer (three months free) supersedes trial talk on these calls.

## Minute 16–18 — the five CPA-specific objections

Format inherited: **short answer, then stop talking.** Long form only on push. Everything traces to shipped code or the claims spine; where the honest answer is "counsel is reviewing," that is the answer.

**C1. "What are the AICPA implications of handing client work to your service?"**

Short: > "The Code lets you use outside service providers for exactly this, with two conditions we're built around: confidentiality in writing, and your firm keeping responsibility for the work. Every draft waits for your review — we never take the professional judgment off your desk."

Long: > "Concretely: the confidentiality terms live in our published privacy and security pages and in the agreement we sign; your raw client records stay in your systems — we read them where they live rather than warehousing them. And the responsibility condition is the architecture: the fleet drafts, a person at your firm approves, the deliverable is yours. If your ethics counsel wants the third-party-service-provider question answered in writing, send me the ask — I'd rather answer it precisely than generally." *(Log every such ask — it's the demand signal that sequences the counsel packet, same as the RE DPA rule.)*

**C2. "Client PII, IRS rules on return information — how does that work?" (Circular 230 / §7216 territory)**

Short: > "Two buckets, plainly. Your client records — the returns, the books, the documents — stay in your systems; the fleet reads them there to draft. What we keep is the working memory of your firm — your tone, your preferences — and it's yours, exportable and deletable. And nothing the fleet drafts reaches a client or a filing without your approval, which keeps your Circular 230 posture intact rather than complicating it."

Long: > "The tax-specific rules on return information are ones we take at full weight — our counsel review for the accounting vertical covers the return-information statutes specifically, and I'll be straight that if your firm wants that analysis in writing before connecting anything, that's a reasonable bar and I'll tell you honestly whether we've cleared it yet rather than improvise on a call. What I can state today without hedging: your data works only for your firm, the subprocessor list is published, and there is no send path from our side at all." *(Never recite statute analysis on a call. §7216 handling is counsel's, per doc 08 — the sales-side line is the honest deferral above.)*

**C3. "Will this train on my clients' data?"**

Short: > "Your data works for you, not for our other customers. What improves from your usage is your own workspace — your firm's voice, your preferences, your corrections — and that memory is yours for the life of the account."

Long: > "We don't take your client records and use them to build the product for somebody else — and your raw records aren't sitting in a warehouse of ours to begin with; they stay in your tools. The formal terms are in the privacy policy, subprocessors on the security page. If your engagement letters or your insurer need that stated in writing, send both pages and I'll answer what's left." *(Banned framings apply: never "nothing is stored," never "it forgets." Vendor training practices are never discussed — crib sheet.)*

**C4. "Does it integrate with TaxDome / Karbon / Drake / Lacerte?"**

Short: > "Not today, and I won't fudge it: TaxDome and Karbon are built but not yet connectable — the tiles in the product say 'coming soon' because that's the truth. Drake and Lacerte we don't touch at all, on purpose — we never go near return prep. What's live is the layer the chasing actually happens in: email, calendar, QuickBooks Online, DocuSign, your document folders."

Long: > "The honest architecture answer: the read layer for TaxDome and Karbon exists and is tested; what hasn't shipped is the connect step where you paste your own key. Design partners get first say on exactly that sequencing — if the TaxDome connect is your make-or-break, that's precisely the roadmap vote you'd own. Meanwhile the doc chase, the client replies, and the follow-ups run from the inbox and the books — which is where your staff types them today anyway." *(Never promise a connect date. The tiles flip only when the bespoke connect forms ship — pinned by test.)*

**C5. "Our work is seasonal — can pricing be seasonal?"**

Short: > "The billing model is month-to-month with no contract — so the honest version of seasonal pricing already exists: scale seats down after the season, scale up before it. I won't invent a discount structure we don't have."

Long: > "Two honest angles. First, month-to-month means you're never paying for a shape of firm you aren't currently running. Second — and this is worth testing in the pilot rather than taking from me — the off-season is where firms like yours say the drafting work hides: monthly books clients, quarter-close chases, advisory follow-ups. If the pilot shows the value is genuinely eight weeks a year, you'll have the data to run it eight weeks a year, and the exit costs nothing. That's a better answer than a seasonal rate card I'd be making up." *(Internal, never said: a seasonal-pause billing module is parked under KILL #7. Do not promise it; log the ask if it recurs.)*

## Minute 18–20 — close

Unchanged from the parent kit: book it (kickoff on the calendar before goodbye) or date it (named blocker + named date) or a clean no with the learning question logged verbatim. The disqualification framework transfers with one addition:

**CPA-specific walk-away signal — the season stall.** "Come back before next season" with no named month is the CPA version of the compare-stall. The honest test: *"Which week, and what would need to be true by then?"* A real answer gets a dated CRM row. No answer gets the warm close and the one-pager, and the row is logged not-yet — never left as an undated 'someday.'
