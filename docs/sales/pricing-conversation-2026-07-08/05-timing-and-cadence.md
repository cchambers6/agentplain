# 05 — Timing: when the pricing conversation happens

**The governing agenda** is the playbook's §1 (30 minutes): discovery at 3–15, demo at 15–22, **qualify + the ask at 22–27** — pricing lives in that block. The principle behind the slot: **price lands after their pain is named in their words and after they've seen the approval queue** — never before either. On a compressed 20-minute call, hold the proportions: discovery to ~10, demo to ~14, pricing at **~14–18**, next step 18–20.

*(If any earlier sales doc says "minute 12–16 of 20" — this file and the playbook supersede it; same principle, the playbook's proportions.)*

---

## 1. The default sequence inside the pricing block

1. **The bridge from the demo** (one sentence): "So that's the thing working. Let's talk about whether it makes sense for you, including what it costs."
2. **Tier mapping, silently** — you've already mapped Regular/Partner/Max from discovery (playbook §4). Present one tier, not a menu.
3. **Value anchor** (02 §1) — their numbers, then the modeled math.
4. **The number, or the program** — `02` for standard, `01` for a design-partner fit.
5. **Mechanics** — trial, card, guarantee, in one breath (02 §5).
6. **Silence.** Then the next step with a date (playbook §1, 27–30).

## 2. Signals that move pricing EARLIER

- **They ask.** The overriding rule — see §4.
- **A disqualifier surfaced in discovery** (locked stack, PMS-only books, wants auto-send): don't run the demo-then-price theater for a prospect you're about to disqualify. Disqualify warmly at the moment it's clear (playbook §4) — pricing never happens at all.
- **They arrived pre-sold** ("saw the pricing page, the demo at the association meeting — I want the terms"): skip to the ask. Respect for their time closes better than agenda adherence. Confirm the qualification boxes conversationally afterward.
- **A hard stop is announced mid-call** ("I have to jump at :20"): compress discovery, cut the demo to one artifact (a draft in the queue), and make sure the ask happens before the hard stop. Never let pricing fall off the end — a call that ends without the ask becomes a follow-up email negotiation, which is the worst venue.

## 3. Signals that move pricing LATER (or to a second call)

- **Discovery is still producing gold at minute 15.** A prospect narrating their pain in case-study-quality detail is doing your job for you; let them. Book the demo + pricing as a second 20-minute call with a date before hanging up.
- **The economic buyer is absent.** A staffer without owner authority gets the demo and the enthusiasm, not the terms negotiation: "Pricing is public on our site, so no mystery there — but I'd rather walk through the deal with you and [owner] together. When are they free?"
- **Multi-seat ambiguity** (02 §4): if the seat count swings the number by hundreds a month, resolve seats first or defer with the stated reason.
- **Max-shaped scope revealed itself.** Pricing exits the call entirely, by design: "That's a scoped quote, and you'd want me to scope it rather than guess. Next step is a working session on your setup."

## 4. When the prospect brings it up first — the overriding rule

**Never dodge, never "we'll get to that."** Price-dodging reads as price-shame and burns the trust the whole call is for. But you can answer *and* keep the sequence, because the honest answer includes the dependency:

**Early ask, standard prospect:**

> "Sure — headline number so it's not hanging over us: $199 a month for a single seat, month to month, cancel anytime, and there's a free trial and a money-back guarantee, so trying it is cheap. Whether it's *worth* $199 depends on what your week looks like, which is exactly what I was about to ask you. Can I get ten minutes on that and then we'll come back to the price with real numbers in it?"

*(Number: `lib/pricing/tiers.ts:110`; mechanics: `lib/billing/facts.ts:27,51,57`. Give the real number immediately — it's on the public pricing page; treating a published number as a reveal is theater.)*

**Early ask, design-partner candidate:** give the 01 §2 opening right then, whole. It's a strong open — "nothing for three months" buys you the entire discovery block afterward:

> "…and that's the deal. Now, whether you're a fit for that cohort is what this call figures out — walk me through last Tuesday."

**The "just email me pricing" pre-call ask:** send the pricing-page link (it's public, hiding it is silly) *with* the call still attached: "Pricing's here — no games. The 20 minutes is for the part the page can't do: whether it fits how your week actually runs."

## 5. Cadence across the pipeline (when pricing gets re-raised)

| Stage (pipeline doc §1) | Pricing posture |
|---|---|
| FIT (outreach) | Never in a first touch. The sequence sells the call, not the subscription |
| DISCOVERY | This file. Once, in full, in the 22–27 block or when pulled earlier |
| DP-TALK | Terms restated in writing within 24h of the verbal walkthrough — the same words, no new terms appearing in the email |
| AGREEMENT | Price appears in the letter exactly as spoken. Any gap = the 04 §4 correction, before signature |
| ACTIVE PILOT (design partners) | Re-raised exactly twice, both scheduled: day one ("here's how the end works" — 01 §4) and week 10 (the conversion conversation, against the saved-time numbers). Not in between — a pilot that hears about money every week hears doubt |
| NOT-YET rows | On the revisit date, prices are re-quoted from the current ladder, not the old conversation: "terms are whatever's published when you're ready" |
