# Design-Partner Outreach — Claims Ground Truth

**Date:** 2026-06-16 · **Branch:** `feat/design-partner-outreach-2026-06-16`

Every claim in every packet under `docs/marketing/design-partner-outreach/` is written against
this file. It is the Truth Wave compliance spine for the design-partner phase. If a claim is not
traceable to a citation here, it does not go in a packet. This file is the reviewer's checklist.

Provenance for product/voice claims: `docs/marketing/CREATIVE_PACK_GROUND_TRUTH.md` and
`docs/marketing/brand-voice-scenario-library.md`. Pricing/trial: `lib/pricing/tiers.ts` (the code
is the source of truth — it supersedes any prose copy that disagrees). ROI/workflow/compliance per
vertical: `lib/verticals/<v>/content.ts` on `origin/main` (citations inline below).

---

## 1. Product (one sentence)

agentplain is the **done-for-you service layer on top of Claude** for local businesses. We install a
fleet of capable AI partners inside your business, connect your tools, and run a monthly review.
**The fleet drafts and proposes; you approve and send.** Nothing leaves without your name on it.

- **Tagline:** *Intelligence rooted in reality.*
- **Mission:** *We lift up local businesses by doing the work that takes their time and money away
  from the people they serve.*
- **Named AI partner:** **Plaino** (one character, every workspace; calm, plain, owner-to-owner).
- **Audience word:** "local businesses." NEVER "SMB," "knowledge workers," "white-collar."
- **Lowercase** `agentplain`, always. Capitalize `Plaino`.

## 2. Honesty spine — load-bearing, this is the differentiator

**TRUE — say it plainly:**
- The fleet **drafts** work and lands it in your **approvals queue**. Every item is PENDING until you decide.
- **You** approve and send — from your own system (your inbox, your CRM, your e-sign).
- **Connected today:** Gmail and Outlook (email), Google Calendar, and **QuickBooks** (AR aging,
  open invoices, month-end). DocuSign + Google Drive on the realty day-one stack.
- A **compliance sentinel** reviews drafts against your vertical's rules and a PII scan, and
  **advises** — it flags; it never blocks, edits, or sends.
- We **install, configure, and run a monthly review.** It's a service, not a tool you drive.

**FALSE / FORBIDDEN — never imply:**
- ❌ The fleet **sends, files, pays, posts, books, or commits** anything on its own. It does not.
- ❌ "Instant AI," "real-time AI," "watch the magic happen." Lead with *drafts land in your queue* — a cadence, not a live-magic promise.
- ❌ Direct integration claims for connectors **not wired yet**: EZLynx, Clio, MyCase, AppFolio,
  Buildium, Propertyware, Yardi, Encompass, Orion, Redtail, AccuLynx, ServiceTitan, Salesforce,
  Follow Up Boss. Those are roadmap. Email + calendar + QuickBooks (+ DocuSign/Drive on realty) is the live story.
- ❌ "Web search" / "researches the internet." Research is grounded on **your** knowledge base only.
- ❌ "Replace your team / your staff / your assistant." We give the team their time back.
- ❌ Positioning against Claude or ChatGPT as a competitor. We are the service that **runs** the AI for you.
- ❌ NEVER name the model vendor (Claude / Anthropic) in customer-facing copy. The model is invisible.
- ❌ Customer counts, logos, or testimonials we do not have. There are **zero** named customers today —
  that is precisely why the design-partner program exists. Never imply existing customers.
- ❌ Fabricated ROI. All vertical ROI below is **operator-modeled** unless a `runtime: live` workflow
  is cited; frame it as a model, attach the avoided-penalty downside, never as customer-attested results.

**Banned words (hard fail):** supercharge · unlock · transform · revolutionize · revolutionary ·
seamless · leverage · empower · game-changer · 10x · magic · cutting-edge · next-gen · robust ·
synergy · delight · effortless · "automate everything" · "AI assistant" · "exciting news!" ·
"we're thrilled" · "reach out" · "circle back" · emoji confetti · exclamation-point spam.

## 3. Voice

