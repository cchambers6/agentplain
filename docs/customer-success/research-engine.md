# agentplain Customer Research Engine

**Owner:** Conner (until first CS hire) · **Status:** v1, 2026-06-14 · **Audience:** internal
**Purpose:** Turn the first ~10 design partners into a continuous, structured learning loop that drives the roadmap, calibrates Plaino's voice, and catches churn before it happens. Honest, async-first, and tier-respecting.

**Standing constraint:** recorded calls are a **Max-only** touch. Regular and Partner customers are researched via **async survey**, never a scheduled call. Conner-time is Max/Custom only (see playbook.md §0, §5).

---

## 1. Interview / research cadence

| When | Touch | Who | Format |
|------|-------|-----|--------|
| **Week 1** | Activation + first-impression survey | All trials | Async survey (5 questions, ≤3 min) |
| **Week 4** | Deep-dive | **Max only: 30-min recorded call.** All others: async deep-dive survey | Recorded call (Max) / survey (rest) |
| **Month 3** | Light pulse | All paying | Async survey (3 questions) |
| **Ad-hoc** | Stuck-point + cancel exit | Anyone who hits #244 ticket or cancels | 1-question survey logged to the loop |

**Why this shape:** the week-1 survey catches activation friction while it's fresh; the week-4 deep-dive (recorded only for Max, where we have the relationship and the consent) is where pricing sensitivity and voice calibration surface; month-3 confirms retention drivers without over-asking. Everything else is async because the tier rules require it and because async respects a busy local-business owner's time — which is the whole product promise.

### 1.1 Week-1 survey (all trials)
1. Did Plaino's first drafts actually show up where you expected? (Yes / Partly / No)
2. What's the one task you most want Plaino to take off your plate?
3. On a scale of 1–5, how clearly did you understand what to do in your first hour?
4. Did the chat being slow this week get in your way? (the degraded-LLM honesty check)
5. One word for how it feels so far.

### 1.2 Week-4 deep-dive (Max: recorded call; others: survey)
- What's Plaino saved you in the last month — in hours, dollars, or stress?
- Where did you *not* trust a draft, and why?
- Does the price feel right for what it does? (pricing sensitivity — see §2)
- What did you expect it to do that it doesn't?
- Does Plaino sound like *you* when it drafts? (voice calibration)

### 1.3 Month-3 pulse (all paying)
- Still worth it? (1–5)
- What would make you cancel?
- What should we build next?

---

## 2. What we're learning (the five research themes)

| Theme | Questions it answers | Signals to capture |
|-------|---------------------|--------------------|
| **Activation signals** | What separates a trial that converts from one that doesn't? | Time-to-first-approval, integration-connect rate, first-hour clarity score, which vertical activates fastest |
| **Pricing sensitivity** | Is $99–199 (Regular) / $199–279 (Partner) right? Where's the Max line? | "Feels right / too high / cheap" responses, seat-band confusion (the $99-vs-$199 anchor problem), willingness-to-pay by vertical |
| **Vertical pain validation** | Is the killer workflow we picked *the* pain, or did we guess wrong? | Which workflow they actually use vs. ignore; the "task I most want taken off my plate" answers; requests for a *different* workflow |
| **Feature requests** | What's the next workflow / integration to build? | Frequency-ranked requests; which waitlisted vertical has the most pull |
| **Voice calibration** | Does Plaino sound calm/credible/like-them, or off? | "Sounds like me / too formal / too chirpy" feedback; edits customers make to drafts before approving (the richest signal) |

**The single richest data source is the approvals queue itself:** what customers *edit* before approving tells us more about voice and fit than any survey answer. Mine draft-edit deltas continuously.

---

## 3. Feedback → product loop

### 3.1 Landing system (schema)

Land every piece of feedback in one structured store. **Recommendation: Linear** (engineering already lives there; feedback that lands next to issues gets acted on). Notion or Airtable work if Linear isn't adopted — the schema is the same.

