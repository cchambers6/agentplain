---
name: no-scope-creep-fix
description: Keep a fix PR to exactly its enumerated items, best fix per item, and explicitly decline out-of-scope work with reasons — the declines are a deliverable. Use for targeted bug-fix waves, "fix this specific thing," and any moment "while you're in there, also…" appears.
---

# No scope-creep on a fix PR

Fix exactly the listed items — each with the *best* fix, not the quickest hack — and record what you deliberately did not do.

## Procedure

1. Fix **only** the enumerated items. Scope-tight ≠ hacky: "no quick fixes" and "no scope creep" are the same discipline pointed at depth and breadth respectively.
2. Anything else you notice: **decline with a reason** and route it — a follow-up task, an INBOX observation ([[librarian-inbox-rollup]]) — never fold it in.
3. Match the surrounding code's idiom (naming, comment density).
4. PR body lists **fixed** and **declined-with-reasons**, both.

## Rules

- **The declines are part of the deliverable.** The reference wave shipped exactly 4 S-effort fixes and declined 5 candidates each with a stated reason — the declined list is what makes "covered everything" a verifiable claim instead of an impression ([[report-back]]).
- **Best fix per item.** If the right fix for a listed item is bigger than expected, do the right fix — don't silently downgrade to a patch (`feedback_no_quick_fixes`: don't lead with the cheap-and-dirty path; if a patch is genuinely right for an emergency, say so and say why).
- **A fix PR that grows a feature is two PRs pretending to be one.**
- **Same-moment work is one PR though:** if two "separate" fixes target the same customer moment, splitting them can smuggle a product decision into a merge — the moment, not the file, is the boundary ([[sequential-landings]]).

## Example invocation

> **Input:** "Overnight: fix these 9 audit items, S-effort only."
>
> **Output shape:** 4 fixed (each the proper fix — e.g. a real root 404 page, not a redirect hack), 5 declined with reasons ("needs the booking-URL decision — blocked on the queue," "M-effort, out of S-scope — spawned follow-up"), PR body carries both lists. (Reference: PR #369.)

## Compose with

[[report-back]] (declines travel in it) · [[docs-only-pr]] (the docs sibling) · [[sequential-landings]] (moment-boundary rule) · [[librarian-inbox-rollup]] (where observations go instead of the diff)

## Origin

Overnight fix wave PR #369 ("4 S-effort RE-path fixes, 5 declined with reasons") · `feedback_no_quick_fixes` · `feedback_user_moment_is_pr_boundary`.
