/**
 * lib/skills/registry.ts
 *
 * Catalog of agentplain's vertical-specific skill workflows. Metadata
 * only — each skill exports its own typed `runSkill(input)` entrypoint
 * from `lib/skills/<slug>/index.ts`. This file is the operator-facing
 * inventory: which workflows ship, which verticals they serve, which
 * MCP providers they depend on, and which dependencies are still
 * stubbed pending MCP availability.
 *
 * Per `project_living_portable_architecture.md`: each skill speaks
 * provider-neutral ports. The MCP dependencies listed here are the
 * intended production backends — the skill code itself does not import
 * vendor SDKs.
 *
 * Per `project_no_outbound_architecture.md`: every entry's `kind` is
 * one of `draft` | `triage` | `coordinate` — never `send`. The customer's
 * system executes outreach; agentplain produces the drafts.
 *
 * Per `feedback_no_quick_fixes.md`: a skill is listed here only when its
 * end-to-end behavior is functional on the inputs it accepts (including
 * JSON-stub inputs for MCPs that are not yet built). Hollow shells are
 * excluded.
 */

export type McpDependencyStatus = 'built' | 'in-flight' | 'stubbed-json';

export interface McpDependency {
  /** Provider slug — matches `lib/integrations/<slug>/` when built. */
  provider: string;
  /** Status of the MCP backing this dependency. */
  status: McpDependencyStatus;
  /** Note for the operator — what the skill accepts today and what the
   *  production wiring will look like once the MCP lands. */
  note: string;
}

export interface SkillCatalogEntry {
  /** Stable slug — matches `lib/skills/<slug>/`. */
  slug: string;
  /** Customer-facing name. */
  name: string;
  /** Vertical slug — matches `lib/verticals/<slug>/`. Use the literal
   *  string `'all'` for skills that ship to every workspace regardless
   *  of vertical (e.g. office-admin). */
  vertical: string;
  /** Short description of the workflow. */
  description: string;
  /** What the skill produces. */
  kind: 'draft' | 'triage' | 'coordinate';
  /** MCP dependencies the production wiring needs. */
  mcpDependencies: McpDependency[];
  /** Memory rules + content files the skill is grounded in. */
  groundedIn: string[];
  /** When true, the skill runs by default in every workspace. False (or
   *  unset) means a customer must opt-in. Office-admin is the first
   *  default-enabled skill — every business needs verification-code
   *  routing. */
  defaultEnabled?: boolean;
}