**`Feedback` record schema:**
| Field | Type | Notes |
|-------|------|-------|
| `id` | id | |
| `source` | enum | week1-survey / week4-deepdive / month3-pulse / support-ticket(#244) / cancel-exit / draft-edit / unsolicited |
| `customer` | relation | workspace / account |
| `vertical` | enum | real-estate / cpa / law / home-services / ... |
| `tier` | enum | Regular / Partner / Max / Custom |
| `theme` | enum | activation / pricing / vertical-pain / feature-request / voice |
| `verbatim` | text | the raw quote — never paraphrase away the customer's words |
| `severity` | enum | blocker / friction / nice-to-have |
| `roadmap_link` | relation | the issue/epic it informed (null until triaged) |
| `status` | enum | new / triaged / shipped / wont-do / closed-loop-sent |
| `created` | date | |

### 3.2 Weekly synthesis
- Every Friday, Conner (or CS) reviews the week's `Feedback` rows.
- Cluster by theme; count frequency; flag any **blocker** immediately.
- Write a one-paragraph synthesis: *what we heard, what it means, what we're doing.* Append to the memory inbox so the fleet learns, and to the team channel.

### 3.3 Roadmap impact rule
- **A feature ships to the roadmap when ≥3 customers across ≥2 accounts request the same thing** *(blocker-severity items skip the threshold — one is enough)*.
- Anything below threshold stays logged but not built — protects against building for the loudest single voice.
- Waitlisted-vertical pull is tracked separately: the waitlisted vertical with the most inbound feedback gets workflow-build priority.

### 3.4 Closing the loop
- When a requested thing ships, the customers who asked get a personal note: *"You asked for {{X}} — it's live. Thanks for shaping it."* (async; sets `status = closed-loop-sent`)
- This is the highest-retention action available to us. Customers who see their feedback shipped don't churn.

---

## 4. Retention signal monitoring dashboard (spec)

A single operator dashboard. Three layers.

### 4.1 Per-customer health score
Composite, 0–100, recomputed daily. Surfaces a Green / Yellow / Red badge.

| Component | Weight | Source |
|-----------|--------|--------|
| Approvals in last 7 days (usage) | 30% | WorkApprovalQueueItem |
| Draft acceptance rate (fit/quality) | 25% | proposed vs APPROVED |
| Days since last login (engagement) | 15% | session/auth |
| Integration health (value-loop intact) | 15% | IntegrationHealthCheck (REAL_READ) |
| Support friction (open tickets + sentiment) | 10% | #244 ticket lifecycle |
| Billing status | 5% | Subscription (PAST_DUE = immediate red) |

**Thresholds:** Green ≥70, Yellow 40–69, Red <40 or any single hard-red (PAST_DUE, integration dark >72h, zero approvals in 7d while subscribed).

### 4.2 Aggregate cohort retention
- Logo retention + net revenue retention by **signup cohort** (weekly cohorts during design-partner phase).
- Activation rate per cohort (% reaching first-approval) — the leading indicator of that cohort's eventual retention.
- Conversion rate trial→paid, by vertical and tier.
- Churn rate + reason breakdown (from cancel-exit feedback).
- Time-to-first-approval distribution (activation speed trend).

### 4.3 Alerts
- **Red health badge** → CS task created (churn-defense sequence, playbook.md §4).
- **Zero approvals in 7 days** (subscribed) → immediate alert — the strongest churn predictor.
- **Integration dark >72h** → reconnect outreach (the value loop is silently off).
- **Acceptance rate drop >40% week-over-week** → fit/quality investigation.
- **Cohort activation rate falling** → onboarding regression — investigate the first-hour flow.
- Alerts route through the existing `pageHuman` seam where appropriate; CS-actionable ones become tasks, not pages.

---

## 5. Customer advisory council

### 5.1 When to form
- After we have **~10 paying customers** with a few months of tenure and at least one case study. Not before — a council with nothing to advise on is theater.

### 5.2 Composition
- ~10 members, **1–2 per live vertical** (real-estate, CPA, law, + general; home-services once live).
- Bias toward customers who *edit drafts thoughtfully* and *reply to surveys* — engaged, opinionated, building-minded. Not just the happiest.
- Mix of tiers, but weight toward Partner/Max (deeper usage, more to say).

### 5.3 Cadence
- **Quarterly group session** (Max-tier members: live; others contribute async ahead of it via a structured prompt, and get the readout).
- **Monthly async prompt** — one focused question, structured responses.
- A private channel for ongoing input (async).

### 5.4 What we promise the council (and what we don't)
**We promise:**
- Early access to new workflows and verticals before general release.
- A real voice in the roadmap — their input is read and acted on, and we close the loop.
- Recognition (with consent — they're also our first case studies and references).

**We do NOT promise:**
- **Unlimited Conner time.** Council membership is *not* a back-door to the Conner-time that's reserved for Max/Custom. Group cadence is quarterly; individual access follows tier. State this explicitly at invitation so expectations are clean.
- That every request ships — the ≥3-customer roadmap rule (§3.3) still governs.
- Pricing concessions — the council earns influence, not discounts.

---

*This engine is designed for the design-partner phase. Re-tune the cadence and the dashboard thresholds once we're past the first ~10 customers and production chat is restored (the week-1 "did slow chat get in your way" question retires then).*
