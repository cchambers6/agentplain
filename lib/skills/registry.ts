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
    slug: 'chief-of-staff-scheduler',
    name: 'Chief of staff — meetings, replies, to-dos',
    vertical: 'all',
    description:
      'Per-workspace chief-of-staff agent. Walks the (calendar + inbox + to-do) ' +
      'snapshot and PROPOSES three classes of work — meetings to book against ' +
      'open business-hour slots that do not overlap existing busy events, reply ' +
      'drafts for stale inbound with substantive content deferred to operator ' +
      'merge fields, and to-do items for explicit ask cues (deduped against ' +
      'existing open to-dos). Every proposal is PENDING and lands in the ' +
      'approval queue via the ApprovalSink port. The skill itself executes ' +
      'NOTHING — never books a calendar event, never sends an email, never ' +
      'writes a Twilio/SMS/SendGrid call, never creates a row in Asana / Linear / ' +
      'Notion. Per project_no_outbound_architecture.md the customer\'s own ' +
      'system performs any action the operator approves.',
    kind: 'coordinate',
    mcpDependencies: [
      {
        provider: 'google-calendar',
        status: 'stubbed-json',
        note:
          'Google Calendar MCP not yet wired. Skill accepts a CalendarEvent[] ' +
          'JSON payload today (the JsonChiefOfStaffFetcher seeded shape); the ' +
          'production adapter populates the same shape from calendar.events.list ' +
          'once it lands.',
      },
      {
        provider: 'm365-calendar',
        status: 'stubbed-json',
        note:
          'Microsoft Graph calendar adapter rides the same provider-neutral ' +
          'CalendarEvent[] shape — no skill change needed when M365 ships.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Inbox messages flow through the existing Gmail MessageFetcher; the ' +
          'skill maps ParsedMessage to its internal InboxMessage shape at the ' +
          'fetcher boundary so the chief-of-staff stays provider-neutral.',
      },
      {
        provider: 'outlook',
        status: 'built',
        note:
          'Outlook (M365) MessageFetcher rides the same port — no skill change ' +
          'needed.',
      },
      {
        provider: 'work-approval-queue',
        status: 'stubbed-json',
        note:
          'Production binding for ApprovalSink (writes WorkApprovalQueueItem ' +
          'rows for the operator\'s /approvals page) lands in a follow-up PR ' +
          'that introduces the matching WorkApprovalKind enum values. Tests ' +
          'bind RecordingApprovalSink so the no-outbound contract is asserted ' +
          'today: every proposal is recorded with status=PENDING, NONE auto- ' +
          'execute.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_runner_portability.md (two-implementation rule on every port)',
      'feedback_cold_start_safe_agents.md (no in-memory state across runs)',
      'feedback_integration_acceptance_is_functional.md (read + categorize + ' +
        'coordinate + schedule + draft, end-to-end against demo seed)',
    ],
  },
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
    slug: 'insurance-coi-request',
    name: 'Certificate-of-insurance request — insurance',
    vertical: 'insurance',
    description:
      'Reads an inbound certificate-of-insurance request, looks up the named ' +
      'insured\'s policies on the AMS, decides per-line whether coverage is ' +
      'in-force / expired / not-on-file, builds the structured issuance payload ' +
      'for the CSR to open in the AMS or carrier portal, and drafts a formal ' +
      'acknowledgement back to the requester. Never quotes premium or binding ' +
      'date — every quantitative claim defers to an {{operator: ...}} merge field.',
    kind: 'coordinate',
    mcpDependencies: [
      {
        provider: 'ezlynx',
        status: 'stubbed-json',
        note:
          'EZLynx / Applied Epic / AMS360 / HawkSoft MCPs not yet built. Skill ' +
          'accepts a PolicyOnFile[] JSON payload today; the MCPs will populate ' +
          'the same shape once they ship.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Requester acknowledgement drafts persist via the existing ' +
          'DraftPersister port; Outlook (M365) rides through the same port.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/insurance/content.ts',
      'lib/skills/prompts/insurance.ts (formal tone, never quote premium / binding date)',
    ],
  },
  {
    slug: 'mortgage-document-chase',
    name: 'Document chase — mortgage',
    vertical: 'mortgage',
    description:
      'Reads outstanding loan-file documents from the LOS, buckets each item ' +
      'against the broker\'s per-category cadence (fresh / pending / late / ' +
      'stuck), and drafts a SINGLE batched borrower email — never one-per-doc ' +
      'spam. Stuck items surface a phone-call nudge to the LO. Every draft ' +
      'carries the wire-fraud disclaimer and defers rate / APR / DTI questions ' +
      'to an {{operator: rate/APR}} merge field.',
    kind: 'coordinate',
    mcpDependencies: [
      {
        provider: 'encompass',
        status: 'stubbed-json',
        note:
          'Encompass / LendingPad / Calyx MCPs not yet built. Skill accepts ' +
          'LoanFile + OutstandingDoc[] JSON today; the MCPs will populate the ' +
          'same shape once they ship.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Borrower chase drafts persist via the existing DraftPersister port.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/mortgage/content.ts',
      'lib/skills/prompts/mortgage.ts (precise tone, never quote rate/APR/DTI)',
    ],
  },
  {
    slug: 'home-services-estimate-followup',
    name: 'Estimate followup — home services',
    vertical: 'home-services',
    description:
      'Walks every open trades estimate, classifies each by where it sits in ' +
      'the post-send cadence (fresh / soft-nudge / check-in / last-call / cold), ' +
      'and drafts the per-stage homeowner-facing nudge. Cold estimates roll up ' +
      'into a single rep handoff with a phone-call ask — never another email. ' +
      'Price + schedule always defer to {{operator: quote/time estimate}}.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'acculynx',
        status: 'stubbed-json',
        note:
          'AccuLynx / JobNimbus / ServiceTitan / Housecall Pro / Jobber MCPs not ' +
          'yet built. Skill accepts EstimateRecord[] JSON today; the MCPs will ' +
          'populate the same shape.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Followup drafts persist via the existing DraftPersister port.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/home-services/content.ts',
      'lib/skills/prompts/home-services.ts (plain-spoken tone, never quote price)',
    ],
  },
  {
    slug: 'recruiting-candidate-status-update',
    name: 'Candidate status update — recruiting',
    vertical: 'recruiting',
    description:
      'Reads a role\'s active pipeline, classifies each candidate by transition ' +
      'since the last touch (advanced / held / rejected / withdrawn / offer-' +
      'extended), and drafts the warm-but-quick update. Offer-extended and ' +
      'rejection drafts always queue for recruiter review before any persistence. ' +
      'Hiring-manager feedback never leaks into the draft verbatim. Compensation ' +
      'and offer detail always defer to {{operator: comp/offer details}}.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'greenhouse',
        status: 'stubbed-json',
        note:
          'Greenhouse / Lever / Workable / Bullhorn MCPs not yet built. Skill ' +
          'accepts RoleContext + CandidateRecord[] JSON today; the MCPs will ' +
          'populate the same shape.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Routine status drafts persist via the existing DraftPersister port. ' +
          'High-stakes transitions stay in the recruiter review queue.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/recruiting/content.ts',
      'lib/skills/prompts/recruiting.ts (warm tone, never quote comp/offer)',
    ],
  },
  {
    slug: 'property-management-rent-collection-chase',
    name: 'Rent collection chase — property management',
    vertical: 'property-management',
    description:
      'Reads the rent roll, buckets each delinquent unit against the operator\'s ' +
      'cadence (grace / soft-chase / formal-notice / escalation), and drafts the ' +
      'per-tenant chase email. Payment plans soften tone; escalation units route ' +
      'to a PM review queue carrying the owner-approval flag. Maintenance ETAs ' +
      'always defer to {{operator: maintenance ETA}}; dollar amounts always defer ' +
      'to {{operator: amount due}}.',
    kind: 'coordinate',
    mcpDependencies: [
      {
        provider: 'appfolio',
        status: 'stubbed-json',
        note:
          'AppFolio / Buildium / Propertyware / Yardi Breeze MCPs not yet built. ' +
          'Skill accepts UnitDelinquency[] JSON today; the MCPs will populate ' +
          'the same shape.',
      },
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Tenant chase drafts persist via the existing DraftPersister port; ' +
          'escalation drafts stay in the PM review queue.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'lib/verticals/property-management/content.ts',
      'lib/skills/prompts/property-management.ts (friendly tone, never quote dollar amounts)',
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
