/**
 * lib/storage/data-categories.ts
 *
 * The single source of truth for the data-minimization commitment.
 *
 * agentplain is a SERVICE LAYER, not a data warehouse. The commitment we
 * make to a customer — "here is EXACTLY what we store about you, and
 * nothing else" — is only credible if one registry drives every surface
 * that states it: the storage-inventory audit doc, the customer-visible
 * `/settings/data/storage` page, the connection-time disclosure, and the
 * tests that keep all three honest. That registry is this file.
 *
 * Each `DataCategory` classifies a slice of customer-scoped storage:
 *
 *   • necessary  — we MUST persist this for the product to function at all
 *                  (auth tokens, workspace metadata, billing relationship,
 *                  the approval queue's pending decisions). Deleting it
 *                  breaks the service.
 *   • retention  — persisted only inside a customer-controlled retention
 *                  window, then auto-deleted (Plaino chat history).
 *   • audit      — a durable record kept for the customer's own audit trail
 *                  (what we did, when) — but the CONTENT it references is
 *                  redacted once the work completes (the approval queue's
 *                  decided items).
 *   • opt-in     — persisted ONLY if the customer explicitly turns it on
 *                  (extended chat retention, learned voice/preferences).
 *   • ephemeral  — NOT a stored category at all; listed so the surface can
 *                  state plainly "we fetch this in-flight and never store
 *                  it" (Gmail/CRM connector data).
 *
 * The `tables` array names the Prisma models that hold each category's
 * rows. `lib/storage/workspace-storage-summary.ts` reads live counts for
 * exactly these models; a test asserts that every customer-scoped model in
 * the schema is accounted for here (no silent un-disclosed storage).
 */

export type DataCategoryClassification =
  | 'necessary'
  | 'retention'
  | 'audit'
  | 'opt-in'
  | 'ephemeral';

export interface DataCategory {
  /** Stable id used in surface routing + audit actions. */
  id: string;
  /** Customer-facing group label. */
  label: string;
  classification: DataCategoryClassification;
  /** One-line, customer-facing plain-English statement of what's stored. */
  summary: string;
  /** Prisma model names whose rows fall under this category. Empty for the
   *  ephemeral category (nothing is stored). */
  tables: readonly string[];
  /** Whether the customer can delete this category from the storage surface
   *  without closing the whole workspace. Necessary categories (tokens,
   *  billing) are not independently deletable — disconnecting/closing is the
   *  path. */
  customerDeletable: boolean;
  /** Longer disclosure shown in the expanded card / audit doc. */
  detail: string;
}

/**
 * The canonical commitment. Order is the order the storage surface renders.
 */
