# Data storage inventory & minimization audit — 2026-06-18

> **The commitment.** agentplain is a **service layer, not a data warehouse.**
> We store the minimum required to run the service and prove what we did — and
> nothing else. The data inside the systems you connect (your inbox, your CRM,
> your books) is read **in-flight** and **never copied** into our database.
> This document is the row-by-row proof of that claim, and the contract the
> codebase is held to.

This audit enumerates every place we write customer-scoped data, classifies
each, and documents the "we store **only** this" boundary. It is paired with a
live, customer-visible surface (**Account → Your data → What we store**) that
renders the same categories with real row counts, and with an automated
invariant test that fails if any new model escapes classification.

- **Source of truth for categories:** `lib/storage/data-categories.ts`
- **No-silent-storage test:** `lib/storage/__tests__/data-categories.test.ts`
- **Live surface:** `app/(product)/app/workspace/[id]/settings/data/storage/`
- **Method:** grep of every `prisma.<model>.{create,createMany,upsert,update,delete}`
  across `lib/`, `app/`, `scripts/`, cross-checked against `prisma/schema.prisma`.

---

## 1. Classification key

| Class | Meaning | Default posture |
|---|---|---|
| **necessary** | Required for the product to function (auth tokens, workspace metadata, billing, the pending approval queue). | Keep; deleting breaks the service. |
| **retention** | Kept only inside a customer-controlled window, then auto-deleted. | Short by default (chat = 2 days). |
| **audit** | Durable structural record of what happened; the *content* it referenced is redacted once work completes. | Keep the record, redact the body. |
| **opt-in** | Persisted only because the customer turned it on or asked for it. | Off / empty by default. |
| **ephemeral** | **Not stored at all** — read in-flight and discarded. | Never persisted. |

---

## 2. What we store, by category

### Auth & workspace — `necessary`
Workspace metadata, team roster, encrypted connector credentials.
`Workspace`, `Membership`, `Team`, `TeamMembership`, `OnboardingState`,
`IntegrationCredential`, `WebhookSubscription`, `WebhookEvent`,
`IntegrationHealthCheck`.

- **Customer-data columns:** `Workspace.name/slug`, `Membership.userId`,
  `IntegrationCredential.accountEmail`.
- **Encrypted-at-rest:** `IntegrationCredential.accessTokenEncrypted` /
  `refreshTokenEncrypted` (AES-256-GCM). These are the **only** connector
  secret we hold and the only thing we keep about a connection.
- **Critical nuance:** `WebhookEvent.rawPayload` is a *notification* envelope
  (Gmail Pub/Sub = `{emailAddress, historyId}`), **not** message content.

### Billing — `necessary`
`Subscription`, `WorkspaceInvoice`, `BillingEvent`, `LlmUsageRecord`.
Stripe-keyed subscription state + invoice/usage history. **This is the one
slice that survives workspace closure**, for tax and compliance — disclosed
up front on the closure screen.

### Approvals & work record — `audit`
`WorkApprovalQueueItem`, `HandoffLogEntry`, `SkillRun`, `ComplianceFlag`,
`CounselRedline`, `RetryableAction`, `AuditLog`.

- `WorkApprovalQueueItem.payload` carries draft text + referenced customer
  data while **PENDING** (a decision needs content). **REFACTORED THIS PR:**
  once an item is decided and the work has run, the payload is **redacted 7
  days later** (`lib/approvals/content-ephemerality.ts` +
  `approval-content-redaction` cron) — top-level key names kept for the audit
  trail, values removed.
- `AuditLog` is the append-only proof trail (kept; it's the record that proves
  what we did). It now also carries the storage-transparency events
  (`storage.write`, `storage.ephemeral_fetch`).

### Conversations with Plaino — `retention`
`ChatThread`, `ChatMessage` (body AES-256-GCM encrypted), `PlainoConversation`.

- **REFACTORED THIS PR:** chat is now **session-scoped by default** (2 days)
  with customer-controlled, tier-capped extension
  (`ChatThread.retentionDays`, `WorkspacePreference.chatRetentionDays`,
  `lib/plaino/chat-retention.ts`). A daily `conversation-cleanup` cron deletes
  expired threads (cascading messages). Memory Plaino extracted survives
  (its source-message FK is `SetNull`).

### Preferences & learned voice — `opt-in`
`WorkspacePreference`, `PreferenceSignal`, `PreferenceFeedback`,
`WorkspaceMemoryEntry` (encrypted), `SkillConfig` (encrypted),
`WorkspaceSkillInstallation`, `WorkThresholdConfig`, `WorkspacePauseConfig`
(encrypted), `SkillScheduleWindow`, `DisciplineHead`, `WorkspaceBriefing`
(encrypted), `WorkspaceLifecycleEvent` (encrypted note).
The data that makes Plaino better over time — clearable any time from the
storage surface (learned memory/signals/corrections reset; deliberate settings
like tone/schedule kept).

### Support — `necessary`
`SupportRequest`, `SupportTicket`, `SupportTicketMessage`. Kept for issue
continuity; resolved tickets clearable.

