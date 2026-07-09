# Monday send — 2026-07-13 — five personalized first touches

**What this is:** the actual outbound copy for the Monday 07-13 block. Not templates — each file is one prospect, researched and personalized, ready for Conner to edit lightly and send from his own inbox. The kit (`docs/outreach/2026-07-03-design-partner-kit/`) stays the system of record for variants, follow-ups, and rules; this folder is one week's ammunition.

**Research date:** 2026-07-08, public sources only. Every fact in a prospect card cites the URL it came from so Conner can check it himself. Re-check hooks the morning of the send (kit rule: a hook re-checked ≤3 days before send).

---

## The five, in send order

| # | File | Prospect | Brokerage | Monday action |
|---|---|---|---|---|
| 1 | `01-prospect-01-adams.md` | Bill Adams | Adams Realtors (Grant Park, Atlanta) | Email |
| 2 | `04-prospect-04-lautzenheiser.md` | Randal Lautzenheiser | Atlanta Intown Real Estate Services (Midtown + Kirkwood) | Email |
| 3 | `03-prospect-03-babcock.md` | Becky Babcock | Path & Post Real Estate (Woodstock) | Email (2-min event check first) |
| 4 | `05-prospect-05-watson.md` | Quiana Watson | Watson Realty Co (Buckhead) | GREC confirm, then email |
| 5 | `02-prospect-02-cannon.md` | Karen Cannon | Karen Cannon Realtors (Dunwoody) | LinkedIn connect Monday; email Thursday 07-16 |

Full reasoning for the order is in `06-send-order-and-batch-plan.md`.

**One roster change from the 07-03 shortlist:** Atlanta Real Estate Brokers (Pat Rary) is out. The GAMLS office page (`georgiamls.com/real-estate-offices/ABRK01`, checked 2026-07-08) lists a single agent — the broker himself — which fails the shortlist's own 5-agent floor. Per that sheet's substitution rule, the named alternate (Watson Realty Co) is promoted. Details in file 05 and in doc 06.

---

## What Conner personalizes vs sends verbatim

**Send verbatim (already personalized):** the subject line, the opening hook, the body. Each email was written for that prospect from verified public facts. Edit for voice if a line doesn't sound like you — the across-the-counter test is yours to apply — but nothing *requires* editing.

**Must fill / confirm before send (marked `<angle brackets>` in the files):**
- Nothing in the email bodies. There are zero unresolved tokens by design.
- Pre-send checks per prospect (GREC lookup for Watson, event check for Babcock) are listed at the top of each file.

**The warm-yes reply** (when anyone says yes): use the kit's document 03. The booking link there is the value of `NEXT_PUBLIC_BOOKING_URL` (wired by the send-path PR; see `lib/marketing/booking.ts`). If the env var isn't set yet, the CTA falls back to `https://agentplain.com/contact` — or delete the link line and book by reply, which the template supports. **Never a `{{CALENDLY_LINK}}` placeholder — that token must never reach a prospect.**

No booking link goes in a *first* touch (kit rule). The first-touch ask is soft: "worth a 20-minute call this week?"

---

## Truth Wave rules (load-bearing — read before the first send)

1. **No fabricated relationships.** Every one of these five is cold. No email implies we've met, know a mutual contact, or were referred — unless Conner's own warm-map pass (kit doc 00) genuinely surfaces a referrer before Monday, in which case switch that prospect to kit variant (a) and name the real person.
2. **No fabricated proof.** Zero named customers, said plainly in every email. Never "we've helped X agents," never a countdown ("2 spots left"), never "pilot pricing" (banned framing — the offer is the design-partner terms: three months free, weekly founder call, co-authored case study).
3. **Every prospect fact is checkable by the prospect.** Each card cites its public source. If a fact has drifted by Monday (someone sold the firm, changed brokerages), fix the row or pull the send — a stale fact costs more than a skipped week.
4. **Vendor invisible.** No email, follow-up, or reply names the AI vendor or model. If asked on a call, the objection library's #6 handling applies (`docs/sales/deep-dive-2026-07-02/04-discovery-call-playbook.md`).
5. **Autonomy line stays exact.** The service drafts; the owner approves and sends. No sentence may imply we send, file, pay, or book on our own.

## Pre-send checklist (every email, same as the kit)

- [ ] Prospect-specific pre-send items at the top of the file are done
- [ ] Truth scan: every specific detail still checks out
- [ ] Autonomy test: nothing implies auto-send
- [ ] Across-the-counter test: you'd say it in these words, face to face
- [ ] Log in the CRM the same sitting: stage = FIRST-TOUCH-SENT, date, variant

**Follow-ups:** 5/12/21-day chain from the kit's document 03, counted from each email's actual send date. Prospect-specific overrides are in each file.
