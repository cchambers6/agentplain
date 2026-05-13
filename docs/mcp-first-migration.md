# MCP-first integration migration

**Status:** SPEC + ROADMAP. This document is the source of truth for sequencing the migration. It does NOT ship code.
**Ratified rule:** `project_mcp_first_integration_architecture.md` (Conner, 2026-05-12).
**Owners:** `agentplain-tech-lead` (integration infrastructure) + `agentplain-knowledge-architect` (MCP shape — the knowledge substrate is the reference impl).
**Scope of this PR:** docs + a capability-inbox proposal. Phase A (Gmail MCP) is the next concrete deliverable.

---

## 1. Why this exists

Conner 2026-05-12: *"I would like our integrations to be as easy as clicking the plug in in Claude."*

The locked rule names a specific architecture: **every customer-facing integration in agentplain is an MCP (Model Context Protocol) server, scoped per-workspace, fronted by a marketplace UI.** Customer clicks Connect → OAuth → done. New integrations = drop in a new MCP server; no per-provider engineering in agentplain core.

This document maps the current code (PR-B Gmail OAuth + Pub/Sub, PR-C skills, knowledge substrate) onto that architecture and sequences the migration.

**Banned framings** (per the locked rule, lines 93-98):
- "We're building 50 OAuth adapters"
- "Per-integration engineering"
- "OAuth complexity is what slows us down"
- "Customers configure webhooks"

---

## 2. Architecture

### 2.1 Layer diagram

```
  ┌───────────────────────────────────────────────────────────────────┐
  │  CUSTOMER (broker-owner)                                          │
  │  app/(app)/workspace/[id]/integrations    ← marketplace UI         │
  │  Click [Connect] → /api/auth/oauth/<provider>/start                │
  └────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │  PLATFORM LAYER  (agentplain core — provider-neutral)             │
  │  ─────────────────────────────────────────────────                │
  │  • OAuth start/callback routes  (per provider — thin)             │
  │  • Encrypt + persist tokens     (lib/security/encryption.ts)      │
  │  • IntegrationCredential / WebhookSubscription / WebhookEvent     │
  │  • MCP marketplace registry     (lib/integrations/marketplace.ts) │
  │  • Webhook ingress              (signature verify + store event)  │
  │  • Renewal cron                 (token + watch refresh)           │
  └────────────────────────────┬──────────────────────────────────────┘
                               │ JSON-RPC 2.0 over HTTPS
                               │ headers: x-agentplain-mcp-key,
                               │          x-agentplain-workspace-id
                               ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │  MCP SERVER LAYER  (one server per integration)                   │
  │  ─────────────────────────────────────────────────                │
  │  /api/mcp/gmail        ← Phase A                                  │
  │  /api/mcp/outlook      ← Phase B                                  │
  │  /api/mcp/follow-up-boss   /api/mcp/zillow   /api/mcp/reso  …     │
  │  /api/knowledge/mcp    ← already MCP-shaped (reference impl)      │
  │                                                                   │
  │  Each server: workspace-scoped credential lookup,                 │
  │               vendor SDK call,                                    │
  │               return JSON-RPC result.                             │
  └────────────────────────────┬──────────────────────────────────────┘
                               │ vendor SDK
                               ▼
  ┌───────────────────────────────────────────────────────────────────┐
  │  VENDOR API   (Google Gmail · Microsoft Graph · FUB · Zillow · …) │
  └───────────────────────────────────────────────────────────────────┘
                               ▲
                               │ webhook callback (Pub/Sub OIDC, etc.)
                               │
  ┌───────────────────────────────────────────────────────────────────┐
  │  /api/webhooks/<provider>  ← stays in PLATFORM (signature verify, │
  │                              writes WebhookEvent, returns 200)    │
  │                              Async consumer fans webhook events   │
  │                              into skill runs that call MCP tools. │
  └───────────────────────────────────────────────────────────────────┘
```

**Call path on a skill fire** (consuming Gmail):

```
WebhookEvent row  →  skill runner  →  MCP client  →  /api/mcp/gmail
                                       (jsonrpc:    →  gmail.list_messages
                                        2.0)        →  return ParsedMessage[]
                                                       (vendor SDK call lives
                                                        inside the route)
```

### 2.2 The MCP-server contract

Every integration MCP server MUST implement this contract:

