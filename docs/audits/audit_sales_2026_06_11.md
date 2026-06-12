# Sales Audit — agentplain.com — 2026-06-11

**Lens:** Veteran B2B SaaS sales leader. Single question: does agentplain.com + app.agentplain.com close a $99–199/mo deal with a local-business owner? Read-only audit of the live site (fetched 2026-06-11) plus repo source for protected in-app surfaces (`C:\agentplain`).

**Overall site sales score: 2.5 / 5.** The story arc is strong and the copy is unusually honest, but the deal does not close cleanly: the single most-repeated promise on the site ("First month free," "no card required" implied) is contradicted by the actual signup, which captures a card in Stripe Checkout on submit. Layered on top: zero social proof anywhere, a price-anchor whipsaw between the homepage ($199) and half the vertical pages ($299), and a confusing self-serve-vs-sales-led motion. A motivated buyer can complete the purchase, but a skeptical one hits a trust wall at the exact moment of commitment.

---

## 1. Executive summary

agentplain has done the hard part most early SaaS sites fail: a coherent, honest, well-sequenced narrative (why-we-exist → how-it-works → why-us → ROI → pricing → vision → CTA) that names all ten verticals, frames itself correctly against Claude/ChatGPT as a service layer (not a competitor), and refuses to over-claim. The ROI calculator is auditable and the security page is concrete. But the site does not *close*. Three things actively break the deal at the point of decision: (1) a **bait-and-switch trust gap** — every CTA and closing line promises "First month free" / no-card framing, but the signup form (`SignUpForm.tsx`) redirects to Stripe Checkout for **card capture on submit** with a "30-day trial," a contradiction a buyer feels exactly when they're handing over money; (2) **no social proof of any kind** — no logos, no named customer, no testimonial, no count of businesses served — on a site asking a skeptical owner to wire their inbox to an unknown vendor; (3) a **muddled buying motion** — Regular self-serves to checkout, Partner/Max route to `mailto:hello@agentplain.com`, and the only proof customer (flatsbo) is the company's own brokerage, which reads as "they've never sold this to anyone but themselves." The fixes are mostly copy and sequencing, not engineering — this is a high-ceiling site held back by a handful of conversion-killing contradictions.

---

## 2. Top 5 issues (severity 1–5; 5 = blocks the deal)

### Issue 1 — "First month free" promise contradicts card-captured-at-signup checkout. **Severity 5.**
Every primary CTA across home, /pricing, /about, and all vertical pages says **"Start free trial"** with the closing line **"First month free. Month-to-month. Cancel anytime."** The /pricing FAQ on the homepage even says "No pilot fees. No setup charges." But the actual flow (`app/(product)/app/sign-up/SignUpForm.tsx` lines 70–93, 203–225) does this: submit → server returns a `checkoutUrl` → `window.location.assign(checkoutUrl)` bounces the user to **Stripe-hosted Checkout to capture a card before they ever see the product.** The signup page hero (`sign-up/page.tsx` line 47–52) admits it: *"30-day free trial, card captured at signup."* So the buyer is told "free, no commitment" five times, clicks the button in good faith, and is immediately asked for a credit card by a third-party checkout page. This is the textbook trust-killer: the gap between the promise and the ask lands at the single highest-friction moment in the funnel. Either the promise is wrong (then fix the copy) or the flow is wrong (then defer card capture) — but they cannot both ship. A local-business owner who feels misled here does not come back.

### Issue 2 — Zero social proof anywhere on the site. **Severity 5.**
Not one customer logo, named reference, testimonial, quote, case study, or "trusted by N businesses" count appears on home, /about, /verticals, or any of the six vertical pages I checked (real-estate, cpa, law, home-services + the verticals index). The *only* proof asset is "we run ~35 agents on our own brokerage, flatsbo" (`/about`, homepage Q6 proof section, FAQ). For a buyer being asked to OAuth their inbox, calendar, and accounting into an unknown vendor, the absence of any third-party validation is the second deal-breaker. "We use it ourselves" is a necessary proof but not a sufficient one — it reads as "you'd be our first real customer." Every strong competitor leads with logos or a number. agentplain leads with its own dogfood and nothing else.

