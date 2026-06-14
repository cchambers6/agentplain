# agentplain Customer Success Playbook

**Owner:** Conner (until first CS hire) · **Audience:** internal · **Status:** v1, 2026-06-14
**Voice:** Plaino — calm, plain-spoken, heritage. Never chirpy. "Intelligence rooted in reality."

---

## 0. Operating constraints (read first)

These are hard rules. They override anything below that drifts.

| Rule | Detail |
|------|--------|
| **Conner-time is Max/Custom only** | Live calls, stewardship calls, and scheduled 1:1s are a **Max** and **Custom**-tier benefit. Regular and Partner tiers get **async email support at hello@agentplain.com** and the in-app Plaino help channel. **Never promise a call, a "hop on a quick call," or "my calendar" to a Regular/Partner customer.** If they ask, the answer is the async channel + (for genuine fit) an upsell conversation to Max. |
| **Trial mechanics** | Card is captured at signup. Default trial is **7 days**. **CPA and Law get 14 days** (their value loop — month-end close, conflict screen — needs a longer first cycle to fire). A **14-day money-back guarantee** runs from first charge regardless of tier. |
| **LLM is degraded today** | Production chat (Plaino /talk + marketing widget) is degraded right now. The **first ~10 design partners must be chosen for tolerance of degraded chat** — they should get value from the parts that still fire (cron-driven killer workflows, the approvals queue, the weekly pulse) and treat live chat as a bonus, not the headline. Set this expectation **before** signup, not after. |
| **No-outbound product** | Plaino *drafts*; the customer approves and their own system sends. CS messaging must never imply agentplain emails the customer's clients on their behalf. |
| **Supported verticals today** | real-estate, CPA, law, and the general on-ramp are **live** (killer workflow has a production caller). home-services is **landing** (PR #207). insurance, mortgage, property-management, title-escrow, RIA/finance, recruiting are **waitlisted** — do not onboard a paying design partner into an unsupported vertical; route to waitlist. |

---

## 1. Pre-signup

### 1.1 Discovery questions (the qualifying five)

Ask these before anyone gets a trial link. They map directly to whether the trial will *activate*.

1. **What's the one repetitive task that eats your week?** (→ maps to a killer workflow or it doesn't fit yet)
2. **What system does that work live in today?** (Gmail/Outlook? QuickBooks? a CRM? a vertical AMS/LOS/practice tool?) (→ integration readiness)
3. **Who on your team would actually open an approvals queue each morning?** (→ named operator = activation; "nobody, I'm slammed" = churn risk)
4. **How many people would use this?** (→ tier: solo→Regular, small team→Partner, firm/multi-office→Max)
5. **If the chat assistant were slow or offline for your first week but the daily drafts still landed, would that work for you right now?** (→ degraded-LLM tolerance gate for design-partner cohort)

### 1.2 Trial-fit qualification

| Signal | Verdict |
|--------|---------|
| Live vertical (RE/CPA/Law/general) + Gmail or Outlook + a named daily operator + degraded-chat tolerant | **GREEN — issue trial** |
| Live vertical but no integration connected yet | **GREEN with a hand-hold** — book the connect step into day 0, value loop can't fire without it |
| Unsupported vertical | **WAITLIST** — capture in LeadCapture, do not take a card; "we're building your vertical's workflow and will reach out the moment it fires" |
| No repetitive task they can name / "just exploring" | **NURTURE — not now.** A trial that won't activate is a refund and a bad review waiting to happen |
| Needs live hand-holding + is solo/small | **Regular/Partner = async only.** Be explicit. If they need a person, that's a Max conversation, not a Regular trial |

### 1.3 Activation email (sent the moment they qualify, before they sign up)

> **Subject:** Your agentplain trial — here's what to expect
>
> Hi {{first_name}},
>
> Before you start, two honest notes so the first week goes well.
>
> **1. The value shows up in your approvals queue, not in a chatbot.** Each morning Plaino reads {{the thing they named in discovery}} and leaves you drafts to approve — you stay in control, nothing sends on its own. That's the part to watch.
>
> **2. Plaino's live chat is running slow this week** while we tune it. Your daily drafts and {{killer workflow}} are unaffected. If chat feels sluggish, that's expected and temporary — the work still gets done.
>
> Your trial is {{7 / 14}} days, and there's a 14-day money-back guarantee on top of that, so there's real room to see it work.
>
> One ask: connect {{Gmail/Outlook/QuickBooks}} in the first day — that's the switch that turns the drafts on.
>
> — Plaino, agentplain

### 1.4 Day-0 flow (the first 60 minutes decide the trial)

The product's onboarding wizard handles the mechanics (confirm details → connect integration → pick skills → set preferences → first-fire watch). CS's job on day 0 is to make sure the **first fire actually lands**:

