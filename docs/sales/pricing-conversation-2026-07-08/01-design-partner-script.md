# 01 — Design-partner pricing conversation (the first-5 prospects)

**Use when:** the prospect qualified on the discovery call (playbook §4), the cohort has an open slot (3–5 partners total across all verticals — claims spine §5), and you are in the minute-22-to-27 block of the agenda or they asked first.

**The shape of the whole conversation:** free is the headline, the asks are the price, and the published number is stated in the same breath so the end of the pilot is never a surprise. A design partner who hears "$199 a month" for the first time in month three feels bait-and-switched. One who heard it on day one feels like the free months were real.

---

## 1. The frame you hold (not said out loud)

Three months free is not a discount. It is **payment in proof**: the weekly call, the on-record testimonial, and the case study are worth more to the business right now than three months of subscription (claims spine §5; CEO path-to-profitable §4 — at ~95% modeled margin the constraint is trust, not price). If the prospect will not pay in proof, they are not a design partner; they may still be a fine paying customer (route to `02-paid-tier-script.md`).

## 2. The "how much?" opening — say this

> "For you, nothing for the first three months. Let me give you the whole deal in one breath so there's no fine print: you'd be one of a small cohort of design partners. The pilot is free for three months, and you get a weekly thirty-minute call with me, directly, for the whole pilot. In exchange, we ask for three things: that weekly call actually happens, an on-record testimonial once you've seen value — not before — and a case study we write together, where you approve every word before anything goes public. At the end of the three months you either move to the standard published price or you walk away clean. No obligation to convert. And so the number never surprises you later: the standard price for you would be $199 a month for your seat. That's the same price on the public pricing page today."

Then stop talking.

**Why the number is in the opening:** stating the post-pilot price on day one is how the free months avoid leaving money on the table. The conversion conversation at day 80 becomes "as we said at the start" instead of a new negotiation. (Price: Regular solo seat, `lib/pricing/tiers.ts:110-116`. Adjust to their real seat count using the ladder in `02-paid-tier-script.md` §3 — e.g. a broker with 4 staff seats is 5 × $179 = $895/mo at Regular, `tiers.ts:112`.)

## 3. The terms, sentence by sentence (if they ask for detail)

**What they get** (claims spine §5, all four — do not improvise a fifth):

> "Three months free, starting when your systems are actually connected and drafts are flowing — not when you sign. If setup takes a week, that week is on us, not your clock."

*(Clock starts at activation, not signature — pipeline doc §4, ACTIVATION row. Say it; it reads as fairness and it is.)*

> "A weekly thirty-minute call with me for the length of the pilot. Not a success team — me. I should say plainly: that's a design-partner benefit, not something any paid plan includes, so it ends when the pilot ends."

*(Conner-time is Max/Custom only outside this program — `lib/billing/facts.ts:65`, `CONNER_TIME_TIERS`. Naming the boundary now prevents the churn-shaped misunderstanding at conversion the playbook §4 warns about.)*

> "Early access to what we ship next, and a direct line into what we build — design partners get first say in what connects next."

> "And a joint case study. We draft it, you approve every word. Nothing about your business goes public without your sign-off."

**What we ask back** (all three, always — a partner who heard only two got a different deal than the one we're running):

> "The weekly call has to actually happen — that's the mechanism, not a courtesy. An on-record testimonial once you've seen value, and only then; if the service doesn't earn it, you don't give it and you walk. And willingness to take a reference call or give a quote when a future prospect asks 'who's using this?'"

**The cohort line** (true today; never a fake countdown — claims spine §5 cap framing):

> "We're keeping the cohort small — a handful of partners across everything we do — because the weekly call doesn't scale past that. That's the honest reason it's free."

## 4. The transition-to-paid sentences (say these on day one AND at the week-10 call)

Day one, right after the terms:

> "Here's how the end works, so we both know now: around week ten of the pilot we'll look at the saved-time numbers together on our weekly call. If it's working, you move to the standard published price — $199 a month for your seat, month to month, cancel anytime. If it's not working, you tell me, you walk, and the testimonial and case study simply don't happen. You'll never get a surprise invoice — the card and billing only start if you actively convert."

At the week-10 call:

> "As we said at the start: standard price from month four is [$199/mo solo, or their ladder total]. Do you want me to set that up, or is there something the numbers are telling us first?"

**Which tier they convert to:** whatever the discovery call mapped them to (playbook §4). Most design-partner candidates are Regular-shaped. If they've been leaning on priority support during the pilot, name Partner honestly: "$299 for the solo seat gets you priority email and chat and a quarterly async check-in — not standing calls with me; those were the pilot" (`lib/pricing/tiers.ts:117-123`; `PARTNER_SUPPORT`, `lib/billing/facts.ts:78-85`).

## 5. Push-back handling specific to this conversation

**"Three months free — what's the catch?"** → playbook objection #14, verbatim:

> "The catch is stated, not hidden: a weekly 30-minute call, an on-record testimonial once you've seen value, and a case study you approve word by word. You're paying in proof, not dollars."

**"Can I get the free months without the case-study stuff?"** → the trade *is* the price:

> "Then it's not the design-partner program — it's the standard deal, which is honestly still good: 7-day free trial, card at signup, 14-day money-back guarantee from the first charge, cancel anytime. The three free months are what the proof is worth to us. Which shape fits you better?"

*(Standard mechanics: `lib/billing/facts.ts:27,51,54,57`. Offering the paid path here is the DP-TALK unstick play from the pipeline doc §4 — a paying customer who won't be referenced is a fine outcome, just not a partner slot.)*

**"Can you do six months free?" / any extension** → not yours to give on the call:

> "The program is three months — that's what the proof exchange is worth, and I keep the terms identical across the cohort on purpose, so every testimonial is describing the same deal. What I can flex is the start date: your clock doesn't start until you're live."

**"What if I want to pay from day one instead?"** → take yes for an answer:

> "Then you're my favorite kind of person. Standard signup, 7-day trial, and if you'll still do the case study, I'll still do the weekly calls for the first three months."

*(This is allowed: it's MORE than the published deal for us and the DP benefits are yours to grant within the program's own shape — see `04-discount-and-concession-limits.md` §1.)*