- Short declarative sentences, one idea each. Specifics over adjectives.
- Open on the **reader or the fact**, never on us.
- One CTA per message; make it a verb the reader does next.
- Name the human's control on every piece: *the fleet drafts; you approve and send.*
- Honest about limits — if a thing isn't connected yet, say so.
- Subject lines: lowercase-leaning, plain, ≤ 8 words, no exclamation point, no emoji.
- Sign as a person (Conner Chambers, founder) or as Plaino. Plaino never claims to be human.
- **Plaino voice is fine for general/real-estate/property-management. For law and CPA, drop the
  robot-dog persona** — sign as Conner, keep it sober. Compliance copy is never cute.
- The strongest line is a **concrete Tuesday-night scene**, not a feature list.

## 4. Pricing & trial (verbatim — from `lib/pricing/tiers.ts`)

Per-seat / month, sliding by seat band (`PER_SEAT_MONTHLY_USD_CENTS`):

| Tier | 1 seat | 50–99 seats | Notes |
|------|--------|-------------|-------|
| **Regular** | $199 | $99 | Default entry path. `TIER_TAGLINE.regular`: "Standard managed AI ops + onboarding bundled." |
| **Partner** | $299 | $199 | `TIER_TAGLINE.plus`: "Everything in Regular, plus priority support and a quarterly async check-in with your service team." **No reserved Conner hours.** |
| **Max** | quote-based | — | Sales-led. Multi-state, white-label, dedicated team. Not self-serve. |
| **Custom** | $5K–$15K | — | Capability builds. |

- **Trial:** card at signup · **7-day default** (`TRIAL_PERIOD_DAYS`) · **14-day for CPA and Law**
  (`trialPeriodDaysForVertical`) · **14-day money-back guarantee** (`MONEY_BACK_GUARANTEE_DAYS`).
  Month-to-month, cancel anytime.
- **Founder / Conner time in PAID plans is Max & Custom ONLY.** Regular/Partner support is
  `hello@agentplain.com` (priority email + quarterly async check-in for Partner). **Never promise
  Conner-time in Regular or Partner paid copy.**
- CTAs map to real events: **Start free trial** (`/app/sign-up`) and **Talk to a service partner**.

## 5. Design-Partner Program terms (THIS program — distinct from the paid plans above)

The design-partner program is the on-record-proof phase. Terms:

**What the partner gets:**
- **Free for the first 3 months** of the pilot (not "first month free" — design partners get 3 months).
  After the pilot, they convert to standard month-to-month pricing for their tier (no obligation to convert).
- **Dedicated founder time** during the pilot — direct access to Conner Chambers, weekly. *This is the
  one place Conner-time is offered outside Max/Custom — it is the explicit design-partner consideration.*
- **Early access to new features** as they ship, and a direct line into the roadmap.
- **A joint case study** — co-authored, they approve every word before it's public.

**What we ask back:**
- A **weekly 30-minute call** during the pilot (their stack, what's working, what's not).
- An **on-record testimonial** once they've seen value.
- Willingness to be **referenced for sales** — a reference call or quote for future prospects.

Cap framing: the design-partner cohort is small (3–5 partners across all verticals) so each gets real
founder attention. Do not invent a specific countdown ("only 2 spots left") unless true — say "a small
cohort" / "a handful of partners."

## 6. Per-vertical facts (cite these, nothing else)

### real-estate — `vertical: real-estate` · entry tier: Regular · 7-day trial
- **Live workflows:** lead triage (scores inbound, drafts first-touch reply — `runtime: live`),
  commission-invoice chasing (QuickBooks-wired), overnight transaction summary, monthly report draft.
- **Day-one integrations:** Outlook, Gmail, Google Drive, DocuSign, QuickBooks.
- **ROI (operator-modeled):** ~$5,300/mo back at broker-owner level (8–12 coordination hrs/wk × $120/hr),
  ~26× ROI, ~$61,920/yr. (`real-estate/content.ts` L214-219.)
- **Compliance angle:** Fair Housing — a discriminatory phrase is a **$26,262** first-offense HUD
  penalty; the HUD enumerated-phrase scanner flags drafts before a human approves.
- **Persona:** Plaino voice OK.

### cpa — `vertical: cpa` · ladder: Partner · **14-day trial**
- **Live workflows:** month-end close (missing-doc chase, status update draft), finance weekly pulse
  (QuickBooks AR aging), onboarding-letter drafting.