### Ingested documents — `opt-in`
`KnowledgeDocument` (CUSTOMER kind, body encrypted), `Embedding` (CUSTOMER
kind). The **only** connector data we persist — and only for sources you
**explicitly** ask us to index, so Plaino can search them. Disconnecting the
source deletes them (`lib/customer-files/deletion.ts`).

### Connector data (Gmail, CRM, …) — `ephemeral` — **NOT STORED**
No table. Read in-flight via `lib/integrations/ephemeral-pass-through.ts`,
processed in memory, returned to your approval queue, discarded. Every read
leaves a `storage.ephemeral_fetch` breadcrumb ("read N items, stored 0").

---

## 3. Write-site inventory (by model)

Representative `create`/`upsert`/`update` sites; classification per §1.

| Model | Class | Representative write sites |
|---|---|---|
| `Workspace` | necessary | `lib/auth/flows.ts`, `lib/billing/*` |
| `Subscription` / `WorkspaceInvoice` / `BillingEvent` | necessary | `lib/billing/provisioning.ts`, `webhook-dispatch.ts` |
| `LlmUsageRecord` | necessary | `lib/billing/usage/recorder.ts` |
| `IntegrationCredential` | necessary | OAuth callbacks, `lib/integrations/*` (encrypted) |
| `WebhookSubscription` / `WebhookEvent` | necessary | webhook receivers (notification only) |
| `Membership` / `User` / `WebAuthnCredential` / `MagicLinkToken` | necessary | `lib/auth/*` |
| `OnboardingState` | necessary | `lib/onboarding/*` |
| `WorkApprovalQueueItem` | audit | `lib/skills/*`, `lib/approvals/decisions.ts`, `lib/plaino/*` (payload redacted post-decision) |
| `HandoffLogEntry` / `SkillRun` / `ComplianceFlag` / `CounselRedline` | audit | agent runtime, `lib/agents/sentinel/*` |
| `RetryableAction` | audit | integration self-heal retry queue |
| `AuditLog` | audit | every domain mutation + storage hooks |
| `ChatThread` / `ChatMessage` | retention | `lib/plaino/prisma-chat-store.ts` (encrypted; auto-deleted) |
| `PlainoConversation` | retention | `lib/plaino/conversation-log.ts` |
| `WorkspaceMemoryEntry` | opt-in | `lib/plaino/memory/prisma-memory-store.ts` (encrypted) |
| `WorkspacePreference` / `PreferenceSignal` / `PreferenceFeedback` | opt-in | `lib/preferences/store.ts` |
| `SkillConfig` / `WorkspaceSkillInstallation` / `WorkThresholdConfig` / `SkillScheduleWindow` / `WorkspacePauseConfig` / `DisciplineHead` | opt-in | settings actions, `lib/skills/marketplace.ts` |
| `WorkspaceBriefing` | opt-in | briefings generator |
| `KnowledgeDocument` / `Embedding` | opt-in | `lib/knowledge/pgvector-store.ts` (CUSTOMER kind only) |
| `SupportRequest` / `SupportTicket` / `SupportTicketMessage` | necessary | `lib/support/*` |
| **Connector record bodies** (emails, deals, contacts, invoices) | **ephemeral** | **NONE — never written to Prisma** |

Operator-internal models excluded from the customer surface (documented in the
invariant test's `EXCLUDED_FROM_SURFACE`): `CapabilityProposal` (skill-dev
queue), `CreatorBrief` (creative handoff). `Inquiry` / `LeadCapture` are
pre-conversion lead records keyed by a soft pointer, not a `workspaceId`.

---

## 4. What this PR refactored toward ephemeral

| Gap before | Change |
|---|---|
| Chat had **no retention** — kept forever. | Session-scoped default (2 days) + customer-controlled, tier-capped extension + daily cleanup cron. |
| Approval `payload` (draft text + customer data) kept forever after decision. | Redacted to a structural stub 7 days after the decision; daily redaction cron. |
| Pass-through was **implicit** (no proof it wasn't stored). | `passThroughFetch` wrapper + `storage.ephemeral_fetch` breadcrumb, wired into the Gmail/Outlook inbox read; in-memory-only short-TTL cache. |
| No customer visibility into stored data beyond a JSON export. | Live per-category storage surface with row counts + per-category delete. |
| No disclosure before connecting. | "What we'll store" panel rendered before every connect CTA. |

---

## 5. The boundary, stated plainly

**We store:** your workspace settings; your team; encrypted connector tokens;
your billing relationship; the queue of work awaiting your approval; a
structural audit trail of what we did; your conversations with Plaino (for your
retention window); what you've told us and what Plaino learned (until you clear
it); documents you asked us to index.

**We do NOT store:** the contents of your connected systems. Your emails, your
deals, your contacts, your calendar, your invoices, your messages — read
in-flight, never copied. The canonical copy stays in your system, where it
belongs.

**Open decisions for Conner:** see
`docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md` (per-tier retention
defaults, counsel review of the commitment language, Redis vs in-memory cache).
