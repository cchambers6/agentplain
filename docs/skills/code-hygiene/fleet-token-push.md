# Fleet-token push flow

**Domain:** code-hygiene · **Kind:** runbook (ready-to-run) · **Seeded by:** the fleet push/PR mechanism used on every fleet PR from June–July 2026 (e.g. PR #295–#306, #344–#369).

## What it is

Fleet sessions run headless as the `agentplain-fleet[bot]` identity. There is no interactive `git push` credential prompt and `gh` is not authenticated. Pushes and PRs go through a **git credential helper that mints a short-lived token**, plus the **GitHub REST API** for the PR (see [`curl-per-pr-merge.md`](./curl-per-pr-merge.md)). This file is the push half.

> Truth-Wave note: earlier plans referred to a `scripts/mint-fleet-token.mjs`. That file does **not** exist. The real, committed primitive is `scripts/git/agentplain-fleet-credential-helper.ts`, wrapped by the root-level `.get-token.mjs` helper. Cite the real path.

## When to use — trigger phrases

- "push the branch as the fleet bot"
- "I don't have a git credential prompt / gh isn't logged in"
- "mint a token to push"
- any headless/scheduled session that needs to write to `github.com/cchambers6/agentplain`

## The committed primitives

- `scripts/git/agentplain-fleet-credential-helper.ts` — a git credential helper (`get`/`store`/`erase`). Speaks the git credential protocol on stdin/stdout.
- `scripts/git/setup-fleet-credential-helper.{sh,ps1}` — registers the helper with `git config`.
- `.get-token.mjs` (repo root, local tooling) — thin wrapper that runs the helper's `get` verb and writes the resulting token to a file (never stdout). Usage: `node .get-token.mjs <output-file>`.

## Procedure

### Option A — let git use the credential helper directly (preferred)

Once `setup-fleet-credential-helper` has run, git resolves credentials on its own:

```bash
git -C C:/agentplain-wt-<name> push -u origin <branch> --force-with-lease
```

`--force-with-lease` (never bare `--force`) so a concurrent fleet push is not clobbered.

### Option B — mint a token to a file, push with an ephemeral URL

When the helper is not wired into the worktree's git config (common in a fresh `--detach` worktree):

```bash
# 1. Mint token to a temp file (0600, never echoed to stdout)
node C:/agentplain/.get-token.mjs C:/Users/<you>/AppData/Local/Temp/ap-token.txt

# 2. Push using the x-access-token URL form (token read from file, not interpolated into history)
TOKEN=$(cat C:/Users/<you>/AppData/Local/Temp/ap-token.txt)
git -C C:/agentplain-wt-<name> push \
  "https://x-access-token:${TOKEN}@github.com/cchambers6/agentplain.git" \
  <branch>:<branch> --force-with-lease

# 3. Shred the token file
rm -f C:/Users/<you>/AppData/Local/Temp/ap-token.txt
```

## Guardrails

- **Never** write a token to stdout, a commit, a PR body, or a log line. `.get-token.mjs` writes to a `0600` file by design — keep it that way.
- **Never** `git push --force`; always `--force-with-lease`.
- The credential helper wants a `node_modules` on `cwd` to resolve `tsx`. In a worktree, junction `node_modules` from the primary checkout first (see [`../fleet-ops` isolated-worktree skill] / `patterns/isolated-worktree.md`). Memory: *".get-token.mjs needs node_modules cwd"* and *"node --import tsx"*.
- The credential helper path is hardcoded to `C:/agentplain/scripts/git/...` inside `.get-token.mjs`. Run from a machine where the primary checkout lives at `C:/agentplain`, or edit the path.
- Token is short-lived — mint fresh per push wave; do not cache across sessions.
- On Windows, the bash-vs-node `/tmp` trap: Node's `os.tmpdir()` and bash `/tmp` are **different** locations. Pass an explicit absolute Windows path to `.get-token.mjs`, don't rely on `/tmp`.

## Worked example

Overnight fix wave (PR #369, 2026-07-04) pushed four RE-path fixes from an isolated worktree:

```bash
git worktree add C:/agentplain-wt-overnight --detach origin/main
cmd //c "mklink /J C:\agentplain-wt-overnight\node_modules C:\agentplain\node_modules"
git -C C:/agentplain-wt-overnight switch -c fix/overnight-wave-2026-07-04
# ...edits + commit...
node C:/agentplain/.get-token.mjs C:/Users/conne/AppData/Local/Temp/ap.txt
TOKEN=$(cat C:/Users/conne/AppData/Local/Temp/ap.txt)
git -C C:/agentplain-wt-overnight push \
  "https://x-access-token:${TOKEN}@github.com/cchambers6/agentplain.git" \
  fix/overnight-wave-2026-07-04:fix/overnight-wave-2026-07-04 --force-with-lease
rm -f C:/Users/conne/AppData/Local/Temp/ap.txt
```

Then open the PR via REST (see [`curl-per-pr-merge.md`](./curl-per-pr-merge.md)).

## Cleanup order (when done with the worktree)

`rmdir` the junctioned `node_modules` **before** `git worktree remove`, or git will try to delete the primary checkout's real modules through the junction:

```bash
cmd //c "rmdir C:\agentplain-wt-<name>\node_modules"   # remove junction FIRST
git worktree remove C:/agentplain-wt-<name> --force
```