- **ROI (operator-modeled):** ~$42,000/yr per staff seat in tax-season hour reclamation (~$3,500/mo),
  ~12× (solo) to ~18× (at scale). (`cpa/content.ts` L264-266.)
- **Compliance angle:** Circular 230 / IRC §6694 — a preparer position understating liability is a
  **$1,000–$5,000 per-return** penalty; a credentialed person approves before anything files.
- **Persona:** NO robot-dog persona. Sober. Sign as Conner.

### law — `vertical: law` · ladder: Partner floor, Max for multi-office · **14-day trial**
- **Live workflows:** intake conflict screen (deterministic adverse-party check, drafts internal
  notice with legal conclusion as a merge field), doc-review acceleration, status-update drafting.
- **ROI (operator-modeled):** ~$150,000/yr reclaimed at a 3-attorney firm (40% capture of a $375k
  opportunity); a 25-attorney firm past $2.3M/yr. (`law/content.ts` L265-267.)
- **Compliance angle:** ABA Model Rule 1.6 (confidentiality) + 7.1 (no misleading claims) — exposure
  runs to disbarment + malpractice; an attorney approves every client-facing draft.
- **Persona:** NO robot-dog persona. Sober, precise. Sign as Conner.

### property-management — `vertical: property-management` · entry tier: Regular · 7-day trial
- **Live workflows:** Tenant Inbound (`runtime: live`), Collections (`runtime: live`), Chief of Staff
  (`runtime: live`). Work-Order Router, Renewal Coordinator, Owner Reporter, Application Screening,
  Books Reconciler are still **Setting up** (`runtime: rooting` — use customer vocab "Setting up,"
  never "rooting"). (`property-management/content.ts` L49-117.)
- **Live integrations:** QuickBooks Online, Outlook + M365 Graph, Gmail/Google, Twilio Voice
  (inbound triage receiver ONLY). **Buildium, AppFolio, Propertyware, Yardi Breeze = roadmap, NOT
  live — never claim them.** (`property-management/content.ts` L312-329.)
- **ROI (operator-modeled, pending primary research — frame as a model):** ~$12k/yr per PM in labor
  reclamation; 3 PMs ≈ $36k vs ~$7,164/yr in seats ≈ ~5× at three PMs, sliding to ~15×+ past 25 seats.
  Delinquency-day compression upside ($80k/yr at 200 doors) is **modeled upside, not committed.**
  (`property-management/content.ts` L277-284.)
- **Compliance angle:** Fair Housing (**$26,262** first-offense HUD, 24 CFR §180.671) + state
  landlord-tenant notice/timing rules. The PM fair-housing pass activates after counsel review; today
  the safeguard is the human approval gate. (`property-management/content.ts` L286.)
- **Persona:** Plaino voice OK but keep fair-housing references sober.

### general (SMB on-ramp) — `vertical: general` · entry tier: Regular · 7-day trial
- **Live workflows (all `runtime: live`, require Google/M365):** Chief of Staff, Inbox Triage,
  Follow-Up Chaser, Process-Doc Drafter. (`general/content.ts` L82-116.)
- **Live integrations:** Gmail, Microsoft 365/Outlook, QuickBooks Online (read-only), Google Calendar,
  DocuSign, generic CRM webhook receiver. (`general/content.ts` L247-254.)
- **ROI (operator-modeled, floor case):** ~$2,580/mo from ~6 owner-hrs/wk × $100/hr × 4.3 weeks ≈ ~13×
  at the floor, ~15× headline. **No vertical-specific compliance corpus** — if a business needs one,
  it's a Custom engagement. Honest trade: lower upside ceiling than a named vertical.
  (`general/content.ts` L206-217.)
- **Compliance angle:** baseline only — TCPA ($500–$1,500/message, 47 U.S.C. §227), CAN-SPAM, FTC Act
  §5. No vertical corpus; safeguard is the human approval gate. (`general/content.ts` L217.)
- **Persona:** Plaino voice OK.

## 7. Customer vocab (never use engineer labels on customer surfaces)

`rooting` → "Setting up" · `live` → "Working" / "Watching" · never say "agent runtime," "adapter,"
"connector wired," "dispatch." Say "your inbox is connected," "Plaino is watching your leads."
