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
  /** Vertical slug — matches `lib/verticals/<slug>/`. */
  vertical: string;
  /** Short description of the workflow. */
  description: string;
  /** What the skill produces. */
  kind: 'draft' | 'triage' | 'coordinate';
  /** MCP dependencies the production wiring needs. */
  mcpDependencies: McpDependency[];
  /** Memory rules + content files the skill is grounded in. */
  groundedIn: string[];
}

export const SKILL_CATALOG: SkillCatalogEntry[] = [
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
];

export function getSkillCatalogEntry(slug: string): SkillCatalogEntry | null {
  return SKILL_CATALOG.find((s) => s.slug === slug) ?? null;
}

export function getSkillsForVertical(verticalSlug: string): SkillCatalogEntry[] {
  return SKILL_CATALOG.filter((s) => s.vertical === verticalSlug);
}
