<!--
  Vertical: ria (codebase slug)
  Title: Finance / RIA
  Trial: 7-day free trial, 14-day money-back guarantee
  Voice note: Formal, precise, compliance-aware. Consultative, never pushy.
  Never renders dollar amounts or investment recommendations — all quantitative
  claims use merge fields the advisor confirms. SEC Marketing Rule posture is
  a trust asset, not a risk mitigant. Honest about Setting Up vs Working.
-->

# agentplain — Finance / RIA Sales Script

---

## 1. Cold Open

### Phone variant (30 seconds)

"Hi [name], this is [rep] from agentplain — I'll be brief. We work with independent
RIA firms, and the pattern we hear most consistently is that advisors are spending
30 to 60 minutes preparing for each client meeting — pulling from the CRM, the
custodian, the planning software — before a single question has been asked. At a
three-advisor practice, our analysis puts that at roughly $175,000 per year in
advisor-hour opportunity cost. I wanted to ask whether that number sounds in range
for your firm before I take any more of your time."

### Email variant (30 seconds to read)

Subject: Client meeting prep — 30 to 60 minutes per meeting, every meeting

[Name],

At a three-advisor practice with a normal meeting load, the time spent pulling
client context before each meeting — CRM, custodian, planning model — adds up
to roughly $175,000 per year in advisor-hour opportunity cost. That figure doesn't
count post-meeting notes or quarterly reporting cycles.

agentplain is a done-for-you AI service built for independent RIA firms. The fleet
drafts meeting prep packets, post-meeting notes, quarterly client updates, and
compliance passes on outbound communications — the advisor reviews and approves
before anything is sent. Nothing is auto-sent. No investment recommendations are
rendered. Every quantitative claim is a merge field the advisor fills.

Worth 20 minutes this week to see if it fits your practice?

[Rep name] | agentplain | hello@agentplain.com

---

## 2. Discovery Questions

Ask in order. Listen carefully for compliance posture and workflow specifics.

1. "How does your team currently prepare for client meetings — who pulls the
   information, where does it come from, and how long does that typically take?"

2. "After a client meeting, what's your process for capturing notes and updating
   the CRM and task list? How long does that step take, and how often does it
   get delayed or abbreviated?"

3. "When you send a client-facing communication — a quarterly update, a market
   commentary, a referral request — what does the review and approval process
   look like before it goes out?"

4. "What CRM is your firm running? Wealthbox, Redtail, Salesforce FSC, something
   else? And what's on the custodian side — Schwab, Fidelity, Pershing?"

5. "Are you doing planning work in eMoney, RightCapital, or MoneyGuidePro? And
   what does the portfolio management side look like — Orion, Black Diamond, Tamarac?"

6. "How do you handle the SEC Marketing Rule review on outbound marketing content?
   Is that a CCO checklist, outside compliance counsel, or something else?"

7. "When you think about your quarterly client reporting cycle, how many households
   are you putting packages together for, and how much of that is manual drafting
   vs. pulling from a system?"

8. "What does your operations or CSA team spend most of its time on — new account
   opening, AUM billing, CRM hygiene, or something else?"

9. "If I were to ask your lead advisor what the one task is that consumes the most
   non-billable time each week, what do you think they'd say?"

10. "How many seats would this need to cover — lead advisor only, or associates,
    ops, and compliance too?"

---

## 3. Demo Flow

Run in this order. Tie each beat to a pain the discovery uncovered. Be precise about
what is Working vs Setting Up — the product labels them, and so should you.

### Beat 1: The approval queue (3 minutes)
**Pain addressed:** No single view of drafts waiting for advisor review

Open the approvals queue. Show a quarterly client-update draft — the fleet has
pulled portfolio context and drafted a narrative. Every quantitative figure is an
{{advisor: fill this in}} merge field. The SEC Marketing Rule compliance flag is
attached. The draft does not leave the workspace until the advisor approves.

Say: "This is what the advisor sees. A full draft, ready to review, with every
number and forward-looking claim flagged as a merge field. The advisor fills in
the figures, reads the compliance note, and sends from their own system. Nothing
is auto-sent. That's the architecture — not a setting we'll change."

### Beat 2: Quarterly client update (4 minutes)
**Pain addressed:** Manual quarterly narrative drafting; 90 minutes per packet x 87 clients

