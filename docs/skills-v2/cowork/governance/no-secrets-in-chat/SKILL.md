---
name: no-secrets-in-chat
description: Never echo or propagate a secret (API key, PAT, token, password) through chat, subagent prompts, memory, commits, or logs — even when the user pasted it first. A pasted secret is burned - urge revocation, route the replacement out-of-band, and mint fresh credentials instead of reusing exposed ones. Use the moment a credential-shaped string appears anywhere in a conversation or a report.
---

# No secrets in chat — pasted means burned

Chat transcripts, subagent prompts, and task reports are all logged. Once a secret has appeared in any of them, treat it as compromised regardless of what happens next — the recorded worst case is a leaked PAT that sat **23 days unrevoked** while appearing in the daily queue.

## Procedure (when a secret appears)

1. **Don't echo it back** — not in the reply, not quoted, not "confirming I see key sk-…".
2. **Don't pass it onward** — no subagent prompt, no `send_message`, no memory file, no commit, no PR body, no log line.
3. **Tell the user to revoke + regenerate now.** GitHub's secret scanning may auto-revoke fine-grained PATs in minutes — don't rely on it; push for manual revocation, and give it an SLA lane in the decision queue so it can't age like the 23-day PAT ([[consolidated-decision-queue]]).
4. **Route the replacement out-of-band:** the new value goes from the user's clipboard directly into the env store (Vercel env, Actions secrets, local env file) — never through chat.
5. **Work needing credentials mints its own:** the fleet path is a fresh short-lived App token ([[fleet-token-push]]), independent of any pasted PAT.

## Recognition + tiering

- A 40+ character high-entropy string in a user message is a secret whether or not they name it.
- **Safe to echo:** file paths, env var NAMES (`GH_PAT` the string), PR numbers, branch names, SHAs, workspace IDs. **Never:** values.
- Environment hygiene is the same rule one level up: production-tier secrets exist in Production only — "all 3 envs" is a smell; tier first (`feedback_no_prod_secrets_in_dev`). Rotation for the App key is a PEM file swap, no config change (`docs/git-auth.md`).

## Rules

- **The helper never logs the PEM or the minted token** — tokens live in git's stdin pipe and a `0600` temp file at most; `.get-token.mjs` writes to file, never stdout, by design.
- **Masking is not un-burning.** Even if you'd redact it in the report, it's already in the transcript — the revocation advice stands.
- **This rule survives user reassurance.** "I know, I'll revoke later" → proceed with the work via freshly-minted credentials AND keep the revocation on the queue with a date.

## Example invocation

> **Input:** "Here's my PAT so you have context: ghp_a1b2… — anyway, can you check why pushes fail?"
>
> **Output shape:** reply acknowledges without quoting ("that token should be treated as exposed — revoke and regenerate; put the new one straight into the env store"), diagnosis proceeds via a minted fleet token, revocation lands on the decision queue with a fire date, and no downstream prompt contains the string.

## Compose with

[[fleet-token-push]] (the independent auth path) · [[consolidated-decision-queue]] (revocation SLA) · [[push-verification]] (scope-diagnosis without secret-sharing)

## Origin

`feedback_no_secrets_in_chat` (2026-06-09 PAT paste incident + the safe-to-echo table) · 23-day unrevoked PAT: `docs/kaizen/2026-07-02/MASTER-IMPROVEMENT-PLAN.md` friction-5/action-15 · `feedback_no_prod_secrets_in_dev` · `docs/git-auth.md` security notes.
