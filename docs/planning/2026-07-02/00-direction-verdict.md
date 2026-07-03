# Direction verdict — 2026-07-02 planning session

**Scope:** meta-level direction check across all memory, merged PRs #323–#347, live in-flight
work, and the load-bearing rule set. This is not another department lens — it asks whether the
lenses themselves point the right way.

---

## The three-line verdict

1. **The strategy is right.** Service partnership on the locked verticals, real-estate/Georgia
   beachhead, proof-before-scale, no-outbound, BYO-key, paused prod key as a budget gate — this
   is an internally consistent, defensible plan and no memory rule contradicts another at the
   strategy layer.
2. **The activity mix is wrong.** The fleet has spent the last ~10 days producing introspection
   about introspection — 20 audits, 10 retros, 2 master syntheses, 2 deep-dives, a journey loop,
   a CEO pass, a Chief-of-Staff pass, and now this session — while the five named, S-effort fixes
   on the first-value path and the founder outreach rhythm (the only two things on the critical
   path to revenue) have not started.
3. **The bet fails on execution stall, not on the market.** Every plan on disk terminates in the
   same ~5 Conner actions (start the send rhythm, confirm the entity, provision accounts, ratify
   contradictions, commit calendar time), and the machinery built to surface those actions —
   `memory/data/conner-queue.yaml` — has zero rows ever written to it.

---

## The current direction, as actually inferred

Reading memory, the last 24h of merges, and the live directives together, the operating plan is:

- **Product:** agentplain = managed AI ops ("we install, we run, we customize") for local
  businesses in 9 locked verticals; draft-and-approve spine; customer's own systems execute all
  outbound; customer brings their own SaaS keys; the model vendor is invisible on customer
  surfaces.
- **Build model:** the agent fleet builds everything; Conner is strategist and approver, cost is
  tokens + infra, no-ceiling budget during the burst window, Fable-default until 2026-07-07.
- **Go-to-market:** founder-led design-partner outreach, 3–5 partners, RE-first, CPA/law closed
  until 2 RE pilots live; partners run 3 months free; first revenue is a day-90–120 event by
  construction (docs/sales/deep-dive-2026-07-02/00-EXECUTIVE-PLAN.md §2).
- **Gate structure:** prod ANTHROPIC_API_KEY stays paused until market-ready AND active
  prospecting (both, not either); paid marketing behind a 4-condition gate; counsel gates on
  legal surfaces.
- **Live directive:** run continuous Fable passes until Jul 7 (journey loop, PR #347), expand to
  a 9-track non-stop loop until `profitable_milestone_reached: true` (in flight, local_fdd1beb2).

## The underlying bet

> A fleet-built service-partnership product in locked verticals can win 3–5 on-record design
> partners through ~2 hrs/week of founder outreach, convert them to $199–$299/seat paid accounts
> at 85%+ gross margin, and then scale self-serve with no founder on the critical path.

## What has to be true, and the honest call on each

These probability words are judgment calls made in this session, not measured rates. Each cites
the artifact it leans on.

| # | Precondition | Current state | Call |
|---|---|---|---|
| 1 | The advertised 5-minute first-value path works | **False today.** FUB/Sierra Connect is a dead end; TaxDome/Karbon advertised-but-unconnectable (audit 5 P0-1; journey seed `real-estate.activation.connect.1`). All fixes are S-effort and named. | High — *conditional on the fix wave actually firing.* Nothing about the work is hard; it is simply unstarted. |
| 2 | Conner sustains the outreach rhythm (~2 hrs/wk) | Untested. Assets merged 2026-06-16; zero sends in the ~2.5 weeks since (kaizen 05). This is the single human SPOF in the whole plan. | Medium. History so far is adverse; the plan's own mitigation (fleet drafts into an approval queue, founder only reviews and sends) has not been stood up. |
| 3 | A legal entity exists that can sign design-partner agreements and take money | Unconfirmed (kaizen 08: entity unconfirmed, zero counsel signoff on published ToS/AUP/Privacy). No plan on disk works without this. | High once actioned — but it has sat in "unconfirmed" for weeks with no movement, and it silently gates preconditions 2, 5, and 6. |
| 4 | Unit economics hold ($5–25/customer/mo AI cost against $199–299 seats) | Architecturally plausible (webhooks-not-polling, Haiku triage, caching — the cost-architecture rules are encoded in the runtime compose order). **Unverified in production because the key is paused**, and fleet-side cost stamping is unwired (WTD spend NULL). | Medium-high. The design is sound; the measurement that would confirm it does not run yet. |
| 5 | 3–5 design partners will sign and go on record | Untested — zero conversations held. The value anchor ($2.9K–$10.6K/mo) is analyst math, not observed willingness-to-pay. | Medium. The offer (3 months free, RE beachhead, warm-path network) is reasonable; there is simply no signal either way yet. |
| 6 | Anthropic's SMB motion doesn't absorb the service layer | Out of our control. The service-partnership lock (2026-05-15) argues white-glove deployment is structurally outside a model vendor's shape. | Medium-high, and unchanged since the lock was ratified. Not the thing to worry about this quarter. |

## The case, in one paragraph

The strategy documents are now better than the business needs them to be. The July audit wave
produced the best gap inventory this company has ever had, and then the fleet kept producing
inventory: syntheses of audits, retros of syntheses, deep-dives that restate both, and loops to
regenerate all of it continuously. Meanwhile the top of every one of those documents says the
same thing — fix the Connect button, fix the saved-time counter, fix the redirect, wire the CI
floor, and get Conner to send five emails a week — and none of it has happened. The direction
survives scrutiny; the sequencing does not (see 03). The corrective is not a new strategy. It is
a hard pivot of fleet capacity from producing analysis to executing the top of the analysis, and
a deliberate packaging of the ~5 Conner-only decisions so they cost one sitting (see 05).

**Sign-off recommendation for a skeptical board member:** approve the direction; withhold
approval of the current work plan until the stop list (04) and start list (05) are adopted.
