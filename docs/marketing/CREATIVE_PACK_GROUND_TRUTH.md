# Outbound Creative Pack — Ground Truth & Claims Whitelist

**Date:** 2026-06-14 · **Branch:** `marketing/ad-and-dtc-materials-pack-2026-06-14`

This is the source of truth every file in `ad-materials/` and `dtc-materials/` is written
against. It is the *outbound* pack — what we send OUT to acquire customers (paid ads +
direct-to-consumer). Distinct from the #255 pack (inbound: vertical landing pages, content
calendar, sales scripts). Where the two overlap on voice, the canon is
`docs/marketing/brand-voice-scenario-library.md`.

Before editing or extending any file here, read this doc and the scenario library. Make
**no claim** that isn't on the whitelist below.

---

## 1. The one-sentence product

agentplain is the **done-for-you service layer on top of Claude** for local businesses. We
install a fleet of capable AI partners inside your business, connect your tools, and run a
monthly review. **The fleet drafts and proposes; you approve and send.** Nothing leaves
without your name on it.

- **Tagline:** *Intelligence rooted in reality.*
- **Mission:** *We lift up local businesses by doing the work that takes their time and
  money away from the people they serve.*
- **Named AI partner:** **Plaino** (one character, every workspace; calm, plain, owner-to-owner).
- **Audience word:** "local businesses." NEVER "SMB," "knowledge workers," "white-collar."
- **Lowercase** `agentplain`, always. Capitalize `Plaino`.

---

## 2. The honesty spine — what we can and cannot say

This is load-bearing. It is the differentiator, not a disclaimer.

**TRUE — say it plainly:**
- The fleet **drafts** work and lands it in your **approvals queue**. Every item is
  PENDING until you decide.
- **You** approve and send — from your own system (your inbox, your CRM, your e-sign).
- **Connected today:** Gmail and Outlook (email), Google Calendar, and **QuickBooks**
  (AR aging, open invoices, month-end). DocuSign + Google Drive on the realty day-one stack.
- A **compliance sentinel** reviews drafts against your vertical's rules and a PII scan,
  and **advises** — it flags; it never blocks, edits, or sends.
- We **install, configure, and run a monthly review.** It's a service, not a tool you drive.
- First month free. Month-to-month. Cancel anytime.

**FALSE / FORBIDDEN — never imply:**
- ❌ The fleet **sends, files, pays, posts, books, or commits** anything on its own. It does not.
- ❌ "Instant AI," "real-time AI," "watch the magic happen." (The prod LLM key is paused →
  degraded-mode is today's reality. Lead with *drafts land in your queue*, a cadence, not a
  live-magic promise.)
- ❌ Direct integration claims for connectors that are **not wired yet.** Do NOT claim we
  plug into EZLynx, Clio, MyCase, AppFolio, Buildium, Encompass, Orion, Redtail, AccuLynx,
  ServiceTitan, Salesforce, or Follow Up Boss as live. Those are roadmap. Email + calendar +
  QuickBooks are the live integration story.
- ❌ "Web search" / "researches the internet." Research is grounded on **your** knowledge
  base only; web search is not wired.
- ❌ "Replace your team / your staff / your assistant." We give the team their time back.
- ❌ Positioning against Claude or ChatGPT as a competitor/alternative. We are the service
  that **runs** the AI for you. "The easy way to actually use Claude" is fine.
- ❌ The word "pilot pricing" / "pilot fees." Say "first month free."

**Banned words** (hard fail): supercharge · unlock · transform · revolutionize ·
revolutionary · seamless · leverage · empower · game-changer · 10x · magic · AI magic ·
cutting-edge · next-gen · robust · synergy · delight · effortless · "automate everything" ·
"AI assistant" · "exciting news!" · "we're thrilled" · "reach out" · "circle back" ·
emoji confetti · exclamation-point spam.

---

## 3. Pricing & trial (verbatim)

- **Regular** — $199 → **$99/seat** (intro). Default entry path.
- **Partner** — $299 → **$199/seat**. Adds 4 hrs/mo of named-service-partner reserved time.
- **Max** — quoted / sales-led. For multi-office, white-label, bespoke compliance, 100+ seats.
- **Custom** — $5K–$15K capability builds.
- **Founder / named-partner time is Max & Custom ONLY.** Regular/Partner support is
  `hello@agentplain.com`.
- **Trial:** card at signup · **7-day default** · **14-day for CPA and Law** · 14-day
  money-back guarantee. First month free, month-to-month, cancel anytime.

CTAs map to two real events: **Start free trial** (`/app/sign-up`) and **Talk to a service
partner** (talk-to-Plaino). Use those verbs.

---

## 4. Per-vertical truth (live workflows + cited ROI)