Show the quarterly client-update draft workflow (ria-client-update-draft). The fleet
drafts the narrative using a portfolio snapshot and advisor notes. ADV and
qualified-custodian pointers ride on every draft automatically.

Be honest: "The quarterly update skill is Working today — it drafts from a portfolio
snapshot and advisor notes you provide. The production integrations with Orion,
Black Diamond, and Tamarac, and the CRM connections to Wealthbox and Redtail,
are Setting Up on a Q1 2027 roadmap. The draft quality and compliance scaffolding
are built and tested now; the automated data pull deepens when those integrations land."

Say: "The 'never renders dollar amounts' constraint is hard-coded into the skill,
not a prompt suggestion. Every quantitative or forward-looking claim is a merge field.
That's how we stay on the right side of Rule 206(4)-1."

### Beat 3: Compliance posture (3 minutes)
**Pain addressed:** SEC Marketing Rule exposure; manual CCO review burden

Show the Compliance Sentinel status (Setting Up) and the compliance watch skill
(Working — sweeps the last 24 hours of approval drafts for rule flags). Explain
the Marketing Rule enforcement context without overclaiming.

Be honest: "The RIA-specific Compliance Sentinel — the one that runs a full ADV,
suitability, and Marketing Rule check per draft — is Setting Up. The corpus is
loaded; draft scoring activates after counsel review of the corpus mapping. The
cross-vertical compliance watch is Working today — it runs the sentinel corpus
on every draft in your queue each morning."

Say: "The SEC's 2024 enforcement sweeps settled at $60,000 to $325,000 per adviser
for unsubstantiated advertising claims and missing testimonial disclosures. The
avoided settlement is downside the hours-reclaimed math doesn't capture — and
a draft-then-approve loop is the only architecture that can credibly promise it.
Auto-execution publishes before substantiation. We don't."

### Beat 4: What connects on day one (2 minutes)
**Pain addressed:** "What do I actually get immediately?"

Be direct: "Day one, you connect Outlook and the M365 calendar. That's the live
integration today. The cross-vertical fleet starts Working immediately — inbox
triage, follow-up chaser, invoice chase autopilot, weekly finance pulse, compliance
watch. The quarterly client update skill runs from data you provide. The deeper
CRM and custodian connections are the Q1 2027 integration roadmap."

### Beat 5: The meeting prep horizon (2 minutes)
**Pain addressed:** 30–60 minutes of manual prep per meeting

Show the Meeting Prep agent card (Setting Up). Explain clearly what it will do when
the CRM and custodian connections land — drafted agenda, delta-since-last-meeting,
open task list — and how it ties to the post-meeting Notes agent.

Say: "This is where the 30-to-60-minute-per-meeting reclaim comes from. It's Setting
Up — it comes online when Wealthbox or Redtail and your custodian feed are connected.
That's the honest answer. If you're evaluating us on what's live today vs. what the
roadmap delivers, I want you to see the distinction clearly."

---

## 4. Pricing Conversation

### Lead with the advisor-hour math

"The $175,000 per year figure comes from three advisors at roughly six hours per
week each on prep, recap, and communications triage, against a $300 per hour
opportunity cost. Capture 65 percent of that with the fleet and you're returning
$175,000 per year to billable time. At a 25-advisor practice the same ratio
applied to a $2.25 million opportunity pushes past $1.4 million per year."

### The tiers

agentplain offers three tiers. For RIA practices, the conversation typically
starts at Max.

**Regular — $99/seat/month** (from $199; first month free)
Available for practices that want to start with the cross-vertical fleet — inbox
triage, follow-up chaser, invoice chase, weekly pulse — before deeper RIA
integration. Month-to-month, cancel any time.

**Partner — $199/seat/month** (from $299; first month free)
Includes 4 hours per month of named-service-partner reserved time. A starting
point for practices that want a dedicated point of contact during the integration
build. Month-to-month.

**Max — quoted**
The recommended tier for RIA practices. Fiduciary-aware depth, SEC Marketing Rule
compliance corpus activation, custodian-portal coverage (Schwab / Fidelity /
Pershing), and dedicated success management. Engagement is scoped per practice.
Start with a conversation: email hello@agentplain.com or request through the
website, and a service partner will scope with you.

**Custom engagements — $5K–$15K**
For capability builds we do not have yet — a custom portfolio-rebalancer skill,
custom planning-software integration, or a build specific to your firm's workflow.
These are separate from Max and are scoped on their own track.

### "Is it per seat?"

