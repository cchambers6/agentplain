---
name: fleet-token-push
description: Push a branch from a headless/bot session with no interactive git credential prompt and no authenticated gh. Use when the user says "push as the fleet bot," "gh isn't logged in," or "mint a token to push." Mints a short-lived token via a git credential helper and pushes with a leased force.
---

# Fleet-token push flow

Headless sessions can't answer a credential prompt and `gh` isn't authenticated. Push through a git **credential helper** that mints a short-lived token, then push with `--force-with-lease`.

## Procedure

**Option A — credential helper wired into git config (preferred):**
```bash
git -C <worktree> push -u origin <branch> --force-with-lease
```

**Option B — mint a token to a file, push with an ephemeral URL:**
```bash
# 1. mint token to a 0600 temp file (never to stdout)
node <repo>/.get-token.mjs <abs-path>/token.txt

# 2. push with the x-access-token URL form
TOKEN=$(cat <abs-path>/token.txt)
git -C <worktree> push \
  "https://x-access-token:${TOKEN}@github.com/<owner>/<repo>.git" \
  <branch>:<branch> --force-with-lease

# 3. shred the token file
rm -f <abs-path>/token.txt
```

`.get-token.mjs` wraps a committed credential helper (`scripts/git/agentplain-fleet-credential-helper.ts`) that speaks the git credential protocol and returns a token on `password=`.

## Rules

- **`--force-with-lease`, never bare `--force`** — protects a concurrent push.
- **Token never touches stdout, a commit, a PR body, or a log.** The helper writes a `0600` file by design.
- The helper needs `node_modules` on cwd (`node --import tsx`) — in a worktree, junction it first (see `isolated-worktree`).
- Windows: node's `os.tmpdir()` ≠ bash `/tmp`. Pass an explicit absolute path to `.get-token.mjs`.
- Mint fresh per push wave; tokens are short-lived, don't cache across sessions.

## Origin

The real fleet push mechanism used on every fleet PR (e.g. PR #369). Note: an aspirational `scripts/mint-fleet-token.mjs` was referenced in early plans but never existed — the real primitive is the credential helper + `.get-token.mjs`.
