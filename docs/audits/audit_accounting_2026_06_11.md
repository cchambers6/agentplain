# Accounting Audit — agentplain.com — 2026-06-11
**Date:** 2026-06-11 · **Lens:** Fractional CFO / SaaS billing ("what will my actual monthly bill be, and do I trust how they handle my money?") · **Mode:** read-only

---

## 1. Executive summary

The in-app billing surface (`/app/workspace/[id]/settings/billing`) is genuinely strong — arguably the most honest, well-built page in the product. It has a real dunning banner, a 7-day grace promise, an invoice table, a Stripe-hosted portal for receipts, clean cancel-at-period-end mechanics, and a token-activity pane that is scrupulously honest about whether usage is metered. **But a local-business owner never sees that page until they're already paying.** What they see before commitment — the marketing pricing/custom/terms pages and the signup flow — carries three money-trust breakers: (1) the flat-fee promise is silently contradicted by a live, env-gated **token-metered billing pipeline** that no public surface discloses; (2) the "card captured at signup" promise on `/terms` directly contradicts the in-app "no card required to start" copy, and prod actually runs the no-card fallback (Stripe env misconfig per Wave 2) — so the stated charge mechanic is a coin-flip; and (3) the **refund policy** ("we do not pro-rate mid-cycle refunds") lives only in `/terms`, never on `/pricing`, while PR #219's vertical-gating refund logic is unmerged — so for the vertical pages that mis-price solo lawyers into "Max/quoted," there is no stated remedy. The bill *is* answerable in one read on `/pricing` for the flat tiers, but the metered-usage asterisk, the trial-charge timing, and the refund terms are scattered or absent. **Lens score: 2.5/5** — the back-office machinery is 4/5; the pre-commitment money story a customer actually reads is 2/5, and it's the pre-commitment story that decides trust.

---

## 2. Top 5 issues (severity 1–5)

| # | Severity | Issue |
|---|---|---|
| 1 | **5** | **Undisclosed metered token billing under a "flat per-seat" promise.** `lib/inngest/functions/stripe-usage-meter-sweep.ts` + `lib/billing/usage/stripe-meter.ts` POST per-workspace token micro-cents to Stripe as billable meter events when `STRIPE_USAGE_METER_ENABLED=true`. The in-app `MeteringNotice` enabled-branch says *"Usage is reported to your subscription each day… so invoices reflect the activity above."* No `/pricing`, `/custom`, or `/terms` surface mentions any usage/metered component — every public surface says "per-seat, monthly, flat." A customer who signed up on "flat $199" could get a metered surcharge with zero contractual disclosure. The margin math (`project_production_growth_plan`: heavy workspace = $162–279/mo tokens vs $99–199 sub) is the standing incentive to flip this switch. |
| 2 | **5** | **Contradictory charge-mechanic across surfaces, and prod doesn't match either.** `/terms`: "Card captured at signup, charged at start of second month." In-app billing page: *"First 30 days are on us — no card required to start. Add a card any time before your trial ends."* These are opposite promises. Code default is card-at-signup (`lib/billing/checkout.ts`, `payment_method_collection:"always"`), but **prod runs the add-card-later fallback** because the Vercel Stripe env is misconfigured (Wave 2, `actions.ts:142-164`). So the customer cannot know from any surface when their card is taken or when they're first charged. |
| 3 | **4** | **Refund policy is buried and the live policy is harsh-by-omission.** The only refund statement anywhere is `/terms`: *"We do not pro-rate mid-cycle refunds."* It is absent from `/pricing` and `/custom`. PR #219 (vertical gating + **refund**) is **NOT merged** (Wave 2), so there is no refund remedy for the live mis-pricing where `/law`, `/ria` solo practices render "Max / quoted" and `/cpa`, `/home-services` render Partner $299 (the dead vertical→tier mapping, banned by `project_stripe_both_surfaces.md`, still wired into billing via `flows.ts:100-101`). A solo lawyer overcharged by the tier bug has no stated path to money back. |
| 4 | **4** | **No tax disclosure anywhere, and Stripe Tax is not configured.** `grep` for `automatic_tax` across `origin/main` returns zero hits in live billing code (only stale audit docs). `createCheckoutSession` and `createSubscription` set no `automatic_tax`, no `tax_id_collection`. For CPA, law, and RIA buyers — the exact verticals being sold — "is sales tax added?" is unanswerable, and the merchant has no tax-collection posture at all. SaaS is taxable in many states; this is a real compliance exposure once self-serve scales. |
| 5 | **3** | **"First month free" trial→paid transition has no warning mechanics surfaced to the buyer pre-commitment.** `/pricing` says "first month free"; only `/terms` (which nobody reads before buying) explains the charge timing. The in-app `TrialBanner` + `trial_will_end` webhook handling exist, but the *promise* of "we'll warn you before the first charge" never appears on the pricing surface where the conversion anxiety lives. Combined with #2's prod-vs-code ambiguity, the customer can't predict the moment money leaves their account. |

