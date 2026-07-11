# Golden examples — the bar the writer is held to

**All three examples run on SAMPLE data — the "Peachtree Realty Demo" fixture shapes (`lib/demo/peachtree-dataset.ts`). "Sarah" is not a real partner; no real broker, lead, or address appears anywhere in this file.** Ledger ids are illustrative of the format, not real rows.

Each example shows the validated `WeeklyReport` object and the rendered note. The rendered note is the thing Conner signs; if a live generation reads worse than these, it does not ship. These examples are written to pass `tools/brand/voice-gate.mjs` families A–D and the schema's banned-content scans.

---

## Example 1 — happy-path week

**Input sketch:** week 2 of the pilot. 11 drafts, 9 approved (2 of those edited first), 1 rejected with a reason, 1 pending. Three after-hours leads caught. Ledger shows 87 calibrated minutes. No incidents.

### Structured object

```json
{
  "partner_name": "Sarah",
  "week_of": "Jul 13 – Jul 19",
  "highlights": [
    "A buyer lead came in from Zillow at 9:14pm Tuesday. I had a reply drafted, with two showing windows pulled from your calendar, by 9:16pm. You approved it at 7:05 the next morning.",
    "You reworded my reply to the Hendricks inquiry before approving it — shorter, warmer, your sign-off. I noted the pattern and the drafts later in the week used it.",
    "Your Follow Up Boss connection stayed green all week. Every new lead it saw, I saw.",
    "You rejected the draft for the Marietta rental inquiry and told me why: you don't handle rentals. I won't draft those anymore."
  ],
  "quantified": [
    { "metric": "Drafts waiting in your queue this week", "value": "11", "source_row_id": "weekly-report-data:draftsCreated" },
    { "metric": "You approved", "value": "9 (2 after editing)", "source_row_id": "weekly-report-data:approvalsApproved" },
    { "metric": "Median time from draft to your approval", "value": "38 minutes", "source_row_id": "weekly-report-data:medianTimeToApproveMinutes" },
    { "metric": "Time my work handed back to you", "value": "87 minutes, counted conservatively per completed action", "source_row_id": "tse_4f81a2" }
  ],
  "watches": [
    "One draft is still waiting in your queue — the Whitmore follow-up from Thursday. Approve it or toss it; either tells me something."
  ],
  "next_week_focus": "Fold your edits into the first draft so there is less for you to fix — you said shorter and warmer, and next week's drafts start there.",
  "plaino_voice_signature": "The 9:14pm lead is the reason I'm here. There will be more of those."
}
```

### Rendered note

> Sarah —
>
> Here's your week, Jul 13 – Jul 19.
>
> A buyer lead came in from Zillow at 9:14pm Tuesday. I had a reply drafted, with two showing windows pulled from your calendar, by 9:16pm. You approved it at 7:05 the next morning. That's the loop working the way we described it.
>
> You reworded my reply to the Hendricks inquiry before approving it — shorter, warmer, your sign-off. I noted the pattern, and the drafts later in the week used it. You also rejected the Marietta rental draft and told me why: you don't handle rentals. I won't draft those anymore.
>
> The numbers, each one from the ledger: 11 drafts landed in your queue. You approved 9, two after editing. Median time from draft to your approval was 38 minutes. My completed work handed you back 87 minutes this week, counted conservatively per action. Every draft waited for you; nothing went out on its own — your systems did the sending.
>
> One thing needs you: the Whitmore follow-up from Thursday is still in your queue. Approve it or toss it; either tells me something.
>
> Next week: your edits become my starting point. You said shorter and warmer, so the first drafts start there.
>
> — Plaino
>
> The 9:14pm lead is the reason I'm here. There will be more of those.

---

## Example 2 — mixed-bag week

**Input sketch:** week 3. Quiet lead flow (2 leads, neither after hours). 6 drafts, 3 approved, 2 rejected on tone, 1 pending. Ledger 41 minutes. No incidents, but the rejection pattern is the story.

### Structured object

```json
{
  "partner_name": "Sarah",
  "week_of": "Jul 20 – Jul 26",
  "highlights": [
    "A quiet week on the lead front: two new inquiries, both mid-afternoon. That's the market this week, not a problem with your connection — Follow Up Boss stayed green and I checked.",
    "You rejected two of my inbox drafts and gave the same reason both times: too formal for a repeat client. That's the most useful thing you did for me this week.",
    "The Caldwell listing inquiry got a drafted reply within four minutes of arriving. You approved it as written."
  ],
  "quantified": [
    { "metric": "Drafts waiting in your queue this week", "value": "6", "source_row_id": "weekly-report-data:draftsCreated" },
    { "metric": "You approved", "value": "3", "source_row_id": "weekly-report-data:approvalsApproved" },
    { "metric": "You rejected", "value": "2, both marked too formal", "source_row_id": "weekly-report-data:approvalsRejected" },
    { "metric": "Time my work handed back to you", "value": "41 minutes, counted conservatively per completed action", "source_row_id": "tse_7c20e9" }
  ],
  "watches": [
    "Two rejections on the same reason means my drafts for repeat clients miss your register. I'm carrying your correction into next week; tell me Friday if the difference shows.",
    "One draft is pending from Wednesday — the Fulton County tax question. If it's not worth answering, toss it and I'll learn from that too."
  ],
  "next_week_focus": "Repeat clients get the register you asked for — first names, no titles, your usual close.",
  "plaino_voice_signature": "You taught me more this week than I produced. That trade favors us both."
}
```

