---
pr-branch: <branch this review covers>
reviewed-commit: <full or short SHA of the commit you actually read — must be a commit on THIS branch>
reviewer: <your session identity, e.g. "Fable review session, 2026-08-01, no shared context with builder">
date: <yyyy-mm-dd>
verdict: <pass | pass-with-notes | fail>
---

# Independent architectural review — <branch>

Copy this file to `docs/reviews/<yyyy-mm-dd>-<branch-slug>.md`, fill every
section, and commit it to the branch. `tools/review/fable-review-gate.mjs`
checks the frontmatter, the freshness of `reviewed-commit`, and the presence of
every heading below.

**No section may be deleted.** If a section genuinely does not apply to this PR,
keep the heading and write one sentence: "checked, not applicable because X".
Absence is never allowed; a stated non-applicability is.

## Independence

You must be a different session from the one that built this change, working
from the diff and the code — not from the builder's summary of them. State what
context you did not share.

- [ ] I did not build this change and did not participate in the session that did.
- [ ] Context I did NOT share with the builder: <list — e.g. their plan, their intermediate reasoning, their validation report's conclusions>
- [ ] What I read to form this review: <diff, files, tests, docs — name them>

## Claim–code trace

Every load-bearing claim in the PR description, the commit messages, and any
validation report gets traced to `file:line` or a named test. Hunt specifically
for coverage claims — "X covers this for free", "already handled by Y",
"the existing cron picks it up". That exact claim class is what created this
gate: a report asserted crons covered new models, and the models were
unreachable.

| Claim (quote it) | Where it appears | Evidence (file:line or test name) | Holds? |
| --- | --- | --- | --- |
| | | | |

- [ ] Every "already handled by Y" claim was verified by opening Y and confirming the new thing is enumerated there.
- [ ] Any claim I could not verify is listed in the Verdict as a note or a fail.

## Tenancy & isolation

Every new or modified query and write on a multi-tenant model must be
`workspaceId`-scoped. Look for the read path as well as the write path — a
correctly scoped write with an unscoped read still leaks.

- [ ] Every new/modified query on a multi-tenant model is workspaceId-scoped (paste the file:line list).
- [ ] No path where one workspace's data can reach another (including caches, aggregates, exports, logs, and error messages).
- [ ] New API routes and server actions derive the workspace from the session, never from client-supplied input.

## Deletion & retention completeness

Any new model, table, column holding customer content, storage bucket, or cache
must be reachable by the deletion and retention machinery. Naming the mechanism
is not evidence — cite the code path.

- [ ] New persisted things introduced by this PR: <list, or "none">
- [ ] For each: the exact purge/retention code path that covers it, as `file:line`.
- [ ] If the answer is "a cron covers it", name the cron AND the line where the new model is enumerated. If the cron iterates a hardcoded list, the new model must appear in that list.
- [ ] Retention windows for the new data are stated and enforced somewhere concrete.

## Outbound invariant

Ratified: agents draft, the customer's own system sends. A new direct-send path
is an architectural break, not a feature.

- [ ] No new path where an agent sends outward directly (email, SMS, voice, webhook, third-party write).
- [ ] Anything that looks like sending is a draft, a queue entry, or an approval request — cite `file:line`.

## LLM seam invariants

- [ ] Provider compose order `Logging(Budget(Sentinel(Caching(Anthropic))))` is preserved — cite where composition happens.
- [ ] Budget seam keeps NO_CAP-when-unset semantics; no new path bypasses the budget wrapper.
- [ ] Every new skill caller is wired through the fire-gate (a skill invoked outside it is invisible to both budget and compliance).
- [ ] No new direct provider client constructed outside the seam.

## Customer-surface invariants

- [ ] No model or vendor name reaches a customer surface (the only ratified exception is the subprocessor list on /privacy and /security).
- [ ] Customer vocabulary, not engineer labels: "Setting up" / "Working" / "Watching".
- [ ] Ratified three-tier pricing (Regular / Partner / Max, plus Custom) is untouched, and no banned pricing language appears.
- [ ] Brand is locked: no rename, repositioning, or new tagline smuggled into a feature PR.

## Migration safety

- [ ] Destructive operations in this PR: <list DROP/ALTER/backfill/data-rewrite, or "none">
- [ ] Each destructive operation is called out explicitly, with what is lost and whether it is recoverable.
- [ ] Raw-SQL indexes carry the matching drift-baseline entry (otherwise the schema-drift gate will fail after merge, or worse, be baselined around).
- [ ] The migration is safe to run against production data volume, not just an empty dev DB.

## Cold-start safety

Agents can be restarted between fires. Correctness may not depend on anything
held in memory from a previous run.

- [ ] Every new agent or handler reads its durable state on each fire.
- [ ] No new correctness dependency on in-memory continuity, module-level caches, or ordering between fires.
- [ ] Retries and duplicate fires are safe (idempotent) for anything this PR adds.

## Test blind spots

This section may never be empty and may never be "N/A". The whole point of this
review is what the suite structurally cannot see.

- [ ] What the test suite structurally cannot see about this change: <be specific — e.g. "tests assert the purge function deletes what it is handed; nothing asserts the enumeration list is complete">
- [ ] What I checked manually instead, and how: <name the files read, the paths traced, the invariants re-derived>
- [ ] Tests that would have caught the risk if they existed: <describe them; propose them as follow-up if warranted>

## Verdict

`pass` — no findings, or only cosmetic ones.
`pass-with-notes` — mergeable, with the listed notes tracked as follow-ups.
`fail` — do not merge; the findings are load-bearing. (`fail` blocks the gate.)

**Verdict:** <pass | pass-with-notes | fail>

**Reasoning:** <two or three sentences, grounded in what you traced>

**Notes (required for pass-with-notes):**
1. <note — what, where, why it is acceptable to defer>
