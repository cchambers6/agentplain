# Blocked items — what is stuck, and on what, exactly

**Rule for this file: an item appears only if the blocker is named and cited. "Feels stuck" is
not blocked; unstarted-but-unblocked work belongs in the fix wave, not here.**

Ordered by revenue-distance: the closer the blocked item sits to the first dollar, the higher
it ranks.

## 1. First design-partner sends — blocked on Conner's calendar + GTM accounts

- **What's blocked:** the entire revenue clock. Sales deep-dive: first paid conversion is a
  day-90–120 event *from the first send date*; every week unsent shifts the whole curve right
  (CEO Pass 1 `01` §3).
- **Blockers (all Conner-only):** (a) no committed 60–90 min weekly send block; (b) GTM
  accounts only he can create — the booking link is literally the unresolved string
  `{{CALENDLY_LINK}}` in the outreach scripts (CEO Pass 1 `00-current-state`, Distribution);
  (c) founder bio / on-record identity unshipped (held for Conner since the SEO/AEO wave,
  PR #286/#289 memory).
- **Not a blocker:** asset readiness — 31 claims-grounded outreach files merged ~2.5 weeks,
  zero sends (kaizen 05-sales).
- **Unblock:** Conner queue item 1 (`03-conner-queue-priority.md`). Fleet clears the send-path
  fixes (Connect button, `/how-it-works`) in the same week per `00-fleet-sequence`.

## 2. Prod ANTHROPIC_API_KEY un-pause — blocked on its own two-condition policy gate

- **What's blocked:** the live AI experience; any real pilot. Degraded mode is the current
  customer experience by policy (`feedback_prod_anthropic_key_paused_is_policy`, 2026-06-14).
- **Blocker:** the gate requires BOTH market-ready AND active prospecting. Neither is met:
  the activation fix wave (market-ready in miniature) is unstarted, and prospecting has never
  started (CEO Pass 1 `00`). The trigger choice (telemetry-now vs first-booked-call) is CEO
  Pass 1 `04` Q3, awaiting Conner.
- **Unblock:** fix wave + first sends satisfy the gate's two halves; pre-verify the cost
  governor this week so the flip is instant (CEO recommendation B).

## 3. Anything signable (design-partner agreement, DPA, engagement-letter buyers) — blocked on entity + counsel

- **What's blocked:** converting a "yes" reply into a signed partner; the CPA/law verticals'
  buyer class; counsel sign-off on the already-published ToS/AUP/Privacy (zero sign-off today,
  kaizen 08-legal).
- **Blocker:** no confirmed legal entity with founder IP assigned; no engaged counsel for
  agentplain (kaizen 08; fleet-memory `conner-queue.yaml` item `legal-entity-ip`, pending
  since June). The counsel handoff packet already exists
  (`docs/launch/legal-risk-prelaunch-review.md`, per CEO Pass 1 `04` Q2) — the packet is not
  the blocker; the engagement is.
- **Unblock:** Conner queue item 3. Becomes item #1 the day a partner asks to sign something
  (CEO Pass 1 `04` Q2).

## 4. CPA go-to-market — blocked three ways, correctly closed

- **Blockers:** (a) policy: closed until 2 RE pilots live (sales deep-dive rule, restated as
  a kill in CEO Pass 1 `03` item 2); (b) product: TaxDome/Karbon advertised but unconnectable
  (audit 5 P0 — kills the CPA pitch at the demo); (c) legal: CPA sentinel un-verified by
  counsel + no entity for engagement-letter-grade buyers (CEO Pass 1 `01` §3).
- **Unblock:** RE pilots + the S-effort connector truth fix (in this week's wave) + item 3
  above. Until then only the cheap protective work (truth fix, QBO books-recon worker) is
  sanctioned.

## 5. 9-track loop (PR #349) — blocked by the direction-check stop ruling and its own missing substrate

- **Blockers:** (a) `profitable_milestone_reached` — the loop's stop condition — is defined
  nowhere on disk (PR #350 `05-what-to-start` Move 3); (b) zero backlog cards have ever
  converted to a merged fix, so the loop→fix pipeline is unvalidated (PR #350 `04` §1);
  (c) the `agentplain-loop-governor` scheduled task was never created — `state.yaml`
  `last_tick_at: null` (PR #350 `04` §1; carried in memory as "governor task STILL
  unscheduled").
- **Unblock:** land #349 dormant now; schedule the governor only when (a) and (b) flip
  (restart condition in PR #350 `04` §1).

## 6. Autofire → merged fixes — blocked on dispatch MCP unreachable

- **What's blocked:** the fleet's ability to convert scored audit-queue items into fired code
  tasks without a human relay. The 2026-06-15 run scored 5 items and fired 0
  (`project_autofire_cannot_fire_dispatch_mcp_disconnected_2026_06_15`).
- **Blocker:** `mcp__dispatch__start_code_task` unreachable — down 17 days as of kaizen
  10-fleet-ops and still unreachable per `WORKING_STATE.md` 2026-07-03 20:36Z ("Dispatch MCP
  still UNREACHABLE → autofire stays in file-bridge fallback").
- **Unblock:** reconnect dispatch in the Cowork environment (named fleet action since
  06-15) or formally adopt the file-bridge as the permanent path and delete the dead one.

## 7. Weekly ROI report cron — blocked on COMPANY_POSTAL_ADDRESS + the Mon/Fri canonical decision

- **Blocker:** CAN-SPAM requires the postal address env before the cron enables
  (fleet-memory `conner-queue.yaml` item `company-postal-address`), and two ROI emails exist
  with no canonical pick (item `weekly-email-dedupe`).
- **Unblock:** one 10-minute Conner sitting; batched as queue item 5.

## 8. Paid media — blocked on its own 4-condition gate, 0 of 4 met

- **Blocker:** the marketing deep-dive's gate (proof asset, measurement, front door fixed,
  plus budget ratification) — 0/4 conditions met per PR #350 `04-what-to-stop` §5. Correctly
  blocked; noted here so no session mistakes it for available capacity.
- **Unblock:** first signed partner + measurement wired (CEO Pass 1 `03` item 6 hold trigger).

---

**Pattern worth naming:** items 1, 3, and 7 are Conner-blocked; items 2, 4, 5, 6, 8 are
blocked on rules or wiring the fleet itself controls. Nothing on this list is blocked on
external parties except counsel (inside item 3) — the company's constraints are almost
entirely self-owned, which is the optimistic read: every blocker here has a named owner and
a named unblock.