"Yes. A seat is one person — lead advisor, associate, ops, compliance. You activate
the seats you need. You can start with one."

### Trial

"7-day free trial. 14-day money-back guarantee. Card at signup. If the fleet doesn't
perform the way we've described in the first two weeks, we'll make it right or refund
you — no dispute process."

---

## 5. Top 10 Objections + Responses

### 1. "Isn't this just ChatGPT?"

"ChatGPT is a general-purpose model — it has no knowledge of your CRM, your ADV,
your custodian, or your clients. agentplain is a done-for-you service built on Claude
and configured specifically for independent RIA practices. We've pre-loaded the SEC
Marketing Rule corpus, the ADV compliance framework, the fiduciary posture constraints.
We run it for you — you don't need a prompt engineer on staff or an AI expert on your
team. The difference between a tool and a service is who does the configuration work.
We've already done it."

### 2. "We don't trust AI with our clients' financial information."

"That concern is exactly right, and it's the reason the architecture is built the way
it is. The fleet reads the data you give it and drafts inside your workspace. Nothing
is sent to a client without your approval. Every quantitative claim — every number,
every forward-looking statement — is a merge field the advisor fills before the draft
goes out. There is no auto-send, no auto-publish, no auto-file. The advisor's judgment
is the final gate on every client-facing communication."

### 3. "We're worried about the SEC Marketing Rule. What if a draft says something
    we can't substantiate?"

"The Marketing Rule concern is the reason we built the compliance posture the way
we did. First: the fleet never renders dollar amounts or investment recommendations.
Those are always {{advisor: fill this in}} merge fields. Second: the Compliance Sentinel
corpus runs a pass on every draft citing the specific 206(4)-1 clause for each flag
before the advisor sees it. Third — and most importantly — nothing is published
automatically. An unsubstantiated claim drafted by the fleet and approved by your CCO
is a different risk than one auto-published by a platform. We make the approval step
unavoidable. The SEC's 2024 enforcement sweep ran from $60,000 to $325,000 per firm
for unsubstantiated claims and missing disclosures. We take that seriously."

### 4. "We're too busy to implement something new."

"Setup is an afternoon. You connect Outlook, configure the vertical, and the cross-
vertical fleet starts working that day. There is no month-long implementation project,
no systems integrator, no IT ticket. The CRM and custodian integrations that deepen
the value are Setting Up on a longer roadmap — you're not blocked from getting value
from the inbox triage and quarterly update drafts today. The practices that benefit
most are usually the ones where the advisory team is busiest, because the draft work
gets done even when no one has a spare hour."

### 5. "What if it sends something wrong to a client?"

"It cannot send anything. Every draft is in a pending queue. The advisor or CSA
reads it, fills in the merge fields, and sends from their own system. If the draft
is factually wrong, off-tone, or unsuitable — it doesn't go. There is no path from
a fleet draft to a client inbox without a human decision in between. That's the
architecture."

### 6. "We already have Wealthbox / Redtail / Orion / [tool]."

"Those are exactly the tools the fleet is building to connect to. Wealthbox, Redtail,
Orion, Black Diamond, Tamarac, and the custodian feeds are on the Q1 2027 integration
roadmap. In the meantime, the fleet works from your email, your calendar, and the
portfolio data you provide. The quarterly client-update drafts, the inbox triage,
the compliance sweeps — those are Working today. The deeper automated data pull
comes when the integrations land. We're not asking you to abandon your stack;
we're asking you to connect to it."

### 7. "Too expensive. We're a small practice."

"Let me separate the question of cost from the question of value. The $175,000 per
year advisor-hour reclaim at a three-advisor practice is based on time that's currently
being spent, not optionally spent. Every meeting prep hour is an hour that isn't
spent with clients or growing the book. The Max tier is scoped per engagement because
the right configuration for a three-advisor firm and a 25-advisor firm are different.
Start the conversation — email hello@agentplain.com — and we'll scope something that
fits your practice size before you see a number."

### 8. "I need to think about it."

"That's reasonable. Can I ask what the specific question is? If it's around compliance
posture, I'd rather work through that directly — it's the most important part to get
right. If it's around the integration roadmap — what's live now versus Setting Up —
I can send you the honest inventory. If it's trust in whether this is real, the 7-day
trial puts the fleet in your practice so you can see it, not take my word for it."

### 9. "Does it replace my associate advisor or CSA?"