| Concern | Contract |
|---|---|
| **Transport** | HTTP POST, JSON-RPC 2.0. Matches the existing `app/api/knowledge/mcp/route.ts` shape (`route.ts:31-50`). |
| **Auth** | Header `x-agentplain-mcp-key` matches `MCP_API_KEY` env var (`knowledge/mcp/route.ts:40, 91-100`). |
| **Workspace scoping** | Header `x-agentplain-workspace-id` carries the customer workspace UUID (`knowledge/mcp/route.ts:41, 119-122`). The server uses this to look up the per-workspace `IntegrationCredential` row. |
| **Credential resolution** | Server queries `IntegrationCredential` by `(workspaceId, provider, accountId)` — accountId resolved from request params or the workspace's default account. **Plaintext credentials never leave the request lifecycle** (per `lib/integrations/index.ts:130-147`). |
| **Tool surface** | `list_tools` method returns the tools the server exposes. Each tool has a schema (JSON Schema) for params + returns. |
| **Tool invocation** | `tools/call` method (per MCP spec) with `{ name, arguments }`. |
| **Errors** | JSON-RPC error codes per spec: -32700 parse, -32600 invalid, -32601 method-not-found, -32602 invalid-params, -32603 internal. Vendor-specific errors map to -32603 with `data.code` carrying the typed code (`knowledge/mcp/route.ts:25-28, 240-258`). |
| **Outbound discipline** | Tools NEVER send mail / SMS / calls. Tools propose, list, fetch, draft. Per `project_no_outbound_architecture.md` — drafts.create allowed; messages.send forbidden (`lib/skills/gmail-fetcher.ts:13-19, types.ts:209-217`). |
| **Webhook intake** | MCP servers do NOT receive webhooks directly. The platform-layer route at `/api/webhooks/<provider>` verifies + stores `WebhookEvent` rows; skills consume those rows via the MCP server's `list_events`-style tool. |
| **Two-impl rule** | Per `feedback_runner_portability.md`: every MCP server ships with a prod impl and a test impl. The test impl runs without network (canned fixtures or in-memory state), mirroring `lib/integrations/test-provider.ts`. |
| **Cold-start safe** | Per `feedback_cold_start_safe_agents.md`: server reads durable state on every call. No in-process credential cache that survives between calls. |

**Reference spec:** Model Context Protocol — https://modelcontextprotocol.io/ (Anthropic, ratified 2024; spec stable as of 2026-05). The protocol is JSON-RPC 2.0 over stdio or HTTP. We use HTTP (Next.js route handlers) so the server is multi-tenant by header, matching the knowledge substrate's existing pattern.

### 2.3 Platform responsibilities (stay in agentplain core)

These responsibilities DO NOT move into MCP servers — they live in the platform layer:

| Responsibility | Current location | Stays where it is? |
|---|---|---|
| OAuth start (build authorization URL, set state cookie) | `lib/integrations/google/oauth.ts:94-114` + (start route, TBC) | **Yes** — provider-neutral helpers stay; the per-provider start route is a thin wrapper that builds the authorization URL using config from `marketplace.ts`. |
| OAuth callback (code exchange, encrypt, persist) | `app/api/auth/oauth/google/callback/route.ts:101-153` | **Yes** — the callback is provider-neutral except for the token-exchange method, which lives in `lib/integrations/<provider>/oauth.ts`. |
| Token encryption | `lib/security/encryption.ts` + `lib/integrations/index.ts:114-147` | **Yes** — encryption is a platform invariant. |
| `IntegrationCredential` / `WebhookSubscription` / `WebhookEvent` schema | `prisma/schema.prisma` | **Yes** — these tables back every MCP server. |
| Webhook signature verify + event storage | `app/api/webhooks/google/route.ts:41-78` | **Yes** — keeps Pub/Sub ACK fast. MCP servers consume `WebhookEvent` rows via their own tool. |
| Token-refresh cron / watch-renewal cron | (PR-B foundation) | **Yes** — one cron handles all providers; calls into each MCP server's `refresh` tool. |
| Marketplace registry | NEW: `lib/integrations/marketplace.ts` | NEW — registers each MCP server's slug, OAuth config, scopes, marketplace tile copy. |
| Per-workspace MCP client | NEW: `lib/mcp/client.ts` | NEW — the `mcp.call(server, tool, args)` surface the skills call. |

### 2.4 What moves INTO MCP servers

