# Google Ads — finance (financial advisors / RIAs)

**Vertical:** `ria` · **Tier:** Max (quote-based) · Partner floor ($299 → $199/seat)
**Channel intent:** high. Searchers are practice principals/ops managers looking for help with advisor admin and Marketing-Rule risk.
**Ground truth:** every claim below traces to `CREATIVE_PACK_GROUND_TRUTH.md` §4 (finance) and the brand-voice library scenario 23. The fleet **drafts; the advisor approves and sends.** No dollar figure is ever rendered by the fleet — every number is an `{{advisor: …}}` merge field.

---

## Responsive Search Ad

### Headlines (≤30 chars — count annotated)

1. `Advisor admin, drafted` — 22
2. `Quarterly letters by morning` — 28
3. `You approve. You sign.` — 22
4. `Marketing Rule, on your side` — 28
5. `Done-for-you for your RIA` — 25

> All five are safe to pin. H3 and H5 carry the honesty spine (advisor controls the send); rotate H1/H2/H4 as the value hooks. None imply auto-send, returns, or live custodian/portfolio integration.

### Descriptions (≤90 chars — count annotated)

1. `The fleet drafts your client letters and recaps. You approve and sign every one.` — 80
2. `Every dollar figure stays a merge field for you to fill. Nothing files on its own.` — 83
3. `Quarterly updates drafted overnight. Meeting recaps within hours, not three days.` — 81
4. `Built on Claude, run by us. Email, calendar, and QuickBooks connected today.` — 76
5. `Drafts land in your queue on a cadence. A person approves before anything sends.` — 80

> D2 and D5 are the compliance spine — keep at least one pinned. D4 names only the live integrations (email, calendar, QuickBooks); do not add Orion/Redtail/custodian claims.

### Sitelinks (link text ≤25 / description ≤35)

1. **Talk to a service partner** — `Scope your practice in 15 min` (29 → trim to: `Scope your practice in 15 min` is 29; use `A 15-minute scoping call` — 24)
2. **How it works** — `The fleet drafts; you approve` — 29 → use `Draft, then you approve` — 23
3. **The Marketing Rule** — `How we draft within 206(4)-1` — 28 → use `How we draft within the rule` — 28
4. **Pricing** — `Max quote; Partner floor` — 24

> Corrected to fit ≤25 link / ≤35 desc:
> 1. **Talk to a partner** (16) — `A 15-minute scoping call` (24)
> 2. **How it works** (12) — `Draft, then you approve` (23)
> 3. **The Marketing Rule** (18) — `How we draft within the rule` (28)
> 4. **Pricing** (7) — `Max quote; Partner floor` (24)

### Callouts (≤25 chars)

1. `You approve every send` — 22
2. `Every number a merge field` — 26 → use `Numbers stay merge fields` — 24
3. `First month free` — 16
4. `Built on Claude, run by us` — 26 → use `Built on Claude` — 15

> Final callouts: `You approve every send` · `Numbers stay merge fields` · `First month free` · `Built on Claude`

### Structured snippets

- **Header: Service catalog** — `Quarterly client letters` · `Meeting recaps` · `Comms triage` · `Bookkeeping pulse`
- **Header: Service catalog (alt)** — `Draft & approve workflow` · `Marketing Rule corpus flag` · `Form ADV pointers` · `Monthly review`

> Use "Service catalog" header (not "Features" — these are done-for-you workflows, not self-serve features). Avoid any snippet implying portfolio access or auto-send.

---

## Keywords (long-tail RIA / advisor pain — grouped)

### Group A — advisor admin time drain
- `ria back office help`
- `financial advisor admin support`
- `outsource advisor client communications`
- `advisor paperwork too much time`
- `who writes quarterly client letters`

### Group B — quarterly comms / recaps
- `quarterly client update template ria`
- `client review letter drafting service`
- `meeting recap notes for advisors`
- `crm note taking for financial advisors`

### Group C — Marketing Rule / compliance anxiety
- `sec marketing rule 206 4 1 advertising`
- `ria marketing rule compliance review`
- `advisor advertisement substantiation`
- `ai for advisors compliance risk`

> Match types: run Group C as phrase/exact (highest intent, lowest volume); A and B can start broad-match-modified-style phrase with tight negatives. Add the firm-type modifiers `ria`, `rias`, `independent advisor`, `wealth management practice` as campaign-level themes.

## Negative keywords (≥12)

`free` · `jobs` · `careers` · `salary` · `CFP exam` · `cfa exam` · `series 65` · `series 7` · `financial advisor near me` · `robo advisor` · `betterment` · `wealthfront` · `personal capital` · `how to become a financial advisor` · `financial advisor salary` · `best financial advisor` · `crypto` · `day trading` · `stock picks` · `investment advice` · `loan` · `mortgage`

> Rationale: strip consumers shopping for an advisor (`near me`, `best`), retail-investor queries (`stock picks`, `crypto`, `day trading`, `investment advice` — we never give advice), career/exam seekers, free-tool hunters, and robo-advisor brand confusion.

---

## Budget, bidding & quality score

**Budget rec:** start **$60–$90/day** concentrated on Group C (Marketing Rule) + Group B (recaps) — narrow, high-intent, lower-competition. This is a Max/quote buyer; one qualified scoping call pays for weeks of spend, so optimize for **lead quality over volume**.

**Bidding:** open on **Manual CPC** or **Maximize Conversions with a tCPA ceiling** once you have ~15 conversions. Conversion event = "Talk to a service partner" form submit (primary) + "Start free trial" (secondary). Lean the ad copy and the strongest sitelink toward **Talk to a service partner** — regulated buyers want a human before a card.

**Quality score:**
- Landing page must mirror the ad's claims exactly — quarterly-letter scene, draft-then-approve control, Marketing Rule corpus, every-number-a-merge-field. No returns language anywhere.
- Keep ad group themes tight (one per keyword group) so headline relevance stays high.
- Avoid superlatives and any number the fleet would "render" — Google's financial-products policies and our own honesty spine both punish unsubstantiated claims.
