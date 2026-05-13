# Skills-to-MCP contract

**Status:** SPEC. Pairs with `docs/mcp-first-migration.md` (this is the skill-side detail).
**Ratified rule:** `project_mcp_first_integration_architecture.md` (Conner, 2026-05-12), line 24: *"Skills consume MCP tools, not vendor SDKs."*
**Scope:** What changes inside `lib/skills/` when integrations become MCP servers.

---

## 1. The new contract

Skills get three inputs at run time:

| Input | Type | Source |
|---|---|---|
| **MCP client** | `McpClient` | Constructed once per skill-chain fire, carries auth + workspace scope. |
| **Workspace context** | `{ workspaceId, vertical, integrations }` | Lookup at chain start. `integrations` is the set of MCP servers this workspace has connected. |
| **The user's request** | varies per skill | `WebhookEvent` for Read; `ParsedMessage` for Categorize; etc. (unchanged from today). |

Skills MUST call MCP tools via `mcp.call(server, tool, args)`. They MUST NOT:
- Import vendor SDKs (`googleapis`, `@microsoft/microsoft-graph-client`, etc.).
- Reach directly into `lib/integrations/` for credential decryption.
- Hold any vendor-specific knowledge outside of which MCP server slug to call.

The skill's vendor-agnostic invariant is enforced by:
- **Compile-time:** the `McpClient` interface only knows about `server: string` and `tool: string`. Skills can't import a vendor SDK without TypeScript complaining about an unused import.
- **CI grep:** a test in `tests/skills-no-vendor-imports.test.ts` greps `lib/skills/` for `googleapis`, `@microsoft/microsoft-graph-client`, etc. Failure if any appear. (Today this would already pass except for `lib/skills/gmail-fetcher.ts` which Phase A retires.)

---

## 2. The MCP client surface (target)

```ts
// lib/mcp/types.ts (new)

export interface McpCallContext {
  workspaceId: string;
}

export type McpResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: McpError };

export interface McpError {
  code: McpErrorCode;
  message: string;
  /** JSON-RPC error code from the server (-32700 .. -32603 plus -32000..-32099 reserved). */
  jsonRpcCode?: number;
  /** Vendor / tool-specific error code, when the server surfaces one via `data.code`. */
  toolCode?: string;
  status?: number;
}

export type McpErrorCode =
  | 'PARSE_ERROR'
  | 'INVALID_REQUEST'
  | 'METHOD_NOT_FOUND'
  | 'INVALID_PARAMS'
  | 'INTERNAL_ERROR'
  | 'TRANSPORT_ERROR'
  | 'AUTH'
  | 'NOT_CONNECTED'         // workspace has no connected credential for this server
  | 'UPSTREAM';

export interface McpClient {
  call<T>(server: string, tool: string, args: Record<string, unknown>, ctx: McpCallContext): Promise<McpResult<T>>;
  listTools(server: string, ctx: McpCallContext): Promise<McpResult<ToolDescriptor[]>>;
}
```

`McpResult` mirrors `IntegrationResult` (`lib/integrations/types.ts:23-62`) — same shape, same discriminant, so callers handle failures at the type level without thrown exceptions.

---

## 3. Server discovery — which MCP do I call?

**Q:** The Draft skill needs to create a draft. The webhook event came from Gmail. How does the skill know to call `mcp.call('gmail', 'create_draft', ...)` and not `mcp.call('outlook', ...)`?

**A:** The skill DOES NOT decide. The runner does.

The skill chain's runner (`lib/skills/runner.ts:54-67`) receives a `MessageFetcher` and `DraftPersister` constructed at the top of the chain. Today that's `GmailMessageAdapter` (`lib/skills/gmail-fetcher.ts:46`). Post-migration, the runner instead receives an `McpMessageAdapter` that knows ONE server slug.

Construction site (the webhook-event consumer that triggers the runner):