export const SKILL_CATALOG: SkillCatalogEntry[] = [
  {
    slug: 'office-admin',
    name: 'Office admin — inbox triage',
    vertical: 'all',
    description:
      'Recognizes admin / IT / account-hygiene email (verification codes, ' +
      'password-reset links, 2FA codes, trial expirations, billing notices, ' +
      'subscription confirmations, account suspensions, service-status updates, ' +
      'and email-preferences housekeeping). Routes each into the approval queue ' +
      'with the right affordance — the verification code rendered prominently, ' +
      'the reset link as an "Open" button, the security alert as a red-bordered ' +
      'confirm-this-was-me card. The skill DRAFTS where helpful (billing-notice ' +
      'acknowledgements, trial-reminder calendar notes) but never clicks links, ' +
      'fills forms, or holds credentials.',
    kind: 'triage',
    mcpDependencies: [
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Inbound email arrives through the existing Gmail integration; the skill ' +
          'consumes ParsedMessage from any MessageFetcher.',
      },
      {
        provider: 'outlook',
        status: 'built',
        note:
          'Outlook (M365) MessageFetcher is wired through the same provider-neutral ' +
          'port. Office-admin runs identically against either source.',
      },
    ],
    groundedIn: [
      'project_office_manager_skill.md',
      'project_no_outbound_architecture.md',
      'project_service_partnership_positioning.md',
      'feedback_brand_is_plain_not_plane.md',
      'feedback_no_quick_fixes.md',
      'prohibited_actions (CLAUDE.md)',
    ],
    defaultEnabled: true,
  },
  {
    slug: 'invoice-chasing-realestate',
    name: 'Commission invoice chasing — real estate',
    vertical: 'real-estate',
    description:
      'Detects unpaid commission invoices, buckets by days outstanding, and drafts ' +
      'tier-appropriate reminders for the broker to send from their own system.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'quickbooks',
        status: 'stubbed-json',
        note:
          'QuickBooks MCP not yet built. Skill accepts a generic InvoiceRecord[] ' +
          'JSON payload today; the QuickBooks MCP will populate this same shape ' +
          'when it lands.',
      },
      {
        provider: 'follow-up-boss',
        status: 'stubbed-json',
        note:
          'Follow Up Boss MCP not yet built. Skill accepts a generic ContactRecord[] ' +
          'JSON payload today; the Follow Up Boss MCP will populate this same shape ' +
          'when it lands.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Drafts persist to Gmail via the existing DraftPersister port ' +
          '(lib/integrations/google/gmail-provider.ts). Outlook (M365) is in flight.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/real-estate/content.ts',
      'lib/skills/prompts/real-estate.ts (tone guidance)',
    ],
  },
  {
    slug: 'lead-triage-realestate',
    name: 'Lead triage — real estate',
    vertical: 'real-estate',
    description:
      'Scores inbound real-estate leads on motivation, timeline, and preapproval, ' +
      'buckets them hot / warm / cold / nurture, proposes routing to an agent or ' +
      'drip campaign, and drafts a first-touch reply.',
    kind: 'triage',
    mcpDependencies: [
      {
        provider: 'follow-up-boss',
        status: 'stubbed-json',
        note:
          'Follow Up Boss MCP not yet built. Skill accepts generic LeadRecord[] ' +
          'JSON payloads today; the Follow Up Boss MCP will hydrate the same ' +
          'shape from FUB lead events.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Inbound lead emails arrive through the existing Gmail integration; ' +
          'the skill accepts ParsedMessage[] from any MessageFetcher.',
      },
      {
        provider: 'outlook',
        status: 'in-flight',
        note:
          'Outlook (M365) MessageFetcher is in flight at local_26d66079. The skill ' +
          'is provider-neutral — it consumes any MessageFetcher.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/real-estate/content.ts',
      'lib/skills/prompts/real-estate.ts (lead signals)',
    ],
  },
  {
    slug: 'month-end-close-cpa',
    name: 'Month-end close — CPA',
    vertical: 'cpa',
    description:
      'Tracks a client month-end close: identifies missing documents against a ' +
      'per-engagement checklist, buckets received / pending / late, drafts chase ' +
      'emails for each missing doc, proposes calendar follow-ups, and drafts a ' +
      'client-facing status update.',
    kind: 'coordinate',
    mcpDependencies: [
      {
        provider: 'quickbooks',
        status: 'stubbed-json',
        note:
          'QuickBooks MCP not yet built. Skill accepts QuickBooks-shaped JSON ' +
          '(client + period + checklist) today; MCP will populate the same shape.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Doc-receipt detection comes from the Gmail MessageFetcher today; ' +
          'the skill consumes ReceivedDoc[] which any fetcher can produce.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/cpa/content.ts',
      'lib/skills/prompts/cpa.ts (formal tone, never state a tax position)',
    ],
  },
  {
    slug: 'law-intake-conflict-screen',
    name: 'Intake conflict screen — law',
    vertical: 'law',
    description:
      'Runs a deterministic conflict screen on a prospective-client intake: ' +
      'compares prospect + opposing parties against the firm ledger, classifies ' +
      'direct / adverse / former-adverse hits, and drafts a formal internal ' +
      'notice to the responsible attorney with merge fields for the legal ' +
      'conclusion (never asserted by the skill).',
    kind: 'triage',
    mcpDependencies: [
      {
        provider: 'clio',
        status: 'stubbed-json',
        note:
          'Clio / MyCase / PracticePanther MCPs not yet built. Skill accepts ' +
          'LedgerEntry[] JSON today; the MCPs will populate the same shape.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Internal-notice drafts persist via the existing DraftPersister; ' +
          'Outlook (M365) ships through the same port.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/law/content.ts',
      'lib/skills/prompts/law.ts (formal tone, never state a legal conclusion)',
      'ABA MRPC 1.7 / 1.18 (conflict screening framework)',
    ],
  },
  {
    slug: 'ria-client-update-draft',
    name: 'Quarterly client update — RIA',
    vertical: 'ria',
    description:
      'Drafts a quarterly household client-update email using a portfolio ' +
      'snapshot + advisor notes. NEVER renders dollar amounts, NEVER states an ' +
      'investment recommendation — every quantitative or forward-looking claim ' +
      'is an {{advisor: ...}} merge field. Form ADV + qualified-custodian ' +
      'pointers ride on every draft.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'orion',
        status: 'stubbed-json',
        note:
          'Orion / Black Diamond / Tamarac MCPs not yet built. Skill accepts ' +
          'PortfolioSnapshot + AdvisorNote[] JSON today.',
      },
      {
        provider: 'redtail',
        status: 'stubbed-json',
        note:
          'Redtail / Wealthbox CRM MCPs not yet built. AdvisorNote[] is the ' +
          'shape both will populate.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Drafts persist via the existing DraftPersister port; Outlook (M365) ' +
          'rides through the same port.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/ria/content.ts',
      'lib/skills/prompts/ria.ts (formal tone, never state investment advice)',
      'Advisers Act § 206 + Rule 206(4)-1 (advertising rule)',
      'Advisers Act Rule 204A-1 (code of ethics)',
    ],
  },
  {
    slug: 'title-escrow-closing-doc-chase',
    name: 'Closing-doc chase — title / escrow',
    vertical: 'title-escrow',
    description:
      'Walks a closing file checklist, buckets each item by responsible party ' +
      '(lender / buyer / seller / attorney), and drafts a batched chase email ' +
      'per party. Optional items never trigger chases; late items lower draft ' +
      'confidence so the closing coordinator re-reads tone before sending. ' +
      'Title status + wire-instructions confirmation always defer to operator ' +
      'merge fields.',
    kind: 'coordinate',
    mcpDependencies: [
      {
        provider: 'softpro',
        status: 'stubbed-json',
        note:
          'SoftPro / Qualia / RamQuest MCPs not yet built. Skill accepts ' +
          'ClosingFile + ChecklistItem[] + ReceivedDoc[] JSON today.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Per-party chase drafts persist via the existing DraftPersister port.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/title-escrow/content.ts',
      'lib/skills/prompts/title-escrow.ts (formal tone, never assert title status)',
    ],
  },
];

export function getSkillCatalogEntry(slug: string): SkillCatalogEntry | null {
  return SKILL_CATALOG.find((s) => s.slug === slug) ?? null;
}

export function getSkillsForVertical(verticalSlug: string): SkillCatalogEntry[] {
  return SKILL_CATALOG.filter((s) => s.vertical === verticalSlug);
}