| Today | Tomorrow |
|---|---|
| `lib/integrations/google/gmail-provider.ts:102-144` (`createSubscription` / `renewSubscription` / `deleteSubscription` / `verifyWebhookSignature` / `parseWebhookPayload`) | Subscribe / unsubscribe become **tools on the Gmail MCP server**. Verify + parse stay on the platform's webhook route — they're invoked from the platform's webhook ingress, not from skills. |
| `lib/integrations/google/oauth.ts` (`exchangeCodeForTokens`, `refreshTokens`, `revokeTokens`) | Stays an internal helper of the Gmail MCP server. The platform's OAuth callback route imports it through the MCP server's `oauth` adapter, NOT directly. |
| `lib/skills/gmail-fetcher.ts` (`GmailMessageAdapter.fetchMessagesForEvent` / `fetchThreadMessages` / `persistDraft`) | Each method becomes an MCP **tool**: `gmail.list_messages_for_event`, `gmail.list_thread_messages`, `gmail.create_draft`. The class itself becomes the prod impl INSIDE `/api/mcp/gmail`. |
| Direct `import { google } from 'googleapis'` in `lib/skills/gmail-fetcher.ts:22` | Only the Gmail MCP server imports googleapis. Skills import `lib/mcp/client.ts` and never touch googleapis. |
| `lib/skills/types.ts:115-130` (`MessageFetcher` port) + `:218-228` (`DraftPersister` port) | Replaced by a thinner MCP-client-backed adapter. The `MessageFetcher` interface stays as the port the skills consume — production implementation now calls MCP tools instead of googleapis. (See `docs/skills-mcp-contract.md` for the before/after.) |

---

## 3. Phase A — Gmail MCP server (next deliverable)

**Acceptance** (per `feedback_integration_acceptance_is_functional.md`): Phase A is done when Conner connects his Gmail through the marketplace UI AND the read → categorize → coordinate → schedule → draft chain runs against his real inbox via MCP. Not when the JSON-RPC route compiles; when the value loop closes.

### 3.1 Files to CREATE

| File | Purpose | Mirrors |
|---|---|---|
| `lib/integrations/marketplace.ts` | Registry: `{ slug, displayName, oauthConfig, scopes, mcpRoute, status }` per MCP server. Single source of truth the marketplace UI and the OAuth start route both read. | NEW pattern — no current analogue. |
| `app/api/mcp/gmail/route.ts` | The Gmail MCP server. JSON-RPC 2.0 endpoint. Tools: `list_messages_for_event`, `list_thread_messages`, `create_draft`, `subscribe`, `unsubscribe`, `refresh_credential`. | `app/api/knowledge/mcp/route.ts` (use as the structural template, including `respond`, `jsonRpcError`, `errorToHttpStatus`). |
| `lib/mcp/client.ts` | The skill-facing client. Exports `mcp.call(server: string, tool: string, args: object, ctx: { workspaceId })`. Uses `MCP_API_KEY` + workspace header. | NEW. |
| `lib/mcp/types.ts` | Shared types: `McpCallContext`, `McpResult<T>`, `McpErrorCode`. Mirrors `lib/integrations/types.ts` result shape. | `lib/integrations/types.ts:23-62` |
| `lib/mcp/test-client.ts` | Test impl that routes calls to in-process fakes per server slug. Enforces two-impl rule at the client level so skill tests don't hit HTTP. | `lib/integrations/test-provider.ts` |
| `lib/mcp/servers/gmail/handler.ts` | The Gmail MCP server's tool handlers — the production GoogleProvider logic relocated. The route at `app/api/mcp/gmail/route.ts` is a thin shell that parses JSON-RPC, dispatches to handlers here. | `lib/integrations/google/gmail-provider.ts` (current contents fold in here). |
| `lib/mcp/servers/gmail/test-handler.ts` | The test impl: in-memory fixtures, no network. | `lib/skills/fixture-fetcher.ts` (extend that pattern). |
| `app/(app)/workspace/[id]/integrations/page.tsx` | Marketplace UI v0 — single tile for Gmail (Phase A). Reads `IntegrationCredential` to render connected/disconnected state. | NEW. (Operator-side `/operator/integrations` exists; this is the customer-facing twin.) |
| `tests/mcp/gmail.test.ts` | Tool-level tests against the test handler. Mirrors `tests/knowledge-substrate.test.ts`. | `tests/knowledge-substrate.test.ts` |
| `tests/mcp/client.test.ts` | Client-level contract test: real client against test handler. | `lib/integrations/__tests__/` pattern. |
| `tests/skills/gmail-mcp-acceptance.test.ts` | End-to-end value-loop test: synthesized webhook event → runSkillChain (with MCP client) → asserts read/categorize/coordinate/schedule/draft results. | Existing skill-chain e2e (extend it). |

