# Why-us one-pager — copy deck for the PDF

**What this is:** the one-page leave-behind linked from reply emails and call confirmations during the Monday send block. It is the "refresh, not rebuild" the dept-marketing plan ordered (`docs/departments/2026-07-03/marketing/03-outbound-support-collateral.md` §1) — same claims spine as `docs/marketing/design-partner-outreach/real-estate/design-partner-program-one-pager.md`, restructured to lead with the offer.

**Format rules for export:** one page, front only. Heritage Plains Editorial tokens through the doc pipeline — paper field, ink type, single clay accent rule. Plaino mark small, at heel height. No screenshots, no stock imagery. The `{{BOOKING_URL}}` token stays a token until `NEXT_PUBLIC_BOOKING_URL` is set (still the one hard blocker; ten-minute Conner action). **Never attached to a cold first touch** — replies and confirmations only, per the outreach kit.

---

## The page, top to bottom

### Headline *(4 words)*

# Your 9pm work, drafted.

### Sub-headline *(11 words)*

**A service partnership for Georgia broker-owners. You approve every send.**

### The problem

A broker-owner's week fills with coordination, not closings. The counter-offer that lands at 9:14pm. The buyer lead that goes cold overnight because nobody drafted the first touch. The commission invoice on its third unpaid week in QuickBooks. Eight to twelve hours a week of it — and none of it is the work you got your license for. There's a compliance edge too: one discriminatory phrase in a rushed reply is a $26,262 first-offense HUD penalty.

### Why this is a partnership, not another tool

You already have software; you don't have hands. agentplain is run-for-you: we install a fleet of AI partners inside your business, connect the tools you already use (email, calendar, QuickBooks, DocuSign, Drive), and run a monthly review with you. No setup project on your desk, no prompts to learn, no dashboard to babysit. Where a CRM like FUB or Sierra already wins — pipeline, dialers, lead routing — keep it; the fleet works alongside what you have.

### What "run for you" means

Three jobs, live today:

1. **Drafts** — every inbound lead gets a scored, in-your-voice first-touch reply waiting in your approvals queue.
2. **Chases** — overdue commission invoices get an escalating chase drafted off your QuickBooks, ready to send.
3. **Recaps** — overnight activity lands as a morning summary, and your monthly report drafts itself for review.

Every draft waits as PENDING until you approve it, from your own inbox. The fleet never sends, files, or commits anything on its own. A compliance review runs on every draft before you see it — it flags, it never blocks. That human gate is the whole design.

### The founding design-partner deal

We have no named customers yet — that's why this offer exists, and why it's rich:

- **Three months free.** After the pilot, standard published pricing; no obligation to convert.
- **Weekly time with the founder.** A 30-minute call with Conner every week of the pilot. Your stack, what's working, what isn't.
- **On-record participation.** You use it for real and tell us the truth about it, on the record.
- **Case-study rights, on your terms.** A joint case study, co-authored — you approve every word before anything is public.

### Contact

**Conner Chambers** · Founder, agentplain
**hello@agentplain.com** · LinkedIn: `{{LINKEDIN_URL}}`
Book 25 minutes: `{{BOOKING_URL}}`

---

## Pre-export checklist

- [ ] `{{BOOKING_URL}}` and `{{LINKEDIN_URL}}` resolved to live links (search the page for `{{` before export)
- [ ] Pricing line, if added, printed from `lib/pricing/tiers.ts` — standard published tiers only, no special-pricing framings (do/don't rule 10)
- [ ] Gates pass: `node tools/brand/brand-gate.mjs` and `node tools/brand/voice-gate.mjs`
- [ ] Fits one page at print size with the Heritage tokens applied
