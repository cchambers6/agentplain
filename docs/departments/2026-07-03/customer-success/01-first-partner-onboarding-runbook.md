# First-partner onboarding — the 90-minute call, minute by minute

**Assumption:** prod key is un-paused **for this partner's workspace only**, per-workspace budget cap verified (see `00-EXECUTIVE-PLAN.md`, "the one decision"). If that isn't true on call day, **reschedule the call** — do not run onboarding against a resting product; the first impression is unrepeatable.

**Partner profile:** Georgia real-estate broker-owner or solo agent, sourced from the Monday sends, qualified on the discovery call per `docs/customer-success/playbook.md` §1.1 (the five questions) and `docs/sales/deep-dive-2026-07-02/02-design-partner-program.md` §2 (design-partner filter: can activate — Google/M365 live, owner does own email, no procurement gate).

**Voice on the call:** customer vocabulary only (`feedback_customer_vocab_not_engineer`). It's "Working," "Setting up," "Watching," "connected," "ready to connect" — never "live," "rooting," "fired," "workspace credential," "LLM." If asked what's under the hood: agentplain is a service layer built on foundation-model infrastructure; the subprocessor list on /security is the honest reference. Don't lead with vendor names on any surface; the "built on Claude" positioning ruling is still with Conner (CEO doc 04, Q5).

---

## Pre-call checklist (Conner or Fable, day before — 20 min)

Every item is a hard gate. Any red = reschedule or fix first.

