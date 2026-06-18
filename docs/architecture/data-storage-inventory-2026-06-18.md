# Data storage inventory & minimization audit — 2026-06-18

> **The commitment.** *Plaino remembers HOW your business works. He doesn't keep
> copies of your raw data — that lives in your tools. He keeps what he's learned
> about you, so he's a real partner that gets better.*
>
> What Plaino learns (your voice, preferences, conversations, the drafts you
> approve and edit) is kept for the **lifetime of your account** — it's yours,
> exportable any time, and hard-deleted when you close. The raw data inside the
> systems you connect (emails, deals, records) is read **in-flight** and **never
> copied** into our database. This document is the row-by-row proof.

This audit enumerates every place we write customer-scoped data and classifies
it. It is paired with a live, customer-visible surface (**Account → Your data →
What we store**) that renders the same categories with real row counts, and an
automated invariant test that fails if any new model escapes classification.

- **Source of truth for categories:** `lib/storage/data-categories.ts`
- **No-silent-storage test:** `lib/storage/__tests__/data-categories.test.ts`
- **Live surface:** `app/(product)/app/workspace/[id]/settings/data/storage/`
- **Method:** grep of every `prisma.<model>.{create,createMany,upsert,update,delete}`
  across `lib/`, `app/`, `scripts/`, cross-checked against `prisma/schema.prisma`.

---

## 1. Classification key

| Class | Meaning | Lifecycle |
|---|---|---|
| **partner-memory** | What Plaino has learned about your business — your voice, preferences, conversations, drafts, contacts, indexed docs. The point of a service partner: it compounds. | Kept for the account lifetime. Exportable any time. Hard-deleted on account close. |
| **necessary** | Infrastructure to run the account: auth, the encrypted connector tokens, billing, support. | Deleted on close — except billing rows (kept for tax). |
| **ephemeral** | **Not stored.** Your connected tools' raw data, read in-flight and discarded. | Never persisted. |

---

## 2. What we store, by category

### Your conversations with Plaino — `partner-memory`
`ChatThread`, `ChatMessage` (body AES-256-GCM encrypted), `PlainoConversation`.
Kept for the **life of the account** so Plaino has continuity — forgetting your
conversations would make him a worse partner. A privacy-conscious customer can
**opt into** a finite auto-purge window (`ChatThread.retentionDays`,
`WorkspacePreference.chatRetentionDays`); the default is lifetime and we never
shorten it on the customer's behalf. The `conversation-cleanup` cron only acts
when a finite window is set.

### What Plaino has learned about your business — `partner-memory`
`WorkspacePreference`, `PreferenceSignal`, `PreferenceFeedback`,
`WorkspaceMemoryEntry` (encrypted), `SkillConfig` (encrypted),
`WorkspaceSkillInstallation`, `WorkThresholdConfig`, `WorkspacePauseConfig`
(encrypted), `SkillScheduleWindow`, `DisciplineHead`, `WorkspaceBriefing`
(encrypted), `WorkspaceLifecycleEvent`. Your voice, preferences, schedule
rhythms, key contacts, recurring clients, deadline patterns — what makes Plaino
smarter about *your* business. Clearable any time from the storage surface to
reset what he's learned.

### Your drafts & work record — `partner-memory`
`WorkApprovalQueueItem`, `HandoffLogEntry`, `SkillRun`, `ComplianceFlag`,
`CounselRedline`, `RetryableAction`, `AuditLog`. Each draft Plaino made, what
you approved or edited, and the record of work done — **kept so Plaino learns
your style** (the approved/edited drafts are the learning signal). The drafts
are Plaino's own output referencing your data, not bulk copies of your tools.

### Documents you asked Plaino to learn — `partner-memory`
`KnowledgeDocument` (CUSTOMER kind, body encrypted), `Embedding` (CUSTOMER).
The **only** connector data we persist — and only for sources you **explicitly**
ask us to index, so Plaino can search them. Disconnecting the source deletes
them.

### Account & connections — `necessary`
`Workspace`, `Membership`, `Team`, `TeamMembership`, `OnboardingState`,
`IntegrationCredential`, `WebhookSubscription`, `WebhookEvent`,
`IntegrationHealthCheck`. Workspace metadata + team + the **encrypted connector
tokens** (AES-256-GCM) — the only connector secret we hold, and the only thing
we keep about a connection. `WebhookEvent.rawPayload` is a *notification*
envelope (Gmail Pub/Sub = `{emailAddress, historyId}`), **not** message content.

