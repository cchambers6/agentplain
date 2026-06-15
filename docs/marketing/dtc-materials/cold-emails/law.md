# Cold Email Sequence — Law (law firms)

**Vertical:** `law` · **Tier:** Max (quote-based); Partner floor · **Trial:** 14-day
**Cadence:** 5 touches over 14 days · **Ask bias:** a 15-minute scoping call first
(fits law better than "free trial"). Formal-but-human.

> Honesty spine: the fleet drafts; an attorney approves every client-facing draft. Nothing
> is sent or filed by the fleet; legal conclusions are `{{attorney: …}}` merge fields.
> Live integrations = email (Gmail/Outlook) + Google Calendar only — never claim Clio,
> MyCase, PracticePanther, or NetDocuments as live.

**Personalization tokens**
- `{{FirstName}}` — recipient first name.
- `{{FirmName}}` — firm name. Use sparingly; once per email reads natural, twice reads like a mail-merge.
- `{{PracticeArea}}` — e.g. "estate planning," "PI," "family law." Only insert where it
  changes the sentence's meaning; if unknown, fall back to "your practice."
- `{{AttorneyCount}}` — number of attorneys. Drives the ROI framing in T4; if unknown,
  use the 3-attorney example as the default and say "a firm your size."

> Subject-line rule: lowercase-leaning, ≤8 words, no exclamation point, no emoji.

---

## Touch 1 — Day 1 · opener + value + soft ask

**Subjects**
- A) the conflict screen, in seconds
- B) where {{FirmName}}'s non-billable hours go
- C) drafting intake without the malpractice risk

**Body**
> {{FirstName}},
>
> At most firms, a new matter can't start billing until someone runs the conflict check —
> and done carefully, the adverse-party screen can take an afternoon.
>
> agentplain is a done-for-you service that drafts that work for you. The fleet runs the
> conflict screen in seconds and drafts the intake acknowledgement and conflict notice
> into a queue. An attorney approves every client-facing draft before anything goes out —
> legal conclusions stay yours to make, never asserted by the fleet. It's built on Claude,
> configured and run by us.
>
> Would a 15-minute call to see it against {{FirmName}}'s intake be worth your time? No
> deck — just the conflict-screen scene scoped to your practice.
>
> Conner Chambers
> Founder, agentplain

---

## Touch 2 — Day 4 · pain reframe + social proof

**Subjects**
- A) the hours that aren't the law
- B) re: the conflict screen
- C) what a firm your size gets back

**Body**
> {{FirstName}},
>
> Following the note from earlier this week. The reframe most managing partners land on:
> the lost hours at a firm usually aren't the legal work — they're the work around it.
> Intake. Conflict screening. Status updates clients keep asking for. Document chases
> that hold a closing.
>
> That's exactly the band agentplain drafts. The fleet writes those into an approvals
> queue; an attorney reviews and approves each one. We install it, connect your email and
> calendar, and run a monthly review — it's a service, not a tool you have to drive.
>
> Firms come to us less for the speed and more for the gate: nothing leaves until a person
> signs off. Worth 15 minutes?
>
> Conner

---

## Touch 3 — Day 8 · specific scenario (conflict screen / doc review)

**Subjects**
- A) 312 borderline calls, 14 real ones
- B) a doc-review afternoon, two ways
- C) what the conflict screen actually does

**Body**
> {{FirstName}},
>
> A concrete one, since the abstract pitch only goes so far.
>
> A doc review with 312 borderline calls. The honest number of those that need a lawyer's
> judgment is maybe 14. The other ~298 are routine — and they're where the 60 billable
> hours go that feel like they should have been a quarter of that. The fleet drafts the
> routine calls into your queue and leaves you the 14 that actually need you. An attorney
> approves all of it; nothing is asserted as a conclusion by the fleet.
>
> The new-matter conflict screen works the same way — a deterministic adverse-party check
> that runs in seconds instead of an afternoon, with the notice drafted for your approval.
>
> If either is a real bottleneck at {{FirmName}}, 15 minutes and I'll show you the exact
> flow.
>
> Conner

---

## Touch 4 — Day 11 · the ROI math

**Subjects**
- A) the math on a {{AttorneyCount}}-attorney firm
- B) ~$150k a year, where it comes from
- C) the reclaimed-time number for {{FirmName}}

**Body**
> {{FirstName}},
>
> The number, plainly, since I'd want it too.
>
> At a three-attorney firm, the reclaimed time from drafting intake, conflict notices,
> status updates, and document chases runs to roughly $150,000 a year — that's about a
> 40% capture of a $375,000 opportunity, not the whole thing. A 25-attorney firm scales
> past $2.3 million. For a firm your size, we'd scope it honestly on the call rather than
> hand you a round number.
>
> And the part that isn't on the spreadsheet: because an attorney approves every
> client-facing draft, a privilege breach or a misleading line never leaves the firm by
> machine. Under Model Rule 1.6 — where exposure runs to malpractice and discipline —
> that gate is the point.
>
> 15 minutes to scope it for {{FirmName}}?
>
> Conner

---

## Touch 5 — Day 14 · low-pressure breakup

**Subjects**
- A) closing the loop
- B) last note from me
- C) I'll leave it here

**Body**
> {{FirstName}},
>
> I'll stop here so I'm not cluttering your inbox.
>
> The short version: agentplain drafts the work around the law — intake, conflict screens,
> status updates — and an attorney approves every client-facing draft before it goes out.
> Built on Claude, run by us, scoped to your firm.
>
> If the timing's wrong, no problem at all. If it's worth a look down the road, this thread
> is the easiest way to reach me. Either way, I appreciate your time.
>
> Conner Chambers
> Founder, agentplain

> Token notes: T4 leans hardest on `{{AttorneyCount}}` — if unknown, use subject B and the
> 3-attorney default in body. `{{PracticeArea}}` is optional throughout; only insert where
> it sharpens the sentence (e.g. "intake at an estate-planning practice"), never as filler.
