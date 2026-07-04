# Monday-send collateral — what marketing puts in Conner's hands by Friday Jul 4

Three assets. Each exists because a specific moment in the send chain needs it: the one-pager for the reply moment, the LinkedIn banner for the who-is-this-guy moment, the invite thumbnail for the calendar moment. Production of the two visual assets routes through creative-router per `feedback_creative_assets_use_tools_or_humans`; marketing supplies final copy and direction here, not improvised graphics.

**Standing dependency, flagged loudly:** `NEXT_PUBLIC_BOOKING_URL` is still unset (open item from the send-path wave, PR #355). The invite thumbnail and every booking CTA are decorations on a door that doesn't open until Conner creates the booking account and sets the env var. That is a ten-minute Conner action and it is the only hard blocker in this file.

---

## 1. The offer one-pager (refresh, not rebuild)

`docs/marketing/design-partner-outreach/real-estate/design-partner-program-one-pager.md` already exists and is claims-grounded. Marketing refreshes it against the last two weeks of ratified truth and ships it as a clean PDF (via the doc pipeline, Heritage tokens):

- **The offer, stated plainly:** one of five founding design partners. Three months free. Weekly access to the founder. You shape what gets built. In exchange: you actually use it, you tell us the truth about it, and if it earns it, you let us say so publicly with your name. Nothing publishes without your written sign-off.
- **What it is:** a service partnership on your existing desk. The fleet reads your connected email, calendar, and QuickBooks and drafts the between-the-records work: lead first-touches, invoice chases, the overnight recap. You approve and send, every time. Fair-housing review runs on every draft before you see it.
- **What it is not (keep this section; it is the trust engine):** not a CRM replacement, not auto-send, not a bot that talks to your clients. Where FUB/Sierra/BoldTrail win, we say so, and the comparison pieces are linked as proof of the posture.
- **Terms truth:** integration story stays email + calendar + QuickBooks + DocuSign/Drive, exactly. After the free period, standard pricing from `lib/pricing/tiers.ts` applies and is printed on the page; no "pilot pricing" language anywhere.
- **Format:** one page, front only. Attached to reply emails and discovery-call confirmations, never to cold first-touches (first-touch stays a short personal email with one content link, per the outreach kit).

## 2. LinkedIn banner update (Conner's profile)

Every prospect will look Conner up between the email and any reply. His profile is currently the least-managed surface in the funnel and the only one marketing can improve without engineering.

- **Banner copy (final, gate-clean):** headline strip: **"agentplain — AI service partners for local businesses. Drafted for you. Approved by you."** Sub-line: **"Now selecting five founding real-estate partners in Georgia."**
- **Visual direction for creative-router:** Heritage Plains Editorial tokens (paper field, ink type, single clay accent rule), letterpress texture, Plaino mark at heel-height right. No screenshots, no stock imagery, no gradients. Standard LinkedIn banner dimensions with safe-zone margins for mobile crop.
- **Headline/about line (Conner edits to taste, this is the offered draft):** "Building agentplain: a service partnership that does the drafting work local businesses shouldn't be doing at 9pm. We run our own brokerage on it first."
- **Why this is in scope while ad creative is held:** the hold covers ad-unit production against the paid gate. A founder profile surface for an active founder-led motion is outbound support, which is exactly what the kill list says marketing does now.

## 3. Calendar invite thumbnail + invite copy

When a discovery call books, the invite is the last thing a prospect reads before deciding whether to actually show up. Defaults read as spam; this one should read as a person.

- **Invite title:** "Conner Chambers + [Prospect first name] — 25 min, agentplain design-partner conversation"
- **Invite body (final, gate-clean):** "Thanks for the time. This is a conversation, not a demo reel: 10 minutes on how your desk runs today, 10 on what the fleet would draft for you in week one, 5 on whether the founding-partner setup fits. Nothing to prepare. If anything changes, just reply here."
- **Thumbnail spec for creative-router:** square card, paper token field, Plaino sitting (calm pose from the ratified 10), one line of ink type: "25 minutes. No slides." Used as the booking-page event image so the calendar moment matches the brand instead of a default gray block.
- **Booking-page description** gets the same copy as the invite body, so the promise is identical at every step.

## Delivery checklist (all due Friday Jul 4, EOD)

| Asset | Format | Blocked by |
|---|---|---|
| One-pager PDF | refreshed doc → PDF, linked from `/operator/outreach` prospect rows | nothing |
| LinkedIn banner | PNG via creative-router, handed to Conner to upload | creative-router turnaround |
| Invite thumbnail + copy | PNG via creative-router + copy block pasted into booking tool | **`NEXT_PUBLIC_BOOKING_URL` / booking account (Conner, ~10 min)** |