### Billing — `necessary`
`Subscription`, `WorkspaceInvoice`, `BillingEvent`, `LlmUsageRecord`.
Stripe-keyed state + invoice/usage history. **The one slice that survives
account closure**, for tax/compliance — disclosed on the closure screen.

### Support — `necessary`
`SupportRequest`, `SupportTicket`, `SupportTicketMessage`. Issue continuity;
resolved tickets clearable.

### Connector data (Gmail, CRM, …) — `ephemeral` — **NOT STORED**
No table. Read in-flight via `lib/integrations/ephemeral-pass-through.ts`,
processed in memory, returned to your approval queue, discarded. Every read
leaves a `storage.ephemeral_fetch` breadcrumb ("read N items, stored 0").

---

## 3. Write-site inventory (by model)

| Model | Class | Representative write sites |
|---|---|---|
| `Workspace`, `Membership`, `OnboardingState`, `Team` | necessary | `lib/auth/flows.ts`, onboarding |
| `IntegrationCredential`, `WebhookSubscription`, `WebhookEvent`, `IntegrationHealthCheck` | necessary | OAuth callbacks, webhook receivers (notifications only; tokens encrypted) |
| `Subscription`, `WorkspaceInvoice`, `BillingEvent`, `LlmUsageRecord` | necessary | `lib/billing/*` |
| `SupportRequest`, `SupportTicket`, `SupportTicketMessage` | necessary | `lib/support/*` |
| `ChatThread`, `ChatMessage`, `PlainoConversation` | partner-memory | `lib/plaino/prisma-chat-store.ts`, `conversation-log.ts` (encrypted; lifetime) |
| `WorkspacePreference`, `PreferenceSignal`, `PreferenceFeedback`, `WorkspaceMemoryEntry`, `SkillConfig`, `Workspace*Config/Window`, `DisciplineHead`, `WorkspaceBriefing`, `WorkspaceLifecycleEvent` | partner-memory | `lib/preferences/*`, `lib/plaino/memory/*`, settings actions |
| `WorkApprovalQueueItem`, `HandoffLogEntry`, `SkillRun`, `ComplianceFlag`, `CounselRedline`, `RetryableAction`, `AuditLog` | partner-memory | `lib/skills/*`, `lib/approvals/decisions.ts`, agent runtime |
| `KnowledgeDocument`, `Embedding` | partner-memory | `lib/knowledge/pgvector-store.ts` (CUSTOMER kind only) |
| **Connector record bodies** (emails, deals, contacts, invoices) | **ephemeral** | **NONE — never written to Prisma** |

Operator-internal models excluded from the customer surface (documented in the
invariant test's `EXCLUDED_FROM_SURFACE`): `CapabilityProposal`, `CreatorBrief`.

---

## 4. What this PR changed

| Before | Change |
|---|---|
| Pass-through was **implicit** (no proof it wasn't stored). | `passThroughFetch` wrapper + `storage.ephemeral_fetch` breadcrumb, wired into the Gmail/Outlook inbox read; in-memory-only short-TTL cache (Redis swap seam). |
| No customer visibility into stored data beyond a JSON export. | Live storage surface: two clear stories — "what Plaino has learned" (long-term, exportable, deleted on close) vs "what we don't keep" (pass-through) — with row counts + per-category clear. |
| No disclosure before connecting. | "What we'll store" panel rendered before every connect CTA. |
| Account close **preserved** the customer's audit log. | Close now **hard-deletes** the customer's `AuditLog` too (`tearDownWorkspaceData`) — only billing rows survive, for tax. |
| (Customer control added) | Opt-in chat auto-purge window for privacy-conscious customers — default remains lifetime. |

> **Course-correction note (2026-06-18):** an earlier draft of this work
> defaulted chat + memory to a 1–2 day window. That was wrong — it would
> lobotomize Plaino. Reversed: Plaino-memory is kept for the account lifetime;
> only the raw connector data is ephemeral.

---

## 5. The boundary, stated plainly

**We keep (for the life of your account, yours, deleted on close):** your
conversations with Plaino; what Plaino has learned about your business; your
drafts and the work record; documents you asked us to index. Plus the
infrastructure to run the account (settings, team, encrypted tokens, billing,
support).

**We do NOT keep:** the contents of your connected systems. Your emails, deals,
contacts, calendar, invoices, messages — read in-flight, never copied. The
canonical copy stays in your tools.

**On account close:** everything you own is hard-deleted — including your audit
log — except billing rows kept for tax.

**Open decisions for Conner:** see
`docs/strategic-build-2026-06-17/TODOS-FOR-CONNER.md`.
