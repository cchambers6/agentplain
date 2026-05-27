# Data privacy + file storage audit — 2026-05-26

Scope: how agentplain stores and protects CUSTOMER files and data, viewed
through the lens of running autonomously for real Atlanta businesses
(emails, files, and data flow through us with no human in the loop).

Methodology: code-cited only. Every claim below points at a file:line. The
grading vocabulary:

- **SOUND** — verified in code, defense holds for the question asked.
- **GAP** — implementation works for the happy path but is missing a piece
  that real-customer hands-off-the-wheel operation requires.
- **RISK** — verified in code, materially unsafe for handling real customer
  data autonomously today.
- **VERIFIED** — I read the code that proves the claim.
- **INFERRED** — derived from package list, migrations, or absence; flagged
  as such.
- **NOT-ASSESSABLE** — depends on Vercel / Neon / OpenAI / Anthropic infra
  posture I cannot inspect from this repo.

I made NO behavior-changing edits. One in-place doc was produced (this
file). Everything else is flagged for follow-up.

---

## TL;DR

- All customer persistence lives in **Postgres (Neon)**. No Vercel Blob,
  no S3-shaped object store. VERIFIED: `package.json` carries no
  `@vercel/blob` dependency (`package.json:21-39`) and grep finds zero
  callers.
- Customer file **bytes are extracted to text in worker memory and
  written to `KnowledgeDocument.body` + `Embedding.vector` in PLAINTEXT**.
  Tenant isolation is robust (CHECK constraint + RLS + FORCE +
  application-level workspace assert). Encryption-at-rest of customer
  content is whatever Neon provides at the disk layer — there is no
  app-level encryption for `KnowledgeDocument.body`.
- Customer file text **leaves our infrastructure** to compute embeddings
  (`api.openai.com/v1/embeddings`, `lib/knowledge/openai-embedding.ts:34`)
  and customer email bodies + retrieved chunks **leave our infrastructure
  as Anthropic prompts** (`lib/llm/anthropic-provider.ts`). This is not
  disclosed on customer surfaces today; FAQ implies the opposite.
- There is **no deletion / retention path** for ingested customer file
  content. Disconnecting Drive removes the OAuth credential row
  (`integrations/.../actions.ts:57`) but leaves every previously-ingested
  `KnowledgeDocument` + `Embedding` row in Postgres indefinitely. There
  is no workspace-teardown / data-purge code path anywhere in the repo.
- Sentry has **no `beforeSend`, no scrubbing**, and several error paths
  embed customer-content fragments in error messages. Combined with
  `reportInngestItemFailure`, those error messages reach Sentry verbatim.

**Hands-off-operation verdict:** NOT SAFE yet. The four MUST-CLOSE items
in §99 are the blockers.

---

## 1. Data-flow map (one screen)

