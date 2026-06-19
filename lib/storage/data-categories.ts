/**
 * lib/storage/data-categories.ts
 *
 * The single source of truth for what agentplain stores about a customer.
 *
 * agentplain is a SERVICE LAYER. The deal is: **Plaino remembers HOW your
 * business works — he does NOT keep copies of your raw data.** What he learns
 * about you (your voice, your preferences, your contacts, your conversations,
 * the drafts you approve and edit) is kept for the **lifetime of your account**
 * so he gets better as a partner — exportable any time, and hard-deleted when
 * you close the account. The raw data inside your connected tools (emails,
 * deals, records) is read in-flight and **never copied** into our database.
 *
 * Three classifications drive the customer-visible surface:
 *
 *   • partner-memory — what Plaino has learned about your business. Kept while
 *                      your account is active, exportable any time, hard-
 *                      deleted on account close. THIS IS THE POINT of a service
 *                      partner: it compounds over time.
 *   • necessary      — infrastructure to run your account (auth, the encrypted
 *                      connector tokens, billing, support). Also yours; also
 *                      deleted on close (billing rows excepted, for tax).
 *   • ephemeral      — NOT stored. Read in-flight and discarded (your connected
 *                      tools' raw data). Listed so we can say so plainly.
 *
 * The `tables` array names the Prisma models each category holds. A test
 * asserts every customer-scoped model is accounted for here (no silent,
 * undisclosed storage).
 */

export type DataCategoryClassification = 'necessary' | 'partner-memory' | 'ephemeral';

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
  /** Whether the customer can clear this category from the storage surface
   *  without closing the whole workspace. (Everything is deleted on close
   *  regardless.) */
  customerDeletable: boolean;
  /** Longer disclosure shown in the expanded card / audit doc. */
  detail: string;
}

/**
 * The canonical commitment. Order is the order the storage surface renders:
 * partner-memory first (the headline — what Plaino learned), then the
 * pass-through, then the necessary infrastructure.
 */
export const DATA_CATEGORIES: readonly DataCategory[] = [
  {
    id: 'conversations',
    label: 'Your conversations with Plaino',
    classification: 'partner-memory',
    summary:
      'Your full chat history with Plaino — kept for the life of your account so he has continuity.',
    tables: ['ChatThread', 'ChatMessage', 'PlainoConversation'],
    customerDeletable: true,
    detail:
      "Chat turns are encrypted at rest and kept for as long as your account is active — Plaino would be a poor partner if he forgot every conversation. Exportable any time; hard-deleted when you close the account. If you'd rather we auto-purge older chats, you can opt into a retention window (it's off by default — lifetime is the default).",
  },
  {
    id: 'preferences-memory',
    label: 'What Plaino has learned about your business',
    classification: 'partner-memory',
    summary:
      'Your voice, your preferences, your workflow rhythms, and what Plaino has picked up over time.',
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
      'Your stated preferences (tone, categorization rules, schedule windows), the corrections you leave on drafts, and the memory entries Plaino extracts — your brand voice, key contacts, recurring clients, deadline patterns, business rhythms. Encrypted where it can carry PII. This is what makes Plaino smarter about YOUR business over time. Kept for the account lifetime, exportable, deleted on close — and you can clear it any time to reset what he has learned.',
  },
  {
    id: 'approvals',
    label: 'Your drafts & work record',
    classification: 'partner-memory',
    summary:
      'The drafts Plaino made, what you approved or edited, and the record of work done — kept so he learns your style.',
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
      'Each item Plaino drafts, the decision you made on it, and what you edited — kept so Plaino learns what you like and how you change things. Plus the handoff/skill-run record of work done and the audit trail of what happened in your workspace. The drafts reference your data but are Plaino\'s own output, not bulk copies of your tools. Kept for the account lifetime, exportable, hard-deleted on close.',
  },
  {
    id: 'knowledge',
    label: 'Documents you asked Plaino to learn',
    classification: 'partner-memory',
    summary:
      'Documents you explicitly pointed us at, indexed so Plaino can ground his work in them.',
    tables: ['KnowledgeDocument', 'Embedding'],
    customerDeletable: true,
    detail:
      'When you connect a document source (Drive, Notion) and ask us to index it, we store the chunked text + a private vector index scoped to your workspace, so Plaino can search it. This is the only connector data we persist, and only because you asked us to make it part of what Plaino knows. Disconnecting the source deletes its documents; closing the account deletes all of it.',
  },
  {
    id: 'connector-data',
    label: "What we don't keep (your connected tools)",
    classification: 'ephemeral',
    summary:
      'Raw data in Gmail, your CRM, your books — Plaino reads it in-flight and keeps NO copy.',
    tables: [],
    customerDeletable: false,
    detail:
      "The emails, deals, contacts, calendar events, and records inside the systems you connect are NEVER copied into our database. When Plaino needs them he fetches them with your token, processes them in memory, drafts a result for your approval, and discards the source. The canonical copy stays in your tools, where it belongs — we are a pass-through, not a mirror. (The one exception is documents you explicitly ask us to index — see 'Documents you asked Plaino to learn'.)",
  },
  {
    id: 'auth-workspace',
    label: 'Account & connections',
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
      'Workspace metadata (name, slug, vertical, tier), the team members we route work to, and the OAuth/API credentials for the systems you connected. Tokens are encrypted at rest (AES-256-GCM) and are the ONLY connector secret we keep — we never store the data those tokens reach. Removed when you disconnect a connector or close the account.',
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
      'Your subscription state (tier, seats, status) keyed to a Stripe customer id, plus invoice records and per-workspace usage accounting. Retained after account closure for tax and compliance — this is the one slice that survives a close, disclosed up front.',
  },
  {
    id: 'support',
    label: 'Support',
    classification: 'necessary',
    summary: 'Your support tickets and messages with the service team.',
    tables: ['SupportRequest', 'SupportTicket', 'SupportTicketMessage'],
    customerDeletable: true,
    detail:
      'In-app support requests and ticket threads with your service team. Kept so an open issue has continuity; deletable once resolved, and removed on account close.',
  },
];

const CATEGORY_BY_ID = new Map<string, DataCategory>(
  DATA_CATEGORIES.map((c) => [c.id, c]),
);

export function getDataCategory(id: string): DataCategory | undefined {
  return CATEGORY_BY_ID.get(id);
}

/** Categories the customer can independently clear from the storage surface. */
export function customerDeletableCategories(): DataCategory[] {
  return DATA_CATEGORIES.filter((c) => c.customerDeletable);
}

/** Categories grouped under a classification, in surface order. */
export function categoriesByClassification(
  classification: DataCategoryClassification,
): DataCategory[] {
  return DATA_CATEGORIES.filter((c) => c.classification === classification);
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
