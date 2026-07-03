# Profit contribution — the data department's line to the P&L

Design FOR profitable means this department's output is measured in decisions made cheaper, faster, or possible at all — not in dashboards shipped. Four contribution lines, each tied to the profit equation the CEO pass modeled (contribution ≈ $185/RE solo seat; cash-breakeven 3/9/25 seats; $10K MRR ≈ founder-inclusive profitability).

## 1. Making the revenue curve steerable (the outbound funnel)

The entire revenue model is anchored to the first send date, and its funnel rates are currently assumptions. After two Fridays of scorecards we hold the first measured reply and booking rates this business has ever had — which converts "month 8–12 to $10K MRR" from an anchored guess into a number that updates weekly. The profit contribution is decision speed: a pitch that isn't working gets changed in week 2 on evidence, not in month 3 on frustration. At founder-time prices, weeks of misdirected effort are the single most expensive thing this company can buy.

## 2. Protecting the margin claim (spend telemetry)

The ~95% modeled margin is unverified because per-workspace token cost has never been measured against a real customer. The spend pipe turns the margin into a measured fact per seat, which directly prices the tiers: if a real RE workspace burns 3× the modeled tokens, we learn it at partner #1 (a conversation) instead of customer #30 (a repricing crisis). Same pipe enforces the $8,670/wk fleet caps against real numbers — today `canSpend()` guards a budget tracking a fiction, which means the guard is either never binding or wrongly binding, and we can't know which. That ambiguity is an unbounded liability on the cost side of the equation; closing it costs two S-effort wiring tasks.

## 3. Preventing false-negative refunds (the save-motion event)

The guarantee pays out on saved-time evidence. With 4 of 7 calibrated actions writing no saved-time rows, a customer the product genuinely helped can qualify for a walk-away refund because the help went unrecorded (audit 9's P0). Instrumenting inside `recordSavedTime` makes the activation funnel and the refund ledger the same numbers — every wrongly-refunded seat this prevents is a full seat-month of contribution, and the case-study math ("Plaino saved this firm N hours") inherits audit-grade evidence for free. Proof assets we can defend are gate condition #3 for paid; this is where their numbers come from.

## 4. Blocking negative-ROI spend before it happens (the gate)

The 4-condition gate is a profit instrument that works by *not* spending: paid dollars into an unmeasured funnel with no proof asset is the one readily-available way to burn cash this quarter. Holding ~$3–5K/month until cost-per-qualified-trial is computable and one permissioned quote exists is worth more, at this stage, than any optimization the same effort could buy. The fallback (budget rolls to photography) means a shut gate still purchases a durable asset.

## What this costs

Roughly: one Engineering S–M task (event layer + call sites), two Engineering S tasks (stamp wiring + Librarian executor, saved-time writers), a few XS items, and a standing five-minute Friday habit. No new vendors, no new meetings, no new loops. Almost everything expensive was already built — detectors, readers, write contracts, the retro script; this plan is the fuel line, and the fuel line is where all the leverage sits.

## The honest boundary

Nothing here *generates* a dollar of revenue. Five prospects receiving five emails on Monday does. This department's contribution is that when replies come back, every one is attributable; when a partner signs, their unit economics are measurable; and when someone proposes buying growth, the scoreboard answers before opinion does. Data's profit line is the compounding difference between steering on instruments and steering on instinct — and the instruments only start recording if the motion starts. Top row first.