```ts
// SKETCH — finalized in Phase A PR.
// In the consumer that drains WebhookEvent rows:
const event = await prisma.webhookEvent.findFirst({ where: { processed: false }, include: { subscription: { include: { credential: true } } } });
const provider = event.subscription.credential.provider;   // 'GOOGLE' | 'M365' (existing enum)
const serverSlug = providerToMcpSlug(provider);             // 'gmail' | 'outlook'
const adapter = new McpMessageAdapter({ mcp, server: serverSlug, workspaceId: event.subscription.workspaceId });
const result = await runSkillChain({
  workspace, event,
  fetcher: adapter, persister: adapter,
});
```

The skill itself never inspects which provider. The dispatcher (the consumer) inspects the `WebhookEvent` row to pick the right MCP server, then hands the adapter to the runner.

This preserves the skill-side abstraction (`MessageFetcher`, `DraftPersister`) and matches the locked rule line 26: *"customer X's skills call X's Gmail MCP; customer Y's call Y's"* — the workspaceId in `McpCallContext` is the scoping key, identical to how `app/api/knowledge/mcp/route.ts:119-122` already works.

---

## 4. Before / after for the five PR-C skills

### 4.1 Read skill (`lib/skills/read.ts`)

**Today** (`read.ts:52`):
```ts
const messages = await fetcher.fetchMessagesForEvent(event);
// fetcher is GmailMessageAdapter, which calls gmail.users.history.list +
// gmail.users.messages.get via googleapis SDK (gmail-fetcher.ts:62-100).
```

**Post-migration:**
```ts
const messages = await fetcher.fetchMessagesForEvent(event);
// fetcher is McpMessageAdapter, which internally calls
// mcp.call('gmail', 'list_messages_for_event', { eventId: event.id }, { workspaceId })
// The Gmail MCP server holds the googleapis SDK; the skill never sees it.
```

**Skill source code change:** **zero**. The skill calls `fetcher.fetchMessagesForEvent(event)` either way. The implementation behind the port changes; the port stays.

**Adapter source code change** (`lib/skills/gmail-fetcher.ts:62-100` → `lib/skills/mcp-fetcher.ts:fetchMessagesForEvent`):

```ts
// NEW — lib/skills/mcp-fetcher.ts (sketch)
async fetchMessagesForEvent(event: WebhookEvent): Promise<SkillResult<ParsedMessage[]>> {
  const result = await this.mcp.call<{ messages: ParsedMessage[] }>(
    this.server,             // 'gmail' or 'outlook'
    'list_messages_for_event',
    { eventId: event.id, historyCursor: readHistoryCursor(event) },
    { workspaceId: this.workspaceId },
  );
  if (!result.ok) return skillError('UPSTREAM_MCP_ERROR', `${this.server}.list_messages_for_event: ${result.error.message}`);
  return skillOk(result.value.messages);
}
```

The googleapis-shaped logic (`history.list` + `messages.get` + `parseGmailMessage`) moves INSIDE the Gmail MCP server's `list_messages_for_event` tool handler, where it belongs.

---

### 4.2 Categorize skill (`lib/skills/categorize.ts`)

**Today:** Categorize calls `LlmProvider.complete()` (`categorize.ts:44`). It does NOT call any vendor integration. The LLM provider is its own port (`lib/llm/`).

**Post-migration:** **No change required.** Categorize uses the LLM, not an integration. The LlmProvider port stays as-is.

**(Optional, deferred):** In Phase D when we have a generic "LLM MCP server," LlmProvider could route through MCP. Not in Phase A scope.

---

### 4.3 Coordinate skill (`lib/skills/coordinate.ts`)

**Today** (`coordinate.ts:45`):
```ts
const thread = await fetcher.fetchThreadMessages(threadId);
// fetcher.fetchThreadMessages → gmail.users.threads.get (gmail-fetcher.ts:102-117)
```

**Post-migration:** Same skill code. Adapter routes through `mcp.call('gmail', 'list_thread_messages', { threadId })`.

