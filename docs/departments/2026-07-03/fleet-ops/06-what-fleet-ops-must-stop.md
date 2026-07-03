# What fleet-ops must stop

Seven stops. Each names the evidence and what replaces it. The theme: stop producing
process exhaust that a human (or the next agent) has to read around.

1. **Stop creating analysis layers.** No new audits, retros, synthesis docs, or
   planning frameworks — the kill list rules it and the v3 deliverable gate enforces
   it (`drift` verdict). The 2026-07-02 cycle is the evidence base; fleet-ops
   consumes it. This document family is the department's one standing exception, and
   it exists to schedule execution, not to analyze.

2. **Stop letting snapshots accrete.** 264 `WORKING_STATE.md.preXXXX` files plus
   `.bak`s (~435 files) sit in the memory dir, flagged "candidate for a batched
   prune" in the log for days without action (kaizen 10/10 friction #6). Replace
   with: keep the last 10, prune the rest, and make the prune part of the Librarian's
   decay sweep so the pile can't re-form.

3. **Stop leaving spent one-shots scheduled.** `audit-fire-manual-rerun-1pm` and
   `audit-fire-manual-rerun-2-after-seeder` are both explicitly one-shot, both spent,
   both still in `C:\Users\conne\Claude\Scheduled\` with drifted copies of the same
   path corrections — one with a typo'd UUID (friction #10, #9). Replace with: an
   archive step in every one-shot's own prompt ("on completion, move your task dir to
   Scheduled/archive/"), and archive these two now.

4. **Stop full-cadence polling of a quiet fleet.** 185+ consecutive quiet Librarian
   passes at 15-minute cadence over a week-idle repo, each producing only a log line
   saying it produced nothing (friction #8). Replace with: cadence backoff — after N
   consecutive quiet passes, drop to hourly during waking hours; any INBOX append or
   `loop:` commit resets to 15 minutes. Caps stay as the worst-case bound; the point
   is not to spend the cap on silence.

5. **Stop re-listing without escalating.** The same 5 Conner-queue items were
   re-listed verbatim in every brief for ~two weeks while a leaked PAT aged to 23
   days (friction #5). Replaced by the SLA tiers in `01-loop-health-monitoring.md`
   (T1 line → T2 ESCALATED block → T3 standalone ping) and the brief's
   carried-items compression ("carried: N items, oldest X days").

6. **Stop per-wave re-derivation of the push recipe.** Every wave re-reads the token
   memories, re-hits the bash-vs-node /tmp trap or the 401-after-gates window, and
   occasionally strands a pushed branch with no PR. Replaced by the E2 wrapper ask
   (`05-what-i-need-from-other-heads.md`); until it lands, the reconciled recipe from
   `04-memory-rules-audit.md` F3 is the single reference.

7. **Stop re-diagnosing known-red surfaces.** The 41 pre-existing test failures on
   main are documented (send-path wave memory); prod DocuSign gating is confirmed
   (audit 4/10 — "don't re-report"); the P1001→P3009 prod shift has a named fix
   (kaizen 7/10 — migrate resolve, not resume-Neon). Fleet sessions burn real tokens
   rediscovering each of these. Replace with: a short KNOWN-STATE section the
   Librarian maintains in WORKING_STATE that every fired prompt cites — "verify
   against this list before diagnosing."

One meta-stop for this department itself: fleet-ops does not fire product work, pick
verticals, or edit pricing. It keeps the machine running and the record honest;
judgment calls route to the loop's tracks and to Conner.
