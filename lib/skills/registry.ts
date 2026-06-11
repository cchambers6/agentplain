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

/** Wave-2 runtime-honesty flag the marketplace UI reads. Values match
 *  the audit-doc taxonomy:
 *    - `live`         — there is a production caller (cron sweep,
 *                       webhook chain, or event handler) that fires
 *                       the skill on real workspace data today.
 *    - `schema-only`  — the skill module exists and has tests, but
 *                       NO production caller fires it. The UI badges
 *                       the marketplace card so the customer doesn't
 *                       install something that won't fire.
 *    - `coming-soon`  — registered for the customer-facing catalog
 *                       but the module is intentionally absent. (No
 *                       entries today; reserved for future scaffolding.)
 */
export type SkillRuntimeStatus = 'live' | 'schema-only' | 'coming-soon';

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
  /** Wave-2: honest runtime status surfaced in the marketplace UI.
   *  Defaults to `'schema-only'` so adding a new entry without a
   *  production caller doesn't lie. Adding a `'live'` entry means
   *  there's a real caller you can point at. */
  runtime?: SkillRuntimeStatus;
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
        status: 'built',
        note:
          'Production binding wired: PrismaApprovalSink persists each ' +
          'proposal as a WorkApprovalQueueItem (status=PENDING) under the ' +
          'CHIEF_OF_STAFF_MEETING / CHIEF_OF_STAFF_REPLY_DRAFT / ' +
          'CHIEF_OF_STAFF_TODO enum kinds. Production callers use ' +
          'runChiefOfStaffForWorkspace which binds the Prisma sink by ' +
          'default; tests still bind RecordingApprovalSink to assert the ' +
          'no-outbound contract.',
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
    runtime: 'live',
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
    runtime: 'live',
  },
  {
    slug: 'inbox-triage-general',
    name: 'Inbox triage — cross-role priority + acks',
    vertical: 'all',
    description:
      'Cross-role inbox classifier for the /general on-ramp surface. Walks ' +
      'the inbox window the fetcher returns and tags every message with one ' +
      'of five priority buckets — urgent, customer-active, vendor-pending, ' +
      'needs-decision, noise — then drafts a gentle acknowledgement (for ' +
      'customer-active and vendor-pending only) with an {{operator: ...}} ' +
      'merge field for any substantive answer. Urgent and needs-decision ' +
      'NEVER get an auto-drafted ack — the operator must read those ' +
      'directly. Different from office-admin (admin/IT mail only) and from ' +
      'chief-of-staff (scheduling/to-do). Per project_no_outbound_' +
      'architecture.md every proposal is PENDING; nothing gets sent.',
    kind: 'triage',
    mcpDependencies: [
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Inbound email arrives through the existing Gmail MessageFetcher. The ' +
          'skill maps ParsedMessage to its internal TriageMessage shape at the ' +
          'fetcher boundary; production binds the live adapter, tests bind ' +
          'JsonTriageFetcher.',
      },
      {
        provider: 'outlook',
        status: 'built',
        note:
          'Outlook (M365) MessageFetcher rides the same provider-neutral port; ' +
          'no skill change needed when an operator connects M365 instead.',
      },
      {
        provider: 'work-approval-queue',
        status: 'stubbed-json',
        note:
          'Production binding for TriageApprovalSink (writes WorkApprovalQueueItem ' +
          'rows) lands with the chief-of-staff sink — same WorkApprovalKind enum ' +
          'pathway. Tests bind RecordingTriageApprovalSink to assert no-outbound ' +
          'end-to-end against demo seeds today.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_runner_portability.md',
      'feedback_cold_start_safe_agents.md',
      'feedback_integration_acceptance_is_functional.md',
    ],
    runtime: 'live',
  },
  {
    slug: 'follow-up-chaser-general',
    name: 'Follow-up chaser — cross-role stale-thread nudges',
    vertical: 'all',
    description:
      'Cross-role follow-up chaser for the /general on-ramp surface. Walks ' +
      'the operator\'s recent outbound threads, identifies those where the ' +
      'counterparty has not replied past a stale-window (default 4 days), ' +
      'and drafts a gentle first-stage or second-stage nudge for each — ' +
      'oldest stalls first, capped at maxNudgesPerRun. Every draft carries ' +
      'an {{operator: ...}} merge field for fresh context, and threads ' +
      'with an existing operator-drafted nudge are skipped so the draft ' +
      'folder does not pile up. Per project_no_outbound_architecture.md ' +
      'every nudge is PENDING; nothing gets sent.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'gmail',
        status: 'built',
        note:
          'Operator outbound flows through the existing Gmail MessageFetcher. ' +
          'Production binds an adapter that materializes OutboundThread[] from ' +
          'the workspace\'s sent folder + thread cache; tests bind JsonFollowUp' +
          'Fetcher with a pre-loaded snapshot.',
      },
      {
        provider: 'outlook',
        status: 'built',
        note:
          'Outlook (M365) rides the same OutboundThread[] shape — no skill ' +
          'change when M365 is the connected mailbox.',
      },
      {
        provider: 'work-approval-queue',
        status: 'stubbed-json',
        note:
          'Production binding for FollowUpApprovalSink (writes WorkApproval' +
          'QueueItem rows) lands with the chief-of-staff sink. Tests bind ' +
          'RecordingFollowUpApprovalSink to assert no-outbound today.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_runner_portability.md',
      'feedback_cold_start_safe_agents.md',
      'feedback_integration_acceptance_is_functional.md',
    ],
    runtime: 'live',
  },
  {
    slug: 'process-doc-drafter-general',
    name: 'Process-doc drafter — observe, draft SOP, never publish',
    vertical: 'all',
    description:
      'Cross-role process-doc drafter for the /general on-ramp surface. ' +
      'Clusters the operator\'s recent approved actions by (kind, trigger' +
      'Hint) and drafts a Standard Operating Procedure for every pattern ' +
      'that repeats ≥ minOccurrences times (default 3). Every SOP body ' +
      'carries at least one {{operator: ...}} merge field — the skill ' +
      'can show what happened, but the operator decides what the canonical ' +
      'process IS. Patterns matched by normalized title against existing ' +
      'SOPs are skipped. Per project_no_outbound_architecture.md the skill ' +
      'NEVER publishes to Notion / Confluence / Google Docs / any external ' +
      'doc system — the draft lives in the approval queue until the ' +
      'operator copies it into their own documentation.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'workspace-activity-log',
        status: 'stubbed-json',
        note:
          'Reads PastAction[] from the workspace activity log (the same store ' +
          'that backs /approvals history). Tests bind JsonProcessDocFetcher ' +
          'with a pre-loaded snapshot; production binds an adapter that materializes ' +
          'PastAction[] from approved WorkApprovalQueueItem rows + sent messages.',
      },
      {
        provider: 'notion',
        status: 'stubbed-json',
        note:
          'Existing-SOP dedupe reads ExistingProcessDoc[] (id + title only). When ' +
          'the operator has Notion connected, the production adapter populates ' +
          'this from the workspace\'s SOP database; absent a connection, the list ' +
          'is empty and dedupe still works correctly (it just won\'t catch SOPs ' +
          'the operator already has elsewhere). No SDK import — provider-neutral.',
      },
      {
        provider: 'work-approval-queue',
        status: 'stubbed-json',
        note:
          'Production binding for ProcessDocApprovalSink writes WorkApproval' +
          'QueueItem rows alongside the chief-of-staff sink. Tests bind ' +
          'RecordingProcessDocApprovalSink to assert no-publish today.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_runner_portability.md',
      'feedback_cold_start_safe_agents.md',
      'feedback_integration_acceptance_is_functional.md',
    ],
    runtime: 'live',
  },
  {
    slug: 'support-handler',
    name: 'Support handler — first-touch draft from /help',
    vertical: 'all',
    description:
      'Cross-role support handler. Fires on every customer-submitted ' +
      'SupportRequest from /help, queries the knowledge substrate for ' +
      'relevant context, and drafts a first-touch reply that lands in the ' +
      'operator approval queue tagged customer-success. High-confidence ' +
      'drafts cite the snippets they grounded in so the operator can ' +
      'verify; low-confidence retrieval falls back to a templated ' +
      "\"a human is taking a closer look\" placeholder — NEVER fabricates " +
      'an answer. Per project_no_outbound_architecture.md the skill drafts ' +
      "only — the customer's existing operator email path performs the " +
      'send once the operator approves.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'knowledge-substrate',
        status: 'built',
        note:
          'Retrieval rides retrieveCustomerContext (the MCP-fronted ' +
          'boundary), so the skill never opens a direct DB connection to ' +
          'pgvector. Two impls of IKnowledgeSubstratePort: ' +
          'CustomerFilesKnowledgeSubstrate (production) + ' +
          'RecordingKnowledgeSubstrate (tests).',
      },
      {
        provider: 'work-approval-queue',
        status: 'built',
        note:
          'PrismaApprovalSink writes WorkApprovalQueueItem rows tagged ' +
          'kind=SUPPORT_HANDLER_REPLY_DRAFT, refTable=SupportRequest, ' +
          'discipline=customer-success. Tests bind RecordingApprovalSink.',
      },
      {
        provider: 'anthropic-llm',
        status: 'built',
        note:
          'Draft synthesis rides the provider-neutral LlmProvider ' +
          'interface. The system prompt is workspace-agnostic — stable ' +
          "preamble (brand voice + no-outbound + escalation policy) so the " +
          'prompt-cache wrapper can mark it cacheable.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'project_hierarchical_approval_chain.md (operator approves; only ' +
        'escalations reach Conner)',
      'project_mcp_first_integration_architecture.md (substrate via the ' +
        'MCP boundary, not direct DB)',
      'project_plaino_named_agent.md (service-partner voice in the draft)',
      'feedback_no_guesses_no_estimates.md (placeholder, not fabrication, ' +
        'when substrate is empty)',
      'feedback_runner_portability.md (two-impl rule on every port)',
      'feedback_cold_start_safe_agents.md (stateless, reads durable state)',
    ],
    defaultEnabled: true,
    runtime: 'live',
  },
  {
    slug: 'customer-support-triage',
    name: 'Support triage — L1 answer, resolve, or escalate',
    vertical: 'all',
    description:
      'Pillar-3 of the self-healing fleet: Plaino as L1 support. Intercepts ' +
      'every inbound support message (the /help SupportRequest path AND the ' +
      'in-app help chat, which both funnel through submitSupportRequest) ' +
      'BEFORE the draft path and routes it to exactly one outcome so a ' +
      'customer question never hits a black hole: (1) ESCALATE-FIRST to a ' +
      'human via pageHuman with a 24h deadline for legal/compliance, billing ' +
      'disputes over a tunable threshold, vulnerability reports, mental-health ' +
      'distress, data-deletion requests, or ANY explicit ask for a human — and ' +
      'mark the thread escalated so Plaino stops auto-replying; (2) ' +
      'AUTO-ANSWER from the curated KB (marketing FAQ + product docs) when ' +
      'confidence clears the threshold, signed by Plaino, never claiming to be ' +
      'human; (3) AUTO-RESOLVE bounded zero-dollar account actions (reconnect ' +
      'prompt, pause/resume, resend magic link) through the EXISTING ' +
      'bounded-execute autonomy rails; (4) DRAFT-FOR-REVIEW as the ' +
      'self-routing floor (the existing SUPPORT_HANDLER_REPLY_DRAFT path). ' +
      'When the LLM is paused/dead it degrades to escalate-everything + pages ' +
      'once per outage window. Anything touching money stays draft-for-review.',
    kind: 'triage',
    mcpDependencies: [
      {
        provider: 'anthropic-llm',
        status: 'built',
        note:
          'KB-judged retrieval + grounded answer ride the provider-neutral ' +
          'LlmProvider (the rotation/paused/budget stack). A PAUSED / dead-key ' +
          'response degrades the skill to escalate-everything.',
      },
      {
        provider: 'ops-page-human',
        status: 'built',
        note:
          'Escalations route through lib/ops/page-human (pfd-1) — the one ' +
          'fleet-wide escalation choke point. critical + 24h deadline for ' +
          'trigger-based escalations, warn for the degraded-LLM path.',
      },
      {
        provider: 'bounded-execute',
        status: 'built',
        note:
          'Auto-resolve reuses lib/skills/bounded-execute (#204 per-workspace ' +
          'autonomy + reversibility allowlist). Autonomy off → draft-for-review. ' +
          'No new autonomy mechanism invented.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md (drafts/advises; never sends)',
      'project_plaino_chatbot_two_surfaces.md (REUSES SUPPORT_HANDLER_REPLY_DRAFT)',
      'project_plaino_named_agent.md (signed by Plaino, calm heritage voice)',
      'project_fire_gate_must_wire_all_skill_callers.md (gateSkillFire wired ' +
        'into support-handler-on-create)',
      'feedback_cold_start_safe_agents.md (KB + policy read fresh per fire)',
      'feedback_runner_portability.md (KB / LLM / pager / store / marker ports)',
      'SIGNUP_TO_GO_AUDIT_2026_06_10.md (closes the silent-support-death gap)',
    ],
    defaultEnabled: true,
    runtime: 'live',
  },
  {
    slug: 'analytics-weekly-pulse-general',
    name: 'Analytics — weekly pulse',
    vertical: 'all',
    description:
      'Plaino reads your workspace activity from the last seven days — approvals ' +
      'proposed and decided, draft acceptance rate by skill, /talk turns, learned ' +
      'notes — and drafts one calm weekly pulse into /approvals on Mondays. The ' +
      'pulse names what worked, where the fleet was underused, and one concrete ' +
      'thing to lean into next week. Counts only — never quotes a customer-facing ' +
      'draft body. Per project_no_outbound_architecture.md, nothing leaves the workspace.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'work-approval-queue',
        status: 'built',
        note:
          'PrismaPulseApprovalSink persists each pulse as a WorkApprovalQueueItem ' +
          '(kind=ANALYTICS_PULSE, discipline=analytics).',
      },
      {
        provider: 'anthropic-llm',
        status: 'built',
        note:
          'Pulse prose composes through the provider-neutral LlmProvider. ' +
          'Templated fallback emits when the LLM call fails or returns malformed JSON.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_runner_portability.md',
      'feedback_cold_start_safe_agents.md',
      'docs/fleet-autonomy-audit-2026-05-28.md §10 (analytics: NOT-DELIVERING)',
    ],
    runtime: 'live',
  },
  {
    slug: 'research-on-demand-general',
    name: 'Research — on-demand brief',
    vertical: 'all',
    description:
      'Plaino picks up research-tagged instructions from /talk, queries your ' +
      'workspace\'s own knowledge substrate for relevant context, and drafts a ' +
      'structured brief — summary, key findings, gaps, sources. The brief is ' +
      'GROUNDED ON YOUR KNOWLEDGE BASE ONLY; web search is not wired today and ' +
      'every brief NAMES that limitation so the scope stays honest. When the ' +
      'substrate returns nothing relevant, the brief says so plainly rather than ' +
      'fabricating. Per project_no_outbound_architecture.md the brief lands in ' +
      'the approval queue — never sent.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'knowledge-substrate',
        status: 'built',
        note:
          'Substrate access rides retrieveCustomerContext (the MCP-fronted boundary) ' +
          'via CustomerFilesResearchSubstrate. Two impls of IResearchSubstratePort ' +
          '(production + recording) per the two-implementation rule.',
      },
      {
        provider: 'work-approval-queue',
        status: 'built',
        note:
          'The brief is rendered into the existing PLAINO_INSTRUCTION row the ' +
          'dispatcher created — no new approval-queue kind needed; the discipline ' +
          'tag is "research" so the approvals page facets it correctly.',
      },
      {
        provider: 'web-search',
        status: 'stubbed-json',
        note:
          'No public web-search adapter is wired today. Every brief includes a ' +
          '"web search not wired" gap so the customer sees the honest scope.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_no_guesses_no_estimates.md',
      'feedback_runner_portability.md',
      'project_mcp_first_integration_architecture.md',
      'docs/fleet-autonomy-audit-2026-05-28.md §10 (research: NOT-DELIVERING)',
    ],
    runtime: 'live',
  },
  {
    slug: 'content-calendar-drafter-general',
    name: 'Marketing — weekly content calendar',
    vertical: 'all',
    description:
      'Plaino drafts a 5-day content calendar for the upcoming week — one ' +
      'evergreen topic per business day with channel hint + short hook. ' +
      'Grounded on your vertical + the workspace\'s recent activity + any ' +
      'FEEDBACK rules you\'ve set under email-draft / customer-comms. The ' +
      'calendar is a draft for you to edit + own; agentplain NEVER posts to ' +
      'social or sends an email blast. Per project_no_outbound_architecture.md.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'work-approval-queue',
        status: 'built',
        note:
          'PrismaCalendarApprovalSink persists each calendar as a WorkApprovalQueueItem ' +
          '(kind=CONTENT_CALENDAR, discipline=marketing).',
      },
      {
        provider: 'anthropic-llm',
        status: 'built',
        note:
          'Calendar composes through the provider-neutral LlmProvider. Templated ' +
          'fallback emits 5 placeholder rows with operator merge fields when the LLM ' +
          'returns malformed JSON.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_runner_portability.md',
      'docs/fleet-autonomy-audit-2026-05-28.md §10 (marketing: NOT-DELIVERING)',
    ],
    runtime: 'live',
  },
  {
    slug: 'finance-pulse-general',
    name: 'Finance — weekly pulse',
    vertical: 'all',
    description:
      'Plaino reads your finance posture once a week — invoice-chase drafts ' +
      'produced, month-end-close drafts produced, finance approvals decided, ' +
      'and (when QuickBooks is connected) AR aging plus open-invoice counts ' +
      'pulled through the QuickBooks MCP. Drafts ONE pulse into /approvals ' +
      'on Mondays. When QuickBooks is not connected, the pulse still fires ' +
      'but names the gap explicitly rather than fabricating AR numbers. ' +
      'Per project_no_outbound_architecture.md, nothing leaves the workspace.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'quickbooks',
        status: 'built',
        note:
          'AR aging + open-invoice + expense counts ride the existing QuickBooks ' +
          'MCP (lib/integrations/quickbooks-mcp). When QB is not connected the ' +
          'snapshot reports `connected: false` with an honest reason; the pulse ' +
          'still fires + names the gap rather than fabricating numbers.',
      },
      {
        provider: 'work-approval-queue',
        status: 'built',
        note:
          'PrismaFinancePulseApprovalSink persists each pulse as a WorkApprovalQueueItem ' +
          '(kind=FINANCE_PULSE, discipline=finance).',
      },
      {
        provider: 'anthropic-llm',
        status: 'built',
        note:
          'Pulse prose composes through the provider-neutral LlmProvider. Templated ' +
          'fallback emits on quiet weeks / malformed JSON so the row still lands honestly.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_runner_portability.md',
      'feedback_cold_start_safe_agents.md',
      'feedback_no_guesses_no_estimates.md (no fabricated AR when QB is dark)',
      'docs/fleet-autonomy-audit-2026-05-28.md §10 (finance: PARTIAL pre-wave-4)',
    ],
    runtime: 'live',
  },
  {
    slug: 'compliance-watch-general',
    name: 'Legal — compliance watch',
    vertical: 'all',
    description:
      'Plaino sweeps the last 24 hours of approval drafts every morning, ' +
      'running each draft body through your vertical\'s sentinel corpus AND a ' +
      'built-in PII pattern set (SSN, card-number, API-key blobs). When the ' +
      'sweep finds matches, it drafts ONE digest into /approvals naming what ' +
      'was flagged and which drafts to review before approving. When nothing ' +
      'is flagged, no row lands — the legal discipline only surfaces on real ' +
      'findings. Sentinel ADVISES; nothing is blocked or edited automatically. ' +
      'Per project_no_outbound_architecture.md.',
    kind: 'triage',
    mcpDependencies: [
      {
        provider: 'sentinel-corpus',
        status: 'built',
        note:
          'Reads the existing per-vertical sentinel corpus via loadCorpusFor + ' +
          'scanCorpus — no new corpus rules ship in this skill, just a new caller.',
      },
      {
        provider: 'work-approval-queue',
        status: 'built',
        note:
          'Reads + writes WorkApprovalQueueItem rows. Reads the trailing 24h of ' +
          'drafts (decrypting payload bodies via the existing v1 envelope) and ' +
          'writes one COMPLIANCE_DIGEST row when matches are found.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_runner_portability.md',
      'docs/fleet-autonomy-audit-2026-05-28.md §10 (legal: NOT-DELIVERING ex-realty)',
    ],
    runtime: 'live',
  },
  {
    slug: 'invoice-chase-general',
    name: 'Finance — invoice chase autopilot',
    vertical: 'all',
    description:
      'Plaino reads your overdue QuickBooks invoices once a day, buckets each by ' +
      'days-overdue, and drafts a tier-escalating chase message for each one — a ' +
      'gentle first-touch on a fresh miss, a firmer note as it ages. Every draft ' +
      'lands in /approvals tagged finance, carrying the invoice balance in the ' +
      'payload for value-ledger ROI. When QuickBooks is not connected the sweep ' +
      'skips the workspace quietly rather than fabricating an AR figure. On the ' +
      'bounded-execute allowlist (FOLLOW_UP_NUDGE), so when Conner enables it the ' +
      'owner wakes up to chased invoices. Per project_no_outbound_architecture.md, ' +
      'nothing leaves the workspace — the customer\'s own system sends.',
    kind: 'draft',
    mcpDependencies: [
      {
        provider: 'quickbooks',
        status: 'built',
        note:
          'Overdue invoices + balances ride the existing QuickBooks MCP ' +
          '(lib/skills/invoice-chase-general/quickbooks-ar-fetcher.ts). When ' +
          'QuickBooks is not connected the fetcher returns NOT_CONFIGURED and the ' +
          'sweep skips the workspace — never fabricates AR. Daily caller: ' +
          'lib/inngest/functions/invoice-chase-general-sweep.ts (6 AM UTC).',
      },
      {
        provider: 'work-approval-queue',
        status: 'built',
        note:
          'PrismaInvoiceChaseApprovalSink persists each chase as a ' +
          'WorkApprovalQueueItem (kind=FOLLOW_UP_NUDGE, discipline=finance) with ' +
          'balanceUsd in the payload for ROI tracking.',
      },
    ],
    groundedIn: [
      'project_no_outbound_architecture.md',
      'feedback_no_silent_vendor_lock.md',
      'feedback_runner_portability.md',
      'feedback_cold_start_safe_agents.md',
      'feedback_no_guesses_no_estimates.md (no fabricated AR when QB is dark)',
      'docs/audits/SIGNUP_TO_GO_AUDIT_2026_06_10.md §Engine (the silent-gating 🚨 — ' +
        'this skill shipped (PR #203) but was ABSENT from SKILL_CATALOG, so ' +
        'isSkillInstalledForWorkspace returned false and the daily sweep skipped ' +
        'every workspace. This entry closes that gap.)',
    ],
    runtime: 'live',
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
        status: 'built',
        note:
          'QuickBooks MCP wired. lib/skills/invoice-chasing-realestate/quickbooks-fetcher.ts ' +
          'pulls open invoices + customers via the workspace-scoped MCP server. ' +
          'When QuickBooks is not yet connected the adapter returns a calm ' +
          'NOT_CONFIGURED notice instead of throwing; nothing fake lands in /approvals.',
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
        status: 'in-flight',
        note:
          'Follow Up Boss MCP not yet built. The wave-1 vertical router ' +
          '(lib/skills/vertical-router.ts) wires the skill to fire on every ' +
          'inbound email on a real-estate workspace, deriving LeadRecord[] ' +
          'from ParsedMessage via lib/skills/lead-triage-realestate/parsed-' +
          'message-fetcher.ts. Triaged leads route to `manual` until the FUB ' +
          'MCP populates an agent roster — better than fake-routing to a ' +
          'hardcoded agent.',
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
    runtime: 'live',
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
        status: 'built',
        note:
          'QuickBooks MCP wired. lib/skills/month-end-close-cpa/quickbooks-fetcher.ts ' +
          'derives the engagement (customer + primary contact) from the QB customer ' +
          'record and the checklist from the engagement scope (standard CPA ' +
          'engagement-letter pattern). Received-docs are not a QB concept — the ' +
          'adapter returns empty so the skill chases everything outstanding by ' +
          'dueAt; TaxDome / Karbon MCPs land received-doc detection later. ' +
          'When QuickBooks is not yet connected the adapter returns a calm ' +
          'NOT_CONFIGURED notice instead of throwing.',
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
    // pfd-8: flipped live. Production caller =
    // lib/inngest/functions/month-end-close-cpa-sweep.ts (monthly, month-end
    // window). Enumerates QuickBooks customers per CPA workspace and drafts a
    // close-prep chase per engagement.
    runtime: 'live',
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
    // pfd-8: flipped live. Production caller =
    // lib/inngest/functions/law-intake-conflict-screen-sweep.ts (daily). Sweeps
    // un-screened new-matter intakes per law workspace and screens each against
    // the firm ledger.
    runtime: 'live',
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
    // runtime=live: the daily Inngest cron
    // `property-management-rent-collection-chase-sweep` fires this skill for
    // every PROPERTY_MANAGEMENT workspace with an ACTIVE Buildium credential
    // once BUILDIUM_ADAPTER_LIVE=on. Without this flag the entry defaulted to
    // schema-only, so isSkillInstalledByDefault returned false and the cron's
    // install-gate skipped it — the killer workflow silently never fired.
    runtime: 'live',
    mcpDependencies: [
      {
        provider: 'buildium',
        status: 'built',
        note:
          'Buildium MCP (lib/integrations/buildium-mcp/) backs the RentRollLookup ' +
          'port via BuildiumRentRollLookup. Live calls gated by ' +
          'BUILDIUM_ADAPTER_LIVE=on; fixtures by default. AppFolio / Propertyware ' +
          '/ Yardi Breeze are the next adapters behind the same port.',
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
      'lib/integrations/buildium-mcp/ (RentRollLookup adapter)',
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