```
 customer's Drive ──[Drive MCP, OAuth]──┐
                                        │
       customer's Gmail/Outlook ────────┤
                                        │ (read-only via Graph / Gmail API,
                                        │  on-demand per webhook fire —
                                        │  bytes never persisted as-is)
                                        ▼
                  ┌──────────────────────────────────────────────┐
                  │  Vercel Node runtime (Inngest cron handlers) │
                  └──────────────────────────────────────────────┘
                          │                                │
                          │ chunk text                     │ email subject+body
                          ▼                                │ + thread summary
            ┌─────────────────────────────┐                │
            │ POST api.openai.com         │                │
            │  /v1/embeddings             │                │
            │  body = chunk text          │ ←── (chunk text leaves infra)
            │ → 1536-dim float vector     │                │
            └──────────────┬──────────────┘                │
                           │                               │
                           ▼                               ▼
   ┌────────────────────────────────────┐  ┌────────────────────────────┐
   │ Postgres / Neon                    │  │ POST api.anthropic.com    │
   │  ─ KnowledgeDocument               │  │  /v1/messages              │
   │     .body   = PLAINTEXT chunk      │  │  system + messages =       │
   │     .title  = file name            │  │  full email body + thread  │
   │     .metadata = {fileId, ...}      │  │  + retrieved chunk bodies  │
   │     workspaceId required for       │  │                            │
   │     CUSTOMER (CHECK + RLS)         │  └─────────────┬──────────────┘
   │  ─ Embedding                       │                │ text response
   │     .vector(1536) = float[]        │                ▼
   │     .workspaceId scoped            │  ┌────────────────────────────┐
   │  ─ WorkApprovalQueueItem.payload   │  │ Postgres / Neon            │
   │     = draft.subject + draft.body   │  │  ─ HandoffLogEntry.payload │
   │     (also plaintext)               │  │     (summary strings —     │
   │  ─ AuditLog.payload                │  │      includes from-email,  │
   │     (skills.loop.completed         │  │      subject excerpts)     │
   │      summary)                      │  │  ─ WebhookEvent.rawPayload │
   │  ─ IntegrationCredential           │  │     (Pub/Sub envelope      │
   │     accessTokenEncrypted (AES-GCM) │  │      only — emailAddress + │
   │     refreshTokenEncrypted (AES-GCM)│  │      historyId — no body)  │
   └────────────────────────────────────┘  └────────────────────────────┘
                  │ (errors)
                  ▼
       Sentry (no beforeSend, no scrubbing)
```

VERIFIED sources:
- `lib/customer-files/drive-source.ts:149-181` — bytes → `Buffer.toString('utf8')`
  → returned as `FileContent.text`.
- `lib/customer-files/ingest.ts:135-160` — text → chunks → `store.upsert({
  contextKind: 'CUSTOMER', workspaceId, ..., body: chunk.text })`.
- `lib/knowledge/pgvector-store.ts:111-205` — writes `body` plaintext into
  `KnowledgeDocument`, vector into `Embedding`.
- `lib/knowledge/openai-embedding.ts:103-114` — POST body carries `input:
  text` to `api.openai.com/v1/embeddings`.
- `lib/skills/draft.ts:140-143` — `INBOUND MESSAGE BODY:` + `message.bodyText`
  joined into the user prompt; `lib/llm/anthropic-provider.ts:90-96` sends
  the prompt to Anthropic.
- `lib/skills/persist-artifacts.ts:266-279` — `WorkApprovalQueueItem.payload`
  stores full `draft.body` + `draft.subject`.

---

## 2. The 7-area audit

### 1. File-storage lifecycle — VERIFIED, mostly SOUND

**What is persisted, where:**

