# What data must stop

A measurement function earns trust by what it refuses to collect and report as much as by what it wires. Five stops, each with the reason and what replaces it.

## 1. Stop reporting $0 fleet spend as if it were a fact

Every weekly kaizen run since the loop shipped has printed `$0/$8670 week-to-date` — a measurement failure wearing a spend fact's clothes (the retro's own words: "Sessions did run in that window. The $0 is a measurement failure, not a spend fact"). Until the stamp+Librarian pair lands, any surface repeating the $0 must carry the DATA MISSING banner or stay silent. **Replaced by:** the wired pipe (day 14), and until then the explicit gap line.

## 2. Stop burning a weekly Opus judgment session on empty inputs

The scheduled kaizen task runs its full gather-and-judge flow even when `dataGaps` says every input is empty — the most expensive component running when it has the least to add, weekly, on schedule. **Replaced by:** the short-circuit the retro already specced (inputs empty → one-line alert "stamp/roll-up broken, skipping judgment"). This is the cheapest recurring saving in the whole data budget and it requires deleting work, not adding it.

## 3. Stop producing analysis loops that generate no new rows

Ratified kill-list item, restated as data policy: no new audit/retro/deep-dive series until the current fix queue lands. Three planning cycles converged on the same conclusion; a fourth analysis of the same backlog adds documents, not data. The 2026-07-08 planning delta check happens as scheduled — it reads the scoreboard, it does not commission new studies. **Replaced by:** the Friday scorecard as the standing source of "how are we doing," at five minutes' cost instead of a session's.

## 4. Stop letting unverified numbers travel between documents

The kaizen retro caught its own brief citing an insight library that doesn't exist and "50+ detectors" where there are 7 — and the audit trail shows briefs inheriting claims from earlier docs without artifact checks. Standing rule for anything this department signs: **a number without a file path, PR link, ledger row, or invoice behind it does not enter a scorecard, a plan, or an outreach email.** The `no guesses, cite the artifact` rule, enforced at the data layer where laundering actually happens. **Replaced by:** citations-or-silence; "not instrumented" is always an acceptable cell value.

## 5. Do-not-collect list (pre-emptive stops, before anyone wires them)

None of these exist today; this list keeps it that way until a decision needs them and the privacy cost is repriced consciously:

- **Session replay / heatmaps / third-party pixels** on any surface — spends the cookieless posture we advertise, feeds no current decision.
- **Open-tracking pixels in founder one-to-one email** — design partners are relationships; instrumenting their inbox reading is the wrong trade. Opens stay "not instrumented."
- **Events on connector payload content** — bucket one of the two-bucket positioning is pass-through; analytics never reaches into it. Events describe the workspace's operational motions, not the customer's business data.
- **Per-individual behavioral profiles** — the unit of analysis is the workspace, full stop.
- **Vanity aggregates** (cumulative sign-ups ever, total pages published, lifetime tokens) — numbers that only go up feed no decision and creep into copy where they become Truth Wave debt.

## The test for any future collection proposal

Three questions, all must pass: (1) which scorecard row reads it, (2) which named decision consumes that row, (3) does it survive the `/privacy` page being updated to disclose it plainly? Anything that fails the third question was going to become a trust problem; anything that fails the first two is storage cost with a dashboard costume.
