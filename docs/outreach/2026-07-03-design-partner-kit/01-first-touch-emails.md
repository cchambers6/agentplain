# 01 — First-touch emails (five variants, founder-sent)

**Sender:** Conner, from his own inbox. Plain text — no images, no signature banner, no tracking pixels.
**Length:** each draft runs 90–150 words. Resist adding; a broker-owner reads these on a phone between showings.
**Tokens:** everything in `{{double-braces}}` is find-replace before sending. **Search the draft for `{{` before hitting send — an unresolved token is a lost prospect.**
**No booking link in a first touch.** The ask is soft ("worth a 20-minute call this week?"). The booking link appears only in the warm-yes reply (document 03), once they've said yes.

Every claim below traces to `docs/marketing/design-partner-outreach/_shared/CLAIMS_GROUND_TRUTH.md`. Live integration story: email, calendar, QuickBooks, DocuSign, Drive. Zero named customers — said plainly, never papered over.

---

## Variant (a) — warm referral intro

**Use when:** the referral-path column has a real name and that person has agreed to be named.

**Subject:** `{{referrer-name}} said we should talk`

```
Hi {{first-name}},

{{referrer-name}} mentioned you run {{brokerage}} and still carry the
coordination load yourself — chasing transaction docs, answering leads
at 9pm, invoicing commissions through QuickBooks.

I'm building agentplain. It's a service that reads the tools you
already use (email, calendar, QuickBooks, DocuSign) and drafts that
work for you. Every draft waits in a queue until you approve it.
Nothing sends without your name on it. I run my own company's
operations on the same system every day.

Honest position: we have no named customers yet. That's why I'm
offering 3–5 Georgia broker-owners a founding design-partner deal —
three months free, a weekly call with me, and a real say in what
gets built.

{{custom-hook}}

Worth a 20-minute call this week?

Conner Chambers
Founder, agentplain
```

---

## Variant (b) — cold, LinkedIn-first

**Use when:** the LinkedIn touch (document 02) went out 3–7 days earlier, whether or not they accepted.

**Subject:** `the note I sent you on linkedin`

```
Hi {{first-name}},

I sent you a short note on LinkedIn last week — this is the longer
version, since email is where you probably live anyway.

I'm building agentplain, a service for broker-owners who still do
their own chasing: transaction docs, 9pm lead replies, commission
invoices. It reads your email, calendar, and QuickBooks, then drafts
that work for you. Every draft waits for your approval. Nothing
sends itself.

{{custom-hook}}

We're early, and I'll say so plainly: no named customers yet. I'm
signing 3–5 Georgia broker-owners as founding design partners — three
months free, weekly access to me, and first say in the roadmap.

Worth a 20-minute call this week?

Conner Chambers
Founder, agentplain
```

---

## Variant (c) — cold, direct email

**Use when:** no warm path, no LinkedIn activity — a roster name with a good why-them line.

**Subject:** `a question about {{brokerage}}`

```
Hi {{first-name}},

A question a broker-owner can answer in one line: when a buyer lead
comes in at 9pm, what happens before 9am?

At most independent brokerages around {{city}}, the answer is "I do."
Same for chasing transaction docs and commission invoices. I'm
building agentplain for exactly that work. It's a service that reads
the tools you already run on (email, calendar, QuickBooks, DocuSign)
and drafts the replies, reminders, and invoices for you. Everything
lands in an approval queue. You stay the only one who hits send.

We have no named customers yet — you'd be among the first, on
purpose, with terms priced for it: three months free, a weekly call
with me, and a case study you approve word by word.

Worth a 20-minute call this week?

Conner Chambers
Founder, agentplain
```

---

## Variant (d) — reply to their newsletter

**Use when:** the prospect publishes a newsletter or market update. Reply in the actual thread — the subject line is theirs, which is the point.

**Subject:** `re: {{their-newsletter-subject-line}}` *(genuine reply, not a spoofed one)*

```
Hi {{first-name}},

Your piece on {{newsletter-topic}} landed with me — {{one-specific-
point-you-actually-read}} matches what I hear from broker-owners
across Georgia.

I'm building agentplain, a service that takes the coordination work
off an owner's plate. It reads your email, calendar, and QuickBooks,
and drafts the chasing, the replies, and the invoices. Every draft
waits for your approval; nothing sends without your name on it.

I'm signing a small founding cohort of Georgia broker-owners — three
months free, a weekly call with me, and a real vote on what gets
built. No named customers yet, so you'd be shaping this from the
first row.

Worth a 20-minute call this week?

Conner Chambers
Founder, agentplain
```

---

## Variant (e) — speaks-at-event angle

**Use when:** they're speaking (or recently spoke) at an association event, panel, or user group.

**Subject:** `your {{event-name}} talk`

```
Hi {{first-name}},

I saw you're speaking at {{event-name}} on {{talk-topic}}.
Broker-owners who teach other broker-owners usually run the tightest
shops — and still end up doing the chasing themselves.

That's the work I'm building agentplain for. It reads the tools you
already use (email, calendar, QuickBooks, DocuSign) and drafts the
follow-ups, doc chases, and commission invoices. Every draft waits
in your queue until you approve it. Nothing goes out without your
name on it.

I'm looking for 3–5 Georgia broker-owners as founding design
partners: three months free, weekly access to me, and a case study
you approve word by word. You'd be first, and I say that plainly.

Either at {{event-name}} or before — worth a 20-minute call this week?

Conner Chambers
Founder, agentplain
```

---

## Pre-send checks (every email, every time)

1. **Token scan** — search for `{{`. Zero hits or no send.
2. **Truth scan** — every specific detail about them is checkable; every claim about us traces to the claims spine. If a line feels good but you can't source it, cut it.
3. **Autonomy test** — no sentence implies the fleet sends, files, pays, or books anything on its own.
4. **Across-the-counter test** — would you say it, in these words, to this broker standing across the counter? If not, rewrite until you would.
5. **Log the send** in the CRM the same sitting: stage = FIRST-TOUCH-SENT, date, variant used.
