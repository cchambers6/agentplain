# Knowledge substrate

The substrate is the data layer behind every customer-facing agent's non-generic answer. Sits behind `IKnowledgeStore` (pgvector today; Pinecone / Weaviate later by writing a second impl) per `project_living_portable_architecture.md` + `feedback_runner_portability.md`.

Ratified 2026-05-09 as a fleet capability proposal (`project_knowledge_substrate.md`). Built 2026-05-12.

## Why this matters

Without the substrate, every customer-facing agent answers from a fresh prompt — generic, missing context, blind to the customer's specific situation and to fleet learnings. With the substrate, every interaction carries:

1. The fleet's accumulated taste (skill corpus + cross-customer patterns)
2. The customer's specific situation (per-workspace state)
3. Vertical-specific compliance (state + per-industry rules)

— in the same response. This is the differentiator between agentplain and template-driven competitors. It's the operational shape of "Intelligence rooted in reality."

## The five context kinds

| kind             | scope                | workspaceId       | example                                                       |
| ---------------- | -------------------- | ----------------- | ------------------------------------------------------------- |
| `SKILL`          | platform-wide        | NULL              | the read / categorize / coordinate / schedule / draft docs   |
| `CUSTOMER`       | one workspace        | required          | this customer's pipeline notes, prefs, history                |
| `VERTICAL`       | platform-wide        | NULL              | real-estate vs CPA JTBD, ROI, claims, value-loop chunks       |
| `CROSS_CUSTOMER` | platform-wide        | NULL              | anonymized fleet learnings; populated offline                  |
| `COMPLIANCE`     | platform-wide        | NULL              | fair-housing, ECOA, state-by-state advertising rules           |

A Postgres CHECK constraint enforces the workspaceId rule at the database layer; the application layer (store + MCP route) enforces the same rule with friendlier error codes.

## Architecture

```
┌───────────────────────────┐    ┌────────────────────────────────┐
│ Fleet agent (any skill)   │───▶│ MCP route: app/api/knowledge/  │
│                           │    │   mcp/route.ts (JSON-RPC 2.0)  │
└───────────────────────────┘    └──────────────┬─────────────────┘
                                                │ getKnowledgeStore(ctx)
                                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ lib/knowledge/index.ts                                           │
│   - getEmbeddingProvider() → OpenAIEmbeddingProvider | Test...   │
│   - getKnowledgeStore(ctx) → PgvectorKnowledgeStore | TestKnow.. │
└──────────────────────────────────────────────────────────────────┘
                                                │ withRls(ctx, ...)
                                                ▼
┌──────────────────────────────────────────────────────────────────┐
│ Postgres                                                         │
│   • Embedding (vector(1536), ivfflat cosine)                     │
│   • KnowledgeDocument                                            │
│   • RLS: read = workspace OR NULL OR operator                    │
│         write = operator only                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Two implementations per port (the two-impl rule)

| port | production | test |
| --- | --- | --- |
| `IEmbeddingProvider` | `OpenAIEmbeddingProvider` (text-embedding-3-small, 1536 dims) | `TestEmbeddingProvider` (deterministic SHA-256 → unit-norm float[]) |
| `IKnowledgeStore` | `PgvectorKnowledgeStore` (pgvector + RLS) | `TestKnowledgeStore` (in-memory) |

Per `feedback_runner_portability.md` — every port has prod + test impls so the chain stays runnable in environments without OpenAI / Postgres / the production extension.

### Embedding model + dimension

- Default: `text-embedding-3-small` at 1536 dimensions.
- Cost: $0.02 per 1M input tokens (OpenAI pricing page, read 2026-05-12).
- Same dim as the deprecated `text-embedding-ada-002` so a future swap inside the same dim is a storage no-op.
- Override via `OPENAI_EMBEDDING_MODEL`. Dim mismatch between the provider and the column type is detected at write time (`DIMENSION_MISMATCH` error).

### RLS policy

Customer queries read:
- Their own rows (`workspaceId` matches the GUC), AND
- Every non-customer-scoped row (`workspaceId IS NULL` — VERTICAL / COMPLIANCE / CROSS_CUSTOMER / SKILL).

Operator queries read everything. All writes are operator-only at the policy level; the application layer also gates writes by enforcing `CUSTOMER → workspaceId required` and `everything else → workspaceId forbidden`.

The store wraps each method in `withRls(ctx, ...)` from `lib/db/rls.ts`, which sets the three GUCs (`app.user_id`, `app.workspace_id`, `app.is_operator`) inside a transaction. Per `lib/db/rls.ts` engineering note: leaked connections from the pool cannot carry workspace context.

## Adding a new context kind

1. Add the enum value to `prisma/schema.prisma` and to `enum ContextKind` in the migration SQL.
2. Update the RLS policy if the visibility rule differs from "global OR matches workspaceId OR operator". The default policy already handles the standard pattern.
3. Update the application-layer validator in `lib/knowledge/pgvector-store.ts` + `lib/knowledge/test-store.ts` (`validateContextWorkspaceFit`) if the new kind has a workspaceId rule different from CUSTOMER.
4. Add seed material to `lib/knowledge/seed-data.ts` if the kind needs platform-wide content at install time.

## Seeding customer knowledge during onboarding

Customer-scoped knowledge fills in over time as a workspace connects integrations:

```ts
import { getKnowledgeStore } from '@/lib/knowledge';
import { withRls } from '@/lib/db/rls';

