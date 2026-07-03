# How design converts the RE-broker first impression into a booked call

**The economics this serves:** cash breakeven is 3–9 customers; ~$10K MRR is founder-inclusive profitability (CEO Pass 1). The lever is 5 Georgia RE founder emails Monday. At this volume there is no statistics — there is craft. Five brokers will each spend under a minute deciding whether agentplain is a firm or a template. Design's contribution to profit is the difference between those two reads, times five.

---

## 1. The funnel, and where design owns it

```
email opened → link clicked → [ DESIGN OWNS THIS ] → call booked → trial → paid partner
                               first 30 seconds:
                               credibility, clarity,
                               a working next step
```

Marketing owns the open and the click. Sales owns the call. Design owns the span between click and booking: does the page look like a real firm, does it answer "what does it do / what does it cost / what's my risk" without friction, and does the next step *work*.

## 2. The four breaks, priced in funnel terms

| Break (all verified live at `d95d279`) | Funnel cost | Fix cost |
|---|---|---|
| `/how-it-works` 308s to a home anchor | The #2 question in the story arc never reaches its answer. A broker who clicks the nav to understand the product gets bounced to an anchor — the "is this real?" test failed by the site itself | Merge PR #355 |
| Primary CTA at 4.19:1 contrast | The button we need clicked is the least readable element on the page; on a phone in daylight (where cold-email links get opened) it's worse | One word in `globals.css` |
| `/guarantee` orphaned | Risk reversal is the strongest objection-handler for a cold-outreach recipient. We have a walk-away guarantee page and zero paths to it — we pay the cost of offering the guarantee and collect none of the conversion benefit | ~4 links + sitemap |
| Unsourced `$2,900–$10,600/mo` on the proof card | The buyer this range is aimed at is the one who checks. One untraceable number poisons the credibility of every traceable one — and this site's differentiator is that everything else traces | Copy ruling + one edit |

None of these are aesthetic. All four are the site contradicting its own positioning ("plain, honest, verifiable") at the exact moment a skeptic tests it.

## 3. Why the first impression is a *trust* design problem, and what we already have

The GA broker has seen AI-for-RE pitches with gradient heroes and invented testimonials. Our first impression converts by being the opposite, and the assets already exist on main:

- **Document grammar** (§-numbered sections, datelines, exact citations) — the register of a professional services firm, proven on the CPA/law surfaces.
- **Verifiable numbers everywhere** — pricing rendered from the billing source, seed counts computed from the real corpus, an ROI calculator with editable labeled assumptions. (The one exception is break #4 above.)
- **"Liability stays with you"** stated plainly on `/pricing` — the sentence a licensed broker is silently looking for.
- **A working product to show:** demo mode means the trial's first render is the fleet visibly reading, categorizing, and drafting a listing inquiry on synthetic data — proof-of-life inside the first minute, which no competitor screenshot can match.

The 14-day plan spends nothing new; it removes the four contradictions and puts the premium visual weight (ledger treatment, foil) on the *evidence* instead of the thesis. Ranked by expected effect on call-booking: (1) unshadow `/how-it-works`, (2) link the guarantee, (3) fix the proof number, (4) CTA contrast, (5) editorial rhythm on the second click, (6) demo-mode-first dashboard.

## 4. What design will NOT claim

Five emails cannot A/B test anything, and per the no-guesses rule I will not invent conversion percentages. The honest claim: each break above is a verified defect on the exact path the sends traverse, each fix is cheap against a 3-customer breakeven, and the downside of fixing them is zero. When the sends go out, I want the Plaino chat widget's lead-capture log and the booking link's click-through as the feedback loop — at n=5, one broker's session behavior is signal.

## 5. The standing contribution beyond this window

Design's durable profit contribution is margin protection: the deterministic asset pipeline (SVG scenes from brand tokens, no stock licensing, no per-vertical agency spend) means each future vertical's visual identity costs roughly one script extension. The holds in `05-what-design-must-stop.md` keep that discipline — spend follows signed revenue, never precedes it.
