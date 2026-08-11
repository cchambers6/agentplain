# Value-proposition review — 2026-08-11

**Scope:** what agentplain promises, to whom, why they'd pay, and whether any of it is true.
Companion to the parallel product-build review (separate session); build defects are noted
and left alone.

**Evidence discipline:** every claim below is labeled **[measured]** (read from the live
site, the repo at a named commit, or a diff), **[inferred]** (a conclusion from measured
facts), or **[unverified]** (could not be checked from here). Live-site fetches were made
2026-08-11 against https://agentplain.com.

**The governing fact:** production serves commit `d5fcfad` (merge of PR #293, deployed
2026-06-17, deployment `dpl_51WDT33qmmVu567GUh8Fp59VGWjF`) [measured — live HTML string
comparison against `git show d5fcfad` vs `bcaccbe`: the old "Not magic, not pixie dust"
homepage copy is live, PR #394's vertical demo is absent, `/guarantee` 404s]. Every claim
in this review therefore carries one of three deployment states: **LIVE** (a customer
sees it today), **MERGED-UNDEPLOYED** (on `main@bcaccbe`, invisible), or **NEITHER**.

---

## 1. The proposition, stated plainly

What the live site promises, in a customer's words:

> agentplain is a done-for-you AI operations team for my local business. Their people
> install a pre-built crew of AI agents for my industry, connect the tools I already use,
> and run everything for a flat per-seat fee ($99–$199/mo after early pricing, Max by
> quote). The AI drafts every email, follow-up, and status update; all of it waits in my
> approval queue and nothing ever sends without my name on it. It runs around the clock,
> learns from my edits, and knows my industry's rules. I can try it free for 7 days
> (14 for CPA and law), card at signup, month-to-month, 14-day money-back guarantee.

That fits in one paragraph, which is a real strength — the core proposition is coherent
and differentiated (service-not-software, approval-gated, flat fee). **The problem is not
the paragraph; it's that the surfaces around it contradict it** (§2) and offer no reason
to believe it (§4).

The one-paragraph test passes only on the homepage. On the vertical pages the proposition
fragments: the same page tells a CPA "first month free," "7-day free trial," and "14-day
free trial" in three different sections [measured, §2.2].

## 2. Claim-by-claim truth audit

Baseline: `reference_product_claims_vs_reality` (2026-05-22, re-audited 05-24/05-25).
What's changed since that baseline is called out inline.

### 2.1 The load-bearing architecture claims — LIVE and TRUE

These are the claims a buyer relies on most, and they hold [all measured against
`d5fcfad` code by subagent audit]:

| Claim | Evidence at d5fcfad | State |
|---|---|---|
| "Nothing sends on its own" / every draft waits for approval | No-outbound architecture; drafts land as PENDING approval rows; customer systems execute | LIVE, TRUE |
| Continuous loop, "runs every five minutes" | `PROCESS_WEBHOOK_EVENT_CRON = '*/5 * * * *'` | LIVE, TRUE |
| Learns from your edits (preference loop) | `lib/preferences/{capture,render}.ts` wired into prompt composer | LIVE, TRUE — was the baseline's "biggest overclaim," fixed for real in PR #60 and still real |
| "Works from your files… today the file source runs against on-disk fixtures" | Honest fixture disclosure printed on the homepage | LIVE, TRUE — the baseline's other overclaim, now honestly qualified in the copy itself |
| Pricing numbers (Regular $199→$99, Partner $299→$199, Max quoted) | Derived from `lib/pricing/tiers.ts` bands on every surface | LIVE, TRUE |
| 7-day trial / 14 CPA+Law / card at signup / 14-day money-back | `TRIAL_PERIOD_DAYS=7`, `TRIAL_PERIOD_DAYS_EXTENDED=14`, wired into checkout | LIVE, TRUE where stated (but see §2.2) |
| Model vendor invisible on customer surfaces | Zero rendered Claude/Anthropic/OpenAI hits on marketing pages; /privacy + /security subprocessor exceptions correct | LIVE, TRUE — judgment flag: `/compare/chatgpt` names ChatGPT/OpenAI as the compared alternative under a self-granted exception the ratified rule doesn't contain. Needs an explicit ruling. |
| Real-estate fair-housing scanner live, others counsel-gated | Sentinel corpus: only realty fires; copy scopes it accurately almost everywhere | LIVE, TRUE (one exception: §2.3) |

### 2.2 FALSE claims currently live in production

This is the headline of the review. Production has been advertising, for eight weeks, an
offer the billing system will not honor and a service shape the company ratified out of
existence.

**"First month free" — 15+ live customer surfaces [measured].** The FAQ answer on all 10
vertical pages + /general (`lib/verticals/*/content.ts` at d5fcfad, 12 occurrences),
/how-it-works closing CTA, /waitlist, and every /compare page. Stripe charges at day
7/14 (card captured at signup) — the advertised free month does not exist. The vertical
FAQ answers are also emitted as FAQPage JSON-LD, so the false offer is being fed to
Google and answer engines as structured data [measured]. Main purged all of this in
PR #394 (2026-07-19) — **the fix has been merged and invisible for three weeks**
[measured: 0 occurrences at `bcaccbe`].

**Same-page trial contradictions [measured].** /real-estate: "first month free" (FAQ)
vs "7-day free trial, card at signup" (ROI block). /cpa: "first month free" vs "7-day"
(pricing block) vs "14-day" (ROI + CTA — 14 is the correct number for CPA). A buyer
cannot determine the actual offer from any single vertical page.

**Retired Partner-tier promise sold as current [measured].** /cpa and /home-services:
"Partner tier — a named service partner with a weekly review cadence." /law and /ria:
Max justified by "a named partner and a weekly cadence." Ratified Partner
(`lib/billing/facts.ts` on main; policy 2026-06-14) is priority email/chat + quarterly
async check-in, **no reserved hours, no named human**. Corrected on main (PR #394/#396),
undeployed. Worse: the knowledge-substrate doctrine chunks the product itself grounds on
(`lib/knowledge/seed-data.ts:689,703,733` at d5fcfad) still say "4 hrs/mo reserved time"
and "First month free" — and customer chat retrieves knowledge chunks
(`project_voice_hygiene_zero_baseline`: known leak vector), so **the product can recite
the dead offer in its own chat** [measured file content; leak path inferred from the
ratified memory].

**"Can my firm actually use it today?" — "Yes." for all ten verticals [measured].** The
readiness registry (`lib/verticals/readiness.ts`, byte-identical at d5fcfad and bcaccbe)
supports exactly three verticals: **real-estate, cpa, law** (+ the general invoice-chase
on-ramp). The other seven fail the production-caller test and their "Start free trial"
CTAs dead-end at the waitlist screen — which itself carries the false "first month free"
line. The money path is protected (fail-closed signup gate + unsupported-vertical refund
cron — genuinely good engineering), but the marketing promise is false for 7 of 10
verticals. Note: `docs/business-plan/per-vertical-pricing.md` claims five live verticals
including home-services; the enforced registry says three. The registry wins [measured].

**CPA page claims TaxDome + Karbon as live integrations [measured].** Deployed copy:
"Reads the docs your clients upload…" under `shipped`. The 2026-07-03 correction on main
moved them to `planned` with the comment "the paste-your-key connect step isn't open yet…
this page must not claim them live." The deployed claim was false when made (the
marketplace `available` flag was itself the error); the correction is undeployed.
Violates the ratified "available ⇒ must have route" rule.

**HIPAA FAQ overclaim [measured].** `faq-items.ts:115` at d5fcfad: the compliance corpus
"is counsel-reviewed" — present tense, contradicting the site's own repeated "gated until
counsel review." The corpus was 0/45 counsel-reviewed at the 05-26 content vet; no
evidence that changed [unverified whether counsel has since reviewed any of it].

### 2.3 What changed vs the 2026-05-22 baseline

- **Fixed for real, still true:** preference learning (was "biggest overclaim," now
  live); no-auto-send; fixture-honesty on "works from your files."
- **Fixed once, recurred:** internal-filename leaks. PR #90 stripped them in May; the
  /cpa ROI copy renders `b2b_vertical_opportunity_analysis_2026-04-27.md §3.4` on the
  live page today — **and it's still present on main** (`lib/verticals/cpa/content.ts:300`),
  so a deploy won't fix it [measured live + on main; background-task chip filed by the
  audit agent]. Same class: literal "Q8"/"Q9" internal question-numbering rendered as
  homepage design eyebrows; un-interpolated slug grammar ("a cpa firms practitioner's
  week") [measured live].
- **Fixed once, recurred (2):** false counsel-review claim. PR #90 corrected it on the
  homepage; the HIPAA FAQ instance (§2.2) survived.
- **Regressed then fixed on main, stuck undeployed:** engineer vocabulary. 54 instances
  of "rooting now" live; 0 on main ("Setting up," per the customer-vocab ruling)
  [measured].
- **Unverifiable from here, unchanged:** live Stripe catalog state, OAuth client config
  in Vercel prod, SENTRY_DSN — the baseline's config gates [unverified]. The "~35
  cron-fired agents on our own brokerage" claim is flatsbo-internal [unverified].

## 3. The $500/mo test, per vertical

The bar: would an SMB pay $500/mo for *just this one thing*? Three verticals are
supported; each has exactly one candidate workflow [readiness registry, measured].

**Real estate — lead triage + first-touch drafts (`lead-triage-realestate`).** The only
killer skill with multiple live callers (vertical router + FUB/HubSpot/Salesforce
sweeps). The internal math [measured from `docs/business-plan/per-vertical-pricing.md`,
itself labeled modeled]: 40 leads/mo × $11 displaced ≈ $440/mo on time alone, plus
speed-to-lead conversion upside — at the actual $199 anchor it clears its own price, and
the one-extra-closing framing plausibly clears $500. **Would a stranger believe it from
the site?** Almost. This is the strongest page — but the hero day-in-the-life hedges on
"(once dotloop is connected…)", a "Planned · Q3 2026" integration, and the proof section
offers nothing external. Verdict: **closest to passing; belief, not value, is the gap.**

**CPA — month-end close doc-chase (`month-end-close-cpa`).** Live monthly sweep. Modeled
~$296/close per client batch at $75/hr staff time, 5–15× at $299 — the value math clears
$500/mo comfortably for a 20+ client firm *if believed*. **Would a stranger believe it?**
No. The page's directAnswer promises five workflows in present tense while its own agent
roster labels most of them "rooting now"; the trial length changes three times on one
page; and the ROI paragraph — the exact moment of the believe-me ask — cites an internal
planning file by name. Verdict: **value clears the bar; the page sabotages belief at the
precise sentence where it's requested.**

**Law — intake conflict screen (`law-intake-conflict-screen`).** Deterministic, zero-LLM
— genuinely the right trust posture for the vertical, and the risk-avoidance framing
(one avoided conflict pays for years) is the strongest $500/mo argument on paper. But:
the screen runs against a JSON-stub ledger until a matter system connects [measured,
roster comment], the only live integration is Outlook/M365, Clio is "Planned · Q1 2027,"
and the hero stats band renders literally empty — "ROI multiplier: engagement-dependent,"
"Per seat: Quoted." **Would a stranger believe it?** A managing partner reading "your
full client ledger" would eventually discover that means a stub until Clio connects — in
a vertical where trust is the entire sale. Verdict: **fails today; the honest offer is
"deterministic screen once your matter system connects," and the page doesn't say that.**

## 4. The trust gap

What a skeptical SMB owner sees today [all measured from live fetches]:

- **Zero external proof anywhere in the funnel.** No customer name, logo, testimonial,
  case study, outcome number, or screenshot of the product on any of the five core pages.
- **The trust question answered with self-reference.** The FAQ "Why should anyone
  believe you?" answers: (1) "We run the service partnership on flatsbo — our own
  brokerage" and (3) "Every claim on this site cites a memory rule we can show you." A
  prospect reads: *their only customer is themselves, and they talk in internal jargon.*
- **The guarantee is claimed but unexplainable.** "14-day money-back guarantee" appears
  site-wide; https://agentplain.com/guarantee returns **404**. The full walk-away page
  ("If it doesn't save you time, you don't pay" + live saved-time ledger + one-tap
  refund + data deletion, ~1,400 lines of runtime) is MERGED-UNDEPLOYED (PR territory
  of #390–#396 window).
- **The one genuine live trust move:** the /pricing ROI calculator's "audit the formula
  in view-source" framing, with self-capped multipliers. Best surface on the site.
- **The structural finding: deployment is not the binding constraint on proof — content
  is.** The trust scaffolding (PR #392) is merged: permission-gated, measured-source-only
  registries with honest empty states. But all five registries are empty arrays
  (`lib/trust/proof.ts:97-105` on main) [measured]. There is no testimonial, partner,
  case study, or measured outcome **in existence** anywhere in the repo. Deploying today
  would render honest empty states. The registry's admission rules (written permission +
  measured source) mean the only path to proof is a real customer measurably served —
  proof cannot be written, only earned. Until the first design partner converts, the
  trust section of every page is structurally unfillable, and the "trust is the core
  obstacle" diagnosis in the briefing remains unfalsifiable from the site alone.

## 5. Where the proposition is weakest — the three moments a prospect quietly leaves

1. **The "who else trusts you?" moment (homepage, Rooted-in-reality + FAQ).** The
   skeptic's central question is answered with "ourselves, and our internal notes."
   Everything else on the page is architecture the prospect can't yet care about.
   No deploy fixes this; only a first named customer does.

2. **The integrations section of every vertical page (worst on /law and /real-estate).**
   The tools that *define* the vertical — dotloop/MLS for realty (Q3 2026, a window that
   lapses in ~7 weeks), Clio for law (Q1 2027) — are all "Planned," and the hero
   scenarios admit the dependence ("once dotloop is connected…"). The prospect concludes
   the demo they just read doesn't work with their actual system for another quarter to
   a year. This is where the $500/mo decision dies for a technically-attentive buyer.

3. **The money moment (vertical FAQ + pricing block + missing /guarantee).** Three trial
   lengths on one page, a banned "first month free" the card-at-signup flow won't honor,
   and a guarantee whose terms page 404s. A buyer who can't get one straight answer
   about the trial assumes the ROI math is equally loose. The complete fix for this
   moment — facts SSOT, objections section, /guarantee page — is already merged and has
   been invisible for three to seven weeks.

## 6. What this review deliberately left alone

- **The prod migration repair itself** (P3009 / four queued migrations) — build-side;
  owned by the parallel session and the existing P0 queue item. This review only
  establishes that un-deploying is the single highest-leverage value-proposition action:
  it simultaneously retracts the false offers (§2.2) and ships the strongest conversion
  assets (guarantee page, objections, vertical demo, brand system).
- **Copy rewrites** — diagnosed, not redrafted, per the brief. The five fix-list items
  from the deployed-surface audit are in §2.2/§2.3; each is a separate fired unit.
- **The /cpa internal-filename leak on main** — noted (§2.3), background-task chip
  already filed; one-line content fix, build side.
- **The /compare/chatgpt vendor-naming exception** — flagged (§2.1) for an explicit
  ruling, not adjudicated here.
- **Knowledge seed-data stale doctrine purge** — named as a leak vector (§2.2); the fix
  is a build task.
- **flatsbo "~35 agents" claim, Stripe-live/OAuth/Sentry config state, actual customer
  count** — no data source available to this session; all left [unverified] rather than
  guessed.

## Appendix — deployment-state ledger for the major stranded assets

Merged on `main@bcaccbe`, invisible in production, ranked by conversion value
[measured via `git diff d5fcfad..bcaccbe`]:

1. PR #394 — "first month free" purge + trial/guarantee truth in vertical FAQs +
   TaxDome/Karbon correction + customer-vocab cleanup (54 × "rooting now" → "Setting up").
2. `/guarantee` page + its inbound links (pricing, homepage, tier banners).
3. PR #396 — pricing objections section ("flat per seat — no metered usage, no
   overages") + `lib/billing/facts.ts` SSOT.
4. PR #394 — `KillerWorkflowShowcase`: the product demonstrably working on the
   marketing page.
5. PR #320 — Heritage Plains brand system (the entire ratified visual identity).
6. PR #392 — trust scaffolding (empty registries; prerequisite, not payoff).
