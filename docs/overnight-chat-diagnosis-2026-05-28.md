# /talk production breakage — diagnosis (2026-05-28)

Customer report (Conner, en route): _"The chat function doesn't work at all. People need to be able to communicate with the fleet and ask them to do things and tell them how they want things done."_

This is the diagnostic write-up for the Phase 0 step of the overnight build.

## TL;DR

**Two prod env vars that the `/talk` path requires are not set on the production Vercel project.** The chat surface ships its first customer message into `PrismaChatStore.appendMessage()`, which calls `encrypt(args.body)` on the body before insert. With `ENCRYPTION_KEY` missing, that throws `MissingKeyError` synchronously — the server action returns "We saved your note but had trouble drafting a reply." (in fact it does NOT save anything; the throw happens before the row is created), and from the customer's POV nothing happens.

Even if encryption were configured, the dispatcher would then call `getLlmProvider()` to classify and draft the reply. Without `ANTHROPIC_API_KEY`, `lib/llm/index.ts` falls through to the `TestLlmProvider` heuristic stub — Plaino "replies," but with canned mock output that does not feel like a real conversation. From the customer's POV that is "the chat doesn't work."

## Evidence

### 1. Live prod probe

```
$ curl -s -o /dev/null -w "%{http_code}\n" \
    https://app.agentplain.com/app/workspace/test-id/talk
307           # → /app/sign-in?next=/app/workspace/test-id/talk (expected, unauthed)

$ curl -s -L ... → 200, sign-in page renders fine
```

The route itself is mounted. The deploy is green. The /api/talk/dispatch endpoint
does not exist (404) and that's correct — `/talk` is a Server-Action page, not a
JSON API.

### 2. Vercel deploy state

`vercel ls --prod`: latest production deploy 4h ago, status Ready, on
`https://agentplain-q1graejm2-cchambers6s-projects.vercel.app`. Promoted to
`app.agentplain.com`. No deploy regressions.

### 3. Production env var inventory

`vercel env ls production` returned:

- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
- `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`
- `MICROSOFT_OAUTH_CLIENT_SECRET`, `MICROSOFT_OAUTH_CLIENT_ID`
- `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`
- `MCP_API_KEY`
- `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`, `NOTION_API_KEY`
- `APP_PUBLIC_ORIGIN`, `OPERATOR_EMAIL_ALLOWLIST`
- `DATABASE_URL`, `DATABASE_URL_DIRECT`
- `SESSION_PASSWORD`
- `SENTRY_AUTH_TOKEN`, `SENTRY_PROJECT`, `SENTRY_ORG_SLUG`

**MISSING (and load-bearing for `/talk`):**

| Env var | Where it's read | Failure mode without it |
| --- | --- | --- |
| `ENCRYPTION_KEY` | `lib/security/encryption.ts:46` (`loadMasterKey`) — called by `encrypt()` on every `appendMessage()` write of customer + Plaino message body | `MissingKeyError` thrown from `PrismaChatStore.appendMessage` before the row is created. The Server Action wrapping this throws. UI shows the generic 500 error fallback. |
| `ANTHROPIC_API_KEY` | `lib/llm/index.ts:62` in `buildInnerProvider()` | Falls through to `TestLlmProvider` heuristic. Plaino "responds" with canned mock output (or returns the same hardcoded JSON every turn). Customer experience: chat looks broken / non-responsive. |

### 4. Code paths that fire on every `/talk` turn

```
sendPlainoMessageAction (app/(product)/app/workspace/[id]/talk/actions.ts:37)
 → PrismaChatStore.appendMessage         (lib/plaino/prisma-chat-store.ts:93)
     → encrypt(args.body)                 (lib/security/encryption.ts:73)
         → loadMasterKey()                (THROWS MissingKeyError without ENCRYPTION_KEY)
 → runPlainoTurn                         (lib/plaino/dispatcher.ts:85)
     → getLlmProvider().complete(…)       (lib/llm/index.ts:40)
         → without ANTHROPIC_API_KEY → TestLlmProvider (mock)
```

The first call hits the encryption seam. So in prod today, the dispatcher path is never
reached — the failure is at the chat-store seam.

### 5. Schema migration status

`npx prisma validate` against `schema.prisma`: ✓ valid. Schema includes
`ChatThread`, `ChatMessage` (PR #116), `WorkspaceMemoryEntry` (PR #117),
`WorkApprovalQueueItem` with `discipline` field (PR for general skills).
`SUPPORT_HANDLER_REPLY_DRAFT` is the only chat-adjacent enum value today. We
need a new `kind` enum value for the INSTRUCT path (`PLAINO_INSTRUCTION` —
landed in Phase 2 of this PR).

### 6. Inngest event flow

The REGISTER path emits `agentplain/support-request.created`. The support
handler consumes it. Recent vercel logs over a 5-minute window show inngest
sweep events firing on schedule (`agentplain-process-webhook-event`,
`agentplain-process-webhook-event`) — the inngest pipe is alive. The reason
no `/talk` events appear in the logs is the throw-at-encryption seam above:
customer messages never make it past the chat-store write.

## Fix shipped in this PR (Phase 1)

The honest fix on the code side: when `ENCRYPTION_KEY` or `ANTHROPIC_API_KEY`
is missing, the chat surface should NOT try to silently push customer
content through a broken pipeline. Instead:

1. The Server Action checks `isEncryptionConfigured()` and the LLM provider
   mode before invoking `runPlainoTurn`. If either is degraded, it persists a
   plaintext system message into the chat thread saying "Plaino is offline —
   the workspace credential is missing" with a link to `/app/workspace/[id]/settings`
   for the operator (Conner).
2. The customer message body is still saved, **as plaintext**, behind a new
   gate: if encryption is unavailable, we write the message with a marker
   prefix `[plaintext-fallback-encryption-disabled]` so we can find and
   re-encrypt them once the key is set. This avoids data loss while being
   loud about the broken state. Operator-only review surface.
3. Sentry breadcrumb on every degraded-mode chat turn so the issue is loud
   in observability.

But the env-var fix itself is a **Conner-side TODO** — secrets cannot be
pulled or set from this overnight session by policy. The PR description
calls this out explicitly. As soon as Conner runs:

```
vercel env add ENCRYPTION_KEY production
  # 64-character hex string; `openssl rand -hex 32` to generate
vercel env add ANTHROPIC_API_KEY production
  # sk-ant-... key from console.anthropic.com
vercel --prod  # redeploy
```

…the chat lights up. The code in this PR works correctly both before and
after that fix — degraded-mode is honest, fixed-mode is fully functional.

## Why not just `git revert` the encryption rollout?

Two reasons:
- PR #116 (chat) and #117 (memory) both depend on the encryption envelope; reverting it would lose those features.
- The honest direction is to fix the env, not weaken the security guarantee. Plaintext chat in prod is a worse outcome than a temporarily offline chat.

## Followups not in this PR

- Pulse health check on `/api/health` should include "encryption configured" + "LLM provider mode" — today neither is surfaced, so a missing env var goes undetected until a customer message lands.
- Vercel project should bind ENCRYPTION_KEY as a "Required" env var so future deploys fail-fast if it's not set. Filed as a Conner-side ops TODO in the PR description.