### 3.2 Files to MODIFY

| File | Change |
|---|---|
| `lib/skills/gmail-fetcher.ts` | **Deprecated in place.** Keep the class for one transition cycle but mark it `@deprecated`; ship a new `lib/skills/mcp-fetcher.ts` (`McpMessageAdapter`) that implements `MessageFetcher` + `DraftPersister` by calling `mcp.call('gmail', ...)`. The runner is updated to construct the MCP-backed adapter. After one green test run on real Gmail data, delete `gmail-fetcher.ts`. |
| `lib/skills/runner.ts:54-67` | `RunChainArgs.fetcher` + `RunChainArgs.persister` types stay the same (`MessageFetcher` / `DraftPersister`). The construction site in the webhook consumer changes from `new GmailMessageAdapter({ credential })` to `new McpMessageAdapter({ mcp, server: 'gmail', workspaceId })`. The runner does not need to change. |
| `app/api/auth/oauth/google/callback/route.ts:155-220` | The post-OAuth `createSubscription` + `WebhookSubscription` upsert moves to `mcp.call('gmail', 'subscribe', { credentialId })`. The route stays the OAuth callback; the subscribe step now goes through MCP. **Why:** keeps OAuth flow in the platform but the vendor-side `users.watch` call in the MCP server. |
| `app/api/webhooks/google/route.ts:35-78` | No change required for Phase A. The route still uses `getProvider('GOOGLE')` for verify/parse. **Optional optimization in Phase B:** replace `getProvider` with `mcp.call('gmail', 'verify_webhook', { headers, body })` if cleaner; defer that decision to Phase B. |
| `lib/integrations/index.ts:46-101` | `getProvider()` registry shrinks: Gmail-specific paths move out, the registry retains only encryption helpers. Eventually `lib/integrations/google/` deletes; the dir name itself stops making sense once Gmail lives behind MCP. |
| `lib/integrations/google/gmail-provider.ts` | Contents fold into `lib/mcp/servers/gmail/handler.ts`. File deleted at the end of Phase A. |
| `prisma/schema.prisma` | NO migration needed for Phase A. `IntegrationCredential` / `WebhookSubscription` / `WebhookEvent` already carry workspaceId scoping. (Per the locked rule line 41: "models stay.") |

### 3.3 Files to DEPRECATE (delete at end of Phase A)