1. Confirm the right integration connected (vertical-correct — a CPA needs QuickBooks, not just Gmail).
2. Confirm at least one **killer-workflow skill** is picked and **runtime-live** for their vertical.
3. Confirm the **first-fire watch** showed a real draft, not a "still working" timeout. *If LLM-dependent skills fail under degradation, point them to the cron-driven workflow that did fire and set the expectation that the rest catches up.*
4. Send the day-1 onboarding email (below) keyed to their vertical.

**Activation = one approved draft in the first 48h.** That is the single metric day 0 exists to produce.

---

## 2. Active trial (day 1–14)

### 2.1 Touch cadence

| Day | Touch | Channel | Trigger |
|-----|-------|---------|---------|
| 1 | Vertical day-1 onboarding email | Email (async) | Automatic on signup |
| 2 | **Silent check:** did first fire land? did they approve anything? | Internal (no customer touch) | Activation-signal monitor |
| 3 | "Stuck?" nudge — **only if zero approvals by day 3** | Email | No-activation alert |
| 7 | Check-in (all trials) | Email (async) | Day-7 timer |
| 10 | Trial-end heads-up #1 (7-day trials convert ~day 7; 14-day trials get this) | Email | Day-10 timer (14-day trials only) |
| 12 | Trial-end heads-up #2 + value recap | Email | Day-12 timer (14-day trials) |
| 14 | Conversion / money-back-window reminder | Email | Trial-end |

All touches are **async email + in-app**. No calls for Regular/Partner. Max/Custom design partners additionally get a Conner stewardship rhythm (§5).

### 2.2 Per-vertical day-1 onboarding emails (×5)

Each names the *one killer workflow* and the *one thing to connect*. Plaino voice — calm, concrete, no hype.

**Real estate**
> **Subject:** Your first Plaino draft lands tomorrow morning
>
> Hi {{first_name}}, Plaino is set up to do two things for you: score every inbound lead the moment it hits your inbox, and chase unpaid commission invoices so you stop leaving money on the table. Tomorrow morning you'll find the first batch in your approvals queue — read them, tweak anything, approve what's right. Nothing sends until you say so. To turn invoice-chasing on, connect QuickBooks from Settings → Integrations. — Plaino

**CPA**
> **Subject:** Month-end close, minus the document chase
>
> Hi {{first_name}}, your trial runs 14 days on purpose — month-end close needs a full cycle to show its worth. Plaino tracks each client's missing documents against their checklist and drafts the chase emails for you to approve and send. Connect QuickBooks to map your clients; the first status drafts land within a day. Plaino never states a tax position — every number defers to you. — Plaino

**Law**
> **Subject:** A conflict screen that runs before you do
>
> Hi {{first_name}}, you've got 14 days because the conflict screen earns its keep over a real intake cycle. When a prospective client comes in, Plaino checks them and any opposing parties against your ledger and drafts a formal notice to the responsible attorney — with the legal conclusion left to you, always. Add your matter ledger (or point us at it) from onboarding and the first screen runs same-day. — Plaino

**Home services**
> **Subject:** Every open estimate, followed up — without you remembering
>
> Hi {{first_name}}, Plaino walks every open estimate and drafts the right nudge for where it sits — a soft check-in, a last-call, or a "call this one" handoff for the cold ones. Price and scheduling always defer to you. The first batch lands in your approvals queue tomorrow; connect your estimate tool from Settings to pull jobs in automatically. — Plaino

**Finance / RIA** *(design-partner / waitlist-adjacent — use only when the RIA workflow is live for that partner)*
> **Subject:** Quarterly client updates, drafted to your voice
>
> Hi {{first_name}}, Plaino drafts your quarterly household update emails from a portfolio snapshot and your notes — never rendering a dollar figure or a recommendation; every number defers to you, with Form ADV pointers attached. This is an early-access workflow, so expect to shape it with us. Add your portfolio + CRM connection from onboarding to begin. — Plaino

### 2.3 Day-7 check-in

> **Subject:** One week in — is Plaino pulling its weight?
>
> Hi {{first_name}}, quick honest check: by now you should have approved a handful of drafts and seen {{killer workflow}} run a few times. Two questions, reply in a line each: **(1) What's Plaino saved you so far?** **(2) What's annoying or missing?** Both answers shape what we build next. If anything's stuck, just say "stuck" and we'll look. — Plaino
>
> *(Reminder: this is async. Do not offer a call to Regular/Partner.)*

### 2.4 Trial-end nudges (new mechanics)

