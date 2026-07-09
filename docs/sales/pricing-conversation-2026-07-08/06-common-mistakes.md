# 06 — The 8 pricing-call traps

Founders fall into the same eight holes on pricing calls. Each entry: the trap, why founders specifically fall in, the tell (how to notice it happening live), and the exact sentence that replaces the mistake. Review before every call week; log any trap you fell into in the playbook §7 living log — verbatim, same day.

---

## 1. Leading with price

**The trap:** opening the call, or the pricing block, with the number — before the prospect's pain is named and before they've seen the queue.
**Why founders do it:** nervousness. The number feels like the hard part, so you rush to get it over with — which converts the call into a cost conversation you haven't earned value in.
**The tell:** you hear yourself saying a dollar figure before you've heard their Tuesday.
**Instead:** hold the playbook slot (pricing at 22–27; `05-timing-and-cadence.md`). If *they* ask early, answer immediately with the number plus the dependency: "$199 a month solo — whether it's worth that depends on what your week looks like, which is what I want to spend our time on." (`lib/pricing/tiers.ts:110`.)

## 2. Over-explaining tiers

**The trap:** presenting all three tiers, five seat bands, and the trial matrix as a guided tour. The prospect came in with one question ("what does this cost *me*?") and leaves with fifteen.
**Why founders do it:** pride in the pricing architecture. You built the ladder; the prospect doesn't need the ladder, they need their cell in it.
**The tell:** you're saying "and then there's also…" for the second time.
**Instead:** present the one tier discovery mapped them to (playbook §4), with their seat count priced: "For you this is Regular, one seat, $199 a month." Name Partner or Max only on a real signal (02 §3). The full table exists on the pricing page for their homework.

## 3. Apologizing for the number

**The trap:** "it's $199 a month… but there's a trial, and honestly for the pilot folks it's free, and…" — the discount cascade delivered before the prospect said anything at all.
**Why founders do it:** the founder knows the bank balance behind the price and projects their own anxiety onto the buyer. The buyer just paid $600 for a CRM add-on without flinching.
**The tell:** softeners around the number ("it's, uh, it comes to about…"), or stacking mitigations in the same breath as the price.
**Instead:** the number, flat, then silence: "Regular is $199 a month for your seat." Count to three. The trial and guarantee are the *mechanics answer* — deploy them when asked "what if it doesn't work?", not as armor for the price. At a modeled ~26× return on recovered hours (`lib/verticals/real-estate/content.ts:240-243`), the number is defensible; deliver it like you believe the model.

## 4. Discounting without an ask in return

**The trap:** "how about $150?" — conceding price to make discomfort end, getting nothing back.
**Why founders do it:** reciprocity pressure in a live conversation, plus the marginal-cost illusion ("one more customer at any price is free money"). At ~95% modeled margin the constraint is trust, not price — a discount doesn't buy trust, it un-prices the list (CEO path-to-profitable §4).
**The tell:** you're about to say a number that isn't in `lib/pricing/tiers.ts:106-131`.
**Instead:** every concession is a trade, and the only pre-approved trade is proof: "The price is the price — what I *can* do, if you're a fit for it, is the design-partner program: three months free, in exchange for the weekly call, an on-record testimonial, and a case study you approve." Anything below the ladder is a Conner-decides-later, never a Conner-decides-live (`04-discount-and-concession-limits.md` §2).

## 5. Promising features to close

**The trap:** "Buildium? We'll have that soon" — a roadmap commitment invented at the moment of maximum motivation and minimum authority.
**Why founders do it:** the founder *can* build it, so it feels like honesty rather than a promise. But the prospect hears a date, and the pilot starts with a broken promise on day one.
**The tell:** the words "soon," "next quarter," or "we're working on" attached to anything not in the live-integration story (email, calendar, QuickBooks, DocuSign, Drive — claims spine §6).
**Instead:** playbook objection #16, verbatim: "Your [tool] is on the roadmap — I won't give you a date I can't keep." If they'd *fund* it, that's a `/custom` scoping conversation, taken away from the call (playbook §4, Custom flag).

## 6. Agreeing to invoice / PO / net-terms on a first call

**The trap:** "can you just invoice us monthly?" — "sure!" You've now committed to building accounts-receivable, a collections process, and an exception to the billing system, to close one seat.
**Why founders do it:** it sounds like a formality, and refusing feels bureaucratic when you're the one who makes the rules.
**The tell:** any billing arrangement other than card-at-signup via checkout leaving your mouth (`CARD_REQUIRED_AT_SIGNUP`, `lib/billing/facts.ts:54`).
**Instead:** "Billing runs card-at-signup — that's the system, and it's part of why the price is what it is. If your org genuinely can't buy without procurement paper, that's usually a sign you're a Max-shaped conversation — let me take that away and come back by [date]." (Max/Custom is where bespoke commercial terms live, after scoping — `lib/pricing/tiers.ts:20-24`.)

## 7. Fumbling the monthly/annual frame

**The trap:** two failure modes, same root. (a) Anchoring *value* monthly so the sticker fight happens at "$199 vs my $40 CRM," when the honest annual frame — roughly $62K a year of modeled recovered time against $2,388 a year of subscription — is the real comparison. (b) Worse: inventing an annual-commit discount on the spot to make the monthly number feel smaller.
**Why founders do it:** SaaS reflex — annual prepay is the standard playbook for retention, so it feels professional to offer one.
**The tell:** you're describing the price in a frame that doesn't exist in `lib/pricing/tiers.ts` (which is monthly-only — every Stripe lookup key ends `_monthly`, `tiers.ts:236-239`).
**Instead:** **anchor value annually, quote price monthly, never sell a lock-in.** "Our model says that's about $62,000 a year of your time back; the service is $199 a month, month to month, cancel anytime — we're month-to-month on purpose, because we'd rather earn month thirteen than contract for it." Month-to-month with a money-back guarantee is the bounded-downside trust story we tell everywhere (playbook objection #2); retention comes from saved-time evidence, not contract terms. (Annualized value: ~$61,920/yr, claims spine §6; `CANCEL_ANYTIME`, `facts.ts:57`.)

## 8. Forgetting the value anchor

**The trap:** naming the price with no value context at all — usually after a demo that went long. "$199 a month" lands as pure cost, and the prospect silently compares it to Netflix.
**Why founders do it:** the demo felt like the value argument, so the anchor feels redundant. It isn't — the demo showed *that* it works; the anchor prices *what* it's worth to them.
**The tell:** the sentence before your price contains no dollar figure or hour count belonging to the prospect.
**Instead:** the 02 §1 sequence is mandatory, even compressed to two sentences: "You said follow-ups eat two hours of your day — at your rate that's a few thousand a month before we've said a price. Regular is $199." Their own numbers first (customer-attested by construction); our modeled math second, always labeled a model (Truth Wave discipline — and note the published $2.9K–$10.6K/mo range carries an open audit P1 on its derivation, so the traceable per-vertical math leads: 02 §1, sources listed there).

---

## The pre-call 30-second checklist

1. Which tier did I map them to, and what's their seat count's exact ladder price? (`tiers.ts:106-131`)
2. Is a design-partner slot open, and are they a fit?
3. What did discovery give me for the value anchor? (If nothing yet — get it before pricing.)
4. What am I allowed to concede? (Nothing below the ladder. The program, the clock, the guarantee — that's the whole budget: 04 §1.)
5. The number, said out loud once, without apology, in an empty room.
