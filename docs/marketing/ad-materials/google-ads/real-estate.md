# Google Ads — Real Estate (realty)

Vertical: `real-estate` · Tier: Regular ($199 → $99/seat) · Trial: 7-day, card at signup,
first month free, 14-day money-back.

Written against `CREATIVE_PACK_GROUND_TRUTH.md` + `brand-voice-scenario-library.md`. The
fleet **drafts and proposes; the broker approves and sends.** No auto-send claim anywhere.
Live integration story = email (Gmail/Outlook) + Google Calendar + QuickBooks + (realty
day-one) DocuSign + Google Drive. No FUB / dotloop / MLS / kvCORE claims.

---

## Responsive search ad

### Headlines (≤30 chars each)

1. `Drafts ready by 6:30am` — 22
2. `You approve. Plaino drafts.` — 27
3. `Get your mornings back` — 22
4. `Counter-offer, drafted` — 22
5. `Run your brokerage on less` — 26

### Descriptions (≤90 chars each)

1. `The fleet drafts the routine work overnight. You change one number and hit send.` — 80
2. `Lead replies, invoice chases, deal summaries — drafted to your queue. You approve.` — 82
3. `~$5,300/mo of coordination time back. First month free. Cancel anytime.` — 71
4. `A Fair-Housing scan flags risky listing phrasing before a person approves.` — 74
5. `Done-for-you AI for brokerages. We install it, connect your tools, run it.` — 74

### Sitelinks (title ≤25 · description ≤35)

1. `How it works` / `Drafts land in your approvals queue` — 22 / 35
2. `Fair-Housing scan` / `Flags risky phrasing before send` — 17 / 32
3. `Pricing` / `$99 a seat. First month free.` — 7 / 29
4. `Talk to a partner` / `15 minutes, owner to owner` — 17 / 26

### Callouts (≤25 chars each)

1. `You approve every send` — 22
2. `First month free` — 16
3. `Cancel anytime` — 14
4. `QuickBooks + DocuSign` — 21

### Structured snippets

- **Header — Services:** Lead triage · Commission-invoice chasing · Overnight deal summary ·
  Monthly report draft · Fair-Housing scan
- **Header — Workflows:** First-touch reply drafts · Counter-offer prep · Open-invoice chases ·
  Transaction recaps

---

## Keyword recommendations (long-tail realty pain)

Grouped by intent. Phrase + broad-match-modifier blend; start phrase, expand to broad on
proven converters.

**Time / coordination pain**
- `real estate transaction coordinator alternative`
- `too much admin work real estate broker`
- `real estate paperwork taking too long`
- `cut transaction coordination time brokerage`

**Lead-response pain**
- `respond to real estate leads faster`
- `draft replies to buyer leads`
- `follow up with real estate leads automatically` *(note: ad copy must say "drafts," not "auto")*

**Commission / billing pain**
- `chase unpaid real estate commissions`
- `commission invoice follow up brokerage`

**Compliance pain**
- `fair housing compliant listing language`
- `avoid fair housing violation listing`

**Tooling / category**
- `ai for real estate brokerage`
- `done for you ai real estate broker`
- `ai to help real estate agents with admin`

---

## Negative keywords (filter wrong intent)

- `free`
- `zillow`
- `kvcore`
- `kvCORE`
- `follow up boss`
- `dotloop`
- `chime`
- `lofty`
- `jobs`
- `hiring`
- `salary`
- `course`
- `training`
- `license` *(license-exam seekers, not brokerages)*
- `crm comparison` *(we are not a CRM; avoid bad-fit clicks)*
- `mls login`

---

## Budget & bidding

- **Starting daily budget:** $40–60/day on Search to gather conversion volume on the
  realty landing page. Realty is the lead vertical, so weight spend here first.
- **Bidding:** open with **Maximize Conversions** (no tCPA cap) for the first ~15
  conversions / 2–3 weeks to let the system learn what a "Start free trial" signup looks
  like. Once you have ~15+ conversions, switch to **Target CPA** anchored to your real
  blended trial-CPA, then nudge tCPA down 10–15% at a time.
- **Campaign type:** start **Search only.** Hold **Performance Max** until you have a clean
  conversion signal and at least one strong landing page + a small asset set — PMax will
  spend into Display/Discovery inventory where the "drafts overnight, you approve" message
  is easy to mis-render as auto-send. Search keeps message control tight.
- **Conversion action:** primary = `Start free trial` (`/app/sign-up`). Secondary =
  `Talk to a service partner`. Do not optimize to raw clicks.

---

## Quality-score considerations

- **Ad relevance:** mirror the keyword group's pain in the headline. The "drafts ready by
  6:30am" / "counter-offer, drafted" headlines map to the time/coordination and lead-response
  groups — keep each ad group to one pain so the headline matches the search.
- **Expected CTR:** the concrete-scene headlines (`Drafts ready by 6:30am`, `Counter-offer,
  drafted`) outperform feature headlines. Pin one concrete-scene headline to position 1 in
  testing; let the rest rotate.
- **Landing-page experience:** point realty ads to the **realty landing page** (the inbound
  #255 pack vertical page for `real-estate`), NOT the generic homepage. The LP must carry the
  same promise the ad makes — overnight drafts, you approve, the Fair-Housing scan, $99/seat,
  first month free — so the scent matches from click to signup. Mismatched promise = LP-experience
  penalty and wasted trial-CPA.
- **Honesty guardrail for QS:** never let an auto-applied "automatically" suggestion ship in
  ad copy — it reads as auto-send and violates the honesty spine. Reject Google's
  auto-apply recommendations that rewrite "drafts" into "does it for you."