1. ☐ Signed short letter on file (standard ToS + letter covering case-study/testimonial/reference terms — design-partner doc §4 interim path; counsel-reviewed agreement is not a launch blocker for partner #1).
2. ☐ Prod key un-paused for their workspace; budget cap set; a smoke draft generated in the last 24h on the seeded dry-run workspace (proves the pipeline is warm today, not last week).
3. ☐ Discovery handoff sheet from Sales in hand: their named repetitive task, their email system (Gmail/Outlook), QuickBooks yes/no, the named daily operator (them), degraded-tolerance answer. This sheet **is** the onboarding config — no re-discovery on the call.
4. ☐ Their workspace pre-created OR signup path tested that morning. Recommended: they sign up live (they should see their own front door), but we have tested the exact path within 24h.
5. ☐ Weekly 30-min call slot proposed in the calendar invite for this call (we close the call by confirming it, not by hunting for times).
6. ☐ Screen-share tech check: Conner shares, partner drives their own keyboard for the parts that matter (their hands on approve, not ours).

## The 90 minutes

### Segment 1 — Frame and promises (0:00–0:10, no screens)

Say four things, plainly:

1. **What this is:** "Plaino reads the work you named — {{their task from discovery}} — and leaves you drafts. You approve, edit, or toss them. Nothing ever sends on its own; your systems do the sending." (No-outbound rule — set it as a *feature*, because for a broker it is one.)
2. **What the pilot is:** 3 months free, weekly 30 minutes with Conner, their voice in the roadmap; in return the weekly call, an on-record quote once they've seen value, and the co-authored case study they approve word by word. (Restating signed terms — no new promises.)
3. **What "working" will look like by the end of this call:** "You will approve a real draft before we hang up."
4. **What memory means:** Plaino remembers their preferences and corrections for the life of the account — that's the product learning their business, and it's theirs (two-bucket positioning; never say "nothing stored").

### Segment 2 — Signup and workspace (0:10–0:20)

**Screens:** marketing home → signup → workspace shell.

- They sign up on their own machine, their own email. We watch.
- Land in the workspace: walk the five tabs once, one sentence each — **Today** (what Plaino surfaced), **Plaino** (talk to it), **Connections** (what it can see), **Reports** (what it did for you), **Account** (billing, team). Workspace IA per PR #288. Do not tour features; tour the *shape*.

### Segment 3 — Onboarding wizard + the one connection (0:20–0:40)

**Screens:** onboarding wizard (confirm details → connect → pick skills → preferences → first-fire watch).

Config decisions, made ON the call, from the discovery sheet:

| Decision | Default for a GA RE partner | Why |
|---|---|---|
| Integration to connect first | **Their email (Gmail/Outlook)** — the one switch that turns drafts on | Playbook §1.3: "connect in the first day" — we do it in minute 25 |
| Second connection | QuickBooks **only if** invoice-chasing was their named pain; otherwise defer to week 2 | One connection that works beats two that confuse |
| Skills picked | **Lead scoring + inbox drafts** (their named workflow first); invoice chase only with QBO | The killer workflow they asked for is the one they'll check tomorrow |
| Daily briefing time | Their first coffee, their words (default ~9am ET) | The briefing is the daily heartbeat — put it where they'll see it |
| Named operator | Them, personally, for the pilot | Discovery Q3 — a queue nobody opens is the churn signature |
| Team invites | **Not today** | Every extra face on day 1 dilutes the habit we're building |

- **Watch the first fire land, live.** The wizard fires picked skills on submit (`lib/inngest/functions/onboarding-first-fire.ts`). Narrate the status honestly in customer vocabulary: "Setting up… Working." If a skill shows "Setting up" longer than expected, say "first activity lands soon" and move to Segment 4 with the one that fired — never dead-air waiting on a spinner.

### Segment 4 — The first approval (0:40–1:05) — **the point of the call**

**Screens:** approvals queue.

- Open the queue. Read the first draft together, out loud.
- **Ask them to edit something.** Even one word. The edit is the moment the product becomes theirs, and their corrections are the highest-value training signal we collect (drift sweep mines exactly this).
- **They click approve. Their hands.** Then say what happens next: the approved draft goes out through *their* system, or sits ready for them to send — nothing left our building.
- Do this for 2–3 drafts if the queue has them. Stop while it's still delightful.
- Show **Today** once more — now non-empty, now theirs.

**If no draft has landed by 0:40** (LLM hiccup, integration lag): fall back to the recorded synthetic-data walkthrough (PR #303 demo runtime, fabricated-data disclosure on screen) for five minutes while it catches up; if still nothing by 1:00, be honest — "the drafts will land this afternoon; I'll message you the moment the first one is in" — and Conner personally confirms same-day. Never fake it; the honesty IS the brand.

### Segment 5 — Cadence, support, close (1:05–1:30)

1. **Confirm the weekly 30-min call** — accept the invite before hanging up.
2. **Support expectations, stated exactly:** "Anything, any time: hello@agentplain.com or the support button in the app. You'll hear back same business day — usually from me directly during the pilot." (Design partners get founder-grade response; this is the sanctioned exception, and it ends at conversion unless they're Max.)
3. **Set the week-1 contract:** "Your only job this week: open the queue each morning with your coffee and approve or toss what's there. Ten minutes. On Friday you'll get an email from Plaino showing what it did — tell me on our call if it's lying."
4. **Open the case study:** fill the "before" fields in their own words from this call (design-partner doc §5) — current hours on the named task, what it costs them. Two minutes, on the record, with consent.
5. Book the day-2 check (internal, silent — see `02-…success-criteria.md`).

## Success criteria to close the call on (all four, or the call isn't done)

1. ☐ **≥1 draft approved by the partner's own hand, live on the call.**
2. ☐ Email connected; the named workflow's skill showing "Working" or "Watching" in customer terms.
3. ☐ Weekly call accepted in their calendar; day-2 silent check scheduled internally.
4. ☐ Case-study "before" fields filled from their own words.

## Post-call (same day, 15 min)

- Fable drafts the recap email (what we set up, what lands tomorrow, the one thing to watch); Conner approves and sends from his inbox.
- Log call notes + config into the partner's folder (`03-support-playbook…` folder scheme) and the memory inbox.
- File every friction moment observed on the call as a ranked list to Product/Engineering — the first onboarding call is the highest-density product-feedback artifact the company has ever produced. Treat it like one.
