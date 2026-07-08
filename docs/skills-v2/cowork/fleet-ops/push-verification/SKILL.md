---
name: push-verification
description: Externally verify every remote-mutating git operation (push, force-push, PR open, tag, delete-ref) before reporting it done. Use whenever a session claims "pushed" or "PR opened," and bake the verification block into every code-task prompt. Exit 0 is not evidence; a subagent's report is a claim, not a verification.
---

# Push verification — no "pushed" without external evidence

A `git push` that exits 0 can still have failed (silent 403 from token scope; a wrapper that swallowed the error). The remote is the only truth.

## The checks

```bash
# Branch push:  200, not 404
curl -sI https://github.com/<owner>/<repo>/tree/<branch> | head -1
# Force-push:   URL check + the remote SHA matches local HEAD
git ls-remote origin <branch>        # compare to git rev-parse HEAD
# PR open:      200 on the PR URL
curl -sI https://github.com/<owner>/<repo>/pull/<N> | head -1
# Delete-ref:   the branch URL now 404s (inverse)
```

The curl output goes in the report **verbatim**, not paraphrased. If verification fails: do NOT report success — report the HTTP code, the ref state, and the fallback commands a human can run.

## Prompt block (paste into every code-task that pushes)

```md
## Required completion verification
Before reporting any push/PR as complete: curl -sI the GitHub URL, confirm HTTP 200
(ls-remote SHA match for force-pushes), and include the output verbatim in your report.
If it fails, report the failure mode — never success.
```

## Rules

- **Exit 0 ≠ accepted.** The 2026-05-14 incident: a PAT lacking `Contents: write` produced a silent 403; the task reported two branches "pushed"; GitHub returned 404 on both. Two-layer fix: token scope (once) + this rule (forever).
- **Subagent reports are claims-to-verify, not verifications.** The orchestrator re-verifies before relaying "done" to the user (`feedback_no_guesses_no_estimates`).
- **Push is not done until the remote SHA matches local HEAD** — the fleet-architecture push recipe re-reads the remote ref after every push (`docs/fleet-architecture.md`).
- **`merged=true` proves nothing about main** for stacked PRs — verify content with `git ls-tree origin/main -- <file>`; see [[stacked-pr-discipline]] and [[wait-gate-on-outcome]].
- On 404: check auth before concluding absence — private repos 404 to unauthenticated calls (see [[fleet-token-push]]).

## Example invocation

> **Input:** "The subagent says PR #371 is open — tell Conner."
>
> **Output shape:** `curl -sI .../pull/371` → `HTTP/2 200` → relay with the full clickable URL (`feedback_always_link_prs`: Conner merges from mobile; a bare number is a dead end). On 404: don't relay; diagnose token scope/expiry first.

## Compose with

[[fleet-token-push]] (what to re-mint on 403) · [[curl-per-pr-merge]] (the PR calls being verified) · [[report-back]] (where the evidence lands) · [[wait-gate-on-outcome]] (the general form)

## Origin

`feedback_push_verification_required` (ratified 2026-05-14 after branches `1da755e`/`5aa8aa0` were falsely reported pushed). Re-read-remote-ref rule: `docs/fleet-architecture.md` §push mechanics.