---

## 3. Per-surface findings

### `/pricing` (live)
- Renders **three tiers** (Regular $199→$99, Partner $299→$199, Max "quoted, sales-led"). This matches the 2026-05-15 ratified three-tier model — **correct, not banned.**
- "First month free," "month-to-month, no long-term contracts," "cancel anytime from your billing settings" — all clear and present.
- **Missing:** refund policy, tax disclosure, currency (USD implied, never stated), and **any mention that token usage is tracked/metered.** The bill is answerable for the flat fee but the page presents flat-fee-only as the *whole* truth, which the metered pipeline contradicts.
- No "starting at" hedge or fine-print asterisk — clean, but clean *because it omits* the messy parts.

### `/custom` (live)
- Best-disclosed money surface on the marketing site. Free scoping call; one-time build $5K–$15K; $200–$500/mo maintenance; explicit **"No surprise charges. The spec is what you pay for; if the build runs longer because we mis-scoped, that's on us, not you."** That mis-scope clause is a genuine trust asset — keep it.
- "Cancel any time" on maintenance is stated.
- **Missing:** payment terms (deposit? net-30? milestone billing?), refund on a cancelled build, tax.

### `/terms` (live)
- Carries the real billing contract and it's well-drafted: billed monthly in advance; first month free; card-captured-at-signup; **7-day grace on failed payment** with service continuing, then pause to read-only; email at each step; **"we do not pro-rate mid-cycle refunds"**; 12-month liability cap; 30-day notice on material term changes with continued-use-equals-acceptance; data export + 7-day soft delete + 30-day backup purge.
- **The price-change protection is one-directional risk:** "30 days notice, continued use = acceptance" means a price increase auto-applies unless the customer cancels — no grandfathering clause for existing seats. Fine legally; worth a customer-friendly "your rate is locked while you stay subscribed" if you want it as a trust lever.
- **The card-capture clause directly contradicts the in-app billing page.** One of the two is a lie to every customer who reads both.