ROI figures are cited to `lib/verticals/<v>/content.ts` on origin/main. Always attach the
"it drafts; you approve; the avoided-penalty downside is real" frame — the compliance/penalty
angle is the moat an auto-send tool structurally cannot match.

### realty (real estate) — `vertical: real-estate`
- **Live/named workflows:** lead triage (scores inbound, drafts first-touch reply — `runtime: live`),
  commission-invoice chasing (QuickBooks-wired), overnight transaction summary, monthly report draft.
- **Day-one integrations:** Outlook, Gmail, Google Drive, DocuSign.
- **ROI:** **~$5,300/mo** back at the broker-owner level (8–12 coordination hrs/wk × $120/hr),
  **~26× ROI**, ~$61,920/yr. (`real-estate/content.ts` L214-219.)
- **Compliance angle:** Fair Housing — a discriminatory phrase is a $26,262 first-offense HUD
  penalty; the HUD enumerated-phrase scanner flags drafts before a human approves.
- **Tier:** Regular is the entry path.

### cpa (accounting firms) — `vertical: cpa`
- **Live/named workflows:** month-end close (missing-doc chase, status update draft), finance
  weekly pulse (QuickBooks AR aging), onboarding-letter drafting.
- **ROI:** **~$42,000/yr per staff seat** in tax-season hour reclamation (~$3,500/mo),
  **~12× (solo) to ~18× (at scale)**. (`cpa/content.ts` L264-266.)
- **Compliance angle:** Circular 230 / IRC §6694 — a preparer position understating liability
  is a $1,000–$5,000 per-return penalty; a credentialed person approves before anything files.
- **Trial:** 14-day. **Tier:** Partner ladder.

### law (law firms) — `vertical: law`
- **Live/named workflows:** intake conflict screen (deterministic adverse-party check, drafts
  internal notice with legal conclusion as a merge field), doc-review acceleration, status-update drafting.
- **ROI:** **~$150,000/yr** reclaimed at a 3-attorney firm (40% capture of a $375k opportunity);
  a 25-attorney firm past $2.3M/yr. (`law/content.ts` L265-267.)
- **Compliance angle:** ABA Model Rule 1.6 (confidentiality) + 7.1 (no misleading claims) —
  exposure runs to disbarment + malpractice; an attorney approves every client-facing draft.
- **Trial:** 14-day. **Tier:** Max (quote-based); Partner ladder is the floor.

### home-services (trades: roofing, HVAC, plumbing, electrical, GC) — `vertical: home-services`
- **Live/named workflows:** estimate follow-up (per-stage homeowner nudge, cold deals handed
  back to the rep for a call), after-hours call triage draft, insurance-supplement rebuttal draft.
- **ROI:** **$50,000+/yr** in insurance-supplement reclamation alone at a storm-heavy shop
  (~$4,167/mo), **~14× to ~21×**. (`home-services/content.ts` L273-275.)
- **Compliance angle:** TCPA — $500/text ($1,500 willful), no cap; we never auto-send, so a
  non-consented blast never goes out by machine. The one promise an auto-dialer can't make.
- **Tier:** Partner ladder.

### finance (financial advisors / RIA) — `vertical: ria`
- **Live/named workflows:** quarterly client-update draft (every dollar figure + recommendation
  is an `{{advisor: …}}` merge field; Form ADV pointers ride along), meeting-recap draft,
  comms-triage. Finance weekly pulse (QuickBooks) for bookkeeping-side finance ops.
- **ROI:** **~$175,000/yr** reclaimed at a 3-advisor practice (65% capture of a $270k
  opportunity); a 25-advisor practice past $1.4M/yr. (`ria/content.ts` L275-277.)
- **Compliance angle:** SEC Marketing Rule 206(4)-1 — 2024 sweeps settled $60k–$325k per
  adviser for unsubstantiated claims; we draft, the Marketing Rule corpus flags, a person
  approves before anything is filed as an advertisement.
- **Tier:** Max (quote-based); Partner ladder is the floor.

---

## 5. Voice quick-reference (from the scenario library)

- Short declarative sentences, one idea each. Specifics over adjectives.
- Open on the **reader or the fact**, never on us. "Your trial ends Friday." not "We're thrilled…"
- One CTA per message; make it a verb the reader does next.
- Name the human's control on every piece: *the fleet drafts; you approve and send.*
- Honest about limits — if a thing isn't connected yet, say so.
- Subject lines: lowercase-leaning, plain, ≤ 8 words, no exclamation point, no emoji.
- Sign as a person or as Plaino. Plaino never claims to be human.
- The strongest creative is a **concrete Tuesday-night scene**, not a feature list. Show the
  9:14pm counter-offer, the 23 missing-doc clients on March 17, the storm-Monday call volume.
