# Week-1 Daily Standup Agenda — Mon Jul 6 → Fri Jul 10

What the fleet reports each day, and what "done" looks like by end of day. Format for every report line: the number or the pass/fail, then the blocker if red — no narrative. Truthful counts only; "not instrumented" stated where true.

**Weekend preamble (Sat Jul 4 – Sun Jul 5), reported into Monday's standup:**
merge train #348–#355 landed and read back on main ▸ Day-1 conversion fixes merged ▸ piece 1 gate-clean ▸ collateral pack delivered to Conner ▸ short-form at counsel ▸ three must-fire events wired ▸ Sunday-night verification sweep pass/fail note sent to Conner ▸ demo state verified ▸ governor scheduled + first manual pass verified ▸ [CONNER] booking URL set, 5 prospects in CRM, PAT revoked, branch-protection click.

---

## Monday Jul 6 — send day

**Fleet reports:**
1. Sends: **N of 5** logged at FIRST-TOUCH-SENT (the only number that matters today)
2. Piece 1 live before 8am ET: pass/fail
3. `/security` softening + Day-1 fixes live on production: pass/fail per item
4. Merge-train read-back: which of #348–#355 are ancestors of origin/main
5. Must-fire events: `outbound.sent` rows = send count (first data-integrity check)
6. Reply watch armed (inbox monitoring live, 4-business-hour SLA clock ready)

**Done Monday = 5 sends logged, send-path surfaces live, funnel dashboard reading real rows.** If sends < 5: name what stopped the block — this is the one red that escalates same-day, not Friday.

## Tuesday Jul 7 — decision day

**Fleet reports:**
1. Replies: count + disposition per reply (logged ≤24h); booking replies sent ≤4 business hours: pass/fail per reply
2. [CONNER] un-pause bundle ratified: yes/no — **if no by EOD, this is the standup's headline tomorrow and every day until ratified**
3. Model transition: decision or Option B-plus default fired at 18:00 ET (dated note in state.yaml)
4. Dispatch environment confirmation delivered to Fleet-Ops: pass/fail (governor live or N1-dormant)
5. CS dry-run started; first P0s filed
6. Spend telemetry: `session-costs.yaml` row count (exit test: > 0)

**Done Tuesday = un-pause bundle ratified, model transition executed by decision not silence, governor provably able to fire.**

## Wednesday Jul 8 — truth day

**Fleet reports:**
1. Replies: running count vs the 2+ goal; calls booked: count
2. Piece 2 (BoldTrail / $26,262) live: pass/fail
3. Cap number ratified (Fin-Ops $40/mo + $4/day or Conner's alternative): yes/no → Engineering wiring target confirmed
4. Product P1 decision (ticket-deletion direction) delivered to Legal: yes/no
5. Degraded-at-cap copy delivered to Engineering: yes/no
6. Screenshots (two sets) delivered to Marketing: yes/no
7. Event contract ratified (single registry, C4): yes/no

**Done Wednesday = the three mid-week decisions (cap, P1, event contract) all closed; content cadence on schedule.**

## Thursday Jul 9 — rehearsal day

**Fleet reports:**
1. Replies / calls booked: running counts
2. CS dry-run exit test: **one approved draft, screen-recorded — pass/fail** (the week's second-most-important artifact after the sends)
3. P0s from dry-run: filed count, fixed count, Product priority confirmation
4. One-pager sendable: pass/fail (warm-yes replies now have their artifact)
5. Onboarding-path states verified in customer vocabulary: pass/fail per the three call-killing moments
6. Article surface (3 compare-registry entries): live or fallback executed
7. Handoff sheet template agreed between Sales and CS: yes/no

**Done Thursday = the onboarding hour is rehearsed end-to-end and everything a warm reply triggers exists.**

## Friday Jul 10 — scoreboard day

**Fleet reports (the scoreboard, then the gates):**
1. **Scoreboard #1: sends / replies / discovery calls booked** — three numbers, truthful, "not instrumented" where true. Fleet drafts, Conner reads in 15 minutes
2. Fix-wave scoreboard: which of the week's PRs merged AND read back on main (merged ≠ shipped)
3. Piece 3 (operator story) live: pass/fail
4. Counsel Batch 1 dispositioned (short-form blessed): yes/no — [CONNER] entity ruling due today per C2
5. Cost-governor verification documented (Sales' Jul-10 ask): pass/fail
6. First non-zero ops digest published; three Conner finance inputs: received/blocked
7. Activation events + timestamps queryable; approvals-per-week query ready: pass/fail
8. Week-2 preview: un-pause go/no-go one-pager scheduled Jul 11; Monday block #2 prepped (replies first, then day-5 follow-ups)

**Done Friday = Conner reads three numbers and one 15-minute review sheet, the signature path is counsel-blessed, and the un-pause is one go/no-go read from being a 5-minute act.**

---

## Standing red-flag rules (all five days)

- Any reply older than 4 business hours without a booking response → same-day escalation, not a Friday line.
- Any [CONNER] item past its date → moves to the top of the next standup with its default and fire-date restated (per Fleet-Ops: recommendation + default + date it fires on silence).
- Any security-class item aged 3+ days → ESCALATED block, standalone ping.
- No new work enters the week that is not in the plan-of-record: the freeze list is part of the standup — "what did we NOT start" is a valid report line.