**Day 10 (14-day trials) — heads-up #1**
> **Subject:** Four days left — and a recap of what Plaino did
> Hi {{first_name}}, your trial ends {{date}}. So far Plaino has {{N drafts proposed / N approved / killer-workflow runs}}. Your card's already on file, so it'll roll into {{tier}} automatically — and the 14-day money-back guarantee means you're still covered well past that if it isn't earning its keep. Nothing to do unless you want to change tiers or cancel.

**Day 12 — heads-up #2 + value recap**
> **Subject:** Your Plaino value recap
> Hi {{first_name}}, two days left on the trial. Here's the tape: {{hours-influenced / drafts approved / invoices chased / docs collected}}. If that's worth {{price}}, do nothing and you're set. If it isn't yet, reply "wait" and we'll figure out why before you're charged.

**Day 14 — conversion / guarantee reminder**
> **Subject:** Trial's up — you're covered either way
> Hi {{first_name}}, your trial ended today and {{tier}} begins. You've got the full 14-day money-back window from your first charge, so if it's not right, one reply gets you a full refund — no friction. Otherwise, welcome aboard. Here's what's next: {{1 expansion suggestion}}.

### 2.5 "I'm stuck" recovery — the #244 ticket lifecycle

The product ships a customer support channel + ticket lifecycle (PR #244) and Plaino L1 triage (escalate → KB auto-answer → bounded auto-resolve → draft). CS's recovery sequence sits **on top** of that:

1. **Customer says "stuck"** (in-app /help, the support chat, or a reply to any CS email) → a SupportRequest is created and runs through Plaino triage.
2. **If Plaino escalates** (billing dispute, anything it can't ground, LLM degraded) → it marks the ticket IN_REVIEW and replies honestly *"a human teammate will follow up within one business day"* — signed Plaino, never claiming to be human.
3. **CS owns the IN_REVIEW queue.** Same-business-day response for design partners. Resolve the underlying cause (most "stuck" tickets in week 1 are: integration not connected, vertical skill not picked, or first-fire failed under LLM degradation).
4. **Close the loop in the ticket**, then log the root cause to the research engine (see research-engine.md §3) so recurring stuck-points become product fixes.

**Common week-1 stuck-points and the fix:**
- "Nothing showed up" → integration not connected, or skill not runtime-live for their vertical. Re-run the connect step.
- "It said still working and never finished" → an inbox-required or LLM-dependent skill timed out under degradation. Point them to the workflow that *did* fire; reassure the rest recovers.
- "Chat is broken" → expected this week. Redirect to the value in the approvals queue.

### 2.6 Activation milestone signals

Watch these in order. Each is a leading indicator of conversion.

| Milestone | Signal | If missing |
|-----------|--------|-----------|
| **Connected** | Integration shows healthy (REAL_READ, not credential-only) | Day-0 hand-hold failed — reach out |
| **First fire** | One SkillRun produced a real draft | Check degradation; surface the cron workflow that fired |
| **First approval** (★ activation) | One WorkApprovalQueueItem moved to APPROVED | The day-3 "stuck?" nudge fires |
| **Habit** | Approvals on ≥3 distinct days | The day-7 check-in probes why not |
| **Value visible** | They've seen the weekly briefing / value recap | Make sure the Monday briefing fired; quote it in day-10/12 nudges |

---

## 3. Paid retention (day 14+)

### 3.1 Day-15 welcome (paid)

> **Subject:** You're in — here's how we'll keep earning it
> Hi {{first_name}}, you're now on {{tier}}. Three things: **(1)** Plaino keeps running every morning — nothing changes mechanically. **(2)** You'll get a weekly pulse each Monday with what ran and what to lean into. **(3)** Support is {{async at hello@agentplain.com + in-app help}} *(Max/Custom: + your stewardship rhythm with Conner)*. If something ever feels off, "stuck" still works. — Plaino

### 3.2 Week-1-paid async check-in

Async only. *"You've been paid up a week — what's the one thing Plaino should do better? Reply in a line."* Feeds the research engine.

### 3.3 Month-1 check-in (Partner tier template — async, NOT a scheduled call)

> **Subject:** Month one — your Plaino scorecard
> Hi {{first_name}}, a month in. Here's your tape: {{hours influenced, drafts approved, killer-workflow output, acceptance rate}}. Two questions: **what's working, what's getting in the way?** If your team's grown or you want a second workflow turned on, reply and we'll sort it async. — Plaino
>
> *Partner-tier customers get this **as an email**, not a call. A call is a Max benefit. If a Partner customer is asking for recurring face-time, that's the Max upsell trigger (§5).*

### 3.4 Monthly health check (internal)

Score every paying account monthly on the health model (research-engine.md §4):
- Approvals in last 30 days (usage)
- Draft acceptance rate (quality fit)
- Days since last login (engagement)
- Support tickets + sentiment (friction)
- Tier vs. seat count (expansion headroom)

Green / Yellow / Red. Red triggers the churn-defense sequence (§4).

### 3.5 Expansion triggers

| Trigger | Move |
|---------|------|
| Seat count outgrows tier band | Tier-up nudge (Regular→Partner) — async, frictionless |
| Asking for recurring calls / "can I talk to someone" | **Max upsell** (§5) |
| Second repetitive workflow surfaced in a check-in | Turn on a second skill; show the new value |
| Multi-office / multi-entity language | Custom-engagement conversation |
| High acceptance rate + daily habit | Ask for a testimonial / case study (we have *zero* social proof — see partner-channel-strategy.md) |

---

## 4. Churn defense + recovery

### 4.1 Early signals (in priority order)

1. **No approvals in 7 days** while subscribed — the strongest predictor. The product stopped being a habit.
2. **Acceptance rate collapses** (drafts proposed, none approved) — quality/fit broke.
3. **Integration went unhealthy** and wasn't reconnected — the value loop is silently dark.
4. **A support ticket went cold** or sentiment turned.
5. **Login gap** > 10 days.
6. **Card declined / PAST_DUE** — note: PAST_DUE currently stops skills immediately, so this is also a value-loss signal, fix billing fast.

### 4.2 Intervention sequence (async)

- **Yellow (1 signal):** Targeted async email naming the specific gap — *"Plaino's drafts have been piling up unapproved — is something off, or has the work changed?"*
- **Orange (2 signals):** Value-rescue email with the concrete tape + an offer to turn on a different/better-fit workflow. For Max/Custom only: offer a stewardship touch.
- **Red (3+ signals or PAST_DUE):** Fix the mechanical cause first (reconnect integration, resolve billing). Then a plain-spoken *"is this still worth it for you?"* — honesty beats a discount. Do **not** reflexively discount; diagnose fit.

### 4.3 Graceful cancellation

- Cancellation is one-click (atPeriodEnd) — never trap anyone.
- On cancel: a single short exit-survey question — *"What would have made Plaino worth keeping?"* — and a genuine *"the door's open."* Log the reason to the research engine.
- Honor the 14-day money-back window without argument. A clean refund earns a referral; a fought one earns a bad review.
- Confirm data handling on closure honestly (audit log is retained for forensics; the rest is torn down).

### 4.4 Win-back

- 30 days post-cancel: *"We shipped {{the thing you were missing}} — want another look, on us for a week?"* Only send if it's true.
- Waitlisted-vertical cancels: re-engage the moment their vertical's killer workflow goes live.

---

## 5. Max / Custom tier (the only Conner-time tier)

### 5.1 When to upsell to Max

- A Partner customer asks for recurring calls or named human stewardship.
- Multi-office / firm-wide rollout, multiple workflows, multiple seats with coordination needs.
- A design partner whose feedback is strategically valuable and who wants a direct line.
- Procurement/compliance needs (security review, custom DPA) that exceed self-serve.

### 5.2 What Max delivers (and what justifies the price)

- **Conner-time:** stewardship calls, a real human relationship, direct line for escalations.
- **Sales-led pricing** — Max is quoted, not listed. Scope to the firm.
- Priority workflow configuration and early access to new verticals.
- Hands-on activation rather than self-serve onboarding.

**Custom** ($5K–$15K engagements) is for bespoke build/config beyond the productized workflows — a defined project, defined deliverable.

### 5.3 The pricing conversation

- Lead with the workflow value and the firm-wide scope, not a number — Max is quoted.
- Anchor on what a person doing this work costs them, not on the Regular/Partner per-seat price (different product).
- Custom is framed as a project with a deliverable, billed $5K–$15K depending on scope.
- Never use the banned framing ("pilot fees," "pilot pricing"). "First month free" is the only free-framing.

### 5.4 Stewardship rhythm (Max/Custom only)

- Kickoff call (activation, not a demo — they've bought).
- Bi-weekly or monthly stewardship call depending on engagement depth.
- Direct escalation line; same-day response.
- Quarterly business review with the value tape and roadmap input.
- This is the **only** tier where "let's hop on a call" is ever said.

---

## 6. CS ↔ Sales handoff

- **Sales owns:** discovery, trial-fit qualification, the trial issue, and Max/Custom pricing conversations.
- **CS owns:** everything from **trial day 0 (activation)** onward — onboarding hand-hold, the touch cadence, retention, churn defense, expansion *signals*.
- **The handoff point is trial issuance.** Sales qualifies and issues; CS owns the activation and the relationship.
- **Expansion is a shared seam:** CS detects the trigger (§3.5) and hands a Max/Custom upsell *back to Sales* (Conner) to price. CS does not quote Max.

---

*This playbook assumes the degraded-LLM design-partner phase. Revisit the §0 degradation rule and the chat-expectation language in every template once production chat is restored.*
