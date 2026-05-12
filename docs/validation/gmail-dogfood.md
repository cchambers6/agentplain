# Gmail dogfood — sync-correctness subtest procedure

**Scope:** the **sync-correctness** subtest. Per
`feedback_integration_acceptance_is_functional.md`:

> "Sync-diff is now a subtest, not the acceptance test."

The acceptance test is the **functional value loop** (read / categorize /
coordinate / schedule / draft) on Conner's real inbox — that lands in
PR-C. This document covers the subtest: given a recent time window, do
the messages agentplain *thinks it saw* match what the customer's mailbox
*actually contains*? Zero drift = pass.

## Why this exists

Webhook plumbing can silently lose events: a Pub/Sub ACK timeout, a
dropped retry, a `users.history.list` page boundary that swallows
messages with deletion-then-rebirth, a credential that refreshed too
late, etc. We catch all of those before they bite a customer by
cross-checking agentplain's view against a known-good independent
read source.

## The independent read source

The **Cowork Gmail MCP** running in Dispatch (Conner's orchestrator
session) has its own OAuth grant on `connerchambers6@gmail.com`. It
queries Gmail directly via Google's MCP-style adapter — bypassing
agentplain entirely. Whatever the MCP returns for a given window is
ground truth.

## The procedure

### 1. agentplain side — produce a deterministic JSON shape

```sh
npx tsx scripts/validate/gmail-sync-check.ts \
  --workspace conner \
  --since 24h \
  --out /tmp/agentplain-sync.json
```

`--workspace` accepts a slug or UUID. `--since` accepts a relative
window (`1h`, `24h`, `7d`) or an absolute ISO timestamp. `--until`
defaults to now.

The output shape:

```json
{
  "workspaceSlug": "conner",
  "accountEmail": "connerchambers6@gmail.com",
  "windowStart": "2026-05-10T18:00:00.000Z",
  "windowEnd": "2026-05-11T18:00:00.000Z",
  "messageCount": 12,
  "messages": [
    {
      "internalDate": "2026-05-11T13:42:15.000Z",
      "sender": "sender@example.com",
      "subject": "Subject line",
      "threadId": "1856...",
      "labelIds": ["INBOX", "IMPORTANT"],
      "snippetSha256": "b41ad..."
    },
    …
  ]
}
```

Ordering is deterministic — `internalDate` ASC, then `sender`, then
`subject`. Snippet is sha256'd so PII doesn't land in test transcripts.

### 2. Dispatch side — same JSON shape via Cowork Gmail MCP

The orchestrator prompt at `~/.claude/projects/<orchestrator-session>/`
runs the equivalent query via the Cowork Gmail MCP and emits the
identical JSON shape for the same time window. The shape is the
contract — both sides must produce it field-for-field.

Save to `/tmp/cowork-mcp-sync.json`.

### 3. Diff

```sh
diff -u /tmp/agentplain-sync.json /tmp/cowork-mcp-sync.json
```

**Pass:** no diff output. agentplain saw exactly what Cowork-MCP saw.

**Fail:** any diff. The lines tell you which messages are missing or
extra in either source. Common patterns:

- agentplain has fewer messages → events lost between Pub/Sub and the
  WebhookEvent table, or `users.history.list` paging missed a page.
  Open `agent-state/integrations_audit_log.md` and check for renewal
  failures in the same window.
- agentplain has more messages → label or thread filter is too wide;
  PR-C will narrow filtering with categorization in place.
- Subject / sender drift → headers parsed differently on one side;
  almost always an encoding bug.

### 4. Audit row

Append a row to `agent-state/integrations_audit_log.md` with the run
timestamp, message count, diff result. Pass + small drift is acceptable
in PR-B (some legitimate race conditions exist between webhook delivery
and the script's read time); zero drift is the bar for PR-C.

## When to run this

- After every successful PR-B deploy that touches the webhook /
  renewal-cron path, on Conner's `connerchambers6@gmail.com`.
- On a daily cron once PR-C lands — as a regression guard, not as
  acceptance.
- After every PR-C skill update (read / categorize / etc.) to make sure
  the skill didn't break the underlying sync.

## What NOT to do

- Don't trust agentplain's view of the inbox without this check. Per
  `feedback_no_guesses_no_estimates.md`: "every claim cites the artifact."
  The artifact for "we saw this email" is a `WebhookEvent` row plus a
  `users.messages.get` response. Both are in the JSON above.
- Don't extend the JSON shape without updating both sides at once. The
  shape IS the contract; drift = false-pass.
- Don't run this against a customer's inbox until they've signed a
  dogfood agreement. The procedure is fine for Conner's own mailbox
  (he's the workspace owner) but querying another user's mailbox without
  consent is a compliance violation.