"No. It removes the read-and-draft work from their day — the 30-minute meeting recap
from memory, the quarterly narrative assembled from three different platforms, the
Marketing Rule check they do manually on every communication. Your associate and CSA
still review every draft, handle exceptions, manage client relationships, and make
the judgment calls. What changes is how much of their time goes to cognitive assembly
work versus higher-value client interaction. We're not replacing the role; we're
changing what occupies the majority of it."

### 10. "What's actually working today versus what's in the roadmap?"

An honest answer matters more here than anywhere.

**Working today:**
- Quarterly client-update draft (ria-client-update-draft) — Working from a portfolio snapshot and advisor notes; NEVER renders dollar amounts; ADV and custodian pointers on every draft
- Chief of Staff — calendar, inbox, and to-do proposals (requires Outlook / Gmail connected)
- Compliance watch — sweeps the last 24 hours of approval drafts against the sentinel corpus; flags by rule citation
- Cross-vertical fleet: inbox triage, follow-up chaser, invoice chase autopilot, weekly finance pulse — Working from day one
- Finance pulse — reads invoice-chase and month-end close activity; when QuickBooks is connected, surfaces AR aging and open-invoice counts

**Setting Up (integration-dependent):**
- Meeting Prep agent — comes online when Wealthbox / Redtail + custodian feed are connected (Q1 2027 roadmap)
- Meeting Notes agent — comes online when your meeting-capture tool (Zocks / Jump / Otter) is connected
- Compliance Sentinel (RIA-specific) — corpus loaded; draft scoring activates after counsel review
- Planning Refresh — comes online when eMoney / MoneyGuidePro / RightCapital is connected
- Rebalance — comes online when Orion / Black Diamond / Tamarac is connected
- AUM Billing — comes online when custodian feed is connected for quarter-end balances

"We show the Working / Setting Up status clearly inside the product. You will
never pay for something that isn't running."

---

## 6. Close Lines by Temperature

### Hot (ready to move)

"Let's start the scoping conversation today. For a Max engagement, the right first
step is a call with one of our service partners — they'll get the specifics of your
practice before we discuss terms. I can set that up now. Or if you'd rather start
with the trial and work up from there, that's 7 days with no commitment."

### Warm (interested, wants more specificity)

"Here's what I'd suggest: start with a single seat on the trial. Connect your Outlook,
let the inbox triage and quarterly update draft run for a week, and look at the
approval queue. You'll see exactly what the fleet produces without taking my word for
it. If it earns a broader conversation, we'll have it. If it doesn't, you've spent
an afternoon."

### Cold (not ready, needs time or trust)

"I don't want to push a decision before you're ready. The compliance and integration
questions are exactly the kind of things that take time to think through for an RIA.
Would it be useful if I sent you the honest integration inventory — what's Working
today, what's Setting Up, and the Q1 2027 roadmap — so you can review it with your
CCO and come back with specific questions? That's a better starting point than
another call right now."

---

## 7. Five-Touch Follow-Up Sequence (14 Days)

### Touch 1 — Day 0 (same day as call) — Email

**Goal:** Ground the conversation in specifics; leave something concrete to review.

---

Subject: Notes from our call + honest inventory

[Name],

Thank you for the time today. Quick summary of what we covered:

- Meeting prep opportunity: ~$175,000/yr in advisor-hour reclaim at a 3-advisor firm
- What's Working now vs Setting Up (integration roadmap attached below)
- Pricing: starts at Regular ($99/seat/month) or Partner ($199/seat/month);
  Max engagements are scoped per practice; 7-day trial, 14-day money-back guarantee

I want to be direct about the integration roadmap: the Meeting Prep and Rebalance
agents depend on CRM and custodian connections that are on the Q1 2027 build plan.
The quarterly client-update draft and compliance watch are Working today.

[agentplain.com/ria]

If you want to see the approval queue running before making any decision, the trial
is there. Setup is an afternoon.

[Rep name]

---

### Touch 2 — Day 3 — Email

**Goal:** Lead with compliance posture; address the Marketing Rule concern proactively.

---

Subject: The Marketing Rule angle — one thing worth reading

[Name],

The SEC's 2024 Marketing Rule enforcement sweep settled at $60,000 to $325,000 per
adviser for unsubstantiated advertising claims and missing testimonial disclosures.
A single non-compliant performance figure or missing disclaimer in an auto-published
communication is enough to open a matter.

