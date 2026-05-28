/**
 * lib/disciplines/skill-mapping.ts
 *
 * Surgical mapping from skill catalog slugs + agent roster slugs to
 * disciplines. Kept as a sidecar module rather than threading a new
 * field through every `SkillCatalogEntry` and `AgentRosterEntry` so the
 * Strand 3 UX wedge lands without rewriting the runtime catalog or the
 * 11 vertical content files.
 *
 * When the runtime layers deepen, this mapping moves INTO the catalog +
 * roster entries themselves. For now (the panel exists, the wiring
 * deepens later), the sidecar is the right scope.
 *
 * Unknown slugs map to NULL — the discipline detail page filters them
 * out, and the count badge stays honest (it does not invent a bucket
 * for an unmapped capability).
 */

import type { DisciplineId } from './index';

/**
 * Skill slug → discipline. Skills are the source of truth for what
 * "fires" today (per `docs/agent-interviews/00-MASTER.md` — 16 runtime
 * skills, 1 firing on production data). The mapping reflects each
 * skill's primary discipline.
 *
 * Slugs match `lib/skills/registry.ts → SKILL_CATALOG[*].slug`.
 */
export const SKILL_DISCIPLINE: Record<string, DisciplineId> = {
  // Horizontal / cross-role skills
  'chief-of-staff-scheduler': 'operations',
  'office-admin': 'operations',
  'inbox-triage-general': 'operations',
  'follow-up-chaser-general': 'sales-enablement',
  'process-doc-drafter-general': 'operations',
  // Support-handler — drafts a first-touch reply to /help SupportRequests
  // and queues it for operator approval. Tagged customer-success so the
  // discipline-grouped approvals page groups these alongside the rest of
  // the customer-facing-comms drafts.
  'support-handler': 'customer-success',
  // Vertical-specific skills
  'invoice-chasing-realestate': 'finance',
  'lead-triage-realestate': 'sales-enablement',
  'month-end-close-cpa': 'finance',
  'law-intake-conflict-screen': 'legal',
  'ria-client-update-draft': 'customer-success',
  'insurance-coi-request': 'operations',
  'mortgage-document-chase': 'operations',
  'home-services-estimate-followup': 'sales-enablement',
  'recruiting-candidate-status-update': 'customer-success',
  'property-management-rent-collection-chase': 'finance',
  'title-escrow-closing-doc-chase': 'operations',
};

/**
 * Roster agent slug → discipline. Roster agents are the customer-facing
 * fleet names on /agents; some are bound to a skill (live), others are
 * rooting. The mapping covers both so the panel + the agents page can
 * facet by discipline.
 *
 * Slugs match `lib/verticals/<vertical>/content.ts → agentRoster[*].slug`.
 */
export const AGENT_DISCIPLINE: Record<string, DisciplineId> = {
  // Realty
  'realty-listing-coordinator': 'operations',
  'realty-buyer-inquiry-router': 'sales-enablement',
  'realty-showing-scheduler': 'operations',
  'realty-compliance-sentinel': 'legal',
  'realty-crm-hygiene': 'operations',
  'realty-production-reporter': 'analytics',
  'realty-recruiter-assistant': 'customer-success',
  'realty-chief-of-staff': 'operations',
  // CPA
  'cpa-onboarding': 'operations',
  'cpa-doc-chase': 'operations',
  'cpa-compliance-sentinel': 'legal',
  'cpa-books-recon': 'finance',
  'cpa-collections': 'finance',
  'cpa-billing': 'finance',
  'cpa-client-services': 'customer-success',
  'cpa-chief-of-staff': 'operations',
  // Law
  'law-intake-coordinator': 'operations',
  'law-conflict-screen': 'legal',
  'law-document-prep': 'legal',
  'law-billable-time': 'finance',
  'law-collections': 'finance',
  'law-client-comms': 'customer-success',
  'law-chief-of-staff': 'operations',
  // Insurance
  'insurance-coi-coordinator': 'operations',
  'insurance-policy-renewal': 'sales-enablement',
  'insurance-claims-update': 'customer-success',
  'insurance-compliance-sentinel': 'legal',
  'insurance-collections': 'finance',
  'insurance-chief-of-staff': 'operations',
  // Mortgage
  'mortgage-doc-chase': 'operations',
  'mortgage-borrower-status': 'customer-success',
  'mortgage-compliance-sentinel': 'legal',
  'mortgage-pipeline-reporter': 'analytics',
  'mortgage-chief-of-staff': 'operations',
  // Home services
  'home-services-estimate-followup': 'sales-enablement',
  'home-services-job-scheduler': 'operations',
  'home-services-collections': 'finance',
  'home-services-customer-update': 'customer-success',
  'home-services-chief-of-staff': 'operations',
  // Property management
  'pm-rent-collection': 'finance',
  'pm-maintenance-coordinator': 'operations',
  'pm-tenant-comms': 'customer-success',
  'pm-owner-reports': 'analytics',
  'pm-chief-of-staff': 'operations',
  // Title escrow
  'title-closing-doc-chase': 'operations',
  'title-compliance-sentinel': 'legal',
  'title-chief-of-staff': 'operations',
  // Recruiting
  'recruiting-candidate-status': 'customer-success',
  'recruiting-interview-scheduler': 'operations',
  'recruiting-pipeline-reporter': 'analytics',
  'recruiting-chief-of-staff': 'operations',
  // RIA
  'ria-client-quarterly-update': 'customer-success',
  'ria-portfolio-research': 'research',
  'ria-compliance-sentinel': 'legal',
  'ria-chief-of-staff': 'operations',
};

/** Resolve a skill slug to its discipline. Returns null on unknown slugs. */
export function disciplineForSkill(slug: string): DisciplineId | null {
  return SKILL_DISCIPLINE[slug] ?? null;
}

/** Resolve an agent slug to its discipline. Returns null on unknown slugs. */
export function disciplineForAgent(slug: string): DisciplineId | null {
  return AGENT_DISCIPLINE[slug] ?? null;
}
