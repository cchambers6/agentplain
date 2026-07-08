---
name: no-scope-creep-fix
description: Keep a fix PR to exactly its enumerated items, doing the best fix for each, and explicitly decline out-of-scope work with reasons. Use for targeted bug-fix waves or "fix this specific thing." Resists "while you're in there, also…" — the declines are part of the deliverable.
---

# No scope-creep on a fix PR

Fix exactly the listed items — each with the *best* fix, not the quickest hack — and record what you deliberately did not do.

## Procedure

1. Fix **only** the enumerated items. Best fix per item.
2. For anything else you notice, **decline with a reason** and record it (spawn a follow-up task); don't fold it in.
3. Keep the diff in the surrounding code's idiom (match naming, comment density).
4. PR body lists both what was fixed **and** what was declined and why.

## Rules

- **Best fixes only, not quick fixes** — scope-tight ≠ hacky.
- **Decline explicitly with reasons** — the declines are a deliverable, not an omission.
- **A fix PR that grows a feature is two PRs pretending to be one** — split it.

## Origin

The overnight fix wave (PR #369): shipped exactly four S-effort fixes and **declined five** candidates, each with a stated reason — a textbook scope-disciplined fix PR.
