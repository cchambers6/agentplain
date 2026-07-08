---
name: fleet-token-push
description: Push a branch from a headless/bot session with no interactive git credential prompt and no authenticated gh. Use when the user says "push as the fleet bot," "gh isn't logged in," "mint a token to push," or when a push/API call starts returning 403/404. Mints a short-lived GitHub App token via the committed credential helper and pushes with a leased force.
---

# Fleet-token push flow

Headless sessions can't answer a credential prompt and `gh` isn't authenticated as the bot. The committed primitive is a git **credential helper** that mints a short-lived GitHub App installation token (`ghs_…`); push with `--force-with-lease` and verify externally.

## The committed primitives (cite these, not ghosts)

- `scripts/git/agentplain-fleet-credential-helper.ts` — speaks the git credential protocol (`get`/`store`/`erase`).
- `.get-token.mjs` (repo root) — wrapper: `node .get-token.mjs <output-file>` runs the helper's `get` verb via `node --import tsx` and writes the token to a `0600` file, **never stdout**.
- **`scripts/mint-fleet-token.mjs` does not exist in this repo.** A same-named minter exists in the flatsbo orchestrator's vocabulary (`feedback_no_secrets_in_chat` references `mint-fleet-token.mjs`), which is why prompts keep citing it here. In agentplain, the real path is the pair above — cite it, don't cite the ghost.

## Procedure

```bash
# A) Helper wired into git config (preferred):
git -C <worktree> push -u origin <branch> --force-with-lease

# B) Mint to a file, push with an ephemeral URL:
node C:/agentplain/.get-token.mjs <abs-windows-path>/token.txt   # helper path is hardcoded to C:/agentplain
TOKEN=$(cat <abs-windows-path>/token.txt)
git -C <worktree> push \
  "https://x-access-token:${TOKEN}@github.com/cchambers6/agentplain.git" \
  <branch>:<branch> --force-with-lease
rm -f <abs-windows-path>/token.txt                               # shred immediately
```

Then verify per [[push-verification]] — a `git push` exit 0 is **not** proof the remote accepted the ref.

## Auth failure modes (diagnose before re-trying)

- **403 on push** → token expired or under-scoped. Mint a **fresh** token (they're short-lived by design; never cache across sessions) and retry. A silent 403 once caused a task to report branches "pushed" that returned 404 — hence [[push-verification]].
- **404 on a private repo API call** → that's *auth*, not *absence*. Unauthenticated curl returns 404 for private repos. Mint a token before concluding "the repo/branch doesn't exist" (`feedback_flatsbo_private_use_fleet_token`).
- **`Authorization: token <TOKEN>`, never `Bearer`** for `ghs_` tokens on REST calls — `Bearer` 401s.

## Rules

- **`--force-with-lease`, never bare `--force`** — protects a concurrent fleet push. From a detached HEAD, bare `--force-with-lease` is rejected ("stale info"); use the explicit form — see [[detached-worktree-rebase]].
- **Token never touches stdout, chat, a commit, a PR body, or a log** — see [[no-secrets-in-chat]]. The `0600` file + shred is the contract.
- The helper needs `node_modules` on cwd (`tsx` resolution) — in a worktree, junction it first per [[isolated-worktree]]. Run from a machine where the primary checkout is `C:/agentplain`, or edit the hardcoded path.
- **Windows `/tmp` trap:** bash `/tmp` ≠ node `os.tmpdir()`. Pass `.get-token.mjs` an explicit absolute Windows path.

## Example invocation

> **Input:** "Push `feature/skills-catalog-fable-upgrade-2026-07-08` from the worktree and open the PR."
>
> **Output shape:** `node C:/agentplain/.get-token.mjs <tmp>/t.txt` → `ok` · push with the `x-access-token` URL → remote prints the new ref · `rm` the token file · `git ls-remote origin <branch>` shows the pushed SHA · PR via [[curl-per-pr-merge]] · report the full PR URL.

## Compose with

[[push-verification]] (mandatory after) · [[curl-per-pr-merge]] (the PR half) · [[isolated-worktree]] (where the push runs from) · [[no-secrets-in-chat]] (token hygiene)

## Origin

Used on every fleet PR June–July 2026 (#295–#306, #344–#369). Helper + wrapper verified on disk 2026-07-08. 403/404 modes: `feedback_push_verification_required` (2026-05-14 silent-403 incident), `feedback_flatsbo_private_use_fleet_token`.