**Adapter change:**
```ts
async fetchThreadMessages(threadId: string): Promise<SkillResult<ParsedMessage[]>> {
  const result = await this.mcp.call<{ messages: ParsedMessage[] }>(
    this.server,
    'list_thread_messages',
    { threadId },
    { workspaceId: this.workspaceId },
  );
  if (!result.ok) return skillError('UPSTREAM_MCP_ERROR', `${this.server}.list_thread_messages: ${result.error.message}`);
  return skillOk(result.value.messages);
}
```

---

### 4.4 Schedule skill (`lib/skills/schedule.ts`)

**Today:** Schedule consumes the categorize+coordinate output and produces `SchedulingProposal` (`types.ts:177-184`) via the LLM. Does not call an integration.

**Post-migration:** **No change required** for the LLM path. *Caveat:* if Schedule ever needs to query the customer's calendar to find conflict-free slots, that becomes `mcp.call('gmail', 'list_calendar_events', ...)` or `mcp.call('outlook', ...)`. Not in Phase A scope (per `feedback_no_quick_fixes.md` — don't over-spec; today Schedule proposes slots without checking the customer's calendar per the V1 design noted in `types.ts:166-184`).

---

### 4.5 Draft skill (`lib/skills/draft.ts`)

**Today** (`draft.ts:90`):
```ts
const persisted = await persister.persistDraft({ workspaceId, to, subject, body, inReplyToMessageId, threadId });
// persister.persistDraft → gmail.users.drafts.create (gmail-fetcher.ts:119+)
```

**Post-migration:** Same skill code. Adapter routes through MCP.

**Adapter change:**
```ts
async persistDraft(args: { workspaceId: string; to: string; subject: string; body: string; inReplyToMessageId?: string; threadId?: string }): Promise<SkillResult<{ providerDraftId: string }>> {
  const result = await this.mcp.call<{ providerDraftId: string }>(
    this.server,
    'create_draft',
    { to: args.to, subject: args.subject, body: args.body, inReplyToMessageId: args.inReplyToMessageId, threadId: args.threadId },
    { workspaceId: args.workspaceId },
  );
  if (!result.ok) return skillError('UPSTREAM_MCP_ERROR', `${this.server}.create_draft: ${result.error.message}`);
  return skillOk(result.value);
}
```

**Outbound discipline check** (per `project_no_outbound_architecture.md`): the `create_draft` tool exists in the Gmail MCP; `send_message` and `send_draft` do NOT exist. The forbid lives at the MCP server's tool catalog — a skill cannot call a tool that the server doesn't expose. The current Gmail adapter enforces this at the SDK call site (`lib/skills/gmail-fetcher.ts:13-19` — comments + no send call). Post-migration, the enforcement moves to the MCP server's tool list, which is more discoverable and more auditable.

---

## 5. The dispatch table (Phase A scope)

The Phase A Gmail MCP server exposes exactly these tools. The Outlook MCP server in Phase B mirrors this surface.

| Tool | Args | Returns | Replaces |
|---|---|---|---|
| `list_messages_for_event` | `{ eventId: string, historyCursor: string }` | `{ messages: ParsedMessage[] }` | `GmailMessageAdapter.fetchMessagesForEvent` (`gmail-fetcher.ts:62-100`) |
| `list_thread_messages` | `{ threadId: string }` | `{ messages: ParsedMessage[] }` | `GmailMessageAdapter.fetchThreadMessages` (`gmail-fetcher.ts:102-117`) |
| `create_draft` | `{ to, subject, body, inReplyToMessageId?, threadId? }` | `{ providerDraftId: string }` | `GmailMessageAdapter.persistDraft` (`gmail-fetcher.ts:119+`) |
| `subscribe` | `{ credentialId: string, notificationUrl: string }` | `{ providerSubscriptionId, resource, expiresAt }` | `GmailProvider.createSubscription` (`gmail-provider.ts:102-107`) |
| `renew_subscription` | `{ credentialId: string, subscriptionId: string, notificationUrl: string }` | `{ providerSubscriptionId, resource, expiresAt }` | `GmailProvider.renewSubscription` (`gmail-provider.ts:115-121`) |
| `unsubscribe` | `{ credentialId: string, subscriptionId: string }` | `{}` | `GmailProvider.deleteSubscription` (`gmail-provider.ts:128-144`) |
| `refresh_credential` | `{ credentialId: string }` | `{ expiresAt: Date }` | `GoogleOAuth.refreshTokens` (`oauth.ts:170-216`) — called by the renewal cron, not by skills. |