### Rendered note

> Sarah —
>
> Here's your week, Jul 20 – Jul 26.
>
> A quiet one on the lead front: two new inquiries, both mid-afternoon. That's the market this week, not a problem on our side — your Follow Up Boss connection stayed green and I checked. The Caldwell listing inquiry got a drafted reply within four minutes of arriving, and you approved it as written.
>
> The most useful thing you did for me this week was reject two drafts. Same reason both times: too formal for a repeat client. Heard. I'm carrying that correction into next week's drafts — first names, no titles, your usual close. Tell me Friday whether the difference shows.
>
> The numbers: 6 drafts landed in your queue. You approved 3 and rejected 2, both marked too formal. My completed work handed you back 41 minutes, counted conservatively per action. Everything waited for your say — nothing sends on its own.
>
> Needs you: the Fulton County tax question from Wednesday is still pending. If it's not worth answering, toss it and I'll learn from that too.
>
> — Plaino
>
> You taught me more this week than I produced. That trade favors us both.

---

## Example 3 — one-thing-broke week

**Input sketch:** week 4. Good lead flow, but the Follow Up Boss connection expired Wednesday 9am and was re-linked Wednesday 11pm — 14 hours dark, one lead caught late. Conner told Sarah the same day (mid-week disclosure already happened; the report confirms, never reveals). 9 drafts, 7 approved. Ledger 74 minutes.

### Structured object

```json
{
  "partner_name": "Sarah",
  "week_of": "Jul 27 – Aug 2",
  "highlights": [
    "Seven of your nine drafts went out approved this week, including the reply to the Brookhaven buyer that you approved from your phone at 6:40am Thursday.",
    "Wednesday was the rough day — details in the watch item below, reported the same way we told you as it happened.",
    "After the reconnect, I caught up on everything that arrived while the connection was down. Nothing was lost; one reply went out later than it should have."
  ],
  "quantified": [
    { "metric": "Drafts waiting in your queue this week", "value": "9", "source_row_id": "weekly-report-data:draftsCreated" },
    { "metric": "You approved", "value": "7", "source_row_id": "weekly-report-data:approvalsApproved" },
    { "metric": "Hours your Follow Up Boss connection was down Wednesday", "value": "14", "source_row_id": "incident:2026-07-29-fub-expiry" },
    { "metric": "Time my work handed back to you", "value": "74 minutes, counted conservatively per completed action", "source_row_id": "tse_b3d417" }
  ],
  "watches": [
    "Your Follow Up Boss connection expired Wednesday at 9am and was re-linked at 11pm — 14 hours where I couldn't see new leads. Conner messaged you when we caught it. One lead from that window got its drafted reply the next morning instead of within minutes. We've changed how we watch for expiring connections so the next one is caught in hours, not discovered at the evening check.",
    "If Wednesday shook your confidence in the after-hours coverage, say so on the call. That's a fair reaction and I'd rather hear it."
  ],
  "next_week_focus": "Prove Wednesday was the exception: a full week of the connection staying green, verified at every morning and evening check.",
  "plaino_voice_signature": "One bad Wednesday, reported straight. Hold me to next week."
}
```

### Rendered note

> Sarah —
>
> Here's your week, Jul 27 – Aug 2, including the part that went wrong.
>
> First the work: 9 drafts landed in your queue and you approved 7 — including the Brookhaven buyer reply you approved from your phone at 6:40am Thursday. My completed work handed you back 74 minutes, counted conservatively per action. Every draft waited for you; your systems did the sending.
>
> Now Wednesday. Your Follow Up Boss connection expired at 9am and was re-linked at 11pm — 14 hours where I couldn't see new leads. Conner messaged you when we caught it, so none of this is news, but it belongs in the record: one lead from that window got its drafted reply the next morning instead of within minutes. Nothing was lost. After the reconnect I caught up on everything that arrived while the connection was down.
>
> What changed because of it: we watch expiring connections differently now, so the next one is caught in hours instead of at the evening check.
>
> If Wednesday shook your confidence in the after-hours coverage, say so on the call. That's a fair reaction and I'd rather hear it.
>
> Next week has one job: prove Wednesday was the exception. A full week of green, verified morning and evening.
>
> — Plaino
>
> One bad Wednesday, reported straight. Hold me to next week.

---

## Why these are the bar

- **Every number has a row behind it** and appears in `quantified` with its source. The prose repeats numbers only verbatim.
- **The worst week reads the most trustworthy.** Example 3 is the one a skeptical broker forwards to a colleague.
- **Edits and rejections are treated as the partner teaching us** — the design-partner promise, operationalized in copy.
- **The control line appears exactly once per note**, attached to the numbers, phrased as the feature it is.
- **No vendor names, no engineer vocabulary, no performed enthusiasm.** The warmth is in the specificity.