// In the onboarding step that finishes Gmail OAuth — write
// workspace-scoped facts the categorize / draft skills will use later.
const store = getKnowledgeStore({ userId, workspaceId, isOperator: false });
await store.upsert({
  contextKind: 'CUSTOMER',
  workspaceId,
  title: 'Customer signature block',
  body: 'Sarah Chen, Acme Realty (Broker)\n404-555-0100\nsarah@acme.com',
  sourceType: 'customer_signature',
  sourceId: `customer-signature:${workspaceId}`,
});
```

Idempotency: `(sourceType, sourceId)` is the natural key. A second upsert with the same pair updates the row in place.

## Querying from a skill

The value-loop skills (categorize, coordinate, draft) consume this layer:

```ts
import { getKnowledgeStore } from '@/lib/knowledge';

// Inside a skill, with the request's RLS context already on hand:
const store = getKnowledgeStore(rlsContext);

// "what are the fair-housing rules a counter-offer reply might violate?"
const hits = await store.search({
  query: counterOfferDraftBody,
  k: 5,
  contextKinds: ['COMPLIANCE'],
  verticalSlug: 'real-estate',
});

if (hits.ok) {
  for (const hit of hits.value) {
    // hit.title, hit.body, hit.sourceUrl, hit.similarity
  }
}
```

The skill never touches pgvector SQL or OpenAI directly — that's the point of the abstraction.

## Running the seed

```bash
# Requires OPENAI_API_KEY for production; otherwise the deterministic
# test embedder is used (still produces 1536-dim vectors; tests can
# round-trip without a paid key).
npx tsx scripts/seed-knowledge.ts
```

Idempotent. Re-run any time the seed corpus in `lib/knowledge/seed-data.ts` changes — rows are updated in place by natural key.

Cost (full re-seed with `text-embedding-3-small`): ~$0.0006.

## MCP route reference

`POST /api/knowledge/mcp` — JSON-RPC 2.0.

Headers:
- `x-agentplain-mcp-key`: shared secret matching `MCP_API_KEY` env. Required.
- `x-agentplain-workspace-id`: optional; scopes the call to one workspace. When unset, runs as operator.

Methods:

```jsonc
// knowledge.search
{
  "jsonrpc": "2.0",
  "method": "knowledge.search",
  "params": {
    "query": "broker-owner coordination work",
    "k": 5,
    "contextKinds": ["VERTICAL", "COMPLIANCE"],
    "verticalSlug": "real-estate"
  },
  "id": 1
}

// knowledge.upsert
{
  "jsonrpc": "2.0",
  "method": "knowledge.upsert",
  "params": {
    "contextKind": "CUSTOMER",
    "title": "Pipeline note",
    "body": "Sarah's counter-offer on 245 Oak St came in at $385K.",
    "sourceType": "pipeline_note",
    "sourceId": "pipeline-note:listing-245-oak-1"
  },
  "id": 2
}

// knowledge.delete
{
  "jsonrpc": "2.0",
  "method": "knowledge.delete",
  "params": { "documentId": "..." },
  "id": 3
}
```

Error codes follow JSON-RPC 2.0:
- `-32700` parse error (request was not valid JSON)
- `-32600` invalid Request (envelope did not match the JSON-RPC schema)
- `-32601` method not found
- `-32602` invalid params
- `-32603` internal error (substrate error surfaces in `data.code`)

HTTP status:
- 200 success
- 400 bad request / invalid params / parse error / dim mismatch
- 401 missing or wrong `x-agentplain-mcp-key`
- 404 method not found
- 429 OpenAI rate-limited
- 503 server not configured (e.g. `MCP_API_KEY` env unset)

## Env vars

| var | required | purpose |
| --- | --- | --- |
| `MCP_API_KEY` | yes for the route | shared secret the MCP route checks against `x-agentplain-mcp-key` |
| `OPENAI_API_KEY` | yes for production embedding | OpenAI bearer token |
| `OPENAI_EMBEDDING_MODEL` | no | overrides `text-embedding-3-small` |
| `KNOWLEDGE_EMBEDDING_PROVIDER` | no | `openai` (default) or `test` |
| `KNOWLEDGE_STORE` | no | `pgvector` (default) or `test` |
| `DATABASE_URL` | yes (existing) | Neon connection — `pgvector` extension required |
| `DATABASE_URL_DIRECT` | yes (existing) | Non-pooled Neon URL for `prisma migrate deploy` |
