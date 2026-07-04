# Support at 1–5 customers total — the whole machine is one inbox, one queue, and Conner

**Reality check (kaizen 06, gap 1):** hello@ is a one-way street — nothing ingests inbound email into the ticket store. The in-app ticket path is real (Plaino L1 triage → drafted reply into the approvals queue → human approves — `lib/support/tickets/`, `lib/support/resolve-reply.ts`), but email replies land in a personal inbox where `isSlaBreached` can't see them. At 1–5 customers we do NOT fix this with software or vendors ( `05-what-CS-must-stop.md`); we fix it with folder discipline and a twice-daily ritual. **Buy nothing, build nothing, log everything.**

**Who answers what:** every inbound is either **Conner directly** or **a Fable-drafted reply that Conner approves and sends from his own inbox**. Plaino signs in-app replies as Plaino (never claiming to be human); email replies during the pilot go out as Conner — design partners were promised founder attention, and at n≤5 founder-voiced support *is* the premium product.

---

## 1. The two channels, and the promises on each

| Channel | Who it's for | Stated promise | Why the difference |
|---|---|---|---|
| **In-app support** (workspace → support) | All customers | The SLA the code enforces: P0 1h / P1 4h / P2 24h / P3 48h (`lib/support/tickets/sla.ts`) | The ticket system can *see* these, so breach detection works |
| **hello@agentplain.com** | All customers + prospects + everything else | "Same business day" — stated verbally/in email, **never published as a numbered SLA** | No ingestion = no measurement; don't publish a promise nothing enforces (kaizen 06, fix 1) |

Design partners get founder-grade response on both — in practice, faster than either promise. That's a behavior, not a published tier.

## 2. hello@ folder scheme

Flat, boring, and every mail gets filed at triage — the inbox itself stays empty:

```
INBOX                    ← always zero after each triage pass
├── 1-partners/          ← one subfolder per design partner (1-partners/smith-realty)
│                          everything: replies, questions, praise, complaints
├── 2-prospects/         ← replies to outreach sends → also logged to /operator/outreach same pass
├── 3-support-general/   ← support mail from anyone not a partner
├── 4-billing-legal/     ← Stripe, refunds, guarantee, anything with legal words in it
├── 5-waitlist/          ← non-RE and unsupported-vertical inbound (see §5)
└── 9-noise/             ← vendor mail, newsletters, spam that got through
```

Rule that keeps SLA-truth alive (kaizen 06, fix 1): **any email that is really a support issue gets a ticket created by hand in the in-app store during triage**, with the email body pasted in, so the SLA clock and the paper trail exist even though the customer wrote to hello@. The reply still goes by email; the ticket records it.

## 3. The triage ritual — twice per business day, 10 minutes each

**~9:00 and ~16:00 ET, on Conner's calendar as recurring blocks.**

1. Open INBOX. For each mail: file it (scheme above), and classify: *answer-now / Fable-drafts / waitlist-template / noise*.
2. Anything from a design partner: answer-now or same-day, always.
3. Support-shaped mail: create the hand ticket; if a draft would help, Fable drafts it into the approvals queue; Conner approves, sends, closes.
4. Prospect replies: log to /operator/outreach, then handle per the sales playbook (not CS's call to answer).
5. Weekend/holiday: no ritual, no promise broken — "same business day" was the promise. A P0 from a design partner is the exception; they have been told they can flag "urgent" in a subject line during the pilot.

The afternoon pass also sweeps the in-app queue: any Plaino-drafted support replies waiting for approval get approved/edited then, so nothing drafted sits overnight.

## 4. Escalation — what interrupts Conner NOW vs. waits for the next triage pass

**Interrupt now (page-worthy):**
- P0/P1 in-app ticket (the classifier already routes these via `pageHuman`)
- Any design-partner message that reads frustrated, confused, or blocked — at n≤3 every partner message is cheap to answer and ruinous to ignore
- Anything touching money: refund request, guarantee invocation, billing dispute. **Auto-refund stays in human-review mode** until audit 9's saved-time writers land — a wrongful automatic refund on customer #1 is an unforced error (kaizen 06, fix 4)
- Anything with legal/security words: subpoena, breach, "my client's data," attorney letterhead
- A partner's integration dark >72h (we call them with the fix, not vice versa)

**Waits for the next pass:** everything else — P2/P3, prospect replies, general questions, waitlist mail.

**Fable's drafting lane:** any reply that is factual (how a feature works, what a status means, billing mechanics) gets drafted by Fable with citations to the actual code/docs, in Plaino voice for in-app and Conner's voice for email. Conner edits and sends. Two rules on every draft: **customer vocabulary only** ("Working / Setting up / Watching / connected / needs attention" — never runtime words), and **model/vendor invisible** (the /security subprocessor list is the only sanctioned reference if someone asks what's underneath).

## 5. Non-RE and unsupported-vertical inbound (kill-list compliant)

No support surface for non-RE — ratified. But mail arrives anyway, and unanswered mail is brand damage. The entire non-RE motion is **one template, one folder, zero follow-up work**:

> Thanks for writing — right now we're heads-down with a small group of Georgia real-estate partners, and {{their vertical}} isn't live yet. I've added you to the list for when it opens, and you'll hear from me personally when it does. — Conner

File to `5-waitlist/`, capture in LeadCapture, done. No trial link, no card, no demo, no exceptions — a customer we can't support is a refund and a bad review on layaway (playbook §1.2). flatsbo inbound: forward to the flatsbo pile, not a CS motion here.

## 6. What every support interaction feeds

- **The Friday synthesis** (kaizen 06, fix 3): the week's tickets + partner mail distilled to one "what we heard / what it means / what we're doing" paragraph in the memory inbox.
- **The feedback trail:** any verbatim that implies a product change gets one line in the partner's folder AND the Friday synthesis. The ≥3-customers roadmap rule can't run at n=2 — at this scale a *design partner's* single verbatim is allowed to move the roadmap; that's what the program is for.
- **The case study:** support moments where we fixed something fast are case-study material ("they had a human on it same day") — tag them when they happen.

## 7. Graduation triggers — when this playbook is obsolete

Revisit (don't pre-build) when ANY of: >5 customers · >10 support emails/day · first Max customer with a same-day promise · Conner misses the ritual 3 days running. At that point the kaizen 06 investment list (inbound ingestion via Plain/Intercom as mailroom-not-brain, SLA breach sweep, health score) is already ranked and waiting. Until then, this document is the entire support organization, and that is the correct size.