The reason agentplain is built on a draft-then-approve model is not a product choice
we made casually. It's the only architecture that can credibly prevent an unsubstantiated
claim from becoming a filed advertisement. The fleet drafts; the advisor or CCO approves.
Auto-execution publishes before substantiation. We don't.

If the compliance posture is the part you or your CCO want to examine more closely,
I'm glad to set up a call with the right person on our side.

[Rep name]

---

### Touch 3 — Day 7 — Phone + voicemail

**Goal:** Stay present; offer a compliance-specific conversation.

---

Voicemail script:

"Hi [name], [rep] from agentplain. Just following up — no urgency. If the compliance
piece is what you want to work through, I'm glad to set up a more technical conversation
with our team. If the timing is wrong for now, that's fine too. I'll send you a short
note as well. Thank you."

---

### Touch 4 — Day 10 — Email

**Goal:** Quarterly cycle angle; surface the reporting-cycle pain.

---

Subject: Heading into Q3 reporting — how the quarterly cycle usually lands

[Name],

Quarterly reporting cycle is usually the point where the manual narrative drafting
piles up — 87 client households to prepare, each needing a custom update assembled
from the CRM, the custodian, and the planning model.

What the quarterly update skill handles today:
- Drafts the per-client narrative from a portfolio snapshot and your advisor notes
- Every quantitative claim is a merge field you fill before it goes out
- ADV and qualified-custodian pointers on every draft automatically
- Nothing sent without advisor approval

If you're in the middle of the Q3 prep cycle, the trial takes an afternoon to set up
and you'd see the approval queue before the cycle is over.

[Rep name]

---

### Touch 5 — Day 14 — Email

**Goal:** Respectful close; leave clear return path.

---

Subject: Closing the loop — agentplain

[Name],

Last note from me on this cycle. If the timing isn't right or the integration
roadmap isn't where you need it yet, that's a fair call.

When the picture changes — Q1 2027 roadmap lands, quarterly cycle peaks, or your
CCO wants to revisit the compliance posture — I'm at [email] or [phone].

We'll be here.

[Rep name] | agentplain

---

## 8. Win-Back-on-No Strategy

### When the prospect says no (or goes quiet)

Do not argue the no. Tag the account and set a patient cadence.

**Immediate action:** Log the contact with tag: "no — [date] — [stated reason or
best guess]." Note the specific workflow pain they named, the tools they're running,
and the integration dependency that was the primary gap (CRM, custodian, etc.).

**What not to do:** Do not put them in a generic quarterly newsletter. Do not
re-send the same materials without a new reason to reach out. Do not follow up
more than once per quarter without a concrete trigger.

---

### Quarterly check-in (3-month cadence) — Email

Subject: Check-in — [firm name]

[Name],

It's been a quarter since we spoke. No agenda — just checking in.

If anything has changed in your practice (advisory team growth, new custodian,
a reporting cycle that hit harder than expected, or a change in your compliance
posture), I'd be glad to revisit the conversation.

If the timing is still not right, no need to reply.

[Rep name]

---

### Re-open triggers — act on these within 48 hours

These events warrant a personal, timely outreach with a direct reference to
what changed:

- The firm adds an advisor or associate (new seat, new reporting burden)
- A new SEC Marketing Rule guidance release or enforcement action in the RIA press
- The firm's CRM or portfolio system (Wealthbox, Redtail, Orion) announces an
  integration or API change
- A custodian platform change (Schwab service tier, Fidelity Wealthscape update)
  that affects reporting workflows
- A referral from a current agentplain RIA customer
- A job posting for an operations or client-service associate (capacity pressure signal)

When a trigger fires, acknowledge the prior conversation directly:

"I know the timing wasn't right when we spoke in [month]. I wanted to reach
out because [trigger] and I wasn't sure if that changed the picture for your
practice."

---

### The long-game rule

Compliance and integration concerns at RIA firms are not objections to be overcome
in a single call. They are legitimate due-diligence postures. The right response is
a long, honest relationship — not a 90-day drip cadence that treats the prospect
like a stalled deal. One substantive, value-first touch per quarter is more effective
than a marketing sequence they unsubscribe from by week two.

The practices that come back 6 to 12 months later come back because the
integration roadmap landed, the compliance corpus cleared counsel review, or the
quarterly reporting cycle hit hard enough that the manual work became untenable.
Be the first call they make when that happens.