### In-app `/settings/billing` (code, `origin/main`) — the strong surface
- **Dunning UX is real and good:** PAST_DUE banner — *"Your last invoice didn't go through… Your fleet keeps running through [date]; after that, agents pause until billing is current"* + portal button. This matches `/terms` grace language and `workspace-paused-gate.ts` (which actually reads `Subscription.status` and pauses skill fires — copy matches runtime).
- **Receipts/invoices:** invoice table (last 12) + "view invoices + receipts" → Stripe billing portal. Empty state: *"receipts come from Stripe."* Proper hosted-invoice/PDF path via `createPortalSession`. This is the correct pattern.
- **Cancellation:** `cancel subscription` → `cancelAtPeriodEnd` (keeps access through paid window) with a clear "Cancellation scheduled for [date]… Open the portal to undo." Self-serve, effective-at-period-end, reversible. Excellent.
- **Token transparency:** `UsagePanel` + `BudgetSummary` show spend, per-surface breakdown, cache savings *"in compute we didn't pass to you,"* and a NO_CAP honesty note *"your fleet runs without you watching a meter."* `MeteringNotice` is scrupulous: "in development… isn't yet metered against your subscription. When metered billing turns on we'll let you know in advance." **This is the right disclosure — it just needs to exist on the public pricing surface too, not only post-purchase.**
- **Header copy contradiction:** *"First 30 days are on us — no card required to start"* contradicts `/terms` card-at-signup (issue #2).

### Signup surface
- `agentplain.com/sign-up` → **404** (signup lives at `app.agentplain.com/app/sign-up`, auth-flow, not fetchable read-only). Per Wave 2, code default = card-at-signup via Stripe Checkout; prod silently runs add-card-later fallback due to Stripe env misconfig. **The charge mechanic at the single most trust-sensitive moment is non-deterministic between code and prod.**

---

## 4. Strategic gaps

1. **No single source of truth for the money story.** Three surfaces (`/pricing`, `/terms`, in-app) each tell a different version of trial/card/refund. A CFO buyer reconciling them will not trust the vendor with their AR. The fix is one canonical billing-facts block referenced everywhere.
2. **The metered-billing capability is a latent reputational landmine.** It's well-engineered (idempotent, env-gated, honest in-app), but flipping it on without a contractual usage clause on the public surface would be a bait-and-switch on the flat-fee promise. The margin pressure that motivates flipping it is real and documented — so this *will* come up.
3. **Tax posture is absent, not just undisclosed.** Selling to CPAs/law/RIA across states with no Stripe Tax and no nexus posture is a scale-blocker and an audit-credibility own-goal for a product whose pitch includes "counsel-reviewed compliance corpus."
4. **Refund discipline depends on an unmerged PR.** The refund logic that would make the vertical-mis-pricing recoverable (#219) isn't in main; the stated policy ("no mid-cycle pro-ration") is the *opposite* of forgiving. Mis-pricing + no-refund is a chargeback-and-complaint generator.
5. **Price-change clause has no grandfathering** — fine for now, a missed trust lever for a "we're your long-term service partner" brand.

---

## 5. Quick wins (≤1h each)

1. **Add a one-line refund + tax + trial-timing footnote to `/pricing`.** e.g. *"First month free — your card is added before trial end and charged at the start of month two. Applicable sales tax may apply. Refunds: see Terms."* Resolves the worst of #2, #3, #4 disclosure gaps at the point of decision.
2. **Reconcile the trial/card copy to ONE truth.** Pick card-at-signup OR no-card-to-start, fix the contradicting surface, and (Conner gate) fix the Vercel Stripe env so prod matches code. Currently `/terms` and the in-app page assert opposite facts.
3. **Add an explicit usage-billing disclosure (or explicit "no usage charges, ever") to `/pricing` + `/terms`.** If metered billing is on the roadmap, say flat fee covers normal use and unusual volume is discussed first (matches the in-app "we'll let you know in advance" promise). If it's NOT on the roadmap, state "no usage charges" and gate the meter behind a contract change. Closes #1.
4. **Set cpa/law/ria/home-services `content.tier = "regular"`** (three one-line edits per Wave 2) so no vertical mis-prices a customer — removes the refund-exposure root cause (#3) without needing #219.
5. **Surface the cancellation + grace terms on `/pricing`** ("cancel anytime, effective at period end; 7-day grace if a payment fails — your fleet keeps running"). It's already true in code; just promote it forward.

---

## 6. Deep work (>1d)

1. **Configure Stripe Tax** (`automatic_tax: { enabled: true }` on checkout + subscription creation, `tax_id_collection`, nexus/registration posture) and disclose tax handling. Compliance + credibility for the regulated verticals.
2. **Merge #219 (vertical gating + refund) + #223 (registry-truth CI guard)**, or implement an equivalent refund path, so over-charges have a stated, code-backed remedy and the tier-mapping can't silently re-drift.
3. **Decide and document the metered-billing product policy** end-to-end: contractual clause, advance-notice mechanism, customer opt-in or fair-use threshold, and the public pricing language — before `STRIPE_USAGE_METER_ENABLED` is ever flipped in prod.
4. **Author a canonical "Billing & Money" disclosure block** (trial timing, card capture, charge dates, refunds, tax, usage, cancellation, price-change protection) and reference it from `/pricing`, `/custom`, `/terms`, signup, and the in-app billing header so all surfaces stay in sync.

---

## 7. What you'd cut

- **Nothing structural — the in-app billing surface is a keeper.** The cut is *copy*, not features: stop letting `/terms` and the in-app page assert opposite card-capture facts. Cut whichever is false.
- **Cut the implicit "flat fee, full stop" framing on `/pricing`** if the meter is staying — it's a half-truth that the codebase contradicts. Replace with honest flat-fee-plus-fair-use language.
- **Cut the dead vertical→tier mapping** (`flows.ts:100-101` content.tier flow) — it's the single line generating mis-priced, non-refundable charges for solo professionals.

---

## Appendix — sub-bar findings (customer-value < 4)

- **(2) Currency never explicitly stated** as USD on any marketing surface. Implied, but an international or border-state buyer can't confirm. One-word fix.
- **(3) `/custom` lacks payment-terms detail** (deposit vs net-30 vs milestone). Matters for a $5K–$15K engagement but only at the contract stage, not the browse stage.
- **(2) No annual-plan pricing surfaced** — `/terms` mentions "annual discounts available on request via separate written agreement," but `/pricing` shows monthly only. A CFO who wants to prepay annually for a discount can't self-serve it. Minor; deliberate per the month-to-month positioning.
- **(2) Liability cap (12 months of fees) is standard** and well-stated in `/terms`; no action.
- **(3) Stripe API version pinned to `2026-04-22.dahlia`** with `current_period_end` correctly read off the subscription item — billing code is current and correct; not a customer-facing issue, noted as evidence the back-office is well-maintained.

---

## Evidence index
- Live: `agentplain.com/pricing`, `/custom`, `/terms` (WebFetch 2026-06-11); `agentplain.com/sign-up` → 404 (real route is `app.agentplain.com/app/sign-up`, auth-gated).
- Code (`git show origin/main:`): `lib/billing/checkout.ts`, `lib/billing/stripe-provider.ts`, `lib/billing/types.ts`, `lib/billing/workspace-paused-gate.ts`, `lib/billing/webhook-dispatch.ts`, `lib/billing/usage/stripe-meter.ts`, `lib/inngest/functions/stripe-usage-meter-sweep.ts`, `app/(product)/app/workspace/[id]/settings/billing/page.tsx`, `.../UsagePanel.tsx`, `.../BudgetSummary.tsx`, `lib/env.ts:131-147`.
- Tax: `git grep automatic_tax origin/main` → zero hits in live billing code.
- Cross-wave: `wave1_synthesis_2026_06_11.md` (issues #1 card-capture, #2 vertical tier), `wave2_synthesis_2026_06_11.md` (#219 unmerged, Stripe env misconfig, flows.ts:100-101), `project_stripe_both_surfaces.md` (three-tier truth, "pilot fees" ban), `project_production_growth_plan_2026_06_05.md` (token-vs-sub margin), `project_budget_seam_shared.md` (NO_CAP default).

---

## Post-audit drift check (2026-06-11 EOD — main@47237e0, prod cabf36f)

- **UPDATED — Issue 3 partially superseded:** #219 merged after the audit ref — the unsupported-vertical refund sweep is now live in prod (detect-only by default; auto-refund behind `UNSUPPORTED_VERTICAL_AUTO_REFUND`). The mis-pricing *root cause* (vertical→tier, `flows.ts:101`) is still wired and still rendering $299/quote-walls on /cpa, /law, /ria, /home-services (verified live today).
- **STILL TRUE:** undisclosed metered-billing pipeline (Issue 1 — no public surface discloses it; no PR touched pricing copy); the three-way charge-mechanic contradiction (Issue 2 — /terms vs in-app vs prod fallback); refund policy buried in /terms only; no Stripe Tax (`automatic_tax` absent from billing code); no trial-charge-timing warning at the decision point (Issue 5).

## Estimated effort to clear backlog
- **Quick wins:** ~2h in the Truth-Wave PR (pricing footnote: refund/tax/trial-timing/grace; one trial-card truth everywhere; usage-billing disclosure line or "no usage charges" commitment; 4 tier fields).
- **Decisions (Conner):** trial truth (env vs copy), metered-billing policy, tax/nexus posture (with accountant).
- **Deep work:** Stripe Tax configuration ~1d; canonical billing-facts module referenced by all surfaces ~1d.
- **Total: 1 PR + 3 Conner decisions + ~2 eng-days.** Lens moves 2.5 → ~3.5 on copy truth alone; ~4 with tax posture.