### Issue 3 — Price-anchor whipsaw: homepage says $199→$99, half the vertical pages say $299. **Severity 4.**
The homepage and /pricing anchor the entry price at **Regular: $199 solo → $99 at scale** and present that as "the standard service partnership." But the **CPA page shows $299 solo** (`lib/verticals/cpa/content.ts` line 261, tier "plus"/Partner) and **home-services shows $299 solo**, because those verticals are coded to *recommend Partner tier*. A CPA who reads "$199" on the homepage, clicks "CPA firms," and lands on "$299" experiences a 50% price jump with no explanation on the page itself. From a sales standpoint this is an anchor violation — you never let the prospect discover a higher number after you've set a lower one; it reads as a bait. (It also contradicts the locked pricing rule `project_stripe_both_surfaces.md`, which says every vertical prices at Regular by default.) Pick one anchor per vertical and make the homepage teaser match the page the prospect lands on.

### Issue 4 — Buying motion is ambiguous: is this self-serve or sales-led? **Severity 4.**
The site can't decide what it is. The homepage hero and /pricing push **"Start free trial"** (self-serve, instant checkout). But /about states flatly: **"We built a service-partnership team for local businesses, not a self-serve platform."** Partner tier's CTA is **"Talk to a service partner" → a raw `mailto:hello@agentplain.com`**. Max is "sales-led, no self-checkout." So Regular is self-serve-to-card, Partner/Max are email-a-human, and the brand narrative insists it's *not* self-serve. A buyer can't tell whether they're signing up or starting a sales conversation. Worse, the human-contact path is an unmonitored-looking `mailto:` link, not a calendar booking or a form with an SLA — the lowest-conviction contact mechanism in B2B. Decide the motion and make it legible: "Regular: start free in 2 minutes. Partner/Max: book a 20-min call →" (calendar link, not mailto).

### Issue 5 — The proof of credibility is the company's own brokerage, and "why pay this much" is under-argued at the moment of decision. **Severity 4.**
The ROI math is genuinely good (auditable calculator, 15–110x range anchored to hours × rate), but it's abstract — the buyer's own number, not a customer's realized outcome. At the pricing decision, the site asks a solo owner to pay $199–$299/mo with: no realized-customer ROI, no "businesses like yours saw X," no risk reversal beyond "cancel anytime" (and that's undercut by Issue 1's card capture). The vertical day-in-the-life examples ("Sarah's counter-offer," "March 17 doc-chase") are excellent and concrete — but they're *hypothetical scenarios*, not attributed outcomes. A buyer evaluating "why pay this much vs. just using Claude myself" gets a strong conceptual answer (the "we run it for you" contrast section) but no evidence anyone has paid and been glad. The deal needs one real, attributed outcome — even a beta user with a first name and a number.

---

## 3. Per-page findings

### Home (`https://agentplain.com/`, source `app/(marketing)/page.tsx`)
Strong, complete story arc answering all nine positioning questions in order. Hero leads with the locked mission line + tagline, names all ten verticals as a chip row (correct per memory rules). The "Claude gives you the tool. We run it for you." two-column contrast is the best sales asset on the site — it answers "why pay vs. free" head-on without disparaging Anthropic. The "knowledge substrate" stat block (vertical chunks / compliance rules / skill docs / doctrine docs) is honest but **sales-weak**: counts of internal knowledge chunks mean nothing to a local-business owner and risk reading as the kind of internal-metric filler the story-arc rule explicitly bans — consider replacing with a customer-outcome stat once one exists. Hero subhead **"Your AI ops team — without hiring one"** is good. Closing CTA stacks four buttons (Start free trial / Talk to a service partner / Build with us / See all ten verticals) — too many choices at the close; the eye wants one primary action. **Severity of the four-CTA close: 3.**