| Artifact | Store | Encrypted at rest (app layer)? |
|---|---|---|
| Raw file bytes | Not persisted. Read into a `Buffer` in worker memory, decoded to utf-8, returned as `FileContent.text` (`drive-source.ts:176-180`). | N/A — bytes are not retained. |
| Extracted text | Lives only inside the `for` loop in `ingestWorkspaceFiles` (`ingest.ts:105-186`); written immediately as chunks. | — |
| Text chunks (the customer's actual file content, in ≤1500-char slices) | Postgres `KnowledgeDocument.body` (TEXT NOT NULL) (`schema.prisma:708`). | **No.** |
| Embedding vectors | Postgres `Embedding.vector` as `vector(1536)` (`schema.prisma:756`). | No — and these are reversible enough on text-embedding-3-small to leak signal; treat as PII-equivalent. |
| File metadata (title, mimeType, sizeBytes, modifiedAt, fileId, sourceUrl) | `KnowledgeDocument.title`, `.sourceUrl`, `.metadata` JSON (`schema.prisma:705-714`). | No. |

The pipeline is `IFileSource → chunkText → IKnowledgeStore.upsert`. The
indirection (`feedback_runner_portability.md`) holds — the Drive adapter
is the only place that knows `googleapis`. **No `@vercel/blob`** in
`package.json:21-39`; grep confirms zero callers. **SOUND**

V1 mimes are text-only (`drive-source.ts:54-60`): `text/plain`,
`text/markdown`, `text/csv`, `text/html`, `application/json`. PDFs / Docs
/ binary blobs are filtered upstream by the Drive `q` clause and
re-checked at fetch (`drive-source.ts:159-166`). **SOUND** for the
files that ARE ingested.

Max-file cap: 5MB (`drive-source.ts:71`). Per-workspace cap: 200 files per
sweep (`drive-source.ts:69`). **SOUND** for V1 sizing.

### 2. Retention + deletion — RISK (no path)

- **Per-file deletion path EXISTS** at the store level: `PgvectorKnowledgeStore.delete`
  (`pgvector-store.ts:316-359`) supports delete-by-embeddingId or
  delete-by-documentId; the FK `ON DELETE CASCADE` from `Embedding ->
  KnowledgeDocument` (`migration.sql:82`) means doc-delete drops embeddings
  too. EXPOSED via `app/api/knowledge/mcp/route.ts:176-187` (`knowledge.delete`
  JSON-RPC method, operator-keyed). **VERIFIED.**
- **No automatic deletion when a Drive file disappears.** The ingestion
  sweep upserts by `${source}:${fileId}:${chunkIndex}`
  (`ingest.ts:148-149`); a deleted Drive file's chunks linger forever. No
  reaper pass exists. **GAP.**
- **No deletion on integration disconnect.** `disconnectIntegrationAction`
  (`app/(product)/app/workspace/[id]/integrations/[integrationId]/actions.ts:24-80`)
  deletes the `IntegrationCredential` row + cascades the
  `WebhookSubscription` rows. It does NOT touch `KnowledgeDocument` or
  `Embedding`. A workspace that ingests 50 Drive docs then disconnects
  Drive keeps 50 plaintext chunks in our Postgres. **RISK.**
- **No workspace-teardown / churn cleanup.** Grep for `workspace.delete`,
  `deleteWorkspace`, `tearDown`, `prune`, `retentionDays` against `lib/`
  and `app/` returns no purge path. The schema has `ON DELETE CASCADE`
  from `KnowledgeDocument.workspaceId` (`migration.sql:51`), so IF the
  `Workspace` row is ever deleted the cascade reaches knowledge — but no
  code deletes a Workspace row. **RISK.**
- **No retention TTL anywhere on `KnowledgeDocument` / `Embedding` /
  `HandoffLogEntry` / `AuditLog` / `WorkApprovalQueueItem` / `WebhookEvent`.**
  Every row that ever existed will still exist. **GAP.**

For real customer data running autonomously, retention is not optional.
This is a MUST-CLOSE.

### 3. Encryption at rest — RISK (only tokens are app-encrypted)

VERIFIED:

- `lib/security/encryption.ts` (AES-256-GCM, v1:iv:tag:ct format,
  `ENCRYPTION_KEY` 32-byte hex) is sound (`encryption.ts:73-93`,
  `encryption.ts:95-133`).
- Grep for `encrypt(`/`decrypt(` in `lib/integrations/**`
  shows the master key is used to encrypt EXACTLY two columns:
  `IntegrationCredential.accessTokenEncrypted` and
  `IntegrationCredential.refreshTokenEncrypted`
  (`lib/integrations/index.ts:142-172`).
- **No other column or path uses the encryption codec.** Customer file
  text (`KnowledgeDocument.body`), email subject/body in
  `WorkApprovalQueueItem.payload` (`persist-artifacts.ts:262-279`),
  handoff summaries (`persist-artifacts.ts:195-228`), and audit-log
  payloads (`process-webhook-event.ts:174-188`) are stored as plaintext
  Postgres values.
- TLS-in-transit to Neon — INFERRED (Neon enforces TLS per
  https://neon.tech/docs/connect/connection-pooling — not verified from
  repo). The Postgres connection string in `DATABASE_URL` typically
  includes `sslmode=require` but I did not grep that.

The codebase's encryption claim — `lib/security/encryption.ts` — is
narrowly scoped to OAuth tokens. The README / FAQ language that says
"your data... encrypted" overgeneralizes (see §7).

### 4. Tenant isolation — VERIFIED, SOUND (load-bearing)

Verified for `KnowledgeDocument` + `Embedding`:

- **CHECK constraint** at the schema layer forces `CUSTOMER` rows to have
  a `workspaceId` and forces non-CUSTOMER rows to NOT have one
  (`migration.sql:70-75`, `migration.sql:109-114`). Belt and suspenders.
- **RLS policies** gate reads on `workspaceId = current_setting('app.workspace_id')`
  or `workspaceId IS NULL` or operator (`migration.sql:128-152`). Writes
  are operator-only at the SQL layer.
- **FORCE ROW LEVEL SECURITY** applied (`20260526000001_force_rls/migration.sql:79-80`).
  This is the load-bearing fix that closes the table-owner bypass —
  without `FORCE`, Neon's `neondb_owner` would skip every policy silently.
- **Application-layer assertion** in `ingest.ts`: comment at
  `ingest.ts:14-15` and pathway through `validateContextWorkspaceFit`
  (`pgvector-store.ts:370-387`) refuses to write a `CUSTOMER` row without
  a `workspaceId`.
- **Triple-check on retrieve.** `retrieveCustomerContext`
  (`retrieve.ts:62-89`) (a) builds an RLS-scoped store, (b) restricts to
  `contextKind=CUSTOMER`, (c) throws on any hit whose `workspaceId` does
  not match the caller. A foreign-workspace row from a future RLS bug
  becomes a loud failure, not a silent leak.

Regression coverage: `tests/wave5-multitenant-isolation.test.ts:1-37`
asserts the app-layer contract, including a grep-driven "no Prisma reads
outside `withRls`" invariant.

**SOUND** — this is the strongest part of the system. The CUSTOMER →
workspaceId binding is enforced at three layers + a grep test.

### 5. Third-party data flow — **THE BIG ONE — RISK + UNDISCLOSED**

Where customer content goes outside our infrastructure today:

#### 5a. OpenAI (embeddings) — VERIFIED

- `lib/knowledge/openai-embedding.ts:103-114`: every ingested chunk body
  AND every retrieval-time query string is POSTed to
  `https://api.openai.com/v1/embeddings` with the chunk/query in `input:
  text`.
- Default model `text-embedding-3-small`, 1536-dim, $0.02/1M tokens
  (`openai-embedding.ts:32-34`).
- **Disclosure status:** I find NO copy on the customer surface
  (`app/(marketing)/**`, `components/FAQ.tsx`) that mentions OpenAI or
  the embedding provider. The closest references are FAQ "Is my data
  safe?" / "Is my data resold or used to train someone else's model?"
  (`components/FAQ.tsx:87-93`), which read like reassurance but never
  name a provider.
- **DPA / training-on-data posture:** INFERRED — per OpenAI's API data
  usage policy (https://openai.com/policies/api-data-usage-policies)
  data sent to the API is NOT used to train models by default. I did
  not verify a signed OpenAI ZDR or BAA from inside this repo; absent
  a contract reference in `docs/` or `env`, the protection is OpenAI's
  default API terms, not an "enterprise" agreement.

#### 5b. Anthropic (LLM completions) — VERIFIED

- `lib/llm/anthropic-provider.ts:25` is the SOLE caller of
  `@anthropic-ai/sdk` (`feedback_no_silent_vendor_lock` invariant).
- Inside the skill chain, the following pass to Anthropic as prompt
  content:
  - Categorize: FROM, TO, CC, SUBJECT, LABELS, SNIPPET, BODY
    (`lib/skills/categorize.ts:73-83`).
  - Draft: FROM, SUBJECT, THREAD CONTEXT (the model's own prior summary),
    PROPOSED MEETING SLOTS, INBOUND MESSAGE BODY
    (`lib/skills/draft.ts:124-143`).
  - Coordinate: per-thread summary lines including `fromEmail` + subject
    (`lib/skills/coordinate.ts:90-102`).
  - Customer context block: retrieved chunk bodies from
    `KnowledgeDocument.body`, inlined verbatim via
    `renderCustomerContextBlock` (`lib/customer-files/render.ts` —
    re-exported through `customer-files/index.ts:31-32`).
- **Disclosure status:** Same as 5a — no provider named on customer
  surfaces.
- **DPA / training-on-data posture:** INFERRED — per Anthropic's
  commercial terms (https://www.anthropic.com/legal/commercial-terms)
  inputs/outputs from the API are NOT used to train models. Again, this
  is Anthropic's default API posture; I did not verify a separate signed
  agreement from this repo.

#### 5c. Sentry — RISK (no scrubbing)

- `sentry.server.config.ts:14-32`, `sentry.client.config.ts:14-32`,
  `sentry.edge.config.ts:11-22` — three init files. **None of them set
  `beforeSend`, none set `sendDefaultPii: true`, none install a
  scrubbing integration, none set `denyUrls`/`ignoreErrors` for PII
  patterns.**
- `sendDefaultPii: false` is the SDK default (Sentry docs: https://docs.sentry.io/platforms/javascript/configuration/options/#senddefaultpii),
  which means IP / cookies / user agents / query strings are NOT
  auto-attached. **Good baseline.**
- BUT the error MESSAGE and stack trace ARE sent verbatim, and several
  error sites embed customer content in the message:
  - `lib/skills/categorize.ts:97` — `\`...— got: ${text.slice(0, 200)}\``
    where `text` is the LLM's categorization response (typically
    contains an excerpt of the sender's subject/body).
  - `lib/skills/draft.ts:160` — same pattern; on a parse failure the
    raw draft response (which IS the email reply body) lands in the
    error message.
  - `lib/skills/runner.ts:186-188` — `console.warn` of
    `customerContextResolver` errors; the err message may include
    pgvector failure detail that echoes input shape.
- Per-item Inngest failures call `reportInngestItemFailure(err, ...)`
  (`lib/inngest/with-error-reporting.ts:68-80`) which forwards the err
  straight to Sentry. Combined with the above, a parse-error from the
  draft skill on a real customer message would put a 200-char excerpt of
  the LLM's draft (i.e. customer reply text) into the Sentry event
  message. **RISK.**

#### 5d. Inngest — VERIFIED, SOUND

- `lib/inngest/client.ts:1-13`. The only Inngest events triggered by app
  code are cron-fired bodies with no payload, plus a single
  `agentplain/customer-files-ingestion-sweep.requested` smoke-test
  event whose payload is empty
  (`customer-files-ingestion-sweep.ts:72-73`). Inngest's cloud does NOT
  carry email payloads or file content — every worker re-reads
  `WebhookEvent` from Postgres on fire. **SOUND.**

#### 5e. Application logs — RISK (per §6)

See §6 for `logger.info("sweep finished", {...})` calls that carry
counts only (clean) versus `console.error('knowledge.mcp uncaught', err)`
(`app/api/knowledge/mcp/route.ts:196`) which dumps err verbatim. On
Vercel, `console.*` lines go to the Vercel logs UI and forward to any
configured log drain.

#### 5f. Other vendors checked and clean

- Resend — magic-link / transactional only; not customer content
  (`lib/auth/resend-provider.ts:64-84`). SOUND.
- Stripe — billing only. SOUND.
- Notion — operator-side briefings only (`lib/notion/notion-provider.ts`).
  Customer email/file content is not routed through it. SOUND.

### 6. PII / logging — VERIFIED, RISK in two spots

Logger is JSON-emitting (`lib/observability/logger.ts:81-142`) with no
auto-redaction. Whatever a caller passes gets emitted. Most callers pass
counts and ids only:

- Cron logs at `customer-files-ingestion-sweep.ts:243-250`,
  `process-webhook-event.ts:282-289`,
  `integration-renewal-sweep.ts:350-356` are counts/ids only. **SOUND.**

Risk spots:

- `lib/skills/runner.ts:434` — `console.warn` on log-write failure
  embeds err message; low risk but unconstrained.
- `app/api/knowledge/mcp/route.ts:196` — `console.error('knowledge.mcp
  uncaught', err)`. The MCP route receives knowledge upserts; an upsert
  failure message could surface the document `body` in a pg error
  string. **RISK.**
- `app/(product)/app/workspace/[id]/approvals/actions.ts:79,151` —
  approval-action `console.warn` paths could include approval payload
  detail. **GAP.**
- Skill-run JSONL log writer: `lib/skills/runner.ts:425-435` appends the
  ENTIRE `SkillRunRecord` (which includes `outcome.draft.body` — the
  full draft text — and per-step summary excerpts) to
  `agent-state/skill-runs/YYYYMMDD.jsonl`. On Vercel serverless the
  worker's `/var/task` filesystem is ephemeral and per-invocation, so in
  production this is effectively a no-op (verified for the absence of
  any persistent disk in the codebase). But it IS active code that
  would persist customer content on any longer-lived runtime (a future
  long-running worker, a container deploy, a local dev session). **GAP.**

No utility module for redaction / scrubbing exists (`grep -r "redact\|sanitize\|scrub" lib`
returns zero hits). For autonomous operation, an explicit redactor at
the observability seam (`lib/observability/logger.ts`,
`lib/observability/sentry-provider.ts`) is the right shape.

### 7. Claims accuracy — RISK (multiple unsupported claims)

Cross-checking customer-facing copy against the implementation:

#### FAQ "Is my data safe?" — `components/FAQ.tsx:87-88`

> "Your data stays in your stack. The fleet pulls what it needs to do a
> task, returns a result, doesn't retain client lists or transaction
> records as training data."

- "Your data stays in your stack" — **FALSE for ingested files.**
  Ingested Drive file text is written into our Postgres
  (`KnowledgeDocument.body`) and shipped to OpenAI for embedding. Email
  body content is shipped to Anthropic. The data does NOT stay in the
  customer's stack.
- "doesn't retain client lists or transaction records" — **MISLEADING.**
  We DO retain `KnowledgeDocument` rows indefinitely (no deletion path,
  §2). "As training data" is a narrower claim; that part is OK by
  default OpenAI / Anthropic API terms (§5).

#### FAQ "Is my data resold or used to train someone else's model?" — `FAQ.tsx:91-92`

> "We don't resell your data. We don't train foundation models on your
> inbox, your client list, your transaction records, or your drafts...
> the underlying provider call runs under enterprise terms that exclude
> training on your content."

- "We don't train foundation models on your content" — **TRUE** for
  agentplain itself (we have no training infra).
- "the underlying provider call runs under enterprise terms" — **NOT
  VERIFIED.** I found no DPA, no MSA reference, no "enterprise terms"
  surface in the codebase. Default OpenAI / Anthropic API terms do
  exclude training-on-API-content, so the substance is correct, but the
  word "enterprise terms" implies a contracted relationship we don't
  have evidence for. **MISLEADING.**

#### FAQ "What happens if I cancel?" — `FAQ.tsx:99-100`

> "You can export your workspace data... We don't retain operational
> copies of your data once your workspace closes..."

- "You can export" — **NO EXPORT PATH EXISTS** in the codebase
  (`grep -rn "export.*workspace\|exportData\|data export"` returns no
  product surface). **FALSE.**
- "We don't retain operational copies once your workspace closes" —
  **FALSE.** There is no workspace-closing flow; even if one were added
  today, no code deletes `KnowledgeDocument`, `Embedding`, `AuditLog`,
  `HandoffLogEntry`, `WorkApprovalQueueItem`, or `WebhookEvent` rows.
  **The claim is the opposite of what the code does.**

#### Operator integrations page — `app/(operator)/operator/integrations/page.tsx:86`

> "stored encrypted; Pub/Sub subscription created"

This is operator-facing copy about OAuth tokens specifically. **TRUE**
in context (`IntegrationCredential.accessTokenEncrypted` /
`refreshTokenEncrypted` are AES-256-GCM). No fix needed; flagged for
context.

#### `/custom` page — `app/(marketing)/custom/page.tsx:53,89`

> "your data isolation posture"

OK in context — these are about white-label deployments offered as
custom engagements. Not asserting a specific tech claim. **SOUND.**

---

## 99. MUST CLOSE before handling real customer data autonomously

These are not "nice to have." Real businesses' email and file content
running through agentplain without human review demand each of these:

1. **Disclose third-party processing.** Update `components/FAQ.tsx`
   "Is my data safe?" and the surface ("Is my data resold or used to
   train someone else's model?") to:
   - Name OpenAI as the embedding provider and Anthropic as the LLM
     provider.
   - Drop the "your data stays in your stack" framing — it's wrong on
     the ingested-files path.
   - Replace "enterprise terms" with the specific provider terms we
     actually rely on, OR sign DPAs / ZDR addenda and reference them.
   - Add a `/legal/subprocessors` (or equivalent) page that lists OpenAI,
     Anthropic, Neon, Vercel, Inngest, Sentry, Resend, Stripe, Notion.

2. **Implement a deletion path.**
   - On `disconnectIntegrationAction` for the Drive (and future
     OneDrive / Dropbox) provider, run
     `prisma.knowledgeDocument.deleteMany({ where: { workspaceId,
     metadata: { path: ['source'], equals: 'google-drive' }}})`
     under the workspace RLS context — cascade drops embeddings.
     (`actions.ts:57` is the insertion point.)
   - Add a workspace-teardown flow (Conner-only at first) that drops
     every workspace-scoped row. `ON DELETE CASCADE` from
     `KnowledgeDocument.workspaceId` and `Embedding.workspaceId` already
     handles the chain once a `Workspace` row is deleted (`migration.sql:51`,
     `migration.sql:85`).
   - Add a tombstone reaper: every sweep, list the prior `KnowledgeDocument`
     rows whose `metadata.fileId` is NOT in the current Drive listing
     and delete them. Otherwise Drive deletions leak into our store
     forever.

3. **Scrub Sentry + tighten error messages on the skill chain.**
   - Install a `beforeSend` in `sentry.server.config.ts` (and edge) that
     truncates `event.message` to 200 chars and strips any
     `BODY:`/`INBOUND MESSAGE BODY:` content blocks.
   - Stop embedding LLM-response text in parse-error messages:
     `lib/skills/categorize.ts:97` and `lib/skills/draft.ts:160` should
     log the parse failure with a fixed snippet ("not JSON, first 80
     chars: \`...\`") only when explicitly enabled in dev — never in
     prod-error reports.
   - Drop the `console.error('knowledge.mcp uncaught', err)` body or
     route it through `getLogger().error` with a redaction step
     (`app/api/knowledge/mcp/route.ts:196`).

4. **Encrypt customer content at rest at the app layer, or formally
   accept Neon's disk-encryption as the baseline.**
   - Option A (lowest cost): document Neon's at-rest posture
     (https://neon.tech/docs/security/security-overview — read 2026-05-26
     to verify) and reference it on `/legal/security`.
   - Option B: encrypt `KnowledgeDocument.body` with the same AES-256-GCM
     codec, key-wrapped per workspace. Heavier — embeddings stay
     plaintext (the vector IS the leak channel), so this is partial
     defense. Decide explicitly.

(Lower-tier fixes — JSONL skill-run logger gating, approval-action
console.warn, retention TTLs on `WebhookEvent.rawPayload` and
`AuditLog.payload` — are listed in §2 / §6 for completeness but are not
hands-off-operation blockers.)

---

## Trivial-safe fixes applied this pass

**None.** Every finding in this audit either touches data-handling
behavior or modifies customer-facing claims, both of which are
out-of-scope per the brief. Everything is flagged for follow-up under
§99 and §2/§5/§6/§7.

---

## Scoping note

- VERIFIED claims cite a file:line I read in this audit pass on
  `docs/data-privacy-file-storage-audit-2026-05-26` branch off
  `origin/main` at HEAD `e8b808a` (per `git status` 2026-05-26).
- INFERRED claims (third-party DPA / training-on-data, Neon disk
  encryption, TLS-in-transit) are explicitly marked. I did not contact
  the vendors or inspect signed agreements.
- NOT-ASSESSABLE claims (Vercel / Neon / Inngest / Sentry infra
  posture) are flagged in §3 and §5c. They depend on hosted-infra
  documentation, not code.

---

## Resolution log

### MUST-CLOSE #4 — Encrypt customer content at rest (2026-05-27)

**Status:** RESOLVED via Option B (app-layer encryption) for
`KnowledgeDocument.body`. The flagged plaintext-at-rest gap in §99 is
closed for the customer-file text path.

**Change:**

- `lib/knowledge/body-crypto.ts` exposes `encryptBodyForWrite` /
  `decryptBodyForRead` as thin wrappers over the AES-256-GCM codec in
  `lib/security/encryption.ts:73-133`. Same algorithm, same
  `ENCRYPTION_KEY` env var, same `v1:iv:tag:ct` wire format the OAuth
  tokens already use (`IntegrationCredential.accessTokenEncrypted` —
  see `lib/integrations/index.ts:142-181`). One key to rotate, one
  ciphertext shape to debug.
- `lib/knowledge/pgvector-store.ts` encrypts on every persistence site
  (the three `tx.knowledgeDocument.create/upsert` calls) and decrypts at
  the search-result boundary. The seam is transparent — callers
  (`lib/customer-files/retrieve.ts`, `app/api/knowledge/mcp/route.ts`,
  `lib/customer-files/render.ts`) keep receiving plaintext snippets.
- Idempotent backfill: `scripts/encrypt-knowledge-bodies.ts`
  (npm: `encrypt:knowledge-bodies`). Skips already-encrypted rows via
  the `v1:` marker; resilient to per-row failures (logs + continues
  rather than aborting mid-pass). Safe to run before or after the code
  rollout — encrypt-on-write is itself idempotent and
  `decryptBodyForRead` passes legacy plaintext through unchanged.
- Failure-mode tests in `lib/knowledge/body-crypto.test.ts` cover
  round-trip, idempotency on re-run, mid-pass DB failure, a corrupt
  ciphertext degrading to `body=''` (not crashing retrieval), and the
  key-rotated / key-absent paths.

### Residual: vectors stay plaintext

`Embedding.vector` (the 1536-dim float array) is NOT encrypted. pgvector
ANN search compares floats with cosine distance; there is no
homomorphic encryption scheme that preserves that comparison at the
latency + price envelope the product ships at. The vector leaks some
statistical structure of the underlying chunk (similar inputs produce
similar vectors) but is not a recoverable copy of the text.

**Accepted baseline:** Neon disk-level encryption-at-rest covers the
vector column. See https://neon.tech/docs/security/security-overview
(read 2026-05-26). This is now an explicit, accepted decision —
documented in code (`lib/knowledge/pgvector-store.ts` header comment)
and in this audit doc — rather than an oversight.

### Out of scope for the encryption PR — explicit follow-up

The audit (§4, §2.5) also flagged two adjacent plaintext columns
holding customer content:

- `WorkApprovalQueueItem.payload` — full draft.subject + draft.body
  written by `lib/skills/persist-artifacts.ts`. Plaintext today.
- `HandoffLogEntry.payload` — skill-loop summary strings that include
  from-email + subject excerpts. Plaintext today.

Both are deliberately deferred to a follow-up PR. Same codec (AES-GCM
via `lib/security/encryption.ts`) is the intended fix, but the
`payload` columns are `Json` — encryption-at-rest of a `Json` column
requires either (a) wrapping in a `{ ciphertext, v }` envelope and
re-shaping every reader, or (b) flattening to `String` first. Either
choice is bigger than the simple `String` swap done for
`KnowledgeDocument.body`, and bundling it would have ballooned this PR
beyond the MUST-CLOSE #4 scope.

Tracked in the PR description (encryption PR) as the next data-privacy
audit follow-up.