Notable **non-tools** (intentional omissions to enforce `project_no_outbound_architecture.md`):

- `send_message` — forbidden.
- `send_draft` — forbidden.
- `modify_message_labels` for the SENT label — forbidden.
- `delete_message` — out of scope (and per the no-outbound rule, deletion is not agentplain's job).

---

## 6. Two-impl rule applied

Per `feedback_runner_portability.md`, every MCP server ships with both a prod and a test handler.

| Path | Today | Phase A |
|---|---|---|
| Skill-side fetcher port | `MessageFetcher` interface (`lib/skills/types.ts:115-130`) | Same interface. |
| Skill-side fetcher PROD impl | `GmailMessageAdapter` (`lib/skills/gmail-fetcher.ts:46`) | `McpMessageAdapter` (`lib/skills/mcp-fetcher.ts`) backed by `lib/mcp/client.ts`. |
| Skill-side fetcher TEST impl | `FixtureMessageFetcher` (`lib/skills/fixture-fetcher.ts`) | **Unchanged** — still satisfies the `MessageFetcher` interface. CI tests use this; no MCP wire involved. |
| MCP-server PROD handler | (does not exist yet) | `lib/mcp/servers/gmail/handler.ts` (the googleapis-using code lifted from current `lib/integrations/google/`) |
| MCP-server TEST handler | (does not exist yet) | `lib/mcp/servers/gmail/test-handler.ts` (canned fixtures, no network) |
| MCP-server contract test | (does not exist yet) | `tests/mcp/gmail.test.ts` (runs same suite against both handlers) |

Two-impl rule is satisfied at TWO levels: the skill-side port (prod McpMessageAdapter + test FixtureMessageFetcher) AND the MCP-server route (prod handler + test handler).

---

## 7. Migration tactic — keep the runner unchanged

The skill-chain runner (`lib/skills/runner.ts:76`) takes a `MessageFetcher` + `DraftPersister`. Both interfaces are unchanged. The runner doesn't know whether it got `GmailMessageAdapter` or `McpMessageAdapter`. **This means Phase A ships without touching `runner.ts`.**

What ships:
1. New `McpMessageAdapter` implementing both `MessageFetcher` and `DraftPersister`.
2. The webhook-event consumer (the caller of `runSkillChain`) constructs `McpMessageAdapter` instead of `GmailMessageAdapter`.
3. The Gmail MCP server route (`/api/mcp/gmail`) ships with prod + test handlers.
4. The OAuth callback (`app/api/auth/oauth/google/callback/route.ts:155-220`) replaces its inline `provider.createSubscription` call with `mcp.call('gmail', 'subscribe', ...)`.
5. After one successful end-to-end run on real data, `lib/skills/gmail-fetcher.ts` deletes.

**Why this is safe:** the surface skills consume (the `MessageFetcher` and `DraftPersister` ports) doesn't move. We swap the prod adapter; tests keep using the fixture adapter; the runner is untouched. The risk surface is contained to the new MCP route + the new adapter + the OAuth callback's one-line change.

---

## 8. Open contract questions (NOT blocking Phase A)

1. **Tool versioning.** If `create_draft` evolves to support attachments later, do we version (`create_draft.v2`) or extend the schema? Suggest: extend the schema and use JSON Schema's `additionalProperties: true` so older callers keep working. Decide in Phase B when the second MCP server tests the assumption.
2. **Cross-server tools** (e.g. a "draft a reply to this email and post a Slack notification" composite). Phase A doesn't need this. Phase D's third-party MCP exploration likely surfaces the need.
3. **MCP server health checks.** Should the marketplace UI show "Gmail MCP healthy / degraded"? Defer to Phase C UI scoping.

None of these block Phase A.
