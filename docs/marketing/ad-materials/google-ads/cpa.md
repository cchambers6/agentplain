# Google Ads — CPA / Accounting Firms

**Vertical:** cpa · **Tier:** Partner ($299 → $199/seat) · **Trial:** 14-day, card at signup, first month free, 14-day money-back.

Ground truth: `docs/marketing/CREATIVE_PACK_GROUND_TRUTH.md` §4 (cpa) + scenario library. The fleet **drafts; the CPA approves and signs.** Nothing files, nothing moves money. Live integration story = email + Google Calendar + QuickBooks only. No "instant/real-time AI."

---

## Responsive Search Ad

### Headlines (≤30 chars — count annotated)

1. `Your firm, minus the chase` — 26
2. `Draft the doc chase, you sign` — 29
3. `Month-end close, drafted` — 24
4. `AI run for your firm` — 20
5. `Tax season, fewer late nights` — 29

(All ≤30. No "instant," no banned words, no auto-file implication — every headline keeps the firm as the signer.)

### Descriptions (≤90 chars — count annotated)

1. `The fleet drafts client doc-chases and month-end close notes. You approve and send.` — 83
2. `Connect email, calendar, QuickBooks. Drafts land in your queue. A CPA signs them.` — 80
3. `~$42,000/yr per seat in tax-season hours back. First month free. 14-day trial.` — 78
4. `Done-for-you AI, run by us. Nothing files until a credentialed person approves.` — 79
5. `Missing-doc reminders drafted with the exact items. You review, you send.` — 73

(All ≤90. ROI cited to `cpa/content.ts`. "You approve and send" / "a CPA signs" on every line — no auto-send.)

### Sitelinks (title ≤25 · desc ≤35)

1. **Title:** `How it works` (12) · **Desc:** `Drafts to your queue, you sign` (30)
2. **Title:** `Pricing` (7) · **Desc:** `$199/seat. First month free.` (28)
3. **Title:** `For accounting firms` (20) · **Desc:** `Month-end, doc chase, finance pulse` (35)
4. **Title:** `Talk to a partner` (17) · **Desc:** `30 min with a service partner` (29)

### Callouts (≤25 chars)

1. `You approve every send` — 22
2. `First month free` — 16
3. `QuickBooks connected` — 20
4. `A CPA signs, not a bot` — 22

### Structured snippets

- **Header: Service catalog** — `Month-end close drafts` · `Missing-doc chase` · `Finance weekly pulse` · `Onboarding letters`
- **Header: Type** — `Done-for-you setup` · `Monthly review` · `Approvals queue` · `Compliance sentinel`

---

## Keyword recommendations (long-tail CPA pain phrases, grouped)

Match types: start phrase + exact; reserve broad for the research group only.

### Group A — month-end / close pain
- `cpa month end close automation`
- `accounting firm month end checklist tool`
- `speed up month end close small firm`
- `client missing documents tax season`

### Group B — doc chase / client follow-up
- `chase clients for tax documents`
- `automate client document requests cpa`
- `tax document reminder for clients`
- `accounting firm client follow up software`

### Group C — staff capacity / busy season
- `cpa firm staff burnout tax season`
- `reduce tax season hours accounting firm`
- `accounting firm do more with fewer staff`
- `small accounting firm workflow help`

### Group D — AI-for-firm intent (high-consideration)
- `ai for accounting firm workflow`
- `ai assistant for cpa firm` *(bid; landing copy must not use the banned phrase "AI assistant" — keyword only)*
- `done for you ai accounting practice`
- `ai to draft client emails cpa`

(≥12 phrases across 4 intent groups. Group D is research-leaning — pair with the "drafts, you sign" landing message so intent matches the honesty spine.)

## Negative keywords (≥12)

`free` · `jobs` · `job` · `salary` · `careers` · `cpa exam` · `cpa exam prep` · `cpa course` · `how to become a cpa` · `intuit` · `quickbooks online login` · `taxdome` · `karbon` · `drake software` · `ultratax` · `cch axcess` · `template` · `excel template` · `crack` · `reddit`

(Blocks job-seekers, students/exam, free-tool hunters, login traffic, and competitor/software names we don't claim live integration with. Note: QuickBooks IS a live integration, but `quickbooks online login` is support/login intent, not buyer intent — negated.)

## Budget & bidding

- **Start:** $40–60/day per active campaign while CPA volume is unproven; concentrate on Groups A–C (problem-aware) before scaling Group D.
- **Bidding:** open on **Maximize Conversions** with conversion = `Start free trial` (`/app/sign-up`) and a secondary soft-conversion = `Talk to a service partner`. Once you clear ~15 conversions/30 days, move to **Target CPA**, seeded at observed CPA, not a guess.
- **Seasonality:** CPA intent spikes Jan–Apr (tax season) and around quarter-ends. Raise budget into Jan–Mar; the strongest creative is the March-17 doc-chase scene — schedule it to lead in busy season.
- **Day-part** toward business hours + early evening (the "another late night" moment).

## Quality-score considerations

- **Headline↔landing match:** RSA headlines say "drafts the doc chase, you sign" — the landing page must repeat that exact control ("the fleet drafts; you approve and send") above the fold. Mismatch tanks Ad Relevance.
- **Keep one keyword theme per ad group** (A/B/C/D separate) so the inserted headline matches query intent and Expected CTR holds.
- **Landing experience:** name the live integrations honestly (email + calendar + QuickBooks), state the 14-day trial + first-month-free + money-back terms, and make `Start free trial` the single primary CTA. No "instant AI" claims — they read as off-promise and hurt trust signals.
- **Pin discipline:** pin the "you approve and send" headline to position 2 or 3 so the no-auto-send control appears in every served combination.
