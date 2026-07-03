# Conner's queue, re-prioritized — value per minute of founder attention

**Input queue (fleet-memory `conner-queue.yaml`, 5 pending items, verified this session) plus
the CEO Pass 1 `04-open-questions` decisions. Re-ranked by the CoS criterion: blocked-value
released ÷ minutes of Conner time, with security exceptions ranked on exposure, not value.**

## The re-ranked queue

### 1. Revoke the leaked flatsbo PAT — 10 minutes ⬆ (was priority 6, dead last)

A personal access token has been sitting exposed since 2026-06-09 — 24 days
(`conner-queue.yaml` item `revoke-flatsbo-pat`; kaizen 08 tracks it as the open "PAT revoke
loop"). It is the only item on the queue that gets *worse* every day it waits, it costs ten
minutes, and no fleet action can substitute (only the account owner can revoke). Credential
exposure doesn't queue behind strategy. **This is the single item this pass moves up.**

### 2. Commit the sales motion — one 90-minute block, this week

CEO Pass 1's biggest lever, verbatim: calendar the recurring 60–90 min review-and-send block;
name the 3–5 GA-RE design-partner targets (queue item `design-partners-on-record`); create the
~$100–160/mo GTM accounts (Calendly/Cal.com kills the literal `{{CALENDLY_LINK}}` placeholder,
CRM-lite, Apollo); send the first five. Every revenue path starts at the first send date; a
week of delay moves the profitability curve a week right (CEO Pass 1 `01` §3). It also
satisfies the "active prospecting" half of the prod-key gate — this decision turns the
product's AI back on (CEO Pass 1 `02`).

### 3. Entity + counsel — start this month, one engagement

Queue item `legal-entity-ip`. Blocks everything signable (design-partner agreements, DPA,
counsel sign-off on the published ToS/AUP/Privacy that currently have none — kaizen 08). Not
above the sales block because it doesn't gate the first five *sends*; it becomes #1 the day a
partner says yes (CEO Pass 1 `04` Q2). The handoff packet already exists
(`docs/launch/legal-risk-prelaunch-review.md`) — the ask is a signature and a retainer, not
homework.

### 4. Ratify the rulings — ~30 minutes of yes/no, one sitting

New to the queue (from CEO Pass 1 `04` Q3–Q5 + direction check): (a) bless the kill/stop
lists; (b) pick the prod-key un-pause trigger (recommend B: first booked discovery call,
pre-verified); (c) flatsbo — waitlist-dark or fund the fix-week (recommend dark; the one-day
PII carve-out fires either way); (d) the two 16-day-old copy contradictions — `/security`
absolutes and "built on Claude" vs vendor-invisible. Defaults are stated in CEO Pass 1 `04`;
silence executes the defaults, but explicit ratification stops surface-area regrowth
arguments permanently.

### 5. The 10-minute email pair — batch, don't rush

`company-postal-address` (CAN-SPAM env for the weekly-report cron) + `weekly-email-dedupe`
(Mon proof-digest vs Fri weekly-report as canonical). Only matters when the weekly cron
enables, which is post-first-customer. Batch into any sitting; do not let either interrupt
items 1–4.

## What this queue deliberately does NOT contain

The spend pipeline, CI floor, guarantee writers, Connect-button fix, `/how-it-works`,
Decision Pack aggregation, "profitable" YAML ladder — all fleet-executable with zero Conner
dependency (CEO Pass 1 `04`, closing note). The queue above is the residue that no amount of
fleet capacity substitutes for: two account-owner actions (1, 2a-accounts), one legal act (3),
and one set of judgment calls (4). Per `feedback_fleet_handles_systematic`, everything
systematic has been kept off it.

## Total ask

Items 1 + 4 + 5: about one focused hour. Item 2: 90 minutes this week, recurring weekly.
Item 3: one decision plus a counsel engagement this month. **The entire human critical path of
the company is currently under three hours of queue plus one weekly rhythm** — the point of
the Decision Pack (fleet-sequence item 6) is to keep it that legible.