### /pricing (`app/(marketing)/pricing/page.tsx`)
Clean three-tier grid, ROI calculator, "when to choose what," shared guarantees, /custom escape hatch. Honest and well-structured. **But:** the "First month free" promise here is the same one contradicted at checkout (Issue 1). The Partner and Max CTAs are both `mailto:` links (Issue 4). The guarantees list is good risk-reversal language ("you own the work product," "no data resold") but buries the one guarantee buyers care about most — *what exactly happens to my money in month one* — under abstract trust statements. No explicit refund policy. No "what happens to my data if I leave" beyond a roadmap note that export "is not shipped yet" — a yellow flag for a cautious buyer.

### /verticals (`app/(marketing)/verticals/page.tsx`)
Lists all ten with correct slugs (real-estate, mortgage, insurance, property-management, title-escrow, recruiting, home-services, cpa, law, ria). States "Regular $199 → $99, Partner $299 → $199" — but this is the index; the individual pages then disagree on which tier they anchor (Issue 3). Functional, low-friction. Fine.

### Vertical pages — real-estate, cpa, law, home-services
The **day-in-the-life examples are the strongest selling content on the entire site** — concrete, time-stamped, dollarized (Sarah's 45-min→4-min counter-offer at 26x; the March-17 doc-chase at $42K/yr reclaimed; the 4,200-doc discovery at 60hr→14hr; the hailstorm 73-call triage). These should be promoted, not buried. **Problems:** (1) every one of these pages has **zero testimonials/customer names** — confirmed on all four; (2) **pricing inconsistency** — real-estate and law show $199 Regular, cpa and home-services show $299 Partner, with no on-page explanation of why this vertical costs more (Issue 3); (3) most "live" integrations are thin and the meaty ones are "planned" for Q3/Q4 2026 or Q1 2027 (law has exactly *one* live integration — Outlook — and everything a lawyer actually uses, Clio/MyCase/NetDocuments, is "planned Q1 2027+"). A lawyer reading that page sees the killer workflow depends on tools that don't connect for ~7 months. **Severity of the law-page integration gap: 4** for that vertical specifically.

### /about (`app/(marketing)/about/page.tsx`)
Good mission restatement and honest "what we are NOT" list (not a CRM replacement, not a chatbot, not a regulated party). Carries the flatsbo proof. **The "not a self-serve platform" line directly contradicts the self-serve checkout (Issue 4).** No team names, no founder face — for a service-partnership pitch built on "a real human is your single contact," the absence of any named human (beyond the AI partner "Plaino") undercuts the core differentiator. Buyers buying a *service* want to see who.

### /custom (`app/(marketing)/custom/page.tsx`)
The strongest-converting page structurally: clear "what custom looks like" (6 examples), a real 4-step process with a free no-commitment scoping call, transparent pricing framework ($5K–$15K + $200–$500/mo), and an actual **contact form with fields** (not a mailto) — inquiry type, name, business, vertical, seats, description, email. This is how the Partner/Max paths on the main site *should* capture leads (Issue 4). Good.

### /security (`app/(marketing)/security/page.tsx`)
Concrete and credible: AES-256-GCM at rest, TLS 1.2+, Postgres row-level security with workspace_id gating, append-only audit log, read-and-draft-only OAuth scopes, 24h/72h incident targets, daily encrypted backups w/ 30-day retention, named subprocessors with no-training commitment. **Gap: no SOC 2 / ISO 27001 / any third-party attestation.** For a CPA, a law firm, or an RIA — three of the ten verticals — the absence of SOC 2 is a hard procurement blocker, not a nice-to-have. The page is honest and well-written but a security-conscious buyer in a regulated vertical will stop here. **Severity for regulated verticals: 4.** A "SOC 2 Type II in progress" line (if true) would partially defuse it.

### app.agentplain.com — sign-in / sign-up (`app/(product)/app/sign-in`, `sign-up`)
Sign-in is clean: passkey + magic-link email, "no password to lose." Good, low-friction. **Sign-up is the conversion problem (Issue 1).** Field count to start is low (brokerage name, email, optional name + two pickers — tier and vertical), which is good — but then it redirects to Stripe Checkout for a card. **Click/field count from homepage to paying:** Home "Start free trial" (1 click) → tier+vertical pickers + 2 required fields → submit (redirect) → Stripe Checkout card entry → done. ~2 clicks + ~3 fields + full card details. The card-capture step is the friction and the trust break, not the field count.

### Onboarding (`app/(product)/.../onboarding/page.tsx`)
Genuinely good post-signup experience: 5 steps (confirm details → connect integration → pick skills → set preferences → watch first fire), a named service partner (Plaino) greeting by first name, a sticky preview pane, honest "skip for now" on the connector step, and real first-fire results "within a few minutes." This is well above typical SaaS onboarding. It does its job — *if* the buyer gets past the card wall to reach it. The value is gated behind the exact friction that's most likely to lose them.

---

## 4. Strategic gaps (vs. what a strong competitor's site does)

1. **No social proof system at all.** A strong competitor has a logo wall, 2–3 attributed testimonials, and a "trusted by N local businesses" count above the fold. agentplain has none. This is the single largest strategic gap.
2. **No risk reversal that survives contact with the signup.** "Cancel anytime" is undercut by card-on-signup. Competitors offer either a true no-card trial or an explicit money-back guarantee. agentplain offers neither cleanly.
3. **No demo path.** There is no "watch a 2-min demo," no interactive product tour, no sample workspace, no screenshot of the actual approvals queue on any marketing page. The buyer must sign up (and add a card) to see the product. The excellent onboarding and approvals UI are completely invisible pre-purchase. A "see the product" gallery or a recorded walkthrough would let the day-in-the-life examples land *with visuals*.
4. **No named humans on a service-partnership pitch.** Selling a "human service partner" while showing zero real humans is a credibility miss. Even one founder bio would help.
5. **No procurement/compliance assets for regulated verticals.** No SOC 2, no DPA mention, no security questionnaire pack — yet half the verticals (CPA, law, RIA, insurance, mortgage, title) are exactly the buyers whose IT/compliance will demand them.
6. **The "why now / why us" is conceptual, not evidenced.** Strong; but unbacked by a single realized customer result.

---

## 5. Quick wins (≤1h each)

1. **Resolve the free-trial contradiction in copy** (Issue 1, the highest-leverage hour on the site). Either (a) change every "First month free / no card" line to the truthful "30-day free trial — add a card to start, cancel anytime before day 30 and pay nothing," or (b) if product intends no-card, that's deep work, not a quick win. Truthful copy is the 1-hour fix; do it today. Files: `app/(marketing)/page.tsx`, `pricing/page.tsx`, `components/FAQ.tsx`, every `lib/verticals/*/content.ts` pricing line.
2. **Align the homepage price anchor to the per-vertical pages, or add a one-line explainer** on cpa/home-services ("$299 — Partner tier recommended for tax-season-intensity ops; Regular $199 available"). Removes the whipsaw. Files: `lib/verticals/cpa/content.ts`, `lib/verticals/home-services/content.ts`.
3. **Replace the Partner/Max `mailto:` CTAs with the /custom contact form (or a calendar link).** The form already exists; route Partner/Max interest into it with a pre-filled inquiry type. Raises lead-capture conviction immediately.
4. **Cut the homepage CTA stack from four buttons to one primary + one secondary.** "Start free trial" (primary) + "See how it works" or "Talk to us" (secondary). Move the rest into the nav/footer.
5. **Add a "see the product" strip** — even 3–4 real screenshots of the approvals queue / workspace / first-fire result — so the buyer sees the product before the card wall. Assets exist in the app; screenshot them.
6. **Add a "SOC 2 Type II in progress" line to /security** (only if true) to keep regulated-vertical buyers from bouncing.

## 6. Deep work (>1d, high impact)

1. **Land real social proof.** Even 1–3 design-partner testimonials with first name + vertical + a realized number ("cut my Sunday inbox triage from 6 hrs to 40 min"). This plus one logo would move the site from 2.5 to ~3.5 on the close-rate axis. Highest-ROI deep investment.
2. **Re-architect the trial to a true no-card-to-start flow** (if the business can stomach the conversion-vs-quality tradeoff). Capture the card at end-of-trial via a saved-payment prompt inside the app, not at signup. Removes the single biggest trust break entirely and lets every "no card required" line become true.
3. **Build a self-serve demo / sandbox workspace** with seeded fixture data so a prospect can click through a real approvals queue and first-fire without signing up. Converts the (excellent) onboarding and day-in-the-life content from "told" to "shown."
4. **Pursue SOC 2 Type II** and publish a trust center with DPA + subprocessor list + security questionnaire pack. Unlocks the regulated half of the vertical roster for any buyer with a procurement gate.
5. **Close the integration credibility gap per vertical** — especially law (1 live integration vs. a Q1-2027 roadmap). Until the meaty connectors land, reframe each vertical page to lead with what works *today* (inbox + calendar + the drafting loop) rather than a roadmap of tools that don't connect for months.

## 7. What you'd cut

1. **The "knowledge substrate" stat block on the homepage** (vertical chunks / compliance rules / skill docs / doctrine docs counts). It's honest but it's internal-metric filler to a local-business owner — exactly the pattern the story-arc rule bans. Replace with a customer-outcome stat the day one exists; until then it adds noise at a point where the buyer wants proof, not internals. **Severity of harm: 3** (it's not blocking, but it dilutes the proof section).
2. **One of the four closing CTAs.** Choice overload at the close suppresses action.
3. **The raw `mailto:hello@agentplain.com` links** as the Partner/Max contact mechanism — cut in favor of the existing form. A bare mailto signals "we don't have a sales process."

---

## Appendix — findings scoring <4 (would not block a $10K/mo-problem buyer)

- **Magic-link-only auth with no password** — fine for most, but a multi-seat firm admin may want SSO; not a blocker at this stage. (2)
- **"Your AI ops team — without hiring one" vs. banned "AI assistant"** — the hero subhead uses "AI ops team," which is on-brand and *not* the banned "AI assistant" framing; no issue. (1, noted for completeness)
- **Workspace export "on the roadmap, not shipped"** — a cautious buyer notices it in the cancel FAQ, but it's honestly disclosed; minor. (3)
- **Footer/nav completeness** — verticals, how-it-works, pricing, custom, about, privacy, terms, security, contact, sign-in, signup all present. No issue. (1)
- **ROI calculator Partner-hour value flagged "[estimate]"** — refreshingly honest, arguably *too* honest (surfacing "estimate" at the value moment slightly weakens the number), but not a blocker. (3)

---

## Post-audit drift check (2026-06-11 EOD — main@47237e0, prod cabf36f)

The audit above ran against `origin/main@d77ffce`. Verified deltas since:
- **STILL TRUE:** the card/trial contradiction (Issue 1 — no PR touched the copy or the Stripe env decision); zero social proof (Issue 2); price whipsaw (Issue 3 — `/cpa` live-renders "$299 Partner" today, `tier:"plus"` intact in `lib/verticals/cpa/content.ts:28`); raw `mailto:` Partner/Max CTAs (`pricing/page.tsx:154,189,200`); the "~35 cron-fired agents" count (`about/page.tsx:113`); chat widget dead (live `POST /api/chat` → `degraded:true` today).
- **IMPROVED:** main is deployable again (#224 merged; prod serves `cabf36f`); brand asset waves #231/#232 landed (clean crops + icon system), helping the "see the product" trust surface.

## Estimated effort to clear backlog
- **Quick wins:** ~1 day, fits in one Truth-Wave PR (trial copy truth, anchor alignment, CTA consolidation, mailto→form, screenshot strip).
- **Deep work:** social proof = external dependency (Conner testimonial asks, start now); no-card trial re-architecture 2–3d (only if Conner picks that truth); demo sandbox ~1wk; SOC 2 = quarter-scale.
- **Total: 1 PR + 1 Conner decision (trial truth) + 1 external dependency (testimonials).** Sales lens moves ~2.5 → ~3.5 on the Truth-Wave PR alone.
