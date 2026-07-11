# Waves 2 + 3 — 25 named Georgia RE prospects — researched 2026-07-11

**What this is:** the next five weeks of first-touch ammunition. Twenty-five researched
prospects (files 01–25), a master index (file 26), and the Monday-block scripts for the
next two send days (file 27). Same format as the merged wave-1 folder
(`docs/outreach/2026-07-08-monday-send/`) — each file is one prospect, personalized from
public facts, ready for Conner to edit lightly and send from his own inbox.

**Research date:** 2026-07-11, public sources only. Every fact in a prospect card cites
the URL it came from so Conner (or the prospect) can check it. Kit rule still applies:
re-check the hook ≤3 days before the send.

---

## The wave structure

| Wave | Send Monday | Prospects | Status |
|---|---|---|---|
| 1 | 2026-07-13 | 5 (Adams, Lautzenheiser, Babcock, Watson, Cannon) | Merged in PR #373 — in flight |
| 2 | starts 2026-07-20 | 12 (files marked Wave 2, send order 1–12) | This folder |
| 3 | starts 2026-07-27 | 13 (files marked Wave 3, send order 1–13) | This folder |

**The 5-send cap, named honestly.** The kit's cadence doc
(`docs/outreach/2026-07-03-design-partner-kit/06-outreach-cadence.md`) is explicit:
*five sends means five*, and volume grows only after the weekly rhythm has held for a
month. A 12-prospect wave does not repeal that rule. Each wave is a **prioritized batch**,
not a single-day send list: on wave 2's Monday, send the top of the send order until the
week's budget (5, plus due follow-ups) is spent; the remainder rolls to the next Monday
in order. If replies from wave 1 eat the block — good; a live reply outranks every
planned send. At the ratified 5/week pace this folder is ~5 weeks of ammunition, which
is the point: the Monday block should never again start with "who do I even write to?"

**Also honest:** the design-partner offer is 3–5 founding slots. If slots fill mid-wave,
the remaining files retire to the standard pipeline motion — don't keep sending
founding-partner terms past a full cohort (kit rule, cadence doc §"rules").

---

## What's in each prospect file

Same skeleton as wave 1: pre-send checks → prospect card (facts + source URLs) →
why-this-prospect → custom hook → first-touch email (90–150 words, kit variant noted) →
LinkedIn precede (or "skip", with the reason) → expected objections + first responses →
follow-up cadence override → wave + send-order assignment.

## Rules carried forward (load-bearing — same as wave 1's README)

1. **No fabricated relationships.** Every prospect here is cold. Conner's warm-map pass
   (kit doc 00) runs before each wave's Monday; any genuine referrer upgrades that row to
   kit variant (a) and jumps the queue.
2. **No fabricated proof.** Zero named customers, said plainly in every email. Never
   "we've helped X agents," never a countdown, never "pilot pricing." The offer is the
   design-partner terms: three months free, weekly founder call, co-authored case study.
3. **Every prospect fact is checkable by the prospect.** Each card cites its public
   source. A fact that has drifted by send day gets fixed or the send gets pulled.
4. **Vendor invisible.** No email, follow-up, or reply names the AI vendor or model.
5. **Autonomy line stays exact.** The service drafts; the owner approves and sends.
   No sentence may imply we send, file, pay, or book on our own.
6. **No booking link in a first touch.** Soft ask only ("worth a 20-minute call this
   week?"). The booking link appears in the warm-yes reply (kit doc 03) and is the value
   of `NEXT_PUBLIC_BOOKING_URL` (`lib/marketing/booking.ts`), falling back to
   `https://agentplain.com/contact`. **Never a `{{CALENDLY}}`-style placeholder.**
7. **LinkedIn URLs are never guessed.** Where a personal profile didn't verifiably
   surface in research, the file says so and the touch is email-only.

## Metro + size mix across the 25

Deliberate spread per the wave-2/3 brief: Atlanta metro carries the bulk (it's the
beachhead and where wave 1 lives), with Savannah, Augusta, Athens, and Macon opening
second-city coverage. Sizes skew 5–20 agents (the ICP core) with a few 3–5 boutiques
and a few 25–50 independents. Exact matrix in `26-master-index.md`.

## Pre-send checklist (every email, unchanged from wave 1)

- [ ] Prospect-specific pre-send items at the top of the file are done
- [ ] Truth scan: every specific detail still checks out
- [ ] Autonomy test: nothing implies auto-send
- [ ] Across-the-counter test: you'd say it in these words, face to face
- [ ] Log in the CRM the same sitting: stage = FIRST-TOUCH-SENT, date, variant

**Follow-ups:** 5/12/21-day chain from kit doc 03, counted from each email's actual send
date. Prospect-specific overrides are in each file.
