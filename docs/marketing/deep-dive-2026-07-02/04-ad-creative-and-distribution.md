# Ad creative + distribution plan — 25 concepts, budgets, and the spend gate

**Standing on:** paste-ready platform copy already exists (`docs/marketing/ad-platform-copy/{google,meta,linkedin,reddit}.md`, synthesized from `ad-materials/`). This document adds the concept layer (what the ads *are*), the budget logic, and the test order. Where a concept matches existing ad-materials copy, production starts there.

**Production rule:** static and video creative is produced through the creative pipeline (creative-router + the job/tool matrix, per `feedback_creative_assets_use_tools_or_humans`) or commissioned humans — never improvised. Visual identity is Heritage Plains Editorial (#316/#320): paper/ink/clay/forest/wheat tokens, letterpress texture, editorial layout, the 8-bit Plaino service dog as the one named character. No gradient-SaaS look, no stock "person smiling at laptop."

**Claims rule:** every ad inherits the ground-truth whitelist (`CREATIVE_PACK_GROUND_TRUTH.md`) with one correction — trial language is **7-day free trial, card at signup (14-day for CPA and law), 14-day money-back**, per `lib/billing/facts.ts`. Any surviving "first month free" copy in the older packs is drift; kill it on contact. No customer counts, no testimonials until permissioned, no live-integration claims beyond email + calendar + QuickBooks (+ DocuSign/Drive realty).

---

## THE SPEND GATE (read first)

No paid dollar moves until all four are true:

1. **Front door fixed** — audit dept 1 P0/P1s closed (the `/how-it-works` redirect above all; paying to send people to a broken nav item is burning money).
2. **Measurement wired** — analytics + UTM discipline + "how did you hear about us" live (`06-measurement.md`).
3. **First proof asset earned** — at least one permissioned design-partner quote for the vertical being tested. Ads without proof can still run honest problem/mechanism angles (concepts below are written to work proof-free), but the landing surface converts measurably better with one true quote on it.
4. **Ratified GTM order respected** — founder-led design-partner outreach is the #1 channel (`project_money_gtm_pack_2026_06_14`); paid exists to *amplify* a working motion, not substitute for one.

Until the gate opens, "distribution" means the organic motions at the end of this file — those start now.

---

## Ad concepts — 5 per vertical

Format per concept: **Headline** · Hook (the first line/frame) · Visual direction · CTA · Platform.

### Real estate (test vertical #1)

1. **"Every lead answered. By you."**
   Hook: "Speed-to-lead matters. So does it being *you* who answers." · Visual: split editorial panel — inbox at 11pm vs. a morning approval queue with drafted replies; Plaino sitting by the queue. · CTA: Start free trial · Platform: Meta (broker-owner interest sets), Instagram.
2. **"Your commission checks won't chase themselves. Plaino drafts the chase."**
   Hook: the aging invoice everyone recognizes. · Visual: letterpress ledger card, one overdue line highlighted in clay, a drafted follow-up beside it. · CTA: See how it works · Platform: Meta + retargeting.
3. **"The 9pm email pile, drafted by 7am."**
   Hook: "Forty emails that each need two sentences from you. They're drafted. You approve." · Visual: 15-sec motion piece — queue filling overnight (timestamp corner), broker approving over coffee. · CTA: Start free trial · Platform: YouTube pre-roll (real-estate content), Meta Reels.
4. **"A $26,262 typo."**
   Hook: "That's the first-offense fair-housing penalty. Every draft here gets reviewed before you ever see it." · Visual: stark editorial type on paper token; the figure set huge in ink, source cited small (HUD). · CTA: Read how the review works · Platform: LinkedIn (broker-owners), industry newsletters (Inman-adjacent).
5. **"Keep the CRM. Lose the typing."**
   Hook: "Your CRM organizes the work. Someone still has to do it." · Visual: editorial diagram — CRM box intact, the drafting work flowing around it into an approval queue. · CTA: See the difference (`/compare`) · Platform: Reddit (r/realtors, honest-tone version), Google Search (comparison keywords).

### CPA / accounting firms (test vertical #2)

6. **"The documents your clients swore they sent."**
   Hook: "Half of busy season is the chase. The chase now drafts itself." · Visual: paper checklist, missing items in clay, drafted chase emails fanned beside it. · CTA: Start your 14-day trial · Platform: LinkedIn (firm owners, 1–10 employees).
7. **"Status updates without the afternoon."**
   Hook: "Clients want to hear from you weekly. Now it costs you a click, not an hour." · Visual: calendar page with afternoons crossed out, then returned. · CTA: See a week of drafts · Platform: LinkedIn, industry newsletters (CPA Practice Advisor-adjacent).
8. **"Nothing files. Nothing sends. You sign everything."**
   Hook: lead with the fear, answer it in the headline. · Visual: the approval queue itself, PENDING states visible; Plaino waiting, not acting. · CTA: Read the control model · Platform: Google Search (trust keywords), LinkedIn.
9. **"Your AR aging, read and chased."**
   Hook: "QuickBooks knows who owes you. The follow-ups draft themselves." · Visual: AR aging bands rendered as heritage ledger art, drafted reminders attached. · CTA: Start your 14-day trial · Platform: Meta (lookalike-free interest targeting), Google Search ("ar follow up accounting").
10. **"Grow the book without the hire."**
    Hook: "You can't find staff. The admin work doesn't care." · Visual: editorial photo brief (real firm, golden hour — pending photography production; type-only interim). · CTA: Talk to a service partner · Platform: LinkedIn sponsored + newsletters.

### Law firms (test vertical #3 — LinkedIn-led, low budget until proof)

11. **"Clients call when they haven't heard from you."**
    Hook: "Most bar complaints start as silence. Status updates now draft on a cadence." · Visual: quiet editorial type; a drafted status letter with the matter context visible, ATTORNEY APPROVAL stamp watermark. · CTA: See how drafting works · Platform: LinkedIn (managing partners, 1–10 attorneys).
12. **"The conflict check runs. The conclusion stays yours."**
    Hook: "Deterministic adverse-party screen. The legal judgment field is left blank on purpose." · Visual: intake form with one field literally blank, highlighted. · CTA: Read the intake workflow · Platform: LinkedIn, legal newsletters.
13. **"Rule 1.6 was our design constraint."**
    Hook: "Your files stay in your systems. We read where the data lives." · Visual: pass-through diagram in heritage tokens, subprocessor-transparency note. · CTA: Read the data posture · Platform: LinkedIn, Google Search ("law firm ai confidentiality").
14. **"Associate hours belong on billable work."**
    Hook: "Routine correspondence eats six figures of associate time a year. Drafted now." · Visual: two stacked timesheets, before/with. · CTA: See the math (`/law` ROI) · Platform: LinkedIn.
15. **"An attorney approves every word."**
    Hook: the whole pitch in five words. · Visual: type-only, letterpress, the line set like a masthead motto. · CTA: Start your 14-day trial · Platform: retargeting only (site visitors from law pages).

### Property management (test vertical #4)

16. **"Fifty late-rent emails. One coffee."**
    Hook: "Firm, polite, drafted on the delinquency cadence. You approve them in a sitting." · Visual: stack of drafted notices, mug beside; Plaino at heel. · CTA: Start free trial · Platform: Meta (PM interest sets), Reddit (r/PropertyManagement, honest tone).
17. **"Owners feel informed. You didn't write a word."**
    Hook: "Monthly owner notes, drafted from what actually happened." · Visual: an owner-update letter on paper token with real-shaped specifics (occupancy, two work orders, one renewal). · CTA: See a sample owner note · Platform: Meta, industry newsletters.
18. **"Every tenant email is a compliance moment."**
    Hook: "Drafts get reviewed against your rules before you approve. Because one worded-wrong reply is all it takes." · Visual: draft with review annotations visible. · CTA: Read how review works · Platform: LinkedIn, Google Search.
19. **"The ledger's current. Is the correspondence?"**
    Hook: "AppFolio knows the balance. Someone still writes the emails." · Visual: ledger vs. inbox split, the inbox side catching up. · CTA: See the difference (`/compare`) · Platform: Google Search (comparison keywords), Reddit.
20. **"Per seat. Not per door."**
    Hook: "Your software bill grows with the portfolio. This one doesn't." · Visual: pricing card, plain. · CTA: See pricing · Platform: retargeting, Google Search ("per unit pricing property management").

### General / all local businesses (test last — broadest, weakest ICP concentration)

21. **"A service that runs. Not a tool you drive."**
    Hook: "The AI you pay for answers when you ask. This one works whether you ask or not." · Visual: chat cursor blinking idle vs. a queue filling on a cadence. · CTA: See how it works · Platform: Meta broad + YouTube. *(Note for writers: resist the antithesis phrasing of this idea — the two-sentence version above is the approved form.)*
22. **"Your Sunday, returned."**
    Hook: "The same ten emails every week, drafted before you sit down." · Visual: editorial photo brief (real owner, real shop, golden hour); type-only interim. · CTA: Start free trial · Platform: Meta.
23. **"You stay the only one who hits send."**
    Hook: the control line as the whole ad. · Visual: a single SEND button under glass, museum-plaque caption. · CTA: Read the control model · Platform: retargeting, X (organic-first).
24. **"Hiring is $4,000 a month. This is $99."**
    Hook: "An assistant you don't have to train, manage, or replace." (Honest beat: "A person still beats it at judgment and phones. We say so.") · Visual: side-by-side cost card, the concession printed on the ad itself. · CTA: Compare honestly (`/compare/hiring-an-assistant`) · Platform: Meta, Google Search ("virtual assistant cost").
25. **"Intelligence rooted in reality."**
    Hook: brand ad — the tagline over the dogfooding truth: "We run the same fleet inside our own brokerage. It drafted this morning's follow-ups too." · Visual: the Plaino mark + heritage masthead treatment; the one place the brand ad is earned because the claim is true. · CTA: About us · Platform: YouTube bumper, LinkedIn brand.

---

## Budget ranges and test order

**Planning assumptions, not claims** — these bands are to be validated by the first test and revised in `06-measurement.md`'s weekly review. They come from public platform benchmark ranges for local-services B2B, which vary widely; treat them as starting bids, not forecasts.

| Order | Vertical | Why this order | Monthly test budget | Primary platforms | Judge on |
|---|---|---|---|---|---|
| 1 | Real estate | Live killer workflow, counsel-ready corpus, founder network, design partners concentrating here | $1,500–3,000 (6–8 wks) | Meta + retargeting, then YouTube | Cost per qualified trial start |
| 2 | CPA | Highest urgency seasonality (pre-January), QuickBooks story is wired today, 14-day trial reduces friction | $1,000–2,500 | LinkedIn + Google Search | Cost per qualified trial start; discount LinkedIn CPC sticker shock against deal quality |
| 3 | Property management | Concentrated, reachable ICP; strong template/tool content synergy | $750–1,500 | Meta + Reddit + Search | Same |
| 4 | Law | Highest trust bar; needs the counsel-packet + proof assets first; expensive clicks | $500–1,500, LinkedIn only, retargeting-weighted | LinkedIn | Engagement quality over volume |
| 5 | General | Broadest audience, weakest concentration; only after a vertical shows a repeatable trial→paid reading | $0 until then | — | — |

Total worst-case concurrent exposure if everything gates green: ~$3–5K/month in Q3, single vertical at a time preferred. If the spend gate never opens this quarter, the realty budget rolls to photography production (kaizen investment #2).

## Organic distribution (starts now, no gate)

1. **Founder-led design-partner outreach** — the ratified #1 channel. Realtor associations, Lab Coat Agents, CRM user groups. Marketing's job: keep the outreach packets current and armed with the newest true material.
2. **Content cadence** (`02-seo-aeo-content-pipeline.md`) — 2/week, the compounding channel.
3. **Reddit + community presence, honest-tone only.** Answer real questions in r/realtors, r/Accounting, r/PropertyManagement with actual substance; link only when it genuinely answers. The voice survives here precisely because it doesn't sound like marketing.
4. **Industry newsletters** — sponsorships are cheap tests of the same creative concepts in trusted contexts; also the placement where the honesty posture reads loudest.
5. **Social accounts** — reserve handles and post the content cadence output (audit dept 1 noted zero social presence). No follower-count games; the accounts exist so the brand resolves when someone searches it.
6. **The dogfooding story** — the brokerage fleet is the one production narrative that is true today; tell it concretely and repeatedly across all of the above.
