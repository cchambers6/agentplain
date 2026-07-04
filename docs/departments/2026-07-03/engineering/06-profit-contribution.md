# Engineering's profit contribution — this week's lever and next quarter's revenue path

Engineering does not create demand. Its profit contribution is exactly three things: **don't lose the prospect the lever produces, don't leak the money the product earns, and keep the cost structure that makes $199–$299/mo a high-margin price.** Everything in this plan maps to one of those.

## This week: the five sends

The lever is Conner sending five Georgia-RE design-partner emails Monday. The send-path wave (#355) already cleared the mechanical path — booking CTA, `/contact`, `/how-it-works` unshadowed, api-key connect, CRM-lite stages. Engineering's remaining contribution to the lever is **what happens when a prospect clicks through:**

- **Fix #4 (inert controls)** means the first curious broker who pokes the marketing surface doesn't find a decorative Test-connection button or a BYO-storage promise that eats credentials. Pre-proof, our strongest asset is honesty; a prospect catching one false control costs more than any feature ships.
- **Fix #5 (disclosure routing)** means the two-bucket data story — the ratified positioning that differentiates us — is actually enforced on the connect path a design partner would walk in a demo.
- **Un-pause readiness by Jul 11 (doc 03)** means the first booked discovery call can include a live product, not a demo of our own outage. The key policy's second condition is satisfied by the sends themselves; engineering's job is that the flip is safe the same day. The killer-workflow demos (PR #303) need no key; the *product* does.
- **Merge train days 1–2** is lever-adjacent too: the outreach kit, kill rulings, and send-path fixes live on unmerged branches. If main doesn't carry them, next week's fleet re-derives them — fleet capacity that should be burning down the fix table instead.

The Friday scoreboard (sends / replies / calls) reads from surfaces engineering shipped; Data/Analytics wires the read (doc 04). That is the week's entire demand-side ask of engineering — deliberately small, because the constraint is Conner pressing send, not code.

## This quarter: the revenue path in three engineering numbers

Cash-breakeven is 3–9 customers; $10K MRR ≈ founder-inclusive profitability. Engineering's contribution to that curve is measured by three numbers it directly controls:

**1. Refund leakage → $0.** The guarantee currently offers walk-away refunds to workspaces the fleet served, because 4 of 7 calibrated actions write zero saved-time minutes. At 3–9 customers, **one** wrongful $199–$299 refund plus a false "we failed you" email is a material fraction of total revenue and possibly a lost account. Fix #1 is the only line item in the company that converts directly into retained dollars this month. It ships first.

**2. Gross margin per workspace → known, capped, ~80%+.** The June production plan's headline was token cost vs. subscription margin, and it has been unmeasurable ever since: `stampSessionCost` has zero call sites, `canSpend` reads a file nothing refreshes, and the cap default is NO_CAP. Doc 03 turns that into: default $40/mo COGS ceiling per $199 workspace (Finance ratifies), per-workspace usage ledger, degrade-don't-overspend at cap. That is the mechanism by which adding customer #4 through #9 adds margin instead of variance. Without it, un-pausing the key at customer #1 makes every enthusiastic user a margin experiment.

**3. Fleet cost per shipped fix → falling.** The fleet is the company's payroll. Today it pays a plumbing tax per session (push/PR recipe re-derived, worktree traps, heal passes after merge-day batches) and its spend is unfalsifiable ("no ceiling," no meter). The CI floor kills the audit-refind loop (fixes verified at merge, not re-audited later — the July audits re-finding June's P0s verbatim was pure waste). `fleet-ship.mjs`/`wt.mjs` delete the per-session tax. The spend stamp makes cost-per-PR a number the kaizen loop can push down. Every fleet-hour reclaimed is either a burned-down P0 or a dollar not spent — both are the profit equation.

## The through-line

Design-for-profitable means engineering builds the *system that stays profitable at N customers*, not features that chase customer #1 — the lever chases customer #1, and it needs sends, not code. The fortnight's output is: main carries the truth, quality is server-enforced, the guarantee pays only when owed, the key can turn on safely, and every fleet-dollar is visible. When the first design partner signs, nothing about the cost or trust structure has to be retrofitted under load — it is already shaped like a business.
