# Cold Email Sequence — CPA / Accounting Firms

**Vertical:** cpa · **Tier:** Partner ($199/seat) · **Trial:** 14-day, first month free, money-back.

Ground truth: `CREATIVE_PACK_GROUND_TRUTH.md` §4 (cpa) + scenario library. The fleet **drafts; the CPA approves and signs.** Live integrations = email + Google Calendar + QuickBooks. No "instant/real-time AI." Subject lines: lowercase-leaning, plain, ≤8 words, no exclamation, no emoji. Soft ask before any meeting ask.

## Personalization tokens

- `{{FirstName}}` — recipient first name.
- `{{FirmName}}` — their firm.
- `{{StaffCount}}` — headcount; drives the ROI math (per-seat figure).
- `{{Software}}` — **generic reference to whatever they use today (TaxDome, Karbon, Drake, etc.). NEVER phrase as a live integration claim** — we connect email + calendar + QuickBooks only. Use it as "your own system," not "we plug into {{Software}}." If unknown, omit the token and say "your system."

---

## T1 — Day 1 (opener · value · soft ask)

**Subject variants:**
1. `the busy-season chase`
2. `who chases {{FirmName}}'s missing docs`
3. `the email you write 23 times`

**Body:**
> Hi {{FirstName}},
>
> Busy season, the work that eats the evenings usually isn't the judgment calls — it's the chase. The missing-doc reminders, the month-end status notes, the same email written over and over.
>
> We run a done-for-you AI service for accounting firms. The fleet drafts that routine work into an approvals queue; a CPA reviews and signs. Nothing files on its own.
>
> Worth a closer look for {{FirmName}}? Happy to send a one-pager — no call needed.
>
> — Conner, agentplain

---

## T2 — Day 3 (pain reframe · social proof)

**Subject variants:**
1. `19 doc-chases in 35 minutes`
2. `the late night that didn't happen`
3. `re: the busy-season chase`

**Body:**
> Hi {{FirstName}},
>
> Quick picture of what this looks like. One March evening, a firm had 23 clients still missing documents to close. The fleet drafted all 23 reminders — each citing the exact items still outstanding — and skipped the 4 already on extension.
>
> A partner reviewed 19 in 35 minutes and approved them. Every send had a credentialed name on it.
>
> That's the model: the fleet drafts, you sign. Want the one-pager?
>
> — Conner

---

## T3 — Day 7 (specific tax-season scenario)

**Subject variants:**
1. `how month-end could close cleaner`
2. `your QuickBooks, drafted into a queue`
3. `the close, minus the chasing`

**Body:**
> Hi {{FirstName}},
>
> Concretely, here's what the fleet does for a firm:
>
> — Month-end close: drafts the status notes and the missing-doc chases per client.
> — Finance pulse: reads your QuickBooks (AR aging, open invoices) and drafts a weekly summary.
> — Onboarding letters: drafted from your template, ready for your sign-off.
>
> It connects to your email, calendar, and QuickBooks, and works alongside your own system. You approve everything; a compliance sentinel flags Circular 230 risk before you do.
>
> If that fits {{FirmName}}, I can show you 30 minutes of it on your own setup.
>
> — Conner

---

## T4 — Day 11 (CPA ROI math)

**Subject variants:**
1. `the per-seat math`
2. `~$42,000 a year, per seat`
3. `what the reclaimed hours are worth`

**Body:**
> Hi {{FirstName}},
>
> The number firms ask about: roughly $42,000 a year per staff seat in reclaimed tax-season hours — about $3,500 a month. Across {{StaffCount}} seats that compounds; at scale firms see closer to 18× on the seat cost, solo closer to 12×.
>
> The seat itself is $199/month on the Partner plan, first month free, 14-day trial, money-back behind it.
>
> The honest version of the pitch: the fleet drafts, a CPA signs, nothing files on its own. The avoided-penalty side is real too — a preparer position understating liability runs $1,000–$5,000 per return, and a credentialed person approves before anything goes out.
>
> Want to run the math on {{FirmName}}'s headcount together?
>
> — Conner

---

## T5 — Day 14 (low-pressure breakup)

**Subject variants:**
1. `last note from me`
2. `closing the loop`
3. `no more emails after this`

**Body:**
> Hi {{FirstName}},
>
> I'll stop here so I'm not cluttering your inbox in the middle of season.
>
> If the doc-chase and month-end drafting ever feels worth 30 minutes, the door's open — first month's free and you sign every send, so there's not much to lose by looking.
>
> Either way, good luck with the close.
>
> — Conner, agentplain

---

### Notes
- ROI figures cited to `cpa/content.ts` (`~$42,000/yr` per seat, ~12×–18×). Pricing per ground truth §3.
- Every touch keeps the human as the signer; none implies auto-send/auto-file.
- `{{Software}}` appears only as "your own system" framing — never a live-integration claim.
- Soft ask (one-pager / "worth a look") leads T1–T2; the meeting ask only appears from T3 on.
