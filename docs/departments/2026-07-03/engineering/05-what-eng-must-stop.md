# What engineering stops — named workstreams, frozen or killed

The kill list is ratified; this doc converts it into engineering's freeze board. "Frozen" = no engineering cycles, branch stays, revisit trigger named. "Killed" = close the branch / delete the seam after harvest. Anything not listed and not in the executive plan is frozen by default (kill #7: the test for any build is *top-20 table or the five profitability gates* — otherwise it waits).

## Frozen — in-flight branches that stop taking cycles

1. **`origin/loop/expansion-multi-track-2026-07-03` — the 9-track loop.** The direction check's verdict is explicit: strategy right, activity mix wrong; STOP the loop (freeze dormant) until "profitable" is ratified and one backlog card ships end-to-end. Loop v3's no-stop-condition mandate governs the *design*, not this branch's activation. Engineering does not build loop plumbing this fortnight. **Revisit:** the ~Jul-08 delta check, with at least one top-5 fix merged as the entry fee.
2. **`origin/cv/x2-proof-loop` + `origin/cv/x3-activation-loop`.** Whatever these carry gets one harvest pass (anything that is literally a top-20 fix gets cherry-picked into the fix wave); the loops themselves don't run. Kill #1: no new analysis loops until rows 9–14 are burned down.
3. **`origin/feature/customer-journey-loop-2026-07-02` post-#347 follow-ons.** v2 is superseded by v3, which is itself frozen dormant per (1). No L3-conductor or seed-map extensions.
4. **Client portal beyond the safety net** (kill #4). The L-effort "make it real" wave — trust-chain P0s, activation UI, upload durability — does not get built. Fix #2 gates it off; that is the entire spend. **Revisit:** first signed partner needing client document exchange.
5. **Voice/Twilio expansion** (`lib/voice/`, PR #304 layer). Env-gated, stays env-gated. No new call flows. **Revisit:** a paying customer asks.
6. **Mobile app / EAS push** (PRs #162/#167). Blocked on infra anyway; now also frozen by kill #7. **Revisit:** post-first-revenue.
7. **BYO storage completion + memory-tiering activation** (PR #298 substrate). Substrate stays; no credential UI, no tiering callers this fortnight (and audit 10's ship-order hazard stands: cold-read path before waking the tiering sweep). Fix #4 makes the marketing honest instead.
8. **New MCP connectors** (`wt-new-mcps` worktree and kin). Kill #7 allows only the RE activation path + the CPA truth fix. TaxDome/Karbon stay coming-soon — build nothing behind them (kill #2).
9. **flatsbo, all engineering except the row-1 API lock.** Stay-live is Conner's call; agentplain-is-THE-priority is locked. The 12-loop flatsbo audit synthesis stays parked; no funnel/search/email work. **Revisit:** license + counsel milestones (standing rule).

## Killed — engineering habits, not branches

10. **Shipping LLM-dependent features against the paused key** (kill #5). Queue-blocked at wave-brief level: any feature whose acceptance requires a live key is rejected at dispatch, not discovered at review. This survives the un-pause — the key returning enables *demos and customer value*, not a new feature front.
11. **New audit / retro / deep-dive waves** (kill #1). Engineering provides zero support sessions — no worktrees, no plumbing help, no review cycles — for new analysis until the fix table moves. The weekly kaizen loop continues **as fix-tracking only**.
12. **Merge-day batching.** Eleven PRs created in one day, sitting; heal passes per batch. Replaced by the merge train (24h rule, smallest-first, open-PR cap). The 2026-06-19-style 12-PR landing day should never recur.
13. **Root-level one-off scripts as process** (`.get-token.mjs`, `.mk-pr.mjs`, `pr-sweep.mjs`, `.mk-junction-*.mjs`, …). Tolerated until `fleet-ship.mjs`/`wt.mjs` land (days 10–14), then the hygiene sweep deletes them and new one-offs are a review flag.
14. **"Landed" claims without read-back.** No status doc, memory entry, or PR body may assert a fix is live without citing `origin/main`. This killed us twice (flatsbo ghost merges; June findings re-confirmed in July).
15. **Unlabeled duplicate dispatches.** Two sessions on the same deliverable is a bakeoff (named judge, stated in brief) or a bug — never a silent default.

## Kept — for contrast, so nobody over-rotates

The e2e nightly, schema-drift and dispatch-coverage gates, the weekly kaizen fix-tracking read, the send-path/CRM-lite surface behind Monday's lever, and the Sentinel compliance corpus for RE. Freezing is scoped to *new* surface and analysis; the safety nets and the sales path get more investment, not less.
