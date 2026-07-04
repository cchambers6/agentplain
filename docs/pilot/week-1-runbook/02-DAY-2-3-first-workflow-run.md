# Days 2–3 — the first independent workflow runs

**The shape of these two days:** the partner runs alone; Conner watches the data, silently, and touches the partner only when a trigger fires. At n=1 there is no dashboard and no automation — **Conner (10 minutes, twice a day) plus the activation queries ARE the health monitoring** (CS plan `02-week-1-through-4-success-criteria.md`). The discipline is the hard part: the founder's instinct after a great activation call is to hover. Don't. Week 1's real question is whether the habit forms *without* us in the room, because week 5 won't have us in the room.

**What "success" looks like by end of Day 3:** at least one after-hours lead caught → drafted → approved (or honestly rejected — a rejection is engagement); the partner has opened the queue on ≥2 of the 2 mornings; approval notifications demonstrably reached their phone; zero connections showing "needs attention."

---

## The silent check (Conner or Fable, ~08:30 and ~17:30 ET, 10 min each)

Run the same four queries every check, against instrumentation — never against recollection:

1. **Did drafts land?** New approval-queue rows since last check, per skill. The lead-triage path specifically: did any FUB lead event arrive, and did each one produce a draft + two showing windows + a CRM update draft?
2. **Did the partner show up?** Queue opens and approve/edit/reject actions, with timestamps. Morning opens are the habit signal the whole pilot rides on.
3. **Is anything broken?** Connection health (FUB, email) — anything in "needs attention" or expired; any skill erring; any run that started and didn't finish; the saved-time ledger writing on completed actions (the guarantee's honesty depends on this writer firing — if lead-triage runs and the ledger stays flat, that's a P0 to Engineering *today*, not a Friday item).
4. **Is spend sane?** Their workspace's daily spend against the $5 daily cap — a glance, not an analysis. Anything over 50% of daily on a two-lead day gets investigated before it becomes a breach email (see `06-…cost-guardrails.md`).

Log one line per check in the partner folder. These lines are Friday's call brief, accruing in real time.

## Proactive-touch triggers ("if X, Conner sends Y within Z")

Cheapest touch that works, always naming a specific item — never "just checking in." Every message from Conner's own inbox, customer vocabulary, no vendor names. **Diagnose from the data before touching them:** when something looks stalled, the failure is usually ours (skill erred, connection expired, drafts were bad) — check the four queries before assuming partner inaction.

| Trigger | Conner sends | Window |
|---|---|---|
| **The first after-hours lead gets caught and drafted** (the moment the pilot exists for) | "A lead came in at [time] last night — the reply's drafted and waiting in your queue. Took [N] minutes of work off your plate. Curious what you think of the draft." | Within 4 hours of the draft landing (morning-after is fine for an overnight lead) |
| First draft approved independently (not on the call) | One line: "Saw you approved the [name] reply — that's the loop working. Anything about the draft you'd want different?" | Within 4 hours |
| First draft **edited** before approval | "Noticed you reworded the [name] reply — that's exactly how it learns your voice. Keep doing that." (Their corrections are the highest-value signal; reward the behavior explicitly.) | Same day |
| Draft landed >12h ago, notification confirmed delivered, queue never opened | Nudge naming the item: "The [lead name] reply is sitting drafted for you — 30 seconds to approve or toss. Want me to walk you through it on a 5-minute call instead?" | Within 4 hours of the 12h mark |
| A run erred, a draft came out visibly wrong, or degraded behavior touched their workspace | **We tell them before they notice** (honesty-first, CS rule): "Plaino had a rough morning — [what happened, plainly]. Here's what it means for you and when it's fixed. Nothing went out; nothing ever does without you." | Within 4 hours of *us* seeing it — never after they report it |
| FUB or email connection drops to "needs attention" | Diagnose first, then reach out **with the fix in hand**: "Your [system] connection needs a quick re-link — two clicks, here's exactly where. Everything caught up the moment it's back." | Diagnose within 4 hours; message same day |
| No FUB lead events at all by end of Day 3 (quiet market days happen) | Reframe honestly, no manufactured urgency: "Quiet couple of days on the lead front — that's real life, not a product problem. The inbox drafts are still flowing; the first evening lead will find you." Confirm event delivery is actually working (a missing webhook masquerades as a quiet market — check before sending this). | End of Day 3 |
| Partner emails or hits the support button, any topic | A real answer | Same business day, hard ceiling; during week 1 aim for hours |

**What does NOT trigger a touch:** a rejected draft (engagement, not failure — it goes on the Friday agenda as a learning item); slow-but-present usage; the partner approving without commentary. Two unprompted touches per day is the ceiling outside genuine breakage — founder attention is the pilot's currency, and week 1 sets the exchange rate.

## What Conner is watching FOR (the judgment layer over the queries)

- **Draft quality on their actual items.** Read every draft the system produces in these two days — all of them; at n=1 that's minutes. Is the voice plausible for this broker? Are the two showing windows sane against their calendar? Would *Conner* approve it? Every draft that would embarrass us goes on the Day-4 fix list even if the partner approved it.
- **The edit pattern.** What they change tells us what the product doesn't know about them yet: sign-offs, formality, neighborhood names, how they refer to their brokerage. This is Friday-call material and the roadmap's rawest input.
- **Time-of-day truth.** Does the after-hours premise hold for this partner's actual lead flow? If their leads cluster at 2pm, the pitch survives (speed-to-lead is the value either way) but the case-study framing shifts from "overnight" to "mid-showing" — capture reality now, per the Truth Wave, not the pitch's version of it.
- **The notification loop.** Did the after-hours notification actually produce a phone-glance approval, or did everything wait for morning coffee? Either is a fine habit; knowing which one this partner has shapes every message we send them for three months.

## End-of-Day-3 internal gate

Write three sentences in the partner folder (they seed Friday's brief):

1. Approvals to date: N approved / N edited / N rejected, and what the edits say.
2. The best moment so far, with a timestamp (this is case-study raw material — a real "9:14pm lead, 7:05am approve" beats any adjective).
3. The one thing most likely to stall week 2, and what we're doing about it before Friday.

If approvals are zero by end of Day 3 **and** a nudge has already fired: don't wait for the week-2 formal trigger — bring the save-motion posture (`05-when-things-go-wrong.md` §3) into Friday's call, prepared with the data.