export const DATA_CATEGORIES: readonly DataCategory[] = [
  {
    id: 'auth-workspace',
    label: 'Auth & workspace',
    classification: 'necessary',
    summary:
      'Your workspace settings, team roster, and the encrypted connector tokens we need to do the work.',
    tables: [
      'Workspace',
      'Membership',
      'Team',
      'TeamMembership',
      'OnboardingState',
      'IntegrationCredential',
      'WebhookSubscription',
      'WebhookEvent',
      'IntegrationHealthCheck',
    ],
    customerDeletable: false,
    detail:
      'Workspace metadata (name, slug, vertical, tier, preferences), the team members we route work to, and OAuth/API credentials for the systems you connected. Tokens are encrypted at rest (AES-256-GCM) and are the ONLY copy of a connector secret we keep — we never store the data those tokens reach. Removed when you disconnect a connector or close the workspace.',
  },
  {
    id: 'billing',
    label: 'Billing',
    classification: 'necessary',
    summary:
      'The Stripe relationship and invoice history that lets us bill you correctly.',
    tables: ['Subscription', 'WorkspaceInvoice', 'BillingEvent', 'LlmUsageRecord'],
    customerDeletable: false,
    detail:
      'Your subscription state (tier, seats, status) keyed to a Stripe customer id, plus invoice records and per-workspace usage accounting. Retained after workspace closure for tax and compliance — this is the one slice that survives a close, by design and disclosed up front.',
  },
  {
    id: 'approvals',
    label: 'Approvals & work record',
    classification: 'audit',
    summary:
      'The log of what your fleet did and the decisions you made — content redacted once the work completes.',
    tables: [
      'WorkApprovalQueueItem',
      'HandoffLogEntry',
      'SkillRun',
      'ComplianceFlag',
      'CounselRedline',
      'RetryableAction',
      'AuditLog',
    ],
    customerDeletable: true,
    detail:
      'Each item your fleet drafts waits here for your approval; pending items must persist (a decision needs something to decide on). Once an item is decided and the work has run, the DRAFT CONTENT and any customer data it referenced is redacted after 7 days — we keep the structural record (what kind of work, when, who decided) for your audit trail, not the body text. The handoff + skill-run logs and the audit trail are append-only structural records.',
  },
  {
    id: 'conversations',
    label: 'Conversations with Plaino',
    classification: 'retention',
    summary:
      'Your chat history with Plaino — kept only for your retention window, then deleted.',
    tables: ['ChatThread', 'ChatMessage', 'PlainoConversation'],
    customerDeletable: true,
    detail:
      'Chat turns are encrypted at rest and kept for a short, customer-controlled retention window (see your retention setting), then auto-deleted by a daily sweep. Default windows are short by design; you can extend them if you want Plaino to keep more context — that extension is your explicit choice.',
  },
  {
    id: 'preferences-memory',
    label: 'Preferences & learned voice',
    classification: 'opt-in',
    summary:
      "What you've told us about how you like the work done, and what Plaino has learned about your voice.",
    tables: [
      'WorkspacePreference',
      'PreferenceSignal',
      'PreferenceFeedback',
      'WorkspaceMemoryEntry',
      'SkillConfig',
      'WorkspaceSkillInstallation',
      'WorkThresholdConfig',
      'WorkspacePauseConfig',
      'SkillScheduleWindow',
      'DisciplineHead',
      'WorkspaceBriefing',
      'WorkspaceLifecycleEvent',
    ],
    customerDeletable: true,
    detail:
      'Your stated preferences (tone, categorization notes, schedule windows), the corrections you leave on drafts, and the memory entries Plaino extracts so it sounds like you across sessions. Encrypted where it can carry PII. This is the slice that makes Plaino better over time — clear it any time to reset what we have learned.',
  },
  {
    id: 'support',
    label: 'Support',
    classification: 'necessary',
    summary: 'Your support tickets and messages with the service team.',
    tables: ['SupportRequest', 'SupportTicket', 'SupportTicketMessage'],
    customerDeletable: true,
    detail:
      'In-app support requests and ticket threads with your service team. Kept so an open issue has continuity; deletable once resolved.',
  },
  {
    id: 'knowledge',
    label: 'Ingested documents',
    classification: 'opt-in',
    summary:
      'Documents you explicitly pointed us at, indexed so Plaino can ground its work in them.',
    tables: ['KnowledgeDocument', 'Embedding'],
    customerDeletable: true,
    detail:
      'When you connect a document source (Drive, Notion) and ask us to index it, we store the chunked text + a vector index scoped to your workspace. Disconnecting the source deletes its documents; this is the only connector data we persist, and only because you asked us to make it searchable.',
  },
  {
    id: 'connector-data',
    label: 'Connector data (Gmail, CRM, etc.)',
    classification: 'ephemeral',
    summary:
      'We do NOT store this. Plaino reads it in-flight, does the work, and returns a result.',
    tables: [],
    customerDeletable: false,
    detail:
      "The emails, deals, contacts, calendar events, and records inside the systems you connect are NEVER copied into our database. When Plaino needs them it fetches them with your token, processes them in memory, drafts a result for your approval, and discards the source. The canonical copy stays in your system — we are a pass-through, not a mirror. (The one exception is documents you explicitly ask us to index — see 'Ingested documents'.)",
  },
];

const CATEGORY_BY_ID = new Map<string, DataCategory>(
  DATA_CATEGORIES.map((c) => [c.id, c]),
);

export function getDataCategory(id: string): DataCategory | undefined {
  return CATEGORY_BY_ID.get(id);
}

/** Categories the customer can independently delete from the storage surface. */
export function customerDeletableCategories(): DataCategory[] {
  return DATA_CATEGORIES.filter((c) => c.customerDeletable);
}

/** Every distinct Prisma model named across all stored categories. The
 *  ephemeral category contributes none. A test asserts this set covers every
 *  customer-scoped model in the schema — the no-silent-storage invariant. */
export function disclosedStoredModels(): Set<string> {
  const out = new Set<string>();
  for (const c of DATA_CATEGORIES) {
    for (const t of c.tables) out.add(t);
  }
  return out;
}
