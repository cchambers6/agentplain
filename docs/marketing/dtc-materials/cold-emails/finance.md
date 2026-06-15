# Cold Email Sequence — finance (financial advisors / RIAs)

**Vertical:** `ria` · **Tier:** Max (quote-based) · Partner floor ($299 → $199/seat)
**Cadence:** 5 touches over 14 days. Soft ask first (a 15-min scoping call), never a card.

> **Ground truth:** `CREATIVE_PACK_GROUND_TRUTH.md` §4 (finance) + voice scenarios 23 & 27. The fleet **drafts; the advisor approves and sends.** Live integrations = email + calendar + QuickBooks. No rendered dollar figures in our voice, no returns claims, no Orion/Redtail/custodian claims. Subjects: lowercase-leaning, ≤8 words, no exclamation, no emoji.

> **Personalization tokens:** `{{FirstName}}` · `{{FirmName}}` · `{{AdvisorCount}}` · `{{AUM}}`.
> **Token notes:** `{{AUM}}` is used *only* as a generic public-record sizing reference (e.g. "a practice your size"), **never** to imply we can see their book, their clients, or their holdings — we can't and we never claim to. If `{{AUM}}` is unknown, fall back to `{{AdvisorCount}}` or drop the clause. `{{AdvisorCount}}` drives the ROI math in T4. Keep every body calm; lead with the scene, not the ask.

---

## T1 — Day 1 — opener + value + soft ask

**Subject variants:**
1. `the quarterly letters`
2. `a week of your evenings`
3. `who drafts your client letters`

**Body:**
> Hi {{FirstName}},
>
> The quarterly client letters at {{FirmName}} — the week of evenings every quarter — are the exact thing we built agentplain to take off an advisor's plate.
>
> We're a done-for-you service that drafts the advisor admin: the fleet drafts each client update overnight and leaves every dollar figure as a blank for you to fill and sign. Built on Claude, run by us. Nothing sends on its own.
>
> Worth 15 minutes to see whether it fits a practice like yours? No deck — just the workflow.
>
> — {{SenderName}}, agentplain

---

## T2 — Day 4 — pain reframe + social proof

**Subject variants:**
1. `not the writing, the volume`
2. `why the letters pile up`
3. `the part you can't delegate`

**Body:**
> Hi {{FirstName}},
>
> The hard part of quarterly comms was never writing one good letter — it's writing forty of them in a week, each one personal, each one on the right side of the Marketing Rule.
>
> That's the part agentplain drafts. You keep the one part that can't be delegated: filling the numbers and signing. Advisors we work with describe the same before-and-after — the evenings come back, and every client still gets a letter that sounds like them.
>
> Open to a short scoping call? I can work around your week.
>
> — {{SenderName}}

---

## T3 — Day 7 — specific scenario (quarterly letters / meeting recap)

**Subject variants:**
1. `the recap you write three days late`
2. `two scenes you might recognize`
3. `letters overnight, recaps in hours`

**Body:**
> Hi {{FirstName}},
>
> Two scenes, in case either lands:
>
> The quarterly letters — drafted overnight, every figure left blank for you to fill, Form ADV and custodian pointers already on the draft. You read, fill, sign.
>
> The meeting recap — the one that usually lands three days later — drafted within hours of the meeting, ready for you to edit and send from your own inbox.
>
> In both, the fleet drafts and a person approves. Nothing files on its own. If that's a fit for {{FirmName}}, 15 minutes is all I'd need to scope it.
>
> — {{SenderName}}

---

## T4 — Day 11 — finance ROI math

**Subject variants:**
1. `the hours, in numbers`
2. `what the admin actually costs`
3. `the math for a practice your size`

**Body:**
> Hi {{FirstName}},
>
> Here's the math we use, not a promise — just the size of the problem.
>
> At a three-advisor practice, the client-comms and admin time we draft against is roughly a $270k/yr opportunity. Capturing about two-thirds of it pencils to ~$175,000/yr in reclaimed advisor time. A 25-advisor practice runs past $1.4M/yr on the same logic.
>
> Those are time figures, not returns — agentplain never renders a dollar figure about a client's account or makes an investment claim. It drafts the admin; you approve and sign.
>
> If the hours are worth scoping for {{FirmName}}, I'll bring this math to your numbers on a 15-minute call.
>
> — {{SenderName}}

> Annotation: ROI cited from §4 (finance) verbatim — $270k opportunity, 65% capture, ~$175k/yr at 3 advisors, $1.4M/yr at 25. The "time figures, not returns" line is load-bearing: it keeps us clear of any performance claim. `{{AdvisorCount}}` can swap "three-advisor"/"25-advisor" to match the prospect.

---

## T5 — Day 14 — low-pressure breakup

**Subject variants:**
1. `closing the loop`
2. `last note from me`
3. `i'll leave it here`

**Body:**
> Hi {{FirstName}},
>
> I'll leave it here so I'm not cluttering your inbox.
>
> The short version to keep: agentplain drafts the advisor admin — quarterly letters overnight, recaps in hours — and you approve and sign every one. A Marketing Rule corpus flags the draft first. Nothing sends on its own. Built on Claude, run by us.
>
> When the next quarter's letters come due and the evenings start adding up, reply to this and we'll pick it up. No pressure, no countdown.
>
> — {{SenderName}}
