# Pattern: no scope-creep on a fix PR

**Group:** code/process · **Seeded by:** the overnight fix wave (PR #369 — "4 S-effort RE-path fixes, 5 declined with reasons"); memory: project_overnight_wave_2026_07_04, feedback_no_quick_fixes.

## When to use — trigger phrases
- "fix this specific bug" / "S-effort fix wave"
- "while you're in there, also…" (the temptation this pattern resists)
- any targeted correction PR

## Inputs
- A scoped defect list (each item: what's wrong, the surface, the effort estimate).

## Procedure
1. Fix **only** the enumerated items. Each fix is the *best* fix for that item, not the quickest hack.
2. For anything you notice but that's out of scope, **decline with a reason** and record it — don't fold it in. (Spawn a follow-up task/chip instead.)
3. Keep the diff readable in the surrounding code's idiom (match comment density, naming).
4. PR body: list what was fixed **and** what was declined and why.

## Output
A tight, reviewable fix PR — plus an explicit list of deferred items so nothing is silently dropped *or* silently expanded.

## Guardrails
- **"Best fixes only," not quick fixes** (memory: feedback_no_quick_fixes) — scope-tight ≠ hacky. Do the right fix for each item.
- **Decline out-of-scope work explicitly with a reason.** PR #369 fixed 4 and *declined 5 with reasons* — the declines are part of the deliverable, not an omission.
- A fix PR that grows a feature is two PRs pretending to be one — split it.
- Compose with `docs-only-pr` when the fix is a copy/doc fix.

## Worked example
The overnight wave (PR #369) shipped exactly four S-effort real-estate-path fixes (root 404 page, security-page founder name, billing card/trial copy, approvals truncation count) and declined five other candidates each with a stated reason — a textbook scope-disciplined fix PR.
