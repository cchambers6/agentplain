# Realty fleet binding — 2026-05-22 (P0 of the trust sweep)

## The bug

The `/app/workspace/[id]/agents` page advertises a 7-agent realty fleet. The
7 roster slugs (`realty-listing-coordinator`, `realty-buyer-inquiry-router`,
`realty-showing-scheduler`, `realty-compliance-sentinel`, `realty-crm-hygiene`,
`realty-production-reporter`, `realty-recruiter-assistant`) matched **nothing**
the runtime ever wrote:

- The live loop (`lib/skills/runner.ts`, fired by
  `lib/inngest/functions/process-webhook-event.ts`) persisted handoffs whose
  `fromAgent`/`toAgent` were step slugs (`inbound`, `reader`, `router`,
  `coordinator`, `scheduler`, `drafter`, `completer`) and approvals whose
  `agentSlug` was the constant `inbox-triage-fleet`
  (`lib/skills/persist-artifacts.ts`).
- The agents page counts `handoffLogEntry.groupBy(fromAgent)` and reads
  `counts.get(agent.slug)` — which was therefore **always 0**.
- So every one of the 7 cards rendered "rooting in — first handoff lands soon"
  forever, even after the loop had run and produced real drafts. Work was
  happening; no card ever reflected it. **0/7 resolved.**

The `AgentRosterEntry` type doc already stated the contract — the slug "MUST
match the `fromAgent`/`toAgent` values the runtime writes" — but the runtime
violated it.

## The fix (root cause, not a spinner tweak)

1. **Attribution.** `persist-artifacts.ts` now resolves the *owning* roster
   agent for each run from the workspace's vertical roster and writes that slug
   as both the handoff trace root and the approval `agentSlug`:
   - a `draft-needed` / `lead` run → `realty-buyer-inquiry-router`
   - a `scheduling-needed` run → `realty-showing-scheduler`
   - admin triage / noise / vendor → falls back to `inbox-triage-fleet`
     (no realty card, so a noise email never inflates a capability's count).
2. **Truthful status.** `AgentRosterEntry` gains `runtime: "live" | "rooting"`,
   `owns: AgentLoopWork[]`, and `rootingNote`. The agents list + detail pages
   render the real count for live agents and an honest "what it's waiting on"
   line for rooting ones — never the perpetual false spinner.

## 7/7 resolved — but honestly: 2 live, 5 rooting

Every card now resolves to a declared, type-checked, test-asserted binding
(`tests/realty-fleet-binding.test.ts`). What each binds to:

| # | Agent | Status | Backing / why |
|---|-------|--------|---------------|
| 1 | Buyer Inquiry Router | **live** | The inbox chain's draft path produces `BUYER_INQUIRY_REPLY_DRAFT`. Attributed to this slug. Proven by `skills-persist-artifacts.test.ts` (re-01, re-03). |
| 2 | Showing Scheduler | **live** | The inbox chain's `scheduling-needed` path produces showing-time proposals. Attributed to this slug. Proven by re-02. |
| 3 | Compliance Sentinel | rooting | The corpus module (`lib/agents/sentinel/`) is real and loadable, but **nothing invokes it** and the rules carry `literalText` excerpts with no machine-matchable trigger pattern. Wiring a real matcher needs a deterministic rule-matcher design + counsel review (corpus is `DRAFT`). Fabricating a matcher would be a hollow shell — excluded per `feedback_no_quick_fixes.md`. |
| 4 | Listing Coordinator | rooting | No transaction-management integration exists yet (Skyslope/dotloop/Brokermint are on the integration shortlist, not built). No runtime work to attribute. |
| 5 | CRM Hygiene | rooting | No CRM integration is wired into the loop (FUB/kvCORE/etc. are stubbed-json in `SKILL_CATALOG`, not live). Dedupe/normalize has no data source today. |
| 6 | Production Reporter | rooting | Needs an MLS feed; none connected. |
| 7 | Recruiter Assistant | rooting | Depends on the Production Reporter's data; rooting alongside it. |

### Why not force 7/7 *live*

Three of the catalog skills (`lead-triage-realestate`, `invoice-chasing-
realestate`, `month-end-close-cpa`) are runnable in isolation but are **not
wired into the live webhook loop** — only `runSkillChain` runs in production.
Binding the four data-less agents to fabricated skills would manufacture hollow
shells that show fake activity — the opposite of "Intelligence rooted in
reality." The honest, demo-safe outcome is: the two agents the loop genuinely
powers show **real** counts; the other five say plainly what they're waiting on.

## Proof to run

```
# unit (no DB): asserts the 7/7 binding + attribution invariants
npx tsx --test tests/realty-fleet-binding.test.ts tests/skills-persist-artifacts.test.ts

# live, in-product (needs a dev DB):
AUTH_PROVIDER=test BRIEFINGS_PROVIDER=test LLM_PROVIDER=test \
  npx tsx scripts/seed-loop-demo.ts
# → open the printed /agents URL: Buyer Inquiry Router shows 2 handoffs,
#   Showing Scheduler shows 1; the other five show their rooting note.
```