| File | Replaced by |
|---|---|
| `lib/skills/gmail-fetcher.ts` | `lib/skills/mcp-fetcher.ts` + `lib/mcp/servers/gmail/handler.ts` |
| `lib/integrations/google/gmail-provider.ts` | `lib/mcp/servers/gmail/handler.ts` |
| `lib/integrations/google/oauth.ts` | Moves to `lib/mcp/servers/gmail/oauth.ts` (internal helper to the server; not exported). |
| `lib/integrations/google/webhook-handler.ts` | Moves to `lib/mcp/servers/gmail/webhook.ts` (still imported by the platform's `/api/webhooks/google` route for verify/parse). |

### 3.4 Phase A acceptance test (functional, not protocol)

The Phase A PR is mergeable when ALL of the following are true:

1. Conner clicks Connect on `/app/workspace/<id>/integrations`, OAuth completes, `IntegrationCredential` row exists.
2. A new email arrives in Conner's inbox.
3. `/api/webhooks/google` writes a `WebhookEvent` row.
4. The skill-chain consumer wakes up, calls `mcp.call('gmail', 'list_messages_for_event', { eventId })`, gets back the parsed message.
5. Categorize → Coordinate → Schedule → Draft runs end-to-end. Output JSONL row is written to `agent-state/skill-runs/`.
6. If the chain produces a draft, it appears in Conner's Gmail drafts.
7. Zero `import { google } from 'googleapis'` anywhere in `lib/skills/` (grep proves the boundary held).
8. Two-impl rule: `tests/mcp/gmail.test.ts` (test handler) AND `tests/skills/gmail-mcp-acceptance.test.ts` (production handler against a sandboxed Google Cloud Project) both green.

---

## 4. Phase B — Outlook / Microsoft 365 MCP server

**Acceptance:** Same shape as Phase A, on Outlook. Pattern proven means the third MCP server is a fill-in-the-blanks exercise.

### 4.1 What changes vs Phase A

- New: `lib/mcp/servers/outlook/handler.ts`, `app/api/mcp/outlook/route.ts`, marketplace tile.
- The `MessageFetcher` interface's `name` field (`lib/skills/types.ts:116`) is the dispatch key. The skill runner gets a workspace's connected providers from the marketplace registry and picks the right MCP server.
- Webhook receiver: `/api/webhooks/microsoft` (new). Same shape as Google — signature verify (Graph clientState + tenant), write `WebhookEvent`, return 200.
- `IntegrationProvider` enum in Prisma is already `GOOGLE | M365` (schema model documented in audit). No schema change.

### 4.2 Files to CREATE for Phase B

- `lib/mcp/servers/outlook/handler.ts`
- `lib/mcp/servers/outlook/oauth.ts`
- `lib/mcp/servers/outlook/webhook.ts`
- `lib/mcp/servers/outlook/test-handler.ts`
- `app/api/mcp/outlook/route.ts`
- `app/api/webhooks/microsoft/route.ts`
- `app/api/auth/oauth/microsoft/start/route.ts` + `.../callback/route.ts`
- `tests/mcp/outlook.test.ts`
- `tests/skills/outlook-mcp-acceptance.test.ts`

### 4.3 Phase B acceptance

Same as Phase A, on Outlook. Plus: marketplace UI shows two tiles. A workspace can have either Gmail OR Outlook OR both connected; skills receive the right MCP server for each event.

---

## 5. Phase C — Marketplace UI v1

**Trigger:** Phase A + B both green.

**Acceptance:** A customer can browse a list of available MCP integrations, see status (connected / available / coming-soon), click Connect, complete OAuth, see status flip to connected. The page is functional, not pixel-perfect.

### 5.1 The marketplace registry

`lib/integrations/marketplace.ts` is the single source of truth:

```ts
// SKETCH — finalized in the Phase C PR.
export interface MarketplaceEntry {
  slug: 'gmail' | 'outlook' | 'follow-up-boss' | …;
  displayName: string;
  category: 'email' | 'calendar' | 'crm' | 'lead-gen' | 'mls' | 'transaction' | …;
  status: 'AVAILABLE' | 'COMING_SOON' | 'BETA';
  oauthConfig?: { authorizationUrl: string; scopes: string[]; clientIdEnvVar: string; clientSecretEnvVar: string };
  mcpRoute: string;        // e.g. '/api/mcp/gmail'
  tileCopy: { headline: string; subhead: string; iconKey: string };
}
```

The marketplace UI iterates this list. New integration = add a row + create the MCP route. No UI change required.

### 5.2 UI states (per locked rule lines 22-36)

- **Disconnected** → [Connect] button → OAuth flow.
- **Connecting** → "Authorizing..." while OAuth in flight.
- **Connected** → green checkmark + account email + [Disconnect].
- **Error** → red banner + error code + [Reconnect].
- **Coming soon** → tile visible but greyed; no Connect button.

### 5.3 Files to CREATE for Phase C

- `app/(app)/workspace/[id]/integrations/page.tsx` (upgrade from Phase A v0)
- `app/(app)/workspace/[id]/integrations/[slug]/page.tsx` (per-MCP detail view)
- `components/marketplace/MarketplaceGrid.tsx`
- `components/marketplace/MarketplaceTile.tsx`
- `components/marketplace/ConnectionStatus.tsx`
- `tests/marketplace-ui.test.ts`

### 5.4 Phase C acceptance

A customer (not Conner-as-operator) logged into their workspace can connect Gmail OR Outlook from the marketplace UI, end-to-end, without operator intervention.

---

## 6. Phase D — Third-party MCP servers (sketch)

**When:** after Phase A+B+C prove the pattern; once a community of MCP servers exists (Slack official, Notion, etc.) and we can connect to one we don't build.

**What changes:**

- The marketplace registry gains a `serverOrigin: 'agentplain-built' | 'third-party'` field.
- For third-party servers: agentplain handles OAuth + scoping + credential storage; the MCP URL is configured per server.
- Risk surface: an untrusted MCP server could mis-handle a credential. Mitigation: scope tokens narrowly, audit-log every tool invocation, surface tool list to the customer at Connect time so they consent to the surface area.
- Code paths that change: `lib/mcp/client.ts` learns to call external MCP URLs; the marketplace registry carries the URL; the OAuth callback writes the credential to the third-party server via a one-time `init_credential` MCP method.

**Open questions for Phase D** (NOT resolved in this spec):
- How does agentplain audit/sandbox a third-party MCP server's tool calls?
- What's the schema for the customer-consent step at Connect time?
- Are there third-party MCP servers worth connecting to in the verticals we serve, or do we have to build them?

**No-op for this PR.** Phase D sits in the roadmap as a placeholder.

---

## 7. Phase E — Customer-built MCP servers (sketch)

**When:** post-PMF. This becomes the "custom engagement" upsell path per `project_stripe_both_surfaces.md`.

**What it looks like:**

- A power customer registers a custom MCP server URL pointing at their internal tool (e.g. a proprietary CRM, a custom ERP endpoint).
- agentplain treats it like a third-party MCP (Phase D pattern), with the extra wrinkle that the customer owns it.
- This is the path for the "$5K-$15K + $200-$500/mo Custom engagement" tier — the engagement is "wire your internal system into agentplain via a custom MCP server."

**Open questions for Phase E:**
- Self-serve registration UI or operator-mediated?
- Per-tenant MCP server hosting (we host) vs customer-hosted?
- Multi-tenant tool catalog UX: how do customer-built tools appear in the marketplace alongside generic integrations?

**No-op for this PR.** Phase E sits in the roadmap as a placeholder.

---

## 8. Constraints applied throughout

| Constraint | Source | How it applies |
|---|---|---|
| No quick fixes | `feedback_no_quick_fixes.md` | The migration is sequenced phases A→E, not a single rip-and-replace. Each phase has a value-loop acceptance bar before the next starts. |
| No guesses, no estimates | `feedback_no_guesses_no_estimates.md` | Every claim in this doc cites a file path, the locked rule, or the MCP spec. Time estimates in the capability proposal are tagged `[ESTIMATE]`. |
| Cold-start safe | `feedback_cold_start_safe_agents.md` | MCP servers re-read `IntegrationCredential` on every call. No process-cached credentials. |
| Two-impl rule | `feedback_runner_portability.md` | Every MCP server ships prod + test handler. Tests run against the test handler in CI; acceptance test hits prod handler with a sandboxed account. |
| No silent vendor lock | `feedback_no_silent_vendor_lock.md` | Vendor SDKs live INSIDE the MCP server route (`lib/mcp/servers/<slug>/handler.ts`). Skills must NOT import the vendor SDK. CI grep enforces. |
| No outbound | `project_no_outbound_architecture.md` | MCP tools propose/draft only. `messages.send`, `drafts.send`, `messages.modify(SENT)` are forbidden inside the Gmail MCP. Equivalent rule per provider in each handler. |
| Acceptance = value loop | `feedback_integration_acceptance_is_functional.md` | Each phase's acceptance is the loop running on real customer data, not "the protocol wiring landed." |
| Built by agents | `feedback_agentplain_built_by_agents.md` | Phase A is owned by `agentplain-tech-lead` + `agentplain-knowledge-architect` co-leads; sub-tasks dispatched to backend / frontend specialists per the build pod. |

---

## 9. Reference impl: the knowledge substrate

The knowledge MCP at `app/api/knowledge/mcp/route.ts` is the template. Phase A copies its structure:

- JSON-RPC 2.0 dispatch (`route.ts:90-199`)
- Header-based auth + workspace scoping (`route.ts:91-122`)
- Method namespace per concern (`knowledge.search` / `knowledge.upsert` / `knowledge.delete`)
- Result shape via `respond()` helper (`route.ts:203-219`)
- Error code mapping (`route.ts:240-258`)
- Two-impl: `lib/knowledge/pgvector-store.ts` (prod) + `lib/knowledge/test-store.ts` (test), selected via `getKnowledgeStore(ctx)` (`lib/knowledge/index.ts`)

The Gmail MCP route is `app/api/knowledge/mcp/route.ts` with the methods replaced and the store factory replaced by an MCP-server handler factory.

---

## 10. Open questions for Conner

1. **Marketplace tile order in Phase C.** When 2 tiles (Gmail, Outlook) are live, which is featured top-left? Suggest Gmail as default per pilot-customer profile. *[NO-DECISION-NEEDED for Phase A — surfaces in Phase C scoping.]*
2. **Phase D third-party server allowlist.** Once Phase D starts, who decides which third-party MCPs we surface? Suggest the vertical-head agents (`b2b-head-of-realty`, etc.) recommend per vertical; Conner ratifies in the same cadence as the capability inbox. *[NO-DECISION-NEEDED for Phase A.]*
3. **`lib/integrations/google/` rename.** After Phase A, the `google/` directory name no longer reflects the architecture (the code lives in `lib/mcp/servers/gmail/`). Confirm we delete rather than keep as a shim. Spec assumes delete. *[NO-DECISION-NEEDED for Phase A — surfaces at the end of Phase A.]*
