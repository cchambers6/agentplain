# Attribution model — how a Monday send becomes a dollar we can trace

**Principle (from the marketing measurement plan, adopted):** sophistication without volume is fiction. At five sends a week and single-digit trials, attribution is a review habit, not a statistical model. Every prospect gets looked at individually. No pixels, no cross-site tracking, no probabilistic modeling.

## The chain, link by link

### Link 1: send → reply
Mechanical. Each of Monday's five emails is a row in the CRM-of-record (`/operator/outreach`, doc-06 pipeline stages) before it leaves the outbox: prospect name, firm, date, template variant. Replies land in the same inbox that sent them; Conner (or the operator on his behalf) marks the row replied with a disposition (interested / not-now / no / referral). Nothing to attribute — the thread IS the attribution.

### Link 2: reply → discovery call booked
The booking link in every outreach email is `NEXT_PUBLIC_BOOKING_URL` with two additions:
- a per-prospect `ref` parameter (e.g. `?ref=dp-2026-07-06-03`) matching the CRM row,
- standard UTMs (`utm_source=founder-outreach&utm_medium=email&utm_campaign=dp-ga-re-w1&utm_content=<template-variant>`).

When a call is booked, the ref resolves it to the exact send. If a prospect books through a bare link (forwarded email, typed URL), the calendar invite still names them — manual match against the five-row list takes seconds. **This is why `discovery.booked` capture must exist before the send: a booked call with no ref and no review habit is unattributable forever; everything else in this chain can be reconstructed from the inbox.**

### Link 3: discovery call → signed design partner
Pipeline stages in the CRM: DISCOVERY → QUALIFIED → DEMO → PROPOSAL → CLOSED-WON / CLOSED-LOST (the sales deep-dive doc-06 ladder). A signed partner is a stage transition on a row that already carries its entire history back to the send date. No inference; it's the same row.

### Link 4: signed partner → dollars
The partner's workspace is created through `signUpBrokerOwner`, firing `signup.attributed` with UTM + self-report. The CRM row records the resulting `workspaceId`. From there, revenue is Stripe subscription fact (Regular $199→$99 / Partner $299→$199 founding pricing per the ratified tier structure), and cost is that workspace's token spend from the spend-telemetry pipe — giving per-partner contribution, the number the CEO path-to-profitable doc models (~$185/RE solo seat) but has never measured. First measured contribution figure is the department's headline deliverable for the quarter.

## Corroboration layers (because single-source attribution lies)

1. **Self-report at signup** — "How did you hear about us?", 6 options + free text, with "assistant/AI search" as an explicit option (we invest in AEO; measure whether it works). For a founder-led, dark-social motion this regularly out-informs click data.
2. **First-touch UTM/referrer** on the web side, corroborating (never overriding) the CRM row and self-report.
3. **The Friday review** — every trial and every stage transition inspected by a human weekly. Disagreements between layers are resolved by asking the prospect, which at design-partner intimacy is a feature, not an embarrassment.

Precedence when layers disagree: CRM thread > self-report > UTM. A known human conversation beats a click record every time at this volume.

## What this model refuses to do

- No paid-ad pixels or platform conversion APIs — nothing to attribute until the spend gate opens, and the gate itself only requires the instruments above.
- No multi-touch weighting, no attribution windows, no modeled conversions. Five sends do not need a model; they need a ledger.
- No dashboard number without a decision attached (the standing rule). The chain above feeds exactly the Friday scoreboard: sends / replies / calls / partners / $ — each with its named action in `03-first-3-dashboards-spec.md`.

## Failure mode this design guards against

The business's entire revenue curve is anchored to the first send date (CEO doc 01). The corresponding measurement failure is a send wave whose outcomes can't be tied back — which would make week 2's "what changed" conversation a guess and quietly re-open the door to instinct-driven pivots. One ledger, one ref parameter, one weekly human review closes that door at near-zero cost.
